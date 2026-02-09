import { NextRequest, NextResponse } from "next/server";
import { extractActionsFromTranscript, savePlan, sendApprovalRequest } from "@/lib/actions";

// This webhook receives events from Vapi and handles the voice-to-action pipeline

const VAPI_WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET || "";

interface VapiWebhookPayload {
  type: string;
  call?: {
    id: string;
    status: string;
    endedReason?: string;
  };
  message?: {
    role: string;
    content: string;
  };
  transcript?: string;
  summary?: string;
  messages?: Array<{
    role: string;
    content: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook is from VAPI
    if (VAPI_WEBHOOK_SECRET) {
      const vapiSecret = request.headers.get("x-vapi-secret");
      if (vapiSecret !== VAPI_WEBHOOK_SECRET) {
        console.warn("[Webhook] Rejected: invalid or missing x-vapi-secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      console.warn("[Webhook] VAPI_WEBHOOK_SECRET not configured — webhook is unprotected");
    }

    const payload: VapiWebhookPayload = await request.json();
    
    console.log("[Webhook] Vapi event received:", payload.type);

    // Handle different webhook types
    switch (payload.type) {
      case "assistant-request":
        // Vapi is asking for assistant configuration
        return NextResponse.json({
          assistant: getAssistantConfig(),
        });

      case "function-call":
        // Handle function calls if we add tools later
        return NextResponse.json({ result: "ok" });

      case "end-of-call-report":
        // 🎯 This is where the magic happens!
        // Extract actions from the conversation and send for approval
        await handleEndOfCall(payload);
        return NextResponse.json({ received: true });

      case "transcript":
        // Real-time transcript updates (for logging)
        console.log("[Webhook] Transcript update:", payload.transcript?.slice(-100));
        return NextResponse.json({ received: true });

      case "status-update":
        console.log("[Webhook] Call status:", payload.call?.status);
        return NextResponse.json({ received: true });

      default:
        console.log("[Webhook] Unhandled event type:", payload.type);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleEndOfCall(payload: VapiWebhookPayload) {
  const callId = payload.call?.id;
  const transcript = payload.transcript || payload.messages?.map(m => `${m.role}: ${m.content}`).join('\n') || '';
  
  if (!callId) {
    console.error("[Webhook] No call ID in end-of-call report");
    return;
  }

  console.log(`[Webhook] Processing end-of-call for ${callId}`);
  console.log(`[Webhook] Transcript length: ${transcript.length} chars`);

  // Extract actions from the conversation
  const actionPlan = await extractActionsFromTranscript(callId, transcript);
  
  console.log(`[Webhook] Extracted ${actionPlan.actions.length} actions:`, 
    actionPlan.actions.map(a => a.type).join(', '));

  if (actionPlan.actions.length === 0) {
    console.log("[Webhook] No actions to execute");
    return;
  }

  // Save the plan
  savePlan(actionPlan);

  // Send approval request to Telegram
  const sent = await sendApprovalRequest(actionPlan);
  if (sent) {
    console.log("[Webhook] Approval request sent to Telegram");
  } else {
    console.error("[Webhook] Failed to send approval request");
  }
}

function getAssistantConfig() {
  const publicUrl = process.env.CHIEF_PUBLIC_URL || 'https://localhost:3001';
  const chiefEnabled = process.env.CHIEFVOICE_ENABLED === 'true';
  
  return {
    name: "Chief",
    model: chiefEnabled ? {
      provider: "custom-llm",
      model: "chiefvoice",
      url: `${publicUrl}/api/vapi/chat/completions`,
      temperature: 0.7,
      maxTokens: 500,
      messages: [{
        role: "system",
        content: getSystemPrompt(),
      }],
    } : {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [{
        role: "system", 
        content: getSystemPrompt(),
      }],
    },
    voice: {
      provider: "11labs",
      voiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
      stability: 0.5,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
    firstMessage: "Hey! What can I help you with?",
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "off",
    backchannelingEnabled: false,
  };
}

function getSystemPrompt(): string {
  return `You are a helpful voice assistant. Keep responses concise and conversational. Avoid markdown or formatting.

IMPORTANT: When the user asks you to do something actionable (send email, add task, set reminder, etc.), acknowledge the request and confirm what you'll do. These actions will be executed after the call ends.

Example actions you can help with:
- Send emails ("Send an email to mom thanking her")
- Add tasks ("Add a task to call the dentist")
- Set reminders ("Remind me at 3pm to take a break")
- Check calendar ("What's on my schedule today?")
- Send messages ("Text John that I'm running late")

When you need to look something up or perform an action, start with a brief acknowledgment like:
- "Let me check that for you..."
- "I'll set that up..."
- "Got it, I'll send that..."

At the end of the call, all requested actions will be summarized and confirmed before execution.`;
}
