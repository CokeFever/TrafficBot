# 🚀 快速開始指南

> 5 分鐘內啟動你的停車場查詢 Bot！

---

## ✅ 前置需求

- [x] Node.js 18+ 已安裝
- [x] Telegram Bot Token（從 @BotFather 取得）
- [x] Supabase 帳號（或其他資料庫）
- [x] TDX API 金鑰（用於測試）

---

## 📦 安裝

### 1. Clone 專案

```bash
git clone <your-repo-url>
cd TrafficBot
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 設定環境變數

複製 `.env.example` 為 `.env`:

```bash
cp .env.example .env
```

編輯 `.env`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Encryption Key (產生方式見下方)
ENCRYPTION_KEY=your_32_byte_hex_string

# TDX API (用於測試)
TDX_CLIENT_ID=your_tdx_client_id
TDX_CLIENT_SECRET=your_tdx_client_secret
```

#### 產生 Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🧪 本地測試

### 測試停車場功能

```bash
npx tsx test-implementation.ts
```

預期輸出：
```
✅ 找到 5 個停車場

📍 信義廣場地下停車場
距離：104m
車位：23 / 369

🏍️ 重機：8
⚡ 充電：9
♿ 殘障：8
👶 婦幼：8
...
```

### 測試 API 連接

```bash
npx tsx test-parking-simple.ts <YOUR_CLIENT_ID> <YOUR_CLIENT_SECRET>
```

---

## 🚀 啟動 Bot

### 方式 A: 本地開發

```bash
npm run dev
```

Bot 會啟動並開始接收訊息（使用 polling 模式）

### 方式 B: 生產環境

```bash
npm run build
npm start
```

---

## 📱 測試 Bot

### 1. 在 Telegram 中找到你的 Bot

搜尋你的 Bot 名稱或使用連結：
```
https://t.me/your_bot_username
```

### 2. 開始對話

```
/start
```

### 3. 設定 API 金鑰

```
/setup
```

輸入你的 TDX API 金鑰（格式：`client_id:client_secret`）

### 4. 搜尋停車場

```
/parking
```

1. 分享位置或傳送 Google Maps 連結
2. 選擇搜尋半徑（500m / 1km / 2km）
3. 查看結果！

---

## 🎯 預期結果

你應該會看到類似這樣的輸出：

```
🅿️ 找到 5 個停車場

📍 信義廣場地下停車場
距離：104m
車位：23 / 369

🏍️ 重機：8
⚡ 充電：9
♿ 殘障：8
👶 婦幼：8

收費：
- 計時：50元/時
- 月租：4,800元/月
[📍 導航](https://www.google.com/maps/...)

---

📍 三張里地下停車場
距離：301m
車位：60 / 354
...
```

---

## 🐛 常見問題

### Q: Bot 無法啟動

**檢查**:
1. 環境變數是否正確設定
2. Telegram Bot Token 是否有效
3. Supabase 連線是否正常

```bash
# 檢查環境變數
cat .env

# 測試 Supabase 連線
npx tsx -e "console.log(process.env.SUPABASE_URL)"
```

### Q: 停車場查詢失敗

**檢查**:
1. TDX API 金鑰是否正確
2. 位置是否在台灣境內
3. 網路連線是否正常

```bash
# 測試 TDX API
npx tsx test-parking-simple.ts <CLIENT_ID> <CLIENT_SECRET>
```

### Q: 沒有顯示特殊車位

**原因**: 該停車場沒有提供特殊車位資訊

**說明**: 只有約 48% 的停車場有提供特殊車位資訊，這是正常的。

---

## 📚 下一步

### 學習更多

- [PARKING_FEATURE_GUIDE.md](PARKING_FEATURE_GUIDE.md) - 完整功能指南
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - 實作細節
- [docs/user-guide.md](docs/user-guide.md) - 使用者手冊

### 部署到生產環境

- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - 部署檢查清單
- [docs/deploy-supabase.md](docs/deploy-supabase.md) - Supabase 部署
- [docs/deploy-fly.md](docs/deploy-fly.md) - Fly.io 部署

### 進階功能

- 雙城市查詢（台北/新北）
- 漸進式搜尋（自動擴展半徑）
- 篩選功能（只顯示有充電樁的停車場）

---

## 🎉 完成！

你的停車場查詢 Bot 已經準備好了！

如有問題，請查看：
- [PARKING_FEATURE_GUIDE.md](PARKING_FEATURE_GUIDE.md) - 常見問題
- [FINAL_SUMMARY.md](FINAL_SUMMARY.md) - 完整總結

**祝你使用愉快！** 🚗🅿️
