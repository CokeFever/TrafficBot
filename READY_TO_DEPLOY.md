# 🚀 準備部署檢查清單

**日期**: 2026-03-12  
**狀態**: 準備就緒 ✅

---

## ✅ 已完成的工作

### 1. 功能清理
- [x] 移除 /routine 功能相關程式碼
- [x] 移除 routes-handler.ts
- [x] 移除 route-service.ts
- [x] 移除 notification-service.ts
- [x] 移除 monitoring Edge Function
- [x] 建立資料庫 migration 006 移除相關表格

### 2. 安全性修復
- [x] 移除 test-traffic-integration.ts 中的硬編碼 API keys
- [x] 移除 research-tdx-traffic-api.ts 中的硬編碼 API keys
- [x] 將 tdx-client.ts 中的試用 API Key 改為環境變數
- [x] 更新 .env.example 加入 TDX API 環境變數說明

### 3. 開源文件
- [x] LICENSE (MIT)
- [x] README.md
- [x] CONTRIBUTING.md
- [x] SECURITY.md
- [x] CODE_OF_CONDUCT.md
- [x] docs/github-actions-setup.md

### 4. 專案清理
- [x] 更新 .gitignore 排除臨時文件
- [x] 移動 37 個臨時文件到 archive/
- [x] 更新所有 GitHub URL 為 CokeFever/trafficbot
- [x] 更新所有 email 為 coke@ixo.app

### 5. 文件更新
- [x] 移除 docs/user-guide.md 中的 /routes 說明
- [x] 更新 bot-handler.ts 移除 /routes 指令
- [x] 更新 telegram-webhook 移除 routes 處理

---

## ⚠️ 部署前必須完成

### 1. 設定 Supabase 環境變數（如果還沒設定）

在 Supabase Dashboard > Project Settings > Edge Functions > Environment Variables 中設定：

```bash
# 必須設定（你應該已經設定好了）
TELEGRAM_BOT_TOKEN=你的_telegram_bot_token
SUPABASE_URL=你的_supabase_url
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

### 2. 新增試用 API Key 環境變數（可選）

**重要**: 由於移除了硬編碼的試用 API Key，如果你想保留停車位查詢的試用功能（每人每天 2 次免費），需要設定：

```bash
# 試用模式（可選，但建議設定）
TDX_TRIAL_API_KEY=你的_試用_client_id:你的_試用_client_secret
```

**如果不設定**: 試用功能將無法使用，使用者必須自己設定 TDX API Key。

### 3. 設定 GitHub Secrets（你應該已經設定好了）

在 GitHub Repository > Settings > Secrets and variables > Actions 中設定：

```bash
SUPABASE_ACCESS_TOKEN=你的_supabase_access_token
```

取得方式：參考 `docs/github-actions-setup.md`

### 3. 更新 Supabase Project ID

如果要部署到不同的 Supabase 專案，更新 `.github/workflows/deploy-supabase.yml`：

```yaml
SUPABASE_PROJECT_ID: your-project-ref-id  # 目前是 yqpigatgtxvytmkxumxu
```

---

## 🧪 部署前測試

### 本地測試

```bash
# 1. 安裝相依套件
npm install

# 2. 執行 TypeScript 編譯檢查
npx tsc --noEmit

# 3. 執行 linting
npm run lint

# 4. 檢查環境變數範本
cat .env.example
```

### 語法檢查結果

✅ 所有檔案已通過 TypeScript 診斷：
- `src/handlers/bot-handler.ts` - No diagnostics
- `src/models/types.ts` - No diagnostics
- `supabase/functions/telegram-webhook/index.ts` - No diagnostics

---

## 📦 部署步驟

### 方式 1: 透過 GitHub Actions（推薦）

```bash
# 1. 提交所有變更
git add .
git commit -m "feat: prepare for open source release

- Remove /routine feature
- Add open source documentation
- Fix hardcoded API keys
- Clean up temporary files
- Update repository URLs"

# 2. 推送到 main 分支（會自動觸發部署）
git push origin main

# 3. 監控部署
# 前往 https://github.com/CokeFever/trafficbot/actions
```

### 方式 2: 手動部署

```bash
# 1. 安裝 Supabase CLI
npm install -g supabase

# 2. 登入 Supabase
supabase login

# 3. 連結專案
supabase link --project-ref yqpigatgtxvytmkxumxu

# 4. 推送資料庫 migrations
supabase db push

# 5. 部署 Edge Functions
supabase functions deploy telegram-webhook --no-verify-jwt

# 6. 設定環境變數
supabase secrets set TELEGRAM_BOT_TOKEN=你的_token
supabase secrets set TDX_TRIAL_API_KEY=你的_trial_key
```

---

## ✅ 部署後驗證

### 1. 檢查 Edge Function

```bash
# 查看 function logs
supabase functions logs telegram-webhook

# 測試 webhook endpoint
curl https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook
```

### 2. 檢查資料庫

```bash
# 連線到資料庫
supabase db remote connect

# 檢查 migrations
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;

# 確認 routine_routes 表已刪除
\dt public.*

# 確認 RLS 已啟用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 3. 測試 Bot 功能

在 Telegram 中測試：

```
/start          # 應該顯示歡迎訊息（不包含 /routes）
/help           # 應該顯示幫助訊息（不包含 /routes）
/parking        # 測試停車位查詢
/traffic        # 測試路況查詢
/routes         # 應該回應「無效的指令」或無回應
/setup          # 測試設定流程
/config         # 查看配置狀態
```

### 4. 檢查 GitHub Actions

前往 https://github.com/CokeFever/trafficbot/actions

確認：
- ✅ Workflow 執行成功
- ✅ 所有步驟都是綠色勾勾
- ✅ 沒有錯誤訊息

---

## 🔍 常見問題排查

### 問題 1: GitHub Actions 失敗

**錯誤**: `Authentication failed`

**解決**:
1. 檢查 `SUPABASE_ACCESS_TOKEN` secret 是否正確設定
2. 確認 token 沒有過期
3. 重新產生 token 並更新 secret

### 問題 2: Edge Function 部署失敗

**錯誤**: `Function deployment failed`

**解決**:
1. 檢查 function 程式碼語法
2. 確認環境變數已設定
3. 查看 Supabase Dashboard logs

### 問題 3: Bot 無回應

**可能原因**:
1. Webhook 未正確設定
2. Edge Function 環境變數缺失
3. Telegram Bot Token 無效

**解決**:
```bash
# 重新設定 webhook
npm run setup-webhook

# 檢查 function logs
supabase functions logs telegram-webhook --tail

# 測試 bot token
curl https://api.telegram.org/bot你的_token/getMe
```

### 問題 4: 資料庫 Migration 失敗

**錯誤**: `Migration failed`

**解決**:
1. 檢查 migration 檔案語法
2. 確認資料庫狀態
3. 手動執行 migration:
```bash
supabase db push --dry-run  # 先預覽
supabase db push            # 實際執行
```

---

## 📊 部署檢查清單

### 部署前
- [x] 所有程式碼已提交
- [x] 語法檢查通過
- [ ] GitHub Secrets 已設定
- [ ] Supabase 環境變數已設定
- [ ] 已備份重要資料

### 部署中
- [ ] GitHub Actions workflow 執行中
- [ ] 監控部署日誌
- [ ] 注意錯誤訊息

### 部署後
- [ ] Edge Function 正常運作
- [ ] 資料庫 migrations 已套用
- [ ] Bot 指令測試通過
- [ ] /routes 指令已移除
- [ ] 停車位查詢功能正常
- [ ] 路況查詢功能正常

---

## 📝 部署記錄

### 部署資訊
- **專案**: TrafficBot
- **Repository**: https://github.com/CokeFever/trafficbot
- **Supabase Project**: yqpigatgtxvytmkxumxu
- **部署方式**: GitHub Actions
- **部署時間**: 待執行

### 變更摘要
- 移除 /routine 功能
- 新增開源文件
- 修復安全問題
- 清理臨時文件
- 更新專案資訊

### 資料庫變更
- Migration 006: 移除 routine_routes 和 notification_records 表

### 功能變更
- ❌ 移除: /routes 指令
- ✅ 保留: /parking 停車位查詢
- ✅ 保留: /traffic 路況查詢
- ✅ 保留: /setup 設定功能

---

## 🎯 下一步

1. **立即執行**: 設定 GitHub Secrets 和 Supabase 環境變數
2. **準備部署**: 執行 `git push origin main`
3. **監控部署**: 查看 GitHub Actions 執行狀態
4. **驗證功能**: 測試所有 Bot 指令
5. **開源發布**: 將 repository 設為 public

---

## 📞 需要協助？

- 📖 查看 [docs/github-actions-setup.md](docs/github-actions-setup.md)
- 📖 查看 [OPENSOURCE_PREPARATION_COMPLETE.md](OPENSOURCE_PREPARATION_COMPLETE.md)
- 🐛 開 [Issue](https://github.com/CokeFever/trafficbot/issues)

---

**準備狀態**: ✅ 可以部署  
**最後更新**: 2026-03-12
