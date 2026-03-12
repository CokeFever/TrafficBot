# GitHub Actions 設定指南

本專案使用 GitHub Actions 自動部署到 Supabase。以下是設定步驟。

## 📋 必要的 GitHub Secrets

在你的 GitHub repository 中設定以下 secrets：

### 1. SUPABASE_ACCESS_TOKEN

這是用於部署到 Supabase 的存取 token。

**取得方式**：

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 點擊右上角的個人頭像
3. 選擇 "Account Settings"
4. 進入 "Access Tokens" 頁面
5. 點擊 "Generate New Token"
6. 給 token 一個描述性的名稱（例如：`trafficbot-deploy`）
7. 複製產生的 token

**設定到 GitHub**：

1. 進入你的 GitHub repository
2. 點擊 "Settings" > "Secrets and variables" > "Actions"
3. 點擊 "New repository secret"
4. Name: `SUPABASE_ACCESS_TOKEN`
5. Secret: 貼上剛才複製的 token
6. 點擊 "Add secret"

### 2. TELEGRAM_BOT_TOKEN (Optional)

如果你的部署流程需要設定 Telegram webhook，可以加入這個 secret。

**取得方式**：

1. 在 Telegram 中找到 [@BotFather](https://t.me/botfather)
2. 發送 `/newbot` 建立新 bot
3. 按照指示設定 bot 名稱
4. 複製 BotFather 提供的 token

**設定到 GitHub**：

1. 進入 "Settings" > "Secrets and variables" > "Actions"
2. 點擊 "New repository secret"
3. Name: `TELEGRAM_BOT_TOKEN`
4. Secret: 貼上 bot token
5. 點擊 "Add secret"

## 🔧 Workflow 配置

目前的 workflow 配置在 `.github/workflows/deploy-supabase.yml`：

```yaml
name: Deploy to Supabase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy to Supabase
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: yqpigatgtxvytmkxumxu
        run: |
          # Link project
          supabase link --project-ref $SUPABASE_PROJECT_ID
          
          # Push database migrations
          supabase db push
          
          # Deploy Edge Functions
          supabase functions deploy telegram-webhook --no-verify-jwt
```

## 📝 修改 Project ID

如果你要部署到自己的 Supabase 專案：

1. 取得你的 Supabase Project Reference ID：
   - 登入 Supabase Dashboard
   - 選擇你的專案
   - 進入 "Settings" > "General"
   - 複製 "Reference ID"

2. 修改 `.github/workflows/deploy-supabase.yml`：
   ```yaml
   SUPABASE_PROJECT_ID: your-project-ref-id  # 替換這裡
   ```

## 🚀 觸發部署

部署會在以下情況自動觸發：

- 推送 commit 到 `main` 分支
- 合併 Pull Request 到 `main` 分支

### 手動觸發

如果需要手動觸發部署：

1. 進入 GitHub repository
2. 點擊 "Actions" 標籤
3. 選擇 "Deploy to Supabase" workflow
4. 點擊 "Run workflow"
5. 選擇分支（通常是 `main`）
6. 點擊 "Run workflow"

## 📊 監控部署

### 查看部署狀態

1. 進入 "Actions" 標籤
2. 點擊最新的 workflow run
3. 查看各個步驟的執行狀態

### 查看部署日誌

點擊任何步驟可以查看詳細日誌：

- Checkout code
- Setup Node.js
- Install Supabase CLI
- Deploy to Supabase

### 常見錯誤

#### 1. Authentication failed

**錯誤訊息**：
```
Error: Authentication failed
```

**解決方式**：
- 檢查 `SUPABASE_ACCESS_TOKEN` 是否正確設定
- 確認 token 沒有過期
- 重新產生 token 並更新 secret

#### 2. Project not found

**錯誤訊息**：
```
Error: Project not found
```

**解決方式**：
- 檢查 `SUPABASE_PROJECT_ID` 是否正確
- 確認你的 Supabase 帳號有該專案的存取權限

#### 3. Migration failed

**錯誤訊息**：
```
Error: Migration failed
```

**解決方式**：
- 檢查 migration 檔案語法
- 確認資料庫狀態
- 查看 Supabase Dashboard 的 Database logs

#### 4. Function deployment failed

**錯誤訊息**：
```
Error: Failed to deploy function
```

**解決方式**：
- 檢查 Edge Function 程式碼
- 確認環境變數設定
- 查看 Supabase Dashboard 的 Edge Functions logs

## 🔒 安全性注意事項

### Secrets 管理

- ❌ **絕對不要**將 secrets 硬編碼在程式碼中
- ❌ **絕對不要**將 secrets 提交到 Git
- ✅ 使用 GitHub Secrets 管理敏感資訊
- ✅ 定期輪換 access tokens
- ✅ 使用最小權限原則

### Token 權限

確保 Supabase Access Token 只有必要的權限：

- ✅ 部署 Edge Functions
- ✅ 執行 Database Migrations
- ❌ 不需要管理專案設定的權限

### 環境隔離

建議設定不同的環境：

- `main` 分支 → Production 環境
- `develop` 分支 → Staging 環境
- Feature 分支 → 不自動部署

## 📚 相關資源

- [GitHub Actions 文件](https://docs.github.com/en/actions)
- [Supabase CLI 文件](https://supabase.com/docs/guides/cli)
- [GitHub Secrets 文件](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## 🆘 需要協助？

如果遇到問題：

1. 查看 [GitHub Actions logs](https://github.com/CokeFever/trafficbot/actions)
2. 查看 [Supabase Dashboard logs](https://app.supabase.com/)
3. 開 [Issue](https://github.com/CokeFever/trafficbot/issues) 尋求協助

---

最後更新：2026-03-12
