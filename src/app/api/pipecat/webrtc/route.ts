import { NextRequest, NextResponse } from "next/server";

/**
 * SmallWebRTC session endpoint.
 *
 * The bot runs as a long-lived process (started manually or via systemd)
 * on BOT_PORT (default 9000).  SmallWebRTCRequestHandler inside the bot
 * creates a new pipeline per SDP offer, so one process serves many calls.
 *
 * POST  → health-check the bot and return the HTTPS signaling proxy URL
 * DELETE → no-op (bot lifecycle is external)
 */

const BOT_PORT = parseInt(process.env.WEBRTC_BOT_PORT || "9000", 10);

export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json();

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    console.log(`[WebRTC API] New call: ${callId}, checking bot on port ${BOT_PORT}`);

    // Verify the bot is running
    try {
      await fetch(`http://localhost:${BOT_PORT}/`, { signal: AbortSignal.timeout(2000) });
    } catch {
      return NextResponse.json(
        { error: "WebRTC bot is not running. Start it with: start.sh --webrtc --port 9000" },
        { status: 503 }
      );
    }

    // Return the signaling URL via our HTTPS proxy to avoid mixed-content blocks.
    const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const host = request.headers.get("host") || "localhost:3000";
    const signalingUrl = `${proto}://${host}/api/pipecat/webrtc/offer`;
    console.log(`[WebRTC API] Signaling URL: ${signalingUrl} (proxying to localhost:${BOT_PORT})`);

    return NextResponse.json({
      signaling_url: signalingUrl,
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

export async function DELETE() {
  // Bot lifecycle is managed externally — nothing to clean up here
  return NextResponse.json({ success: true });
}
