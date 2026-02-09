import { NextRequest, NextResponse } from "next/server";

/**
 * HTTPS proxy for SmallWebRTC SDP signaling.
 *
 * The bot's aiohttp server runs on plain HTTP (localhost:BOT_PORT/offer).
 * The browser can't call HTTP from an HTTPS page (mixed content).
 * This route proxies the SDP exchange so everything stays HTTPS.
 *
 * SmallWebRTCTransport sends:
 *   POST  /offer — SDP offer/answer exchange
 *   PATCH /offer — ICE candidate trickle
 */

const BOT_PORT = parseInt(process.env.WEBRTC_BOT_PORT || "9000", 10);

async function proxyToBot(request: NextRequest, method: string) {
  try {
    const body = await request.text();
    console.log(`[WebRTC Offer Proxy] ${method} → localhost:${BOT_PORT}/offer (${body.length} bytes)`);

    const res = await fetch(`http://localhost:${BOT_PORT}/offer`, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });

    const answer = await res.text();
    console.log(`[WebRTC Offer Proxy] Bot responded ${res.status} (${answer.length} bytes)`);

    return new NextResponse(answer, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WebRTC Offer Proxy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy error" },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  return proxyToBot(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return proxyToBot(request, "PATCH");
}
