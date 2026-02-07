"use client";

import { useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check, RefreshCw } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
  timestamp?: number;
  onRegenerate?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function MessageBubble({ 
  role, 
  children, 
  timestamp,
  onRegenerate,
  className,
  style
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isUser = role === "user";

  const handleCopy = useCallback(async () => {
    const textContent = extractTextContent(children);
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [children]);

  return (
    <div
      className={cn("group relative", className)}
      style={style}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Compact layout - no avatars, minimal chrome */}
      <div className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}>
        <div className={cn(
          "relative max-w-[90%] rounded-2xl px-3 py-2",
          "text-sm leading-relaxed",
          isUser
            ? "bg-[var(--accent)] text-white/95 rounded-br-sm"
            : "bg-[var(--cream)] text-[var(--foreground)] rounded-bl-sm border border-[var(--border-color-light)]"
        )}>
          {children}

          {/* Hover actions - compact, inline */}
          <div className={cn(
            "absolute -bottom-6 flex items-center gap-0.5 transition-all duration-150",
            isUser ? "right-0" : "left-0",
            showActions ? "opacity-100" : "opacity-0 pointer-events-none",
            "hidden md:flex"
          )}>
            <button
              onClick={handleCopy}
              className="p-1 rounded text-[var(--foreground)]/30 hover:text-[var(--foreground)]/60"
              title="Copy"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
            {!isUser && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1 rounded text-[var(--foreground)]/30 hover:text-[var(--foreground)]/60"
                title="Regenerate"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function extractTextContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!children) return "";
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (typeof children === "object" && "props" in children) {
    const props = children.props as { children?: ReactNode };
    if (props.children) return extractTextContent(props.children);
  }
  return "";
}
