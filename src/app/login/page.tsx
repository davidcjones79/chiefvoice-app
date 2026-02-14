"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface TenantChoice {
  id: string;
  name: string;
  role: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const expired = searchParams.get("expired") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [tenants, setTenants] = useState<TenantChoice[] | null>(null);
  const [requireMfa, setRequireMfa] = useState(false);
  const [error, setError] = useState(expired ? "Session expired. Please log in again." : "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, string> = { password };
      if (email) body.email = email;
      if (tenantId) body.tenant_id = tenantId;
      if (mfaCode) body.mfa_code = mfaCode;

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // If multiple tenants, show selection
      if (data.tenants && data.tenants.length > 0) {
        setTenants(data.tenants);
        return;
      }

      // If MFA required
      if (data.mfa_required) {
        setRequireMfa(true);
        return;
      }

      // Success — store token and redirect
      if (data.access_token) {
        document.cookie = `chiefvoice_token=${data.access_token}; path=/; max-age=3600; SameSite=Lax`;
        router.push(redirect);
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">ChiefVoice</h1>
          <p className="text-gray-400 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Tenant selection (shown after first auth if multiple) */}
          {tenants && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">Select workspace</label>
              {tenants.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTenantId(t.id);
                    setTenants(null);
                  }}
                  className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-white"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-gray-400 text-sm ml-2">({t.role})</span>
                </button>
              ))}
            </div>
          )}

          {!tenants && (
            <>
              <div>
                <label htmlFor="email" className="block text-sm text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </div>

              {requireMfa && (
                <div>
                  <label htmlFor="mfa" className="block text-sm text-gray-300 mb-1">
                    MFA Code
                  </label>
                  <input
                    id="mfa"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded transition-colors"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
