-- Add query logs table for daily statistics
-- This table records each query for accurate daily reporting

CREATE TABLE IF NOT EXISTS query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  query_type TEXT NOT NULL, -- 'parking' or 'traffic'
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius INTEGER,
  is_trial BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for daily statistics queries
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_query_logs_user_id ON query_logs(user_id);

-- Enable RLS
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role can read query_logs"
  ON query_logs FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role can insert query_logs"
  ON query_logs FOR INSERT TO service_role
  WITH CHECK (user_id IS NOT NULL AND user_id != '');

-- Auto-cleanup: delete logs older than 90 days (optional, run manually or via cron)
-- DELETE FROM query_logs WHERE created_at < NOW() - INTERVAL '90 days';
