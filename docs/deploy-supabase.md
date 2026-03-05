# Supabase 部署指南

本指南將協助你從零開始部署 Telegram Parking Bot 到 Supabase。

## 目錄

1. [前置準備](#前置準備)
2. [建立 Supabase 專案](#建立-supabase-專案)
3. [設定資料庫](#設定資料庫)
4. [取得連線資訊](#取得連線資訊)
5. [本地開發設定](#本地開發設定)
6. [部署 Bot](#部署-bot)
7. [設定定時任務（可選）](#設定定時任務可選)
8. [測試驗證](#測試驗證)
9. [常見問題](#常見問題)

---

## 前置準備

### 1. 註冊必要帳號

- **Supabase 帳號**: https://supabase.com/
- **Telegram Bot**: 透過 [@BotFather](https://t.me/botfather) 建立
- **TDX API 金鑰**: https://tdx.transportdata.tw/

### 2. 安裝必要工具

```bash
# 安裝 Node.js (18+)
# 從 https://nodejs.org/ 下載安裝

# 驗證安裝
node --version
npm --version

# 安裝 Supabase CLI (可選，用於本地開發)
npm install -g supabase
```

---

## 建立 Supabase 專案

### 步驟 1: 註冊 Supabase

1. 前往 https://supabase.com/
2. 點擊 "Start your project"
3. 使用 GitHub 或 Email 註冊/登入

### 步驟 2: 建立新專案

1. 登入後，點擊 "New Project"
2. 填寫專案資訊：
   - **Name**: `telegram-parking-bot`（或你喜歡的名稱）
   - **Database Password**: 設定一個強密碼（請記住！）
   - **Region**: 選擇 `Northeast Asia (Tokyo)` 或最近的區域
   - **Pricing Plan**: 選擇 `Free` 方案

3. 點擊 "Create new project"
4. 等待 2-3 分鐘讓專案初始化完成

---

## 設定資料庫

### 步驟 1: 開啟 SQL Editor

1. 在 Supabase Dashboard 左側選單點擊 "SQL Editor"
2. 點擊 "New query"

### 步驟 2: 執行資料庫 Schema

複製 `supabase/migrations/001_initial_schema.sql` 的內容並執行：

```sql
-- 使用者配置表
CREATE TABLE user_configs (
  user_id TEXT PRIMARY KEY,
  tdx_api_key TEXT NOT NULL,
  backend_config JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 經常性路線表
CREATE TABLE routine_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  notification_preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user_configs(user_id) ON DELETE CASCADE
);

-- 通知記錄表
CREATE TABLE notification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  traffic_status TEXT,
  event_ids TEXT[],
  sent_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (route_id) REFERENCES routine_routes(id) ON DELETE CASCADE
);

-- 快取表
CREATE TABLE cache_entries (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- Key-Value Store 表（用於 DataStore）
CREATE TABLE key_value_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_routes_user_id ON routine_routes(user_id);
CREATE INDEX idx_notifications_route_id ON notification_records(route_id);
CREATE INDEX idx_notifications_sent_at ON notification_records(sent_at);
CREATE INDEX idx_cache_expires_at ON cache_entries(expires_at);
CREATE INDEX idx_kv_store_key ON key_value_store(key);

-- 自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_configs_updated_at
  BEFORE UPDATE ON user_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routine_routes_updated_at
  BEFORE UPDATE ON routine_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kv_store_updated_at
  BEFORE UPDATE ON key_value_store
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

3. 點擊 "Run" 執行 SQL
4. 確認顯示 "Success. No rows returned"

### 步驟 3: 驗證資料表

1. 在左側選單點擊 "Table Editor"
2. 確認看到以下資料表：
   - `user_configs`
   - `routine_routes`
   - `notification_records`
   - `cache_entries`
   - `key_value_store`

---

## 取得連線資訊

### 步驟 1: 取得 API 金鑰

1. 在 Supabase Dashboard 點擊左下角的 "Project Settings"（齒輪圖示）
2. 點擊 "API" 分頁
3. 複製以下資訊：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (很長的字串)

### 步驟 2: 取得資料庫連線字串

1. 在 "Project Settings" 中點擊 "Database" 分頁
2. 找到 "Connection string" 區塊
3. 選擇 "URI" 格式
4. 複製連線字串（格式如下）：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. 將 `[YOUR-PASSWORD]` 替換為你建立專案時設定的密碼

---

## 本地開發設定

### 步驟 1: 複製專案

```bash
# 如果還沒有複製專案
git clone <your-repo-url>
cd telegram-parking-bot

# 安裝依賴
npm install
```

### 步驟 2: 設定環境變數

1. 複製環境變數範本：
```bash
cp .env.example .env
```

2. 編輯 `.env` 檔案：

```env
# Telegram Bot Token (從 @BotFather 取得)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Supabase 設定
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 加密金鑰（用於加密使用者的 TDX API 金鑰）
# 產生方式：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_random_32_byte_hex_string

# 可選：監控任務設定
MONITORING_JOB_TOKEN=your_monitoring_token
MONITORING_JOB_ENDPOINT=http://localhost:3000/monitoring
```

### 步驟 3: 產生加密金鑰

在終端機執行：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

複製輸出的字串到 `.env` 的 `ENCRYPTION_KEY`

### 步驟 4: 建置專案

```bash
# 編譯 TypeScript
npm run build

# 檢查是否有錯誤
npm run lint
```

---

## 部署 Bot

### 方案 A: 本地執行（開發/測試）

```bash
# 開發模式（自動重啟）
npm run dev

# 或生產模式
npm start
```

看到 "Bot is running!" 表示成功啟動。

### 方案 B: 部署到雲端服務

#### 選項 1: Railway.app（推薦，免費額度）

1. 前往 https://railway.app/
2. 使用 GitHub 登入
3. 點擊 "New Project" → "Deploy from GitHub repo"
4. 選擇你的 repository
5. 設定環境變數（在 Variables 分頁）：
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `ENCRYPTION_KEY`
6. Railway 會自動偵測 Node.js 並部署

#### 選項 2: Heroku

1. 安裝 Heroku CLI
2. 登入並建立應用：
```bash
heroku login
heroku create telegram-parking-bot
```

3. 設定環境變數：
```bash
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_KEY=your_key
heroku config:set ENCRYPTION_KEY=your_encryption_key
```

4. 部署：
```bash
git push heroku main
```

#### 選項 3: VPS (Ubuntu)

```bash
# 1. 連線到 VPS
ssh user@your-server-ip

# 2. 安裝 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安裝 PM2（程序管理器）
sudo npm install -g pm2

# 4. 複製專案
git clone <your-repo-url>
cd telegram-parking-bot

# 5. 安裝依賴並建置
npm install
npm run build

# 6. 設定環境變數
nano .env
# 貼上你的環境變數

# 7. 使用 PM2 啟動
pm2 start dist/index.js --name telegram-parking-bot

# 8. 設定開機自動啟動
pm2 startup
pm2 save

# 9. 查看日誌
pm2 logs telegram-parking-bot
```

---

## 設定定時任務（可選）

如果要啟用經常性路線的主動通知功能，需要設定定時任務。

### 注意事項

⚠️ **Supabase 免費方案限制**：
- pg_cron 需要 Pro 方案（每月 $25 USD）
- 如果使用免費方案，可以使用外部 cron 服務（見下方替代方案）

### 方案 A: 使用 Supabase pg_cron（需 Pro 方案）

1. 升級到 Pro 方案
2. 在 SQL Editor 執行 `supabase/migrations/002_setup_cron.sql`
3. 設定環境變數（在 Supabase Dashboard → Project Settings → API）

### 方案 B: 使用外部 Cron 服務（免費）

#### 使用 cron-job.org

1. 前往 https://cron-job.org/
2. 註冊免費帳號
3. 建立新的 Cron Job：
   - **Title**: Parking Bot Monitoring
   - **URL**: `https://your-bot-url.com/monitoring`（你的 Bot API endpoint）
   - **Schedule**: `*/15 * * * *`（每 15 分鐘）
4. 儲存並啟用

#### 在 Bot 中新增 Monitoring Endpoint

在 `src/index.ts` 中新增：

```typescript
// 新增 HTTP server 用於接收 cron 請求
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.post('/monitoring', async (req, res) => {
  try {
    await monitoringJob.execute();
    res.json({ success: true, message: 'Monitoring task completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
```

---

## 測試驗證

### 1. 測試 Bot 基本功能

1. 在 Telegram 搜尋你的 Bot（使用 @BotFather 提供的 username）
2. 發送 `/start`
3. 應該看到歡迎訊息

### 2. 測試配置流程

1. 發送 `/setup`
2. 輸入你的 TDX API 金鑰
3. 輸入 Supabase 連線字串
4. 確認配置成功

### 3. 測試停車位搜尋

1. 發送 `/parking`
2. 分享位置或提供 Google Maps 連結
3. 選擇搜尋半徑
4. 確認能看到停車場資訊

### 4. 驗證資料庫

1. 在 Supabase Dashboard → Table Editor
2. 查看 `user_configs` 表
3. 應該能看到你的使用者配置記錄

---

## 常見問題

### Q1: Bot 無法啟動

**檢查清單**：
- 確認 `TELEGRAM_BOT_TOKEN` 正確
- 確認 `SUPABASE_URL` 和 `SUPABASE_KEY` 正確
- 檢查網路連線
- 查看錯誤日誌：`pm2 logs` 或 `npm run dev`

### Q2: 資料庫連線失敗

**解決方法**：
- 確認 Supabase 專案狀態正常（Dashboard 顯示綠色）
- 檢查資料庫密碼是否正確
- 確認防火牆沒有阻擋連線

### Q3: TDX API 呼叫失敗

**可能原因**：
- API 金鑰無效或過期
- 超過 API 呼叫限制
- TDX 服務暫時無法使用

**解決方法**：
- 重新申請 API 金鑰
- 檢查 TDX 平台狀態
- 查看 API 使用量限制

### Q4: 加密金鑰錯誤

**症狀**：無法解密使用者的 API 金鑰

**解決方法**：
- 確認 `ENCRYPTION_KEY` 在所有環境中一致
- 如果更改了加密金鑰，需要重新設定所有使用者的配置

### Q5: 監控任務沒有執行

**檢查清單**：
- 確認 cron job 已正確設定
- 檢查 Bot 的 HTTP endpoint 是否可訪問
- 查看監控任務日誌

---

## 效能優化建議

### 1. 資料庫索引

已在 migration 中建立必要索引，如需額外優化：

```sql
-- 為常用查詢建立索引
CREATE INDEX idx_cache_key_expires ON cache_entries(key, expires_at);
CREATE INDEX idx_routes_user_notifications ON routine_routes(user_id, notification_preferences);
```

### 2. 快取策略

- TDX API 回應快取 5 分鐘
- 考慮增加快取時間以減少 API 呼叫

### 3. 連線池設定

在 `src/services/supabase-store.ts` 中調整連線池大小：

```typescript
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
  global: {
    headers: { 'x-connection-pool-size': '10' },
  },
});
```

---

## 安全性建議

1. **定期更新依賴套件**：
```bash
npm audit
npm update
```

2. **使用環境變數**：
   - 絕不將敏感資訊提交到 Git
   - 使用 `.gitignore` 排除 `.env`

3. **限制 API 存取**：
   - 在 Supabase 設定 Row Level Security (RLS)
   - 限制 API 金鑰的使用範圍

4. **監控異常活動**：
   - 定期檢查 Supabase 日誌
   - 設定異常警報

---

## 下一步

- 📖 閱讀 [使用者手冊](user-guide.md)
- 🔧 查看 [TDX API 申請指南](tdx-api-guide.md)
- 🐛 回報問題到 GitHub Issues
- 💡 提出功能建議

---

## 支援

如有問題，請：
1. 查看本文件的常見問題
2. 搜尋 GitHub Issues
3. 建立新的 Issue 並提供詳細資訊

祝你部署順利！🚀
