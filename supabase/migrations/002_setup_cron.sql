-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the monitoring Edge Function
CREATE OR REPLACE FUNCTION trigger_monitoring_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  auth_token TEXT;
BEGIN
  -- Get configuration from environment or settings table
  -- You should set these values in your Supabase project settings
  edge_function_url := current_setting('app.monitoring_function_url', true);
  auth_token := current_setting('app.monitoring_job_token', true);

  -- Call the Edge Function
  PERFORM
    net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || auth_token
      ),
      body := '{}'::jsonb
    );
END;
$$;

-- Schedule the monitoring job to run every 15 minutes
-- This will execute at :00, :15, :30, :45 of every hour
SELECT cron.schedule(
  'monitoring-job',           -- Job name
  '*/15 * * * *',            -- Cron expression: every 15 minutes
  'SELECT trigger_monitoring_job();'
);

-- View scheduled jobs
-- SELECT * FROM cron.job;

-- To unschedule the job (for maintenance):
-- SELECT cron.unschedule('monitoring-job');

-- To manually trigger the job for testing:
-- SELECT trigger_monitoring_job();
