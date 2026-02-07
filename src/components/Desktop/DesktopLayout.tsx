"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Settings, X, Volume2, Check, FileText, ListChecks, Sparkles, Captions, Mic, Sun, Moon, Monitor, MessageSquare, Phone, Clock } from "lucide-react";
import type { ResponseFormat } from "@/lib/modes";
import { type OrbEffect, ORB_EFFECTS } from "@/components/VoiceOrb";

type TTSProvider = "openai" | "elevenlabs" | "piper";

interface Voice {
  id: string;
  name: string;
  description: string;
}

// OpenAI TTS voices
const OPENAI_VOICES: Voice[] = [
  { id: "shimmer", name: "Shimmer", description: "Warm & expressive" },
  { id: "nova", name: "Nova", description: "Friendly & upbeat" },
  { id: "alloy", name: "Alloy", description: "Neutral & balanced" },
  { id: "echo", name: "Echo", description: "Soft & gentle" },
  { id: "fable", name: "Fable", description: "British & narrative" },
  { id: "onyx", name: "Onyx", description: "Deep & authoritative" },
];

// ElevenLabs voices (custom voices)
const ELEVENLABS_VOICES: Voice[] = [
  { id: "1SM7GgM6IMuvQlz2BwM3", name: "Mark", description: "Custom ElevenLabs voice" },
  { id: "JFZ2Sw5TN92wIBOEx7pZ", name: "Sarn", description: "Custom ElevenLabs voice" },
  { id: "vu6gUGJTkGGUmQLLHG2D", name: "God", description: "Custom ElevenLabs voice" },
];

// Piper voices (local TTS - Linux only)
const PIPER_VOICES: Voice[] = [
  { id: "en_US-lessac-medium", name: "Lessac", description: "Clear American English" },
  { id: "en_US-amy-medium", name: "Amy", description: "Female American" },
  { id: "en_GB-alba-medium", name: "Alba", description: "British English" },
];

const RESPONSE_FORMATS: { value: ResponseFormat; label: string; icon: typeof FileText }[] = [
  { value: "default", label: "Default", icon: FileText },
  { value: "concise", label: "Concise", icon: ListChecks },
  { value: "detailed", label: "Detailed", icon: Sparkles },
];

type Theme = "light" | "dark" | "system";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

type InterfaceMode = "voice-only" | "voice-text";

const INTERFACE_MODES: { value: InterfaceMode; label: string; description: string; icon: typeof Phone }[] = [
  { value: "voice-only", label: "Voice Only", description: "Clean voice interface", icon: Phone },
  { value: "voice-text", label: "Voice + Text", description: "Switch modes, attach images", icon: MessageSquare },
];

interface DesktopLayoutProps {
  children: ReactNode;
  isInCall?: boolean;
  // New props for desktop controls
  inputMode?: 'voice' | 'text';
  onInputModeChange?: (mode: 'voice' | 'text') => void;
  isTextStreaming?: boolean;
  onCancelTextStream?: () => void;
  onShowHistory?: () => void;
}

export function DesktopLayout({
  children,
  isInCall = false,
  inputMode = 'voice',
  onInputModeChange,
  isTextStreaming = false,
  onCancelTextStream,
  onShowHistory,
}: DesktopLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("shimmer");
  const [voiceSaved, setVoiceSaved] = useState(false);
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>("default");
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>("openai");
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [orbEffect, setOrbEffect] = useState<OrbEffect>("none");
  const [theme, setTheme] = useState<Theme>("system");
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>("voice-text");

  // Load settings on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem("chief-tts-provider") as TTSProvider | null;
    if (savedProvider && ["openai", "elevenlabs", "piper"].includes(savedProvider)) {
      setTtsProvider(savedProvider);
    }

    const savedVoice = localStorage.getItem("chief-voice");
    if (savedVoice) setSelectedVoice(savedVoice);

    const savedFormat = localStorage.getItem("chief-response-format");
    if (savedFormat && ["default", "concise", "detailed"].includes(savedFormat)) {
      setResponseFormat(savedFormat as ResponseFormat);
    }

    const savedSubtitles = localStorage.getItem("chief-show-subtitles");
    if (savedSubtitles !== null) {
      setShowSubtitles(savedSubtitles === "true");
    }

    const savedHandsFree = localStorage.getItem("chief-hands-free-mode");
    if (savedHandsFree !== null) {
      setIsHandsFree(savedHandsFree === "true");
    }

    const savedOrbEffect = localStorage.getItem("chief-orb-effect");
    if (savedOrbEffect && ["none", "rings", "glow", "aurora"].includes(savedOrbEffect)) {
      setOrbEffect(savedOrbEffect as OrbEffect);
    }

    const savedTheme = localStorage.getItem("chief-theme");
    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      setTheme(savedTheme as Theme);
    }

    const savedInterfaceMode = localStorage.getItem("chief-interface-mode");
    if (savedInterfaceMode && ["voice-only", "voice-text"].includes(savedInterfaceMode)) {
      setInterfaceMode(savedInterfaceMode as InterfaceMode);
    }
  }, []);

  // Auto-close settings during calls
  useEffect(() => {
    if (isInCall) setSettingsOpen(false);
  }, [isInCall]);

  const getVoicesForProvider = useCallback((provider: TTSProvider) => {
    switch (provider) {
      case "elevenlabs": return ELEVENLABS_VOICES;
      case "piper": return PIPER_VOICES;
      default: return OPENAI_VOICES;
    }
  }, []);

  const handleProviderChange = useCallback((provider: TTSProvider) => {
    setTtsProvider(provider);
    localStorage.setItem("chief-tts-provider", provider);
    // Set default voice for the new provider
    const voices = getVoicesForProvider(provider);
    const defaultVoice = voices[0]?.id || "shimmer";
    setSelectedVoice(defaultVoice);
    localStorage.setItem("chief-voice", defaultVoice);
  }, [getVoicesForProvider]);

  const handleVoiceSelect = useCallback((voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem("chief-voice", voiceId);
    setVoiceSaved(true);
    setTimeout(() => setVoiceSaved(false), 2000);
  }, []);

  const handleResponseFormatChange = useCallback((format: ResponseFormat) => {
    setResponseFormat(format);
    localStorage.setItem("chief-response-format", format);
  }, []);

  const handleSubtitlesToggle = useCallback(() => {
    const newValue = !showSubtitles;
    setShowSubtitles(newValue);
    localStorage.setItem("chief-show-subtitles", String(newValue));
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-subtitles-changed", { detail: newValue }));
  }, [showSubtitles]);

  const handleHandsFreeToggle = useCallback(() => {
    const newValue = !isHandsFree;
    setIsHandsFree(newValue);
    localStorage.setItem("chief-hands-free-mode", String(newValue));
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-hands-free-changed", { detail: newValue }));
  }, [isHandsFree]);

  const handleOrbEffectChange = useCallback((effect: OrbEffect) => {
    setOrbEffect(effect);
    localStorage.setItem("chief-orb-effect", effect);
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-orb-effect-changed", { detail: effect }));
  }, []);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("chief-theme", newTheme);
    // Dispatch event so ThemeProvider can pick up the change
    window.dispatchEvent(new CustomEvent("chief-theme-changed", { detail: newTheme }));
  }, []);

  const handleInterfaceModeChange = useCallback((mode: InterfaceMode) => {
    setInterfaceMode(mode);
    localStorage.setItem("chief-interface-mode", mode);
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-interface-mode-changed", { detail: mode }));
  }, []);

  return (
    <div className="simple-layout">
      {/* Logo - top left (desktop only) */}
      {!isInCall && (
        <div className="desktop-logo desktop-only">
          <svg
            className="w-7 h-7 text-[#c75b3a]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M19.967 17.484A4 4 0 0 1 18 18" />
          </svg>
          <span className="text-lg font-display text-[var(--secondary-text)]">Chief</span>
        </div>
      )}

      {/* Desktop controls - top right (desktop only) */}
      {!isInCall && (
        <div className="desktop-controls desktop-only">
          {/* Voice/Text mode toggle - only show if not in voice-only mode */}
          {interfaceMode === 'voice-text' && (
            <div className="desktop-mode-toggle">
              <button
                onClick={() => onInputModeChange?.('voice')}
                className={`desktop-mode-btn ${inputMode === 'voice' ? 'active' : ''}`}
                title="Voice mode"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={() => onInputModeChange?.('text')}
                className={`desktop-mode-btn ${inputMode === 'text' ? 'active' : ''}`}
                title="Text mode"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {/* Cancel text streaming button */}
          {isTextStreaming && onCancelTextStream && (
            <button
              onClick={onCancelTextStream}
              className="desktop-control-btn"
              title="Cancel message"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          
          {/* History button */}
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="desktop-control-btn"
              title="History"
            >
              <Clock className="h-5 w-5" />
            </button>
          )}
          
          {/* Settings gear button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="desktop-control-btn"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Settings panel backdrop */}
      {settingsOpen && (
        <div
          className="settings-panel-backdrop"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      {/* Settings slide-out panel */}
      <aside className={`settings-slide-panel ${settingsOpen ? "open" : ""}`}>
        <div className="settings-slide-header">
          <h2>Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="settings-slide-close"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="settings-slide-content">
          {/* Theme Toggle */}
          <section className="settings-slide-section">
            <h3 className="settings-slide-section-title">Theme</h3>
            <div className="settings-slide-format-group">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={`settings-slide-format ${theme === value ? "active" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Interface Mode */}
          <section className="settings-slide-section">
            <h3 className="settings-slide-section-title">Interface Mode</h3>
            <div className="settings-slide-format-group">
              {INTERFACE_MODES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleInterfaceModeChange(value)}
                  className={`settings-slide-format ${interfaceMode === value ? "active" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Response Format */}
          <section className="settings-slide-section">
            <h3 className="settings-slide-section-title">Response Format</h3>
            <div className="settings-slide-format-group">
              {RESPONSE_FORMATS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleResponseFormatChange(value)}
                  className={`settings-slide-format ${responseFormat === value ? "active" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Orb Effect */}
          <section className="settings-slide-section">
            <h3 className="settings-slide-section-title">
              <Sun className="w-4 h-4" />
              Orb Effect
            </h3>
            <div className="settings-slide-orb-grid">
              {ORB_EFFECTS.map(({ value, label, description }) => (
                <button
                  key={value}
                  onClick={() => handleOrbEffectChange(value)}
                  className={`settings-slide-orb-option ${orbEffect === value ? "active" : ""}`}
                >
                  <span className="settings-slide-orb-label">{label}</span>
                  <span className="settings-slide-orb-desc">{description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Voice Provider Toggle */}
          <section className="settings-slide-section">
            <h3 className="settings-slide-section-title">Voice Provider</h3>
            <div className="settings-slide-toggle-group">
              <button
                onClick={() => handleProviderChange("openai")}
                className={`settings-slide-toggle ${ttsProvider === "openai" ? "active" : ""}`}
              >
                OpenAI
              </button>
              <button
                onClick={() => handleProviderChange("elevenlabs")}
                className={`settings-slide-toggle ${ttsProvider === "elevenlabs" ? "active" : ""}`}
              >
                ElevenLabs
              </button>
            </div>
          </section>

          {/* Voice Selection */}
          <section className="settings-slide-section">
            <div className="settings-slide-section-header">
              <h3 className="settings-slide-section-title">
                <Volume2 className="w-4 h-4" />
                Voice
              </h3>
              {voiceSaved && (
                <span className="settings-slide-saved">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            <div className="settings-slide-voice-list">
              {getVoicesForProvider(ttsProvider).map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => handleVoiceSelect(voice.id)}
                  className={`settings-slide-voice ${selectedVoice === voice.id ? "active" : ""}`}
                >
                  <div className="settings-slide-voice-info">
                    <span className="settings-slide-voice-name">{voice.name}</span>
                    <span className="settings-slide-voice-desc">{voice.description}</span>
                  </div>
                  {selectedVoice === voice.id && (
                    <div className="settings-slide-check">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Keyboard shortcuts */}
          <div className="settings-slide-shortcuts">
            <p><kbd>Space</kbd> {isHandsFree ? "Toggle mute" : "Push-to-talk"}</p>
            <p><kbd>Enter</kbd> Send message</p>
          </div>

          {/* Toggles - at bottom */}
          <section className="settings-slide-section settings-slide-section-bottom">
            {/* Hands-free toggle */}
            <button
              onClick={handleHandsFreeToggle}
              className="settings-slide-toggle-row"
            >
              <div className="settings-slide-toggle-row-info">
                <Mic className="w-4 h-4" />
                <div className="flex flex-col items-start">
                  <span>Hands-free mode</span>
                  <span className="text-xs text-[var(--secondary-text)]/40">No push-to-talk needed</span>
                </div>
              </div>
              <div className={`settings-slide-switch ${isHandsFree ? "active" : ""}`}>
                <div className="settings-slide-switch-thumb" />
              </div>
            </button>

            {/* Subtitles toggle */}
            <button
              onClick={handleSubtitlesToggle}
              className="settings-slide-toggle-row"
            >
              <div className="settings-slide-toggle-row-info">
                <Captions className="w-4 h-4" />
                <span>Show subtitles</span>
              </div>
              <div className={`settings-slide-switch ${showSubtitles ? "active" : ""}`}>
                <div className="settings-slide-switch-thumb" />
              </div>
            </button>
          </section>
        </div>

      </aside>

      {/* Main content */}
      <main className="simple-main">
        {children}
      </main>
    </div>
  );
}
