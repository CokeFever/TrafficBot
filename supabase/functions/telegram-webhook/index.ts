import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TdxApiClient } from '../_shared/tdx-client.ts';
import { formatParkingResults, formatTrafficResults, formatError, formatRadiusText } from '../_shared/formatters.ts';

// Initialize bot commands on startup
async function initializeBotCommands(botToken: string) {
  const commands = [
    { command: 'start', description: '開始使用' },
    { command: 'help', description: '查看說明' },
    { command: 'parking', description: '搜尋附近停車位' },
    { command: 'traffic', description: '查詢附近路況' },
    { command: 'setup', description: '設定 TDX API Key' },
    { command: 'config', description: '查看當前配置' },
    { command: 'reset', description: '重置配置' },
  ];
  
  try {
    const url = `https://api.telegram.org/bot${botToken}/setMyCommands`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    console.log('Bot commands initialized');
  } catch (error) {
    console.error('Failed to initialize bot commands:', error);
  }
}

serve(async (req) => {
  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse Telegram update
    const update = await req.json();
    console.log('Received update:', JSON.stringify(update));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get bot token from environment
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

    // Process the update
    await processUpdate(update, supabase, botToken);

    // Return success response
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Return 200 to prevent Telegram from retrying
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function processUpdate(update: any, supabase: any, botToken: string) {
  // Extract message or callback query
  const message = update.message;
  const callbackQuery = update.callback_query;

  if (message) {
    await handleMessage(message, supabase, botToken);
  } else if (callbackQuery) {
    await handleCallbackQuery(callbackQuery, supabase, botToken);
  }
}

async function handleMessage(message: any, supabase: any, botToken: string) {
  const chatId = message.chat.id;
  const userId = message.from.id.toString();
  const text = message.text;

  // Handle commands
  if (text && text.startsWith('/')) {
    const [command, ...args] = text.slice(1).split(' ');
    await handleCommand(command, args, chatId, userId, supabase, botToken);
    return;
  }

  // Handle location
  if (message.location) {
    await handleLocation(message.location, chatId, userId, supabase, botToken);
    return;
  }

  // Handle text messages (for multi-step flows)
  if (text) {
    await handleTextMessage(text, chatId, userId, supabase, botToken);
    return;
  }
}

async function handleCommand(
  command: string,
  args: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  console.log(`Handling command: /${command}`, args);

  switch (command) {
    case 'start':
      await sendMessage(chatId, getWelcomeMessage(), botToken);
      break;
    case 'help':
      await sendMessage(chatId, getHelpMessage(), botToken, { disable_web_page_preview: true, parse_mode: 'Markdown' });
      break;
    case 'parking':
      await handleParkingCommand(args, chatId, userId, supabase, botToken);
      break;
    case 'traffic':
      await handleTrafficCommand(args, chatId, userId, supabase, botToken);
      break;
    case 'setup':
      await handleSetupCommand(chatId, userId, supabase, botToken);
      break;
    case 'config':
      await handleConfigCommand(chatId, userId, supabase, botToken);
      break;
    case 'reset':
      await handleResetCommand(chatId, userId, supabase, botToken);
      break;
    default:
      await sendMessage(chatId, '無效的指令，輸入 /help 查看可用指令', botToken);
  }
}

async function handleParkingCommand(
  args: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  // Check if radius parameter is provided
  if (args.length > 0) {
    const radius = parseRadius(args[0]);
    if (radius) {
      // Save radius to user state and request location
      await saveUserState(userId, { command: 'parking', radius }, supabase);
      await sendMessage(
        chatId,
        `請分享你的位置，我將搜尋 ${args[0]} 範圍內的停車場`,
        botToken,
        {
          reply_markup: {
            keyboard: [[{ text: '📍 分享位置', request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    } else {
      await sendMessage(chatId, '無效的半徑參數，請使用 500m、1km 或 2km', botToken);
    }
  } else {
    // No parameter, show radius selection
    await saveUserState(userId, { command: 'parking' }, supabase);
    await sendMessage(chatId, '請選擇搜尋範圍：', botToken, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '250m', callback_data: 'parking:radius:250' },
            { text: '500m', callback_data: 'parking:radius:500' },
            { text: '1km', callback_data: 'parking:radius:1000' },
          ],
        ],
      },
    });
  }
}

async function handleTrafficCommand(
  args: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  // Check if user is configured
  const config = await getUserConfig(userId, supabase);
  if (!config || !config.tdx_api_key) {
    await sendMessage(chatId, '請先完成初始配置，輸入 /setup 開始設定', botToken);
    return;
  }

  // Similar to parking command
  if (args.length > 0) {
    const radius = parseRadius(args[0]);
    if (radius) {
      await saveUserState(userId, { command: 'traffic', radius }, supabase);
      await sendMessage(
        chatId,
        `請分享你的位置，我將查詢 ${args[0]} 範圍內的路況資訊`,
        botToken,
        {
          reply_markup: {
            keyboard: [[{ text: '📍 分享位置', request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    } else {
      await sendMessage(chatId, '無效的半徑參數，請使用 500m、1km 或 2km', botToken);
    }
  } else {
    // No parameter, show radius selection
    await saveUserState(userId, { command: 'traffic' }, supabase);
    await sendMessage(chatId, '請選擇搜尋範圍：', botToken, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '250m', callback_data: 'traffic:radius:250' },
            { text: '500m', callback_data: 'traffic:radius:500' },
            { text: '1km', callback_data: 'traffic:radius:1000' },
          ],
        ],
      },
    });
  }
}

async function handleRoutesCommand(
  args: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  await saveUserState(userId, { command: 'setup', step: 'client_id' }, supabase);
  await sendMessage(
    chatId,
    '⚙️ 初始設定\n\n請輸入你的 TDX API Client ID：\n\n如果還沒有 API Key，請前往 https://tdx.transportdata.tw/ 申請',
    botToken
  );
}

async function handleConfigCommand(
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  const config = await getUserConfig(userId, supabase);
  if (config && config.tdx_api_key) {
    await sendMessage(chatId, '✅ 你已完成設定\n\nTDX API: 已配置', botToken);
  } else {
    await sendMessage(chatId, '❌ 尚未完成設定\n\n請使用 /setup 進行配置', botToken);
  }
}

async function handleResetCommand(
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  await sendMessage(chatId, '確定要重置所有設定嗎？', botToken, {
    reply_markup: {
      inline_keyboard: [[{ text: '確認重置', callback_data: 'reset:confirm' }]],
    },
  });
}

async function handleLocation(
  location: any,
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  const state = await getUserState(userId, supabase);
  
  if (!state || !state.command) {
    await sendMessage(chatId, '請先選擇功能（/parking 或 /traffic）', botToken);
    return;
  }

  const { latitude, longitude } = location;

  if (state.command === 'parking') {
    if (state.radius) {
      // Radius already selected, query directly
      await handleParkingQuery(latitude, longitude, state.radius, chatId, userId, supabase, botToken);
      await clearUserState(userId, supabase);
    } else {
      // Save location and ask for radius
      await saveUserState(userId, { ...state, latitude, longitude }, supabase);
      await sendMessage(chatId, '請選擇搜尋範圍：', botToken, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '250m', callback_data: 'parking:radius:250' },
              { text: '500m', callback_data: 'parking:radius:500' },
              { text: '1km', callback_data: 'parking:radius:1000' },
            ],
          ],
        },
      });
    }
  } else if (state.command === 'traffic') {
    if (state.radius) {
      await handleTrafficQuery(latitude, longitude, state.radius, chatId, userId, supabase, botToken);
      await clearUserState(userId, supabase);
    }
  }
}

async function handleTextMessage(
  text: string,
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  const state = await getUserState(userId, supabase);
  
  // Check if it's a Google Maps URL (handle even without state)
  if (text.includes('maps.app.goo.gl') || text.includes('google.com/maps') || text.includes('goo.gl/maps')) {
    await handleMapsUrl(text, chatId, userId, supabase, botToken);
    return;
  }
  
  if (!state || !state.command) {
    return;
  }

  if (state.command === 'setup') {
    await handleSetupFlow(text, state.step, chatId, userId, supabase, botToken);
  }
}

async function handleMapsUrl(
  text: string,
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  const state = await getUserState(userId, supabase);
  
  if (!state || !state.command) {
    await sendMessage(chatId, '請先選擇功能（/parking 或 /traffic）', botToken);
    return;
  }

  // Extract URL from text (user might paste URL with extra text)
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch ? urlMatch[1] : text.trim();
  
  console.log('Extracted URL:', url);

  // Parse URL using TdxApiClient (with redirect support for short links)
  const tempClient = new TdxApiClient('temp:temp');
  const coords = await tempClient.parseGoogleMapsUrlWithRedirect(url);

  if (!coords) {
    await sendMessage(
      chatId,
      '❌ 無法解析 Google Maps 連結\n\n請提供包含座標的連結，或直接分享 Telegram 位置',
      botToken
    );
    return;
  }

  // Process based on command
  if (state.command === 'parking') {
    if (state.radius) {
      await handleParkingQuery(coords.latitude, coords.longitude, state.radius, chatId, userId, supabase, botToken);
      await clearUserState(userId, supabase);
    } else {
      // Ask for radius
      await saveUserState(userId, { ...state, latitude: coords.latitude, longitude: coords.longitude }, supabase);
      await sendMessage(chatId, '請選擇搜尋範圍：', botToken, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '250m', callback_data: 'parking:radius:250' },
              { text: '500m', callback_data: 'parking:radius:500' },
              { text: '1km', callback_data: 'parking:radius:1000' },
            ],
          ],
        },
      });
    }
  } else if (state.command === 'traffic') {
    if (state.radius) {
      await handleTrafficQuery(coords.latitude, coords.longitude, state.radius, chatId, userId, supabase, botToken);
      await clearUserState(userId, supabase);
    }
  }
}

async function handleSetupFlow(
  text: string,
  step: string,
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  if (step === 'client_id') {
    // Save client ID and ask for client secret
    await saveUserState(userId, { command: 'setup', step: 'client_secret', client_id: text }, supabase);
    await sendMessage(chatId, '請輸入你的 TDX API Client Secret：', botToken);
  } else if (step === 'client_secret') {
    // Combine and validate API key
    const state = await getUserState(userId, supabase);
    const apiKey = `${state.client_id}:${text}`;
    
    await sendMessage(chatId, '⏳ 驗證 API Key...', botToken);
    
    // Validate API key (call TDX API)
    const isValid = await validateTdxApiKey(apiKey);
    
    if (isValid) {
      // Save to user config
      await saveUserConfig(userId, { tdx_api_key: apiKey }, supabase);
      await clearUserState(userId, supabase);
      await sendMessage(chatId, '✅ 設定完成！\n\n你現在可以使用 /parking 查詢停車位', botToken);
    } else {
      await sendMessage(chatId, '❌ API Key 驗證失敗\n\n請檢查你的 Client ID 和 Client Secret 是否正確\n\n使用 /setup 重新設定', botToken);
      await clearUserState(userId, supabase);
    }
  }
}

async function handleCallbackQuery(callbackQuery: any, supabase: any, botToken: string) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id.toString();
  const data = callbackQuery.data;

  const [action, ...params] = data.split(':');

  if (action === 'parking') {
    await handleParkingCallback(params, chatId, userId, supabase, botToken);
  } else if (action === 'traffic') {
    await handleTrafficCallback(params, chatId, userId, supabase, botToken);
  } else if (action === 'reset') {
    await handleResetCallback(params, chatId, userId, supabase, botToken);
  }

  // Answer callback query
  await answerCallbackQuery(callbackQuery.id, botToken);
}

async function handleParkingCallback(
  params: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  if (params[0] === 'radius') {
    const radius = parseInt(params[1]);
    const state = await getUserState(userId, supabase);
    
    if (state && state.latitude && state.longitude) {
      // Location already provided, query directly
      await handleParkingQuery(state.latitude, state.longitude, radius, chatId, userId, supabase, botToken);
      await clearUserState(userId, supabase);
    } else {
      // Save radius and ask for location
      await saveUserState(userId, { command: 'parking', radius }, supabase);
      await sendMessage(chatId, `請分享你的位置（搜尋範圍：${formatRadiusText(radius)}）`, botToken, {
        reply_markup: {
          keyboard: [[{ text: '📍 分享位置', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
  }
}

async function handleTrafficCallback(
  params: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  if (params[0] === 'radius') {
    const radius = parseInt(params[1]);
    const state = await getUserState(userId, supabase);
    
    if (state && state.latitude && state.longitude) {
      // Location already provided, query directly
      await handleTrafficQuery(state.latitude, state.longitude, radius, chatId, userId, supabase, botToken);
      await clearUserState(userId, supabase);
    } else {
      // Save radius and ask for location
      await saveUserState(userId, { command: 'traffic', radius }, supabase);
      await sendMessage(chatId, `請分享你的位置（搜尋範圍：${formatRadiusText(radius)}）`, botToken, {
        reply_markup: {
          keyboard: [[{ text: '📍 分享位置', request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
  }
}

async function handleResetCallback(
  params: string[],
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  if (params[0] === 'confirm') {
    await deleteUserConfig(userId, supabase);
    await clearUserState(userId, supabase);
    await sendMessage(chatId, '✅ 已重置所有設定\n\n使用 /setup 重新配置', botToken);
  }
}

async function handleParkingQuery(
  latitude: number,
  longitude: number,
  radius: number,
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  try {
    await sendMessage(chatId, '🔍 查詢中...', botToken, {
      reply_markup: { remove_keyboard: true }
    });
    
    // Get user's TDX API key or use trial key
    const config = await getUserConfig(userId, supabase);
    let apiKey = config?.tdx_api_key;
    let isTrialMode = false;
    
    if (!apiKey) {
      // Use trial key
      apiKey = TdxApiClient.DEFAULT_TRIAL_KEY;
      isTrialMode = true;
      
      // Check trial usage
      const canUseTrial = await checkAndUpdateTrialUsage(userId, supabase);
      if (!canUseTrial) {
        const error = new Error('trial limit exceeded');
        const errorMessage = formatError(error);
        await sendMessage(chatId, errorMessage, botToken);
        return;
      }
    }

    // Query parking
    const tdxClient = new TdxApiClient(apiKey);
    const results = await tdxClient.queryNearbyParking(latitude, longitude, radius);

    // Format and send results
    let message = formatParkingResults(results);
    
    // Add trial mode notice
    if (isTrialMode) {
      const usage = await getTrialUsage(userId, supabase);
      message += `\n\n💡 今日已試用 ${usage.usage_count}/${TdxApiClient.TRIAL_DAILY_LIMIT} 次\n請申請 TDX API Key 並使用 /setup 設定`;
    }
    
    await sendMessage(chatId, message, botToken, { parse_mode: 'Markdown' });
  } catch (error) {
    const errorMessage = formatError(error as Error);
    await sendMessage(chatId, errorMessage, botToken);
  }
}

async function handleTrafficQuery(
  latitude: number,
  longitude: number,
  radius: number,
  chatId: number,
  userId: string,
  supabase: any,
  botToken: string
) {
  try {
    await sendMessage(chatId, '🔍 查詢中...', botToken, {
      reply_markup: { remove_keyboard: true }
    });
    
    // Get user's TDX API key
    const config = await getUserConfig(userId, supabase);
    const apiKey = config?.tdx_api_key;
    
    if (!apiKey) {
      await sendMessage(chatId, '❌ 無法取得 API 金鑰，請使用 /setup 重新配置', botToken);
      return;
    }

    // Query traffic
    const tdxClient = new TdxApiClient(apiKey);
    const results = await tdxClient.queryNearbyTraffic(latitude, longitude, radius);

    // Format and send results
    const message = formatTrafficResults(results);
    await sendMessage(chatId, message, botToken, { parse_mode: 'Markdown' });
  } catch (error) {
    const errorMessage = formatError(error as Error);
    await sendMessage(chatId, errorMessage, botToken);
  }
}

// Helper functions

function parseRadius(radiusStr: string): number | null {
  const match = radiusStr.match(/^(\d+)(m|km)$/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  if (unit === 'km') {
    return value * 1000;
  }
  return value;
}

async function sendMessage(chatId: number, text: string, botToken: string, options?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('Failed to send message:', await response.text());
  }
}

async function answerCallbackQuery(callbackQueryId: string, botToken: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

async function saveUserState(userId: string, state: any, supabase: any) {
  await supabase
    .from('user_states')
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
}

async function getUserState(userId: string, supabase: any) {
  const { data } = await supabase
    .from('user_states')
    .select('state')
    .eq('user_id', userId)
    .single();
  return data?.state;
}

async function clearUserState(userId: string, supabase: any) {
  await supabase.from('user_states').delete().eq('user_id', userId);
}

async function saveUserConfig(userId: string, config: any, supabase: any) {
  await supabase
    .from('user_configs')
    .upsert({ user_id: userId, ...config, updated_at: new Date().toISOString() });
}

async function getUserConfig(userId: string, supabase: any) {
  const { data } = await supabase
    .from('user_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

async function deleteUserConfig(userId: string, supabase: any) {
  await supabase.from('user_configs').delete().eq('user_id', userId);
}

async function checkAndUpdateTrialUsage(userId: string, supabase: any): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get current usage
  const { data: usage } = await supabase
    .from('trial_usage')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (!usage) {
    // First time user, create record
    await supabase
      .from('trial_usage')
      .insert({
        user_id: userId,
        usage_count: 1,
        last_reset_date: today,
      });
    return true;
  }
  
  // Check if need to reset (new day)
  if (usage.last_reset_date !== today) {
    await supabase
      .from('trial_usage')
      .update({
        usage_count: 1,
        last_reset_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return true;
  }
  
  // Check if limit exceeded
  if (usage.usage_count >= TdxApiClient.TRIAL_DAILY_LIMIT) {
    return false;
  }
  
  // Increment usage
  await supabase
    .from('trial_usage')
    .update({
      usage_count: usage.usage_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  
  return true;
}

async function getTrialUsage(userId: string, supabase: any): Promise<{ usage_count: number }> {
  const { data } = await supabase
    .from('trial_usage')
    .select('usage_count')
    .eq('user_id', userId)
    .single();
  
  return data || { usage_count: 0 };
}

async function validateTdxApiKey(apiKey: string): Promise<boolean> {
  try {
    // Get access token
    const [clientId, clientSecret] = apiKey.split(':');
    const tokenUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      return false;
    }

    const tokenData = await tokenResponse.json();
    return !!tokenData.access_token;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
}

function getWelcomeMessage(): string {
  return `
🚗 歡迎使用泊車小弟！

✅ 功能：
• /parking - 查詢附近停車位
• /traffic - 查詢附近路況

💡 試用：每天可免費查詢 5 次，設定個人 API Key 後無限制

輸入 /help 查看詳細說明
  `.trim();
}

function getHelpMessage(): string {
  return `
📖 泊車小弟 使用說明

✅ 功能：
/parking 查詢附近車位 [250m, 500m, 1km]
  例如：/parking 或 /parking 500m
  顯示車位、導航、空位、價格等資訊

/traffic 查詢附近路況 [250m, 500m, 1km]
  例如：/traffic 或 /traffic 1km
  顯示壅塞、事故、施工等資訊

📍 位置可以直接使用 Telegram 分享位置 或 貼上 Google Maps 連結

⚙️ 設定：
/setup - 設定個人 TDX API Key \([免費註冊](https://tdx.transportdata.tw/register)\)
/config - 查看目前設定狀況
/reset - 重置設定 (清除 API Client ID & Secret)

💡 試用：每天可免費查詢 5 次，設定個人 API Key 後無限制

有問題請洽 https://ixo.app
  `.trim();
}
