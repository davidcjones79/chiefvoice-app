import {
  type GatewayRequest,
  type GatewayResponse,
  type GatewayFrame,
  type ChatSendParams,
  type ChatSendResult,
  type ChatHistoryParams,
  type ChatHistoryResult,
  type ChatEvent,
  isGatewayEvent,
  isGatewayResponse,
} from "./protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface GatewayClientOptions {
  url: string;
  token?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onChatEvent?: (event: ChatEvent) => void;
}

export class ChiefVoiceGateway {
  private ws: WebSocket | null = null;
  private options: GatewayClientOptions;
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(options: GatewayClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.options.onStatusChange?.("connecting");
      
      try {
        const url = new URL(this.options.url);
        if (this.options.token) {
          url.searchParams.set("token", this.options.token);
        }
        
        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.options.onStatusChange?.("connected");
          resolve();
        };

        this.ws.onclose = () => {
          this.options.onStatusChange?.("disconnected");
          this.handleReconnect();
        };

        this.ws.onerror = (event) => {
          console.error("WebSocket error:", event);
          this.options.onStatusChange?.("error");
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.options.onStatusChange?.("error");
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.clear();
  }

  private handleMessage(data: string): void {
    try {
      const frame: GatewayFrame = JSON.parse(data);

      if (isGatewayResponse(frame)) {
        const pending = this.pendingRequests.get(frame.id);
        if (pending) {
          this.pendingRequests.delete(frame.id);
          if (frame.ok) {
            pending.resolve(frame.result);
          } else {
            pending.reject(new Error(frame.error?.message || "Unknown error"));
          }
        }
      } else if (isGatewayEvent(frame)) {
        if (frame.event === "chat") {
          this.options.onChatEvent?.(frame.payload as ChatEvent);
        }
      }
    } catch (error) {
      console.error("Failed to parse gateway message:", error);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      console.log(`Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect().catch(console.error);
    }, delay);
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to gateway");
    }

    const id = `req-${++this.requestId}`;
    const request: GatewayRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  async chatSend(params: ChatSendParams): Promise<ChatSendResult> {
    return this.request<ChatSendResult>("chat.send", params as unknown as Record<string, unknown>);
  }

  async chatHistory(params: ChatHistoryParams): Promise<ChatHistoryResult> {
    return this.request<ChatHistoryResult>("chat.history", params as unknown as Record<string, unknown>);
  }

  async ping(): Promise<{ pong: boolean }> {
    return this.request<{ pong: boolean }>("ping");
  }
}

// Singleton for the app
let gatewayInstance: ChiefVoiceGateway | null = null;

export function getGateway(): ChiefVoiceGateway | null {
  return gatewayInstance;
}

export function initGateway(options: GatewayClientOptions): ChiefVoiceGateway {
  if (gatewayInstance) {
    gatewayInstance.disconnect();
  }
  gatewayInstance = new ChiefVoiceGateway(options);
  return gatewayInstance;
}
