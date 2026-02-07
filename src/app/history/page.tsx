"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Phone, Trash2, Clock, X } from "lucide-react";
import Link from "next/link";
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

export default function HistoryPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const res = await fetch("/api/calls");
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (error) {
      console.error("Failed to fetch calls:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const deleteCallRecord = async (callId: string) => {
    if (!confirm("Delete this call?")) return;
    
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
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const selectedCallData = calls.find(c => c.id === selectedCall);

  return (
    <main className="h-screen h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border-color)] shrink-0">
        <Link href="/" className="p-2 -m-2 text-[var(--secondary-text)]/60 hover:text-[var(--secondary-text)] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-display text-[var(--secondary-text)]">Call History</h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Call list */}
        <div className={cn(
          "w-full md:w-80 border-r border-[var(--border-color)] overflow-y-auto bg-[var(--background)]",
          selectedCall && "hidden md:block"
        )}>
          {loading ? (
            <div className="p-8 text-center text-[var(--secondary-text)]/40">
              Loading...
            </div>
          ) : calls.length === 0 ? (
            <div className="p-8 text-center text-[var(--secondary-text)]/40">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No calls yet</p>
              <p className="text-sm mt-2">Start a call to see history here</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors",
                    selectedCall === call.id && "bg-[var(--accent)]/10"
                  )}
                  onClick={() => fetchTranscripts(call.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--secondary-text)]">Chief</p>
                        <p className="text-sm text-[var(--secondary-text)]/60">
                          {formatDate(call.started_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-[var(--secondary-text)]/40 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                      <button
                        className="p-2 text-[var(--secondary-text)]/30 hover:text-[var(--accent)] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCallRecord(call.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transcript view - full screen on mobile when selected */}
        <div className={cn(
          "flex-1 flex flex-col bg-[var(--cream)]",
          selectedCall ? "absolute inset-0 md:relative md:inset-auto" : "hidden md:flex"
        )}>
          {selectedCall ? (
            <>
              <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {/* Back button - mobile only */}
                  <button
                    className="p-2 -m-2 text-[var(--secondary-text)]/60 hover:text-[var(--secondary-text)] transition-colors md:hidden"
                    onClick={() => setSelectedCall(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="font-display text-[var(--secondary-text)]">Transcript</h2>
                    {selectedCallData && (
                      <p className="text-xs text-[var(--secondary-text)]/50">
                        {formatDate(selectedCallData.started_at)} · {formatDuration(selectedCallData.duration_seconds)}
                      </p>
                    )}
                  </div>
                </div>
                {/* Close button - desktop only */}
                <button
                  className="hidden md:block p-2 -m-2 text-[var(--secondary-text)]/40 hover:text-[var(--secondary-text)] transition-colors"
                  onClick={() => setSelectedCall(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {transcripts.length === 0 ? (
                  <p className="text-[var(--secondary-text)]/40 text-center py-8">
                    No transcript available
                  </p>
                ) : (
                  transcripts.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3"
                    >
                      <span className={cn(
                        "text-xs font-medium uppercase tracking-wider mt-0.5 shrink-0 w-8",
                        entry.role === "user"
                          ? "text-[var(--accent)]"
                          : "text-[#d97706]"
                      )}>
                        {entry.role === "user" ? "you" : "bot"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--foreground)]/80 break-words">{entry.text}</p>
                        <p className="text-xs text-[var(--secondary-text)]/40 mt-1">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--secondary-text)]/40">
              <p>Select a call to view transcript</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
