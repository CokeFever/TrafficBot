import { Context } from 'telegraf';
import { TrafficService } from '../services/traffic-service';
import { ConfigService } from '../services/config-service';
import { LocationParser } from '../utils/location-parser';
import { Coordinates } from '../models/types';

interface TrafficQueryState {
  step: 'waiting_location' | 'complete';
  location?: Coordinates;
}

export class TrafficHandler {
  private trafficService: TrafficService;
  private configService: ConfigService;
  private locationParser: LocationParser;
  private userStates: Map<string, TrafficQueryState>;

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
    await ctx.reply('🚧 車流查詢功能開發中，敬請期待！\n\n目前可使用：\n• /parking - 停車位查詢');
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

    // Save location and perform query
    state.location = location;
    state.step = 'complete';

    await this.performQuery(ctx, userId, location);
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

  // Kept for future implementation
  // private async promptLocation(ctx: Context): Promise<void> {
  //   const message = `
  // 🚗 請提供查詢位置
  // 您可以：
  // 1. 點擊下方按鈕分享當前位置
  // 2. 傳送 Google Maps 連結
  // 請選擇或輸入位置：
  //   `.trim();
  //   await ctx.reply(message, {
  //     reply_markup: {
  //       keyboard: [[{ text: '📍 分享當前位置', request_location: true }]],
  //       resize_keyboard: true,
  //       one_time_keyboard: true,
  //     },
  //   });
  // }

  private async performQuery(ctx: Context, userId: string, location: Coordinates): Promise<void> {
    try {
      // Get user's API key
      const apiKey = await this.configService.getTdxApiKey(userId);
      if (!apiKey) {
        await ctx.reply('❌ 無法取得 API 金鑰，請重新配置');
        this.userStates.delete(userId);
        return;
      }

      // Show querying message
      await ctx.reply('🔍 查詢中...');

      // Query traffic info (2km radius)
      const trafficInfo = await this.trafficService.queryNearbyTraffic(location, 2000, apiKey);

      // Format and send results
      const message = this.trafficService.formatTrafficInfo(trafficInfo);
      await ctx.reply(message);

      // Clean up state
      this.userStates.delete(userId);
    } catch (error) {
      console.error('Traffic query error:', error);
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

  getRouteFromState(_userId: string): any {
    // Kept for compatibility with routes handler
    return undefined;
  }

  clearState(userId: string): void {
    this.userStates.delete(userId);
  }
}
