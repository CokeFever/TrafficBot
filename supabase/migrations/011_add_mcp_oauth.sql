-- MCP OAuth tables for Gemini Spark integration
-- See mcp/SPEC.md section 6
-- Date: 2026-08

-- ============================================================================
-- mcp_oauth_nonces: short-lived authorization nonces (Telegram binding)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_oauth_nonces (
  nonce            TEXT PRIMARY KEY,
  code_challenge   TEXT NOT NULL,          -- PKCE S256 challenge from Gemini
  code_challenge_method TEXT DEFAULT 'S256',
  redirect_uri     TEXT NOT NULL,          -- where to send the user back
  client_state     TEXT,                   -- OAuth state param (CSRF)
  telegram_user_id TEXT,                   -- filled after Telegram binding
  authorized       BOOLEAN DEFAULT FALSE,
  auth_code        TEXT,                   -- authorization code issued after binding
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL    -- typically now() + 10 minutes
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_nonces_auth_code ON mcp_oauth_nonces(auth_code);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_nonces_expires ON mcp_oauth_nonces(expires_at);

-- ============================================================================
-- mcp_oauth_tokens: issued access tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  access_token     TEXT PRIMARY KEY,
  refresh_token    TEXT,
  telegram_user_id TEXT NOT NULL,          -- links token to TrafficBot user
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL    -- access token TTL (e.g. 30 days)
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_refresh ON mcp_oauth_tokens(refresh_token);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user ON mcp_oauth_tokens(telegram_user_id);

-- ============================================================================
-- Row Level Security: service_role only (Edge Functions use service role)
-- ============================================================================
ALTER TABLE mcp_oauth_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to mcp_oauth_nonces"
  ON mcp_oauth_nonces FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to mcp_oauth_tokens"
  ON mcp_oauth_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- No access for anon/authenticated roles (OAuth is backend-managed)

-- ============================================================================
-- Cleanup function for expired nonces/tokens (call via cron or on demand)
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
END;
$$;

COMMENT ON TABLE mcp_oauth_nonces IS 'Short-lived OAuth authorization nonces for MCP (Telegram binding). Service role only.';
COMMENT ON TABLE mcp_oauth_tokens IS 'MCP OAuth access tokens linked to Telegram user IDs. Service role only.';
