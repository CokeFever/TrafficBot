import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_CHAT_ID = '57881522';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // 1. Total registered users (with API key configured)
    const { count: totalUsers } = await supabase
      .from('user_configs')
      .select('*', { count: 'exact', head: true });

    // 2. Total trial users (used trial mode)
    const { count: totalTrialUsers } = await supabase
      .from('trial_usage')
      .select('*', { count: 'exact', head: true });

    // 3. Active users today (trial users who queried today)
    const { count: activeToday } = await supabase
      .from('trial_usage')
      .select('*', { count: 'exact', head: true })
      .eq('last_reset_date', todayStr);

    // 4. Active users yesterday
    const { count: activeYesterday } = await supabase
      .from('trial_usage')
      .select('*', { count: 'exact', head: true })
      .eq('last_reset_date', yesterdayStr);

    // 5. Total queries today (sum of usage_count for today)
    const { data: todayUsage } = await supabase
      .from('trial_usage')
      .select('usage_count')
      .eq('last_reset_date', todayStr);

    const totalQueriesToday = todayUsage?.reduce((sum: number, row: any) => sum + (row.usage_count || 0), 0) || 0;

    // 6. Total queries yesterday
    const { data: yesterdayUsage } = await supabase
      .from('trial_usage')
      .select('usage_count')
      .eq('last_reset_date', yesterdayStr);

    const totalQueriesYesterday = yesterdayUsage?.reduce((sum: number, row: any) => sum + (row.usage_count || 0), 0) || 0;

    // Build report message
    const report = `
📊 泊車小弟 每日報表
━━━━━━━━━━━━━━━━
📅 日期：${todayStr}

👥 用戶統計：
• 已設定 API Key：${totalUsers || 0} 人
• 試用模式用戶：${totalTrialUsers || 0} 人

📈 今日活躍：
• 活躍用戶：${activeToday || 0} 人
• 查詢次數：${totalQueriesToday} 次

📉 昨日數據：
• 活躍用戶：${activeYesterday || 0} 人
• 查詢次數：${totalQueriesYesterday} 次

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
