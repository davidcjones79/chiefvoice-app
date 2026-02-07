export type CallStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "received"  // Brief flash when user input is received
  | "speaking"
  | "thinking"
  | "ended";

export interface VoiceConfig {
  assistantId?: string;
  serverUrl?: string;
  voiceId?: string;
  systemPrompt?: string;
  firstMessage?: string;
}

export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  isFinal?: boolean;
}

export interface VoiceProviderCallbacks {
  onStatusChange: (status: CallStatus) => void;
  onTranscript: (entry: TranscriptEntry) => void;
  onError: (error: Error) => void;
  onVolumeLevel?: (level: number) => void;
}

export interface VoiceProvider {
  readonly name: string;
  connect(config: VoiceConfig, callbacks: VoiceProviderCallbacks): Promise<void>;
  connectToRoom?(roomUrl: string, callId: string, callbacks: VoiceProviderCallbacks): Promise<void>;
  disconnect(): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  stopSpeech(): void;
}

export interface CallRecord {
  id: string;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  transcript: TranscriptEntry[];
}
