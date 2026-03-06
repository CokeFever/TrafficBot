# Fly.io 部署指南

本指南說明如何將 Telegram Parking Bot 部署到 Fly.io。

## 為什麼選擇 Fly.io？

- ✅ 免費方案不會休眠（24/7 運行）
- ✅ 免費 3 個 shared-cpu VM（256MB RAM each）
- ✅ 可選擇香港區域（低延遲）
- ✅ 自動 SSL、全球 CDN
- ✅ 簡單的 CLI 部署

## 前置需求

1. Fly.io 帳號（需要信用卡驗證，但不會扣款）
2. 已安裝 Node.js 和 npm
3. 已完成本地開發和測試

## 部署步驟

### 方法 A：使用 GitHub Actions 自動部署（推薦）

本專案已設定 GitHub Actions，每次 push 到 `main` 分支就會自動部署。

#### 首次設定：

1. **安裝 Fly CLI**

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **登入 Fly.io**

```bash
fly auth login
```

3. **建立 Fly.io App**

```bash
fly apps create telegram-parking-bot
```

如果名稱已被使用，可以改成其他名稱（例如：`telegram-parking-bot-yourname`）。

4. **設定環境變數**

```bash
fly secrets set TELEGRAM_BOT_TOKEN="你的_Bot_Token"
fly secrets set SUPABASE_URL="你的_Supabase_URL"
fly secrets set SUPABASE_KEY="你的_Supabase_Key"
fly secrets set ENCRYPTION_KEY="你的_加密金鑰"
```

**重要：** 請使用你在 `.env` 檔案中的實際值。

5. **設定 GitHub Secrets**

- 前往 GitHub Repository Settings
- 選擇 "Secrets and variables" > "Actions"
- 新增 Secret：
  - Name: `FLY_API_TOKEN`
  - Value: 你的 Fly.io API Token（從 Fly.io Dashboard 取得）

6. **Push 到 GitHub**

```bash
git add .
git commit -m "Setup Fly.io deployment"
git push origin main
```

GitHub Actions 會自動部署到 Fly.io！

#### 後續更新：

只需要 push 到 GitHub，就會自動部署：
```bash
git add .
git commit -m "Update feature"
git push origin main
```

---

### 方法 B：手動部署

如果不想使用 GitHub Actions，可以手動部署：

1. **完成上述步驟 1-4**

2. **手動部署**

```bash
fly deploy
```

這會：
1. 建立 Docker image
2. 上傳到 Fly.io
3. 啟動應用

部署過程約需 2-5 分鐘。

### 6. 檢查部署狀態

```bash
fly status
```

應該會看到：
```
Status
  Name     = telegram-parking-bot
  Owner    = your-email
  Hostname = telegram-parking-bot.fly.dev
  ...
  
Instances
ID       PROCESS VERSION REGION  STATE   CHECKS  
abc123   app     1       hkg     running 1 total
```

### 7. 查看日誌

```bash
fly logs
```

應該會看到：
```
Telegram Parking Bot starting...
Bot started
Bot is running!
Health check server listening on port 3000
```

### 8. 測試 Bot

在 Telegram 中測試 @ixoTraffic_bot：
1. 發送 `/start`
2. 測試 `/parking` 功能

## 管理指令

### 查看應用資訊
```bash
fly info
```

### 查看即時日誌
```bash
fly logs -f
```

### 重啟應用
```bash
fly apps restart telegram-parking-bot
```

### 擴展資源（如果需要）
```bash
fly scale memory 512  # 增加到 512MB
```

### 查看環境變數
```bash
fly secrets list
```

### 更新環境變數
```bash
fly secrets set KEY="new_value"
```

## 更新部署

### 使用 GitHub Actions（自動）

只需要 push 到 GitHub：
```bash
git add .
git commit -m "Update feature"
git push origin main
```

GitHub Actions 會自動部署到 Fly.io。

### 手動部署

當你修改代碼後：

```bash
fly deploy
```

Fly.io 會自動建立新版本並部署。

## 監控和除錯

### 查看應用狀態
```bash
fly status
```

### 查看健康檢查
```bash
fly checks list
```

### SSH 進入容器（如果需要）
```bash
fly ssh console
```

### 查看資源使用
```bash
fly vm status
```

## 費用說明

**免費方案包含：**
- 3 個 shared-cpu VM（256MB RAM each）
- 160GB 出站流量/月
- 3GB 持久化存儲

**你的 Bot 使用：**
- 1 個 VM（256MB RAM）
- 預估流量：< 1GB/月
- 無持久化存儲需求

**結論：** 完全在免費額度內，不會產生費用。

## 區域選擇

`fly.toml` 中設定為 `hkg`（香港），這是離台灣最近的區域。

其他亞洲區域選項：
- `hkg` - Hong Kong（推薦）
- `nrt` - Tokyo, Japan
- `sin` - Singapore

如果要更改區域：
```bash
fly regions set hkg
```

## 故障排除

### 部署失敗
1. 檢查 `fly.toml` 配置
2. 確認環境變數已設定
3. 查看部署日誌：`fly logs`

### Bot 無回應
1. 檢查日誌：`fly logs`
2. 確認 Bot Token 正確
3. 檢查 Supabase 連線

### 記憶體不足
```bash
fly scale memory 512
```

## 遷移回 Render（如果需要）

如果想切回 Render：
1. 在 Fly.io 暫停應用：`fly apps suspend telegram-parking-bot`
2. 在 Render Dashboard 重新啟動服務
3. 確認只有一個平台在運行

## 刪除 Fly.io 部署

如果不再使用：
```bash
fly apps destroy telegram-parking-bot
```

## 支援

- Fly.io 文檔：https://fly.io/docs/
- Fly.io 社群：https://community.fly.io/
- 問題回報：在專案 GitHub Issues
