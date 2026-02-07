import { NextRequest } from "next/server";
import { setCallMode, getCallModeData } from "@/app/api/vapi/chat/completions/route";
import { type ConversationMode, type ResponseFormat, DEFAULT_MODE, MODE_CONFIG } from "@/lib/modes";

/**
 * API to set/get conversation mode for a call.
 * This allows the client to set mode before starting a voice call,
 * so the VAPI endpoint can use the same mode.
 */

interface ModeRequest {
  callId: string;
  mode?: ConversationMode;
  responseFormat?: ResponseFormat;
  customPrompt?: string;
}

const VALID_MODES = Object.keys(MODE_CONFIG);
const VALID_FORMATS: ResponseFormat[] = ['default', 'concise', 'detailed'];

export async function POST(request: NextRequest) {
  try {
    const body: ModeRequest = await request.json();
    
    if (!body.callId) {
      return Response.json({ error: "callId is required" }, { status: 400 });
    }

    const mode = body.mode || DEFAULT_MODE;
    const responseFormat = body.responseFormat || 'default';
    const customPrompt = body.customPrompt;
    
    // Validate mode
    if (!VALID_MODES.includes(mode)) {
      return Response.json({ error: `Invalid mode. Valid modes: ${VALID_MODES.join(', ')}` }, { status: 400 });
    }

    // Validate response format
    if (!VALID_FORMATS.includes(responseFormat)) {
      return Response.json({ error: `Invalid responseFormat. Valid formats: ${VALID_FORMATS.join(', ')}` }, { status: 400 });
    }

    setCallMode(body.callId, mode as ConversationMode, responseFormat, customPrompt);
    
    console.log(`[Mode API] Set mode for call ${body.callId}: ${mode}, format: ${responseFormat}, hasCustomPrompt: ${!!customPrompt}`);
    
    return Response.json({ 
      success: true, 
      callId: body.callId, 
      mode, 
      responseFormat,
      hasCustomPrompt: !!customPrompt 
    });
  } catch (error) {
    console.error("[Mode API] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const callId = request.nextUrl.searchParams.get("callId");
  
  if (!callId) {
    return Response.json({ error: "callId is required" }, { status: 400 });
  }
  
  const modeData = getCallModeData(callId);
  
  return Response.json({ 
    callId, 
    mode: modeData.mode,
    responseFormat: modeData.responseFormat,
    hasCustomPrompt: !!modeData.customPrompt
  });
}
