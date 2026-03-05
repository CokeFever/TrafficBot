import { Context } from 'telegraf';
import { TrafficService } from '../services/traffic-service';
import { ConfigService } from '../services/config-service';
import { LocationParser } from '../utils/location-parser';
import { Route } from '../models/types';

interface TrafficQueryState {
  step: 'waiting_route' | 'complete';
  route?: Route;
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
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if user is configured
    const isConfigured = await this.configService.isConfigured(userId);
    if (!isConfigured) {
      await ctx.reply('請先完成初始配置，輸入 /setup 開始設定');
      return;
    }

    // Start traffic query flow
    this.userStates.set(userId, { step: 'waiting_route' });
    await this.promptRoute(ctx);
  }

  async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state || state.step !== 'waiting_route') return;

    const text = ctx.text;
    if (!text) return;

    // Try to parse Google Maps route URL
    try {
      const route = this.locationParser.parseRouteUrl(text);
      await this.performQuery(ctx, userId, route);
    } catch (error) {
      await ctx.reply(
        '❌ 無法解析路線 URL\n\n請提供 Google Maps 路線規劃連結\n範例：https://www.google.com/maps/dir/...'
      );
    }
  }

  private async promptRoute(ctx: Context): Promise<void> {
    const message = `
🚗 請提供路線資訊

請傳送 Google Maps 路線規劃連結：

如何取得：
1. 開啟 Google Maps
2. 規劃路線（輸入起點和終點）
3. 點擊「分享」
4. 複製連結並傳送給我

請輸入路線連結：
    `.trim();

    await ctx.reply(message);
  }

  private async performQuery(ctx: Context, userId: string, route: Route): Promise<void> {
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

      // Query traffic info
      const trafficInfo = await this.trafficService.queryRouteTraffic(route, apiKey);
      const events = await this.trafficService.queryTrafficEvents(route, apiKey);

      // Format and send results
      const message = this.trafficService.formatTrafficInfo(trafficInfo, events);
      await ctx.reply(message);

      // Offer to save as routine route
      await ctx.reply('💡 您可以將此路線加入經常性路線，以接收異常通知', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ 加入經常性路線', callback_data: 'routes:add_from_traffic' }],
            [{ text: '🔄 重新查詢', callback_data: 'traffic:restart' }],
          ],
        },
      });

      // Save route temporarily for potential addition
      state.route = route;
      state.step = 'complete';
    } catch (error) {
      console.error('Traffic query error:', error);
      
      if (error instanceof Error && error.message.includes('車流查詢失敗')) {
        await ctx.reply('❌ 查詢失敗，請稍後再試');
      } else {
        await ctx.reply('❌ 無法取得車流資料，該路線可能沒有即時資訊');
      }
      
      this.userStates.delete(userId);
    }
  }

  async handleRestart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.userStates.delete(userId);
    await this.handleTraffic(ctx);
  }

  getRouteFromState(userId: string): Route | undefined {
    return this.userStates.get(userId)?.route;
  }

  clearState(userId: string): void {
    this.userStates.delete(userId);
  }
}
