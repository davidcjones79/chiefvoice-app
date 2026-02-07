"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CallStatus } from "@/lib/voice/types";

type StatusType = CallStatus | "streaming" | "error" | "ready";

interface StatusIndicatorProps {
  status: StatusType;
  volumeLevel?: number;
  isTextMode?: boolean;
  className?: string;
}

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
  icon: "dot" | "pulse" | "wave" | "check" | "dots" | "bars" | "error";
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  idle: {
    label: "Ready",
    bgColor: "bg-[var(--foreground)]/10",
    textColor: "text-[var(--secondary-text)]/70",
    icon: "dot",
  },
  ready: {
    label: "Ready",
    bgColor: "bg-[var(--foreground)]/10",
    textColor: "text-[var(--secondary-text)]/70",
    icon: "dot",
  },
  connecting: {
    label: "Connecting",
    bgColor: "bg-[var(--accent)]/20",
    textColor: "text-[var(--accent)]",
    icon: "pulse",
  },
  connected: {
    label: "Connected",
    bgColor: "bg-[var(--accent)]/20",
    textColor: "text-[var(--accent)]",
    icon: "dot",
  },
  listening: {
    label: "Listening",
    bgColor: "bg-[var(--accent)]",
    textColor: "text-white",
    icon: "wave",
  },
  received: {
    label: "Got it",
    bgColor: "bg-green-500",
    textColor: "text-white",
    icon: "check",
  },
  thinking: {
    label: "Thinking",
    bgColor: "bg-[var(--secondary-text)]/70",
    textColor: "text-white",
    icon: "dots",
  },
  speaking: {
    label: "Speaking",
    bgColor: "bg-[var(--accent)]/80",
    textColor: "text-white",
    icon: "bars",
  },
  streaming: {
    label: "Typing",
    bgColor: "bg-[#3a86ff]/80",
    textColor: "text-white",
    icon: "dots",
  },
  ended: {
    label: "Ended",
    bgColor: "bg-[var(--foreground)]/10",
    textColor: "text-[var(--secondary-text)]/50",
    icon: "dot",
  },
  error: {
    label: "Error",
    bgColor: "bg-[#dc5858]/80",
    textColor: "text-white",
    icon: "error",
  },
};

// Dot icon - static indicator
function DotIcon({ className }: { className?: string }) {
  return (
    <span className={cn("w-2.5 h-2.5 rounded-full bg-current", className)} />
  );
}

// Pulse icon - connecting animation
function PulseIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative w-2.5 h-2.5", className)}>
      <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-75" />
      <span className="relative w-2.5 h-2.5 rounded-full bg-current block" />
    </span>
  );
}

// Check icon - received confirmation
function CheckIcon({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center justify-center", className)}>
      <svg className="w-5 h-5 animate-scale-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

// Wave icon - listening animation
function WaveIcon({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-[3px]", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[4px] rounded-full bg-current animate-wave"
          style={{
            height: "16px",
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </span>
  );
}

// Dots icon - thinking/typing animation
function DotsIcon({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rounded-full bg-current animate-bounce-dot"
          style={{
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
    </span>
  );
}

// Bars icon - speaking animation (volume reactive)
function BarsIcon({ volumeLevel = 0, className }: { volumeLevel?: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-[3px]", className)}>
      {[0, 1, 2, 3, 4].map((i) => {
        const baseHeight = 6;
        const maxHeight = 18;
        const centerBias = 1 - Math.abs(i - 2) / 2;
        const height = baseHeight + volumeLevel * (maxHeight - baseHeight) * centerBias;

        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-current transition-all duration-75"
            style={{
              height: `${height}px`,
            }}
          />
        );
      })}
    </span>
  );
}

// Error icon
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-4 h-4", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

export function StatusIndicator({ 
  status, 
  volumeLevel = 0, 
  isTextMode = false,
  className 
}: StatusIndicatorProps) {
  const config = useMemo(() => {
    // Map text streaming to "streaming" status
    if (isTextMode && status === "thinking") {
      return statusConfigs.streaming;
    }
    return statusConfigs[status] || statusConfigs.idle;
  }, [status, isTextMode]);

  const IconComponent = useMemo(() => {
    switch (config.icon) {
      case "pulse":
        return <PulseIcon />;
      case "wave":
        return <WaveIcon />;
      case "check":
        return <CheckIcon />;
      case "dots":
        return <DotsIcon />;
      case "bars":
        return <BarsIcon volumeLevel={volumeLevel} />;
      case "error":
        return <ErrorIcon />;
      default:
        return <DotIcon />;
    }
  }, [config.icon, volumeLevel]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full",
        "transition-all duration-300 ease-out",
        "text-lg sm:text-base font-semibold tracking-tight",
        "shadow-sm",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {IconComponent}
      <span>{config.label}</span>
    </div>
  );
}
