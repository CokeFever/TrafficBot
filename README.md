# 🚗 TrafficBot - 台灣停車與路況查詢 Telegram Bot

一個整合台灣交通部 TDX API 的 Telegram Bot，提供即時停車位查詢與路況資訊。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy to Supabase](https://github.com/CokeFever/trafficbot/actions/workflows/deploy-supabase.yml/badge.svg)](https://github.com/CokeFever/trafficbot/actions/workflows/deploy-supabase.yml)
[![GitHub issues](https://img.shields.io/github/issues/CokeFever/trafficbot)](https://github.com/CokeFever/trafficbot/issues)
[![GitHub stars](https://img.shields.io/github/stars/CokeFever/trafficbot)](https://github.com/CokeFever/trafficbot/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/CokeFever/trafficbot)](https://github.com/CokeFever/trafficbot/network)

## ✨ 功能特色

### 🅿️ 停車位查詢
- 搜尋附近停車場（250m / 500m / 1km 範圍）
- 顯示即時剩餘車位數
- 提供收費資訊與距離
- 支援機車停車位查詢
- 試用模式：每人每天免費查詢 2 次

### 🚦 路況查詢
- 查詢附近路況（250m / 500m / 1km 範圍）
- 整合 CMS（交通訊息看板）與 VD（車輛偵測器）資料
- 智慧過濾：僅顯示異常路況（速度偏離 ±10% 以上）
- 嚴重度排序：事故 > 壅塞 > 施工 > 車多 > 緩慢
- 道路分組顯示，避免資訊過載
- 需要設定 TDX API Key

## 🚀 快速開始

### 前置需求

- Node.js 20+
- Supabase 帳號
- Telegram Bot Token（從 [@BotFather](https://t.me/botfather) 取得）
- TDX API Key（從 [TDX 平台](https://tdx.transportdata.tw/) 申請）

### 安裝步驟

1. Clone 專案
```bash
git clone https://github.com/CokeFever/trafficbot.git
cd trafficbot
```

2. 安裝相依套件
```bash
npm install
```

3. 設定環境變數
```bash
cp .env.example .env
# 編輯 .env 填入你的設定
```

4. 設定 Supabase
```bash
# 安裝 Supabase CLI
npm install -g supabase

# 登入 Supabase
supabase login

# 連結專案
supabase link --project-ref your-project-ref

# 推送資料庫 migrations
supabase db push

# 部署 Edge Functions
supabase functions deploy telegram-webhook --no-verify-jwt
```

5. 設定 Telegram Webhook
```bash
npm run setup-webhook
```

## 📖 使用說明

### Bot 指令

- `/start` - 開始使用
- `/help` - 查看說明
- `/parking` - 搜尋附近停車位
- `/traffic` - 查詢附近路況
- `/setup` - 設定 TDX API Key
- `/config` - 查看當前配置
- `/reset` - 重置配置

### 使用流程

#### 停車位查詢
1. 輸入 `/parking`
2. 選擇搜尋範圍（250m / 500m / 1km）
3. 分享你的位置
4. 查看附近停車場資訊

#### 路況查詢
1. 輸入 `/setup` 設定 TDX API Key（首次使用）
2. 輸入 `/traffic`
3. 選擇搜尋範圍（250m / 500m / 1km）
4. 分享你的位置
5. 查看附近路況資訊

## 🏗️ 架構說明

### 技術棧

- **Runtime**: Deno (Supabase Edge Functions)
- **Database**: PostgreSQL (Supabase)
- **Bot Framework**: Telegraf
- **API**: TDX (Transport Data eXchange)
- **Deployment**: GitHub Actions + Supabase

### 專案結構

```
trafficbot/
├── src/
│   ├── handlers/          # Bot 指令處理器
│   ├── services/          # 業務邏輯服務
│   ├── models/            # 資料模型
│   └── utils/             # 工具函式
├── supabase/
│   ├── functions/         # Edge Functions
│   │   ├── telegram-webhook/  # Telegram webhook 處理
│   │   └── _shared/       # 共用模組
│   └── migrations/        # 資料庫 migrations
├── docs/                  # 文件
├── scripts/               # 工具腳本
└── .github/workflows/     # CI/CD 配置
```

## 🔒 安全性

- 使用 Row Level Security (RLS) 保護資料庫
- TDX API Key 加密儲存
- 環境變數管理敏感資訊
- 詳見 [SECURITY.md](SECURITY.md)

## 🤝 貢獻指南

歡迎貢獻！請參考 [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 授權

本專案採用 MIT 授權 - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- [TDX 運輸資料流通服務平台](https://tdx.transportdata.tw/)
- [Supabase](https://supabase.com/)
- [Telegraf](https://telegraf.js.org/)

## 📞 聯絡方式

如有問題或建議，請開 [Issue](https://github.com/CokeFever/trafficbot/issues)

---

Made with ❤️ in Taiwan
