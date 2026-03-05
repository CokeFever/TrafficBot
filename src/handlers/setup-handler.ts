import { Context } from 'telegraf';
import { ConfigService } from '../services/config-service';
import { BackendConfig } from '../models/types';

interface SetupState {
  step: 'api_key' | 'backend_type' | 'backend_url' | 'complete';
  apiKey?: string;
  backendType?: string;
}

export class SetupHandler {
  private configService: ConfigService;
  private userStates: Map<string, SetupState>;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.userStates = new Map();
  }

  async handleSetup(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    // Check if already configured
    const isConfigured = await this.configService.isConfigured(userId);
    if (isConfigured) {
      await ctx.reply(
        '您已完成配置。如需重新配置，請使用 /reset 指令',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '查看配置', callback_data: 'config:view' }],
              [{ text: '重新配置', callback_data: 'config:reset' }],
            ],
          },
        }
      );
      return;
    }

    // Start setup process
    this.userStates.set(userId, { step: 'api_key' });
    await this.promptApiKey(ctx);
  }

  async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state) return;

    const text = ctx.text;
    if (!text) return;

    switch (state.step) {
      case 'api_key':
        await this.handleApiKeyInput(ctx, userId, text);
        break;
      case 'backend_url':
        await this.handleBackendUrlInput(ctx, userId, text);
        break;
    }
  }

  async handleConfig(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const summary = await this.configService.getConfigSummary(userId);
    if (!summary) {
      await ctx.reply('尚未完成配置，請使用 /setup 開始設定');
      return;
    }

    const message = `
📋 當前配置

✅ TDX API 金鑰：${summary.hasApiKey ? '已設定' : '未設定'}
🔧 Backend 類型：${summary.backendType}
📅 配置時間：${summary.configuredAt.toLocaleString('zh-TW')}
    `.trim();

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [[{ text: '重新配置', callback_data: 'config:reset' }]],
      },
    });
  }

  async handleReset(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    await ctx.reply('確定要重置所有配置嗎？這將清除您的 API 金鑰和所有經常性路線。', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 確定重置', callback_data: 'reset:confirm' },
            { text: '❌ 取消', callback_data: 'reset:cancel' },
          ],
        ],
      },
    });
  }

  async handleResetConfirm(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      await this.configService.resetConfig(userId);
      this.userStates.delete(userId);
      await ctx.reply('✅ 配置已重置，請使用 /setup 重新設定');
    } catch (error) {
      await ctx.reply('❌ 重置失敗，請稍後再試');
    }
  }

  private async promptApiKey(ctx: Context): Promise<void> {
    const message = `
🔑 請輸入您的 TDX API 金鑰

如何取得 API 金鑰：
1. 前往 TDX 平台：https://tdx.transportdata.tw/
2. 註冊並登入
3. 在「會員中心」取得 API 金鑰

請直接輸入您的 API 金鑰：
    `.trim();

    await ctx.reply(message);
  }

  private async handleApiKeyInput(ctx: Context, userId: string, apiKey: string): Promise<void> {
    // Validate API key format (basic check)
    if (apiKey.length < 20) {
      await ctx.reply('❌ API 金鑰格式不正確，請重新輸入');
      return;
    }

    // Show validating message
    await ctx.reply('⏳ 驗證 API 金鑰中...');

    // Validate API key
    const isValid = await this.configService.validateApiKey(apiKey);
    if (!isValid) {
      await ctx.reply(
        '❌ API 金鑰驗證失敗，請確認金鑰是否正確\n\n取得金鑰：https://tdx.transportdata.tw/'
      );
      return;
    }

    // Save API key
    await this.configService.saveTdxApiKey(userId, apiKey);
    await ctx.reply('✅ API 金鑰驗證成功！');

    // Move to backend configuration
    const state = this.userStates.get(userId);
    if (state) {
      state.step = 'backend_type';
      state.apiKey = apiKey;
    }

    await this.promptBackendType(ctx);
  }

  private async promptBackendType(ctx: Context): Promise<void> {
    const message = `
🔧 請選擇 Backend 類型

目前支援：
• Supabase - PostgreSQL 資料庫，免費額度大
    `.trim();

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Supabase', callback_data: 'setup:backend:supabase' }]],
      },
    });
  }

  async handleBackendTypeSelection(ctx: Context, backendType: string): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state) return;

    state.backendType = backendType;

    if (backendType === 'supabase') {
      state.step = 'backend_url';
      await this.promptSupabaseUrl(ctx);
    }
  }

  private async promptSupabaseUrl(ctx: Context): Promise<void> {
    const message = `
🔗 請輸入 Supabase 連線資訊

格式：postgresql://[user]:[password]@[host]:[port]/[database]

如何取得：
1. 前往 https://supabase.com/
2. 建立專案
3. 在 Settings > Database 找到 Connection String

請輸入連線字串：
    `.trim();

    await ctx.reply(message);
  }

  private async handleBackendUrlInput(
    ctx: Context,
    userId: string,
    connectionString: string
  ): Promise<void> {
    const state = this.userStates.get(userId);
    if (!state || !state.backendType) return;

    // Basic validation
    if (!connectionString.startsWith('postgresql://')) {
      await ctx.reply('❌ 連線字串格式不正確，請重新輸入');
      return;
    }

    // Save backend config
    const backendConfig: BackendConfig = {
      type: 'supabase',
      connectionString,
    };

    try {
      await this.configService.saveBackendConfig(userId, backendConfig);
      await ctx.reply('✅ Backend 配置成功！');

      // Complete setup
      state.step = 'complete';
      await this.completeSetup(ctx, userId);
    } catch (error) {
      await ctx.reply('❌ Backend 配置失敗，請檢查連線資訊是否正確');
    }
  }

  private async completeSetup(ctx: Context, userId: string): Promise<void> {
    this.userStates.delete(userId);

    const message = `
🎉 配置完成！

您現在可以使用以下功能：
• /parking - 搜尋停車位
• /traffic - 查詢車流
• /routes - 管理經常性路線

開始使用吧！
    `.trim();

    await ctx.reply(message);
  }
}
