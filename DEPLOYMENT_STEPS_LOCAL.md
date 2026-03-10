# 部署步驟 - 本機 vs GitHub Action

## 📋 部署流程總覽

由於你使用 GitHub Action 自動部署，大部分工作會自動完成。

## ✅ 需要在本機完成的步驟

### 1. 設定 Telegram Bot Commands（必須在本機執行）

**為什麼要在本機？**
- 這是一次性設定，需要直接呼叫 Telegram Bot API
- 不需要每次部署都執行
- 需要 `.env` 中的 `TELEGRAM_BOT_TOKEN`

**執行指令：**
```bash
npx ts-node scripts/setup-bot-commands.ts
```

**預期輸出：**
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

**注意：**
- 只需要執行一次
- 如果之後要修改指令，再執行一次即可
- 不會影響 Supabase 部署

---

### 2. 測試（可選，建議在本機執行）

**測試基隆停車場資料：**
```bash
npx ts-node test-keelung-parking.ts
```

**測試完整查詢流程：**
```bash
npx ts-node test-keelung-full-query.ts
```

**為什麼在本機？**
- 快速驗證程式碼邏輯
- 不需要等待部署
- 可以即時看到結果

---

### 3. 提交程式碼到 GitHub（必須在本機執行）

```bash
# 1. 檢查修改的檔案
git status

# 2. 添加所有修改
git add .

# 3. 提交
git commit -m "feat: 添加試用模式、智慧篩選、Bot Commands 等功能

- 試用模式：每人每天免費 2 次查詢
- 智慧篩選：≥3 筆時顯示最近/空位最多/最便宜
- 特殊車位單行顯示
- Telegram Bot Commands 支援
- Google Maps URL 解析
- 基隆市支援"

# 4. 推送到 GitHub
git push origin main
```

**這會觸發 GitHub Action 自動部署！**

---

## 🤖 GitHub Action 會自動完成的步驟

### 1. 資料庫遷移
```bash
supabase db push
```
會自動執行：
- `supabase/migrations/004_add_trial_usage.sql`
- 建立 `trial_usage` 資料表

### 2. 部署 Edge Functions
```bash
supabase functions deploy telegram-webhook --no-verify-jwt
```
會自動部署：
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/_shared/tdx-client.ts`
- `supabase/functions/_shared/formatters.ts`

---

## 📝 完整部署檢查清單

### 在本機執行（部署前）

- [ ] **1. 設定 Bot Commands**
  ```bash
  npx ts-node scripts/setup-bot-commands.ts
  ```
  ✅ 只需執行一次

- [ ] **2. 測試程式碼（可選）**
  ```bash
  npx ts-node test-keelung-parking.ts
  ```
  ✅ 確認基隆資料正常

- [ ] **3. 提交並推送程式碼**
  ```bash
  git add .
  git commit -m "feat: 添加試用模式等功能"
  git push origin main
  ```
  ✅ 觸發自動部署

### GitHub Action 自動執行

- [ ] **4. 資料庫遷移**
  - 自動建立 `trial_usage` 資料表
  - 自動建立索引和 RLS 政策

- [ ] **5. 部署 Edge Functions**
  - 自動部署 `telegram-webhook` function
  - 自動部署 `_shared` 模組

### 部署後驗證（在 Telegram）

- [ ] **6. 測試 Bot Commands**
  - 在 Telegram 輸入 `/`
  - 確認指令列表出現

- [ ] **7. 測試試用模式**
  - 發送 `/start`
  - 發送 `/parking`
  - 確認可以查詢（無需設定 API Key）

- [ ] **8. 測試智慧篩選**
  - 在台北市中心查詢
  - 確認只顯示 3 筆結果

- [ ] **9. 測試 Google Maps URL**
  - 發送 `/parking`
  - 貼上 Google Maps 連結
  - 確認可以解析

- [ ] **10. 測試基隆停車場**
  - 在基隆查詢
  - 確認有車位資訊

---

## 🔍 監控部署狀態

### 1. GitHub Action 狀態
前往：https://github.com/YOUR_USERNAME/YOUR_REPO/actions

查看：
- ✅ 綠色勾勾 = 部署成功
- ❌ 紅色叉叉 = 部署失敗

### 2. Supabase Dashboard
前往：https://supabase.com/dashboard/project/yqpigatgtxvytmkxumxu

檢查：
- **Database** → Tables → 確認 `trial_usage` 表存在
- **Edge Functions** → 確認 `telegram-webhook` 已部署
- **Logs** → 查看執行日誌

### 3. Telegram Bot
直接測試：
- 發送 `/start` 確認 Bot 回應
- 發送 `/parking` 測試功能

---

## ⚠️ 常見問題

### Q1: Bot Commands 沒有出現？

**原因：** 沒有在本機執行設定腳本

**解決：**
```bash
npx ts-node scripts/setup-bot-commands.ts
```

### Q2: GitHub Action 失敗？

**檢查：**
1. GitHub Secrets 是否設定正確
   - `SUPABASE_ACCESS_TOKEN`
2. 查看 Action 日誌找出錯誤訊息

### Q3: 資料庫遷移失敗？

**可能原因：**
- `trial_usage` 表已存在
- RLS 政策衝突

**解決：**
在 Supabase Dashboard 手動執行：
```sql
DROP TABLE IF EXISTS trial_usage CASCADE;
```
然後重新觸發 GitHub Action

### Q4: Function 部署成功但不工作？

**檢查：**
1. Supabase Dashboard → Edge Functions → Logs
2. 確認環境變數設定：
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 🎯 快速部署指令

```bash
# 1. 設定 Bot Commands（只需一次）
npx ts-node scripts/setup-bot-commands.ts

# 2. 提交並部署
git add .
git commit -m "feat: 添加試用模式等功能"
git push origin main

# 3. 等待 GitHub Action 完成（約 2-3 分鐘）

# 4. 在 Telegram 測試
```

---

## 📊 部署時間估計

| 步驟 | 時間 | 位置 |
|------|------|------|
| 設定 Bot Commands | 5 秒 | 本機 |
| 提交程式碼 | 10 秒 | 本機 |
| GitHub Action 執行 | 2-3 分鐘 | 自動 |
| 測試驗證 | 2 分鐘 | Telegram |
| **總計** | **約 5 分鐘** | - |

---

## 💡 最佳實踐

1. **先在本機測試**
   - 執行測試腳本確認邏輯正確
   - 避免部署後才發現問題

2. **使用有意義的 commit message**
   - 方便追蹤變更歷史
   - 使用 conventional commits 格式

3. **監控 GitHub Action**
   - 確認部署成功
   - 查看日誌排查問題

4. **部署後立即測試**
   - 在 Telegram 快速驗證功能
   - 檢查 Supabase Logs

5. **保留測試腳本**
   - 方便未來驗證
   - 可以作為文件參考

---

## 🚀 現在就開始部署！

```bash
# Step 1: 設定 Bot Commands
npx ts-node scripts/setup-bot-commands.ts

# Step 2: 提交程式碼
git add .
git commit -m "feat: 添加試用模式、智慧篩選、Bot Commands 等功能"
git push origin main

# Step 3: 前往 GitHub 查看 Action 狀態
# https://github.com/YOUR_USERNAME/YOUR_REPO/actions

# Step 4: 在 Telegram 測試 Bot
```

**就這麼簡單！** 🎉
