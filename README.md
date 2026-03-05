# Telegram Parking Bot

一個整合台灣交通部 TDX API 的 Telegram Bot，提供即時停車位查詢、車流資訊查詢及主動推播通知功能。

## 功能特色

- 🅿️ **停車位搜尋** - 基於當前位置或目的地搜尋附近停車場和路邊停車位
- 🚗 **車流查詢** - 查詢特定路線的即時車流狀況和交通事故
- 📍 **經常性路線管理** - 設定常用路線並接收異常通知
- 🔔 **主動推播** - 監控經常性路線並在發生異常時主動通知使用者
- 🔧 **自助配置** - 使用者可自行配置 TDX API 金鑰和後端服務

## 系統需求

- Node.js 18+
- Supabase 帳號（免費方案即可）
- TDX API 金鑰（[申請連結](https://tdx.transportdata.tw/)）
- Telegram Bot Token（透過 [@BotFather](https://t.me/botfather) 建立）

## 快速開始

### 🚀 5 分鐘快速部署

想要快速開始？請參考 [快速開始指南](docs/quick-start.md)

### 詳細步驟

### 1. 安裝依賴

```bash
npm install
```

### 2. 環境變數設定

複製 `.env.example` 為 `.env` 並填入必要資訊：

```bash
cp .env.example .env
```

編輯 `.env`：

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Encryption (用於加密 API 金鑰)
ENCRYPTION_KEY=your_random_encryption_key

# Optional: Monitoring Job
MONITORING_JOB_TOKEN=your_monitoring_job_token
MONITORING_JOB_ENDPOINT=your_monitoring_endpoint
```

### 3. 資料庫設定

在 Supabase 專案中執行 migration：

```bash
# 執行資料庫 schema
supabase/migrations/001_initial_schema.sql

# 設定定時任務（可選）
supabase/migrations/002_setup_cron.sql
```

### 4. 啟動 Bot

開發模式：
```bash
npm run dev
```

生產模式：
```bash
npm run build
npm start
```

## 使用指南

### 初始配置

1. 在 Telegram 中找到你的 Bot
2. 輸入 `/start` 開始
3. 輸入 `/setup` 進行初始配置
4. 依照提示輸入 TDX API 金鑰和 Supabase 連線資訊

### 可用指令

- `/start` - 顯示歡迎訊息和功能選單
- `/help` - 顯示指令說明
- `/parking` - 搜尋附近停車位
- `/traffic` - 查詢路線車流
- `/routes` - 管理經常性路線
- `/setup` - 初始配置
- `/config` - 查看當前配置
- `/reset` - 重置配置

### 停車位搜尋

1. 輸入 `/parking`
2. 分享當前位置或提供 Google Maps 連結
3. 選擇搜尋半徑（500m / 1km / 2km）
4. 查看附近停車場資訊

### 車流查詢

1. 輸入 `/traffic`
2. 提供 Google Maps 路線規劃連結
3. 查看路線車流狀況和交通事故

### 經常性路線管理

1. 輸入 `/routes`
2. 選擇「新增路線」
3. 輸入路線名稱
4. 提供路線 URL
5. 選擇是否啟用異常通知

## 部署指南

### Supabase 部署

詳細部署步驟請參考 [Supabase 部署指南](docs/deploy-supabase.md)

主要步驟：
1. 建立 Supabase 專案
2. 執行資料庫 migration
3. 部署 Edge Functions
4. 設定 pg_cron 定時任務

### 環境變數

確保在部署環境中設定所有必要的環境變數：

- `TELEGRAM_BOT_TOKEN` - Telegram Bot Token
- `SUPABASE_URL` - Supabase 專案 URL
- `SUPABASE_KEY` - Supabase Anon Key
- `ENCRYPTION_KEY` - 用於加密 API 金鑰的密鑰

## 開發

### 專案結構

```
src/
├── handlers/          # Telegram 指令處理器
├── services/          # 業務邏輯服務
├── integrations/      # 外部 API 整合
├── models/            # 資料模型
├── utils/             # 工具函式
├── jobs/              # 定時任務
└── index.ts           # 主程式入口

supabase/
├── migrations/        # 資料庫 migration
└── functions/         # Edge Functions

tests/
├── unit/              # 單元測試
├── integration/       # 整合測試
└── properties/        # 屬性測試
```

### 執行測試

```bash
# 執行所有測試
npm test

# 執行測試並監聽變更
npm run test:watch

# 產生測試覆蓋率報告
npm run test:coverage
```

### 程式碼品質

```bash
# 執行 ESLint
npm run lint

# 自動修復 ESLint 問題
npm run lint:fix

# 格式化程式碼
npm run format
```

## 技術架構

- **語言**: TypeScript
- **Bot 框架**: Telegraf
- **資料庫**: Supabase (PostgreSQL)
- **API**: TDX (Taiwan Data eXchange)
- **測試**: Jest + fast-check

## 授權

MIT License

## 相關連結

- 📖 [快速開始指南](docs/quick-start.md) - 5 分鐘快速部署
- 📖 [Supabase 部署指南](docs/deploy-supabase.md) - 完整部署步驟
- 📖 [TDX API 申請指南](docs/tdx-api-guide.md) - API 金鑰申請教學
- 📖 [使用者手冊](docs/user-guide.md) - 完整功能說明
- 🔗 [TDX API 文件](https://tdx.transportdata.tw/api-service/swagger)
- 🔗 [Supabase 文件](https://supabase.com/docs)
- 🔗 [Telegraf 文件](https://telegraf.js.org/)

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 支援

如有問題或建議，請開啟 Issue 或聯繫維護者。
