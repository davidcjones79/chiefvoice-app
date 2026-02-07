"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CallStatus } from "@/lib/voice/types";

export type OrbEffect = "none" | "rings" | "glow" | "aurora";

export const ORB_EFFECTS: { value: OrbEffect; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No extra effects" },
  { value: "rings", label: "Rings", description: "Pulsing concentric rings" },
  { value: "glow", label: "Glow", description: "Soft layered halos" },
  { value: "aurora", label: "Aurora", description: "Rotating gradients" },
];

interface VoiceOrbProps {
  status: CallStatus;
  volumeLevel?: number;
  size?: "sm" | "md" | "lg" | "xl";
  effect?: OrbEffect;
}

// Desktop sizes (smaller)
const sizeConfig = {
  sm: { orb: 56, glow: 84 },
  md: { orb: 80, glow: 120 },
  lg: { orb: 120, glow: 180 },
  xl: { orb: 160, glow: 240 },
};

// Mobile sizes (larger for touch)
const mobileSizeConfig = {
  sm: { orb: 72, glow: 108 },
  md: { orb: 100, glow: 150 },
  lg: { orb: 150, glow: 220 },
  xl: { orb: 180, glow: 270 },
};

export function VoiceOrb({ status, volumeLevel = 0, size = "lg", effect = "glow" }: VoiceOrbProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const config = isMobile ? mobileSizeConfig[size] : sizeConfig[size];
  const [pulsePhase, setPulsePhase] = useState(0);
  
  // Organic pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Status-based colors - warm palette
  const colors = useMemo(() => {
    switch (status) {
      case "connecting":
        return {
          primary: "#f59e0b",
          secondary: "#d97706",
          glow: "rgba(245, 158, 11, 0.3)",
          text: "#92400e",
        };
      case "connected":
      case "listening":
        return {
          primary: "#c75b3a",
          secondary: "#a04828",
          glow: "rgba(199, 91, 58, 0.3)",
          text: "#7c2d12",
        };
      case "speaking":
        return {
          primary: "#d97706",
          secondary: "#b45309",
          glow: "rgba(217, 119, 6, 0.3)",
          text: "#92400e",
        };
      case "received":
        return {
          primary: "#22c55e",  // Green flash - "Got it!"
          secondary: "#16a34a",
          glow: "rgba(34, 197, 94, 0.5)",
          text: "#15803d",
        };
      case "thinking":
        return {
          primary: "#9a7b6b",
          secondary: "#7a5f51",
          glow: "rgba(154, 123, 107, 0.3)",
          text: "#6b5344",
        };
      default:
        return {
          primary: "#d4c4b0",
          secondary: "#c4b49a",
          glow: "rgba(212, 196, 176, 0.3)",
          text: "#78716c",
        };
    }
  }, [status]);

  const isActive = ["connected", "listening", "received", "speaking", "thinking"].includes(status);
  const isListening = status === "listening";
  const isSpeaking = status === "speaking";
  const isThinking = status === "thinking";
  
  // Calculate organic movement
  const breatheScale = 1 + Math.sin(pulsePhase * Math.PI / 180) * 0.02;
  const volumeScale = isSpeaking ? 1 + volumeLevel * 0.15 : 1;
  const listeningPulse = isListening ? 1 + Math.sin(pulsePhase * 3 * Math.PI / 180) * 0.03 : 1;
  const combinedScale = breatheScale * volumeScale * listeningPulse;

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: config.glow, height: config.glow }}
    >
      {/* Effect: None - just basic ambient glow */}
      {effect === "none" && (
        <div
          className={cn(
            "absolute rounded-full transition-all duration-700",
            isActive ? "opacity-100" : "opacity-0"
          )}
          style={{
            width: config.glow,
            height: config.glow,
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            transform: `scale(${isSpeaking ? 1 + volumeLevel * 0.2 : 1})`,
          }}
        />
      )}

      {/* Effect: Rings - pulsing concentric rings that ripple outward */}
      {effect === "rings" && isActive && (
        <>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: config.orb,
                height: config.orb,
                border: `2px solid ${colors.primary}`,
                opacity: 0.6 - i * 0.15,
                transform: `scale(${1.2 + i * 0.3 + Math.sin((pulsePhase + i * 40) * Math.PI / 180) * 0.15 + (isSpeaking ? volumeLevel * 0.2 : 0)})`,
                transition: 'transform 0.15s ease-out',
              }}
            />
          ))}
          {/* Expanding ripple rings */}
          <div
            className="absolute rounded-full animate-ping-slow"
            style={{
              width: config.orb * 1.1,
              height: config.orb * 1.1,
              border: `1px solid ${colors.primary}`,
              opacity: 0.4,
            }}
          />
          <div
            className="absolute rounded-full animate-ping-slower"
            style={{
              width: config.orb * 1.1,
              height: config.orb * 1.1,
              border: `1px solid ${colors.primary}`,
              opacity: 0.3,
            }}
          />
        </>
      )}

      {/* Effect: Glow - multiple layered soft blur halos */}
      {effect === "glow" && (
        <>
          {/* Outer soft halo */}
          <div
            className={cn(
              "absolute rounded-full transition-all duration-500",
              isActive ? "opacity-100" : "opacity-0"
            )}
            style={{
              width: config.glow * 1.2,
              height: config.glow * 1.2,
              background: `radial-gradient(circle, ${colors.glow.replace('0.3', '0.15')} 0%, transparent 60%)`,
              transform: `scale(${1 + Math.sin((pulsePhase * 0.5) * Math.PI / 180) * 0.08 + (isSpeaking ? volumeLevel * 0.15 : 0)})`,
              filter: 'blur(8px)',
            }}
          />
          {/* Middle glow layer */}
          <div
            className={cn(
              "absolute rounded-full transition-all duration-300",
              isActive ? "opacity-100" : "opacity-0"
            )}
            style={{
              width: config.glow,
              height: config.glow,
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
              transform: `scale(${1 + Math.sin((pulsePhase * 0.8) * Math.PI / 180) * 0.05 + (isSpeaking ? volumeLevel * 0.2 : 0)})`,
              filter: 'blur(4px)',
            }}
          />
          {/* Inner intense glow */}
          <div
            className={cn(
              "absolute rounded-full transition-all duration-200",
              isActive ? "opacity-100" : "opacity-30"
            )}
            style={{
              width: config.orb * 1.3,
              height: config.orb * 1.3,
              background: `radial-gradient(circle, ${colors.glow.replace('0.3', '0.5')} 0%, transparent 70%)`,
              transform: `scale(${1 + Math.sin(pulsePhase * Math.PI / 180) * 0.03 + (isSpeaking ? volumeLevel * 0.25 : 0)})`,
            }}
          />
        </>
      )}

      {/* Effect: Aurora - rotating gradient with color shifts */}
      {effect === "aurora" && isActive && (
        <>
          {/* Rotating outer aurora */}
          <div
            className="absolute rounded-full"
            style={{
              width: config.glow * 1.1,
              height: config.glow * 1.1,
              background: `conic-gradient(from ${pulsePhase}deg,
                ${colors.primary}00,
                ${colors.primary}40,
                ${colors.secondary}60,
                ${colors.primary}40,
                ${colors.primary}00)`,
              filter: 'blur(12px)',
              transform: `scale(${1 + (isSpeaking ? volumeLevel * 0.2 : 0)})`,
            }}
          />
          {/* Counter-rotating inner aurora */}
          <div
            className="absolute rounded-full"
            style={{
              width: config.glow * 0.9,
              height: config.glow * 0.9,
              background: `conic-gradient(from ${-pulsePhase * 1.5}deg,
                ${colors.secondary}00,
                ${colors.glow.replace('0.3', '0.6')},
                ${colors.primary}50,
                ${colors.glow.replace('0.3', '0.6')},
                ${colors.secondary}00)`,
              filter: 'blur(8px)',
              transform: `scale(${1 + Math.sin(pulsePhase * Math.PI / 180) * 0.05 + (isSpeaking ? volumeLevel * 0.15 : 0)})`,
            }}
          />
          {/* Pulsing core glow */}
          <div
            className="absolute rounded-full"
            style={{
              width: config.orb * 1.4,
              height: config.orb * 1.4,
              background: `radial-gradient(circle, ${colors.glow.replace('0.3', '0.4')} 0%, transparent 60%)`,
              transform: `scale(${1 + Math.sin(pulsePhase * 2 * Math.PI / 180) * 0.08})`,
            }}
          />
        </>
      )}

      {/* Thinking state: rotating rings */}
      {isThinking && (
        <>
          <div
            className="absolute rounded-full border border-[var(--secondary-text)]/40 animate-spin-slow"
            style={{
              width: config.orb * 1.4,
              height: config.orb * 1.4,
            }}
          />
          <div
            className="absolute rounded-full border border-[var(--secondary-text)]/20 animate-spin-slow"
            style={{
              width: config.orb * 1.6,
              height: config.orb * 1.6,
              animationDirection: 'reverse',
              animationDuration: '12s',
            }}
          />
        </>
      )}

      {/* Main orb */}
      <div
        className={cn(
          "relative rounded-full transition-transform duration-150 shadow-lg",
          status === "connecting" && "animate-pulse"
        )}
        style={{
          width: config.orb,
          height: config.orb,
          background: `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.secondary})`,
          boxShadow: `
            0 8px 32px ${colors.glow},
            inset 0 2px 4px rgba(255, 255, 255, 0.3)
          `,
          transform: `scale(${combinedScale})`,
        }}
      >
        {/* Inner highlight */}
        <div 
          className="absolute rounded-full"
          style={{
            top: '10%',
            left: '15%',
            width: '35%',
            height: '35%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)',
            filter: 'blur(4px)',
          }}
        />

        {/* Listening: subtle sound wave visualization */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white/70 rounded-full transition-all duration-100"
                  style={{
                    width: 3,
                    height: 8 + Math.sin((pulsePhase + i * 30) * Math.PI / 180) * 12,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Speaking: volume-reactive bars */}
        {isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => {
                const barHeight = 6 + volumeLevel * 24 * (1 - Math.abs(i - 2) / 3);
                return (
                  <div
                    key={i}
                    className="bg-white/80 rounded-full transition-all duration-75"
                    style={{
                      width: 3,
                      height: barHeight,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Thinking: brain icon - pulses */}
        {isThinking && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white/90 animate-pulse"
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
        )}

        {/* Idle: mic icon */}
        {(status === "idle" || status === "ended") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-white/60" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" 
              />
            </svg>
          </div>
        )}
      </div>

    </div>
  );
}
