import { Context } from 'telegraf';
import { TrafficService } from '../services/traffic-service';
import { ConfigService } from '../services/config-service';
import { LocationParser } from '../utils/location-parser';
import { Coordinates, SearchRadius } from '../models/types';

interface TrafficSearchState {
  step: 'waiting_radius' | 'waiting_location' | 'complete';
  location?: Coordinates;
  radius?: SearchRadius;
}

export class TrafficHandler {
  private trafficService: TrafficService;
  private configService: ConfigService;
  private locationParser: LocationParser;
  private userStates: Map<string, TrafficSearchState>;

  constructor(
    trafficService: TrafficService,
    configService: ConfigService,
    locationParser: LocationParser
  ) {
    this.trafficService = trafficService;
    this.configService = configService;
    this.locationParser = locationParser;
    this.userStates = new Map();
  }

  async handleTraffic(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if user is configured
    const isConfigured = await this.configService.isConfigured(userId);
    if (!isConfigured) {
      await ctx.reply('請先完成初始配置，輸入 /setup 開始設定');
      return;
    }

    // Start traffic search flow
    this.userStates.set(userId, { step: 'waiting_radius' });
    await this.promptRadius(ctx);
  }

  async handleLocation(ctx: Context, location: Coordinates): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state || state.step !== 'waiting_location') return;

    // Validate location is in Taiwan
    if (!this.locationParser.isInTaiwan(location)) {
      await ctx.reply('❌ 座標不在台灣境內，請提供台灣的位置');
      return;
    }

    // Save location and perform search
    state.location = location;
    state.step = 'complete';

    await this.performSearch(ctx, userId, location, state.radius!);
  }

  async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state || state.step !== 'waiting_location') return;

    const text = ctx.text;
    if (!text) return;

    // Try to parse Google Maps URL
    try {
      const parsed = this.locationParser.parseGoogleMapsUrl(text);
      await this.handleLocation(ctx, parsed.coordinates);
    } catch (error) {
      await ctx.reply('❌ 無法識別的位置格式，請分享 Telegram 位置或提供 Google Maps 連結');
    }
  }

  async handleRadiusSelection(ctx: Context, radius: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state || state.step !== 'waiting_radius') return;

    const radiusValue = parseInt(radius) as SearchRadius;
    state.radius = radiusValue;
    state.step = 'waiting_location';

    await this.promptLocation(ctx);
  }

  private async promptRadius(ctx: Context): Promise<void> {
    const message = '🔍 請選擇搜尋半徑：';

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '250 公尺', callback_data: 'traffic:radius:250' }],
          [{ text: '500 公尺', callback_data: 'traffic:radius:500' }],
          [{ text: '1 公里', callback_data: 'traffic:radius:1000' }],
        ],
      },
    });
  }

  private async promptLocation(ctx: Context): Promise<void> {
    const message = `
📍 請提供搜尋位置

您可以：
1. 點擊下方按鈕分享當前位置
2. 傳送 Google Maps 連結

請選擇或輸入位置：
    `.trim();

    await ctx.reply(message, {
      reply_markup: {
        keyboard: [[{ text: '📍 分享當前位置', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  private async performSearch(
    ctx: Context,
    userId: string,
    location: Coordinates,
    radius: SearchRadius
  ): Promise<void> {
    try {
      // Get user's API key
      const apiKey = await this.configService.getTdxApiKey(userId);
      if (!apiKey) {
        await ctx.reply('❌ 無法取得 API 金鑰，請重新配置');
        this.userStates.delete(userId);
        return;
      }

      // Show searching message
      await ctx.reply('🔍 搜尋中...');

      // Search traffic info
      const trafficData = await this.trafficService.queryNearbyTraffic(location, radius, apiKey);

      // Format and send results
      if (trafficData.length === 0) {
        await ctx.reply('❌ 附近沒有找到路況資訊');
      } else {
        const message = this.trafficService.formatTrafficInfo(trafficData);
        await ctx.reply(message, { parse_mode: 'Markdown' });

        if (trafficData.length > 10) {
          await ctx.reply('💡 提示：顯示前 10 個最近的路況資訊', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 重新搜尋', callback_data: 'traffic:restart' }],
              ],
            },
          });
        }
      }

      // Clean up state
      this.userStates.delete(userId);
    } catch (error) {
      console.error('Traffic search error:', error);
      await ctx.reply('❌ 查詢失敗，請稍後再試');
      this.userStates.delete(userId);
    }
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.userStates.delete(userId);
    await this.handleTraffic(ctx);
  }
}
