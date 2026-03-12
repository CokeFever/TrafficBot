-- Enable Row Level Security (RLS) on all tables
-- This migration addresses Supabase security recommendations

-- Enable RLS on user_configs
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on routine_routes
ALTER TABLE routine_routes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notification_records
ALTER TABLE notification_records ENABLE ROW LEVEL SECURITY;

-- Enable RLS on cache_entries
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on key_value_store
ALTER TABLE key_value_store ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_states (if exists)
ALTER TABLE IF EXISTS user_states ENABLE ROW LEVEL SECURITY;

-- Enable RLS on trial_usage (if exists)
ALTER TABLE IF EXISTS trial_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for user_configs
-- ============================================================================

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role has full access to user_configs"
  ON user_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only read/update their own config
CREATE POLICY "Users can read their own config"
  ON user_configs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own config"
  ON user_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own config"
  ON user_configs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own config"
  ON user_configs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- RLS Policies for routine_routes
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role has full access to routine_routes"
  ON routine_routes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only access their own routes
CREATE POLICY "Users can read their own routes"
  ON routine_routes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own routes"
  ON routine_routes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own routes"
  ON routine_routes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own routes"
  ON routine_routes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- RLS Policies for notification_records
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role has full access to notification_records"
  ON notification_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only read their own notifications
CREATE POLICY "Users can read their own notifications"
  ON notification_records
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- RLS Policies for cache_entries
-- ============================================================================

-- Service role has full access (cache is managed by backend)
CREATE POLICY "Service role has full access to cache_entries"
  ON cache_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No direct user access to cache

-- ============================================================================
-- RLS Policies for key_value_store
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role has full access to key_value_store"
  ON key_value_store
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No direct user access to key_value_store

-- ============================================================================
-- RLS Policies for user_states
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role has full access to user_states"
  ON user_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only access their own state
CREATE POLICY "Users can read their own state"
  ON user_states
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own state"
  ON user_states
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own state"
  ON user_states
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own state"
  ON user_states
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- RLS Policies for trial_usage
-- ============================================================================

-- Service role has full access
CREATE POLICY "Service role has full access to trial_usage"
  ON trial_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only read their own trial usage
CREATE POLICY "Users can read their own trial usage"
  ON trial_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE user_configs IS 'Stores user configuration including TDX API keys. Protected by RLS.';
COMMENT ON TABLE routine_routes IS 'Stores user routine routes for monitoring. Protected by RLS.';
COMMENT ON TABLE notification_records IS 'Stores notification history. Protected by RLS.';
COMMENT ON TABLE cache_entries IS 'Internal cache storage. Service role only.';
COMMENT ON TABLE key_value_store IS 'General key-value storage. Service role only.';

-- ============================================================================
-- Security Notes
-- ============================================================================

-- 1. Service role (used by Edge Functions) has full access to all tables
-- 2. Authenticated users can only access their own data (filtered by user_id)
-- 3. Anonymous users have no access
-- 4. Cache and key_value_store are backend-only (no user access)
-- 5. All policies use auth.uid() to ensure users can only access their own data

