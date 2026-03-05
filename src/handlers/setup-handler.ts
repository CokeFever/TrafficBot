import { Context } from 'telegraf';
import { ConfigService } from '../services/config-service';

interface SetupState {
  step: 'client_id' | 'client_secret' | 'complete';
  clientId?: string;
  clientSecret?: string;
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
    this.userStates.set(userId, { step: 'client_id' });
    await this.promptClientId(ctx);
  }

  async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const state = this.userStates.get(userId);
    if (!state) return;

    const text = ctx.text;
    if (!text) return;

    switch (state.step) {
      case 'client_id':
        await this.handleClientIdInput(ctx, userId, text);
        break;
      case 'client_secret':
        await this.handleClientSecretInput(ctx, userId, text);
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

  private async promptClientId(ctx: Context): Promise<void> {
    const message = `
🔑 TDX API 配置 (步驟 1/2)

請輸入您的 TDX API Client ID

如何取得 API 金鑰：
1. 前往 TDX 平台：https://tdx.transportdata.tw/
2. 註冊並登入
3. 在「會員中心」→「API 金鑰管理」取得
4. 您會看到 Client ID 和 Client Secret 兩個值

請輸入 Client ID：
    `.trim();

    await ctx.reply(message);
  }

  private async promptClientSecret(ctx: Context): Promise<void> {
    const message = `
🔑 TDX API 配置 (步驟 2/2)

請輸入您的 TDX API Client Secret

⚠️ 注意：Client Secret 是敏感資訊，輸入後會被加密儲存

請輸入 Client Secret：
    `.trim();

    await ctx.reply(message);
  }

  private async handleClientIdInput(ctx: Context, userId: string, clientId: string): Promise<void> {
    // Validate Client ID format (basic check)
    if (clientId.length < 10) {
      await ctx.reply('❌ Client ID 格式不正確，請重新輸入');
      return;
    }

    const state = this.userStates.get(userId);
    if (!state) return;

    state.clientId = clientId;
    state.step = 'client_secret';
    await this.promptClientSecret(ctx);
  }

  private async handleClientSecretInput(ctx: Context, userId: string, clientSecret: string): Promise<void> {
    // Validate Client Secret format (basic check)
    if (clientSecret.length < 10) {
      await ctx.reply('❌ Client Secret 格式不正確，請重新輸入');
      return;
    }

    const state = this.userStates.get(userId);
    if (!state || !state.clientId) {
      await ctx.reply('❌ 配置流程錯誤，請重新使用 /setup');
      this.userStates.delete(userId);
      return;
    }

    // Combine Client ID and Secret in the format expected by TDX API
    const apiKey = `${state.clientId}:${clientSecret}`;

    // Show validating message
    await ctx.reply('⏳ 驗證 API 金鑰中...');

    // Validate API key
    const isValid = await this.configService.validateApiKey(apiKey);
    if (!isValid) {
      await ctx.reply(
        '❌ API 金鑰驗證失敗，請確認 Client ID 和 Client Secret 是否正確\n\n取得金鑰：https://tdx.transportdata.tw/\n\n請重新使用 /setup 開始配置'
      );
      this.userStates.delete(userId);
      return;
    }

    // Save API key
    try {
      await this.configService.saveTdxApiKey(userId, apiKey);
      await ctx.reply('✅ API 金鑰驗證成功！');

      // Complete setup
      state.step = 'complete';
      await this.completeSetup(ctx, userId);
    } catch (error) {
      await ctx.reply('❌ 儲存配置失敗，請稍後再試');
      this.userStates.delete(userId);
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
