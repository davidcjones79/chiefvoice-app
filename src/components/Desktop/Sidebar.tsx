"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Search, Plus, Settings } from "lucide-react";
import Link from "next/link";

interface ConversationPreview {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messageCount: number;
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Load recent conversations
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch("/api/calls?limit=20");
        if (res.ok) {
          const data = await res.json();
          const previews: ConversationPreview[] = data.calls?.map((call: {
            id: string;
            transcript?: Array<{ role: string; text: string }>;
            startedAt?: number;
          }) => {
            const firstUserMessage = call.transcript?.find((t: { role: string }) => t.role === "user");
            const messageCount = call.transcript?.length || 0;
            return {
              id: call.id,
              title: firstUserMessage?.text?.slice(0, 50) || "New conversation",
              preview: call.transcript?.slice(-1)[0]?.text?.slice(0, 80) || "",
              timestamp: call.startedAt || Date.now(),
              messageCount,
            };
          }) || [];
          setConversations(previews);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, []);

  // Filter conversations by search
  const filteredConversations = searchQuery
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.preview.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Group conversations by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups = {
    today: filteredConversations.filter((c) => c.timestamp >= today.getTime()),
    yesterday: filteredConversations.filter(
      (c) => c.timestamp >= yesterday.getTime() && c.timestamp < today.getTime()
    ),
    lastWeek: filteredConversations.filter(
      (c) => c.timestamp >= lastWeek.getTime() && c.timestamp < yesterday.getTime()
    ),
    older: filteredConversations.filter((c) => c.timestamp < lastWeek.getTime()),
  };

  return (
    <div className="sidebar-content">
      {/* New Conversation Button */}
      <Link
        href="/"
        onClick={onNavigate}
        className="new-conversation-btn"
      >
        <Plus className="w-4 h-4" />
        <span>New conversation</span>
      </Link>

      {/* Search */}
      <div className="sidebar-search">
        <Search className="sidebar-search-icon" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
        />
      </div>

      {/* Conversation list */}
      <div className="sidebar-list">
        {loading ? (
          <div className="sidebar-loading">
            <div className="sidebar-loading-item" />
            <div className="sidebar-loading-item" />
            <div className="sidebar-loading-item" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="sidebar-empty">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <p>No conversations yet</p>
          </div>
        ) : (
          <>
            {groups.today.length > 0 && (
              <ConversationGroup title="Today" conversations={groups.today} onNavigate={onNavigate} />
            )}
            {groups.yesterday.length > 0 && (
              <ConversationGroup title="Yesterday" conversations={groups.yesterday} onNavigate={onNavigate} />
            )}
            {groups.lastWeek.length > 0 && (
              <ConversationGroup title="Last 7 days" conversations={groups.lastWeek} onNavigate={onNavigate} />
            )}
            {groups.older.length > 0 && (
              <ConversationGroup title="Older" conversations={groups.older} onNavigate={onNavigate} />
            )}
          </>
        )}
      </div>

      {/* Settings link at bottom */}
      <div className="sidebar-footer">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="sidebar-settings-link"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}

function ConversationGroup({
  title,
  conversations,
  onNavigate,
}: {
  title: string;
  conversations: ConversationPreview[];
  onNavigate?: () => void;
}) {
  return (
    <div className="sidebar-group">
      <h3 className="sidebar-group-title">{title}</h3>
      <div className="sidebar-group-items">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            className="sidebar-conversation"
            onClick={onNavigate}
          >
            <div className="sidebar-conversation-title">{conv.title}</div>
            {conv.preview && (
              <div className="sidebar-conversation-preview">
                {conv.preview}...
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
