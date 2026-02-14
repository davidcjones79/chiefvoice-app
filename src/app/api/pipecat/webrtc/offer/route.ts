import { NextRequest, NextResponse } from "next/server";

/**
 * HTTPS proxy for SmallWebRTC SDP signaling.
 *
 * Proxies SDP offer/answer exchange to the ChiefVoice gateway's
 * /api/voice/offer endpoint. This avoids mixed-content blocks when
 * the frontend runs over HTTPS.
 *
 * SmallWebRTCTransport sends:
 *   POST  /offer — SDP offer/answer exchange
 *   PATCH /offer — ICE candidate trickle
 */

const GATEWAY_URL = process.env.CHIEFVOICE_GATEWAY_HTTP_URL || "http://localhost:8000";

async function proxyToGateway(request: NextRequest, method: string) {
  try {
    const body = await request.text();
    console.log(`[WebRTC Offer Proxy] ${method} → ${GATEWAY_URL}/api/voice/offer (${body.length} bytes)`);

    const res = await fetch(`${GATEWAY_URL}/api/voice/offer`, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });

    const answer = await res.text();
    console.log(`[WebRTC Offer Proxy] Gateway responded ${res.status} (${answer.length} bytes)`);

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
  return proxyToGateway(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return proxyToGateway(request, "PATCH");
}
