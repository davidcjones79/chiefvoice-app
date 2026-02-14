import { NextRequest } from "next/server";
import { streamChatMessage } from "@/lib/gateway/server-client";
import { activityStream, parseActivityFromText } from "@/lib/activity-stream";
import { savePlan, sendApprovalRequest } from "@/lib/actions";
import { ActionPlan, Action, generateActionId, getPrivilegeLevel } from "@/lib/actions/types";
import { 
  type ConversationMode, 
  type ResponseFormat, 
  getFullModePrompt,
  detectModeCommand 
} from "@/lib/modes";

// Brave Search API
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

async function performWebSearch(query: string, count: number = 5): Promise<SearchResult[]> {
  if (!BRAVE_API_KEY) {
    console.error("[Search] Brave API key not configured");
    return [];
  }

  try {
    const searchParams = new URLSearchParams({
      q: query,
      count: String(Math.min(count, 10)),
      text_decorations: "false",
      search_lang: "en",
    });

    const response = await fetch(`${BRAVE_SEARCH_URL}?${searchParams}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    });

    if (!response.ok) {
      console.error("[Search] Brave search failed:", response.status);
      return [];
    }

    const data = await response.json();
    return (data.web?.results || []).map(
      (result: { title: string; url: string; description: string }) => ({
        title: result.title,
        url: result.url,
        description: result.description,
      })
    );
  } catch (error) {
    console.error("[Search] Error:", error);
    return [];
  }
}

// Approval request pattern
const APPROVAL_PATTERN = /\[NEEDS_APPROVAL:\s*(\{[\s\S]*?\})\]/g;

interface ApprovalRequest {
  type: string;
  description: string;
  params?: Record<string, unknown>;
}

interface TextChatRequest {
  message: string;
  callId?: string;
  mode?: ConversationMode;
  responseFormat?: ResponseFormat;
  customPrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TextChatRequest = await request.json();
    
    console.log("[Text Chat] Received request:", {
      messageLength: body.message?.length,
      mode: body.mode,
      responseFormat: body.responseFormat,
      callId: body.callId,
    });

    if (!body.message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Determine session key from call ID or create new one
    const callId = body.callId || `text_${Date.now()}`;
    // Scope session key by tenant_id (from middleware headers)
    const tenantId = request.headers.get("x-tenant-id") || "default";
    const sessionKey = `agent:voice:${tenantId}:main`;
    const mode = body.mode || 'casual';
    const responseFormat = body.responseFormat || 'default';
    const customPrompt = body.customPrompt;

    // Check for mode command in text
    const commandResult = detectModeCommand(body.message);
    if (commandResult.isCommand && commandResult.mode) {
      console.log(`[Text Chat] Mode command detected: switching to ${commandResult.mode}`);
      // Return mode switch confirmation as a simple stream response
      return createModeConfirmationStream(commandResult.confirmationMessage || `Switched to ${commandResult.mode} mode.`);
    }

    // Get mode-specific system prompt with response format
    const systemPrompt = getFullModePrompt(mode, customPrompt, responseFormat);
    
    // If in search mode, perform web search first
    let searchContext = "";
    if (mode === 'search') {
      console.log(`[Text Chat] Search mode - performing web search for: ${body.message}`);
      activityStream.emit({ type: "thinking", message: "Searching the web..." });
      
      const searchResults = await performWebSearch(body.message, 5);
      
      if (searchResults.length > 0) {
        searchContext = `\n\n[WEB SEARCH RESULTS for "${body.message}"]\n`;
        searchResults.forEach((result, i) => {
          searchContext += `\n${i + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.description}\n`;
        });
        searchContext += `\n[END SEARCH RESULTS]\n\nUse these search results to answer the user's question. Cite sources when referencing specific information.\n\n`;
        console.log(`[Text Chat] Found ${searchResults.length} search results`);
      } else {
        searchContext = "\n\n[WEB SEARCH: No results found. Answer based on your knowledge but note that you couldn't find current web information.]\n\n";
        console.log(`[Text Chat] No search results found`);
      }
    }
    
    // Construct message with mode context for text input
    const textContext = `[TEXT_INPUT] User sent a text message. For privileged actions (sending emails, messages, running commands), include an approval marker in your response:
[NEEDS_APPROVAL: {"type": "send_email|send_message|run_command", "description": "brief description", "params": {...}}]
This marker will be processed and sent to Telegram for approval.

Mode: ${mode} - ${systemPrompt}${searchContext}

User message: `;
    const messageWithContext = textContext + body.message;

    console.log(`[Text Chat] Routing to voice agent - Session: ${sessionKey}, Mode: ${mode}, Format: ${responseFormat}, Message: ${body.message.slice(0, 100)}...`);

    // Stream response
    return streamTextResponse(sessionKey, messageWithContext, callId, mode);
  } catch (error) {
    console.error("[Text Chat] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create a simple streaming response for mode confirmation.
 */
function createModeConfirmationStream(message: string): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const chunk = {
        type: 'delta',
        content: message,
        timestamp: Date.now()
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      
      const finalChunk = {
        type: 'complete',
        content: '',
        fullResponse: message,
        timestamp: Date.now()
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

async function streamTextResponse(
  sessionKey: string, 
  message: string, 
  callId: string, 
  mode: string
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let chunkCount = 0;
        let previousText = "";
        let fullResponse = "";
        const collectedUrls: string[] = [];
        const collectedApprovals: ApprovalRequest[] = [];

        // Emit initial thinking activity
        activityStream.emit({ type: "thinking", message: "Thinking..." });

        for await (const event of streamChatMessage(sessionKey, message, undefined)) {
          if (event.type === "delta" && event.text) {
            chunkCount++;

            // Gateway may send cumulative or delta text - handle both
            let newText: string;
            if (event.text.startsWith(previousText)) {
              // Cumulative text from gateway - extract just the new part
              newText = event.text.slice(previousText.length);
              fullResponse = event.text;
            } else {
              // Delta text - accumulate it ourselves
              newText = event.text;
              fullResponse += newText;
            }

            if (newText) {

              // Extract URLs from the accumulated response
              const urlPattern = /https?:\/\/[^\s<>)}\]]+/g;
              const urls = Array.from(fullResponse.matchAll(urlPattern), m => m[0]);

              urls.forEach(url => {
                if (!collectedUrls.includes(url)) {
                  collectedUrls.push(url);
                  console.log(`[Text Chat] Collected URL: ${url}`);
                }
              });

              // Extract approval requests from accumulated response
              APPROVAL_PATTERN.lastIndex = 0;
              let match;
              while ((match = APPROVAL_PATTERN.exec(fullResponse)) !== null) {
                try {
                  const parsed = JSON.parse(match[1]);
                  if (!collectedApprovals.some(a => a.description === parsed.description)) {
                    collectedApprovals.push(parsed);
                    console.log(`[Text Chat] Collected approval request: ${parsed.type} - ${parsed.description}`);
                  }
                } catch (e) {
                  console.error(`[Text Chat] Failed to parse approval:`, match[1]);
                }
              }
              
              // Parse for activity indicators
              parseActivityFromText(newText);

              console.log(`[Text Chat] Chunk ${chunkCount}: ${newText.substring(0, 50)}${newText.length > 50 ? '...' : ''}`);
              
              // Send chunk as JSON
              const chunk = {
                type: 'delta',
                content: newText,
                mode,
                timestamp: Date.now()
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }

            previousText = fullResponse;
          } else if (event.type === "error") {
            console.error("[Text Chat] Stream error:", event.text);
            const errorChunk = {
              type: 'error',
              content: `Error: ${event.text}`,
              timestamp: Date.now()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
          }
        }

        console.log(`[Text Chat] Stream complete. Chunks: ${chunkCount}, URLs: ${collectedUrls.length}, Approvals: ${collectedApprovals.length}`);
        
        // Emit collected URLs via activity stream
        if (collectedUrls.length > 0) {
          activityStream.emit({ type: "links", message: collectedUrls.join("\n") });
        }
        
        // Process approval requests
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
            console.log(`[Text Chat] Approval request sent to Telegram for ${collectedApprovals.length} action(s)`);
            activityStream.emit({ type: "approval", message: `Awaiting approval for ${collectedApprovals.length} action(s)` });
            
            // Send approval notification
            const approvalChunk = {
              type: 'approval',
              content: ' I\'ve sent you a Telegram message to approve that.',
              timestamp: Date.now()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(approvalChunk)}\n\n`));
          }
        }

        // Clear activity stream
        activityStream.clear();

        // Debug: log fullResponse before sending
        console.log(`[Text Chat] Full response before processing (${fullResponse.length} chars):`, fullResponse.substring(0, 500));

        // Remove approval patterns (but don't strip other content)
        const cleanedResponse = fullResponse.replace(APPROVAL_PATTERN, '').trim();
        console.log(`[Text Chat] Cleaned response (${cleanedResponse.length} chars):`, cleanedResponse.substring(0, 500));

        // Send completion signal
        const finalChunk = {
          type: 'complete',
          content: '',
          fullResponse: cleanedResponse,
          timestamp: Date.now()
        };
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("[Text Chat] Stream error:", error);
        const errorMsg = error instanceof Error ? error.message : "Stream failed";
        const errorChunk = {
          type: 'error',
          content: `Error: ${errorMsg}`,
          timestamp: Date.now()
        };
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