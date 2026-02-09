"use client";

import { useState, useEffect } from "react";
import { DesktopLayout } from "@/components/Desktop";
import {
  Volume2,
  Check,
  Mic,
  MessageSquare,
  FileText,
  ListChecks,
  Sparkles,
  ArrowLeft,
  Plug,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { ResponseFormat } from "@/lib/modes";

interface Voice {
  id: string;
  name: string;
  description: string;
}

type TTSProvider = "openai" | "piper";

// OpenAI TTS voices
const OPENAI_VOICES: Voice[] = [
  { id: "shimmer", name: "Shimmer", description: "Warm & expressive" },
  { id: "nova", name: "Nova", description: "Friendly & upbeat" },
  { id: "alloy", name: "Alloy", description: "Neutral & balanced" },
  { id: "echo", name: "Echo", description: "Soft & gentle" },
  { id: "fable", name: "Fable", description: "British & narrative" },
  { id: "onyx", name: "Onyx", description: "Deep & authoritative" },
];

// Piper TTS voices (local inference)
const PIPER_VOICES: Voice[] = [
  { id: "en_US-lessac-medium", name: "Lessac (US)", description: "Male, clear & neutral" },
  { id: "en_US-amy-medium", name: "Amy (US)", description: "Female, expressive" },
  { id: "en_US-libritts-high", name: "LibriTTS (US)", description: "Male, high quality" },
  { id: "en_GB-alan-medium", name: "Alan (UK)", description: "Male, British" },
  { id: "en_GB-alba-medium", name: "Alba (UK)", description: "Female, Scottish" },
];

const RESPONSE_FORMATS: { value: ResponseFormat; label: string; description: string; icon: typeof FileText }[] = [
  { value: "default", label: "Default", description: "Balanced responses", icon: FileText },
  { value: "concise", label: "Concise", description: "Brief and to the point", icon: ListChecks },
  { value: "detailed", label: "Detailed", description: "Thorough explanations", icon: Sparkles },
];

export default function SettingsPage() {
  const [selectedVoice, setSelectedVoice] = useState<string>("shimmer");
  const [voiceSaved, setVoiceSaved] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>("default");
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>("openai");

  // Load settings on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem("chief-tts-provider");
    if (savedProvider && (savedProvider === "openai" || savedProvider === "piper")) {
      setTtsProvider(savedProvider as TTSProvider);
    }

    const savedVoice = localStorage.getItem("chief-voice");
    if (savedVoice) {
      setSelectedVoice(savedVoice);
    } else {
      // Set default based on provider
      const provider = savedProvider as TTSProvider || "openai";
      setSelectedVoice(provider === "piper" ? "en_US-lessac-medium" : "shimmer");
    }

    const savedFormat = localStorage.getItem("chief-response-format");
    if (savedFormat && ["default", "concise", "detailed"].includes(savedFormat)) {
      setResponseFormat(savedFormat as ResponseFormat);
    }
  }, []);

  const handleTtsProviderChange = (provider: TTSProvider) => {
    setTtsProvider(provider);
    localStorage.setItem("chief-tts-provider", provider);
    
    // Switch to default voice for this provider
    const defaultVoice = provider === "piper" ? "en_US-lessac-medium" : "shimmer";
    setSelectedVoice(defaultVoice);
    localStorage.setItem("chief-voice", defaultVoice);
    
    setVoiceSaved(true);
    setTimeout(() => setVoiceSaved(false), 2000);
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem("chief-voice", voiceId);
    setVoiceSaved(true);
    setTimeout(() => setVoiceSaved(false), 2000);
  };

  const handleInputModeChange = (mode: "voice" | "text") => {
    setInputMode(mode);
  };

  const handleResponseFormatChange = (format: ResponseFormat) => {
    setResponseFormat(format);
    localStorage.setItem("chief-response-format", format);
  };

  // Get current voices based on selected provider
  const currentVoices = ttsProvider === "piper" ? PIPER_VOICES : OPENAI_VOICES;

  return (
    <DesktopLayout>
      <div className="settings-page">
        {/* Header */}
        <header className="settings-page-header">
          <Link href="/" className="settings-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="settings-page-title">Settings</h1>
        </header>

        {/* Content */}
        <div className="settings-page-content">
          {/* Integrations link */}
          <Link href="/settings/integrations" className="integ-nav-card">
            <div className="integ-nav-card-icon">
              <Plug className="w-5 h-5" />
            </div>
            <div className="integ-nav-card-info">
              <span className="integ-nav-card-title">Integrations</span>
              <span className="integ-nav-card-desc">
                Connect APIs, CRMs, and services to unlock new tools
              </span>
            </div>
            <ChevronRight className="w-5 h-5 integ-nav-card-chevron" />
          </Link>

          {/* Input Mode */}
          <section className="settings-page-section">
            <h2 className="settings-page-section-title">Input Mode</h2>
            <p className="settings-page-section-desc">Choose how you interact with Chief</p>
            <div className="settings-page-toggle-group">
              <button
                onClick={() => handleInputModeChange("voice")}
                className={`settings-page-toggle-btn ${inputMode === "voice" ? "active" : ""}`}
              >
                <Mic className="w-5 h-5" />
                <div className="settings-page-toggle-info">
                  <span className="settings-page-toggle-label">Voice</span>
                  <span className="settings-page-toggle-desc">Talk using push-to-talk</span>
                </div>
                {inputMode === "voice" && (
                  <div className="settings-page-check">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
              <button
                onClick={() => handleInputModeChange("text")}
                className={`settings-page-toggle-btn ${inputMode === "text" ? "active" : ""}`}
              >
                <MessageSquare className="w-5 h-5" />
                <div className="settings-page-toggle-info">
                  <span className="settings-page-toggle-label">Text</span>
                  <span className="settings-page-toggle-desc">Type your messages</span>
                </div>
                {inputMode === "text" && (
                  <div className="settings-page-check">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            </div>
          </section>

          {/* Response Format */}
          <section className="settings-page-section">
            <h2 className="settings-page-section-title">Response Format</h2>
            <p className="settings-page-section-desc">Control how detailed responses should be</p>
            <div className="settings-page-format-group">
              {RESPONSE_FORMATS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleResponseFormatChange(value)}
                  className={`settings-page-format-btn ${responseFormat === value ? "active" : ""}`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="settings-page-format-info">
                    <span className="settings-page-format-label">{label}</span>
                    <span className="settings-page-format-desc">{description}</span>
                  </div>
                  {responseFormat === value && (
                    <div className="settings-page-check">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* TTS Provider Selection */}
          <section className="settings-page-section">
            <h2 className="settings-page-section-title">Text-to-Speech Provider</h2>
            <p className="settings-page-section-desc">Choose between cloud (OpenAI) or local (Piper) TTS</p>
            <div className="settings-page-toggle-group">
              <button
                onClick={() => handleTtsProviderChange("openai")}
                className={`settings-page-toggle-btn ${ttsProvider === "openai" ? "active" : ""}`}
              >
                <Volume2 className="w-5 h-5" />
                <div className="settings-page-toggle-info">
                  <span className="settings-page-toggle-label">OpenAI</span>
                  <span className="settings-page-toggle-desc">Cloud TTS (higher quality)</span>
                </div>
                {ttsProvider === "openai" && (
                  <div className="settings-page-check">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
              <button
                onClick={() => handleTtsProviderChange("piper")}
                className={`settings-page-toggle-btn ${ttsProvider === "piper" ? "active" : ""}`}
              >
                <Volume2 className="w-5 h-5" />
                <div className="settings-page-toggle-info">
                  <span className="settings-page-toggle-label">Piper</span>
                  <span className="settings-page-toggle-desc">Local TTS (faster, private)</span>
                </div>
                {ttsProvider === "piper" && (
                  <div className="settings-page-check">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            </div>
          </section>

          {/* Voice Selection */}
          <section className="settings-page-section">
            <div className="settings-page-section-header">
              <div>
                <h2 className="settings-page-section-title">
                  <Volume2 className="w-5 h-5" />
                  Voice
                </h2>
                <p className="settings-page-section-desc">
                  Choose the assistant's voice ({ttsProvider === "piper" ? "Piper" : "OpenAI"})
                </p>
              </div>
              {voiceSaved && (
                <span className="settings-page-saved-badge">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            <div className="settings-page-voice-grid">
              {currentVoices.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => handleVoiceSelect(voice.id)}
                  className={`settings-page-voice-btn ${selectedVoice === voice.id ? "active" : ""}`}
                >
                  <div className="settings-page-voice-info">
                    <span className="settings-page-voice-name">{voice.name}</span>
                    <span className="settings-page-voice-desc">{voice.description}</span>
                  </div>
                  {selectedVoice === voice.id && (
                    <div className="settings-page-check">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="settings-page-section">
            <h2 className="settings-page-section-title">Keyboard Shortcuts</h2>
            <div className="settings-page-shortcuts">
              <div className="settings-page-shortcut">
                <kbd>Space</kbd>
                <span>Push-to-talk (hold to speak)</span>
              </div>
              <div className="settings-page-shortcut">
                <kbd>Enter</kbd>
                <span>Send text message</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DesktopLayout>
  );
}
