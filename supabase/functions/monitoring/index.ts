import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// This Edge Function is triggered by pg_cron every 15 minutes
// It calls the monitoring job to check routine routes and send notifications

serve(async (req) => {
  try {
    // Verify request is from pg_cron or authorized source
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('MONITORING_JOB_TOKEN');

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Monitoring Function] Starting monitoring task...');

    // Get the monitoring job endpoint
    const monitoringEndpoint = Deno.env.get('MONITORING_JOB_ENDPOINT');
    if (!monitoringEndpoint) {
      throw new Error('MONITORING_JOB_ENDPOINT not configured');
    }

    // Call the monitoring job
    const response = await fetch(monitoringEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Monitoring job failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Monitoring Function] Completed successfully:', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Monitoring task completed',
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Monitoring Function] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
