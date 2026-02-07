import Vapi from "@vapi-ai/web";
import type { VoiceProvider, VoiceConfig, VoiceProviderCallbacks, CallStatus } from "./types";

export class VapiProvider implements VoiceProvider {
  readonly name = "vapi";
  private vapi: Vapi | null = null;
  private callbacks: VoiceProviderCallbacks | null = null;
  private muted = false;
  private lastTranscript: { role: string; text: string } | null = null;

  async connect(config: VoiceConfig, callbacks: VoiceProviderCallbacks): Promise<void> {
    console.log("[VapiProvider] connect() called");
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    console.log("[VapiProvider] Public key exists:", !!publicKey);
    if (!publicKey) {
      throw new Error("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not configured");
    }

    this.callbacks = callbacks;
    this.vapi = new Vapi(publicKey);
    this.lastTranscript = null;  // Reset dedup state for new call

    this.setupEventListeners();

    callbacks.onStatusChange("connecting");

    try {
      // Fetch assistant config from our API
      console.log("[VapiProvider] Fetching assistant config...");
      const configRes = await fetch("/api/vapi/config");
      if (!configRes.ok) {
        throw new Error("Failed to fetch Vapi assistant config");
      }
      const assistantConfig = await configRes.json();
      console.log("[VapiProvider] Got config:", JSON.stringify(assistantConfig));
      
      // If we have an assistantId, use that directly; otherwise use full config
      if (assistantConfig.assistantId) {
        console.log("[VapiProvider] Starting with assistant ID:", assistantConfig.assistantId);
        await this.vapi.start(assistantConfig.assistantId);
      } else {
        console.log("[VapiProvider] Starting with inline config");
        await this.vapi.start(assistantConfig);
      }
      console.log("[VapiProvider] Vapi.start() completed");
    } catch (error) {
      console.error("[VapiProvider] Error:", error);
      callbacks.onStatusChange("idle");
      throw error;
    }
  }

  disconnect(): void {
    if (this.vapi) {
      this.vapi.stop();
      this.vapi = null;
    }
    this.callbacks?.onStatusChange("ended");
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    console.log(`[Vapi] setMuted called: ${muted}`);
    this.muted = muted;
    if (this.vapi) {
      this.vapi.setMuted(muted);
      console.log(`[Vapi] Mute state set to: ${muted}`);
    } else {
      console.log("[Vapi] Warning: vapi instance not available for setMuted");
    }
  }

  stopSpeech(): void {
    console.log("[Vapi] stopSpeech called - interrupting assistant");
    if (this.vapi) {
      // Send a control message to stop the current assistant speech
      // This uses Vapi's say method with forceStop or sends an interrupt signal
      try {
        // The say method with empty text can interrupt current speech
        // Alternatively, unmuting the mic should trigger barge-in on the Vapi server
        this.vapi.send({
          type: "add-message",
          message: {
            role: "system",
            content: "[user interrupted]"
          }
        });
        console.log("[Vapi] Interrupt signal sent");
      } catch (error) {
        console.log("[Vapi] Interrupt method not available, relying on mic unmute for barge-in");
      }
    }
  }

  private setupEventListeners(): void {
    if (!this.vapi || !this.callbacks) return;

    const vapi = this.vapi;
    const callbacks = this.callbacks;

    vapi.on("call-start", () => {
      callbacks.onStatusChange("connected");
    });

    vapi.on("call-end", () => {
      callbacks.onStatusChange("ended");
    });

    vapi.on("speech-start", () => {
      callbacks.onStatusChange("speaking");
    });

    vapi.on("speech-end", () => {
      callbacks.onStatusChange("listening");
    });

    vapi.on("volume-level", (level: number) => {
      callbacks.onVolumeLevel?.(level);
    });

    vapi.on("message", (message: VapiMessage) => {
      if (message.type === "transcript" && message.transcript) {
        const role = (message.role as "user" | "assistant") || "user";
        const text = message.transcript.trim();
        const isFinal = message.transcriptType === "final";
        
        // Skip empty transcripts
        if (!text) return;
        
        // For finals, dedupe against last final of same role
        if (isFinal) {
          if (this.lastTranscript?.role === role) {
            // Exact match - skip
            if (this.lastTranscript.text === text) {
              console.log("[Vapi] Skipping duplicate transcript:", text.slice(0, 30));
              return;
            }
            // New text is substring of old (or vice versa) - likely duplicate
            if (this.lastTranscript.text.includes(text) || text.includes(this.lastTranscript.text)) {
              // Keep the longer one
              if (text.length <= this.lastTranscript.text.length) {
                console.log("[Vapi] Skipping shorter duplicate:", text.slice(0, 30));
                return;
              }
            }
          }
          this.lastTranscript = { role, text };
          
          // When user finishes speaking, show "thinking" indicator
          // until the assistant starts speaking
          if (role === "user") {
            callbacks.onStatusChange("thinking");
          }
        }
        
        callbacks.onTranscript({
          role,
          text,
          timestamp: Date.now(),
          isFinal,
        });
      }
    });

    vapi.on("error", (error: Error) => {
      callbacks.onError(error);
      callbacks.onStatusChange("idle");
    });
  }
}

interface VapiMessage {
  type: string;
  role?: string;
  transcript?: string;
  transcriptType?: "partial" | "final";
}

// Singleton instance
let instance: VapiProvider | null = null;

export function getVapiProvider(): VapiProvider {
  if (!instance) {
    instance = new VapiProvider();
  }
  return instance;
}
