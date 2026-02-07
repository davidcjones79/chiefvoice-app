/**
 * Server-side ChiefVoice Gateway client for Node.js API routes.
 * Uses the `ws` package instead of browser WebSocket.
 * 
 * Protocol: ChiefVoice Gateway Protocol v3
 */
import WebSocket from "ws";
import type {
  GatewayRequest,
  GatewayResponse,
  ChatSendParams,
  ChatEvent,
} from "./protocol";

const GATEWAY_URL = process.env.CHIEFVOICE_GATEWAY_URL || "ws://localhost:18789";
const GATEWAY_TOKEN = process.env.CHIEFVOICE_GATEWAY_TOKEN || "";

// Debug: Log what we're loading from environment
console.log("[Gateway] Environment variables:");
console.log("  GATEWAY_URL:", GATEWAY_URL);
console.log("  GATEWAY_TOKEN:", GATEWAY_TOKEN ? `${GATEWAY_TOKEN.substring(0, 10)}...` : "(empty)");
console.log("  Token length:", GATEWAY_TOKEN.length);

const PROTOCOL_VERSION = 3;
const CONNECT_TIMEOUT_MS = 10000;

// Connection pooling for better performance
let globalConnection: WebSocket | null = null;
let isConnecting = false;
let connectionPromise: Promise<WebSocket> | null = null;

export interface ChatStreamOptions {
  sessionKey: string;
  message: string;
  thinking?: string;
  timeoutMs?: number;
  onDelta?: (text: string) => void;
  onFinal?: (fullText: string) => void;
  onError?: (error: string) => void;
}

/**
 * ChiefVoice Gateway Protocol v3 frame types
 */
interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

type GatewayFrame = RequestFrame | ResponseFrame | EventFrame | { type: "hello-ok" };

/**
 * Get an existing connection or create a new one.
 * Uses connection pooling for better performance.
 */
async function getConnection(): Promise<WebSocket> {
  // Return existing connection if it's open and ready
  if (globalConnection && globalConnection.readyState === WebSocket.OPEN) {
    console.log("[Gateway] Reusing existing connection");
    return globalConnection;
  }

  // If already connecting, wait for that connection
  if (isConnecting && connectionPromise) {
    console.log("[Gateway] Waiting for in-progress connection");
    return connectionPromise;
  }

  // Create new connection
  console.log("[Gateway] Creating new connection");
  isConnecting = true;
  connectionPromise = connectToGateway();

  try {
    const ws = await connectionPromise;
    globalConnection = ws;

    // Clear global connection on close so we reconnect next time
    ws.on("close", () => {
      console.log("[Gateway] Connection closed, will reconnect on next request");
      if (globalConnection === ws) {
        globalConnection = null;
      }
    });

    return ws;
  } finally {
    isConnecting = false;
    connectionPromise = null;
  }
}

/**
 * Connect to Gateway using protocol v3.
 * Handles challenge -> connect flow.
 */
async function connectToGateway(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL);
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        ws.close();
        reject(new Error(`Gateway connection timeout (${GATEWAY_URL})`));
      }
    }, CONNECT_TIMEOUT_MS);

    ws.on("message", (data) => {
      try {
        const frame = JSON.parse(data.toString()) as GatewayFrame;

        // Handle connect.challenge event
        if (frame.type === "event" && (frame as EventFrame).event === "connect.challenge") {
          console.log("[Gateway] Received connect.challenge, sending connect request");
          console.log("[Gateway] Using token:", GATEWAY_TOKEN ? `${GATEWAY_TOKEN.substring(0, 10)}...` : "(empty)");

          const connectReq: RequestFrame = {
            type: "req",
            id: "connect-1",
            method: "connect",
            params: {
              minProtocol: PROTOCOL_VERSION,
              maxProtocol: PROTOCOL_VERSION,
              client: {
                id: "gateway-client",
                version: "0.1.0",
                platform: process.platform,
                mode: "backend",
              },
              auth: {
                token: GATEWAY_TOKEN,
              },
            },
          };

          console.log("[Gateway] Connect request params:", JSON.stringify({
            ...(connectReq.params as Record<string, unknown>),
            auth: { token: GATEWAY_TOKEN ? `${GATEWAY_TOKEN.substring(0, 10)}...` : "(empty)" }
          }, null, 2));

          ws.send(JSON.stringify(connectReq));
        }

        // Handle connect response
        if (frame.type === "res" && (frame as ResponseFrame).id === "connect-1") {
          const res = frame as ResponseFrame;
          clearTimeout(timeout);
          if (res.ok) {
            console.log("[Gateway] Successfully authenticated and connected");
            connected = true;
            resolve(ws);
          } else {
            console.error("[Gateway] Authentication failed");
            console.error("[Gateway] Error code:", res.error?.code);
            console.error("[Gateway] Error message:", res.error?.message);
            console.error("[Gateway] Full response:", JSON.stringify(res, null, 2));
            ws.close();
            reject(new Error(`Gateway auth failed: ${res.error?.message || "unknown"}`));
          }
        }
      } catch (error) {
        console.error("Failed to parse gateway message:", error);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`Gateway connection failed: ${error.message}`));
    });

    ws.on("close", (code, reason) => {
      if (!connected) {
        clearTimeout(timeout);
        reject(new Error(`Gateway closed during connect: ${code} ${reason?.toString() || ""}`));
      }
    });
  });
}

/**
 * Send a chat message to ChiefVoice Gateway and stream the response.
 */
export async function sendChatMessage(options: ChatStreamOptions): Promise<string> {
  const { sessionKey, message, thinking, timeoutMs = 120000 } = options;

  const ws = await connectToGateway();

  return new Promise((resolve, reject) => {
    const requestId = "chat-1";
    let runId: string | null = null;
    let fullText = "";
    let resolved = false;

    const cleanup = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error("Gateway request timeout"));
      }
    }, timeoutMs);

    // Send chat.send request
    const idempotencyKey = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const chatReq: RequestFrame = {
      type: "req",
      id: requestId,
      method: "chat.send",
      params: {
        sessionKey,
        message,
        ...(thinking && { thinking }),
        idempotencyKey,
        timeoutMs,
      } satisfies ChatSendParams,
    };
    ws.send(JSON.stringify(chatReq));

    ws.on("message", (data) => {
      try {
        const frame = JSON.parse(data.toString()) as GatewayFrame;

        // Handle response to chat.send
        if (frame.type === "res") {
          const res = frame as ResponseFrame;
          if (res.id === requestId) {
            if (res.ok && res.payload) {
              runId = (res.payload as { runId: string }).runId;
            } else if (!res.ok) {
              resolved = true;
              clearTimeout(timeout);
              cleanup();
              reject(new Error(res.error?.message || "Gateway request failed"));
            }
          }
        }

        // Handle chat events
        if (frame.type === "event" && (frame as EventFrame).event === "chat") {
          const chatEvent = (frame as EventFrame).payload as ChatEvent;

          if (runId && chatEvent.runId !== runId) return;

          if (chatEvent.state === "delta" && chatEvent.message) {
            const msg = chatEvent.message as {
              content?: Array<{ type: string; text?: string }>;
            };
            if (msg.content) {
              for (const part of msg.content) {
                if (part.type === "text" && part.text) {
                  fullText += part.text;
                  options.onDelta?.(part.text);
                }
              }
            }
          } else if (chatEvent.state === "final") {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            options.onFinal?.(fullText);
            resolve(fullText);
          } else if (chatEvent.state === "aborted" || chatEvent.state === "error") {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            const errorMsg = chatEvent.errorMessage || "Chat request failed";
            options.onError?.(errorMsg);
            reject(new Error(errorMsg));
          }
        }
      } catch (error) {
        console.error("Failed to parse gateway message:", error);
      }
    });

    ws.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(error);
      }
    });

    ws.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (fullText) {
          resolve(fullText);
        } else {
          reject(new Error("Gateway connection closed unexpectedly"));
        }
      }
    });
  });
}

/**
 * Stream chat response as an async generator for SSE.
 * @param sessionKey - The session key for the chat
 * @param message - The message to send
 * @param thinking - Thinking level (low/medium/high)
 * @param model - Optional model override (e.g., "anthropic/claude-sonnet-4-20250514")
 */
export async function* streamChatMessage(
  sessionKey: string,
  message: string,
  thinking?: string,
  model?: string
): AsyncGenerator<{ type: "delta" | "done" | "error"; text: string }> {
  let ws: WebSocket;
  try {
    // Create fresh connection for each stream to avoid listener accumulation
    ws = await connectToGateway();
  } catch (error) {
    yield {
      type: "error",
      text: error instanceof Error ? error.message : "Connection failed",
    };
    return;
  }

  const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let runId: string | null = null;
  let done = false;
  let hasReceivedContent = false;

  const eventQueue: Array<{ type: "delta" | "done" | "error"; text: string }> = [];
  let resolveNext: (() => void) | null = null;

  const pushEvent = (event: { type: "delta" | "done" | "error"; text: string }) => {
    eventQueue.push(event);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  const waitForEvent = (): Promise<void> => {
    if (eventQueue.length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      resolveNext = resolve;
    });
  };

  // Send chat.send request
  const idempotencyKey = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const chatReq: RequestFrame = {
    type: "req",
    id: requestId,
    method: "chat.send",
    params: {
      sessionKey,
      message,
      ...(thinking && { thinking }),
      ...(model && { model }),  // Include model override if provided
      idempotencyKey,
      timeoutMs: 120000,
    } satisfies ChatSendParams,
  };
  ws.send(JSON.stringify(chatReq));

  ws.on("message", (data) => {
    try {
      const frame = JSON.parse(data.toString()) as GatewayFrame;
      console.log("[Gateway] Received frame:", JSON.stringify(frame).substring(0, 200));

      if (frame.type === "res") {
        const res = frame as ResponseFrame;
        if (res.id === requestId) {
          if (res.ok && res.payload) {
            runId = (res.payload as { runId: string }).runId;
            console.log("[Gateway] Got runId:", runId);
          } else if (res.ok) {
            console.log("[Gateway] Response OK but no payload field:", JSON.stringify(res));
          } else if (!res.ok) {
            done = true;
            pushEvent({ type: "error", text: res.error?.message || "Request failed" });
          }
        }
      }

      // Handle agent events with streaming assistant text (new protocol)
      if (frame.type === "event" && (frame as EventFrame).event === "agent") {
        const agentPayload = (frame as EventFrame).payload as {
          runId: string;
          stream: string;
          data?: { delta?: string; text?: string; phase?: string };
        };
        if (runId && agentPayload.runId !== runId) return;

        if (agentPayload.stream === "assistant" && agentPayload.data?.delta) {
          hasReceivedContent = true;
          pushEvent({ type: "delta", text: agentPayload.data.delta });
        }

        // Use lifecycle end as completion signal (more reliable than chat final)
        if (agentPayload.stream === "lifecycle" && agentPayload.data?.phase === "end" && hasReceivedContent) {
          done = true;
          pushEvent({ type: "done", text: "" });
        }
      }

      // Handle chat events (for error states only - use agent lifecycle for completion)
      if (frame.type === "event" && (frame as EventFrame).event === "chat") {
        const chatEvent = (frame as EventFrame).payload as ChatEvent;
        if (runId && chatEvent.runId !== runId) return;

        if (chatEvent.state === "aborted" || chatEvent.state === "error") {
          done = true;
          pushEvent({ type: "error", text: chatEvent.errorMessage || "Failed" });
        }
        // Only use chat final if we got content (fallback)
        if (chatEvent.state === "final" && hasReceivedContent) {
          done = true;
          pushEvent({ type: "done", text: "" });
        }
      }
    } catch (error) {
      console.error("Parse error:", error);
    }
  });

  ws.on("error", (error) => {
    if (!done) {
      done = true;
      pushEvent({ type: "error", text: error.message });
    }
  });

  ws.on("close", () => {
    if (!done) {
      done = true;
      pushEvent({ type: "done", text: "" });
    }
  });

  try {
    while (!done || eventQueue.length > 0) {
      await waitForEvent();
      while (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        yield event;
        if (event.type === "done" || event.type === "error") {
          return;
        }
      }
    }
  } finally {
    // Close the connection when done
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    console.log("[Gateway] Request complete, connection closed");
  }
}

/**
 * Test Gateway connectivity.
 */
export async function testGatewayConnection(): Promise<{
  connected: boolean;
  authenticated: boolean;
  error?: string;
}> {
  try {
    const ws = await connectToGateway();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ connected: true, authenticated: true, error: "Ping timeout" });
      }, 3000);

      const pingReq: RequestFrame = { type: "req", id: "ping-1", method: "health" };
      ws.send(JSON.stringify(pingReq));

      ws.on("message", (data) => {
        try {
          const frame = JSON.parse(data.toString()) as GatewayFrame;
          if (frame.type === "res" && (frame as ResponseFrame).id === "ping-1") {
            clearTimeout(timeout);
            ws.close();
            const res = frame as ResponseFrame;
            if (res.ok) {
              resolve({ connected: true, authenticated: true });
            } else {
              resolve({
                connected: true,
                authenticated: true,
                error: res.error?.message || "Ping failed",
              });
            }
          }
        } catch {
          // ignore
        }
      });
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("auth")) {
      return { connected: true, authenticated: false, error: msg };
    }
    return { connected: false, authenticated: false, error: msg };
  }
}
