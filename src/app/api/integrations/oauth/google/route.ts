import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

/**
 * Google OAuth flow — two modes:
 *
 * 1. Redirect mode (if redirect URI is registered in Google Console):
 *    GET  /api/integrations/oauth/google           → redirect to Google consent
 *    GET  /api/integrations/oauth/google?code=...   → exchange code, store tokens
 *
 * 2. Manual code mode (no redirect URI registration needed):
 *    POST /api/integrations/oauth/google  { code }  → exchange code, store tokens
 *
 * For manual mode, use OAuth client type "Web application" or "Desktop app"
 * with redirect_uri = "urn:ietf:wg:oauth:2.0:oob" (shows code on screen).
 */

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/userinfo.email",
];

const TOKEN_PATH =
  process.env.GOOGLE_TOKEN_PATH || "/var/lib/chiefvoice/google_tokens.json";

// In-memory CSRF state store
const pendingStates = new Map<string, number>();

function getClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || "";

function getRedirectUri(request: Request): string {
  if (OAUTH_REDIRECT_URI) return OAUTH_REDIRECT_URI;
  // Derive from the incoming request headers
  const headers = new Headers(request.headers);
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost:3000";
  const proto = headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/api/integrations/oauth/google`;
}

async function exchangeAndStore(
  code: string,
  redirectUri: string,
  config: { clientId: string; clientSecret: string },
): Promise<{ success: boolean; email?: string; error?: string }> {
  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[Google OAuth] Token exchange failed:", err);
    return { success: false, error: "Failed to exchange authorization code" };
  }

  const tokens = await tokenRes.json();

  // Fetch user email
  let email: string | undefined;
  try {
    const infoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (infoRes.ok) {
      const info = await infoRes.json();
      email = info.email;
    }
  } catch {
    // non-critical
  }

  // Store tokens
  const tokenData = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_uri: "https://oauth2.googleapis.com/token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scopes: GOOGLE_SCOPES,
    expiry: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined,
    email,
  };

  try {
    await mkdir(dirname(TOKEN_PATH), { recursive: true });
    await writeFile(TOKEN_PATH, JSON.stringify(tokenData, null, 2), {
      mode: 0o600,
    });
    console.log(
      `[Google OAuth] Tokens stored at ${TOKEN_PATH} for ${email ?? "unknown"}`,
    );
  } catch (e) {
    console.error("[Google OAuth] Failed to write tokens:", e);
    return { success: false, error: "Failed to store tokens on server" };
  }

  return { success: true, email };
}

/**
 * GET — either start the OAuth redirect flow, or handle callback with ?code=
 */
export async function GET(request: Request) {
  const config = getClientConfig();
  if (!config) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not configured" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // ── Callback: exchange code for tokens ──────────────
  if (code) {
    if (!state || !pendingStates.has(state)) {
      return NextResponse.json(
        { error: "Invalid or expired OAuth state" },
        { status: 400 },
      );
    }

    const stateTime = pendingStates.get(state)!;
    pendingStates.delete(state);

    if (Date.now() - stateTime > 15 * 60 * 1000) {
      return NextResponse.json(
        { error: "OAuth state expired" },
        { status: 400 },
      );
    }

    const result = await exchangeAndStore(
      code,
      getRedirectUri(request),
      config,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Use the OAuth redirect URI's origin (which has the correct external hostname)
    const appOrigin = OAUTH_REDIRECT_URI
      ? new URL(OAUTH_REDIRECT_URI).origin
      : url.origin;
    const redirectUrl = new URL("/settings/integrations", appOrigin);
    redirectUrl.searchParams.set("oauth", "google");
    redirectUrl.searchParams.set("status", "success");
    if (result.email) redirectUrl.searchParams.set("email", result.email);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // ── Start: redirect to Google consent ──────────────
  const csrfState = randomBytes(32).toString("base64url");
  pendingStates.set(csrfState, Date.now());

  // Clean up old states (> 15 min)
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [s, t] of pendingStates) {
    if (t < cutoff) pendingStates.delete(s);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", csrfState);

  return NextResponse.redirect(authUrl.toString());
}

/**
 * POST — manual code exchange (paste auth code from Google).
 *
 * Body: { "code": "4/0Abc..." }
 *
 * Use this when the redirect URI can't be registered in Google Console.
 * The consent URL should use redirect_uri=urn:ietf:wg:oauth:2.0:oob
 * so Google displays the code for the user to copy.
 */
export async function POST(request: NextRequest) {
  const config = getClientConfig();
  if (!config) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not configured" },
      { status: 400 },
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.code) {
    return NextResponse.json(
      { error: "Missing 'code' in request body" },
      { status: 400 },
    );
  }

  // For manually pasted codes, use the same origin redirect URI
  const result = await exchangeAndStore(
    body.code,
    getRedirectUri(request),
    config,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    email: result.email,
  });
}
