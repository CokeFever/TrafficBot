# 部署指南 - 2026-03-10 更新

## 更新內容摘要

1. ✅ 試用模式：每人每天免費查詢 2 次
2. ✅ 智慧篩選：≥3 筆結果時顯示最近、空位最多、最便宜各 1 筆
3. ✅ 特殊車位單行顯示：節省空間
4. ✅ Telegram Bot Commands：輸入 / 顯示指令列表
5. ✅ 分享位置後自動移除鍵盤
6. ✅ 支援所有 Google Maps URL 格式
7. ✅ 添加基隆市支援

## 部署步驟

### 前置準備

確保你有以下環境變數：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`

### 步驟 1: 更新資料庫

在 Supabase Dashboard 執行以下 SQL：

```sql
-- 檢查 trial_usage 表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'trial_usage'
);

-- 如果不存在，執行以下 SQL
CREATE TABLE IF NOT EXISTS trial_usage (
  user_id TEXT PRIMARY KEY,
  usage_count INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_usage_user_id ON trial_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_usage_last_reset ON trial_usage(last_reset_date);

ALTER TABLE trial_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage trial usage" ON trial_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 步驟 2: 部署 Supabase Functions

```bash
# 確保已安裝 Supabase CLI
# npm install -g supabase

# 登入 Supabase
supabase login

# 連結專案
supabase link --project-ref YOUR_PROJECT_REF

# 部署 functions
supabase functions deploy telegram-webhook
```

### 步驟 3: 設定 Telegram Bot Commands

```bash
# 安裝依賴（如果還沒安裝）
npm install

# 執行設定腳本
npm run setup-bot-commands
```

你應該會看到：
```
✅ Bot commands set successfully!

Configured commands:
  /start - 開始使用
  /help - 查看說明
  /parking - 搜尋附近停車位
  /setup - 設定 TDX API Key
  /config - 查看當前配置
  /reset - 重置配置
```

### 步驟 4: 驗證部署

#### 4.1 測試試用模式

1. 開啟 Telegram，找到你的 Bot
2. 發送 `/start`
3. 應該看到包含「試用模式」的歡迎訊息
4. 發送 `/parking`
5. 選擇距離並分享位置
6. 查詢結果應該顯示「試用模式：今日已使用 1/2 次」

#### 4.2 測試 Bot Commands

1. 在 Telegram 輸入框輸入 `/`
2. 應該會彈出指令列表，包含所有 6 個指令
3. 點擊任一指令確認可以正常執行

#### 4.3 測試智慧篩選

1. 在台北市中心（如台北車站）查詢停車場
2. 如果結果 ≥ 3 筆，應該只顯示 3 筆
3. 訊息應該包含「（已為您篩選：最近、空位最多、最便宜）」

#### 4.4 測試特殊車位顯示

1. 查詢有特殊車位的停車場（如台北市政府停車場）
2. 特殊車位應該顯示在一行內：
   ```
   🏍️重機: 5, ⚡充電: 6, ♿殘障: 6, 👶婦幼: 6
   ```

#### 4.5 測試 Google Maps URL

1. 開啟 Google Maps，找一個地點
2. 點擊「分享」，複製連結
3. 在 Bot 中發送 `/parking`
4. 選擇距離
5. 貼上 Google Maps 連結
6. 應該能正常解析並顯示結果

支援的 URL 格式：
- `https://maps.app.goo.gl/W1m1PgsPt6KbMffQ6`
- `https://www.google.com/maps/@25.0330,121.5654,15z`
- `https://www.google.com/maps/place/台北車站/@25.0478,121.5170,17z`
- `https://www.google.com/maps?q=25.0330,121.5654`

#### 4.6 測試鍵盤移除

1. 發送 `/parking`
2. 選擇距離
3. 應該出現「📍 分享位置」按鈕
4. 分享位置後
5. 鍵盤應該自動消失

#### 4.7 測試基隆停車場

1. 在基隆火車站附近查詢停車場
2. 應該能看到完整的車位資訊
3. 大部分停車場應該有「車位：X / Y」的顯示

### 步驟 5: 監控

#### 5.1 檢查 Supabase Logs

```bash
# 查看 function logs
supabase functions logs telegram-webhook --tail
```

#### 5.2 檢查試用使用量

在 Supabase Dashboard 執行：

```sql
-- 查看今日試用使用量
SELECT 
  user_id,
  usage_count,
  last_reset_date
FROM trial_usage
WHERE last_reset_date = CURRENT_DATE
ORDER BY usage_count DESC
LIMIT 10;

-- 統計總使用量
SELECT 
  COUNT(*) as total_users,
  SUM(usage_count) as total_queries,
  AVG(usage_count) as avg_queries_per_user
FROM trial_usage
WHERE last_reset_date = CURRENT_DATE;
```

## 回滾計畫

如果部署後發現問題，可以快速回滾：

### 回滾 Supabase Functions

```bash
# 查看部署歷史
supabase functions list

# 回滾到上一個版本（如果有的話）
# 或者重新部署舊版本的程式碼
```

### 停用試用模式

如果試用模式有問題，可以暫時停用：

1. 在 `supabase/functions/telegram-webhook/index.ts` 中
2. 修改 `handleParkingQuery` 函數
3. 強制要求使用者設定 API Key：

```typescript
// 暫時停用試用模式
const config = await getUserConfig(userId, supabase);
if (!config || !config.tdx_api_key) {
  await sendMessage(chatId, '❌ 請先使用 /setup 配置 TDX API Key', botToken);
  return;
}
```

## 常見問題

### Q1: Bot Commands 沒有出現？

A: 
1. 確認 `setup-bot-commands.ts` 執行成功
2. 重新啟動 Telegram 應用程式
3. 或者手動在 BotFather 設定指令

### Q2: 試用模式不工作？

A:
1. 檢查 `trial_usage` 表是否存在
2. 檢查 RLS 政策是否正確
3. 查看 Supabase logs 確認錯誤訊息

### Q3: Google Maps URL 無法解析？

A:
1. 確認 URL 包含座標資訊
2. 嘗試使用完整的 URL（不要使用短連結）
3. 或者直接使用 Telegram 的位置分享功能

### Q4: 基隆停車場顯示「車位：未提供」？

A:
1. 執行 `npx ts-node test-keelung-parking.ts` 確認資料
2. 檢查是否查詢的是路邊停車場（目前只支援路外停車場）
3. 某些停車場可能確實沒有即時資料

## 效能監控

建議監控以下指標：

1. **試用模式使用量**
   - 每日試用使用者數量
   - 達到上限的使用者數量
   - 試用轉正式的轉換率

2. **查詢效能**
   - 平均查詢時間
   - TDX API 回應時間
   - 錯誤率

3. **使用者行為**
   - 最常查詢的地區
   - 平均查詢距離
   - Google Maps URL vs 位置分享的使用比例

## 下一步

1. 收集使用者反饋
2. 監控試用模式的使用情況
3. 考慮添加更多城市支援
4. 優化智慧篩選演算法
5. 添加使用者偏好設定

## 聯絡資訊

如有問題，請查看：
- `IMPROVEMENTS_2026-03-10.md` - 詳細改進說明
- Supabase Dashboard Logs
- Telegram Bot API 文件
