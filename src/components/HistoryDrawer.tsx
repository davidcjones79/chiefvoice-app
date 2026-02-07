"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Phone, Clock, ChevronRight, ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Call {
  id: string;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
}

interface Transcript {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryDrawer({ isOpen, onClose }: HistoryDrawerProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/calls");
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (error) {
      console.error("Failed to fetch calls:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCalls();
      setSelectedCall(null);
      setTranscripts([]);
    }
  }, [isOpen, fetchCalls]);

  const fetchTranscripts = async (callId: string) => {
    try {
      const res = await fetch(`/api/calls/${callId}`);
      const data = await res.json();
      setTranscripts(data.transcripts || []);
      setSelectedCall(callId);
    } catch (error) {
      console.error("Failed to fetch transcripts:", error);
    }
  };

  const deleteCallRecord = async (callId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;

    try {
      await fetch(`/api/calls/${callId}`, { method: "DELETE" });
      setCalls((prev) => prev.filter((c) => c.id !== callId));
      if (selectedCall === callId) {
        setSelectedCall(null);
        setTranscripts([]);
      }
    } catch (error) {
      console.error("Failed to delete call:", error);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) {
      return `Today ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const selectedCallData = calls.find((c) => c.id === selectedCall);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 mobile-only">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--overlay-bg)] animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[var(--background)] shadow-xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pt-safe border-b border-[var(--border-color)] shrink-0">
          {selectedCall ? (
            <>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-2 -m-2 text-[var(--secondary-text)]/60 hover:text-[var(--secondary-text)] transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 ml-3">
                <h2 className="text-lg font-display text-[var(--secondary-text)]">
                  Conversation
                </h2>
                {selectedCallData && (
                  <p className="text-xs text-[var(--secondary-text)]/50">
                    {formatDate(selectedCallData.started_at)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <h2 className="text-lg font-display text-[var(--secondary-text)]">
              History
            </h2>
          )}
          <button
            onClick={onClose}
            className="p-2 -m-2 text-[var(--secondary-text)]/40 hover:text-[var(--secondary-text)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedCall ? (
            /* Transcript view */
            <div className="p-4 space-y-4">
              {transcripts.length === 0 ? (
                <p className="text-[var(--secondary-text)]/40 text-center py-8">
                  No transcript available
                </p>
              ) : (
                transcripts.map((entry, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex",
                      entry.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                        entry.role === "user"
                          ? "bg-[var(--accent)] text-white rounded-br-md"
                          : "bg-[var(--cream)] text-[var(--foreground)] rounded-bl-md"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {entry.text}
                      </p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          entry.role === "user"
                            ? "text-white/60"
                            : "text-[var(--secondary-text)]/40"
                        )}
                      >
                        {new Date(entry.timestamp).toLocaleTimeString(
                          undefined,
                          { hour: "numeric", minute: "2-digit" }
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Call list */
            <>
              {loading ? (
                <div className="p-8 text-center text-[var(--secondary-text)]/40">
                  Loading...
                </div>
              ) : calls.length === 0 ? (
                <div className="p-8 text-center text-[var(--secondary-text)]/40">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm mt-2">
                    Start a call or send a message
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)]">
                  {calls.map((call) => (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors active:bg-[var(--hover-bg)]"
                      onClick={() => fetchTranscripts(call.id)}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--foreground)] truncate">
                          Chief
                        </p>
                        <p className="text-sm text-[var(--secondary-text)]/60">
                          {formatDate(call.started_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--secondary-text)]/40 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        <button
                          className="p-2 -m-2 text-[var(--secondary-text)]/30 hover:text-[var(--accent)] transition-colors"
                          onClick={(e) => deleteCallRecord(call.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-[var(--secondary-text)]/30" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
