import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, rename } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { KNOWN_ENV_VARS, FIELD_BY_ENV_VAR } from "@/lib/integrations";

/**
 * Path to the .env file in the project root.
 * process.cwd() in Next.js API routes is the project root.
 */
function envPath(): string {
  return join(process.cwd(), ".env");
}

/** Parse .env into ordered entries preserving comments and blank lines. */
interface EnvEntry {
  type: "comment" | "blank" | "var";
  raw: string;
  key?: string;
  value?: string;
}

function parseEnvFile(content: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      entries.push({ type: "blank", raw: line });
    } else if (trimmed.startsWith("#")) {
      entries.push({ type: "comment", raw: line });
    } else {
      const eqIndex = line.indexOf("=");
      if (eqIndex !== -1) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        entries.push({ type: "var", raw: line, key, value });
      } else {
        entries.push({ type: "comment", raw: line }); // malformed → preserve
      }
    }
  }
  return entries;
}

function entriesToString(entries: EnvEntry[]): string {
  return entries.map((e) => e.raw).join("\n");
}

/** Mask a value: show last 4 chars, rest as dots. */
function maskValue(value: string): string {
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

/**
 * GET — Return status of all known integration env vars.
 * Never returns full secret values.
 */
export async function GET() {
  const filePath = envPath();
  const envMap = new Map<string, string>();

  if (existsSync(filePath)) {
    const content = await readFile(filePath, "utf-8");
    const entries = parseEnvFile(content);
    for (const entry of entries) {
      if (entry.type === "var" && entry.key) {
        envMap.set(entry.key, entry.value ?? "");
      }
    }
  }

  const fields: Record<
    string,
    { configured: boolean; maskedValue: string | null; secret: boolean }
  > = {};

  for (const envVar of KNOWN_ENV_VARS) {
    const raw = envMap.get(envVar);
    const meta = FIELD_BY_ENV_VAR.get(envVar);
    const isSecret = meta?.secret ?? true;

    if (raw !== undefined && raw !== "") {
      fields[envVar] = {
        configured: true,
        maskedValue: isSecret ? maskValue(raw) : raw,
        secret: isSecret,
      };
    } else {
      fields[envVar] = { configured: false, maskedValue: null, secret: isSecret };
    }
  }

  return NextResponse.json({ fields });
}

/**
 * POST — Update .env with provided key-value pairs.
 * Only accepts keys in KNOWN_ENV_VARS.
 * Empty string = clear the var. Missing key = leave unchanged.
 * Writes atomically via temp file + rename.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Filter to only known env vars
  const updates = new Map<string, string>();
  for (const [key, value] of Object.entries(body)) {
    if (KNOWN_ENV_VARS.has(key) && typeof value === "string") {
      updates.set(key, value);
    }
  }

  if (updates.size === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const filePath = envPath();
  let entries: EnvEntry[] = [];

  if (existsSync(filePath)) {
    const content = await readFile(filePath, "utf-8");
    entries = parseEnvFile(content);
  }

  // Track which keys we've updated in-place
  const updatedKeys = new Set<string>();

  for (const entry of entries) {
    if (entry.type === "var" && entry.key && updates.has(entry.key)) {
      const newValue = updates.get(entry.key)!;
      if (newValue === "") {
        // Clear: mark for removal by turning into a blank
        entry.type = "blank";
        entry.raw = "";
        entry.key = undefined;
        entry.value = undefined;
      } else {
        entry.value = newValue;
        entry.raw = `${entry.key}=${newValue}`;
      }
      updatedKeys.add(entry.key!);
    }
  }

  // Append any new keys not already in the file
  for (const [key, value] of updates) {
    if (!updatedKeys.has(key) && value !== "") {
      entries.push({ type: "var", raw: `${key}=${value}`, key, value });
    }
  }

  // Write atomically: temp file → rename
  const tmpPath = join(tmpdir(), `.env.tmp.${randomBytes(4).toString("hex")}`);
  const content = entriesToString(entries);
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);

  return NextResponse.json({ success: true, updatedCount: updates.size });
}
