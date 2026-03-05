import { Context } from 'telegraf';
import { ParkingService } from '../services/parking-service';
import { ConfigService } from '../services/config-service';
import { LocationParser } from '../utils/location-parser';
import { Coordinates, SearchRadius } from '../models/types';

interface ParkingSearchState {
  step: 'waiting_location' | 'waiting_radius' | 'complete';
  location?: Coordinates;
  radius?: SearchRadius;
}

export class ParkingHandler {
  private parkingService: ParkingService;
  private configService: ConfigService;
  private locationParser: LocationParser;
  private userStates: Map<string, ParkingSearchState>;

  constructor(
    parkingService: ParkingService,
    configService: ConfigService,
    locationParser: LocationParser
  ) {
    this.parkingService = parkingService;
    this.configService = configService;
    this.locationParser = locationParser;
    this.userStates = new Map();
  }

  async handleParking(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if user is configured
    const isConfigured = await this.configService.isConfigured(userId);
    if (!isConfigured) {
      await ctx.reply('請先完成初始配置，輸入 /setup 開始設定');
      return;
    }

    // Start parking search flow
    this.userStates.set(userId, { step: 'waiting_location' });
    await this.promptLocation(ctx);
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

    // Save location and prompt for radius
    state.location = location;
    state.step = 'waiting_radius';

    await this.promptRadius(ctx);
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
    if (!state || !state.location) return;

    const radiusValue = parseInt(radius) as SearchRadius;
    state.radius = radiusValue;
    state.step = 'complete';

    await this.performSearch(ctx, userId, state.location, radiusValue);
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

  private async promptRadius(ctx: Context): Promise<void> {
    const message = '🔍 請選擇搜尋半徑：';

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '500 公尺', callback_data: 'parking:radius:500' }],
          [{ text: '1 公里', callback_data: 'parking:radius:1000' }],
          [{ text: '2 公里', callback_data: 'parking:radius:2000' }],
        ],
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

      // Search parking facilities
      const facilities = await this.parkingService.searchNearby(location, radius, apiKey);

      // Format and send results
      if (facilities.length === 0) {
        await ctx.reply('❌ 附近沒有找到停車場');
      } else {
        const message = this.parkingService.formatParkingInfo(facilities);
        await ctx.reply(message, { parse_mode: 'Markdown' });

        if (facilities.length > 10) {
          await ctx.reply('💡 提示：顯示前 10 個最近的停車場', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 重新搜尋', callback_data: 'parking:restart' }],
              ],
            },
          });
        }
      }

      // Clean up state
      this.userStates.delete(userId);
    } catch (error) {
      console.error('Parking search error:', error);
      await ctx.reply('❌ 查詢失敗，請稍後再試');
      this.userStates.delete(userId);
    }
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.userStates.delete(userId);
    await this.handleParking(ctx);
  }
}
