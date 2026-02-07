"use client";

import { cn } from "@/lib/utils";
import type { CallStatus as CallStatusType } from "@/lib/voice/types";
import { Phone, PhoneOff, Loader2, Mic, Volume2, Brain } from "lucide-react";

interface CallStatusProps {
  status: CallStatusType;
}

const statusConfig: Record<CallStatusType, {
  label: string;
  icon: typeof Phone;
  className: string;
}> = {
  idle: {
    label: "Ready",
    icon: Phone,
    className: "bg-white/10 text-white/60",
  },
  connecting: {
    label: "Connecting...",
    icon: Loader2,
    className: "bg-yellow-500/20 text-yellow-400",
  },
  connected: {
    label: "Connected",
    icon: Phone,
    className: "bg-green-500/20 text-green-400",
  },
  listening: {
    label: "Listening...",
    icon: Mic,
    className: "bg-green-500/20 text-green-400",
  },
  received: {
    label: "Got it!",
    icon: Mic,
    className: "bg-green-500/30 text-green-300",
  },
  speaking: {
    label: "Speaking...",
    icon: Volume2,
    className: "bg-blue-500/20 text-blue-400",
  },
  thinking: {
    label: "Thinking...",
    icon: Brain,
    className: "bg-purple-500/20 text-purple-400",
  },
  ended: {
    label: "Call Ended",
    icon: PhoneOff,
    className: "bg-white/10 text-white/60",
  },
};

export function CallStatus({ status }: CallStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === "connecting" || status === "thinking";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
        config.className
      )}
    >
      <Icon
        className={cn("h-4 w-4", isAnimated && "animate-spin")}
      />
      <span>{config.label}</span>
    </div>
  );
}
