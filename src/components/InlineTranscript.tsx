"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import type { TranscriptEntry } from "@/lib/voice/types";
import { cn } from "@/lib/utils";
import { ActivityIndicator } from "./ActivityIndicator";
import { RichText } from "./RichText";
import { CardsView } from "./Cards";
import { MessageBubble } from "./MessageBubble";
import { parseCards } from "@/lib/cards/parser";
import type { Card } from "@/lib/cards/types";

interface InlineTranscriptProps {
  entries: TranscriptEntry[];
  liveEntry?: TranscriptEntry | null;
  status: "idle" | "connecting" | "connected" | "listening" | "received" | "speaking" | "thinking" | "ended";
  volumeLevel?: number;
  links?: string[];
  onRegenerate?: (index: number) => void;
}

// URL regex pattern
const URL_PATTERN = /(\bhttps?:\/\/[^\s<>]+|\bwww\.[^\s<>]+)/gi;

// Convert numerals to words for cleaner transcript display
const NUMERAL_TO_WORD: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve',
};

function convertNumeralsToWords(text: string): string {
  // Replace numerals with words, capitalizing if at start of sentence
  let result = text.replace(/\b([0-9]|1[0-2])\b/g, (match) => {
    return NUMERAL_TO_WORD[match] || match;
  });
  
  // Capitalize first letter of text
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  
  // Capitalize after sentence endings (. ! ?)
  result = result.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => {
    return punct + letter.toUpperCase();
  });
  
  return result;
}

function TextWithLinks({ text }: { text: string }) {
  // Convert numerals to words first
  const processedText = convertNumeralsToWords(text);
  const parts = processedText.split(URL_PATTERN);
  
  return (
    <>
      {parts.map((part, i) => {
        if (URL_PATTERN.test(part)) {
          URL_PATTERN.lastIndex = 0;
          const href = part.startsWith('www.') ? `https://${part}` : part;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white underline underline-offset-2 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Extended entry type with parsed cards
interface ParsedEntry extends TranscriptEntry {
  cards?: Card[];
  cleanText?: string;
}

// Merge consecutive messages from the same speaker
function mergeConsecutiveEntries(entries: TranscriptEntry[]): ParsedEntry[] {
  if (entries.length === 0) return [];
  
  const merged: TranscriptEntry[] = [];
  let current = { ...entries[0] };
  
  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role === current.role) {
      current.text = current.text + " " + entry.text;
      current.timestamp = entry.timestamp;
    } else {
      merged.push(current);
      current = { ...entry };
    }
  }
  merged.push(current);
  
  // Parse cards from assistant messages
  return merged.map(entry => {
    if (entry.role === "assistant") {
      const parsed = parseCards(entry.text);
      return {
        ...entry,
        cleanText: parsed.text,
        cards: parsed.cards,
      };
    }
    return entry;
  });
}

export function InlineTranscript({ 
  entries, 
  liveEntry, 
  status, 
  links = [],
  onRegenerate 
}: InlineTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mergedEntries = useMemo(() => mergeConsecutiveEntries(entries), [entries]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mergedEntries, liveEntry]);

  const handleRegenerate = useCallback((index: number) => {
    onRegenerate?.(index);
  }, [onRegenerate]);

  if (entries.length === 0 && !liveEntry) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
    >
      {mergedEntries.map((entry, index) => {
        const isLastAssistant = 
          entry.role === "assistant" && 
          index === mergedEntries.length - 1;
        
        return (
          <MessageBubble
            key={index}
            role={entry.role}
            timestamp={entry.timestamp}
            onRegenerate={isLastAssistant ? () => handleRegenerate(index) : undefined}
            className="animate-fade-in-up"
            style={{ 
              animationDelay: `${index * 50}ms`,
            }}
          >
            {entry.role === "assistant" ? (
              <>
                <RichText text={convertNumeralsToWords(entry.cleanText || entry.text)} />
                {/* Render cards for assistant messages */}
                {entry.cards && entry.cards.length > 0 && (
                  <CardsView cards={entry.cards} />
                )}
              </>
            ) : (
              <TextWithLinks text={entry.text} />
            )}
          </MessageBubble>
        );
      })}

      {/* Live typing indicator */}
      {liveEntry && (
        <MessageBubble
          role={liveEntry.role}
          className="animate-fade-in-up"
        >
          <span className="text-[var(--foreground)]/60">
            <TextWithLinks text={liveEntry.text} />
            <span className="inline-block w-0.5 h-4 bg-[var(--accent)]/50 ml-0.5 animate-pulse align-middle" />
          </span>
        </MessageBubble>
      )}

      {/* Thinking indicator */}
      {status === "thinking" && !liveEntry && (
        <div className="pl-11">
          <ActivityIndicator isActive={true} />
        </div>
      )}
      
      {/* Collected links */}
      {links.length > 0 && (
        <div className="pl-11 pt-2">
          <div className="inline-flex flex-col gap-1 px-4 py-3 rounded-xl bg-[var(--cream)] border border-[var(--border-color)]">
            <span className="text-[10px] uppercase tracking-wider text-[var(--foreground)]/40 font-medium">
              Links
            </span>
            {links.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] underline underline-offset-2 break-all"
              >
                {url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
