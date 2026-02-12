#!/usr/bin/env bash
set -euo pipefail

G=$'\033[0;32m' R=$'\033[0;31m' Y=$'\033[0;33m' C=$'\033[0;36m' B=$'\033[1m' N=$'\033[0m'
ok()   { printf "  %s✔%s %s\n" "$G" "$N" "$1"; }
warn() { printf "  %s⚠%s %s\n" "$Y" "$N" "$1"; }
fail() { printf "  %s✘%s %s\n" "$R" "$N" "$1"; }
hdr()  { printf "\n%s%s── %s ──%s\n" "$B" "$C" "$1" "$N"; }

# ── Ports ──
hdr "Ports"
echo "  Frontend: ${CHIEFVOICE_FRONTEND_PORT:-3000}"

# ── Services ──
hdr "Services"
frontend_port="${CHIEFVOICE_FRONTEND_PORT:-3000}"
if curl -sf "http://localhost:${frontend_port}" >/dev/null 2>&1; then
  ok "Frontend running on :${frontend_port}"
else
  warn "Frontend not responding on :${frontend_port}"
fi

backend_url="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:13000}"
if curl -sf "${backend_url}/health" >/dev/null 2>&1; then
  ok "Backend reachable at ${backend_url}"
else
  warn "Backend not responding at ${backend_url}"
fi

gateway_url="${CHIEFVOICE_GATEWAY_URL:-ws://localhost:18789}"
echo "  Gateway:  ${gateway_url}"

# ── Environment (.env) ──
hdr "Environment"
if [ -f .env ]; then
  ok ".env file found"
else
  warn ".env file missing"
fi

# ── API Keys ──
hdr "API Keys"
[ -n "${GOOGLE_CLIENT_ID:-}" ]     && ok "GOOGLE_CLIENT_ID"     || warn "GOOGLE_CLIENT_ID not set"
[ -n "${GOOGLE_CLIENT_SECRET:-}" ] && ok "GOOGLE_CLIENT_SECRET" || warn "GOOGLE_CLIENT_SECRET not set"
[ -n "${OPENAI_API_KEY:-}" ]       && ok "OPENAI_API_KEY"       || warn "OPENAI_API_KEY not set"
[ -n "${DAILY_API_KEY:-}" ]        && ok "DAILY_API_KEY"        || warn "DAILY_API_KEY not set"
[ -n "${BRAVE_API_KEY:-}" ]        && ok "BRAVE_API_KEY"        || warn "BRAVE_API_KEY not set (optional)"
[ -n "${VAPI_API_KEY:-}" ]         && ok "VAPI_API_KEY"         || warn "VAPI_API_KEY not set (optional)"

# ── Google OAuth ──
hdr "Google OAuth"
token_path="${GOOGLE_TOKEN_PATH:-/var/lib/chiefvoice/google_tokens.json}"
if [ -f "$token_path" ]; then
  email=$(python3 -c "import json; print(json.load(open('$token_path')).get('email','unknown'))" 2>/dev/null || echo "unknown")
  ok "OAuth tokens present (${email})"
else
  warn "No OAuth tokens at ${token_path}"
fi

# ── Voice ──
hdr "Voice"
provider="${NEXT_PUBLIC_VOICE_PROVIDER:-${VOICE_PROVIDER:-auto}}"
echo "  Provider: ${provider}"
[ -n "${NEXT_PUBLIC_VAPI_PUBLIC_KEY:-}" ] && ok "VAPI public key" || warn "VAPI public key not set (optional)"

# ── Integrations ──
hdr "Integrations"
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && ok "Telegram"         || warn "Telegram not configured"
[ -n "${TELEGRAM_CHAT_ID:-}" ]   && ok "Telegram Chat ID" || warn "Telegram Chat ID not set"
chiefvoice="${CHIEFVOICE_ENABLED:-false}"
echo "  ChiefVoice gateway: ${chiefvoice}"
[ -n "${CHIEFVOICE_GATEWAY_TOKEN:-}" ] && ok "Gateway token set" || warn "Gateway token not set"

# ── Database ──
hdr "Database"
db_path="${CHIEF_DB_PATH:-data/chief.db}"
[ -f "$db_path" ] && ok "Database: ${db_path}" || warn "Database not found: ${db_path}"

echo ""
