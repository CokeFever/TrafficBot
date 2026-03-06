# ✅ 部署檢查清單

**功能**: 停車場查詢（含特殊車位資訊）  
**版本**: 1.0.0  
**日期**: 2026-03-06

---

## 📋 部署前檢查

### 1. 程式碼檢查

- [x] 所有 TypeScript 檔案無編譯錯誤
- [x] 資料模型已更新（types.ts, tdx-types.ts）
- [x] 服務層已更新（parking-service.ts）
- [x] API 客戶端已更新（tdx-client.ts）
- [x] Handler 已整合（parking-handler.ts）
- [x] 主程式已整合（index.ts）

### 2. 功能測試

- [x] 本地測試通過（test-implementation.ts）
- [x] 資料解析正確（特殊車位、收費）
- [x] 格式化輸出正確
- [x] API 連接正常

### 3. 環境變數

檢查 `.env` 檔案包含：

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Encryption
ENCRYPTION_KEY=your_encryption_key

# TDX API (用於測試)
TDX_CLIENT_ID=your_client_id
TDX_CLIENT_SECRET=your_client_secret
```

- [ ] TELEGRAM_BOT_TOKEN 已設定
- [ ] SUPABASE_URL 已設定
- [ ] SUPABASE_KEY 已設定
- [ ] ENCRYPTION_KEY 已設定

### 4. 依賴套件

```bash
npm install
```

- [ ] 所有依賴套件已安裝
- [ ] 無版本衝突
- [ ] package.json 正確

---

## 🚀 部署步驟

### 方案 A: Supabase Edge Functions

#### 1. 準備 Supabase 專案

```bash
# 登入 Supabase
supabase login

# 連結專案
supabase link --project-ref your-project-ref
```

#### 2. 部署 Edge Functions

```bash
# 部署 telegram-webhook function
supabase functions deploy telegram-webhook

# 部署 monitoring function（如果需要）
supabase functions deploy monitoring
```

#### 3. 設定環境變數

在 Supabase Dashboard:
1. 前往 Edge Functions
2. 選擇 `telegram-webhook`
3. 設定環境變數：
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `ENCRYPTION_KEY`

#### 4. 設定 Webhook

```bash
# 執行 setup-webhook 腳本
npx tsx scripts/setup-webhook.ts
```

或手動設定：
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<project-ref>.supabase.co/functions/v1/telegram-webhook"}'
```

### 方案 B: Fly.io

#### 1. 安裝 Fly CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

#### 2. 登入 Fly.io

```bash
fly auth login
```

#### 3. 初始化專案

```bash
fly launch
```

選擇：
- App name: `your-app-name`
- Region: 選擇最近的區域
- Database: No（使用 Supabase）

#### 4. 設定環境變數

```bash
fly secrets set TELEGRAM_BOT_TOKEN="your_token"
fly secrets set SUPABASE_URL="your_url"
fly secrets set SUPABASE_KEY="your_key"
fly secrets set ENCRYPTION_KEY="your_key"
```

#### 5. 部署

```bash
fly deploy
```

#### 6. 設定 Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app-name.fly.dev/webhook"}'
```

---

## 🧪 部署後測試

### 1. 健康檢查

```bash
# Supabase
curl https://<project-ref>.supabase.co/functions/v1/telegram-webhook/health

# Fly.io
curl https://your-app-name.fly.dev/health
```

預期回應：
```json
{
  "status": "ok",
  "message": "Bot is running"
}
```

### 2. Telegram Bot 測試

在 Telegram 中測試以下指令：

#### 基本指令
- [ ] `/start` - 顯示歡迎訊息
- [ ] `/help` - 顯示幫助訊息
- [ ] `/setup` - 開始設定流程

#### 停車場功能
- [ ] `/parking` - 開始停車場搜尋
- [ ] 分享位置 - 接收位置並提示選擇半徑
- [ ] 選擇半徑 - 顯示搜尋結果
- [ ] 檢查格式 - 確認特殊車位顯示正確

#### 預期結果範例

```
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
[📍 導航](...)
```

### 3. 錯誤處理測試

- [ ] 無效的 API 金鑰 - 顯示錯誤訊息
- [ ] 台灣境外位置 - 顯示錯誤訊息
- [ ] 無搜尋結果 - 顯示「沒有找到停車場」
- [ ] API 連線失敗 - 顯示「查詢失敗」

---

## 📊 監控設定

### 1. Supabase 監控

在 Supabase Dashboard:
1. 前往 Edge Functions
2. 查看 Logs
3. 監控錯誤和效能

### 2. Fly.io 監控

```bash
# 查看日誌
fly logs

# 查看狀態
fly status

# 查看指標
fly dashboard
```

### 3. Telegram Bot 監控

使用 BotFather:
1. 前往 @BotFather
2. 選擇你的 Bot
3. 查看統計資料

---

## 🔧 常見問題排解

### 問題 1: Webhook 設定失敗

**症狀**: Bot 無法接收訊息

**解決方法**:
```bash
# 檢查 webhook 狀態
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# 刪除 webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"

# 重新設定
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "your_webhook_url"}'
```

### 問題 2: 環境變數未設定

**症狀**: Bot 啟動失敗或功能異常

**解決方法**:
- Supabase: 在 Dashboard 檢查 Edge Function 環境變數
- Fly.io: 使用 `fly secrets list` 檢查

### 問題 3: API 連線失敗

**症狀**: 停車場查詢失敗

**解決方法**:
1. 檢查 TDX API 金鑰是否正確
2. 檢查網路連線
3. 查看 TDX API 狀態頁面

### 問題 4: 資料庫連線失敗

**症狀**: 配置無法儲存

**解決方法**:
1. 檢查 Supabase URL 和 Key
2. 確認資料庫 schema 已建立
3. 執行 migration: `supabase db push`

---

## 📝 部署後檢查清單

### 功能驗證

- [ ] Bot 可以正常啟動
- [ ] `/start` 指令正常
- [ ] `/help` 指令正常
- [ ] `/setup` 流程正常
- [ ] `/parking` 功能正常
- [ ] 位置分享正常
- [ ] 搜尋結果正確
- [ ] 特殊車位顯示正確
- [ ] 收費資訊顯示正確
- [ ] 導航連結正常

### 效能檢查

- [ ] 回應時間 < 3 秒
- [ ] API 呼叫成功率 > 95%
- [ ] 記憶體使用正常
- [ ] CPU 使用正常

### 安全檢查

- [ ] API 金鑰已加密儲存
- [ ] 環境變數未洩漏
- [ ] HTTPS 連線正常
- [ ] Webhook 驗證正常

---

## 🎯 上線後任務

### 立即任務

1. [ ] 監控錯誤日誌
2. [ ] 收集使用者回饋
3. [ ] 記錄常見問題

### 短期任務（1-2 週）

1. [ ] 優化回應速度
2. [ ] 改善錯誤訊息
3. [ ] 新增使用統計

### 長期任務（1-3 個月）

1. [ ] 實作雙城市查詢（台北/新北）
2. [ ] 實作漸進式搜尋（500m → 1000m）
3. [ ] 新增篩選功能（只顯示有充電樁的停車場）
4. [ ] 新增收藏功能
5. [ ] 新增歷史記錄

---

## 📚 相關文件

- [PARKING_FEATURE_GUIDE.md](PARKING_FEATURE_GUIDE.md) - 功能使用指南
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - 實作完成報告
- [docs/deploy-supabase.md](docs/deploy-supabase.md) - Supabase 部署指南
- [docs/deploy-fly.md](docs/deploy-fly.md) - Fly.io 部署指南

---

**部署完成後，記得更新此檢查清單！** ✅
