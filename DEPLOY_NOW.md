# 🚀 立即部署指南

## 📋 你需要做的事（只有 2 步）

### 步驟 1: 設定 Telegram Bot Commands（本機執行，只需一次）

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

---

### 步驟 2: 提交程式碼（本機執行）

```bash
git add .
git commit -m "feat: 添加試用模式、智慧篩選、Bot Commands 等功能

- 試用模式：每人每天免費 2 次查詢
- 智慧篩選：≥3 筆時顯示最近/空位最多/最便宜
- 特殊車位單行顯示
- Telegram Bot Commands 支援
- Google Maps URL 解析
- 基隆市支援"

git push origin main
```

**這會自動觸發 GitHub Action 部署！**

---

## ⏳ 等待自動部署（約 2-3 分鐘）

GitHub Action 會自動：
1. ✅ 建立 `trial_usage` 資料表
2. ✅ 部署 `telegram-webhook` function
3. ✅ 部署 `_shared` 模組

**查看部署狀態：**
前往 GitHub Actions 頁面查看進度

---

## ✅ 部署完成後測試（在 Telegram）

### 1. 測試 Bot Commands
```
在 Telegram 輸入 /
應該會看到指令列表
```

### 2. 測試試用模式
```
發送: /start
發送: /parking
選擇距離並分享位置
應該可以查詢（無需設定 API Key）
結果應顯示: 試用模式：今日已使用 1/2 次
```

### 3. 測試智慧篩選
```
在台北市中心查詢停車場
如果結果 ≥ 3 筆，應該只顯示 3 筆
訊息應包含: （已為您篩選：最近、空位最多、最便宜）
```

### 4. 測試 Google Maps URL
```
發送: /parking
選擇距離
貼上 Google Maps 連結（例如: https://maps.app.goo.gl/xxxxx）
應該能正常解析並顯示結果
```

### 5. 測試特殊車位顯示
```
查詢有特殊車位的停車場
應該顯示: 🏍️重機: 5, ⚡充電: 6, ♿殘障: 6, 👶婦幼: 6
（單行顯示，用逗號分隔）
```

---

## 🎯 就這麼簡單！

```bash
# 1. 設定 Bot Commands（本機）
npx ts-node scripts/setup-bot-commands.ts

# 2. 提交程式碼（本機）
git add .
git commit -m "feat: 添加試用模式等功能"
git push origin main

# 3. 等待 2-3 分鐘（自動）

# 4. 在 Telegram 測試（手動）
```

---

## ⚠️ 如果遇到問題

### Bot Commands 沒出現？
```bash
# 重新執行設定腳本
npx ts-node scripts/setup-bot-commands.ts

# 或在 Telegram 重新啟動 Bot
發送: /start
```

### GitHub Action 失敗？
1. 前往 GitHub Actions 頁面查看錯誤日誌
2. 檢查 GitHub Secrets 是否設定正確：
   - `SUPABASE_ACCESS_TOKEN`

### Bot 不回應？
1. 前往 Supabase Dashboard
2. 查看 Edge Functions → Logs
3. 確認環境變數設定：
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 📚 詳細文件

- `DEPLOYMENT_STEPS_LOCAL.md` - 完整部署步驟
- `IMPROVEMENTS_2026-03-10.md` - 詳細改進說明
- `SUMMARY_2026-03-10.md` - 更新總結

---

**準備好了嗎？開始部署吧！** 🚀
