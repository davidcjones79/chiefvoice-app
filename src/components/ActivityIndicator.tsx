"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/lib/activity-stream";

interface ActivityIndicatorProps {
  isActive: boolean;
}

// Brain outline SVG icon
function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
  );
}

const FALLBACK_MESSAGES = [
  { message: "Thinking", delay: 0 },
  { message: "Processing", delay: 3000 },
  { message: "Working on it", delay: 6000 },
  { message: "Almost there", delay: 10000 },
];

export function ActivityIndicator({ isActive }: ActivityIndicatorProps) {
  const [activity, setActivity] = useState<ActivityEvent | null>(null);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isActive) {
      setActivity(null);
      setFallbackIndex(0);
      return;
    }

    const eventSource = new EventSource("/api/activity");
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "connected" && data.message) {
          setActivity(data);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    return () => eventSource.close();
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const timers = FALLBACK_MESSAGES.map((msg, index) => 
      setTimeout(() => setFallbackIndex(index), msg.delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 400);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const currentMessage = activity?.message || FALLBACK_MESSAGES[fallbackIndex]?.message || "Thinking";

  return (
    <div className="flex items-center gap-2 animate-fade-in-up">
      {/* Brain icon */}
      <BrainIcon className="w-4 h-4 text-[#9a7b6b] animate-pulse" />
      
      <span className="text-sm text-[#9a7b6b]">
        {currentMessage.replace(/\.+$/, "")}{dots}
      </span>

      {activity?.detail && (
        <span className="text-xs text-[#9a7b6b]/60 max-w-[150px] truncate">
          · {activity.detail}
        </span>
      )}
    </div>
  );
}
