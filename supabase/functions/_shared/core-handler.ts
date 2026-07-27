import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { TdxApiClient } from './tdx-client.ts';
import { formatParkingResults, formatTrafficResults, formatError, formatRadiusText } from './formatters.ts';

// Platform-agnostic message sender interface
export interface MessageSender {
  sendText(text: string, options?: MessageOptions): Promise<void>;
  sendTextWithRadiusButtons(text: string, command: 'parking' | 'traffic'): Promise<void>;
  sendTextWithVehicleButtons?(text: string): Promise<void>;
  sendTextWithLocationRequest(text: string): Promise<void>;
}

export interface MessageOptions {
  disablePreview?: boolean;
  parseMode?: 'Markdown' | 'HTML';
}

// Core query handlers (platform-independent)

export async function handleParkingQueryCore(
  latitude: number,
  longitude: number,
  radius: number,
  userId: string,
  supabase: any,
  sender: MessageSender,
  vehicleType?: 'car' | 'motorcycle'
): Promise<void> {
  try {
    const vehicleLabel = vehicleType === 'motorcycle' ? '🏍️ 機車' : vehicleType === 'car' ? '🚗 小客車' : '🚗🏍️ 全部';
    await sender.sendText(`🔍 搜尋${vehicleLabel}停車位中...`);

    const config = await getUserConfig(userId, supabase);
    let apiKey = config?.tdx_api_key;
    let isTrialMode = false;

    if (!apiKey) {
      apiKey = TdxApiClient.DEFAULT_TRIAL_KEY;
      isTrialMode = true;

      const canUseTrial = await checkAndUpdateTrialUsage(userId, supabase);
      if (!canUseTrial) {
        const error = new Error('trial limit exceeded');
        await sender.sendText(formatError(error));
        return;
      }
    }

    const tdxClient = new TdxApiClient(apiKey);
    const results = await tdxClient.queryNearbyParking(latitude, longitude, radius, vehicleType);

    // Log query
    await supabase.from('query_logs').insert({
      user_id: userId,
      query_type: 'parking',
      latitude,
      longitude,
      radius,
      is_trial: isTrialMode,
    });

    let message = formatParkingResults(results);

    if (isTrialMode) {
      const usage = await getTrialUsage(userId, supabase);
      message += `\n\n💡 今日已試用 ${usage.usage_count}/${TdxApiClient.TRIAL_DAILY_LIMIT} 次\n請申請 TDX API Key 並使用設定功能`;
    }

    await sender.sendText(message, { parseMode: 'Markdown' });
    
    // Save results for pagination (user can type "更多" to see next page)
    if (results.length > 5) {
      await saveUserState(userId, { command: 'parking_results', lastResults: results, currentPage: 0 }, supabase);
    }
  } catch (error) {
    await sender.sendText(formatError(error as Error));
  }
}

export async function handleTrafficQueryCore(
  latitude: number,
  longitude: number,
  radius: number,
  userId: string,
  supabase: any,
  sender: MessageSender
): Promise<void> {
  try {
    await sender.sendText('🔍 查詢中...');

    const config = await getUserConfig(userId, supabase);
    const apiKey = config?.tdx_api_key;

    if (!apiKey) {
      await sender.sendText('❌ 路況查詢需要設定 TDX API Key，請使用設定功能');
      return;
    }

    const tdxClient = new TdxApiClient(apiKey);
    const results = await tdxClient.queryNearbyTraffic(latitude, longitude, radius);

    // Log query
    await supabase.from('query_logs').insert({
      user_id: userId,
      query_type: 'traffic',
      latitude,
      longitude,
      radius,
      is_trial: false,
    });

    const message = formatTrafficResults(results);
    await sender.sendText(message, { parseMode: 'Markdown' });
  } catch (error) {
    await sender.sendText(formatError(error as Error));
  }
}

export async function handlePoiSearchCore(
  query: string,
  supabase: any
): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=tw`;
    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'TrafficBot/1.0' },
    });

    if (!response.ok) return null;

    const results = await response.json();
    if (!results || results.length === 0) return null;

    const place = results[0];
    return {
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      displayName: place.display_name,
    };
  } catch (error) {
    console.error('POI search error:', error);
    return null;
  }
}

// Shared database helpers

export async function saveUserState(userId: string, state: any, supabase: any) {
  await supabase.from('user_states').upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
}

export async function getUserState(userId: string, supabase: any) {
  const { data } = await supabase.from('user_states').select('state').eq('user_id', userId).single();
  return data?.state;
}

export async function clearUserState(userId: string, supabase: any) {
  await supabase.from('user_states').delete().eq('user_id', userId);
}

export async function saveUserConfig(userId: string, config: any, supabase: any) {
  await supabase.from('user_configs').upsert({ user_id: userId, ...config, updated_at: new Date().toISOString() });
}

export async function getUserConfig(userId: string, supabase: any) {
  const { data } = await supabase.from('user_configs').select('*').eq('user_id', userId).single();
  return data;
}

export async function deleteUserConfig(userId: string, supabase: any) {
  await supabase.from('user_configs').delete().eq('user_id', userId);
}

export async function checkAndUpdateTrialUsage(userId: string, supabase: any): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  const { data: usage } = await supabase
    .from('trial_usage')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!usage) {
    await supabase.from('trial_usage').insert({
      user_id: userId,
      usage_count: 1,
      last_reset_date: today,
    });
    return true;
  }

  if (usage.last_reset_date !== today) {
    await supabase.from('trial_usage').update({
      usage_count: 1,
      last_reset_date: today,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    return true;
  }

  if (usage.usage_count >= TdxApiClient.TRIAL_DAILY_LIMIT) {
    return false;
  }

  await supabase.from('trial_usage').update({
    usage_count: usage.usage_count + 1,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return true;
}

export async function getTrialUsage(userId: string, supabase: any): Promise<{ usage_count: number }> {
  const { data } = await supabase
    .from('trial_usage')
    .select('usage_count')
    .eq('user_id', userId)
    .single();
  return data || { usage_count: 0 };
}

export async function validateTdxApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new TdxApiClient(apiKey);
    await client.getAccessToken();
    return true;
  } catch {
    return false;
  }
}

export function parseRadius(radiusStr: string): number | null {
  const match = radiusStr.match(/^(\d+)(m|km)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'km') return value * 1000;
  if (value === 250 || value === 500 || value === 1000) return value;
  return null;
}
