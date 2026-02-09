import { ChildProcess } from "child_process";

/**
 * Shared state between webrtc route handlers.
 *
 * Turbopack (Next.js dev) may compile each route as a separate module,
 * so module-level Maps are NOT shared across route files.  Using globalThis
 * ensures a single Map instance across all route handlers in the same process.
 */

type BotEntry = { process: ChildProcess; port: number };

const g = globalThis as unknown as {
  __chiefWebRTCBots?: Map<string, BotEntry>;
  __chiefNextPort?: number;
};

if (!g.__chiefWebRTCBots) {
  g.__chiefWebRTCBots = new Map();
}
if (g.__chiefNextPort === undefined) {
  g.__chiefNextPort = 0;
}

export const activeWebRTCBots: Map<string, BotEntry> = g.__chiefWebRTCBots;

// Port allocation
const BASE_PORT = 9000;

export function allocatePort(): number {
  const port = BASE_PORT + (g.__chiefNextPort! % 100);
  g.__chiefNextPort!++;
  return port;
}

/**
 * Find the bot port for a given call ID, or return the most recent bot's port.
 */
export function getBotPort(callId?: string): number | null {
  if (callId) {
    const bot = activeWebRTCBots.get(callId);
    if (bot) return bot.port;
  }
  // Fall back to most recent bot
  const entries = Array.from(activeWebRTCBots.values());
  if (entries.length > 0) return entries[entries.length - 1].port;
  return null;
}
