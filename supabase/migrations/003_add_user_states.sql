-- Add user_states table for tracking multi-step conversations
CREATE TABLE IF NOT EXISTS user_states (
  user_id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_states_user_id ON user_states(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_states_updated_at
  BEFORE UPDATE ON user_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-cleanup old states (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_user_states()
RETURNS void AS $$
BEGIN
  DELETE FROM user_states
  WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-user-states', '0 * * * *', 'SELECT cleanup_old_user_states()');
