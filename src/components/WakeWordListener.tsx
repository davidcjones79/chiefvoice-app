"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface WakeWordListenerProps {
  enabled: boolean;
  onWakeWord: () => void;
  isInCall: boolean;
}

// Inline wake word detection with visible transcript
const WAKE_PHRASES = [
  "hey chief", "okay chief", "ok chief", "chief",
  "hey rosie", "hey rosy", "hey rosi", "okay rosie", "ok rosie", "rosie"
];

export function WakeWordListener({ enabled, onWakeWord, isInCall }: WakeWordListenerProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Start/stop speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[WakeWord] Speech Recognition not supported");
      setSupported(false);
      setError("Speech Recognition not supported in this browser");
      return;
    }

    if (!enabled || isInCall || !permissionGranted) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // Create and start recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.log("[WakeWord] Started listening");
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      const lower = currentTranscript.toLowerCase().trim();
      setTranscript(lower);
      console.log("[WakeWord] Heard:", lower);

      // Check for wake phrase
      for (const phrase of WAKE_PHRASES) {
        if (lower.includes(phrase)) {
          console.log("[WakeWord] DETECTED:", phrase);
          recognition.stop();
          recognitionRef.current = null;
          setIsListening(false);
          setTranscript("");
          onWakeWord();
          return;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("[WakeWord] Error:", event.error);
      setError(event.error);
      if (event.error === "not-allowed") {
        setPermissionGranted(false);
      }
    };

    recognition.onend = () => {
      console.log("[WakeWord] Ended, restarting...");
      // Auto-restart if still enabled - create a FRESH instance since the old one
      // can become unrecoverable after multiple onend cycles
      if (enabled && !isInCall && permissionGranted && recognitionRef.current) {
        setTimeout(() => {
          try {
            const fresh = new SpeechRecognition();
            fresh.continuous = true;
            fresh.interimResults = true;
            fresh.lang = "en-US";
            fresh.onstart = recognition.onstart;
            fresh.onresult = recognition.onresult;
            fresh.onerror = recognition.onerror;
            fresh.onend = recognition.onend;
            recognitionRef.current = fresh;
            fresh.start();
            console.log("[WakeWord] Restarted with fresh instance");
          } catch (e) {
            console.error("[WakeWord] Restart failed:", e);
          }
        }, 300);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("[WakeWord] Start failed:", e);
      setError("Failed to start");
    }

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled, isInCall, permissionGranted, onWakeWord]);

  // Request microphone permission
  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Release immediately
      setPermissionGranted(true);
    } catch (err) {
      console.error("[WakeWordListener] Permission denied:", err);
      setPermissionGranted(false);
    }
  };

  if (!supported) {
    return null; // Don't show anything if not supported
  }

  if (!permissionGranted && enabled && !isInCall) {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <p className="text-white/50 text-sm text-center">
          Enable "Hey Chief" wake word?
        </p>
        <button
          onClick={requestPermission}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-full text-sm font-medium transition-colors"
        >
          Enable Wake Word
        </button>
      </div>
    );
  }

  if (!enabled || isInCall) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      {/* Wake word indicator */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
        isListening 
          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
          : "bg-white/5 text-white/30"
      )}>
        {/* Animated listening indicator */}
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 bg-current rounded-full",
                isListening ? "animate-bounce" : ""
              )}
              style={{
                height: isListening ? "12px" : "4px",
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
        <span className="text-sm font-medium">
          {isListening ? '🎤 Say "Hey Chief"' : "Wake word paused"}
        </span>
      </div>

      {/* Show what it's hearing (always visible when listening) */}
      {isListening && (
        <div className="text-xs text-white/50 max-w-[280px] text-center">
          {transcript ? (
            <span className="text-green-400">Hearing: "{transcript}"</span>
          ) : (
            <span className="text-white/30 animate-pulse">Listening for speech...</span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-400">
          Error: {error}
        </div>
      )}

      {/* Debug status */}
      <div className="text-[10px] text-white/20 mt-1">
        Status: {isListening ? "🟢 Active" : "⚪ Inactive"} | 
        Permission: {permissionGranted ? "✅" : "❌"} |
        Supported: {supported ? "✅" : "❌"}
      </div>
    </div>
  );
}
