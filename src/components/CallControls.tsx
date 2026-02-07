"use client";

import { Button } from "@/components/ui/button";
import type { CallStatus } from "@/lib/voice/types";
import { Phone, PhoneOff, Mic, MicOff, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleChat: () => void;
  showChatToggle?: boolean;
}

export function CallControls({
  status,
  isMuted,
  onStartCall,
  onEndCall,
  onToggleMute,
  onToggleChat,
  showChatToggle = true,
}: CallControlsProps) {
  const isInCall = status !== "idle" && status !== "ended";
  const canStartCall = status === "idle" || status === "ended";

  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute button - only show during call */}
      {isInCall && (
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleMute}
          className={cn(
            "h-12 w-12",
            isMuted && "bg-red-500/20 border-red-500/50 text-red-400"
          )}
        >
          {isMuted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Main call button */}
      {canStartCall ? (
        <Button
          variant="call"
          size="lg"
          onClick={onStartCall}
          className="h-16 w-16"
        >
          <Phone className="h-7 w-7" />
        </Button>
      ) : (
        <Button
          variant="endCall"
          size="lg"
          onClick={onEndCall}
          className="h-16 w-16"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      )}

      {/* Chat toggle - only show when not in call */}
      {showChatToggle && !isInCall && (
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleChat}
          className="h-12 w-12"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}

      {/* Spacer to balance layout during call */}
      {isInCall && showChatToggle && (
        <div className="h-12 w-12" />
      )}
    </div>
  );
}
