# Telegram Parking Bot 🚗

台灣停車位查詢 Telegram Bot，整合 TDX API 提供即時停車資訊。

## 功能特色

✅ **停車場查詢**
- 基於當前位置或目的地搜尋
- 支援 500m、1km、2km 搜尋範圍
- 顯示即時車位數量
- 提供導航連結

🚧 **開發中功能**
- 車流查詢
- 經常性路線管理
- 主動推播通知

## 快速開始

### 1. 部署到 Supabase

```bash
# Clone 專案
git clone https://github.com/CokeFever/TrafficBot.git
cd TrafficBot

# 安裝依賴
npm install

# 安裝 Supabase CLI
npm install -g supabase

# 登入並連結專案
supabase login
supabase link --project-ref your-project-ref

# 部署
supabase db push
supabase functions deploy telegram-webhook

# 設定 Webhook
npm run setup-webhook
```

### 2. 使用 Bot

1. 在 Telegram 搜尋你的 Bot
2. 發送 `/start` 開始使用
3. 發送 `/setup` 配置 TDX API Key
4. 發送 `/parking 500m` 查詢停車場

## 架構

```
┌─────────────┐
│  Telegram   │
│    User     │
└──────┬──────┘
       │ Webhook
       ▼
┌─────────────────────┐
│  Supabase Edge      │
│    Functions        │
│  (Deno Runtime)     │
└──────┬──────────────┘
       │
       ├─────► TDX API (停車/車流資料)
       │
       └─────► Supabase PostgreSQL (使用者資料)
```

## 技術棧

- **前端**: Telegram Bot API
- **後端**: Supabase Edge Functions (Deno)
- **資料庫**: Supabase PostgreSQL
- **API**: TDX API (台灣交通部)
- **語言**: TypeScript

## 指令列表

| 指令 | 說明 | 範例 |
|------|------|------|
| `/start` | 開始使用 | `/start` |
| `/help` | 查看幫助 | `/help` |
| `/setup` | 配置 API Key | `/setup` |
| `/config` | 查看配置 | `/config` |
| `/reset` | 重置配置 | `/reset` |
| `/parking [範圍]` | 查詢停車場 | `/parking 500m` |
| `/traffic [範圍]` | 查詢車流 (開發中) | `/traffic 1km` |
| `/routes` | 管理路線 (開發中) | `/routes` |

## 文檔

- [快速開始](docs/quick-start.md)
- [部署指南](docs/deploy-supabase.md)
- [使用者指南](docs/user-guide.md)
- [TDX API 指南](docs/tdx-api-guide.md)

## 開發

### 本地測試

```bash
# 啟動本地 Supabase
supabase start

# 運行 Edge Function
supabase functions serve telegram-webhook --env-file .env

# 測試 Webhook
npm run test-webhook
```

### 查看日誌

```bash
supabase functions logs telegram-webhook --follow
```

## 費用

完全免費！使用 Supabase 免費方案：
- 500MB 資料庫
- 500K Edge Function 請求/月
- 2GB 頻寬/月

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 授權

MIT License

## 支援

- [GitHub Issues](https://github.com/CokeFever/TrafficBot/issues)
- [Supabase 文檔](https://supabase.com/docs)
- [TDX API 文檔](https://tdx.transportdata.tw/)
