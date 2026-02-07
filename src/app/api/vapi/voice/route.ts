import { NextRequest, NextResponse } from "next/server";

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || "780c4e19-b24b-4c36-a206-76e160ddc982";

export async function POST(request: NextRequest) {
  try {
    const { voiceId, speed } = await request.json();

    if (!voiceId) {
      return NextResponse.json({ error: "voiceId required" }, { status: 400 });
    }

    if (!VAPI_API_KEY) {
      return NextResponse.json({ error: "VAPI_API_KEY not configured" }, { status: 500 });
    }

    // Build voice config
    const voiceConfig: Record<string, unknown> = {
      provider: "11labs",
      voiceId: voiceId,
    };
    
    // Add speed if specified (ElevenLabs supports 0.25-4.0)
    if (speed !== undefined) {
      voiceConfig.speed = speed;
    }

    // Update VAPI assistant with new voice
    const res = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice: voiceConfig,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("[Voice] Failed to update VAPI assistant:", error);
      return NextResponse.json({ error: "Failed to update voice" }, { status: 500 });
    }

    const data = await res.json();
    console.log(`[Voice] Updated to: ${data.voice?.voiceId}`);

    return NextResponse.json({ success: true, voiceId: data.voice?.voiceId });
  } catch (error) {
    console.error("[Voice] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
