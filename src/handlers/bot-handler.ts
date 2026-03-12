import { Telegraf, Context } from 'telegraf';
import { Update } from 'telegraf/types';
import { Coordinates } from '../models/types';

export interface MessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: any;
}

export interface BotHandler {
  handleWebhook(update: Update): Promise<void>;
  handleCommand(ctx: Context, command: string, args: string[]): Promise<void>;
  handleLocation(ctx: Context, location: Coordinates): Promise<void>;
  handleCallback(ctx: Context, callbackData: string): Promise<void>;
  sendMessage(chatId: string, text: string, options?: MessageOptions): Promise<void>;
}

export class BotHandlerImpl implements BotHandler {
  private bot: Telegraf;
  private commandHandlers: Map<string, (ctx: Context, args: string[]) => Promise<void>>;
  private callbackHandlers: Map<string, (ctx: Context, data: string) => Promise<void>>;
  private textMessageHandler?: (ctx: Context) => Promise<void>;
  private locationHandler?: (ctx: Context, location: Coordinates) => Promise<void>;

  constructor(botToken: string) {
    this.bot = new Telegraf(botToken);
    this.commandHandlers = new Map();
    this.callbackHandlers = new Map();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Command handlers
    this.bot.command('start', (ctx) => this.handleStartCommand(ctx));
    this.bot.command('help', (ctx) => this.handleHelpCommand(ctx));
    this.bot.command('parking', (ctx) => this.routeToHandler(ctx, 'parking'));
    this.bot.command('traffic', (ctx) => this.routeToHandler(ctx, 'traffic'));
    this.bot.command('setup', (ctx) => this.routeToHandler(ctx, 'setup'));
    this.bot.command('config', (ctx) => this.routeToHandler(ctx, 'config'));
    this.bot.command('reset', (ctx) => this.routeToHandler(ctx, 'reset'));

    // Text message handler
    this.bot.on('text', async (ctx) => {
      if (this.textMessageHandler) {
        await this.textMessageHandler(ctx);
      }
    });

    // Location handler
    this.bot.on('location', async (ctx) => {
      if (ctx.message && 'location' in ctx.message) {
        const location = ctx.message.location;
        if (this.locationHandler) {
          await this.locationHandler(ctx, {
            latitude: location.latitude,
            longitude: location.longitude,
          });
        } else {
          await this.handleLocation(ctx, {
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      }
    });

    // Callback query handler
    this.bot.on('callback_query', (ctx) => {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        this.handleCallback(ctx, ctx.callbackQuery.data);
      }
    });

    // Error handler
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      this.handleError(ctx, err);
    });
  }

  async handleWebhook(update: Update): Promise<void> {
    await this.bot.handleUpdate(update);
  }

  async handleCommand(ctx: Context, command: string, args: string[]): Promise<void> {
    const handler = this.commandHandlers.get(command);
    if (handler) {
      await this.withLongRunningFeedback(ctx, () => handler(ctx, args));
    } else {
      await ctx.reply('無效的指令，輸入 /help 查看可用指令');
    }
  }

  async handleLocation(ctx: Context, _location: Coordinates): Promise<void> {
    // Location handling will be implemented by specific handlers
    // This is a placeholder that can be overridden
    await ctx.reply('已收到位置資訊');
  }

  async handleCallback(ctx: Context, callbackData: string): Promise<void> {
    const [action, ...params] = callbackData.split(':');
    const handler = this.callbackHandlers.get(action);

    if (handler) {
      await handler(ctx, params.join(':'));
      await ctx.answerCbQuery();
    } else {
      await ctx.answerCbQuery('無效的操作');
    }
  }

  async sendMessage(chatId: string, text: string, options?: MessageOptions): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, options);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error('發送訊息失敗');
    }
  }

  registerCommandHandler(
    command: string,
    handler: (ctx: Context, args: string[]) => Promise<void>
  ): void {
    this.commandHandlers.set(command, handler);
  }

  registerCallbackHandler(
    action: string,
    handler: (ctx: Context, data: string) => Promise<void>
  ): void {
    this.callbackHandlers.set(action, handler);
  }

  registerTextMessageHandler(handler: (ctx: Context) => Promise<void>): void {
    this.textMessageHandler = handler;
  }

  registerLocationHandler(handler: (ctx: Context, location: Coordinates) => Promise<void>): void {
    this.locationHandler = handler;
  }

  private async handleStartCommand(ctx: Context): Promise<void> {
    const welcomeMessage = `
🚗 歡迎使用停車位查詢 Bot！

✅ 目前可用功能：
• 停車位搜尋
• 路況查詢

請先使用 /setup 完成初始配置
輸入 /help 查看詳細說明
    `.trim();

    await ctx.reply(welcomeMessage);
  }

  private async handleHelpCommand(ctx: Context): Promise<void> {
    const helpMessage = `
📖 指令說明

✅ 可用功能：
/parking - 搜尋附近停車位
/traffic - 查詢附近路況

⚙️ 設定：
/setup - 初始配置
/config - 查看當前配置
/reset - 重置配置

需要協助？請參考使用手冊
    `.trim();

    await ctx.reply(helpMessage);
  }

  private async routeToHandler(ctx: Context, command: string): Promise<void> {
    const handler = this.commandHandlers.get(command);
    if (handler) {
      await handler(ctx, []);
    } else {
      await ctx.reply(`指令 /${command} 尚未實作`);
    }
  }

  private async withLongRunningFeedback(
    ctx: Context,
    operation: () => Promise<void>
  ): Promise<void> {
    let statusMessage: any = null;
    const timer = setTimeout(async () => {
      statusMessage = await ctx.reply('⏳ 處理中，請稍候...');
    }, 5000);

    try {
      await operation();
      clearTimeout(timer);

      if (statusMessage) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
      }
    } catch (error) {
      clearTimeout(timer);
      if (statusMessage) {
        await ctx.telegram.deleteMessage(ctx.chat!.id, statusMessage.message_id);
      }
      throw error;
    }
  }

  private async handleError(ctx: Context, _error: any): Promise<void> {
    const errorMessage = '系統發生錯誤，我們已記錄此問題，請稍後再試';
    try {
      await ctx.reply(errorMessage);
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }

  launch(): void {
    this.bot.launch();
    console.log('Bot started');
  }

  stop(): void {
    this.bot.stop();
    console.log('Bot stopped');
  }
}
