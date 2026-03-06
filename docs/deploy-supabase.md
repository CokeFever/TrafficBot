# Supabase Edge Functions 部署指南

本指南說明如何將 Telegram Parking Bot 部署到 Supabase Edge Functions。

## 架構說明

- **通訊方式**: Webhook（Telegram → Supabase Edge Function）
- **後端**: Supabase Edge Functions（Deno runtime）
- **資料庫**: Supabase PostgreSQL
- **優點**: 
  - 完全免費（在免費額度內）
  - 無需維護伺服器
  - 自動擴展
  - 即時回應

## 前置需求

1. Supabase 帳號（已有）
2. Supabase CLI
3. Telegram Bot Token
4. TDX API Client ID 和 Client Secret

## 部署步驟

### 1. 安裝 Supabase CLI

**Windows (PowerShell):**
```powershell
scoop install supabase
```

或使用 npm:
```bash
npm install -g supabase
```

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Linux:**
```bash
brew install supabase/tap/supabase
```

### 2. 登入 Supabase

```bash
supabase login
```

這會打開瀏覽器，請登入你的 Supabase 帳號。

### 3. 連結專案

```bash
supabase link --project-ref your-project-ref
```

你的 project-ref 可以從 Supabase URL 取得：
- URL: `https://yqpigatgtxvytmkxumxu.supabase.co`
- Project ref: `yqpigatgtxvytmkxumxu`

### 4. 執行資料庫遷移

```bash
supabase db push
```

這會建立必要的資料表（user_configs, user_states, routes, notifications）。

### 5. 設定環境變數

在 Supabase Dashboard 中設定 Edge Function 的環境變數：

1. 前往 https://supabase.com/dashboard/project/yqpigatgtxvytmkxumxu/settings/functions
2. 點擊 "Add secret"
3. 新增以下變數：
   - `TELEGRAM_BOT_TOKEN`: 你的 Bot Token
   - `SUPABASE_URL`: 你的 Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY`: 你的 Service Role Key（在 Settings > API 中找到）

### 6. 部署 Edge Function

```bash
supabase functions deploy telegram-webhook
```

部署完成後，你會看到 Function URL：
```
https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook
```

### 7. 設定 Telegram Webhook

使用我們提供的腳本：

```bash
npm run setup-webhook
```

或手動設定：

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook",
    "allowed_updates": ["message", "callback_query"]
  }'
```

### 8. 驗證部署

檢查 Webhook 狀態：

```bash
npm run webhook:info
```

或：

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

應該會看到：
```json
{
  "ok": true,
  "result": {
    "url": "https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 9. 測試 Bot

在 Telegram 中測試 @ixoTraffic_bot：
1. 發送 `/start`
2. 發送 `/setup` 配置 TDX API Key
3. 測試 `/parking 500m` 功能

## 查看日誌

### 即時日誌

```bash
supabase functions logs telegram-webhook --follow
```

### 歷史日誌

```bash
supabase functions logs telegram-webhook
```

### 在 Dashboard 查看

前往 https://supabase.com/dashboard/project/yqpigatgtxvytmkxumxu/logs/edge-functions

## 更新部署

當你修改代碼後：

```bash
# 1. 重新部署 Function
supabase functions deploy telegram-webhook

# 2. 如果有資料庫變更
supabase db push
```

## 本地測試

### 啟動本地 Supabase

```bash
supabase start
```

### 本地運行 Edge Function

```bash
supabase functions serve telegram-webhook --env-file .env
```

### 使用 ngrok 測試 Webhook

```bash
# 1. 安裝 ngrok
# 2. 啟動 ngrok
ngrok http 54321

# 3. 設定 Webhook 到 ngrok URL
npm run webhook:set
# 手動修改 URL 為: https://your-ngrok-url.ngrok.io/functions/v1/telegram-webhook
```

## 監控和除錯

### 查看 Function 狀態

```bash
supabase functions list
```

### 查看資料庫狀態

```bash
supabase db status
```

### 檢查資料表

```sql
-- 查看 user configs
SELECT * FROM user_configs;

-- 查看 user states
SELECT * FROM user_states;

-- 查看 routes
SELECT * FROM routes;
```

## 費用說明

**Supabase 免費方案包含：**
- 500MB 資料庫空間
- 2GB 檔案儲存
- 50MB 檔案上傳限制
- 500K Edge Function 請求/月
- 2GB Edge Function 頻寬/月

**你的 Bot 使用：**
- 資料庫：< 10MB（user configs, states, routes）
- Edge Function 請求：取決於使用量
- 預估：每天 100 次請求 = 3000 次/月（遠低於限制）

**結論：** 完全在免費額度內，不會產生費用。

## 故障排除

### Webhook 設定失敗

1. 檢查 Bot Token 是否正確
2. 確認 Edge Function 已部署
3. 檢查 Function URL 是否正確

### Bot 無回應

1. 查看 Edge Function 日誌：`supabase functions logs telegram-webhook`
2. 檢查環境變數是否設定正確
3. 確認 Webhook 狀態：`npm run webhook:info`

### 資料庫連線失敗

1. 檢查 SUPABASE_SERVICE_ROLE_KEY 是否正確
2. 確認資料表已建立：`supabase db status`
3. 檢查資料庫遷移：`supabase db push`

### Function 執行逾時

Edge Functions 有 150 秒執行時間限制。如果超時：
1. 優化查詢邏輯
2. 減少 API 呼叫次數
3. 使用快取

## 切換回 Polling 模式（如果需要）

如果想切回 Polling 模式：

```bash
# 1. 刪除 Webhook
npm run webhook:delete

# 2. 部署到 Fly.io 或 Render
# 參考 docs/deploy-fly.md
```

## 支援

- Supabase 文檔：https://supabase.com/docs/guides/functions
- Telegram Bot API：https://core.telegram.org/bots/api
- 問題回報：在專案 GitHub Issues
