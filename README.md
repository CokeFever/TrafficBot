# 🚗 泊車小弟 TrafficBot - 台灣停車與路況查詢 Bot

整合 TDX 運輸資料流通服務與台北市 TCMSV 開放資料的聊天機器人，提供即時停車位查詢與路況資訊。支援 Telegram 與 LINE。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deploy to Supabase](https://github.com/CokeFever/trafficbot/actions/workflows/deploy-supabase.yml/badge.svg)](https://github.com/CokeFever/trafficbot/actions/workflows/deploy-supabase.yml)

**LINE**: https://line.me/R/ti/p/@292epgxq
**Telegram**: https://t.me/ixoTraffic_Bot

## ✨ 功能特色

### 🅿️ 停車位查詢
- 搜尋附近停車場 + 路邊停車格（250m / 500m / 1km）
- 即時剩餘車位數、收費資訊、營業時間
- 支援車種選擇：🚗 小客車 / 🏍️ 機車 / 全部
- 路外停車場（OffStreet）與路邊停車格（OnStreet）分開顯示
- 智慧篩選：停車場 3 筆（最近、空位最多、最便宜）+ 路邊 2 筆（最近、最便宜）
- 分頁瀏覽：輸入「更多」查看完整列表（每頁 5 筆）
- 精確距離與 Google Maps 導航連結
- 試用模式：每人每天免費查詢 5 次

### 🚦 路況查詢
- 查詢附近路況（250m / 500m / 1km）
- 整合 CMS（交通訊息看板）與 VD（車輛偵測器）資料
- 智慧過濾：僅顯示異常路況
- 嚴重度排序：事故 > 壅塞 > 施工 > 車多
- 需要設定 TDX API Key

### 🌍 支援範圍
- **全台 22 縣市**（含離島）
- 台北市：使用 TCMSV 開放資料（含精確座標、即時車位）
- 其他城市：使用 TDX Advanced NearBy API + ParkingAvailability

## 📱 支援平台

| 平台 | 連結 | 功能 |
|------|------|------|
| Telegram | [@ixoTraffic_Bot](https://t.me/ixoTraffic_Bot) | 完整功能 |
| LINE | [@292epgxq](https://line.me/R/ti/p/@292epgxq) | 完整功能 |

## 🚀 快速開始

### 前置需求

- Node.js 20+
- Supabase 帳號
- Telegram Bot Token / LINE Channel
- TDX API Key（[申請連結](https://tdx.transportdata.tw/)）

### 安裝步驟

```bash
git clone https://github.com/CokeFever/trafficbot.git
cd trafficbot
npm install
cp .env.example .env
# 編輯 .env 填入設定
```

### 部署

```bash
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy line-webhook --no-verify-jwt
supabase functions deploy daily-report --no-verify-jwt
```

推送到 `main` branch 會透過 GitHub Actions 自動部署。

## 🏗️ 架構說明

### 資料來源

| 資料 | 來源 | 說明 |
|------|------|------|
| 路外停車場（多數城市） | TDX Advanced NearBy API | 含座標、收費、特殊車位 |
| 路外停車場（台北市） | 台北市 TCMSV Open Data | 含 TWD97 座標、即時車位 |
| 路邊停車格 | TDX Basic OnStreet API | ParkingSegment + Availability |
| 即時車位 | TDX ParkingAvailability | 即時剩餘車位數 |
| 路況 | TDX CMS + VD API | 交通訊息看板 + 車輛偵測器 |

### 技術棧

- **Runtime**: Deno (Supabase Edge Functions)
- **Database**: PostgreSQL (Supabase) with RLS
- **Messaging**: Telegram Bot API / LINE Messaging API
- **API**: TDX + Taipei TCMSV + Nominatim (geocoding)
- **Deployment**: GitHub Actions → Supabase
- **Coordinate System**: TWD97 TM2 → WGS84 conversion

### 專案結構

```
trafficbot/
├── src/                        # Node.js 本地開發版本
│   ├── handlers/               # Bot 指令處理器
│   ├── integrations/           # TDX API 客戶端
│   ├── services/               # 業務邏輯（停車、路況、快取）
│   ├── models/                 # 資料模型與轉換
│   └── utils/                  # 工具函式（座標解析等）
├── supabase/
│   ├── functions/              # Edge Functions (Production)
│   │   ├── telegram-webhook/   # Telegram webhook
│   │   ├── line-webhook/       # LINE webhook
│   │   ├── daily-report/       # 每日報表
│   │   └── _shared/            # 共用模組（TDX client, formatters）
│   └── migrations/             # 資料庫 schema
├── scripts/                    # 工具腳本
├── docs/                       # 文件
└── .github/workflows/          # CI/CD
```

## 🔒 安全性

- Row Level Security (RLS) 保護所有資料表
- TDX API Key 使用 AES-256-CBC 加密儲存（含自動遷移機制）
- 環境變數管理敏感資訊
- LINE webhook 簽名驗證 (HMAC-SHA256)
- Production 依賴零漏洞

## 📖 文件

- [快速開始](docs/quick-start.md)
- [使用者手冊](docs/user-guide.md)
- [TDX API 申請指南](docs/tdx-api-guide.md)
- [Supabase 部署指南](docs/deploy-supabase.md)
- [GitHub Actions 設定](docs/github-actions-setup.md)

## 🤝 貢獻

歡迎貢獻！請參考 [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE)

## 🙏 致謝

- [TDX 運輸資料流通服務平台](https://tdx.transportdata.tw/)
- [台北市政府資料開放平台 (Data.Taipei)](https://data.taipei/)
- [Supabase](https://supabase.com/)
- [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/)

---

Made with ❤️ in Taiwan
