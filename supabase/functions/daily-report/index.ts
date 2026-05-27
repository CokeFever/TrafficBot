import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_CHAT_ID = '57881522';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

🏥 系統狀態：正常運行中
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
