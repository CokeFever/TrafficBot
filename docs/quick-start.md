# 快速開始指南

這是一個 5 分鐘快速開始指南，讓你快速部署並測試 Telegram Parking Bot。

## 前置條件檢查清單

在開始之前，請確認你已經：

- [ ] 安裝 Node.js 18 或更高版本
- [ ] 有 Telegram 帳號
- [ ] 有 GitHub 帳號（用於註冊 Supabase）

## 步驟 1: 建立 Telegram Bot (2 分鐘)

1. 在 Telegram 搜尋 `@BotFather`
2. 發送 `/newbot`
3. 輸入 Bot 名稱（例如：`My Parking Bot`）
4. 輸入 Bot username（例如：`my_parking_bot`，必須以 `_bot` 或 `Bot` 結尾）
5. 複製 Bot Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

✅ **完成！** 你的 Bot Token 已取得

## 步驟 2: 建立 Supabase 專案 (3 分鐘)

1. 前往 https://supabase.com/
2. 點擊 "Start your project" 並使用 GitHub 登入
3. 點擊 "New Project"
4. 填寫：
   - Name: `parking-bot`
   - Database Password: 設定一個強密碼（記下來！）
   - Region: 選擇 `Northeast Asia (Tokyo)`
5. 點擊 "Create new project"
6. 等待 2-3 分鐘初始化

✅ **完成！** Supabase 專案已建立

## 步驟 3: 設定資料庫 (2 分鐘)

1. 在 Supabase Dashboard 左側點擊 "SQL Editor"
2. 點擊 "New query"
3. 複製並貼上以下 SQL（或從 `supabase/migrations/001_initial_schema.sql` 複製）：

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

-- Key-Value Store 表
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
```

4. 點擊 "Run"
5. 確認顯示 "Success"

✅ **完成！** 資料庫已設定

## 步驟 4: 取得 Supabase 連線資訊 (1 分鐘)

1. 點擊左下角 "Project Settings"（齒輪圖示）
2. 點擊 "API" 分頁
3. 複製：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`（很長的字串）

✅ **完成！** 連線資訊已取得

## 步驟 5: 申請 TDX API 金鑰 (需等待 1-3 天)

1. 前往 https://tdx.transportdata.tw/
2. 點擊右上角「註冊」
3. 填寫資料並驗證 Email
4. 登入後前往「會員中心」→「API 金鑰管理」
5. 申請新金鑰（應用程式名稱：`Telegram Parking Bot`）
6. 等待審核（通常 1-3 個工作天）

⏳ **等待中...** 先繼續下一步，之後再回來取得金鑰

## 步驟 6: 設定本地環境 (2 分鐘)

1. 複製專案（如果還沒有）：
```bash
git clone <your-repo-url>
cd telegram-parking-bot
```

2. 安裝依賴：
```bash
npm install
```

3. 建立環境變數檔案：
```bash
cp .env.example .env
```

4. 編輯 `.env` 檔案：
```bash
# Windows
notepad .env

# Mac/Linux
nano .env
```

5. 填入資訊：
```env
TELEGRAM_BOT_TOKEN=你的_Bot_Token
SUPABASE_URL=你的_Supabase_URL
SUPABASE_KEY=你的_Supabase_Key
ENCRYPTION_KEY=暫時填入任意32字元字串
```

6. 產生正式的加密金鑰：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
複製輸出並更新 `.env` 的 `ENCRYPTION_KEY`

✅ **完成！** 環境已設定

## 步驟 7: 啟動 Bot (1 分鐘)

```bash
# 開發模式
npm run dev
```

看到以下訊息表示成功：
```
Telegram Parking Bot starting...
Bot is running!
```

✅ **完成！** Bot 已啟動

## 步驟 8: 測試 Bot (2 分鐘)

1. 在 Telegram 搜尋你的 Bot（使用步驟 1 建立的 username）
2. 發送 `/start`
3. 應該看到歡迎訊息

**暫時測試（沒有 TDX API 金鑰）**：
- `/help` - 查看指令說明
- `/config` - 查看配置狀態（應顯示未配置）

**完整測試（有 TDX API 金鑰後）**：
1. 發送 `/setup`
2. 輸入 TDX API 金鑰
3. 輸入 Supabase 連線字串（從步驟 4 的 Database 分頁取得）
4. 測試 `/parking` 功能

✅ **完成！** Bot 運作正常

## 下一步

### 立即可做

- ✅ 測試基本指令（`/start`, `/help`）
- ✅ 查看 Bot 日誌確認運作正常
- ✅ 閱讀[使用者手冊](user-guide.md)

### 等待 TDX API 金鑰後

- ⏳ 完成 `/setup` 配置
- ⏳ 測試停車位搜尋
- ⏳ 測試車流查詢
- ⏳ 設定經常性路線

### 部署到雲端（可選）

- 📖 閱讀[Supabase 部署指南](deploy-supabase.md)
- 🚀 部署到 Railway / Heroku / VPS
- 🔔 設定定時監控任務

## 常見問題

### Q: Bot 無法啟動？

**檢查**：
```bash
# 確認 Node.js 版本
node --version  # 應該 >= 18

# 確認依賴已安裝
npm install

# 檢查 .env 檔案
cat .env  # 確認所有變數都已填寫
```

### Q: Supabase 連線失敗？

**檢查**：
- Supabase 專案狀態（Dashboard 應顯示綠色）
- URL 和 Key 是否正確複製（注意不要有多餘空格）
- 網路連線是否正常

### Q: TDX API 申請很久沒通過？

**解決**：
- 通常 1-3 個工作天
- 可以先測試其他功能
- 如超過 3 天，聯繫 TDX 客服：service@tdx.gov.tw

### Q: 想在手機上測試？

**方法**：
1. 確保電腦和手機在同一網路
2. 找到電腦的區域網路 IP（例如：192.168.1.100）
3. 在 `.env` 設定 `PORT=3000`
4. 手機 Telegram 可以正常使用

## 需要協助？

- 📖 [完整部署指南](deploy-supabase.md)
- 📖 [TDX API 申請指南](tdx-api-guide.md)
- 📖 [使用者手冊](user-guide.md)
- 🐛 [回報問題](https://github.com/your-repo/issues)

---

恭喜！你已經完成快速開始。享受使用 Telegram Parking Bot！🎉
