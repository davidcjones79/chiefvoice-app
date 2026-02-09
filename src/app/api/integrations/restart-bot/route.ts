import { NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const BOT_PORT = parseInt(process.env.WEBRTC_BOT_PORT || "9000", 10);
const HEALTH_POLL_INTERVAL = 500; // ms
const HEALTH_POLL_TIMEOUT = 15_000; // ms

async function killBotOnPort(port: number): Promise<void> {
  try {
    await execAsync(`fuser -k ${port}/tcp 2>/dev/null`);
    // Give it a moment to actually die
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    // fuser returns non-zero if nothing is on the port — that's fine
  }
}

async function spawnBot(): Promise<void> {
  const startScript = process.env.BOT_START_COMMAND || "start.sh --webrtc --port 9000";
  const parts = startScript.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  // Fire and forget — the bot runs as a long-lived process
  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function pollHealth(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL));
  }
  return false;
}

/**
 * POST — Restart the chief_bot.py process.
 * 1. Kill whatever is on BOT_PORT
 * 2. Spawn new bot
 * 3. Poll until healthy or timeout
 */
export async function POST() {
  try {
    console.log(`[Restart Bot] Killing process on port ${BOT_PORT}...`);
    await killBotOnPort(BOT_PORT);

    console.log("[Restart Bot] Spawning new bot...");
    await spawnBot();

    console.log("[Restart Bot] Polling for health...");
    const healthy = await pollHealth(BOT_PORT, HEALTH_POLL_TIMEOUT);

    if (healthy) {
      console.log("[Restart Bot] Bot is healthy.");
      return NextResponse.json({ success: true, status: "healthy" });
    } else {
      console.warn("[Restart Bot] Bot did not become healthy within timeout.");
      return NextResponse.json(
        {
          success: false,
          status: "timeout",
          error: `Bot did not respond on port ${BOT_PORT} within ${HEALTH_POLL_TIMEOUT / 1000}s`,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[Restart Bot] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
