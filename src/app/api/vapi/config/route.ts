import { NextRequest, NextResponse } from "next/server";

// Returns the Vapi assistant configuration for starting calls
// This is called client-side before initiating a Vapi call

// When CHIEFVOICE_ENABLED is true, use custom LLM routing through ChiefVoice
const CHIEFVOICE_ENABLED = process.env.CHIEFVOICE_ENABLED === "true";

export async function GET(request: NextRequest) {
  // Get the public URL for Vapi to call back
  // The x-forwarded-host header contains the public hostname when behind a proxy
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "localhost:3000";
  
  // Always use HTTPS for non-localhost hosts (Vapi requires HTTPS for callbacks)
  const isLocalhost = host.includes("localhost") || host.startsWith("127.");
  const protocol = isLocalhost ? "http" : "https";
  const customLlmUrl = process.env.CHIEF_PUBLIC_URL ? `${process.env.CHIEF_PUBLIC_URL}/api/vapi` : `${protocol}://${host}/api/vapi`;
  
  console.log(`[Vapi Config] Custom LLM URL: ${customLlmUrl}`);

  const config = CHIEFVOICE_ENABLED
    ? getChiefConfig(customLlmUrl)
    : getStandaloneConfig();

  console.log(`[Vapi Config] ChiefVoice enabled: ${CHIEFVOICE_ENABLED}`);
  
  return NextResponse.json(config);
}

/**
 * Config when ChiefVoice integration is enabled.
 * Routes LLM calls through our custom endpoint -> ChiefVoice Gateway.
 */
function getChiefConfig(customLlmUrl: string) {
  // Use pre-created assistant ID for reliability
  // Assistant created via Vapi API with custom-llm pointing to our endpoint
  const assistantId = process.env.VAPI_ASSISTANT_ID || "780c4e19-b24b-4c36-a206-76e160ddc982";
  
  return {
    assistantId: assistantId,
  };
}

/**
 * Config when running standalone (using Vapi's built-in LLM).
 */
function getStandaloneConfig() {
  return {
    name: "Chief",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      systemPrompt: getSystemPrompt(),
    },
    voice: getVoiceConfig(),
    transcriber: getTranscriberConfig(),
    firstMessage: "Hey! I'm Chief. What would you like to talk about?",
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "off",
    backchannelingEnabled: false,
  };
}

function getVoiceConfig() {
  return {
    provider: "11labs",
    voiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM", // Rachel
    stability: 0.5,
    similarityBoost: 0.75,
  };
}

function getTranscriberConfig() {
  return {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
    // Wait longer before finalizing speech (milliseconds)
    // Default is ~250ms, increasing to 800ms to capture complete thoughts
    endpointing: 800,
  };
}

function getSystemPrompt(): string {
  return `You are Chief, a friendly voice assistant.

Guidelines:
- Keep responses concise and conversational (1-3 sentences typically)
- Speak naturally, as if chatting with a friend
- Avoid markdown, bullet points, or formatting
- Ask clarifying questions when needed
- Be helpful, warm, and engaging

You're here to help with whatever the user needs - answering questions, brainstorming, having a friendly chat, or anything else.`;
}
