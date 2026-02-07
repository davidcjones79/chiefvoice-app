"use client";

import { cn } from "@/lib/utils";
import type { CallStatus } from "@/lib/voice/types";

interface AvatarProps {
  name?: string;
  imageUrl?: string;
  status: CallStatus;
  volumeLevel?: number;
  size?: "xs" | "sm" | "md" | "lg";
  showActivityRings?: boolean;
}

const sizeClasses = {
  xs: "h-10 w-10",
  sm: "h-20 w-20",
  md: "h-32 w-32",
  lg: "h-40 w-40",
};

const textSizeClasses = {
  xs: "text-base",
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-4xl",
};

export function Avatar({
  name = "Assistant",
  imageUrl,
  status,
  volumeLevel = 0,
  size = "lg",
  showActivityRings = true,
}: AvatarProps) {
  const isActive = status === "speaking" || status === "listening" || status === "connected";
  const isSpeaking = status === "speaking";
  
  // Calculate ring animation based on volume
  const ringScale = isSpeaking ? 1 + volumeLevel * 0.15 : 1;
  const ringOpacity = isSpeaking ? 0.3 + volumeLevel * 0.4 : 0;

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer animated ring - only show if showActivityRings is true */}
      {showActivityRings && (
        <div
          className={cn(
            "absolute rounded-full bg-white/20 transition-all duration-150",
            sizeClasses[size]
          )}
          style={{
            transform: `scale(${ringScale + 0.1})`,
            opacity: ringOpacity * 0.5,
          }}
        />
      )}
      
      {/* Inner animated ring - only show if showActivityRings is true */}
      {showActivityRings && (
        <div
          className={cn(
            "absolute rounded-full bg-white/30 transition-all duration-100",
            sizeClasses[size]
          )}
          style={{
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
          }}
        />
      )}

      {/* Main avatar container */}
      <div
        className={cn(
          "relative rounded-full border-4 transition-all duration-300 overflow-hidden",
          sizeClasses[size],
          isActive ? "border-white/60" : "border-white/20",
          status === "connecting" && "animate-pulse"
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className={cn("font-bold text-white", textSizeClasses[size])}>
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Status indicator dot */}
      {status !== "idle" && status !== "ended" && (
        <div
          className={cn(
            "absolute rounded-full border-2 border-black",
            size === "xs" ? "-bottom-0.5 -right-0.5 h-3 w-3" : "-bottom-1 -right-1 h-5 w-5",
            status === "connecting" && "bg-yellow-500",
            status === "connected" && "bg-green-500",
            status === "listening" && "bg-green-500 animate-pulse",
            status === "speaking" && "bg-blue-500",
            status === "thinking" && "bg-purple-500 animate-pulse"
          )}
        />
      )}
    </div>
  );
}
