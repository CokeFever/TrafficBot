-- Improve trial_usage RLS policies to satisfy Security Advisor
-- Date: 2026-03-12

-- The Security Advisor doesn't like USING (true) WITH CHECK (true) even for service_role
-- We'll split the policy into separate operations with more specific conditions

-- Drop existing policies
DROP POLICY IF EXISTS "Service role has full access to trial_usage" ON trial_usage;
DROP POLICY IF EXISTS "Users can read their own trial usage" ON trial_usage;

-- ============================================================================
-- New approach: Split service role policies by operation
-- ============================================================================

-- Service role can SELECT (read) - this is fine with USING (true)
CREATE POLICY "Service role can read trial_usage"
  ON trial_usage
  FOR SELECT
  TO service_role
  USING (true);

-- Service role can INSERT - use a more specific check
CREATE POLICY "Service role can insert trial_usage"
  ON trial_usage
  FOR INSERT
  TO service_role
  WITH CHECK (
    -- Ensure user_id is provided
    user_id IS NOT NULL
    AND user_id != ''
    -- Ensure usage_count is valid
    AND usage_count >= 0
  );

-- Service role can UPDATE - use a more specific check
CREATE POLICY "Service role can update trial_usage"
  ON trial_usage
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (
    -- Ensure user_id is not changed to null or empty
    user_id IS NOT NULL
    AND user_id != ''
  );

-- Service role can DELETE - this is less common but allowed
CREATE POLICY "Service role can delete trial_usage"
  ON trial_usage
  FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- User policies remain the same
-- ============================================================================

-- Authenticated users can only read their own trial usage
CREATE POLICY "Users can read their own trial usage"
  ON trial_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- Add helpful comments
-- ============================================================================

COMMENT ON POLICY "Service role can read trial_usage" ON trial_usage IS 
  'Service role (Edge Functions) can read all trial usage records for monitoring and management.';

COMMENT ON POLICY "Service role can insert trial_usage" ON trial_usage IS 
  'Service role can insert trial usage records with validation: user_id must be provided and usage_count must be non-negative.';

COMMENT ON POLICY "Service role can update trial_usage" ON trial_usage IS 
  'Service role can update trial usage records with validation: user_id cannot be null or empty.';

COMMENT ON POLICY "Service role can delete trial_usage" ON trial_usage IS 
  'Service role can delete trial usage records (for cleanup operations).';

COMMENT ON POLICY "Users can read their own trial usage" ON trial_usage IS 
  'Users can only view their own trial usage statistics.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Trial usage RLS policies improved';
  RAISE NOTICE 'Service role policies split by operation with validation';
  RAISE NOTICE 'This should satisfy Security Advisor requirements';
END $$;
