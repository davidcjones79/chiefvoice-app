"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface VoiceSubtitleProps {
  text: string;
  isLive?: boolean;
  className?: string;
}

// Extract last N sentences from text, breaking at sentence boundaries
function getLastSentences(text: string, maxSentences: number = 2): string {
  if (!text) return "";

  // Split by sentence-ending punctuation, keeping the punctuation
  const sentencePattern = /([.!?]+\s*)/g;
  const parts = text.split(sentencePattern).filter(Boolean);

  // Reconstruct sentences (pair text with following punctuation)
  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i] + (parts[i + 1] || "");
    if (sentence.trim()) {
      sentences.push(sentence.trim());
    }
  }

  // If no sentence breaks found, treat as single incomplete sentence
  if (sentences.length === 0) {
    // For long text without sentence breaks, show last ~80 chars at word boundary
    if (text.length > 80) {
      const truncated = text.slice(-80);
      const wordBoundary = truncated.indexOf(" ");
      return wordBoundary > 0 ? truncated.slice(wordBoundary + 1) : truncated;
    }
    return text;
  }

  // Return last N sentences
  return sentences.slice(-maxSentences).join(" ");
}

export function VoiceSubtitle({ text, isLive = false, className }: VoiceSubtitleProps) {
  const [displayText, setDisplayText] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const prevTextRef = useRef("");
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process text to get last sentences
  const processedText = useMemo(() => getLastSentences(text, 2), [text]);

  // Debug logging
  useEffect(() => {
    console.log('[VoiceSubtitle] Props:', { text: text.substring(0, 50), isLive, processedText: processedText.substring(0, 50) });
  }, [text, isLive, processedText]);

  useEffect(() => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (processedText) {
      // Show text (new or same)
      setDisplayText(processedText);
      setIsVisible(true);
      prevTextRef.current = processedText;
    } else if (!processedText && prevTextRef.current) {
      // Text cleared - fade out after brief delay
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        // Clear display text after fade animation
        setTimeout(() => {
          setDisplayText("");
          prevTextRef.current = "";
        }, 300);
      }, 500);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [processedText]);

  // Don't render anything if no text
  if (!displayText) return null;

  return (
    <div className={cn(
      "flex justify-center transition-all duration-300",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      className
    )}>
      <div className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl",
        "bg-black/70 dark:bg-black/80 backdrop-blur-sm",
        "shadow-lg shadow-black/20",
        "max-w-sm"
      )}>
        <p 
          className={cn(
            "text-sm leading-relaxed text-white/95 text-center",
            "font-medium tracking-wide",
            isLive && "text-white/80"
          )}
          style={{ 
            wordSpacing: 'normal',
            whiteSpace: 'normal',
            letterSpacing: 'normal'
          }}
        >
          {displayText}
          {isLive && (
            <span
              className="inline-block w-0.5 h-3.5 bg-white/60 ml-1 animate-pulse align-middle rounded-full"
            />
          )}
        </p>
      </div>
    </div>
  );
}
