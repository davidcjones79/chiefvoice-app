import { PipecatClient } from "@pipecat-ai/client-js";
import { DailyTransport } from "@pipecat-ai/daily-transport";
import type {
  VoiceProvider,
  VoiceConfig,
  VoiceProviderCallbacks,
} from "./types";

export class PipecatProvider implements VoiceProvider {
  readonly name = "pipecat";
  private client: PipecatClient | null = null;
  private callbacks: VoiceProviderCallbacks | null = null;
  private muted = true;
  private roomUrl: string | null = null;
  private callId: string | null = null;
  private isConnecting = false;
  private audioElementId: string | null = null;
  private accumulatedBotText = "";
  private botSpeakingTimestamp = 0;
  private isBotSpeaking = false;

  async connect(config: VoiceConfig, callbacks: VoiceProviderCallbacks): Promise<void> {
    console.log("[PipecatProvider] connect() called");

    if (this.isConnecting) {
      console.log("[PipecatProvider] Already connecting, ignoring duplicate call");
      return;
    }

    this.isConnecting = true;
    this.callbacks = callbacks;

    try {
      callbacks.onStatusChange("connecting");

      // Generate call ID
      this.callId = `pipecat-${Date.now()}`;
      console.log("[PipecatProvider] Call ID:", this.callId);

      // Get selected voice and TTS provider from localStorage
      const selectedVoice = typeof window !== 'undefined'
        ? localStorage.getItem("chief-voice") || "shimmer"
        : "shimmer";
      const ttsProvider = typeof window !== 'undefined'
        ? localStorage.getItem("chief-tts-provider") || "openai"
        : "openai";
      console.log("[PipecatProvider] Selected voice:", selectedVoice);
      console.log("[PipecatProvider] TTS provider:", ttsProvider);

      // Create a Daily room and start the bot
      const response = await fetch("/api/pipecat/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: this.callId,
          config: config,
          voice: selectedVoice,
          ttsProvider: ttsProvider,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create room: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      this.roomUrl = data.room_url;

      console.log("[PipecatProvider] Room created:", this.roomUrl);

      // Create Pipecat client with Daily transport
      const transport = new DailyTransport();

      this.client = new PipecatClient({
        transport,
        // Enable mic initially to request permission (enables audio playback via browser autoplay policy)
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            console.log("[PipecatProvider] Connected");
            callbacks.onStatusChange("connected");
          },
          onDisconnected: () => {
            console.log("[PipecatProvider] Disconnected");
            callbacks.onStatusChange("ended");
          },
          onBotReady: () => {
            console.log("[PipecatProvider] Bot ready");
            callbacks.onStatusChange("listening");
          },
          onBotStartedSpeaking: () => {
            console.log("[PipecatProvider] Bot started speaking");
            this.isBotSpeaking = true;
            this.accumulatedBotText = "";
            this.botSpeakingTimestamp = Date.now();
            callbacks.onStatusChange("speaking");
            
            // In hands-free mode, keep mic on for barge-in (echo cancellation handles feedback)
            // In PTT mode, mute mic while bot speaks
            const isHandsFree = typeof window !== 'undefined'
              ? localStorage.getItem("chief-hands-free-mode") === "true"
              : false;
            if (this.client && !isHandsFree) {
              this.client.enableMic(false);
              console.log("[PipecatProvider] Muted mic during bot speech (PTT mode)");
            } else {
              console.log("[PipecatProvider] Keeping mic on for barge-in (hands-free mode)");
            }
          },
          onBotStoppedSpeaking: () => {
            console.log("[PipecatProvider] Bot stopped speaking");
            this.isBotSpeaking = false;
            // Send final accumulated transcript
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

            // Unmute mic after bot finishes (only in hands-free mode AND if user hasn't manually muted)
            const isHandsFree = typeof window !== 'undefined'
              ? localStorage.getItem("chief-hands-free-mode") === "true"
              : false;
            if (this.client && isHandsFree && !this.muted) {
              this.client.enableMic(true);
              console.log("[PipecatProvider] Unmuted mic after bot speech");
            } else if (this.muted) {
              console.log("[PipecatProvider] User has manually muted, keeping mic muted");
            }
          },
          onUserStartedSpeaking: () => {
            console.log("[PipecatProvider] User started speaking");
            // Interrupt bot if it's currently speaking (barge-in)
            if (this.isBotSpeaking && this.client) {
              console.log("[PipecatProvider] Interrupting bot speech (barge-in)");
              this.client.sendClientMessage("user-started-speaking", {});
            }
            callbacks.onStatusChange("listening");
          },
          onUserStoppedSpeaking: () => {
            console.log("[PipecatProvider] User stopped speaking");
            // Brief "received" flash, then thinking
            callbacks.onStatusChange("received");
            setTimeout(() => {
              callbacks.onStatusChange("thinking");
            }, 800);
          },
          onBotOutput: (data: { text: string }) => {
            console.log("[PipecatProvider] Bot Output:", data);
            if (data.text) {
              this.accumulatedBotText += data.text;
              // Send as partial transcript with accumulated text
              callbacks.onTranscript({
                role: "assistant",
                text: this.accumulatedBotText,
                timestamp: this.botSpeakingTimestamp || Date.now(),
                isFinal: false,
              });
            }
          },
          onUserTranscript: (data: { text: string; final: boolean }) => {
            console.log("[PipecatProvider] User Transcript:", data);
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
            console.error("[PipecatProvider] Error:", error);
            callbacks.onError(new Error(error.message || "Pipecat error"));
          },
        },
      });

      // Connect to the room with audio subscription enabled
      console.log("[PipecatProvider] Connecting to room...");
      await this.client.connect({
        url: this.roomUrl,
        subscribeToTracksAutomatically: true,  // Ensure we receive bot's audio
      });

      console.log("[PipecatProvider] Connected successfully");

      // Set up audio playback for bot's audio track
      // The Pipecat/Daily SDK doesn't automatically create audio elements,
      // so we need to manually create one and attach the bot's audio track
      const dailyTransport = transport as any;
      if (dailyTransport.dailyCallClient) {
        const call = dailyTransport.dailyCallClient;
        const participants = call.participants?.();

        for (const [id, p] of Object.entries(participants || {})) {
          const participant = p as any;
          if (!participant.local && participant.tracks?.audio?.track) {
            // Create audio element for bot's audio
            const audioEl = document.createElement('audio');
            audioEl.id = `pipecat-audio-${id}`;
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');

            // Attach the audio track
            const stream = new MediaStream([participant.tracks.audio.track]);
            audioEl.srcObject = stream;

            // Add to DOM (hidden)
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            this.audioElementId = audioEl.id;

            // Start playback
            try {
              await audioEl.play();
              console.log("[PipecatProvider] Audio playback started");
            } catch (playError) {
              console.error("[PipecatProvider] Failed to start audio playback:", playError);
            }
          }
        }
      }

      // Check hands-free mode preference
      const isHandsFree = typeof window !== 'undefined'
        ? localStorage.getItem("chief-hands-free-mode") === "true"
        : false;

      // In hands-free mode, keep mic open; in PTT mode, mute until spacebar held
      if (isHandsFree) {
        console.log("[PipecatProvider] Hands-free mode: keeping mic open");
        this.client.enableMic(true);
        this.muted = false;
      } else {
        console.log("[PipecatProvider] PTT mode: muting mic");
        this.client.enableMic(false);
        this.muted = true;
      }
      this.isConnecting = false;

    } catch (error) {
      console.error("[PipecatProvider] Connection error:", error);
      this.isConnecting = false;
      callbacks.onStatusChange("idle");
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  disconnect(): void {
    console.log("[PipecatProvider] disconnect() called");

    // Clean up audio element
    if (this.audioElementId) {
      const audioEl = document.getElementById(this.audioElementId);
      if (audioEl) {
        (audioEl as HTMLAudioElement).pause();
        (audioEl as HTMLAudioElement).srcObject = null;
        audioEl.remove();
      }
      this.audioElementId = null;
    }

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    // Notify backend to cleanup
    if (this.callId) {
      fetch(`/api/pipecat/room/${this.callId}`, {
        method: "DELETE",
      }).catch(err => console.error("Failed to cleanup room:", err));
    }

    this.callbacks?.onStatusChange("ended");
    this.roomUrl = null;
    this.callId = null;
    this.isConnecting = false;
    this.accumulatedBotText = "";
    this.botSpeakingTimestamp = 0;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    console.log(`[PipecatProvider] setMuted called: ${muted}`);
    this.muted = muted;
    if (this.client) {
      this.client.enableMic(!muted);
      console.log(`[PipecatProvider] Mic enabled: ${!muted}`);
    }
  }

  stopSpeech(): void {
    console.log("[PipecatProvider] stopSpeech called");
    if (this.client) {
      // Send user-started-speaking signal to immediately interrupt the bot
      this.client.sendClientMessage("user-started-speaking", {});
      console.log("[PipecatProvider] Sent interrupt signal");

      // Also unmute mic for VAD to continue detecting speech
      if (this.muted) {
        this.setMuted(false);
      }
    }
  }

  /**
   * Connect to an existing room (for outbound calls where bot is already waiting)
   */
  async connectToRoom(roomUrl: string, callId: string, callbacks: VoiceProviderCallbacks): Promise<void> {
    console.log("[PipecatProvider] connectToRoom() called for outbound call");
    console.log("[PipecatProvider] Room URL:", roomUrl);
    console.log("[PipecatProvider] Call ID:", callId);

    if (this.isConnecting) {
      console.log("[PipecatProvider] Already connecting, ignoring duplicate call");
      return;
    }

    this.isConnecting = true;
    this.callbacks = callbacks;
    this.roomUrl = roomUrl;
    this.callId = callId;

    try {
      callbacks.onStatusChange("connecting");

      // Create Pipecat client with Daily transport
      const transport = new DailyTransport();

      this.client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            console.log("[PipecatProvider] Connected to outbound room");
            callbacks.onStatusChange("connected");
          },
          onDisconnected: () => {
            console.log("[PipecatProvider] Disconnected from outbound room");
            callbacks.onStatusChange("ended");
          },
          onBotReady: () => {
            console.log("[PipecatProvider] Bot ready in outbound room");
            callbacks.onStatusChange("listening");
          },
          onBotStartedSpeaking: () => {
            console.log("[PipecatProvider] Bot started speaking");
            this.isBotSpeaking = true;
            this.accumulatedBotText = "";
            this.botSpeakingTimestamp = Date.now();
            callbacks.onStatusChange("speaking");

            // In hands-free mode, keep mic on for barge-in (echo cancellation handles feedback)
            // In PTT mode, mute mic while bot speaks
            const isHandsFree = typeof window !== 'undefined'
              ? localStorage.getItem("chief-hands-free-mode") === "true"
              : false;
            if (this.client && !isHandsFree) {
              this.client.enableMic(false);
              console.log("[PipecatProvider] Muted mic during bot speech (PTT mode)");
            } else {
              console.log("[PipecatProvider] Keeping mic on for barge-in (hands-free mode)");
            }
          },
          onBotStoppedSpeaking: () => {
            console.log("[PipecatProvider] Bot stopped speaking");
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

            // Unmute mic after bot finishes (only in hands-free mode AND if user hasn't manually muted)
            const isHandsFree = typeof window !== 'undefined'
              ? localStorage.getItem("chief-hands-free-mode") === "true"
              : false;
            if (this.client && isHandsFree && !this.muted) {
              this.client.enableMic(true);
              console.log("[PipecatProvider] Unmuted mic after bot speech");
            } else if (this.muted) {
              console.log("[PipecatProvider] User has manually muted, keeping mic muted");
            }
          },
          onUserStartedSpeaking: () => {
            console.log("[PipecatProvider] User started speaking");
            // Interrupt bot if it's currently speaking (barge-in)
            if (this.isBotSpeaking && this.client) {
              console.log("[PipecatProvider] Interrupting bot speech (barge-in)");
              this.client.sendClientMessage("user-started-speaking", {});
            }
            callbacks.onStatusChange("listening");
          },
          onUserStoppedSpeaking: () => {
            console.log("[PipecatProvider] User stopped speaking");
            // Brief "received" flash, then thinking
            callbacks.onStatusChange("received");
            setTimeout(() => {
              callbacks.onStatusChange("thinking");
            }, 800);
          },
          onBotOutput: (data: { text: string }) => {
            console.log("[PipecatProvider] Bot Output:", data);
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
            console.log("[PipecatProvider] User Transcript:", data);
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
            console.error("[PipecatProvider] Error:", error);
            callbacks.onError(new Error(error.message || "Pipecat error"));
          },
        },
      });

      console.log("[PipecatProvider] Connecting to outbound room...");
      await this.client.connect({
        url: this.roomUrl,
        subscribeToTracksAutomatically: true,
      });

      console.log("[PipecatProvider] Connected to outbound room successfully");

      // Set up audio playback
      const dailyTransport = transport as any;
      if (dailyTransport.dailyCallClient) {
        const call = dailyTransport.dailyCallClient;
        const participants = call.participants?.();

        for (const [id, p] of Object.entries(participants || {})) {
          const participant = p as any;
          if (!participant.local && participant.tracks?.audio?.track) {
            const audioEl = document.createElement('audio');
            audioEl.id = `pipecat-audio-${id}`;
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');

            const stream = new MediaStream([participant.tracks.audio.track]);
            audioEl.srcObject = stream;

            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            this.audioElementId = audioEl.id;

            try {
              await audioEl.play();
              console.log("[PipecatProvider] Audio playback started");
            } catch (playError) {
              console.error("[PipecatProvider] Failed to start audio playback:", playError);
            }
          }
        }
      }

      // Check hands-free mode preference
      const isHandsFree = typeof window !== 'undefined'
        ? localStorage.getItem("chief-hands-free-mode") === "true"
        : false;

      if (isHandsFree) {
        console.log("[PipecatProvider] Hands-free mode: keeping mic open");
        this.client.enableMic(true);
        this.muted = false;
      } else {
        console.log("[PipecatProvider] PTT mode: muting mic");
        this.client.enableMic(false);
        this.muted = true;
      }
      this.isConnecting = false;

    } catch (error) {
      console.error("[PipecatProvider] Connection error:", error);
      this.isConnecting = false;
      callbacks.onStatusChange("idle");
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

// Singleton instance
let instance: PipecatProvider | null = null;

export function getPipecatProvider(): PipecatProvider {
  if (!instance) {
    instance = new PipecatProvider();
  }
  return instance;
}
