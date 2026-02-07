"use client";

import { useState, useEffect } from "react";
import { X, Check, Volume2, Captions, FileText, ListChecks, Sparkles, Mic, Sun, Moon, Monitor, MessageSquare, Phone } from "lucide-react";
import type { ResponseFormat } from "@/lib/modes";
import { type OrbEffect, ORB_EFFECTS } from "@/components/VoiceOrb";

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

type TTSProvider = "openai" | "elevenlabs" | "piper";

type InterfaceMode = "voice-only" | "voice-text";

const INTERFACE_MODES: { value: InterfaceMode; label: string; description: string; icon: typeof Phone }[] = [
  { value: "voice-only", label: "Voice Only", description: "Clean voice interface", icon: Phone },
  { value: "voice-text", label: "Voice + Text", description: "Switch modes, attach images", icon: MessageSquare },
];

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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  onClose
}: SettingsModalProps) {
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>("default");
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>("openai");
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [orbEffect, setOrbEffect] = useState<OrbEffect>("none");
  const [theme, setTheme] = useState<Theme>("system");
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>("voice-text");

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before hiding
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Load saved settings on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem("chief-tts-provider") as TTSProvider | null;
    if (savedProvider && ["openai", "elevenlabs", "piper"].includes(savedProvider)) {
      setTtsProvider(savedProvider);
    }

    const savedVoice = localStorage.getItem("chief-voice");
    if (savedVoice) {
      setSelectedVoice(savedVoice);
    } else {
      // Default to first voice of current provider
      const voices = getVoicesForProvider(savedProvider || "openai");
      setSelectedVoice(voices[0]?.id || "shimmer");
    }

    const savedSubtitles = localStorage.getItem("chief-show-subtitles");
    if (savedSubtitles !== null) {
      setShowSubtitles(savedSubtitles === "true");
    }

    const savedFormat = localStorage.getItem("chief-response-format");
    if (savedFormat && ["default", "concise", "detailed"].includes(savedFormat)) {
      setResponseFormat(savedFormat as ResponseFormat);
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

  const getVoicesForProvider = (provider: TTSProvider) => {
    switch (provider) {
      case "elevenlabs": return ELEVENLABS_VOICES;
      case "piper": return PIPER_VOICES;
      default: return OPENAI_VOICES;
    }
  };

  const handleProviderChange = (provider: TTSProvider) => {
    setTtsProvider(provider);
    localStorage.setItem("chief-tts-provider", provider);
    // Set default voice for the new provider
    const voices = getVoicesForProvider(provider);
    const defaultVoice = voices[0]?.id || "shimmer";
    setSelectedVoice(defaultVoice);
    localStorage.setItem("chief-voice", defaultVoice);
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    // Save to localStorage - will be used when starting next call
    localStorage.setItem("chief-voice", voiceId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSubtitlesToggle = () => {
    const newValue = !showSubtitles;
    setShowSubtitles(newValue);
    localStorage.setItem("chief-show-subtitles", String(newValue));
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-subtitles-changed", { detail: newValue }));
  };

  const handleResponseFormatChange = (format: ResponseFormat) => {
    setResponseFormat(format);
    localStorage.setItem("chief-response-format", format);
  };

  const handleHandsFreeToggle = () => {
    const newValue = !isHandsFree;
    setIsHandsFree(newValue);
    localStorage.setItem("chief-hands-free-mode", String(newValue));
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-hands-free-changed", { detail: newValue }));
  };

  const handleOrbEffectChange = (effect: OrbEffect) => {
    setOrbEffect(effect);
    localStorage.setItem("chief-orb-effect", effect);
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-orb-effect-changed", { detail: effect }));
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("chief-theme", newTheme);
    // Dispatch event so ThemeProvider can pick up the change
    window.dispatchEvent(new CustomEvent("chief-theme-changed", { detail: newTheme }));
  };

  const handleInterfaceModeChange = (mode: InterfaceMode) => {
    setInterfaceMode(mode);
    localStorage.setItem("chief-interface-mode", mode);
    // Dispatch event so page.tsx can pick up the change
    window.dispatchEvent(new CustomEvent("chief-interface-mode-changed", { detail: mode }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Slide-out drawer from right */}
      <div
        className={`absolute top-0 right-0 h-full w-80 max-w-[85vw] bg-[var(--background)] shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          isAnimating ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pt-safe border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-lg font-display text-[var(--secondary-text)]">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 -m-2 text-[var(--secondary-text)]/40 hover:text-[var(--secondary-text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 flex flex-col pb-safe">
          {/* Theme Toggle */}
          <div className="px-5 pt-4">
            <span className="text-sm font-medium text-[var(--secondary-text)] mb-3 block">Theme</span>
            <div className="flex gap-2">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={`
                    flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-all
                    ${theme === value
                      ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 text-[var(--accent)]"
                      : "bg-[var(--card-bg)] border-2 border-transparent text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interface Mode */}
          <div className="px-5 pt-4">
            <span className="text-sm font-medium text-[var(--secondary-text)] mb-3 block">Interface Mode</span>
            <div className="flex gap-2">
              {INTERFACE_MODES.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleInterfaceModeChange(value)}
                  className={`
                    flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-all
                    ${interfaceMode === value
                      ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 text-[var(--accent)]"
                      : "bg-[var(--card-bg)] border-2 border-transparent text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] opacity-60">{description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Response Format */}
          <div className="px-5 pt-4">
            <span className="text-sm font-medium text-[var(--secondary-text)] mb-3 block">Response Format</span>
            <div className="flex gap-2">
              {RESPONSE_FORMATS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleResponseFormatChange(value)}
                  className={`
                    flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-all
                    ${responseFormat === value
                      ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 text-[var(--accent)]"
                      : "bg-[var(--card-bg)] border-2 border-transparent text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Orb Effect */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="w-4 h-4 text-[var(--secondary-text)]/60" />
              <span className="text-sm font-medium text-[var(--secondary-text)]">Orb Effect</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ORB_EFFECTS.map(({ value, label, description }) => (
                <button
                  key={value}
                  onClick={() => handleOrbEffectChange(value)}
                  className={`
                    text-left px-3 py-2.5 rounded-xl transition-all
                    ${orbEffect === value
                      ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30"
                      : "bg-[var(--card-bg)] border-2 border-transparent hover:bg-[var(--hover-bg)]"
                    }
                  `}
                >
                  <p className={`text-sm font-medium ${orbEffect === value ? "text-[var(--accent)]" : "text-[var(--secondary-text)]"}`}>
                    {label}
                  </p>
                  <p className="text-xs text-[var(--secondary-text)]/50">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Provider Toggle */}
          <div className="px-5 pt-4">
            <span className="text-sm font-medium text-[var(--secondary-text)] mb-3 block">Voice Provider</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleProviderChange("openai")}
                className={`
                  flex-1 px-3 py-3 rounded-xl transition-all text-sm font-medium
                  ${ttsProvider === "openai"
                    ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 text-[var(--accent)]"
                    : "bg-[var(--card-bg)] border-2 border-transparent text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]"
                  }
                `}
              >
                OpenAI
              </button>
              <button
                onClick={() => handleProviderChange("elevenlabs")}
                className={`
                  flex-1 px-3 py-3 rounded-xl transition-all text-sm font-medium
                  ${ttsProvider === "elevenlabs"
                    ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 text-[var(--accent)]"
                    : "bg-[var(--card-bg)] border-2 border-transparent text-[var(--secondary-text)] hover:bg-[var(--hover-bg)]"
                  }
                `}
              >
                ElevenLabs
              </button>
            </div>
          </div>

          {/* Voice selection */}
          <div className="p-5 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="w-4 h-4 text-[var(--secondary-text)]/60" />
              <span className="text-sm font-medium text-[var(--secondary-text)]">Voice</span>
              {saved && (
                <span className="text-xs text-[var(--accent)] ml-auto flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>

            <div className="space-y-2">
              {getVoicesForProvider(ttsProvider).map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => handleVoiceSelect(voice.id)}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl transition-all
                    ${selectedVoice === voice.id
                      ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30"
                      : "bg-[var(--card-bg)] border-2 border-transparent hover:bg-[var(--hover-bg)]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${selectedVoice === voice.id ? "text-[var(--accent)]" : "text-[var(--secondary-text)]"}`}>
                        {voice.name}
                      </p>
                      <p className="text-xs text-[var(--secondary-text)]/60">{voice.description}</p>
                    </div>
                    {selectedVoice === voice.id && (
                      <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles section - at bottom */}
          <div className="px-5 pb-safe-plus mt-auto space-y-2">
            {/* Hands-free mode toggle */}
            <button
              onClick={handleHandsFreeToggle}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4 text-[var(--secondary-text)]/60" />
                  <span className="text-sm font-medium text-[var(--secondary-text)]">Hands-free mode</span>
                </div>
                <span className="text-xs text-[var(--secondary-text)]/40 ml-7">No push-to-talk needed</span>
              </div>
              <div className={`
                relative w-11 h-6 rounded-full transition-colors
                ${isHandsFree ? 'bg-[var(--accent)]' : 'bg-[var(--border-color-heavy)]'}
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${isHandsFree ? 'translate-x-5' : 'translate-x-0.5'}
                `} />
              </div>
            </button>

            {/* Subtitles toggle */}
            <button
              onClick={handleSubtitlesToggle}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Captions className="w-4 h-4 text-[var(--secondary-text)]/60" />
                <span className="text-sm font-medium text-[var(--secondary-text)]">Show subtitles</span>
              </div>
              <div className={`
                relative w-11 h-6 rounded-full transition-colors
                ${showSubtitles ? 'bg-[var(--accent)]' : 'bg-[var(--border-color-heavy)]'}
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${showSubtitles ? 'translate-x-5' : 'translate-x-0.5'}
                `} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
