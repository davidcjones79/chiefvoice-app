import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";

// Store active outbound calls
const activeOutboundBots = new Map<string, ChildProcess>();
const activeOutboundRooms = new Map<string, { url: string; name: string; reason: string }>();

/**
 * POST /api/pipecat/outbound - Initiate an AI-to-human outbound call
 *
 * Body:
 * - reason: string - Why the AI is calling (e.g., "Urgent email from Fillmore Capital")
 * - urgency: "low" | "medium" | "high" | "critical" - Urgency level
 * - context?: string - Additional context for the AI to discuss
 * - notifyTelegram?: boolean - Send Telegram notification (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const { reason, urgency = "medium", context, notifyTelegram = true } = await request.json();

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    const callId = `outbound-${Date.now()}`;
    console.log(`[Outbound] Initiating call: ${callId}`);
    console.log(`[Outbound] Reason: ${reason}`);
    console.log(`[Outbound] Urgency: ${urgency}`);

    // Create a Daily.co room
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      return NextResponse.json(
        { error: "DAILY_API_KEY not configured" },
        { status: 500 }
      );
    }

    const roomResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${dailyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          enable_chat: false,
          enable_knocking: false,
          enable_screenshare: false,
          enable_prejoin_ui: false,
          max_participants: 2,
        },
      }),
    });

    if (!roomResponse.ok) {
      const errorText = await roomResponse.text();
      console.error("[Outbound] Daily API error:", errorText);
      return NextResponse.json(
        { error: `Daily API error: ${errorText}` },
        { status: roomResponse.status }
      );
    }

    const roomData = await roomResponse.json();
    const roomUrl = roomData.url;
    const roomName = roomData.name;

    console.log(`[Outbound] Room created: ${roomUrl}`);
    activeOutboundRooms.set(callId, { url: roomUrl, name: roomName, reason });

    // Build the Chief join URL
    const chiefBaseUrl = process.env.CHIEF_PUBLIC_URL || "http://localhost:3001";
    const joinUrl = `${chiefBaseUrl}?outbound=${callId}&room=${encodeURIComponent(roomUrl)}`;

    // Start the Python bot in outbound mode
    const botStarted = await startOutboundBot(roomUrl, callId, reason, urgency, context);
    if (!botStarted) {
      return NextResponse.json(
        { error: "Failed to start bot process" },
        { status: 500 }
      );
    }

    // Send Telegram notification
    if (notifyTelegram) {
      await sendTelegramNotification(reason, urgency, joinUrl);
    }

    return NextResponse.json({
      success: true,
      call_id: callId,
      room_url: roomUrl,
      join_url: joinUrl,
      reason,
      urgency,
    });

  } catch (error) {
    console.error("[Outbound] Error initiating call:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function startOutboundBot(
  roomUrl: string,
  callId: string,
  reason: string,
  urgency: string,
  context?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const backendDir = path.join(process.cwd(), "backend");
    const startScript = path.join(backendDir, "start.sh");

    console.log(`[Outbound] Starting bot in outbound mode`);

    const botProcess = spawn(startScript, [roomUrl, callId], {
      cwd: backendDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DAILY_ROOM_URL: roomUrl,
        CALL_ID: callId,
        TTS_PROVIDER: process.env.TTS_PROVIDER || "openai",
        OPENAI_VOICE: process.env.OPENAI_VOICE || "shimmer",
        // Outbound-specific env vars
        OUTBOUND_MODE: "true",
        OUTBOUND_REASON: reason,
        OUTBOUND_URGENCY: urgency,
        OUTBOUND_CONTEXT: context || "",
      },
    });

    activeOutboundBots.set(callId, botProcess);

    botProcess.stdout?.on("data", (data) => {
      console.log(`[Outbound Bot ${callId}] ${data.toString().trim()}`);
    });

    botProcess.stderr?.on("data", (data) => {
      console.error(`[Outbound Bot ${callId}] ${data.toString().trim()}`);
    });

    botProcess.on("error", (error) => {
      console.error(`[Outbound Bot ${callId}] Process error:`, error);
      activeOutboundBots.delete(callId);
    });

    botProcess.on("exit", (code) => {
      console.log(`[Outbound Bot ${callId}] Process exited with code: ${code}`);
      activeOutboundBots.delete(callId);
      activeOutboundRooms.delete(callId);
    });

    // Give the bot time to start
    setTimeout(() => {
      const isRunning = activeOutboundBots.has(callId);
      console.log(`[Outbound] Bot running: ${isRunning}`);
      resolve(isRunning);
    }, 2000);
  });
}

async function sendTelegramNotification(reason: string, urgency: string, joinUrl: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("[Outbound] Telegram not configured, skipping notification");
    return;
  }

  const urgencyEmoji = {
    low: "📢",
    medium: "⚠️",
    high: "🚨",
    critical: "🔴",
  }[urgency] || "📞";

  // Extract outbound and room params for smart redirect URL
  const url = new URL(joinUrl);
  const outboundId = url.searchParams.get('outbound');
  const roomUrl = url.searchParams.get('room');
  const baseUrl = process.env.CHIEF_PUBLIC_URL || 'http://localhost:3001';

  // Smart redirect URL - tries to open app on iOS, falls back to web
  const smartJoinUrl = `${baseUrl}/api/pipecat/outbound/join?outbound=${outboundId}&room=${encodeURIComponent(roomUrl || '')}`;

  const message = `${urgencyEmoji} **Incoming Call from Rosie**

**Reason:** ${reason}
**Urgency:** ${urgency.toUpperCase()}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📞 Join Call", url: smartJoinUrl }]
          ]
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Outbound] Telegram API error:", errorText);
    } else {
      console.log("[Outbound] Telegram notification sent");
    }
  } catch (error) {
    console.error("[Outbound] Failed to send Telegram notification:", error);
  }
}

// GET - List active outbound calls
export async function GET() {
  const calls = Array.from(activeOutboundRooms.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));
  return NextResponse.json({ calls });
}
