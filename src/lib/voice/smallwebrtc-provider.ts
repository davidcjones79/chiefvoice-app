import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import type {
  VoiceProvider,
  VoiceConfig,
  VoiceProviderCallbacks,
} from "./types";

export class SmallWebRTCProvider implements VoiceProvider {
  readonly name = "smallwebrtc";
  private client: PipecatClient | null = null;
  private callbacks: VoiceProviderCallbacks | null = null;
  private muted = true;
  private callId: string | null = null;
  private isConnecting = false;
  private accumulatedBotText = "";
  private botSpeakingTimestamp = 0;
  private isBotSpeaking = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private intentionalDisconnect = false;
  private signalingUrl: string | null = null;

  async connect(config: VoiceConfig, callbacks: VoiceProviderCallbacks): Promise<void> {
    console.log("[SmallWebRTCProvider] connect() called");

    if (this.isConnecting) {
      console.log("[SmallWebRTCProvider] Already connecting, ignoring duplicate call");
      return;
    }

    this.isConnecting = true;
    this.callbacks = callbacks;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;

    try {
      callbacks.onStatusChange("connecting");

      this.callId = `webrtc-${Date.now()}`;
      console.log("[SmallWebRTCProvider] Call ID:", this.callId);

      const selectedVoice = typeof window !== "undefined"
        ? localStorage.getItem("chief-voice") || "shimmer"
        : "shimmer";
      const ttsProvider = typeof window !== "undefined"
        ? localStorage.getItem("chief-tts-provider") || "openai"
        : "openai";

      // Start the bot and get signaling URL
      const response = await fetch("/api/pipecat/webrtc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: this.callId,
          config,
          voice: selectedVoice,
          ttsProvider,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start WebRTC bot: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      this.signalingUrl = data.signaling_url;
      console.log("[SmallWebRTCProvider] Signaling URL:", this.signalingUrl);

      // Create SmallWebRTC transport — handles audio natively (no manual audio elements)
      const transport = new SmallWebRTCTransport();

      this.client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            console.log("[SmallWebRTCProvider] Connected");
            callbacks.onStatusChange("connected");
          },
          onDisconnected: () => {
            console.log("[SmallWebRTCProvider] Disconnected, intentional:", this.intentionalDisconnect);
            if (!this.intentionalDisconnect && this.signalingUrl && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = 1000 * this.reconnectAttempts;
              console.log(`[SmallWebRTCProvider] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
              callbacks.onStatusChange("connecting");
              setTimeout(async () => {
                try {
                  if (this.client && this.signalingUrl) {
                    await this.client.connect({ url: this.signalingUrl });
                    this.reconnectAttempts = 0;
                    console.log("[SmallWebRTCProvider] Reconnected successfully");
                  }
                } catch (e) {
                  console.error("[SmallWebRTCProvider] Reconnect failed:", e);
                  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error("[SmallWebRTCProvider] Max reconnect attempts reached");
                    callbacks.onStatusChange("ended");
                  }
                }
              }, delay);
            } else {
              callbacks.onStatusChange("ended");
            }
          },
          onBotReady: () => {
            console.log("[SmallWebRTCProvider] Bot ready");
            this.reconnectAttempts = 0;
            callbacks.onStatusChange("listening");
          },
          onBotStartedSpeaking: () => {
            console.log("[SmallWebRTCProvider] Bot started speaking");
            this.isBotSpeaking = true;
            this.accumulatedBotText = "";
            this.botSpeakingTimestamp = Date.now();
            callbacks.onStatusChange("speaking");
          },
          onBotStoppedSpeaking: () => {
            console.log("[SmallWebRTCProvider] Bot stopped speaking");
            this.isBotSpeaking = false;
            if (this.accumulatedBotText) {
              callbacks.onTranscript({
                role: "assistant",
                text: this.accumulatedBotText,
                timestamp: this.botSpeakingTimestamp,
                isFinal: true,
              });
              this.accumulatedBotText = "";
            }
            callbacks.onStatusChange("listening");
          },
          onUserStartedSpeaking: () => {
            console.log("[SmallWebRTCProvider] User started speaking");
            if (this.isBotSpeaking && this.client) {
              console.log("[SmallWebRTCProvider] Interrupting bot speech (barge-in)");
              this.client.sendClientMessage("user-started-speaking", {});
            }
            callbacks.onStatusChange("listening");
          },
          onUserStoppedSpeaking: () => {
            console.log("[SmallWebRTCProvider] User stopped speaking");
            callbacks.onStatusChange("received");
            setTimeout(() => {
              callbacks.onStatusChange("thinking");
            }, 800);
          },
          onBotOutput: (data: { text: string }) => {
            if (data.text) {
              this.accumulatedBotText += data.text;
              callbacks.onTranscript({
                role: "assistant",
                text: this.accumulatedBotText,
                timestamp: this.botSpeakingTimestamp || Date.now(),
                isFinal: false,
              });
            }
          },
          onUserTranscript: (data: { text: string; final: boolean }) => {
            if (data.text) {
              callbacks.onTranscript({
                role: "user",
                text: data.text,
                timestamp: Date.now(),
                isFinal: data.final,
              });
            }
          },
          onError: (error: any) => {
            console.error("[SmallWebRTCProvider] Error:", error);
            callbacks.onError(new Error(error.message || "SmallWebRTC error"));
          },
        },
      });

      // Connect via SDP exchange — no Daily room, direct P2P
      console.log("[SmallWebRTCProvider] Connecting via SDP exchange...");
      await this.client.connect({ url: this.signalingUrl });
      console.log("[SmallWebRTCProvider] Connected successfully");

      // SmallWebRTC handles audio tracks automatically — no manual audio element needed

      // Check hands-free mode preference
      const isHandsFree = typeof window !== "undefined"
        ? localStorage.getItem("chief-hands-free-mode") === "true"
        : false;

      if (isHandsFree) {
        console.log("[SmallWebRTCProvider] Hands-free mode: keeping mic open");
        this.client.enableMic(true);
        this.muted = false;
      } else {
        console.log("[SmallWebRTCProvider] PTT mode: muting mic");
        this.client.enableMic(false);
        this.muted = true;
      }
      this.isConnecting = false;

    } catch (error) {
      console.error("[SmallWebRTCProvider] Connection error:", error);
      this.isConnecting = false;
      callbacks.onStatusChange("idle");
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  disconnect(): void {
    console.log("[SmallWebRTCProvider] disconnect() called");
    this.intentionalDisconnect = true;

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    // Notify backend to cleanup
    if (this.callId) {
      fetch(`/api/pipecat/webrtc/${this.callId}`, {
        method: "DELETE",
      }).catch(err => console.error("Failed to cleanup WebRTC bot:", err));
    }

    this.callbacks?.onStatusChange("ended");
    this.signalingUrl = null;
    this.callId = null;
    this.isConnecting = false;
    this.accumulatedBotText = "";
    this.botSpeakingTimestamp = 0;
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.client) {
      this.client.enableMic(!muted);
    }
  }

  stopSpeech(): void {
    if (this.client) {
      this.client.sendClientMessage("user-started-speaking", {});
      if (this.muted) {
        this.setMuted(false);
      }
    }
  }
}

// Singleton instance
let instance: SmallWebRTCProvider | null = null;

export function getSmallWebRTCProvider(): SmallWebRTCProvider {
  if (!instance) {
    instance = new SmallWebRTCProvider();
  }
  return instance;
}
