/**
 * Database layer — Postgres client for call/transcript storage.
 *
 * Replaces the previous better-sqlite3 implementation.
 * Queries include tenant_id for multi-tenant isolation.
 */
import { Pool } from "pg";

const DATABASE_URL = process.env.CHIEFVOICE_DB_URL || process.env.DATABASE_URL || "";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error(
        "Database not configured. Set CHIEFVOICE_DB_URL or DATABASE_URL."
      );
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
    });
  }
  return pool;
}

/**
 * Initialize schema in the current tenant's Postgres schema.
 * Called once on first connection. Tables may already exist from provisioning.
 */
export async function initSchema(tenantSchema?: string): Promise<void> {
  const p = getPool();
  const schema = tenantSchema || "public";

  await p.query(`
    SET search_path TO ${schema}, public;

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      started_at BIGINT NOT NULL,
      ended_at BIGINT,
      duration_seconds INTEGER,
      session_key TEXT,
      created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id BIGSERIAL PRIMARY KEY,
      call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      text TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM now())::bigint)
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);
    CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id);

    SET search_path TO public;
  `);
}

export interface CallRow {
  id: string;
  tenant_id: string | null;
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

export function createCall(
  id: string,
  startedAt: number,
  sessionKey?: string,
  tenantId?: string
): Promise<void> {
  const p = getPool();
  return p
    .query(
      "INSERT INTO calls (id, started_at, session_key, tenant_id) VALUES ($1, $2, $3, $4)",
      [id, startedAt, sessionKey || null, tenantId || null]
    )
    .then(() => {});
}

export async function endCall(id: string, endedAt: number): Promise<void> {
  const p = getPool();
  const result = await p.query(
    "SELECT started_at FROM calls WHERE id = $1",
    [id]
  );
  if (result.rows[0]) {
    const duration = Math.round((endedAt - result.rows[0].started_at) / 1000);
    await p.query(
      "UPDATE calls SET ended_at = $1, duration_seconds = $2 WHERE id = $3",
      [endedAt, duration, id]
    );
  }
}

export function addTranscript(
  callId: string,
  role: "user" | "assistant",
  text: string,
  timestamp: number
): Promise<void> {
  const p = getPool();
  return p
    .query(
      "INSERT INTO transcripts (call_id, role, text, timestamp) VALUES ($1, $2, $3, $4)",
      [callId, role, text, timestamp]
    )
    .then(() => {});
}

export async function getCalls(
  limit = 50,
  tenantId?: string
): Promise<CallRow[]> {
  const p = getPool();
  if (tenantId) {
    const result = await p.query(
      "SELECT * FROM calls WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2",
      [tenantId, limit]
    );
    return result.rows;
  }
  const result = await p.query(
    "SELECT * FROM calls ORDER BY started_at DESC LIMIT $1",
    [limit]
  );
  return result.rows;
}

export async function getCall(id: string): Promise<CallRow | undefined> {
  const p = getPool();
  const result = await p.query("SELECT * FROM calls WHERE id = $1", [id]);
  return result.rows[0];
}

export async function getTranscripts(callId: string): Promise<TranscriptRow[]> {
  const p = getPool();
  const result = await p.query(
    "SELECT * FROM transcripts WHERE call_id = $1 ORDER BY timestamp ASC",
    [callId]
  );
  return result.rows;
}

export async function deleteCall(id: string): Promise<void> {
  const p = getPool();
  await p.query("DELETE FROM calls WHERE id = $1", [id]);
}
