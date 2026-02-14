/**
 * Next.js middleware — validates JWT, extracts tenant_id, sets in headers.
 *
 * Runs on every request before the page/API route handler.
 */
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for session token in cookie or Authorization header
  const token =
    request.cookies.get("chiefvoice_token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    // Redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT payload (no verification here — gateway verifies)
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    const tenantId = payload.tid;
    const userId = payload.user_id;

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("expired", "true");
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("chiefvoice_token");
      return response;
    }

    // Forward tenant context to API routes via headers
    const headers = new Headers(request.headers);
    if (tenantId) headers.set("x-tenant-id", tenantId);
    if (userId) headers.set("x-user-id", userId);
    headers.set("x-auth-token", token);

    return NextResponse.next({ request: { headers } });
  } catch {
    // Invalid token format — redirect to login
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("chiefvoice_token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
