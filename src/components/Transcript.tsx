"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/voice/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TranscriptProps {
  entries: TranscriptEntry[];
  liveEntry?: TranscriptEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

// URL regex pattern - matches http, https, and www URLs
const URL_PATTERN = /(\bhttps?:\/\/[^\s<>]+|\bwww\.[^\s<>]+)/gi;

// Parse text and convert URLs to clickable links
function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  
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
              className="text-blue-300 hover:text-blue-200 underline underline-offset-2 break-all"
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

export function Transcript({ entries, liveEntry, isOpen, onClose }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black/95 backdrop-blur-lg border-t border-white/10 rounded-t-3xl max-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Transcript</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Transcript content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {entries.length === 0 && !liveEntry ? (
          <p className="text-white/40 text-center py-8">
            Transcript will appear here during the call...
          </p>
        ) : (
          <>
            {entries.map((entry, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  entry.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    entry.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-white"
                  )}
                >
                  <p className="text-xs whitespace-pre-wrap"><TextWithLinks text={entry.text} /></p>
                  <p className="text-xs opacity-50 mt-1">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {/* Live typing indicator */}
            {liveEntry && (
              <div
                className={cn(
                  "flex",
                  liveEntry.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 opacity-70",
                    liveEntry.role === "user"
                      ? "bg-blue-600/70 text-white"
                      : "bg-white/5 text-white"
                  )}
                >
                  <p className="text-xs whitespace-pre-wrap"><TextWithLinks text={liveEntry.text} /><span className="animate-pulse">▊</span></p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
