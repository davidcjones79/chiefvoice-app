/**
 * API Helper for Capacitor iOS builds
 *
 * In static export mode (iOS), API routes don't exist in the app bundle.
 * All API calls must be routed to the backend server.
 *
 * Web builds continue to use relative URLs (API routes work normally).
 */

// Check if we're running in a Capacitor native context
function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error - Capacitor global may not be defined
  return window.Capacitor?.isNativePlatform?.() ?? false;
}

// Backend URL for iOS app to connect to
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL
  || 'https://davids-mac-mini-1.bunny-bleak.ts.net:3000';

/**
 * Get the full API URL for a given path
 * - Native (iOS): Uses backend server URL
 * - Web: Uses relative URLs (API routes work)
 */
export function getApiUrl(path: string): string {
  if (isNativePlatform()) {
    return `${BACKEND_URL}${path}`;
  }
  return path;
}

/**
 * Fetch wrapper that automatically handles API routing
 */
export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = getApiUrl(path);

  return fetch(url, {
    ...options,
    // Don't send credentials cross-origin (iOS to backend)
    credentials: isNativePlatform() ? 'omit' : 'same-origin',
  });
}

/**
 * Create an EventSource for SSE endpoints
 */
export function createApiEventSource(path: string): EventSource {
  const url = getApiUrl(path);
  return new EventSource(url);
}

/**
 * Check if running in native app
 */
export { isNativePlatform };
