import { Context } from 'telegraf';
import { RouteService } from '../services/route-service';
import { ConfigService } from '../services/config-service';
import { LocationParser } from '../utils/location-parser';
import { Route, RoutineRoute, NotificationPreferences } from '../models/types';

interface RouteManagementState {
  action: 'add' | 'view' | 'delete' | 'edit' | null;
  step?: string;
  routeName?: string;
  route?: Route;
  routeId?: string;
  notificationEnabled?: boolean;
}

export class RoutesHandler {
  private routeService: RouteService;
  private configService: ConfigService;
  private locationParser: LocationParser;
  private userStates: Map<string, RouteManagementState>;

  constructor(
    routeService: RouteService,
    configService: ConfigService,
    locationParser: LocationParser
  ) {
    this.routeService = routeService;
    this.configService = configService;
    this.locationParser = locationParser;
    this.userStates = new Map();
  }

  async handleRoutes(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if user is configured
    const isConfigured = await this.configService.isConfigured(userId);
    if (!isConfigured) {
      await ctx.reply('請先完成初始配置，輸入 /setup 開始設定');
      return;
    }

    await this.showMainMenu(ctx);
  }

  private async showMainMenu(ctx: Context): Promise<void> {
    const message = `
📍 經常性路線管理

請選擇操作：
    `.trim();

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ 新增路線', callback_data: 'routes:action:add' }],
          [{ text: '📋 查看路線', callback_data: 'routes:action:view' }],
          [{ text: '✏️ 編輯路線', callback_data: 'routes:action:edit' }],
          [{ text: '🗑️ 刪除路線', callback_data: 'routes:action:delete' }],
        ],
      },
    });
  }

  async handleAction(ctx: Context, action: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.userStates.set(userId, { action: action as any, step: 'start' });

    switch (action) {
      case 'add':
        await this.startAddRoute(ctx);
        break;
      case 'view':
        await this.viewRoutes(ctx, userId);
        break;
      case 'edit':
        await this.startEditRoute(ctx, userId);
        break;
      case 'delete':
        await this.startDeleteRoute(ctx, userId);
        break;
    }
  }

  private async startAddRoute(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state) return;

    state.step = 'waiting_name';

    await ctx.reply('請輸入路線名稱（例如：上班路線、回家路線）：');
  }

  async handleAddFromTraffic(ctx: Context, route: Route): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.userStates.set(userId, {
      action: 'add',
      step: 'waiting_name',
      route,
    });

    await ctx.reply('請為此路線命名：');
  }

  async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state) return;

    const text = ctx.text;
    if (!text) return;

    if (state.action === 'add') {
      await this.handleAddRouteMessage(ctx, userId, state, text);
    } else if (state.action === 'edit' && state.step === 'waiting_new_name') {
      await this.handleEditRouteName(ctx, userId, state, text);
    }
  }

  private async handleAddRouteMessage(
    ctx: Context,
    userId: string,
    state: RouteManagementState,
    text: string
  ): Promise<void> {
    if (state.step === 'waiting_name') {
      state.routeName = text;
      
      if (state.route) {
        // Route already provided (from traffic query)
        await this.promptNotificationPreference(ctx, state);
      } else {
        // Need to get route URL
        state.step = 'waiting_route';
        await ctx.reply(
          '請提供 Google Maps 路線規劃連結\n\n如何取得：開啟 Google Maps → 規劃路線 → 分享 → 複製連結'
        );
      }
    } else if (state.step === 'waiting_route') {
      try {
        const route = this.locationParser.parseRouteUrl(text);
        state.route = route;
        await this.promptNotificationPreference(ctx, state);
      } catch (error) {
        await ctx.reply('❌ 無法解析路線 URL，請重新輸入');
      }
    }
  }

  private async promptNotificationPreference(
    ctx: Context,
    state: RouteManagementState
  ): Promise<void> {
    state.step = 'waiting_notification';

    await ctx.reply('是否啟用異常通知？', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 啟用', callback_data: 'routes:notification:yes' },
            { text: '❌ 不啟用', callback_data: 'routes:notification:no' },
          ],
        ],
      },
    });
  }

  async handleNotificationPreference(ctx: Context, enabled: boolean): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state || !state.routeName || !state.route) return;

    state.notificationEnabled = enabled;

    // Save route
    try {
      const notificationPreferences: NotificationPreferences = {
        enabled,
      };

      const routeId = await this.routeService.addRoutineRoute(userId, {
        name: state.routeName,
        origin: state.route.origin,
        destination: state.route.destination,
        notificationPreferences,
      });

      await ctx.reply(`✅ 路線「${state.routeName}」已新增成功！`);
      this.userStates.delete(userId);

      // Show main menu again
      await this.showMainMenu(ctx);
    } catch (error) {
      if (error instanceof Error && error.message.includes('已達到路線數量上限')) {
        await ctx.reply('❌ 已達到路線數量上限（最多 5 條）');
      } else {
        await ctx.reply('❌ 新增路線失敗，請稍後再試');
      }
      this.userStates.delete(userId);
    }
  }

  private async viewRoutes(ctx: Context, userId: string): Promise<void> {
    try {
      const routes = await this.routeService.getRoutineRoutes(userId);

      if (routes.length === 0) {
        await ctx.reply('您還沒有設定任何經常性路線');
        return;
      }

      const message = this.formatRoutesList(routes);
      await ctx.reply(message);
    } catch (error) {
      await ctx.reply('❌ 無法取得路線列表');
    }
  }

  private formatRoutesList(routes: RoutineRoute[]): string {
    const lines = ['📋 您的經常性路線\n'];

    routes.forEach((route, index) => {
      lines.push(`${index + 1}. ${route.name}`);
      lines.push(`   起點：${route.origin.latitude.toFixed(4)}, ${route.origin.longitude.toFixed(4)}`);
      lines.push(`   終點：${route.destination.latitude.toFixed(4)}, ${route.destination.longitude.toFixed(4)}`);
      lines.push(`   通知：${route.notificationPreferences?.enabled ? '✅ 已啟用' : '❌ 未啟用'}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private async startEditRoute(ctx: Context, userId: string): Promise<void> {
    const routes = await this.routeService.getRoutineRoutes(userId);

    if (routes.length === 0) {
      await ctx.reply('您還沒有設定任何經常性路線');
      return;
    }

    const keyboard = routes.map((route) => [
      { text: route.name, callback_data: `routes:edit:${route.id}` },
    ]);

    await ctx.reply('請選擇要編輯的路線：', {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async handleEditRouteSelection(ctx: Context, routeId: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state) return;

    state.routeId = routeId;
    state.step = 'waiting_new_name';

    await ctx.reply('請輸入新的路線名稱：');
  }

  private async handleEditRouteName(
    ctx: Context,
    userId: string,
    state: RouteManagementState,
    newName: string
  ): Promise<void> {
    if (!state.routeId) return;

    try {
      await this.routeService.updateRouteName(userId, state.routeId, newName);
      await ctx.reply(`✅ 路線名稱已更新為「${newName}」`);
      this.userStates.delete(userId);
    } catch (error) {
      await ctx.reply('❌ 更新失敗，請稍後再試');
      this.userStates.delete(userId);
    }
  }

  private async startDeleteRoute(ctx: Context, userId: string): Promise<void> {
    const routes = await this.routeService.getRoutineRoutes(userId);

    if (routes.length === 0) {
      await ctx.reply('您還沒有設定任何經常性路線');
      return;
    }

    const keyboard = routes.map((route) => [
      { text: `🗑️ ${route.name}`, callback_data: `routes:delete:${route.id}` },
    ]);

    await ctx.reply('請選擇要刪除的路線：', {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async handleDeleteRoute(ctx: Context, routeId: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ctx.reply('確定要刪除此路線嗎？', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 確定刪除', callback_data: `routes:delete_confirm:${routeId}` },
            { text: '❌ 取消', callback_data: 'routes:cancel' },
          ],
        ],
      },
    });
  }

  async handleDeleteConfirm(ctx: Context, routeId: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      await this.routeService.deleteRoutineRoute(userId, routeId);
      await ctx.reply('✅ 路線已刪除');
      this.userStates.delete(userId);
    } catch (error) {
      await ctx.reply('❌ 刪除失敗，請稍後再試');
    }
  }

  async handleCancel(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    this.userStates.delete(userId);
    await ctx.reply('已取消操作');
  }
}
