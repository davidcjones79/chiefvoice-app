import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";

// Store active WebRTC bot processes
const activeWebRTCBots = new Map<string, { process: ChildProcess; port: number }>();

// Port range for WebRTC signaling servers (each bot gets its own port)
const BASE_PORT = 9000;
let nextPortOffset = 0;

function allocatePort(): number {
  const port = BASE_PORT + (nextPortOffset % 100);
  nextPortOffset++;
  return port;
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(500) });
      // Any response (even 404) means the server is up
      return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { callId, config, voice, ttsProvider } = await request.json();

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    console.log(`[WebRTC API] Starting WebRTC bot for call: ${callId}`);

    const port = allocatePort();
    const backendDir = path.join(process.cwd(), "backend");
    const startScript = path.join(backendDir, "start.sh");

    const botProcess = spawn(startScript, ["--webrtc", "--port", String(port)], {
      cwd: backendDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CALL_ID: callId,
        WEBRTC_PORT: String(port),
        WEBRTC_MODE: "true",
        TTS_PROVIDER: ttsProvider || "openai",
        OPENAI_VOICE: voice || "shimmer",
        ELEVENLABS_VOICE_ID: voice || "shimmer",
        PIPER_VOICE: voice || "shimmer",
      },
    });

    activeWebRTCBots.set(callId, { process: botProcess, port });

    botProcess.stdout?.on("data", (data) => {
      console.log(`[WebRTC Bot ${callId}] ${data.toString().trim()}`);
    });

    botProcess.stderr?.on("data", (data) => {
      console.error(`[WebRTC Bot ${callId}] ${data.toString().trim()}`);
    });

    botProcess.on("error", (error) => {
      console.error(`[WebRTC Bot ${callId}] Process error:`, error);
      activeWebRTCBots.delete(callId);
    });

    botProcess.on("exit", (code) => {
      console.log(`[WebRTC Bot ${callId}] Process exited with code: ${code}`);
      activeWebRTCBots.delete(callId);
    });

    // Wait for the bot's signaling server to be ready
    const ready = await waitForPort(port, 5000);
    if (!ready) {
      console.error(`[WebRTC API] Bot signaling server not ready on port ${port}`);
      botProcess.kill();
      activeWebRTCBots.delete(callId);
      return NextResponse.json(
        { error: "Bot signaling server failed to start" },
        { status: 500 }
      );
    }

    console.log(`[WebRTC API] Bot ready on port ${port}`);

    return NextResponse.json({
      signaling_url: `http://localhost:${port}/offer`,
      call_id: callId,
    });

  } catch (error) {
    console.error("[WebRTC API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const callId = url.pathname.split("/").pop();

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    console.log(`[WebRTC API] Cleaning up call: ${callId}`);

    const bot = activeWebRTCBots.get(callId);
    if (bot) {
      bot.process.kill();
      activeWebRTCBots.delete(callId);
      console.log(`[WebRTC API] Bot process killed: ${callId}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[WebRTC API] Error cleaning up:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
