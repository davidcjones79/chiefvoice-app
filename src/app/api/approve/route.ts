import { NextRequest, NextResponse } from "next/server";
import { getPlan, getPlanByShortId, updatePlan, listPendingPlans } from "@/lib/actions/store";
import { approveAllActions, rejectAllActions, executePlan } from "@/lib/actions/executor";
import { sendExecutionReport } from "@/lib/actions/telegram";

// Simple auth - should match ChiefVoice gateway token for now
const API_TOKEN = process.env.CHIEFVOICE_GATEWAY_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Check auth
    const authHeader = request.headers.get('authorization');
    if (API_TOKEN && authHeader !== `Bearer ${API_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, callId } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    // Get plan by short ID (last 6 chars) or full ID
    const plan = callId 
      ? (callId.length <= 8 ? getPlanByShortId(callId) : getPlan(callId))
      : getLatestPendingPlan();

    if (!plan) {
      return NextResponse.json({ 
        error: "No pending action plan found",
        hint: callId ? `No plan matching ID: ${callId}` : "No pending plans"
      }, { status: 404 });
    }

    let result: { success: boolean; message: string };

    switch (action) {
      case 'approve':
      case 'run':
        const approvedPlan = approveAllActions(plan);
        updatePlan(plan.callId, approvedPlan);
        await executePlan(approvedPlan);
        await sendExecutionReport(approvedPlan);
        result = { success: true, message: `Executed ${approvedPlan.actions.length} action(s)` };
        break;

      case 'reject':
      case 'cancel':
        const rejectedPlan = rejectAllActions(plan);
        updatePlan(plan.callId, rejectedPlan);
        result = { success: true, message: "All actions rejected" };
        break;

      case 'status':
        result = { 
          success: true, 
          message: `Plan ${plan.callId.slice(-6)}: ${plan.status}, ${plan.actions.length} action(s)` 
        };
        break;

      case 'list':
        const pending = listPendingPlans();
        result = {
          success: true,
          message: pending.length > 0 
            ? `${pending.length} pending: ${pending.map(p => p.callId.slice(-6)).join(', ')}`
            : "No pending plans"
        };
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Approve API] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

function getLatestPendingPlan() {
  const pending = listPendingPlans();
  return pending.length > 0 ? pending[pending.length - 1] : null;
}
