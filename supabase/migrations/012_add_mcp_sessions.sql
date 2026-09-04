-- MCP session store for Gemini Spark integration (Streamable HTTP transport)
-- See mcp/SPEC.md + mcp/HANDOFF.md
-- Date: 2026-09
--
-- Why: the MCP transport needs to persist session existence + metadata so the
-- initialize-issued Mcp-Session-Id remains valid across Supabase Edge Function
-- instances. The previous in-memory session adapter lost sessions whenever the
-- serverless container was recycled, which could break long-lived Gemini
-- connections. This table backs a DB SupabaseSessionAdapter.
--
-- Note: SSE event buffers (for stream resumability) are intentionally NOT
-- persisted here — they remain best-effort in-memory, since our requests are
-- short-lived and resumability is non-critical for this workload.

-- ============================================================================
-- mcp_sessions: active MCP sessions (id + negotiated metadata)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_sessions (
  session_id        TEXT PRIMARY KEY,       -- server-generated UUID
  meta              JSONB NOT NULL DEFAULT '{}'::jsonb, -- SessionMeta (protocolVersion, etc.)
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL    -- session TTL (e.g. now() + 24h)
);

CREATE INDEX IF NOT EXISTS idx_mcp_sessions_expires ON mcp_sessions(expires_at);

-- ============================================================================
-- Row Level Security: service_role only (Edge Functions use service role)
-- Idempotent: safe to re-run (ENABLE RLS is a no-op if already on; the policy
-- is dropped first so a rerun does not fail with "already exists" SQLSTATE 42710).
-- ============================================================================
ALTER TABLE mcp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to mcp_sessions" ON mcp_sessions;
CREATE POLICY "Service role full access to mcp_sessions"
  ON mcp_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- Extend the existing cleanup function to also purge expired sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_mcp_oauth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM mcp_oauth_nonces WHERE expires_at < NOW();
  DELETE FROM mcp_oauth_tokens WHERE expires_at < NOW();
  DELETE FROM mcp_sessions WHERE expires_at < NOW();
END;
$$;

COMMENT ON TABLE mcp_sessions IS 'Active MCP Streamable HTTP sessions (id + negotiated meta), persisted across Edge Function instances. Service role only.';
