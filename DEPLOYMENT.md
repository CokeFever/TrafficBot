# 部署指南

## 方案 1: Render.com（推薦 - 免費）

### 步驟：

1. **推送程式碼到 GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **註冊 Render.com**
   - 前往 https://render.com
   - 使用 GitHub 帳號登入

3. **建立新服務**
   - 點擊 "New +" → "Web Service"
   - 連接你的 GitHub repository: `TrafficBot`
   - 選擇 repository

4. **配置服務**
   - Name: `telegram-parking-bot`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance Type: `Free`

5. **設定環境變數**
   在 "Environment" 頁籤新增：
   - `TELEGRAM_BOT_TOKEN`: 你的 Telegram Bot Token
   - `SUPABASE_URL`: 你的 Supabase URL
   - `SUPABASE_KEY`: 你的 Supabase Key
   - `ENCRYPTION_KEY`: 你的加密金鑰
   - `NODE_ENV`: `production`

6. **部署**
   - 點擊 "Create Web Service"
   - 等待部署完成（約 3-5 分鐘）

7. **驗證**
   - 在 Telegram 測試 Bot 功能
   - 檢查 Render 的 Logs 確認運行正常

---

## 方案 2: Railway.app（免費）

### 步驟：

1. **推送程式碼到 GitHub**（同上）

2. **註冊 Railway.app**
   - 前往 https://railway.app
   - 使用 GitHub 帳號登入

3. **建立新專案**
   - 點擊 "New Project"
   - 選擇 "Deploy from GitHub repo"
   - 選擇 `TrafficBot` repository

4. **設定環境變數**
   - 點擊專案 → "Variables"
   - 新增所有環境變數（同 Render）

5. **部署**
   - Railway 會自動偵測 Node.js 專案並部署
   - 等待部署完成

---

## 方案 3: Heroku（需要信用卡）

### 步驟：

1. **安裝 Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **登入 Heroku**
   ```bash
   heroku login
   ```

3. **建立 Heroku 應用**
   ```bash
   heroku create telegram-parking-bot
   ```

4. **設定環境變數**
   ```bash
   heroku config:set TELEGRAM_BOT_TOKEN=your_token
   heroku config:set SUPABASE_URL=your_url
   heroku config:set SUPABASE_KEY=your_key
   heroku config:set ENCRYPTION_KEY=your_key
   ```

5. **部署**
   ```bash
   git push heroku main
   ```

6. **啟動 worker**
   ```bash
   heroku ps:scale web=1
   ```

---

## 環境變數說明

| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | `8573339497:AAEsPKIOAcFl0bCbO3TIrEBKLvnInc5Bou4` |
| `SUPABASE_URL` | Supabase 專案 URL | `https://yqpigatgtxvytmkxumxu.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `ENCRYPTION_KEY` | 資料加密金鑰 | `4e6bbe4ba8fb94357e73159ff08c9dd5...` |
| `NODE_ENV` | 執行環境 | `production` |

---

## 部署後檢查清單

- [ ] Bot 在 Telegram 可以正常回應
- [ ] `/setup` 指令可以設定 TDX API
- [ ] `/parking` 功能可以查詢停車位
- [ ] 檢查部署平台的 Logs 確認沒有錯誤
- [ ] 測試 Supabase 資料庫連線正常

---

## 疑難排解

### Bot 沒有回應
1. 檢查環境變數是否正確設定
2. 檢查部署平台的 Logs
3. 確認 Bot Token 正確

### 資料庫連線失敗
1. 檢查 Supabase URL 和 Key
2. 確認 Supabase 專案狀態正常
3. 檢查網路連線

### 部署失敗
1. 檢查 `package.json` 的 scripts
2. 確認所有依賴套件都在 `dependencies` 中
3. 檢查 TypeScript 編譯是否成功

---

## 更新部署

當你更新程式碼後：

```bash
git add .
git commit -m "Update features"
git push origin main
```

Render/Railway 會自動偵測並重新部署。
