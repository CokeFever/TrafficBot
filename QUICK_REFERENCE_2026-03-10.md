# 快速參考 - 2026-03-10 更新

## 🚀 快速部署

```bash
# 1. 更新資料庫
# 在 Supabase Dashboard 執行 supabase/migrations/004_add_trial_usage.sql

# 2. 部署 functions
supabase functions deploy telegram-webhook

# 3. 設定 Bot Commands
npm run setup-bot-commands

# 4. 測試
# 在 Telegram 發送 /start
```

## 📋 新功能清單

| 功能 | 說明 | 狀態 |
|------|------|------|
| 試用模式 | 每人每天免費 2 次查詢 | ✅ |
| 智慧篩選 | ≥3 筆時顯示最近/空位最多/最便宜 | ✅ |
| 特殊車位單行 | 節省顯示空間 | ✅ |
| Bot Commands | 輸入 / 顯示指令列表 | ✅ |
| 鍵盤自動移除 | 分享位置後移除 | ✅ |
| Google Maps URL | 支援多種 URL 格式 | ✅ |
| 基隆市支援 | 添加基隆市邊界 | ✅ |

## 🔑 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `supabase/functions/_shared/tdx-client.ts` | TDX API 客戶端，包含試用 Key |
| `supabase/functions/_shared/formatters.ts` | 格式化輸出，智慧篩選邏輯 |
| `supabase/functions/telegram-webhook/index.ts` | Telegram webhook 處理 |
| `supabase/migrations/004_add_trial_usage.sql` | 試用使用量追蹤表 |
| `scripts/setup-bot-commands.ts` | 設定 Bot Commands |

## 🧪 測試腳本

```bash
# 測試基隆停車場資料
npx ts-node test-keelung-parking.ts

# 測試完整查詢流程
npx ts-node test-keelung-full-query.ts

# 設定 Bot Commands
npm run setup-bot-commands
```

## 📊 試用模式配置

```typescript
// 預設試用 API Key
static readonly DEFAULT_TRIAL_KEY = 'cokefever-7f3a77c1-84ba-47d9:09f2e5f0-4aed-4c18-bdb2-8af94416e568';

// 每日限制
static readonly TRIAL_DAILY_LIMIT = 2;
```

## 🗺️ 支援的 Google Maps URL 格式

1. `@lat,lon` - 標準格式
2. `!3d<lat>!4d<lon>` - 嵌入格式
3. `?q=lat,lon` - 查詢參數
4. `/place/name/@lat,lon` - 地點格式
5. `?ll=lat,lon` - LatLng 參數
6. `?center=lat,lon` - 中心點參數

## 🏙️ 支援的城市

- 台北市 (Taipei)
- 新北市 (NewTaipei)
- 桃園市 (Taoyuan)
- 台中市 (Taichung)
- 台南市 (Tainan)
- 高雄市 (Kaohsiung)
- 新竹市 (Hsinchu)
- 基隆市 (Keelung) ⭐ 新增

## 🎯 智慧篩選邏輯

當結果 ≥ 3 筆時：

1. **距離最近** - 結果已按距離排序，取第一筆
2. **空位最多** - 只考慮 `availableSpaces >= 0` 的停車場
3. **最便宜** - 只考慮有 `hourlyRate` 的停車場
4. 如果少於 3 筆，補上距離最近的其他停車場

## 💬 Bot Commands

| 指令 | 說明 |
|------|------|
| `/start` | 開始使用 |
| `/help` | 查看說明 |
| `/parking` | 搜尋附近停車位 |
| `/setup` | 設定 TDX API Key |
| `/config` | 查看當前配置 |
| `/reset` | 重置配置 |

## 📱 特殊車位顯示格式

改進前（多行）：
```
🏍️ 重機：5
⚡️ 充電：6
♿️ 殘障：6
👶 婦幼：6
```

改進後（單行）：
```
🏍️重機: 5, ⚡充電: 6, ♿殘障: 6, 👶婦幼: 6
```

## 🔍 監控 SQL

```sql
-- 今日試用使用量
SELECT user_id, usage_count, last_reset_date
FROM trial_usage
WHERE last_reset_date = CURRENT_DATE
ORDER BY usage_count DESC;

-- 統計
SELECT 
  COUNT(*) as total_users,
  SUM(usage_count) as total_queries,
  AVG(usage_count) as avg_queries_per_user
FROM trial_usage
WHERE last_reset_date = CURRENT_DATE;

-- 達到上限的使用者
SELECT user_id, usage_count
FROM trial_usage
WHERE last_reset_date = CURRENT_DATE
  AND usage_count >= 2;
```

## ⚠️ 注意事項

1. **試用 API Key** - 確保有足夠配額
2. **資料完整性** - 不同縣市資料完整度不同
3. **URL 解析** - 優先使用 Telegram 位置分享
4. **鍵盤移除** - 確保 `remove_keyboard: true` 正確設定

## 🐛 常見問題快速修復

| 問題 | 解決方案 |
|------|----------|
| Bot Commands 沒出現 | 重新執行 `npm run setup-bot-commands` |
| 試用模式不工作 | 檢查 `trial_usage` 表和 RLS 政策 |
| URL 無法解析 | 使用 Telegram 位置分享功能 |
| 基隆顯示「未提供」 | 執行測試腳本確認資料 |

## 📞 緊急回滾

```bash
# 停用試用模式（修改程式碼）
# 在 handleParkingQuery 中強制要求 API Key

# 回滾 function
supabase functions deploy telegram-webhook
# (使用舊版本程式碼)
```

## 📈 效能指標

監控項目：
- 試用使用者數量
- 達到上限比例
- 平均查詢時間
- TDX API 錯誤率
- 最常查詢地區

## 🎉 使用者體驗改進

1. **首次使用** - 無需設定即可體驗
2. **指令發現** - 輸入 / 即可看到所有指令
3. **位置分享** - 支援多種方式（Telegram、Google Maps）
4. **結果精簡** - 智慧篩選最相關的停車場
5. **資訊密度** - 特殊車位單行顯示

## 📚 相關文件

- `IMPROVEMENTS_2026-03-10.md` - 詳細改進說明
- `DEPLOYMENT_GUIDE_2026-03-10.md` - 完整部署指南
- `docs/user-guide.md` - 使用者指南
- `docs/tdx-api-guide.md` - TDX API 說明
