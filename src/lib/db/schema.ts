import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.CHIEF_DB_PATH || path.join(process.cwd(), "data", "chief.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_seconds INTEGER,
      session_key TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);
    CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
  `);
}

export interface CallRow {
  id: string;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number | null;
  session_key: string | null;
  created_at: number;
}

export interface TranscriptRow {
  id: number;
  call_id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  created_at: number;
}

export function createCall(id: string, startedAt: number, sessionKey?: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO calls (id, started_at, session_key) VALUES (?, ?, ?)"
  ).run(id, startedAt, sessionKey || null);
}

export function endCall(id: string, endedAt: number): void {
  const db = getDb();
  const call = db.prepare("SELECT started_at FROM calls WHERE id = ?").get(id) as { started_at: number } | undefined;
  if (call) {
    const duration = Math.round((endedAt - call.started_at) / 1000);
    db.prepare(
      "UPDATE calls SET ended_at = ?, duration_seconds = ? WHERE id = ?"
    ).run(endedAt, duration, id);
  }
}

export function addTranscript(
  callId: string,
  role: "user" | "assistant",
  text: string,
  timestamp: number
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO transcripts (call_id, role, text, timestamp) VALUES (?, ?, ?, ?)"
  ).run(callId, role, text, timestamp);
}

export function getCalls(limit = 50): CallRow[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM calls ORDER BY started_at DESC LIMIT ?"
  ).all(limit) as CallRow[];
}

export function getCall(id: string): CallRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM calls WHERE id = ?").get(id) as CallRow | undefined;
}

export function getTranscripts(callId: string): TranscriptRow[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM transcripts WHERE call_id = ? ORDER BY timestamp ASC"
  ).all(callId) as TranscriptRow[];
}

export function deleteCall(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM calls WHERE id = ?").run(id);
}
