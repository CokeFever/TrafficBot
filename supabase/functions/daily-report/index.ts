import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ADMIN_CHAT_ID = '57881522';

// The URL Telegram must point at for the bot to receive updates.
function expectedWebhookUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/telegram-webhook`;
}

// Check the Telegram webhook registration and, if it is missing or pointing
// at the wrong URL, re-register it automatically. Returns a short human
// readable status line to embed in the daily report / health response.
//
// This is the self-healing guard for the failure we hit on 2026-10-16: a
// cleared webhook (url: "") silently killed every bot command for weeks while
// the daily report kept saying "正常運行中". Now the daily cron (and a
// post-deploy ping) will detect and repair a dropped webhook within a day.
async function checkAndRepairWebhook(botToken: string, supabaseUrl: string): Promise<string> {
  const expected = expectedWebhookUrl(supabaseUrl);
  try {
    const infoResp = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const info = await infoResp.json();
    const current: string = info?.result?.url ?? '';
    const pending: number = info?.result?.pending_update_count ?? 0;
    const lastError: string | undefined = info?.result?.last_error_message;

    if (current === expected) {
      let line = '🔗 Webhook：正常';
      if (pending > 0) line += `（待處理 ${pending} 則）`;
      if (lastError) line += `\n   ⚠️ Telegram 最近回報錯誤：${lastError}`;
      return line;
    }

    // Webhook missing or wrong — repair it.
    console.warn(`Webhook drift detected. current="${current}" expected="${expected}". Re-registering.`);
    const setResp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: expected,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    const setResult = await setResp.json();

    if (setResult?.ok) {
      const was = current === '' ? '（原本為空）' : `（原本指向 ${current}）`;
      return `🔧 Webhook：偵測到遺失並已自動修復 ✅ ${was}`;
    }
    return `🔴 Webhook：偵測到異常但自動修復失敗，請手動重設。Telegram 回應：${JSON.stringify(setResult)}`;
  } catch (error) {
    console.error('Webhook health check failed:', error);
    return `🔴 Webhook：健康檢查失敗（${String(error)}）`;
  }
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lightweight mode: ?mode=healthcheck only verifies/repairs the Telegram
    // webhook and returns, without generating the full daily report. The CI
    // deploy workflow calls this right after a successful deploy so a dropped
    // webhook is restored immediately instead of waiting for the next cron.
    const mode = new URL(req.url).searchParams.get('mode');
    if (mode === 'healthcheck') {
      const webhookStatus = await checkAndRepairWebhook(botToken, supabaseUrl);
      console.log('Healthcheck:', webhookStatus);
      return new Response(JSON.stringify({ success: true, mode: 'healthcheck', webhookStatus }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate yesterday's date range (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000;
    const taiwanNow = new Date(now.getTime() + taiwanOffset);
    
    const yesterday = new Date(taiwanNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Yesterday 00:00:00 ~ 23:59:59 in UTC
    const startOfDay = new Date(`${yesterdayStr}T00:00:00+08:00`).toISOString();
    const endOfDay = new Date(`${yesterdayStr}T23:59:59+08:00`).toISOString();

    console.log(`Generating report for: ${yesterdayStr} (${startOfDay} ~ ${endOfDay})`);

    // 1. Total registered users (with API key configured)
    const { count: totalUsers } = await supabase
      .from('user_configs')
      .select('*', { count: 'exact', head: true });

    // 2. Total trial users ever
    const { count: totalTrialUsers } = await supabase
      .from('trial_usage')
      .select('*', { count: 'exact', head: true });

    // 3. Yesterday's queries from query_logs
    const { data: yesterdayLogs, count: totalQueriesYesterday } = await supabase
      .from('query_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // 4. Count by type
    const parkingQueries = yesterdayLogs?.filter((log: any) => log.query_type === 'parking').length || 0;
    const trafficQueries = yesterdayLogs?.filter((log: any) => log.query_type === 'traffic').length || 0;

    // 5. Unique active users yesterday
    const uniqueUsers = new Set(yesterdayLogs?.map((log: any) => log.user_id) || []);
    const activeUsersYesterday = uniqueUsers.size;

    // 6. Trial vs API key users
    const trialQueries = yesterdayLogs?.filter((log: any) => log.is_trial).length || 0;
    const apiKeyQueries = yesterdayLogs?.filter((log: any) => !log.is_trial).length || 0;

    // 7. Platform breakdown
    const telegramQueries = yesterdayLogs?.filter((log: any) => !log.user_id.startsWith('line_')).length || 0;
    const lineQueries = yesterdayLogs?.filter((log: any) => log.user_id.startsWith('line_')).length || 0;
    const telegramUsers = new Set(yesterdayLogs?.filter((log: any) => !log.user_id.startsWith('line_')).map((log: any) => log.user_id) || []);
    const lineUsers = new Set(yesterdayLogs?.filter((log: any) => log.user_id.startsWith('line_')).map((log: any) => log.user_id) || []);

    // Verify (and auto-repair) the Telegram webhook before reporting health,
    // so the daily report reflects whether the bot can actually receive
    // commands — not a hard-coded "正常運行中".
    const webhookStatus = await checkAndRepairWebhook(botToken, supabaseUrl);

    // Build report message
    const report = `
📊 泊車小弟 每日報表
━━━━━━━━━━━━━━━━
📅 統計日期：${yesterdayStr}

📈 昨日使用統計：
• 總查詢次數：${totalQueriesYesterday || 0} 次
• 停車查詢：${parkingQueries} 次
• 路況查詢：${trafficQueries} 次
• 活躍用戶：${activeUsersYesterday} 人

📱 平台分佈：
• Telegram：${telegramQueries} 次 / ${telegramUsers.size} 人
• LINE：${lineQueries} 次 / ${lineUsers.size} 人

🔑 查詢來源：
• 試用模式：${trialQueries} 次
• API Key：${apiKeyQueries} 次

👥 累計用戶：
• 已設定 API Key：${totalUsers || 0} 人
• 試用模式用戶：${totalTrialUsers || 0} 人

🏥 系統狀態：
${webhookStatus}
━━━━━━━━━━━━━━━━
    `.trim();

    // Send report to admin via Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: report,
        disable_web_page_preview: true,
      }),
    });

    if (!telegramResponse.ok) {
      const error = await telegramResponse.text();
      console.error('Failed to send Telegram message:', error);
      return new Response(JSON.stringify({ success: false, error }), { status: 500 });
    }

    console.log('Daily report sent successfully');
    return new Response(JSON.stringify({ success: true, report }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Daily report error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500 });
  }
});
