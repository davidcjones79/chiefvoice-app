import { NextRequest, NextResponse } from "next/server";

/**
 * SmallWebRTC session endpoint.
 *
 * Routes to the ChiefVoice gateway's integrated voice endpoint at
 * GATEWAY_URL/api/voice/offer. The gateway runs SmallWebRTCRequestHandler
 * inside the FastAPI process, creating a new pipeline per SDP offer.
 *
 * POST  → health-check the gateway and return the HTTPS signaling proxy URL
 * DELETE → no-op (gateway manages bot lifecycle)
 */

const GATEWAY_URL = process.env.CHIEFVOICE_GATEWAY_HTTP_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json();

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 });
    }

    console.log(`[WebRTC API] New call: ${callId}, checking gateway at ${GATEWAY_URL}`);

    // Verify the gateway is running
    try {
      await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(2000) });
    } catch {
      return NextResponse.json(
        { error: "Gateway is not running. Start the ChiefVoice gateway first." },
        { status: 503 }
      );
    }

    // Return the signaling URL via our HTTPS proxy to avoid mixed-content blocks.
    const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const host = request.headers.get("host") || "localhost:3000";
    const signalingUrl = `${proto}://${host}/api/pipecat/webrtc/offer`;
    console.log(`[WebRTC API] Signaling URL: ${signalingUrl} (proxying to gateway)`);

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
