"use client";

import { useState, useEffect, useCallback } from "react";
import { DesktopLayout } from "@/components/Desktop";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  Plug,
  Loader2,
  LogIn,
} from "lucide-react";
import Link from "next/link";
import {
  INTEGRATIONS,
  CATEGORY_META,
  CATEGORY_ORDER,
  type Integration,
  type IntegrationCategory,
} from "@/lib/integrations";

/* ─── Types ──────────────────────────────────────────── */

interface FieldStatus {
  configured: boolean;
  maskedValue: string | null;
  secret: boolean;
}

type FieldStatuses = Record<string, FieldStatus>;

/* ─── Component ──────────────────────────────────────── */

export default function IntegrationsPage() {
  const [fieldStatuses, setFieldStatuses] = useState<FieldStatuses>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dirtyFields, setDirtyFields] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);
  const [showRestartBanner, setShowRestartBanner] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<IntegrationCategory | "all">("all");
  const [testingGateway, setTestingGateway] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<string | null>(null);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<Record<string, { connected: boolean; email?: string }>>({});
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  /* ─── Handle OAuth return ──────────────────────────── */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthProvider = params.get("oauth");
    const status = params.get("status");
    const email = params.get("email");

    if (oauthProvider === "google" && status === "success") {
      setOauthStatus((prev) => ({
        ...prev,
        google: { connected: true, email: email ?? undefined },
      }));
      setShowRestartBanner(true);
      // Clean up URL params
      window.history.replaceState({}, "", "/settings/integrations");
    }
  }, []);

  /* ─── Data fetching ─────────────────────────────────── */

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json();
      setFieldStatuses(data.fields ?? {});
    } catch {
      console.error("Failed to fetch integration statuses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  /* ─── Helpers ───────────────────────────────────────── */

  function isIntegrationConfigured(integration: Integration): boolean {
    return integration.fields.some(
      (f) => fieldStatuses[f.envVar]?.configured
    );
  }

  function getConfiguredCount(integration: Integration): number {
    return integration.fields.filter(
      (f) => fieldStatuses[f.envVar]?.configured
    ).length;
  }

  /* ─── Filtering ─────────────────────────────────────── */

  const filteredIntegrations = INTEGRATIONS.filter((i) => {
    const matchesCategory =
      filterCategory === "all" || i.category === filterCategory;
    const matchesSearch =
      searchQuery === "" ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.capabilities.some((c) =>
        c.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const groupedIntegrations = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    meta: CATEGORY_META[cat],
    integrations: filteredIntegrations.filter((i) => i.category === cat),
  })).filter((g) => g.integrations.length > 0);

  /* ─── Field editing ─────────────────────────────────── */

  function handleFieldChange(envVar: string, value: string) {
    setDirtyFields((prev) => ({ ...prev, [envVar]: value }));
  }

  function handleClearField(envVar: string) {
    setDirtyFields((prev) => ({ ...prev, [envVar]: "" }));
  }

  function toggleFieldVisibility(envVar: string) {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(envVar)) next.delete(envVar);
      else next.add(envVar);
      return next;
    });
  }

  /* ─── Save ──────────────────────────────────────────── */

  async function handleSave(integration: Integration) {
    const updates: Record<string, string> = {};
    for (const field of integration.fields) {
      if (field.envVar in dirtyFields) {
        updates[field.envVar] = dirtyFields[field.envVar];
      }
    }

    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    setSaveResult(null);

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSaveResult("success");
        setShowRestartBanner(true);
        // Clear dirty fields that were saved
        setDirtyFields((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(updates)) delete next[key];
          return next;
        });
        // Refresh statuses
        await fetchStatuses();
      } else {
        setSaveResult("error");
      }
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3000);
    }
  }

  /* ─── Restart bot ───────────────────────────────────── */

  async function handleRestart() {
    setRestarting(true);
    try {
      const res = await fetch("/api/integrations/restart-bot", {
        method: "POST",
      });
      if (res.ok) {
        setShowRestartBanner(false);
      }
    } catch {
      // ignore — banner stays visible
    } finally {
      setRestarting(false);
    }
  }

  /* ─── Test gateway ──────────────────────────────────── */

  async function handleTestGateway() {
    setTestingGateway(true);
    setGatewayStatus(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.chiefvoice?.connected) {
        setGatewayStatus("Connected and authenticated");
      } else if (data.chiefvoice?.error) {
        setGatewayStatus(data.chiefvoice.error);
      } else {
        setGatewayStatus("Not connected");
      }
    } catch {
      setGatewayStatus("Failed to reach health endpoint");
    } finally {
      setTestingGateway(false);
    }
  }

  /* ─── OAuth connect ─────────────────────────────────── */

  function handleOAuthConnect(provider: string) {
    // Open Google consent in a new tab, show code input
    const clientId = dirtyFields["GOOGLE_CLIENT_ID"]
      || fieldStatuses["GOOGLE_CLIENT_ID"]?.maskedValue;

    // Build consent URL — redirect_uri points back to our app
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/contacts.readonly",
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    // Try redirect flow first (navigates away)
    setShowCodeInput(true);
    setCodeError(null);
    window.open(`/api/integrations/oauth/${provider}`, "_blank");
  }

  async function handleSubmitCode() {
    if (!authCode.trim()) return;
    setOauthConnecting(true);
    setCodeError(null);

    try {
      const res = await fetch("/api/integrations/oauth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setOauthStatus((prev) => ({
          ...prev,
          google: { connected: true, email: data.email },
        }));
        setShowCodeInput(false);
        setAuthCode("");
        setShowRestartBanner(true);
      } else {
        setCodeError(data.error || "Failed to exchange code");
      }
    } catch {
      setCodeError("Failed to reach server");
    } finally {
      setOauthConnecting(false);
    }
  }

  /* ─── Has dirty fields for this integration? ────────── */

  function hasDirtyFields(integration: Integration): boolean {
    return integration.fields.some((f) => f.envVar in dirtyFields);
  }

  /* ─── Render ────────────────────────────────────────── */

  return (
    <DesktopLayout>
      <div className="settings-page">
        {/* Header */}
        <header className="settings-page-header">
          <Link href="/settings" className="settings-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div style={{ flex: 1 }}>
            <h1 className="settings-page-title">Integrations</h1>
            <p className="integ-subtitle">
              Browse and configure services to unlock new capabilities
            </p>
          </div>
        </header>

        {/* Restart banner */}
        {showRestartBanner && (
          <div className="integ-restart-banner">
            <div className="integ-restart-banner-text">
              <RefreshCw className="w-4 h-4" />
              <span>Restart the bot for changes to take effect</span>
            </div>
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="integ-restart-btn"
            >
              {restarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Restart Bot
                </>
              )}
            </button>
          </div>
        )}

        {/* Search + filter bar */}
        <div className="integ-toolbar">
          <div className="integ-search">
            <Search className="w-4 h-4 integ-search-icon" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="integ-search-input"
            />
          </div>
          <div className="integ-filter-pills">
            <button
              onClick={() => setFilterCategory("all")}
              className={`integ-pill ${filterCategory === "all" ? "active" : ""}`}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`integ-pill ${filterCategory === cat ? "active" : ""}`}
              >
                {CATEGORY_META[cat].label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="integ-content">
          {loading ? (
            <div className="integ-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="integ-loading-card" />
              ))}
            </div>
          ) : (
            groupedIntegrations.map((group) => (
              <section key={group.category} className="integ-category">
                <div className="integ-category-header">
                  <h2 className="integ-category-title">
                    {group.meta.label}
                  </h2>
                  <span className="integ-category-desc">
                    {group.meta.description}
                  </span>
                </div>

                <div className="integ-grid">
                  {group.integrations.map((integration) => {
                    const expanded = expandedId === integration.id;
                    const configured = isIntegrationConfigured(integration);
                    const configCount = getConfiguredCount(integration);

                    return (
                      <div
                        key={integration.id}
                        className={`integ-card ${expanded ? "expanded" : ""} ${configured ? "configured" : ""}`}
                      >
                        {/* Card header — clickable */}
                        <button
                          className="integ-card-header"
                          onClick={() =>
                            setExpandedId(expanded ? null : integration.id)
                          }
                        >
                          <div className="integ-card-icon">
                            {integration.name.charAt(0)}
                          </div>
                          <div className="integ-card-info">
                            <div className="integ-card-name-row">
                              <span className="integ-card-name">
                                {integration.name}
                              </span>
                              {configured ? (
                                <span className="integ-badge configured">
                                  <Check className="w-3 h-3" />
                                  {configCount}/{integration.fields.length}
                                </span>
                              ) : (
                                <span className="integ-badge not-set">
                                  Not configured
                                </span>
                              )}
                            </div>
                            <p className="integ-card-desc">
                              {integration.description}
                            </p>
                          </div>
                          <div className="integ-card-chevron">
                            {expanded ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </button>

                        {/* Capabilities (always visible) */}
                        <div className="integ-capabilities">
                          {integration.capabilities.map((cap) => (
                            <span key={cap} className="integ-capability-tag">
                              {cap}
                            </span>
                          ))}
                        </div>

                        {/* Expanded: config fields */}
                        {expanded && (
                          <div className="integ-card-body">
                            {integration.fields.map((field) => {
                              const status = fieldStatuses[field.envVar];
                              const dirtyValue = dirtyFields[field.envVar];
                              const isVisible = visibleFields.has(field.envVar);

                              return (
                                <div
                                  key={field.envVar}
                                  className="integ-field"
                                >
                                  <div className="integ-field-header">
                                    <label className="integ-field-label">
                                      {field.label}
                                    </label>
                                    <code className="integ-field-env">
                                      {field.envVar}
                                    </code>
                                  </div>
                                  <div className="integ-field-input-row">
                                    <div className="integ-field-input-wrap">
                                      <input
                                        type={
                                          field.secret && !isVisible
                                            ? "password"
                                            : "text"
                                        }
                                        placeholder={
                                          status?.configured
                                            ? status.maskedValue ?? field.placeholder
                                            : field.placeholder
                                        }
                                        value={dirtyValue ?? ""}
                                        onChange={(e) =>
                                          handleFieldChange(
                                            field.envVar,
                                            e.target.value
                                          )
                                        }
                                        className="integ-field-input"
                                        autoComplete="off"
                                      />
                                      {field.secret && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleFieldVisibility(field.envVar)
                                          }
                                          className="integ-field-eye"
                                        >
                                          {isVisible ? (
                                            <EyeOff className="w-4 h-4" />
                                          ) : (
                                            <Eye className="w-4 h-4" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    {status?.configured && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleClearField(field.envVar)
                                        }
                                        className="integ-field-clear"
                                        title="Clear this value"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* OAuth connected status */}
                            {integration.authType === "oauth" &&
                              integration.oauthProvider &&
                              oauthStatus[integration.oauthProvider]?.connected && (
                                <div className="integ-oauth-connected">
                                  <Check className="w-4 h-4" />
                                  <span>
                                    Connected
                                    {oauthStatus[integration.oauthProvider]?.email
                                      ? ` as ${oauthStatus[integration.oauthProvider].email}`
                                      : ""}
                                  </span>
                                </div>
                              )}

                            {/* Actions row */}
                            <div className="integ-card-actions">
                              <button
                                onClick={() => handleSave(integration)}
                                disabled={
                                  saving || !hasDirtyFields(integration)
                                }
                                className="integ-save-btn"
                              >
                                {saving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : saveResult === "success" ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Plug className="w-4 h-4" />
                                )}
                                {saving
                                  ? "Saving..."
                                  : saveResult === "success"
                                    ? "Saved!"
                                    : "Save"}
                              </button>

                              {/* OAuth connect button */}
                              {integration.authType === "oauth" &&
                                integration.oauthProvider && (
                                  <button
                                    onClick={() =>
                                      handleOAuthConnect(integration.oauthProvider!)
                                    }
                                    disabled={
                                      oauthConnecting ||
                                      !isIntegrationConfigured(integration)
                                    }
                                    className="integ-oauth-btn"
                                    title={
                                      !isIntegrationConfigured(integration)
                                        ? "Save Client ID and Secret first"
                                        : undefined
                                    }
                                  >
                                    {oauthConnecting ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <LogIn className="w-4 h-4" />
                                    )}
                                    {oauthStatus[integration.oauthProvider]?.connected
                                      ? "Reconnect"
                                      : "Connect with Google"}
                                  </button>
                                )}

                              {/* OAuth code paste input */}
                              {integration.authType === "oauth" &&
                                showCodeInput &&
                                !oauthStatus[integration.oauthProvider ?? ""]?.connected && (
                                  <div className="integ-oauth-code-row">
                                    <p className="integ-oauth-code-hint">
                                      If Google opened in a new tab, authorize
                                      then paste the code here. If it redirected
                                      back automatically, you&apos;re all set.
                                    </p>
                                    <div className="integ-oauth-code-input-row">
                                      <input
                                        type="text"
                                        placeholder="Paste authorization code..."
                                        value={authCode}
                                        onChange={(e) => setAuthCode(e.target.value)}
                                        className="integ-field-input"
                                        autoComplete="off"
                                      />
                                      <button
                                        onClick={handleSubmitCode}
                                        disabled={oauthConnecting || !authCode.trim()}
                                        className="integ-oauth-btn"
                                      >
                                        {oauthConnecting ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Check className="w-4 h-4" />
                                        )}
                                        Submit
                                      </button>
                                    </div>
                                    {codeError && (
                                      <div className="integ-error">{codeError}</div>
                                    )}
                                  </div>
                                )}

                              {integration.id === "chiefvoice-gateway" && (
                                <button
                                  onClick={handleTestGateway}
                                  disabled={testingGateway}
                                  className="integ-test-btn"
                                >
                                  {testingGateway ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Plug className="w-4 h-4" />
                                  )}
                                  Test Connection
                                </button>
                              )}

                              {integration.docsUrl && (
                                <a
                                  href={integration.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="integ-docs-link"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Docs
                                </a>
                              )}
                            </div>

                            {/* Gateway test result */}
                            {integration.id === "chiefvoice-gateway" &&
                              gatewayStatus && (
                                <div className="integ-gateway-status">
                                  {gatewayStatus}
                                </div>
                              )}

                            {/* Save error */}
                            {saveResult === "error" && (
                              <div className="integ-error">
                                Failed to save. Check the console for details.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          {!loading && filteredIntegrations.length === 0 && (
            <div className="integ-empty">
              <Search className="w-8 h-8" />
              <p>No integrations match your search</p>
            </div>
          )}
        </div>
      </div>
    </DesktopLayout>
  );
}
