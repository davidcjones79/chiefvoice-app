// ChiefVoice Gateway WebSocket Protocol Types

export interface GatewayRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface GatewayEvent {
  event: string;
  payload: unknown;
}

export type GatewayFrame = GatewayResponse | GatewayEvent;

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  thinking?: string;
  model?: string;  // Model override (e.g., "anthropic/claude-sonnet-4-20250514")
  idempotencyKey: string;
  attachments?: unknown[];
  timeoutMs?: number;
}

export interface ChatSendResult {
  runId: string;
}

export interface ChatHistoryParams {
  sessionKey: string;
  limit?: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: ChatContent[];
  timestamp?: string;
}

export interface ChatContent {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
}

export interface ChatHistoryResult {
  messages: ChatMessage[];
}

export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
}

export function isGatewayEvent(frame: GatewayFrame): frame is GatewayEvent {
  return "event" in frame;
}

export function isGatewayResponse(frame: GatewayFrame): frame is GatewayResponse {
  return "id" in frame && "ok" in frame;
}
