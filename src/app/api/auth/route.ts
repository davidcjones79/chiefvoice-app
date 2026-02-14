/**
 * Auth proxy — forwards login requests to the ChiefVoice gateway.
 */
import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.CHIEFVOICE_GATEWAY_HTTP_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${GATEWAY_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Authentication failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Auth] Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to authentication service" },
      { status: 502 }
    );
  }
}
