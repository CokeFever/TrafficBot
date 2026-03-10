# 快速開始指南

本指南幫助你快速部署和使用 Telegram Parking Bot。

## 架構概覽

- **前端**: Telegram Bot（Webhook 模式）
- **後端**: Supabase Edge Functions（Deno runtime）
- **資料庫**: Supabase PostgreSQL
- **API**: TDX API（台灣交通部運輸資料流通服務）

## 前置需求

1. Telegram Bot Token（從 @BotFather 取得）
2. Supabase 帳號和專案
3. TDX API Client ID 和 Client Secret（從 https://tdx.transportdata.tw/ 申請）

## 快速部署（5 分鐘）

### 1. Clone 專案

```bash
git clone https://github.com/CokeFever/TrafficBot.git
cd TrafficBot
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 設定環境變數

建立 `.env` 檔案：

```env
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
```

### 4. 安裝 Supabase CLI

```bash
npm install -g supabase
```

### 5. 登入並連結專案

```bash
supabase login
supabase link --project-ref your-project-ref
```

### 6. 部署資料庫 Schema

```bash
supabase db push
```

### 7. 部署 Edge Function

```bash
supabase functions deploy telegram-webhook
```

### 8. 設定 Telegram Webhook

```bash
npm run setup-webhook
```

### 9. 測試 Bot

在 Telegram 中：
1. 搜尋你的 Bot
2. 發送 `/start`
3. 發送 `/setup` 配置 TDX API Key
4. 測試 `/parking 500m`

## 使用指南

### 基本指令

- `/start` - 開始使用
- `/help` - 查看幫助
- `/setup` - 配置 TDX API Key
- `/config` - 查看當前配置
- `/reset` - 重置配置

### 停車場查詢

**方式 1：不帶參數**
```
/parking
```
Bot 會要求你：
1. 選擇搜尋範圍（500m、1km、2km）
2. 分享位置

**方式 2：帶參數（快速查詢）**
```
/parking 500m
```
Bot 直接要求你分享位置，使用指定的範圍。

**方式 3：使用 Google Maps 連結**
```
/parking
[分享 Google Maps 連結]
```

### 車流查詢（開發中）

```
/traffic 1km
```

### 路線管理（開發中）

```
/routes
```

## 本地開發

### 啟動本地 Supabase

```bash
supabase start
```

### 本地運行 Edge Function

```bash
supabase functions serve telegram-webhook --env-file .env
```

### 測試 Webhook

```bash
npm run test-webhook
```

## 監控和除錯

### 查看日誌

```bash
supabase functions logs telegram-webhook --follow
```

### 查看 Webhook 狀態

```bash
npm run webhook:info
```

### 查看資料庫

```bash
supabase db status
```

## 常見問題

### Bot 沒有回應

1. 檢查 Webhook 是否設定正確：`npm run webhook:info`
2. 查看 Edge Function 日誌：`supabase functions logs telegram-webhook`
3. 確認環境變數設定正確

### API Key 驗證失敗

1. 確認 TDX API Client ID 和 Client Secret 正確
2. 檢查 API Key 格式：`ClientID:ClientSecret`
3. 重新執行 `/setup`

### 找不到停車場

1. 確認位置在支援的城市範圍內（台北、新北、桃園、台中、台南、高雄、新竹）
2. 嘗試增加搜尋範圍
3. 檢查 TDX API 是否正常運作

## 進階配置

### 自訂搜尋範圍

修改 `supabase/functions/telegram-webhook/index.ts` 中的範圍選項。

### 調整結果數量

修改 `supabase/functions/_shared/formatters.ts` 中的 `maxResults` 參數。

### 新增支援城市

修改 `supabase/functions/_shared/tdx-client.ts` 中的 `getCityFromCoordinates` 方法。

## 更多資訊

- [完整部署指南](deploy-supabase.md)
- [使用者指南](user-guide.md)
- [TDX API 指南](tdx-api-guide.md)
- [GitHub Repository](https://github.com/CokeFever/TrafficBot)

## 支援

如有問題，請：
1. 查看 [GitHub Issues](https://github.com/CokeFever/TrafficBot/issues)
2. 參考 [Supabase 文檔](https://supabase.com/docs)
3. 參考 [Telegram Bot API 文檔](https://core.telegram.org/bots/api)
