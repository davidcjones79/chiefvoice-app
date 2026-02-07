"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isCapacitor } from "@/lib/platform";
import { InlineTranscript } from "@/components/InlineTranscript";
import { VoiceOrb, type OrbEffect } from "@/components/VoiceOrb";
import { VoiceSubtitle } from "@/components/VoiceSubtitle";
import { StatusIndicator } from "@/components/StatusIndicator";
import { WakeWordListener } from "@/components/WakeWordListener";
import { TextInput, type AttachedFile } from "@/components/TextInput";
// ModeSelector & ResponseFormatToggle removed from mobile - available via Settings modal
import { type ConversationMode, type ResponseFormat, DEFAULT_MODE } from "@/lib/modes";
import { getVoiceProvider } from "@/lib/voice/provider-factory";
import type { CallStatus as CallStatusType, TranscriptEntry } from "@/lib/voice/types";
import { Phone, X, Settings, MessageSquare, Mic, Clock } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { DesktopLayout } from "@/components/Desktop";
import { hapticImpact, hapticNotification } from "@/lib/native";

export default function Home() {
  return (
    <Suspense fallback={<div className="h-full min-h-[100dvh] flex items-center justify-center bg-[var(--background)]">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallStatusType>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<TranscriptEntry | null>(null);
  const [accumulatedPartial, setAccumulatedPartial] = useState<string>("");
  const [partialRole, setPartialRole] = useState<'user' | 'assistant' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHoldingPTT, setIsHoldingPTT] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [collectedLinks, setCollectedLinks] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isOutboundCall, setIsOutboundCall] = useState(false);

  // New state for Phase 1 features
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [conversationMode, setConversationMode] = useState<ConversationMode>(DEFAULT_MODE);
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>('default');
  const [customPrompt, setCustomPrompt] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isTextStreaming, setIsTextStreaming] = useState(false);
  const [textStreamController, setTextStreamController] = useState<AbortController | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [orbEffect, setOrbEffect] = useState<OrbEffect>("glow");
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);
  const [interfaceMode, setInterfaceMode] = useState<'voice-only' | 'voice-text'>('voice-text');
  const [siriStartRequested, setSiriStartRequested] = useState(false);

  // Check for iOS + non-Safari browser on mount (skip for native app)
  useEffect(() => {
    // Skip warning if running in Capacitor native app
    // @ts-expect-error - Capacitor global may not be defined
    if (window.Capacitor?.isNativePlatform?.()) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

    if (isIOS && !isSafari) {
      setBrowserWarning("Voice calls work best in Safari on iOS. Please open this page in Safari for the best experience.");
    }
  }, []);

  // Join an outbound call room - reusable function for URL params and deep links
  const outboundJoinAttempted = useRef(false);
  const joinOutboundRoom = useCallback((outboundId: string, roomUrl: string) => {
    if (outboundJoinAttempted.current) {
      console.log("[Outbound] Already attempted to join, ignoring");
      return;
    }
    outboundJoinAttempted.current = true;

    console.log("[Outbound] Joining outbound call room");
    console.log("[Outbound] Call ID:", outboundId);
    console.log("[Outbound] Room URL:", roomUrl);

    hapticImpact('medium');
    setIsOutboundCall(true);
    setError(null);
    setTranscript([]);
    setLiveTranscript(null);
    setAccumulatedPartial("");
    setPartialRole(null);
    setCollectedLinks([]);
    setStatus("connecting");
    setCallId(outboundId);

    const provider = getVoiceProvider();
    const handsFreeEnabled = localStorage.getItem('chief-hands-free-mode') === 'true';

    if (provider.connectToRoom) {
      provider.connectToRoom(roomUrl, outboundId, {
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
          if (newStatus === "ended") {
            setVolumeLevel(0);
            setIsHoldingPTT(false);
            pttKeyHeld.current = false;
          }
          if (newStatus === "connected") {
            if (handsFreeEnabled) {
              provider.setMuted(false);
              setIsMuted(false);
            } else {
              provider.setMuted(true);
              setIsMuted(true);
            }
          }
        },
        onTranscript: (entry) => {
          if (entry.isFinal) {
            setLiveTranscript(null);
            setAccumulatedPartial("");
            setPartialRole(null);
            setTranscript((prev) => [...prev, entry]);
          } else {
            setLiveTranscript(entry);
          }
        },
        onError: (err) => {
          setError(err.message);
          console.error("Voice error:", err);
        },
        onVolumeLevel: (level) => {
          setVolumeLevel(level);
        },
      }).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to join outbound call");
        setStatus("idle");
      });
    } else {
      console.error("[Outbound] Provider does not support connectToRoom");
      setError("Voice provider does not support joining existing rooms");
      setStatus("idle");
    }
  }, []);

  // Check for outbound call URL params (web browser)
  useEffect(() => {
    const outboundId = searchParams.get('outbound');
    const roomUrl = searchParams.get('room');

    if (outboundId && roomUrl) {
      joinOutboundRoom(outboundId, roomUrl);
    }
  }, [searchParams, joinOutboundRoom]);

  // Listen for deep links from native app (chief://call?outbound=...&room=...)
  useEffect(() => {
    // Only set up Capacitor deep link handling in Capacitor environment
    if (!isCapacitor()) return;

    // Define the type inline since we can't import it statically
    type URLOpenListenerEvent = { url: string };

    const handleDeepLink = (event: URLOpenListenerEvent) => {
      console.log("[DeepLink] Received URL:", event.url);

      try {
        const url = new URL(event.url);

        // Handle chief://call?outbound=...&room=...
        if (url.protocol === 'chief:' && url.host === 'call') {
          const outboundId = url.searchParams.get('outbound');
          const roomUrl = url.searchParams.get('room');

          if (outboundId && roomUrl) {
            console.log("[DeepLink] Joining outbound call:", outboundId);
            joinOutboundRoom(outboundId, roomUrl);
          } else {
            console.warn("[DeepLink] Missing outbound or room params");
          }
        }

        // Handle chief://start - Siri Shortcut to start hands-free call
        if (url.protocol === 'chief:' && url.host === 'start') {
          console.log("[DeepLink] Siri Shortcut: Starting hands-free call");
          // Enable hands-free mode
          localStorage.setItem('chief-hands-free-mode', 'true');
          setIsHandsFree(true);
          // Trigger auto-start via state (triggers re-render)
          setSiriStartRequested(true);
        }
      } catch (err) {
        console.error("[DeepLink] Failed to parse URL:", err);
      }
    };

    // Dynamically import Capacitor App only in Capacitor environment
    let cleanup: (() => void) | undefined;

    import('@capacitor/app').then(({ App }) => {
      // Register the listener
      App.addListener('appUrlOpen', handleDeepLink);

      // Check if app was opened via deep link (cold start)
      App.getLaunchUrl().then((result) => {
        if (result?.url) {
          console.log("[DeepLink] App launched with URL:", result.url);
          handleDeepLink({ url: result.url });
        }
      });

      cleanup = () => {
        App.removeAllListeners();
      };
    }).catch((err) => {
      console.error("[DeepLink] Failed to load Capacitor App:", err);
    });

    return () => {
      cleanup?.();
    };
  }, [joinOutboundRoom]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('chief-conversation-mode');
    if (savedMode) {
      setConversationMode(savedMode as ConversationMode);
    }

    const savedFormat = localStorage.getItem('chief-response-format');
    if (savedFormat && ['default', 'concise', 'detailed'].includes(savedFormat)) {
      setResponseFormat(savedFormat as ResponseFormat);
    }

    const savedCustomPrompt = localStorage.getItem('chief-custom-prompt');
    if (savedCustomPrompt) {
      setCustomPrompt(savedCustomPrompt);
    }

    const savedSubtitles = localStorage.getItem('chief-show-subtitles');
    if (savedSubtitles !== null) {
      setShowSubtitles(savedSubtitles === 'true');
    }

    const savedHandsFree = localStorage.getItem('chief-hands-free-mode');
    if (savedHandsFree !== null) {
      setIsHandsFree(savedHandsFree === 'true');
    }

    const savedOrbEffect = localStorage.getItem('chief-orb-effect');
    if (savedOrbEffect && ['none', 'rings', 'glow', 'aurora'].includes(savedOrbEffect)) {
      setOrbEffect(savedOrbEffect as OrbEffect);
    }

    const savedInterfaceMode = localStorage.getItem('chief-interface-mode');
    if (savedInterfaceMode && ['voice-only', 'voice-text'].includes(savedInterfaceMode)) {
      setInterfaceMode(savedInterfaceMode as 'voice-only' | 'voice-text');
      // In voice-only mode, always use voice input
      if (savedInterfaceMode === 'voice-only') {
        setInputMode('voice');
      }
    }

    // Listen for subtitle setting changes from DesktopLayout
    const handleSubtitlesChange = (e: CustomEvent<boolean>) => {
      setShowSubtitles(e.detail);
    };
    window.addEventListener('chief-subtitles-changed', handleSubtitlesChange as EventListener);

    // Listen for hands-free mode changes from settings
    const handleHandsFreeChange = (e: CustomEvent<boolean>) => {
      setIsHandsFree(e.detail);
    };
    window.addEventListener('chief-hands-free-changed', handleHandsFreeChange as EventListener);

    // Listen for orb effect changes from settings
    const handleOrbEffectChange = (e: CustomEvent<OrbEffect>) => {
      setOrbEffect(e.detail);
    };
    window.addEventListener('chief-orb-effect-changed', handleOrbEffectChange as EventListener);

    // Listen for interface mode changes from settings
    const handleInterfaceModeChange = (e: CustomEvent<'voice-only' | 'voice-text'>) => {
      setInterfaceMode(e.detail);
      // In voice-only mode, always use voice input
      if (e.detail === 'voice-only') {
        setInputMode('voice');
      }
    };
    window.addEventListener('chief-interface-mode-changed', handleInterfaceModeChange as EventListener);

    return () => {
      window.removeEventListener('chief-subtitles-changed', handleSubtitlesChange as EventListener);
      window.removeEventListener('chief-hands-free-changed', handleHandsFreeChange as EventListener);
      window.removeEventListener('chief-orb-effect-changed', handleOrbEffectChange as EventListener);
      window.removeEventListener('chief-interface-mode-changed', handleInterfaceModeChange as EventListener);
    };
  }, []);

  // Save conversation mode to localStorage when it changes
  const handleModeChange = useCallback((mode: ConversationMode) => {
    setConversationMode(mode);
    localStorage.setItem('chief-conversation-mode', mode);
  }, []);

  // Save response format to localStorage when it changes
  const handleResponseFormatChange = useCallback((format: ResponseFormat) => {
    setResponseFormat(format);
    localStorage.setItem('chief-response-format', format);
  }, []);

  // Save custom prompt to localStorage when it changes
  const handleCustomPromptChange = useCallback((prompt: string) => {
    setCustomPrompt(prompt);
    localStorage.setItem('chief-custom-prompt', prompt);
  }, []);
  
  const pttKeyHeld = useRef(false);

  const assistantName = "Chief";
  const isInCall = status !== "idle" && status !== "ended";

  // Handle hands-free mode changes mid-call
  useEffect(() => {
    if (!isInCall) return;

    const provider = getVoiceProvider();
    if (isHandsFree) {
      // Switching to hands-free: unmute mic
      provider.setMuted(false);
      setIsMuted(false);
      setIsHoldingPTT(false);
      pttKeyHeld.current = false;
    } else {
      // Switching to PTT: mute mic
      provider.setMuted(true);
      setIsMuted(true);
    }
  }, [isHandsFree, isInCall]);

  // Subscribe to activity stream for links
  useEffect(() => {
    const eventSource = new EventSource("/api/activity");
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "links" && data.message) {
          const urls = data.message.split("\n").filter(Boolean);
          setCollectedLinks(prev => [...prev, ...urls]);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };
    
    return () => eventSource.close();
  }, []);

  // Save call to database when it ends
  useEffect(() => {
    if (status === "ended" && callId && transcript.length > 0) {
      fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: callId,
          action: "end",
          endedAt: Date.now(),
        }),
      }).catch(console.error);
    }
  }, [status, callId, transcript.length]);

  // Push-to-talk keyboard handling (PTT mode only)
  // In hands-free mode, spacebar toggles mute instead of hold-to-talk
  useEffect(() => {
    if (!isInCall) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();

        if (isHandsFree) {
          // Hands-free mode: spacebar toggles mute
          const provider = getVoiceProvider();
          const newMuted = !isMuted;
          provider.setMuted(newMuted);
          setIsMuted(newMuted);
        } else {
          // PTT mode: hold spacebar to talk
          if (!pttKeyHeld.current) {
            pttKeyHeld.current = true;
            setIsHoldingPTT(true);

            const provider = getVoiceProvider();

            if (status === "speaking") {
              provider.stopSpeech();
            }

            provider.setMuted(false);
            setIsMuted(false);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();

        // Only handle keyup in PTT mode
        if (!isHandsFree && pttKeyHeld.current) {
          pttKeyHeld.current = false;
          setIsHoldingPTT(false);
          const provider = getVoiceProvider();
          provider.setMuted(true);
          setIsMuted(true);
          setStatus("thinking");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isInCall, status, isHandsFree, isMuted]);

  const handleStartCall = useCallback(async () => {
    hapticImpact('medium'); // Tactile feedback on call start
    setError(null);
    setTranscript([]);
    setLiveTranscript(null);
    setAccumulatedPartial("");
    setPartialRole(null);
    setCollectedLinks([]);
    setStatus("connecting");
    
    const newCallId = `call-${Date.now()}`;
    setCallId(newCallId);

    try {
      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newCallId, startedAt: Date.now() }),
      });
    } catch (err) {
      console.error("Failed to create call record:", err);
    }

    // Set conversation mode for this voice call
    try {
      await fetch("/api/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          callId: newCallId, 
          mode: conversationMode,
          responseFormat,
          customPrompt: conversationMode === 'custom' ? customPrompt : undefined
        }),
      });
    } catch (err) {
      console.error("Failed to set call mode:", err);
    }

    const provider = getVoiceProvider();

    // Check current hands-free setting
    const handsFreeEnabled = localStorage.getItem('chief-hands-free-mode') === 'true';

    try {
      await provider.connect({}, {
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
          if (newStatus === "ended") {
            setVolumeLevel(0);
            setIsHoldingPTT(false);
            pttKeyHeld.current = false;
          }
          if (newStatus === "connected") {
            // In hands-free mode, keep mic open; in PTT mode, mute until spacebar held
            if (handsFreeEnabled) {
              provider.setMuted(false);
              setIsMuted(false);
            } else {
              provider.setMuted(true);
              setIsMuted(true);
            }
          }
        },
        onTranscript: (entry) => {
          if (entry.isFinal) {
            // Final transcript - save to history and reset accumulation
            setLiveTranscript(null);
            setAccumulatedPartial("");
            setPartialRole(null);
            setTranscript((prev) => [...prev, entry]);
            
            fetch("/api/calls", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: newCallId,
                action: "transcript",
                role: entry.role,
                text: entry.text,
                timestamp: entry.timestamp,
              }),
            }).catch(console.error);
          } else {
            // Partial transcript - accumulate text
            if (partialRole !== entry.role) {
              // Role changed - reset accumulation
              setAccumulatedPartial(entry.text);
              setPartialRole(entry.role);
            } else {
              // Same role - append text
              setAccumulatedPartial(prev => {
                const newText = prev ? `${prev} ${entry.text}` : entry.text;
                return newText;
              });
            }
            
            // Update live transcript with accumulated text
            setLiveTranscript({
              ...entry,
              text: accumulatedPartial ? `${accumulatedPartial} ${entry.text}` : entry.text
            });
          }
        },
        onError: (err) => {
          setError(err.message);
          console.error("Voice error:", err);
        },
        onVolumeLevel: (level) => {
          setVolumeLevel(level);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      setStatus("idle");
    }
  }, [conversationMode]);

  // Auto-start call when triggered by Siri Shortcut (chief://start)
  useEffect(() => {
    if (siriStartRequested && status === 'idle') {
      setSiriStartRequested(false);
      console.log("[Siri] Auto-starting hands-free call");
      // Small delay to ensure component is fully ready
      setTimeout(() => {
        handleStartCall();
      }, 300);
    }
  }, [siriStartRequested, status, handleStartCall]);

  const handleEndCall = useCallback(() => {
    hapticNotification('success'); // Tactile feedback on call end
    const provider = getVoiceProvider();
    provider.disconnect();
  }, []);

  // Ctrl+D / Cmd+D: Start or end a voice call
  useEffect(() => {
    const handleCallShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        if (isInCall) {
          handleEndCall();
        } else if (status === "idle" || status === "ended") {
          handleStartCall();
        }
      }
    };
    window.addEventListener("keydown", handleCallShortcut);
    return () => window.removeEventListener("keydown", handleCallShortcut);
  }, [isInCall, status, handleStartCall, handleEndCall]);

  const handlePTTStart = useCallback(() => {
    if (pttKeyHeld.current) return;
    pttKeyHeld.current = true;
    setIsHoldingPTT(true);
    hapticImpact('medium'); // Tactile feedback on press
    const provider = getVoiceProvider();
    if (status === "speaking") {
      provider.stopSpeech();
    }
    provider.setMuted(false);
    setIsMuted(false);
  }, [status]);

  const handlePTTEnd = useCallback(() => {
    if (!pttKeyHeld.current) return;
    pttKeyHeld.current = false;
    setIsHoldingPTT(false);
    hapticImpact('light'); // Lighter feedback on release
    const provider = getVoiceProvider();
    provider.setMuted(true);
    setIsMuted(true);
    setStatus("thinking");
  }, []);

  // Toggle mute in hands-free mode
  const handleHandsFreeMuteToggle = useCallback(() => {
    const provider = getVoiceProvider();
    const newMuted = !isMuted;
    provider.setMuted(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  // Handle text message sending (with optional image attachment)
  const handleSendTextMessage = useCallback(async (attachment?: AttachedFile) => {
    if ((!textInput.trim() && !attachment) || isTextStreaming) return;

    const messageText = textInput.trim();
    const hasImage = !!attachment;
    setTextInput('');
    setIsTextStreaming(true);
    setError(null);

    // Create call record if none exists
    let currentCallId = callId;
    if (!currentCallId) {
      currentCallId = `text-${Date.now()}`;
      setCallId(currentCallId);
      
      try {
        await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentCallId, startedAt: Date.now() }),
        });
      } catch (err) {
        console.error("Failed to create call record:", err);
      }
    }

    // Add user message to transcript immediately (with image indicator if present)
    const displayText = hasImage
      ? (messageText || "[Sent an image]") + (messageText ? " 📷" : "")
      : messageText;
    const userEntry: TranscriptEntry = {
      role: 'user',
      text: displayText,
      timestamp: Date.now(),
      isFinal: true
    };
    setTranscript(prev => [...prev, userEntry]);

    // Record user message in database
    try {
      await fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentCallId,
          action: "transcript",
          role: "user",
          text: messageText,
          timestamp: Date.now(),
        }),
      });
    } catch (err) {
      console.error("Failed to save user message:", err);
    }

    // Create abort controller for this request
    const controller = new AbortController();
    setTextStreamController(controller);

    try {
      // Choose API endpoint based on whether there's an image
      const apiUrl = hasImage ? "/api/vision/chat" : "/api/text/chat";
      const requestBody = hasImage
        ? {
            message: messageText || "What's in this image?",
            imageBase64: attachment.preview, // This includes the data URL prefix
          }
        : {
            message: messageText,
            callId: currentCallId,
            mode: conversationMode,
            responseFormat,
            customPrompt: conversationMode === 'custom' ? customPrompt : undefined
          };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response stream received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      const assistantTimestamp = Date.now(); // Use timestamp as unique ID
      let assistantEntryCreated = false;
      let buffer = ''; // Buffer for incomplete lines

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new data to buffer and split into lines
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'delta' && parsed.content) {
                  assistantText += parsed.content;

                  // Update or create assistant entry
                  if (!assistantEntryCreated) {
                    assistantEntryCreated = true;
                    setTranscript(prev => [...prev, {
                      role: 'assistant',
                      text: assistantText,
                      timestamp: assistantTimestamp,
                      isFinal: false
                    }]);
                  } else {
                    // Update by matching timestamp - create new object for React
                    setTranscript(prev => prev.map(entry =>
                      entry.timestamp === assistantTimestamp && entry.role === 'assistant'
                        ? { ...entry, text: assistantText }
                        : entry
                    ));
                  }
                } else if (parsed.type === 'complete') {
                  // Mark as final and save to database
                  console.log('[TextChat] Complete event received:', {
                    fullResponse: parsed.fullResponse?.substring(0, 100),
                    fullResponseLength: parsed.fullResponse?.length,
                    assistantTextLength: assistantText.length,
                    assistantTextPreview: assistantText.substring(0, 100)
                  });
                  const finalText = parsed.fullResponse || assistantText;
                  setTranscript(prev => prev.map(entry =>
                    entry.timestamp === assistantTimestamp && entry.role === 'assistant'
                      ? { ...entry, text: finalText, isFinal: true }
                      : entry
                  ));

                  // Save to database
                  try {
                    await fetch("/api/calls", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: currentCallId,
                        action: "transcript",
                        role: "assistant",
                        text: finalText,
                        timestamp: assistantTimestamp,
                      }),
                    });
                  } catch (err) {
                    console.error("Failed to save assistant message:", err);
                  }
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.content);
                }
              } catch (parseError) {
                // Only log if it's not an empty or whitespace line
                if (data.trim()) {
                  console.error("Failed to parse SSE data:", data, parseError);
                }
              }
            }
          }
        }

        // Process any remaining data in the buffer
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'complete') {
                const finalText = parsed.fullResponse || assistantText;
                setTranscript(prev => prev.map(entry =>
                  entry.timestamp === assistantTimestamp && entry.role === 'assistant'
                    ? { ...entry, text: finalText, isFinal: true }
                    : entry
                ));
              }
            } catch {
              // Ignore parse errors for leftover buffer
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log("Text stream aborted");
      } else {
        console.error("Text stream error:", err);
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
    } finally {
      setIsTextStreaming(false);
      setTextStreamController(null);
    }
  }, [textInput, isTextStreaming, callId, conversationMode]);

  // Handle input mode changes (defined after handleEndCall)
  const handleInputModeChange = useCallback((mode: 'voice' | 'text') => {
    // In voice-only mode, don't allow switching to text
    if (interfaceMode === 'voice-only' && mode === 'text') {
      return;
    }

    // When switching to text during a call, mute the mic but keep call active
    if (mode === 'text' && isInCall) {
      // Mute mic when switching to text mode during call
      // The call stays active so user can switch back
      setIsMuted(true);
    }

    // When switching back to voice during a call, unmute
    if (mode === 'voice' && isInCall) {
      setIsMuted(false);
    }

    // Cancel any text streaming when switching to voice mode
    if (mode === 'voice' && isTextStreaming && textStreamController) {
      textStreamController.abort();
    }

    setInputMode(mode);
    setTextInput(''); // Clear text input when switching modes
  }, [isInCall, isTextStreaming, textStreamController, interfaceMode]);

  // Main content component (used in both mobile and desktop layouts)
  const mainContent = (
    <main className="h-full min-h-[100dvh] flex flex-col overflow-hidden relative bg-[var(--background)]">
      {/* Header - minimal when idle, hidden during voice calls */}
      {!(inputMode === 'voice' && isInCall) && (
        <header className="px-5 pt-safe pb-2 relative z-10 mobile-only">
          {/* Top row - logo left, settings right */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6 text-[#c75b3a]"
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
              <h1 className="text-xl font-display text-[var(--secondary-text)]">
                {assistantName}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Voice/Text mode toggle - only show if not in voice-only mode */}
              {interfaceMode === 'voice-text' && (
                <div className="flex items-center bg-[var(--card-bg)] rounded-full p-1 border border-[var(--border-color)]">
                  <button
                    onClick={() => handleInputModeChange('voice')}
                    className={`p-2 rounded-full transition-all ${
                      inputMode === 'voice'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70'
                    }`}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleInputModeChange('text')}
                    className={`p-2 rounded-full transition-all ${
                      inputMode === 'text'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </div>
              )}
              {isTextStreaming && (
                <button
                  onClick={() => textStreamController?.abort()}
                  className="p-2 -m-2 text-[var(--accent)]/70 hover:text-[var(--accent)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setShowHistory(true)}
                className="p-2 -m-2 text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors"
              >
                <Clock className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 -m-2 text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
      )}


      {/* Browser compatibility warning */}
      {browserWarning && (
        <div className="mx-5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-fade-in-up">
          <div className="flex items-start justify-between gap-3">
            <p className="text-amber-700 text-sm">{browserWarning}</p>
            <button
              onClick={() => setBrowserWarning(null)}
              className="text-amber-700/60 hover:text-amber-700 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-5 px-4 py-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 animate-fade-in-up">
          <p className="text-[var(--accent)] text-sm">{error}</p>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Orb section - hero when idle (voice mode only) */}
        {inputMode === 'voice' && !isInCall && !isTextStreaming && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <VoiceOrb
              status={status}
              volumeLevel={volumeLevel}
              size="lg"
              effect={orbEffect}
            />
            <div className="mt-4">
              <StatusIndicator status={status} volumeLevel={volumeLevel} />
            </div>
          </div>
        )}

        {/* Text mode welcome - when no messages yet */}
        {inputMode === 'text' && transcript.length === 0 && !isTextStreaming && (
          <div className="flex-1 flex items-center justify-center py-4 min-h-0">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-[var(--foreground)]/20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-[var(--secondary-text)]/40 text-sm">Type a message to start</p>
            </div>
          </div>
        )}

        {/* Voice mode during active call - centered orb with end call button */}
        {inputMode === 'voice' && isInCall && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative">
            {/* Top bar - logo left, mode toggle right */}
            <div className="absolute top-0 pt-safe left-4 right-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
              {/* Brain logo */}
              <div>
              <svg
                className="w-6 h-6 text-[#c75b3a]"
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
              </div>

              {/* Mode toggle - only show if not in voice-only mode */}
              {interfaceMode === 'voice-text' && (
                <div className="flex items-center bg-[var(--card-bg)] rounded-full p-1 border border-[var(--border-color)]">
                  <button
                    onClick={() => handleInputModeChange('voice')}
                    className="p-2 rounded-full transition-all bg-[var(--accent)] text-white"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleInputModeChange('text')}
                    className="p-2 rounded-full transition-all text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <VoiceOrb
              status={status}
              volumeLevel={volumeLevel}
              size="lg"
              effect={orbEffect}
            />
            <div className="mt-4">
              <StatusIndicator status={status} volumeLevel={volumeLevel} />
            </div>
            {/* Real-time subtitle for assistant speech */}
            {showSubtitles && (
              <VoiceSubtitle
                text={
                  // Show live transcript if it's from assistant, otherwise latest assistant message (even when not actively speaking)
                  (() => {
                    const subtitleText = (liveTranscript?.role === 'assistant' ? liveTranscript.text : null) ||
                      transcript.filter(t => t.role === 'assistant').slice(-1)[0]?.text ||
                      '';
                    console.log('[Subtitle Debug]', {
                      showSubtitles,
                      status,
                      liveTranscript: liveTranscript ? { role: liveTranscript.role, text: liveTranscript.text?.substring(0, 30) } : null,
                      transcriptCount: transcript.length,
                      subtitleText: subtitleText.substring(0, 50)
                    });
                    return subtitleText;
                  })()
                }
                isLive={liveTranscript?.role === 'assistant' && !liveTranscript.isFinal}
                className="mt-16 max-w-md"
              />
            )}
          </div>
        )}

        {/* Text mode transcript - full bubble chat */}
        {inputMode === 'text' && (isTextStreaming || transcript.length > 0) && transcript.length > 0 && (
          <InlineTranscript
            entries={transcript}
            liveEntry={liveTranscript}
            status={isTextStreaming ? "thinking" : status}
            volumeLevel={volumeLevel}
            links={collectedLinks}
          />
        )}
      </div>

      {/* Bottom action area */}
      <div className="relative z-10 shrink-0">
        {/* Text input mode */}
        {inputMode === 'text' && (
          <>
            {/* Call active indicator when in text mode during a call */}
            {isInCall && (
              <div className="flex items-center justify-center gap-2 py-2 bg-[var(--accent)]/10 border-t border-[var(--border-color)]">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-xs text-[var(--accent)]">Voice call active (muted)</span>
                <button
                  onClick={() => handleInputModeChange('voice')}
                  className="text-xs text-[var(--accent)] underline ml-2"
                >
                  Return to call
                </button>
              </div>
            )}
            <TextInput
              value={textInput}
              onChange={setTextInput}
              onSend={handleSendTextMessage}
              disabled={isTextStreaming}
              placeholder={isTextStreaming ? "Sending..." : (isInCall ? "Type while on call..." : "Type your message...")}
            />
          </>
        )}

        {/* Voice mode controls */}
        {inputMode === 'voice' && (
          <>
            {/* Call button - idle state */}
            {!isInCall && (
              <div className="flex flex-col items-center gap-2 pt-4 pb-6 pb-safe-button">
                <button
                  onClick={handleStartCall}
                  className="
                    w-20 h-20 md:w-14 md:h-14 rounded-full
                    bg-gradient-to-b from-[#c75b3a] to-[#a04828]
                    shadow-[0_4px_16px_rgba(199,91,58,0.3)]
                    hover:shadow-[0_6px_24px_rgba(199,91,58,0.4)]
                    hover:scale-105
                    active:scale-95
                    transition-all duration-200
                    flex items-center justify-center
                  "
                >
                  <Phone className="w-7 h-7 md:w-5 md:h-5 text-white" />
                </button>
                <span className="text-[var(--secondary-text)]/40 text-xs">Tap to start</span>
              </div>
            )}

            {/* In-call controls */}
            {isInCall && (
              <div className="flex flex-col items-center gap-6 pb-4 pb-safe-button">
                {/* End call button */}
                <button
                  onClick={handleEndCall}
                  className="w-14 h-14 md:w-12 md:h-12 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center shadow-lg"
                >
                  <Phone className="w-6 h-6 md:w-5 md:h-5 text-white rotate-[135deg]" />
                </button>

                {/* Mic button */}
                {isHandsFree ? (
                  /* Hands-free mode: mute/unmute toggle button */
                  <button
                    onClick={handleHandsFreeMuteToggle}
                    className={`
                      relative w-24 h-24 md:w-16 md:h-16 rounded-full
                      transition-all duration-150 select-none
                      flex flex-col items-center justify-center
                      ${!isMuted
                        ? "bg-gradient-to-b from-[var(--accent)] to-[var(--accent-dark)] shadow-[0_8px_32px_rgba(199,91,58,0.4)]"
                        : "bg-[var(--card-bg)] border border-[var(--border-color)] shadow-[0_4px_16px_var(--shadow-color)]"
                      }
                    `}
                  >
                    {isMuted ? (
                      /* Muted icon - mic with slash */
                      <svg
                        className="w-10 h-10 md:w-6 md:h-6 text-[var(--accent)]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                      </svg>
                    ) : (
                      /* Unmuted icon - active mic */
                      <svg
                        className="w-10 h-10 md:w-6 md:h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    )}
                    <span className="text-[8px] md:text-[10px] mt-1 text-[var(--foreground)]/40">
                      {isMuted ? "Tap to unmute" : "Listening"}
                    </span>
                  </button>
                ) : (
                  /* PTT mode: hold-to-talk button */
                  <button
                    className={`
                      relative w-24 h-24 md:w-16 md:h-16 rounded-full
                      transition-all duration-150 select-none
                      flex flex-col items-center justify-center
                      ${isHoldingPTT
                        ? "bg-gradient-to-b from-[var(--accent)] to-[var(--accent-dark)] scale-110 shadow-[0_8px_32px_rgba(199,91,58,0.4)]"
                        : "bg-[var(--card-bg)] border border-[var(--border-color)] shadow-[0_4px_16px_var(--shadow-color)] animate-glow-pulse"
                      }
                    `}
                    onTouchStart={(e) => { e.preventDefault(); handlePTTStart(); }}
                    onTouchEnd={(e) => { e.preventDefault(); handlePTTEnd(); }}
                    onMouseDown={(e) => { if (e.button === 0) handlePTTStart(); }}
                    onMouseUp={handlePTTEnd}
                    onMouseLeave={handlePTTEnd}
                  >
                    <svg
                      className={`w-10 h-10 md:w-6 md:h-6 transition-colors ${isHoldingPTT ? "text-white" : "text-[var(--accent)]"}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    {!isHoldingPTT && (
                      <span className="text-[8px] md:text-[10px] mt-1 text-[var(--foreground)]/40">
                        Hold
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Wake word listener */}
      <WakeWordListener
        enabled={wakeWordEnabled}
        isInCall={isInCall}
        onWakeWord={handleStartCall}
      />

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* History drawer */}
      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </main>
  );

  return (
    <DesktopLayout 
      isInCall={isInCall}
      inputMode={inputMode}
      onInputModeChange={handleInputModeChange}
      isTextStreaming={isTextStreaming}
      onCancelTextStream={() => textStreamController?.abort()}
      onShowHistory={() => setShowHistory(true)}
    >
      {mainContent}
    </DesktopLayout>
  );
}
