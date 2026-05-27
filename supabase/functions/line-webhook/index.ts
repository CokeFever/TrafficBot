import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TdxApiClient } from '../_shared/tdx-client.ts';
import { formatParkingResults, formatTrafficResults, formatError, formatRadiusText } from '../_shared/formatters.ts';
import {
  handleParkingQueryCore,
  handleTrafficQueryCore,
  handlePoiSearchCore,
  saveUserState,
  getUserState,
  clearUserState,
  saveUserConfig,
  getUserConfig,
  deleteUserConfig,
  validateTdxApiKey,
  parseRadius,
  MessageSender,
  MessageOptions,
} from '../_shared/core-handler.ts';

// LINE Messaging API constants
const LINE_API_BASE = 'https://api.line.me/v2/bot';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  try {
    const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')!;
    const channelAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.text();

    // Verify LINE signature
    const signature = req.headers.get('x-line-signature');
    if (!signature || !await verifySignature(body, channelSecret, signature)) {
      console.error('Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const events = JSON.parse(body).events;

    for (const event of events) {
      await processEvent(event, supabase, channelAccessToken);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

async function verifySignature(body: string, channelSecret: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return base64Sig === signature;
  } catch {
    return false;
  }
}

async function processEvent(event: any, supabase: any, accessToken: string) {
  const { type, source, replyToken } = event;
  
  if (type !== 'message' && type !== 'postback') return;
  
  const userId = `line_${source.userId}`;
  const lineUserId = source.userId; // Raw LINE user ID for push messages
  const sender = createLineSender(replyToken, lineUserId, accessToken);

  if (type === 'postback') {
    await handlePostback(event.postback.data, userId, supabase, sender);
    return;
  }

  const message = event.message;

  if (message.type === 'location') {
    await handleLocation(message.latitude, message.longitude, userId, supabase, sender);
  } else if (message.type === 'text') {
    await handleTextMessage(message.text, userId, supabase, sender);
  }
}

// LINE Message Sender implementation
function createLineSender(replyToken: string, lineUserId: string, accessToken: string): MessageSender {
  let replied = false;

  const sendMessages = async (messages: any[]) => {
    if (!replied) {
      // First message: use reply
      replied = true;
      const res = await fetch(`${LINE_API_BASE}/message/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ replyToken, messages }),
      });
      if (!res.ok) {
        console.error('Reply failed:', await res.text());
      }
    } else {
      // Subsequent messages: use push
      const res = await fetch(`${LINE_API_BASE}/message/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ to: lineUserId, messages }),
      });
      if (!res.ok) {
        console.error('Push failed:', await res.text());
      }
    }
  };

  return {
    async sendText(text: string, options?: MessageOptions) {
      // LINE has 5000 char limit per message
      const truncated = text.length > 4900 ? text.substring(0, 4900) + '\n...(已截斷)' : text;
      await sendMessages([{ type: 'text', text: truncated }]);
    },

    async sendTextWithRadiusButtons(text: string, command: 'parking' | 'traffic') {
      await sendMessages([{
        type: 'template',
        altText: text,
        template: {
          type: 'buttons',
          text: text.substring(0, 60),
          actions: [
            { type: 'postback', label: '250m', data: `${command}:radius:250` },
            { type: 'postback', label: '500m', data: `${command}:radius:500` },
            { type: 'postback', label: '1km', data: `${command}:radius:1000` },
          ],
        },
      }]);
    },

    async sendTextWithLocationRequest(text: string) {
      await sendMessages([{
        type: 'text',
        text: text + '\n\n請點擊下方「+」→「位置資訊」分享你的位置，或直接輸入地點名稱',
      }]);
    },
  };
}

// Command handlers

async function handleTextMessage(text: string, userId: string, supabase: any, sender: MessageSender) {
  const trimmed = text.trim();

  // Check for commands
  if (trimmed === '停車' || trimmed === '/parking' || trimmed.startsWith('停車 ')) {
    await handleParkingCommand(trimmed, userId, supabase, sender);
    return;
  }

  if (trimmed === '路況' || trimmed === '/traffic' || trimmed.startsWith('路況 ')) {
    await handleTrafficCommand(trimmed, userId, supabase, sender);
    return;
  }

  if (trimmed === '設定' || trimmed === '/setup') {
    await handleSetupCommand(userId, supabase, sender);
    return;
  }

  if (trimmed === '狀態' || trimmed === '/config') {
    await handleConfigCommand(userId, supabase, sender);
    return;
  }

  if (trimmed === '重置' || trimmed === '/reset') {
    await handleResetCommand(userId, supabase, sender);
    return;
  }

  if (trimmed === '說明' || trimmed === '/help') {
    await sender.sendText(getHelpMessage());
    return;
  }

  // Check if it's a Google Maps URL
  if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('google.com/maps') || trimmed.includes('goo.gl/maps')) {
    await handleMapsUrl(trimmed, userId, supabase, sender);
    return;
  }

  // Check user state for ongoing flows
  const state = await getUserState(userId, supabase);
  if (!state) return;

  if (state.command === 'setup') {
    await handleSetupFlow(trimmed, state, userId, supabase, sender);
  } else if (state.command === 'parking' || state.command === 'traffic') {
    // POI search
    await handlePoiSearchFlow(trimmed, userId, supabase, sender);
  }
}

async function handleParkingCommand(text: string, userId: string, supabase: any, sender: MessageSender) {
  const parts = text.split(/\s+/);
  const radiusArg = parts.length > 1 ? parts[parts.length - 1] : null;

  if (radiusArg) {
    const radius = parseRadius(radiusArg);
    if (radius) {
      await saveUserState(userId, { command: 'parking', radius }, supabase);
      await sender.sendTextWithLocationRequest(`請分享你的位置（搜尋範圍：${formatRadiusText(radius)}）`);
    } else {
      await sender.sendText('無效的半徑參數，請使用 250m、500m 或 1km');
    }
  } else {
    await saveUserState(userId, { command: 'parking' }, supabase);
    await sender.sendTextWithRadiusButtons('請選擇搜尋範圍：', 'parking');
  }
}

async function handleTrafficCommand(text: string, userId: string, supabase: any, sender: MessageSender) {
  const config = await getUserConfig(userId, supabase);
  if (!config || !config.tdx_api_key) {
    await sender.sendText('路況查詢需要設定 TDX API Key\n請輸入「設定」開始配置');
    return;
  }

  const parts = text.split(/\s+/);
  const radiusArg = parts.length > 1 ? parts[parts.length - 1] : null;

  if (radiusArg) {
    const radius = parseRadius(radiusArg);
    if (radius) {
      await saveUserState(userId, { command: 'traffic', radius }, supabase);
      await sender.sendTextWithLocationRequest(`請分享你的位置（搜尋範圍：${formatRadiusText(radius)}）`);
    } else {
      await sender.sendText('無效的半徑參數，請使用 250m、500m 或 1km');
    }
  } else {
    await saveUserState(userId, { command: 'traffic' }, supabase);
    await sender.sendTextWithRadiusButtons('請選擇搜尋範圍：', 'traffic');
  }
}

async function handleSetupCommand(userId: string, supabase: any, sender: MessageSender) {
  await saveUserState(userId, { command: 'setup', step: 'client_id' }, supabase);
  await sender.sendText('⚙️ 設定 TDX API Key\n\n請輸入你的 TDX API Client ID：\n\n如果還沒有 API Key，請前往 https://tdx.transportdata.tw/register 申請');
}

async function handleConfigCommand(userId: string, supabase: any, sender: MessageSender) {
  const config = await getUserConfig(userId, supabase);
  if (config && config.tdx_api_key) {
    await sender.sendText('✅ 你已完成設定\n\nTDX API: 已配置');
  } else {
    await sender.sendText('❌ 尚未完成設定\n\n請輸入「設定」進行配置');
  }
}

async function handleResetCommand(userId: string, supabase: any, sender: MessageSender) {
  await deleteUserConfig(userId, supabase);
  await clearUserState(userId, supabase);
  await sender.sendText('✅ 已重置所有設定\n\n輸入「設定」重新配置');
}

async function handleLocation(latitude: number, longitude: number, userId: string, supabase: any, sender: MessageSender) {
  const state = await getUserState(userId, supabase);

  if (!state || !state.command) {
    await sender.sendText('請先選擇功能（輸入「停車」或「路況」）');
    return;
  }

  if (state.radius) {
    // Already have radius, execute query
    if (state.command === 'parking') {
      await handleParkingQueryCore(latitude, longitude, state.radius, userId, supabase, sender);
    } else if (state.command === 'traffic') {
      await handleTrafficQueryCore(latitude, longitude, state.radius, userId, supabase, sender);
    }
    await clearUserState(userId, supabase);
  } else {
    // Save location and ask for radius
    await saveUserState(userId, { ...state, latitude, longitude }, supabase);
    await sender.sendTextWithRadiusButtons('請選擇搜尋範圍：', state.command);
  }
}

async function handlePostback(data: string, userId: string, supabase: any, sender: MessageSender) {
  const state = await getUserState(userId, supabase);
  if (!state) return;

  // Parse postback data: "parking:radius:500" or "traffic:radius:1000"
  const parts = data.split(':');
  if (parts.length !== 3 || parts[1] !== 'radius') return;

  const command = parts[0];
  const radius = parseInt(parts[2]);

  if (state.latitude && state.longitude) {
    // Already have location, execute query
    if (command === 'parking') {
      await handleParkingQueryCore(state.latitude, state.longitude, radius, userId, supabase, sender);
    } else if (command === 'traffic') {
      await handleTrafficQueryCore(state.latitude, state.longitude, radius, userId, supabase, sender);
    }
    await clearUserState(userId, supabase);
  } else {
    // Save radius and ask for location
    await saveUserState(userId, { command, radius }, supabase);
    await sender.sendTextWithLocationRequest(`請分享你的位置（搜尋範圍：${formatRadiusText(radius)}）`);
  }
}

async function handleMapsUrl(text: string, userId: string, supabase: any, sender: MessageSender) {
  const state = await getUserState(userId, supabase);
  if (!state || !state.command) {
    await sender.sendText('請先選擇功能（輸入「停車」或「路況」）');
    return;
  }

  const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch ? urlMatch[1] : text.trim();

  const tempClient = new TdxApiClient('temp:temp');
  const coords = await tempClient.parseGoogleMapsUrlWithRedirect(url);

  if (!coords) {
    await sender.sendText('❌ 無法解析 Google Maps 連結\n\n請直接分享位置或輸入地點名稱');
    return;
  }

  if (state.radius) {
    if (state.command === 'parking') {
      await handleParkingQueryCore(coords.latitude, coords.longitude, state.radius, userId, supabase, sender);
    } else if (state.command === 'traffic') {
      await handleTrafficQueryCore(coords.latitude, coords.longitude, state.radius, userId, supabase, sender);
    }
    await clearUserState(userId, supabase);
  } else {
    await saveUserState(userId, { ...state, latitude: coords.latitude, longitude: coords.longitude }, supabase);
    await sender.sendTextWithRadiusButtons('請選擇搜尋範圍：', state.command);
  }
}

async function handlePoiSearchFlow(text: string, userId: string, supabase: any, sender: MessageSender) {
  const state = await getUserState(userId, supabase);
  if (!state || !state.command) return;

  if (text.length < 2) return;

  await sender.sendText(`🔍 搜尋「${text}」...`);

  const result = await handlePoiSearchCore(text, supabase);
  if (!result) {
    await sender.sendText('❌ 找不到此地點，請嘗試其他關鍵字或直接分享位置');
    return;
  }

  if (state.radius) {
    await sender.sendText(`📍 ${result.displayName}`);
    if (state.command === 'parking') {
      await handleParkingQueryCore(result.latitude, result.longitude, state.radius, userId, supabase, sender);
    } else if (state.command === 'traffic') {
      await handleTrafficQueryCore(result.latitude, result.longitude, state.radius, userId, supabase, sender);
    }
    await clearUserState(userId, supabase);
  } else {
    await saveUserState(userId, { ...state, latitude: result.latitude, longitude: result.longitude }, supabase);
    await sender.sendText(`📍 ${result.displayName}`);
    await sender.sendTextWithRadiusButtons('請選擇搜尋範圍：', state.command);
  }
}

async function handleSetupFlow(text: string, state: any, userId: string, supabase: any, sender: MessageSender) {
  if (state.step === 'client_id') {
    await saveUserState(userId, { command: 'setup', step: 'client_secret', client_id: text }, supabase);
    await sender.sendText('請輸入你的 TDX API Client Secret：');
  } else if (state.step === 'client_secret') {
    const apiKey = `${state.client_id}:${text}`;
    await sender.sendText('⏳ 驗證 API Key...');

    const isValid = await validateTdxApiKey(apiKey);
    if (isValid) {
      await saveUserConfig(userId, { tdx_api_key: apiKey }, supabase);
      await clearUserState(userId, supabase);
      await sender.sendText('✅ 設定完成！\n\n你現在可以使用停車和路況查詢功能');
    } else {
      await sender.sendText('❌ API Key 驗證失敗\n\n請檢查你的 Client ID 和 Client Secret 是否正確\n\n輸入「設定」重新設定');
      await clearUserState(userId, supabase);
    }
  }
}

function getHelpMessage(): string {
  return `
📖 泊車小弟 使用說明

✅ 功能：
「停車」查詢附近車位 [250m, 500m, 1km]
  例如：停車 或 停車 500m

「路況」查詢附近路況 [250m, 500m, 1km]
  例如：路況 或 路況 1km

📍 位置可以直接分享位置、貼上 Google Maps 連結、或輸入地點名稱

⚙️ 設定：
「設定」- 設定個人 TDX API Key
「狀態」- 查看目前設定狀況
「重置」- 重置設定

💡 試用：每天可免費查詢 5 次，設定個人 API Key 後無限制

有問題請洽 https://ixo.app
  `.trim();
}
