import { NextRequest, NextResponse } from "next/server";
import { getPlan, updatePlan, getCallIdFromMessage, deleteMessageMapping } from "@/lib/actions/store";
import { approveAllActions, rejectAllActions, executePlan } from "@/lib/actions/executor";
import { ActionPlan } from "@/lib/actions/types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
  message_reaction?: {
    chat: { id: number };
    message_id: number;
    user?: { id: number };
    new_reaction: Array<{ type: string; emoji?: string }>;
    old_reaction: Array<{ type: string; emoji?: string }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    
    // Handle emoji reactions (👍 approve, 👎 reject)
    if (update.message_reaction) {
      return handleReaction(update.message_reaction);
    }
    
    if (!update.callback_query) {
      return NextResponse.json({ ok: true });
    }

    const { id: callbackId, data, message } = update.callback_query;
    console.log(`[Telegram Callback] Received: ${data}`);

    // Parse callback data: "action:callId"
    const [action, callId] = data.split(':');

    // Answer the callback to remove loading state
    await answerCallback(callbackId);

    // Get the plan
    const plan = getPlan(callId);
    if (!plan) {
      await editMessage(message?.chat.id, message?.message_id, 
        "❌ Action plan not found or expired.");
      return NextResponse.json({ ok: true });
    }

    let updatedPlan: ActionPlan;
    let statusMessage: string;

    switch (action) {
      case 'approve_all':
        updatedPlan = approveAllActions(plan);
        updatePlan(callId, updatedPlan);
        statusMessage = "✅ All actions approved! Executing...";
        await editMessage(message?.chat.id, message?.message_id, statusMessage);
        // Execute the plan
        await executePlan(updatedPlan);
        break;

      case 'reject_all':
        updatedPlan = rejectAllActions(plan);
        updatePlan(callId, updatedPlan);
        statusMessage = "🚫 All actions rejected.";
        await editMessage(message?.chat.id, message?.message_id, statusMessage);
        break;

      case 'execute':
        statusMessage = "▶️ Executing safe actions...";
        await editMessage(message?.chat.id, message?.message_id, statusMessage);
        await executePlan(plan);
        break;

      case 'cancel':
        updatedPlan = rejectAllActions(plan);
        updatePlan(callId, updatedPlan);
        statusMessage = "❌ Cancelled.";
        await editMessage(message?.chat.id, message?.message_id, statusMessage);
        break;

      case 'review':
        // TODO: Send individual action buttons for review
        statusMessage = "📝 Review mode - sending individual actions...";
        await editMessage(message?.chat.id, message?.message_id, statusMessage);
        // For MVP, just list actions and ask for approval
        break;

      default:
        console.log(`[Telegram Callback] Unknown action: ${action}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Callback] Error:", error);
    return NextResponse.json({ error: "Callback processing failed" }, { status: 500 });
  }
}

async function answerCallback(callbackId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text: text || 'Processing...',
    }),
  });
}

async function editMessage(chatId?: number, messageId?: number, text?: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId || !messageId || !text) return;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
    }),
  });
}

async function sendMessage(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
    }),
  });
}

async function handleReaction(reaction: TelegramUpdate['message_reaction']): Promise<NextResponse> {
  if (!reaction) return NextResponse.json({ ok: true });
  
  const { message_id, new_reaction } = reaction;
  console.log(`[Telegram] Reaction on message ${message_id}:`, new_reaction);
  
  // Get the callId from the message mapping
  const callId = getCallIdFromMessage(message_id);
  if (!callId) {
    console.log(`[Telegram] No plan mapped to message ${message_id}`);
    return NextResponse.json({ ok: true });
  }
  
  // Get the plan
  const plan = getPlan(callId);
  if (!plan) {
    console.log(`[Telegram] Plan ${callId} not found`);
    return NextResponse.json({ ok: true });
  }
  
  // Check the emoji
  const emoji = new_reaction[0]?.emoji;
  console.log(`[Telegram] Processing reaction: ${emoji} for plan ${callId.slice(-6)}`);
  
  if (emoji === '👍' || emoji === '👍🏻' || emoji === '👍🏼' || emoji === '👍🏽' || emoji === '👍🏾' || emoji === '👍🏿') {
    // Approve
    console.log(`[Telegram] Approving plan ${callId.slice(-6)}`);
    const approvedPlan = approveAllActions(plan);
    updatePlan(callId, approvedPlan);
    await sendMessage(`✅ Approved! Executing plan ${callId.slice(-6)}...`);
    await executePlan(approvedPlan);
    deleteMessageMapping(message_id);
  } else if (emoji === '👎' || emoji === '👎🏻' || emoji === '👎🏼' || emoji === '👎🏽' || emoji === '👎🏾' || emoji === '👎🏿') {
    // Reject
    console.log(`[Telegram] Rejecting plan ${callId.slice(-6)}`);
    const rejectedPlan = rejectAllActions(plan);
    updatePlan(callId, rejectedPlan);
    await sendMessage(`🚫 Rejected plan ${callId.slice(-6)}`);
    deleteMessageMapping(message_id);
  }
  
  return NextResponse.json({ ok: true });
}
