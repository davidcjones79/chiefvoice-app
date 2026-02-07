import { NextRequest } from "next/server";
import { streamChatMessage } from "@/lib/gateway/server-client";
import { activityStream, parseActivityFromText } from "@/lib/activity-stream";
import { savePlan, sendApprovalRequest } from "@/lib/actions";
import { ActionPlan, Action, generateActionId, getPrivilegeLevel } from "@/lib/actions/types";
import { stripCards } from "@/lib/cards/parser";
import { 
  MODE_PROMPTS, 
  type ConversationMode, 
  type ResponseFormat,
  DEFAULT_MODE, 
  detectModeCommand,
  getFullModePrompt 
} from "@/lib/modes";

// In-memory mode storage per call (for voice calls to use the same mode as text)
// This is a simple solution; for production, use Redis or database
interface CallModeData {
  mode: ConversationMode;
  responseFormat: ResponseFormat;
  customPrompt?: string;
}

const callModeStore = new Map<string, CallModeData>();

export function setCallMode(
  callId: string, 
  mode: ConversationMode, 
  responseFormat: ResponseFormat = 'default',
  customPrompt?: string
) {
  callModeStore.set(callId, { mode, responseFormat, customPrompt });
  // Clean up after 1 hour
  setTimeout(() => callModeStore.delete(callId), 60 * 60 * 1000);
}

export function getCallModeData(callId: string): CallModeData {
  return callModeStore.get(callId) || { mode: DEFAULT_MODE, responseFormat: 'default' };
}

// Legacy function for compatibility
export function getCallMode(callId: string): ConversationMode {
  return getCallModeData(callId).mode;
}

// URL pattern for detection
const URL_PATTERN = /https?:\/\/[^\s<>)}\]]+/g;

// Convert numerals to words for better TTS pronunciation
const NUMERAL_TO_WORD: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve',
};

function convertNumeralsToWords(text: string): string {
  // Replace standalone single/double digit numbers with words
  let result = text.replace(/\b([0-9]|1[0-2])\b/g, (match) => {
    return NUMERAL_TO_WORD[match] || match;
  });
  
  // Capitalize first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  
  // Capitalize after sentence endings (. ! ?)
  result = result.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => {
    return punct + letter.toUpperCase();
  });
  
  return result;
}

// Approval request pattern: [NEEDS_APPROVAL: {"type": "...", "description": "...", "params": {...}}]
const APPROVAL_PATTERN = /\[NEEDS_APPROVAL:\s*(\{[\s\S]*?\})\]/g;

interface ApprovalRequest {
  type: string;
  description: string;
  params?: Record<string, unknown>;
}

/**
 * Process text for approval requests, extracting them and returning cleaned text.
 * When approval requests are found, creates action plan and sends to Telegram.
 */
async function processApprovalRequests(
  text: string,
  callId: string
): Promise<{ cleanedText: string; approvalSent: boolean }> {
  const requests: ApprovalRequest[] = [];
  let match;
  
  // Reset lastIndex for global regex
  APPROVAL_PATTERN.lastIndex = 0;
  
  while ((match = APPROVAL_PATTERN.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      requests.push(parsed);
      console.log(`[Approval] Found request:`, parsed);
    } catch (e) {
      console.error(`[Approval] Failed to parse:`, match[1]);
    }
  }
  
  if (requests.length === 0) {
    return { cleanedText: text, approvalSent: false };
  }
  
  // Remove all approval markers from text
  let cleanedText = text.replace(APPROVAL_PATTERN, '').trim();
  
  // Create action plan
  const actions: Action[] = requests.map(req => ({
    id: generateActionId(),
    type: req.type as any,
    description: req.description,
    privilegeLevel: getPrivilegeLevel(req.type as any),
    params: req.params || {},
    status: 'pending' as const,
  }));
  
  const plan: ActionPlan = {
    callId,
    timestamp: new Date().toISOString(),
    summary: requests.map(r => r.description).join('; '),
    actions,
    status: 'pending_approval',
  };
  
  // Save and send approval request
  savePlan(plan);
  const sent = await sendApprovalRequest(plan);
  
  if (sent) {
    console.log(`[Approval] Sent Telegram request for ${requests.length} action(s)`);
    // Append verbal confirmation if there's spoken text
    if (cleanedText && !cleanedText.toLowerCase().includes('telegram')) {
      cleanedText += " I've sent you a Telegram message to approve that.";
    }
  } else {
    console.error(`[Approval] Failed to send Telegram request`);
  }
  
  return { cleanedText, approvalSent: sent };
}

/**
 * Strip URLs, approval markers, and card markers from text for speech.
 * Returns { spokenText, urls[], approvalRequests[] }
 */
function processTextForSpeech(text: string): { 
  spokenText: string; 
  urls: string[]; 
  approvalRequests: ApprovalRequest[];
} {
  const urls: string[] = [];
  const approvalRequests: ApprovalRequest[] = [];
  
  // First, strip card markers (they're for visual display only)
  let processedText = stripCards(text);
  
  // Extract approval requests
  APPROVAL_PATTERN.lastIndex = 0;
  let match;
  while ((match = APPROVAL_PATTERN.exec(processedText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      approvalRequests.push(parsed);
    } catch (e) {
      console.error(`[Approval] Failed to parse:`, match[1]);
    }
  }
  processedText = processedText.replace(APPROVAL_PATTERN, '');
  
  // Then extract URLs
  let spokenText = processedText.replace(URL_PATTERN, (url) => {
    urls.push(url);
    return ""; // Remove URL from spoken text entirely
  });
  
  // Convert numerals to words for better TTS pronunciation
  spokenText = convertNumeralsToWords(spokenText.trim());
  
  return { spokenText, urls, approvalRequests };
}

/**
 * Custom LLM endpoint for Vapi.
 * 
 * Vapi sends OpenAI-compatible chat completion requests here.
 * We extract the user message, send it to ChiefVoice Gateway,
 * and stream back the response in OpenAI SSE format.
 */

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string | null;
  name?: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  // Vapi metadata (when metadataSendMode is "variable")
  metadata?: {
    call?: {
      id: string;
      phoneNumberId?: string;
    };
  };
  call?: {
    id: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatCompletionRequest = await request.json();
    
    console.log("[Vapi LLM] Received request:", {
      model: body.model,
      messageCount: body.messages?.length,
      stream: body.stream,
      callId: body.call?.id || body.metadata?.call?.id,
    });

    // Extract the latest user message
    const userMessage = extractLatestUserMessage(body.messages);
    if (!userMessage) {
      return createErrorResponse("No user message found", 400);
    }

    // Determine session key from call ID or use default
    const callId = body.call?.id || body.metadata?.call?.id || "default";
    
    // Check for voice command (mode switching)
    const commandResult = detectModeCommand(userMessage);
    if (commandResult.isCommand && commandResult.mode) {
      console.log(`[Vapi LLM] Voice command detected: switching to ${commandResult.mode} mode`);
      
      // Update the mode for this call (preserve existing response format and custom prompt)
      const currentData = getCallModeData(callId);
      setCallMode(callId, commandResult.mode, currentData.responseFormat, currentData.customPrompt);
      
      // Return immediate confirmation without routing to Gateway
      return createModeConfirmationResponse(commandResult.confirmationMessage || `Switched to ${commandResult.mode} mode.`);
    }
    
    // Route to 'voice' agent with persistent session (memory across calls)
    // Use voice agent with persistent "main" session for conversation continuity
    // Format: agent:<agentId>:<sessionName> routes to the voice agent
    const sessionKey = `agent:voice:main`;

    // Get the conversation mode data for this call
    const modeData = getCallModeData(callId);
    const modePrompt = getFullModePrompt(modeData.mode, modeData.customPrompt, modeData.responseFormat);

    console.log(`[Vapi LLM] Routing to ChiefVoice voice agent - Session: ${sessionKey}, Mode: ${modeData.mode}, Format: ${modeData.responseFormat}, Message: ${userMessage.slice(0, 100)}...`);

    // Prepend voice context instruction for sensitive actions
    const voiceContext = `[VOICE_CALL] For privileged actions (sending emails, messages, running commands), include an approval marker in your response:
[NEEDS_APPROVAL: {"type": "send_email|send_message|run_command", "description": "brief description", "params": {...}}]
This marker will be stripped from speech and sent to Telegram for approval. Keep verbal response conversational.

Mode: ${modeData.mode} - ${modePrompt}

User says: `;
    const messageWithContext = voiceContext + userMessage;

    // Use smart streaming with timeout-based filler message
    return smartStreamResponse(sessionKey, messageWithContext);
  } catch (error) {
    console.error("[Vapi LLM] Error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}

/**
 * Create an immediate response for mode switching commands.
 * Returns a streaming response with the confirmation message.
 */
function createModeConfirmationResponse(message: string): Response {
  const encoder = new TextEncoder();
  const responseId = `chatcmpl-${Date.now()}`;

  const stream = new ReadableStream({
    start(controller) {
      // Send the confirmation message
      const chunk = createStreamChunk(responseId, message);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      
      // Send final chunk
      const finalChunk = createStreamChunk(responseId, "", "stop");
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function extractLatestUserMessage(messages: OpenAIMessage[]): string | null {
  if (!messages || messages.length === 0) return null;

  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user" && msg.content) {
      return msg.content;
    }
  }

  return null;
}

async function streamResponse(sessionKey: string, message: string): Promise<Response> {
  const encoder = new TextEncoder();
  const responseId = `chatcmpl-${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream deltas from ChiefVoice (basic streaming without keep-alive)
        let chunkCount = 0;
        let previousText = "";
        for await (const event of streamChatMessage(sessionKey, message, "low")) {
          if (event.type === "delta" && event.text) {
            chunkCount++;
            // Gateway sends cumulative text, so we need to extract only the new part
            const newText = event.text.startsWith(previousText)
              ? event.text.slice(previousText.length)
              : event.text;

            if (newText) {
              console.log(`[Vapi LLM] Chunk ${chunkCount}: ${newText.substring(0, 50)}${newText.length > 50 ? '...' : ''}`);
              const chunk = createStreamChunk(responseId, newText);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }

            previousText = event.text;
          } else if (event.type === "error") {
            console.error("[Vapi LLM] Stream error:", event.text);
            // Send error as final message
            const errorChunk = createStreamChunk(responseId, `Error: ${event.text}`, "stop");
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
          }
        }
        console.log(`[Vapi LLM] Stream complete. Total chunks: ${chunkCount}`);

        // Send final chunk with stop reason
        const finalChunk = createStreamChunk(responseId, "", "stop");
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("[Vapi LLM] Stream error:", error);
        const errorMsg = error instanceof Error ? error.message : "Stream failed";
        const errorChunk = createStreamChunk(responseId, `Error: ${errorMsg}`, "stop");
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// TODO: Use Sonnet for faster voice responses once Gateway supports model override
// For now, model is controlled by Gateway's default or session settings
// const VOICE_MODEL = "anthropic/claude-sonnet-4-20250514";

/**
 * Smart streaming with periodic keep-alive for long-running tasks.
 * Sends filler messages at increasing intervals to prevent VAPI timeout.
 */
async function smartStreamResponse(sessionKey: string, message: string): Promise<Response> {
  const encoder = new TextEncoder();
  const responseId = `chatcmpl-${Date.now()}`;
  
  // Timing constants - balanced keep-alive (not too aggressive, not too slow)
  const INITIAL_FILLER_MS = 2500;      // First filler after 2.5s (gives Gateway time to respond)
  const KEEPALIVE_INTERVAL_MS = 4000;  // Then every 4s to keep connection alive

  // Rotating filler phrases to sound natural
  const FILLER_PHRASES = [
    "One moment... ",
    "Let me think... ",
    "Hmm... ",
    "Working on that... ",
    "Let me check... ",
    "Give me a sec... ",
    "Okay... ",
  ];

  const stream = new ReadableStream({
    async start(controller) {
      let fillerCount = 0;
      let firstChunkReceived = false;
      let initialTimeoutId: NodeJS.Timeout | null = null;
      let keepaliveIntervalId: NodeJS.Timeout | null = null;
      let controllerClosed = false;
      let lastActivityTime = Date.now();

      const safeEnqueue = (data: Uint8Array) => {
        if (!controllerClosed) {
          try {
            controller.enqueue(data);
            lastActivityTime = Date.now();
          } catch (e) {
            console.log("[Vapi LLM] Enqueue failed - controller closed");
          }
        }
      };

      const safeClose = () => {
        if (!controllerClosed) {
          controllerClosed = true;
          try {
            controller.close();
          } catch (e) {
            console.log("[Vapi LLM] Close failed - already closed");
          }
        }
      };

      const clearTimers = () => {
        if (initialTimeoutId) clearTimeout(initialTimeoutId);
        if (keepaliveIntervalId) clearInterval(keepaliveIntervalId);
        initialTimeoutId = null;
        keepaliveIntervalId = null;
      };

      const sendFiller = () => {
        if (controllerClosed) return;
        
        const phrase = FILLER_PHRASES[fillerCount % FILLER_PHRASES.length];
        fillerCount++;
        
        console.log(`[Vapi LLM] Sending keep-alive filler #${fillerCount}: "${phrase.trim()}"`);
        activityStream.emit({ type: "processing", message: phrase.trim() });
        
        const fillerChunk = createStreamChunk(responseId, phrase);
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(fillerChunk)}\n\n`));
      };

      try {
        // Emit initial thinking activity
        activityStream.emit({ type: "thinking", message: "Thinking..." });

        // Set initial timeout for first filler
        initialTimeoutId = setTimeout(() => {
          if (!firstChunkReceived && !controllerClosed) {
            sendFiller();
            
            // Start periodic keep-alive interval
            keepaliveIntervalId = setInterval(() => {
              if (!firstChunkReceived && !controllerClosed) {
                sendFiller();
              } else {
                // Got response, stop the interval
                if (keepaliveIntervalId) clearInterval(keepaliveIntervalId);
              }
            }, KEEPALIVE_INTERVAL_MS);
          }
        }, INITIAL_FILLER_MS);

        // Stream deltas from ChiefVoice
        let chunkCount = 0;
        let previousText = "";
        let previousSpokenText = "";
        const collectedUrls: string[] = [];
        const collectedApprovals: ApprovalRequest[] = [];
        
        // Extract call ID from session key (format: "voice:xxx")
        const callId = sessionKey.replace('voice:', '') || `call_${Date.now()}`;
        
        for await (const event of streamChatMessage(sessionKey, message, "low")) {
          if (event.type === "delta" && event.text) {
            // Clear timers on first real chunk
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              clearTimers();
            }

            chunkCount++;
            // Gateway sends cumulative text, so we need to extract only the new part
            const newText = event.text.startsWith(previousText)
              ? event.text.slice(previousText.length)
              : event.text;

            if (newText) {
              // Process the cumulative text for URLs and approval requests
              const { spokenText: fullSpokenText, urls, approvalRequests } = processTextForSpeech(event.text);
              
              // Collect any new URLs
              urls.forEach(url => {
                if (!collectedUrls.includes(url)) {
                  collectedUrls.push(url);
                  console.log(`[Vapi LLM] Collected URL: ${url}`);
                }
              });
              
              // Collect approval requests (check by description to avoid dupes)
              approvalRequests.forEach(req => {
                if (!collectedApprovals.some(a => a.description === req.description)) {
                  collectedApprovals.push(req);
                  console.log(`[Vapi LLM] Collected approval request: ${req.type} - ${req.description}`);
                }
              });
              
              // Get just the new spoken text delta
              const spokenDelta = fullSpokenText.startsWith(previousSpokenText)
                ? fullSpokenText.slice(previousSpokenText.length)
                : fullSpokenText;
              
              if (spokenDelta) {
                console.log(`[Vapi LLM] Chunk ${chunkCount}: ${spokenDelta.substring(0, 50)}${spokenDelta.length > 50 ? '...' : ''}`);
                
                // Parse for activity indicators in the response
                parseActivityFromText(spokenDelta);
                
                const chunk = createStreamChunk(responseId, spokenDelta);
                safeEnqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }

              previousSpokenText = fullSpokenText;
            }

            previousText = event.text;
          } else if (event.type === "error") {
            console.error("[Vapi LLM] Stream error:", event.text);
            clearTimers();
            // Send error as final message
            const errorChunk = createStreamChunk(responseId, `Error: ${event.text}`, "stop");
            safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
          }
        }

        clearTimers();
        console.log(`[Vapi LLM] Stream complete. Fillers: ${fillerCount}, Chunks: ${chunkCount}, URLs: ${collectedUrls.length}, Approvals: ${collectedApprovals.length}`);
        
        // Emit collected URLs via activity stream for display in UI
        if (collectedUrls.length > 0) {
          activityStream.emit({ type: "links", message: collectedUrls.join("\n") });
        }
        
        // Process approval requests - send to Telegram
        if (collectedApprovals.length > 0) {
          const actions: Action[] = collectedApprovals.map(req => ({
            id: generateActionId(),
            type: req.type as any,
            description: req.description,
            privilegeLevel: getPrivilegeLevel(req.type as any),
            params: req.params || {},
            status: 'pending' as const,
          }));
          
          const plan: ActionPlan = {
            callId,
            timestamp: new Date().toISOString(),
            summary: collectedApprovals.map(r => r.description).join('; '),
            actions,
            status: 'pending_approval',
          };
          
          savePlan(plan);
          const sent = await sendApprovalRequest(plan);
          
          if (sent) {
            console.log(`[Vapi LLM] Approval request sent to Telegram for ${collectedApprovals.length} action(s)`);
            // Emit activity for UI
            activityStream.emit({ type: "approval", message: `Awaiting approval for ${collectedApprovals.length} action(s)` });
            // Speak confirmation
            const confirmChunk = createStreamChunk(responseId, " I've sent you a Telegram message to approve that.");
            safeEnqueue(encoder.encode(`data: ${JSON.stringify(confirmChunk)}\n\n`));
          } else {
            console.error(`[Vapi LLM] Failed to send Telegram approval`);
          }
        }

        // Clear activity stream
        activityStream.clear();

        // Send final chunk with stop reason
        const finalChunk = createStreamChunk(responseId, "", "stop");
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        safeEnqueue(encoder.encode("data: [DONE]\n\n"));
        safeClose();
      } catch (error) {
        console.error("[Vapi LLM] Stream error:", error);
        clearTimers();
        const errorMsg = error instanceof Error ? error.message : "Stream failed";
        const errorChunk = createStreamChunk(responseId, `Error: ${errorMsg}`, "stop");
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        safeEnqueue(encoder.encode("data: [DONE]\n\n"));
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function createStreamChunk(id: string, content: string, finishReason?: string) {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "chiefvoice",
    choices: [
      {
        index: 0,
        delta: content ? { content } : {},
        finish_reason: finishReason || null,
      },
    ],
  };
}

async function nonStreamResponse(sessionKey: string, message: string): Promise<Response> {
  // Collect full response
  let fullText = "";
  
  for await (const event of streamChatMessage(sessionKey, message, "low")) {
    if (event.type === "delta") {
      fullText += event.text;
    } else if (event.type === "error") {
      return createErrorResponse(event.text, 500);
    }
  }

  const response = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "chiefvoice",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: fullText,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };

  return Response.json(response);
}

function createErrorResponse(message: string, status: number): Response {
  return Response.json(
    {
      error: {
        message,
        type: "invalid_request_error",
        code: status === 400 ? "invalid_request" : "internal_error",
      },
    },
    { status }
  );
}
