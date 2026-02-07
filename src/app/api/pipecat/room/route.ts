import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";

// Store active bot processes
const activeBots = new Map<string, ChildProcess>();
const activeRooms = new Map<string, { url: string; name: string }>();

export async function POST(request: NextRequest) {
  try {
    const { callId, config, voice, ttsProvider } = await request.json();
    
    if (!callId) {
      return NextResponse.json(
        { error: "callId is required" },
        { status: 400 }
      );
    }

    console.log(`[Pipecat API] Creating room for call: ${callId}`);

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
      console.error("[Pipecat API] Daily API error:", errorText);
      return NextResponse.json(
        { error: `Daily API error: ${errorText}` },
        { status: roomResponse.status }
      );
    }

    const roomData = await roomResponse.json();
    const roomUrl = roomData.url;
    const roomName = roomData.name;

    console.log(`[Pipecat API] Room created: ${roomUrl}`);
    activeRooms.set(callId, { url: roomUrl, name: roomName });

    // Start the Python bot process
    const botStarted = await startBot(roomUrl, callId, voice || "shimmer", ttsProvider || "openai");
    if (!botStarted) {
      return NextResponse.json(
        { error: "Failed to start bot process" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      room_url: roomUrl,
      room_name: roomName,
      call_id: callId,
    });

  } catch (error) {
    console.error("[Pipecat API] Error creating room:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function startBot(roomUrl: string, callId: string, voice: string, ttsProvider: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Backend is now in the same repo under /backend
    const backendDir = path.join(process.cwd(), "backend");
    const startScript = path.join(backendDir, "start.sh");

    console.log(`[Pipecat API] Starting bot: ${startScript}`);
    console.log(`[Pipecat API] Room URL: ${roomUrl}`);
    console.log(`[Pipecat API] Call ID: ${callId}`);
    console.log(`[Pipecat API] Voice: ${voice}`);
    console.log(`[Pipecat API] TTS Provider: ${ttsProvider}`);

    const botProcess = spawn(startScript, [roomUrl, callId], {
      cwd: backendDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DAILY_ROOM_URL: roomUrl,
        CALL_ID: callId,
        TTS_PROVIDER: ttsProvider,
        OPENAI_VOICE: voice,
        ELEVENLABS_VOICE_ID: voice,
        PIPER_VOICE: voice,
      },
    });

    activeBots.set(callId, botProcess);

    botProcess.stdout?.on("data", (data) => {
      console.log(`[Bot ${callId}] ${data.toString().trim()}`);
    });

    botProcess.stderr?.on("data", (data) => {
      console.error(`[Bot ${callId}] ${data.toString().trim()}`);
    });

    botProcess.on("error", (error) => {
      console.error(`[Bot ${callId}] Process error:`, error);
      activeBots.delete(callId);
    });

    botProcess.on("exit", (code) => {
      console.log(`[Bot ${callId}] Process exited with code: ${code}`);
      activeBots.delete(callId);
      activeRooms.delete(callId);
    });

    // Give the bot a moment to start
    setTimeout(() => {
      const isRunning = activeBots.has(callId);
      console.log(`[Pipecat API] Bot running: ${isRunning}`);
      resolve(isRunning);
    }, 2000);
  });
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const callId = url.pathname.split('/').pop();

    if (!callId) {
      return NextResponse.json(
        { error: "callId is required" },
        { status: 400 }
      );
    }

    console.log(`[Pipecat API] Cleaning up call: ${callId}`);

    // Kill the bot process
    const botProcess = activeBots.get(callId);
    if (botProcess) {
      botProcess.kill();
      activeBots.delete(callId);
      console.log(`[Pipecat API] Bot process killed: ${callId}`);
    }

    // Delete the Daily room
    const room = activeRooms.get(callId);
    if (room) {
      const dailyApiKey = process.env.DAILY_API_KEY;
      if (dailyApiKey) {
        await fetch(`https://api.daily.co/v1/rooms/${room.name}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${dailyApiKey}`,
          },
        }).catch(err => console.error("Failed to delete Daily room:", err));
      }
      activeRooms.delete(callId);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Pipecat API] Error cleaning up:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
      );
  }
}
