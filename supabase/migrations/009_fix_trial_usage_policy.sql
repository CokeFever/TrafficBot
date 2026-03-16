-- Fix trial_usage RLS: remove the old catch-all policy that triggers Security Advisor
-- The "Service role can manage trial usage for ALL" policy was created in migration 004
-- and may still exist if 008 didn't fully clean it up

-- Drop ALL possible variants of the old policy names
DROP POLICY IF EXISTS "Service role can manage trial usage" ON trial_usage;
DROP POLICY IF EXISTS "Service role can manage trial usage for ALL" ON trial_usage;
DROP POLICY IF EXISTS "Service role has full access to trial_usage" ON trial_usage;

-- Ensure the split policies from 008 exist (idempotent)
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trial_usage' AND policyname = 'Service role can read trial_usage'
  ) THEN
    CREATE POLICY "Service role can read trial_usage"
      ON trial_usage FOR SELECT TO service_role USING (true);
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trial_usage' AND policyname = 'Service role can insert trial_usage'
  ) THEN
    CREATE POLICY "Service role can insert trial_usage"
      ON trial_usage FOR INSERT TO service_role
      WITH CHECK (user_id IS NOT NULL AND user_id != '' AND usage_count >= 0);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trial_usage' AND policyname = 'Service role can update trial_usage'
  ) THEN
    CREATE POLICY "Service role can update trial_usage"
      ON trial_usage FOR UPDATE TO service_role
      USING (true)
      WITH CHECK (user_id IS NOT NULL AND user_id != '');
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trial_usage' AND policyname = 'Service role can delete trial_usage'
  ) THEN
    CREATE POLICY "Service role can delete trial_usage"
      ON trial_usage FOR DELETE TO service_role USING (true);
  END IF;
END $$;
