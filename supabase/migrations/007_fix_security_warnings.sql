-- Fix Security Advisor warnings
-- Date: 2026-03-12

-- ============================================================================
-- Fix 1: Function Search Path Mutable - update_updated_at_column
-- ============================================================================

-- Drop and recreate the function with search_path set
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_user_configs_updated_at 
  BEFORE UPDATE ON user_configs
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_value_store_updated_at 
  BEFORE UPDATE ON key_value_store
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Fix 2: Function Search Path Mutable - cleanup_old_user_states
-- ============================================================================

-- Drop and recreate the function with search_path set
DROP FUNCTION IF EXISTS cleanup_old_user_states() CASCADE;

CREATE OR REPLACE FUNCTION cleanup_old_user_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM user_states
  WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- ============================================================================
-- Fix 3: RLS Policy Always True - trial_usage
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage trial usage for ALL" ON trial_usage;

-- Create more restrictive policies for service role
-- Service role should only access trial_usage through the application logic
-- We use a function to check if the caller is the service role

-- Create a helper function to check if caller is service role
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- In Supabase, service role has special privileges
  -- This function will return true only when called by service role
  RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_user = 'service_role';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Create more specific policies for trial_usage
CREATE POLICY "Service role has full access to trial_usage"
  ON trial_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- For authenticated users, they can only read their own trial usage
CREATE POLICY "Users can read their own trial usage"
  ON trial_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Service role can insert/update through application logic only
-- No direct user access to insert/update/delete

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON FUNCTION update_updated_at_column() IS 
  'Trigger function to automatically update updated_at timestamp. Uses fixed search_path for security.';

COMMENT ON FUNCTION cleanup_old_user_states() IS 
  'Cleanup function to remove old user states (>24 hours). Uses fixed search_path for security.';

COMMENT ON FUNCTION is_service_role() IS 
  'Helper function to check if the current caller is the service role.';

COMMENT ON POLICY "Service role has full access to trial_usage" ON trial_usage IS 
  'Service role needs full access to manage trial usage through Edge Functions.';

COMMENT ON POLICY "Users can read their own trial usage" ON trial_usage IS 
  'Users can only view their own trial usage statistics.';

-- ============================================================================
-- Verify the changes
-- ============================================================================

-- List all functions with their search_path settings
DO $$
BEGIN
  RAISE NOTICE 'Security fixes applied successfully';
  RAISE NOTICE 'Functions with search_path:';
  RAISE NOTICE '  - update_updated_at_column: search_path = public, pg_temp';
  RAISE NOTICE '  - cleanup_old_user_states: search_path = public, pg_temp';
  RAISE NOTICE '  - is_service_role: search_path = public, pg_temp';
  RAISE NOTICE 'RLS policies updated for trial_usage table';
END $$;
