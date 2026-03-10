# 停車場查詢 Bot 改進 (2026-03-10)

## 改進項目

### 1. 試用模式 (Trial Mode)

**功能說明：**
- 提供預設 TDX API Key，讓使用者在未註冊前可以先體驗服務
- 每人每天限制查詢 2 次
- 超出限制後顯示 TDX 申請及設定提示訊息

**實作細節：**
- 預設 API Key：`cokefever-7f3a77c1-84ba-47d9:09f2e5f0-4aed-4c18-bdb2-8af94416e568`
- 使用 `trial_usage` 資料表追蹤使用次數
- 每日自動重置計數器
- 查詢結果會顯示剩餘次數

**相關檔案：**
- `supabase/functions/_shared/tdx-client.ts` - 添加 `DEFAULT_TRIAL_KEY` 和 `TRIAL_DAILY_LIMIT`
- `supabase/functions/telegram-webhook/index.ts` - 添加試用模式邏輯
- `supabase/migrations/004_add_trial_usage.sql` - 資料表定義

### 2. 智慧篩選停車場

**功能說明：**
當查詢結果 ≥ 3 筆時，只顯示以下三筆：
- a. 距離最近的
- b. 空位最多的（如無空位資訊則忽略）
- c. 停車每小時單價最便宜的（如無單價資訊則忽略）

**篩選邏輯：**
1. 距離最近：結果已按距離排序，取第一筆
2. 空位最多：只考慮有 `availableSpaces >= 0` 的停車場
3. 最便宜：只考慮有 `hourlyRate` 的停車場
4. 如果篩選後少於 3 筆，補上距離最近的其他停車場

**相關檔案：**
- `supabase/functions/_shared/formatters.ts` - `selectBestParking()` 函數

### 3. 特殊車位單行顯示

**改進前：**
```
🏍️ 重機：5
⚡️ 充電：6
♿️ 殘障：6
👶 婦幼：6
```

**改進後：**
```
🏍️重機: 5, ⚡充電: 6, ♿殘障: 6, 👶婦幼: 6
```

**實作細節：**
- 只顯示數量 > 0 的車位類型
- 使用逗號分隔，節省空間

**相關檔案：**
- `supabase/functions/_shared/formatters.ts` - `formatParkingResults()` 函數

### 4. Telegram 整合修正

#### a. Slash Command 列表

**實作方式：**
- 使用 Telegram Bot API 的 `setMyCommands` 方法
- 設定以下指令：
  - `/start` - 開始使用
  - `/help` - 查看說明
  - `/parking` - 搜尋附近停車位
  - `/setup` - 設定 TDX API Key
  - `/config` - 查看當前配置
  - `/reset` - 重置配置

**執行方式：**
```bash
npm run setup-bot-commands
```

**相關檔案：**
- `scripts/setup-bot-commands.ts` - 設定腳本

#### b. 分享位置鍵盤自動移除

**改進：**
- 在查詢開始時添加 `reply_markup: { remove_keyboard: true }`
- 確保分享位置後鍵盤自動消失

**相關檔案：**
- `supabase/functions/telegram-webhook/index.ts` - `handleParkingQuery()` 函數

#### c. Google Maps URL 支援

**支援的 URL 格式：**
1. `https://maps.app.goo.gl/xxxxx` (短連結)
2. `https://www.google.com/maps/@lat,lon` (標準格式)
3. `https://www.google.com/maps/place/name/@lat,lon`
4. `https://www.google.com/maps?q=lat,lon`
5. `https://www.google.com/maps?ll=lat,lon`
6. `https://www.google.com/maps?center=lat,lon`
7. URL 中包含 `!3d<lat>!4d<lon>` 的格式

**實作細節：**
- 使用正則表達式解析多種 URL 格式
- 不需要 API Key 即可解析 URL
- 解析失敗時顯示友善錯誤訊息

**相關檔案：**
- `supabase/functions/_shared/tdx-client.ts` - `parseGoogleMapsUrl()` 函數
- `supabase/functions/telegram-webhook/index.ts` - `handleTextMessage()` 和 `handleMapsUrl()` 函數

### 5. 基隆停車場資料確認

**問題：**
基隆的停車場查詢結果顯示「車位：未提供」

**調查方向：**
1. 確認基隆市是否有提供即時車位資訊
2. 檢查 TDX API 的 `ParkingAvailability` 端點
3. 比較台北市和基隆市的資料結構差異

**測試腳本：**
```bash
ts-node test-keelung-parking.ts
```

**相關檔案：**
- `test-keelung-parking.ts` - 測試腳本
- `supabase/functions/_shared/tdx-client.ts` - 添加基隆市邊界

## 部署步驟

### 1. 更新資料庫

確保 `trial_usage` 資料表已建立：
```bash
# 在 Supabase Dashboard 執行
supabase/migrations/004_add_trial_usage.sql
```

### 2. 部署 Supabase Functions

```bash
# 部署 telegram-webhook function
supabase functions deploy telegram-webhook

# 部署 _shared 模組
supabase functions deploy _shared
```

### 3. 設定 Bot Commands

```bash
npm run setup-bot-commands
```

### 4. 測試

```bash
# 測試基隆停車場資料
ts-node test-keelung-parking.ts

# 測試 Telegram Bot
# 1. 發送 /start 確認歡迎訊息
# 2. 輸入 / 確認指令列表出現
# 3. 發送 /parking 測試試用模式
# 4. 分享位置確認鍵盤消失
# 5. 發送 Google Maps URL 測試解析
```

## 注意事項

1. **試用模式 API Key**：
   - 請確保預設 API Key 有效且有足夠配額
   - 建議定期監控使用量

2. **資料完整性**：
   - 不同縣市的停車場資料完整度可能不同
   - 基隆市可能沒有提供即時車位資訊
   - 建議在錯誤訊息中說明資料來源限制

3. **智慧篩選**：
   - 篩選邏輯優先考慮距離
   - 只有在有相關資料時才會顯示「空位最多」和「最便宜」
   - 確保至少顯示 3 筆結果（如果有的話）

4. **URL 解析**：
   - Google Maps 短連結可能需要重定向才能取得座標
   - 目前實作使用正則表達式，可能無法處理所有格式
   - 建議使用者優先使用 Telegram 內建的位置分享功能

## 後續改進建議

1. **試用模式增強**：
   - 添加使用統計儀表板
   - 提供試用轉正式的引導流程

2. **資料來源多樣化**：
   - 整合其他縣市的停車場資料來源
   - 提供資料完整度指標

3. **智慧推薦**：
   - 考慮使用者偏好（價格 vs 距離 vs 空位）
   - 學習使用者的停車習慣

4. **URL 解析增強**：
   - 支援更多地圖服務（Apple Maps、百度地圖等）
   - 處理短連結重定向
