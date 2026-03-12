-- Remove routine routes feature
-- This migration removes tables and functions related to the /routine feature
-- which has been deprecated in favor of manual /traffic queries

-- Drop notification records table (depends on routine_routes)
DROP TABLE IF EXISTS notification_records CASCADE;

-- Drop routine routes table
DROP TABLE IF EXISTS routine_routes CASCADE;

-- Drop monitoring function if exists
DROP FUNCTION IF EXISTS trigger_monitoring_job() CASCADE;

-- Unschedule monitoring cron job if exists
SELECT cron.unschedule('monitoring-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitoring-job'
);

-- Add comment
COMMENT ON SCHEMA public IS 'Removed routine_routes and notification_records tables. Users should use /traffic command for manual traffic queries.';
