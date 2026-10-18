# TrafficBot 專案接手文件 (Handoff)

> 本文件供接手維護者 / 開發工具使用。涵蓋所有外部服務、環境變數、部署流程、
> 資料庫結構、驗證步驟與已知事項。
>
> **文件狀態**：以下「現狀」欄位於 2026-10-16 實測驗證（見每節的「驗證指令」）。
> **原始碼真相來源**：GitHub `main` 分支 <https://github.com/CokeFever/TrafficBot>。
>
> ⚠️ **本文件不含任何真實密鑰 / token**。所有敏感值以佔位符標示，並註明「從哪裡取得」。
> 接手者需另外向交付者索取實際密鑰，或從下列各 Dashboard 自行讀取 / 重新產生。

---

## 1. 系統總覽

TrafficBot（泊車小弟）是台灣停車 / 路況查詢聊天機器人，支援 Telegram 與 LINE，
並提供給 Gemini Spark 使用的 MCP server。後端全部跑在 **Supabase Edge Functions（Deno）**。

### 架構圖（文字版）

```
 使用者 ─ Telegram ──→ telegram-webhook ┐
 使用者 ─ LINE ──────→ line-webhook      ├─→ Supabase Postgres (資料)
 Gemini Spark ─ MCP ─→ mcp.ixo.app (CF Worker) → mcp-server ┘
                                                     │
 GitHub Actions (cron 每日) ─→ daily-report ─────────┘ (報表 + webhook 自癒)
                                                     │
 所有函式 ──→ TDX API (tdx.transportdata.tw) 查停車/路況
```

### 用到的外部服務一覽

| 服務 | 用途 | 帳號 / 識別 | 控制台 |
|------|------|-------------|--------|
| **Supabase** | DB + 4 個 Edge Functions | project ref `yqpigatgtxvytmkxumxu`，org `xbkeftzymgcieammvdrd` | <https://supabase.com/dashboard/project/yqpigatgtxvytmkxumxu> |
| **Telegram** | 主要 bot 平台 | `@ixoTraffic_bot`（名稱：泊車小弟，bot id `8573339497`） | [@BotFather](https://t.me/botfather) |
| **LINE** | 次要 bot 平台 | official account `@292epgxq` | LINE Developers Console |
| **TDX** | 運輸資料來源（停車 / 路況） | client_id / client_secret | <https://tdx.transportdata.tw/> |
| **Cloudflare** | Worker 代理 `mcp.ixo.app`（MCP OAuth 用） | 帳號 `cokefever@gmail.com` | Cloudflare Dashboard |
| **GitHub** | 原始碼 + CI/CD + 每日排程 | `CokeFever/TrafficBot` | <https://github.com/CokeFever/TrafficBot> |

---

## 2. 原始碼結構（哪個是 Production？）

⚠️ **重要**：repo 裡有兩套實作，只有一套是線上跑的。

| 路徑 | 狀態 | 說明 |
|------|------|------|
| `supabase/functions/**` | ✅ **Production** | 實際部署的 Edge Functions（Deno） |
| `src/**` | ⚠️ 非部署 | 舊的 Node.js / Telegraf 本地版本，**未部署**。維護時勿誤改這裡以為會生效 |
| `scripts/**` | 工具 | webhook 註冊等本地腳本（Node / ts-node） |
| `cloudflare-worker/**` | ✅ Production | `mcp.ixo.app` 的 Worker |
| `supabase/migrations/**` | ✅ Production | DB schema（`supabase db push` 套用） |

### 部署中的 Edge Functions（4 個）

| 函式 | 進入點 | 用途 |
|------|--------|------|
| `telegram-webhook` | `supabase/functions/telegram-webhook/index.ts` | 處理所有 Telegram 指令 / callback |
| `line-webhook` | `supabase/functions/line-webhook/index.ts` | 處理 LINE 訊息（走 `_shared/core-handler.ts`） |
| `daily-report` | `supabase/functions/daily-report/index.ts` | 每日報表 + **webhook 健康檢查/自癒** + `?mode=healthcheck` |
| `mcp-server` | `supabase/functions/mcp-server/index.ts` | 給 Gemini 的 MCP server（OAuth 2.1 + 2 工具） |

> 註：Telegram 與 LINE 的指令邏輯**目前沒有共用**——Telegram 是 inline 自己一份、
> LINE 走 `_shared/core-handler.ts`。改行為時兩邊都要留意（技術債，見第 8 節）。

---

## 3. 環境變數 / Secrets（最關鍵）

Edge Functions 的 secrets **不在 `.env`**，而在 **Supabase Dashboard → Edge Functions → Secrets**。
`.env`（本地）只給 `scripts/` 的 Node 工具用。

### 3a. Supabase Edge Function Secrets（線上函式實際讀取）

以下為程式碼中 `Deno.env.get(...)` 實際讀到的變數（已用 grep 核對原始碼）：

| Secret 名稱 | 被哪些函式使用 | 取得來源 | 必要性 |
|-------------|----------------|----------|--------|
| `SUPABASE_URL` | 全部 | `https://yqpigatgtxvytmkxumxu.supabase.co`（通常平台內建） | 必要 |
| `SUPABASE_SERVICE_ROLE_KEY` | 全部 | Supabase → Settings → API → service_role key | 必要 |
| `TELEGRAM_BOT_TOKEN` | telegram-webhook, daily-report | BotFather → @ixoTraffic_bot → API Token | 必要 |
| `TDX_TRIAL_API_KEY` | `_shared/tdx-client.ts`（試用模式）, mcp-tools fallback | TDX 申請，格式 `client_id:client_secret` | 試用功能需要 |
| `TDX_MCP_API_KEY` | mcp-tools（優先於 trial） | TDX，格式同上 | 選用 |
| `LINE_CHANNEL_SECRET` | line-webhook | LINE Developers Console → Channel | LINE 需要 |
| `LINE_CHANNEL_ACCESS_TOKEN` | line-webhook | LINE Developers Console → Channel | LINE 需要 |
| `TELEGRAM_BOT_USERNAME` | mcp-server/oauth.ts（預設 `ixoTraffic_Bot`） | 固定值，可省略 | 選用 |
| `MCP_PUBLIC_URL` | mcp-server/oauth.ts | `https://mcp.ixo.app` | MCP 需要 |
| `MCP_SERVER_URL` | mcp-server（OAuth metadata） | `https://mcp.ixo.app` | MCP 需要 |

> 驗證目前有哪些 secrets（需 `supabase login` + link）：
> ```bash
> supabase secrets list --project-ref yqpigatgtxvytmkxumxu
> ```

### 3b. GitHub Actions Secrets（CI 用）

目前已設定（實測確認）：

| Secret | 用途 | 取得來源 |
|--------|------|----------|
| `SUPABASE_ACCESS_TOKEN` | CI 部署函式 / `db push` | Supabase → Account → Access Tokens |
| `SUPABASE_ANON_KEY` | daily-report 排程 + 部署後 webhook healthcheck 的 curl 授權 | Supabase → Settings → API → anon key |

> 查詢：`gh secret list`（在 repo 目錄）。
> 注意：CI **沒有**存 `TELEGRAM_BOT_TOKEN`——webhook 自癒是由 daily-report 函式用
> Supabase 裡的 token 完成的，CI 只負責觸發，不需要 bot token。

### 3c. 本地 `.env`（僅 `scripts/` 工具用，範本見 `.env.example`）

`TELEGRAM_BOT_TOKEN`、`SUPABASE_URL`、`TDX_CLIENT_ID/SECRET`、`TDX_TRIAL_API_KEY` 等。
接手後若要在本地跑 `npm run webhook:*`，才需要建立 `.env`。

---

## 4. 資料庫（Supabase Postgres）

Schema 由 `supabase/migrations/001`～`012` 定義，用 `supabase db push` 套用。

### 資料表

| 表 | 用途 | migration |
|----|------|-----------|
| `user_configs` | 使用者的 TDX API key 等設定 | 001 |
| `user_states` | 多步驟對話狀態（選車種→半徑→位置） | 003 |
| `trial_usage` | 試用模式每日 5 次計數 | 004 |
| `query_logs` | 查詢紀錄（daily-report 統計來源） | 010 |
| `routine_routes` | （舊功能，006 之後已停用） | 001/006 |
| `cache_entries` / `key_value_store` | 快取 | 001 |
| `notification_records` | 通知紀錄 | 001 |
| `mcp_oauth_nonces` / `mcp_oauth_tokens` | MCP OAuth 綁定 / token | 011 |
| `mcp_sessions` | MCP session 持久化（跨 Edge 實例） | 012 |

### 排程（pg_cron，DB 內）

| job | 排程 | 動作 |
|-----|------|------|
| `monitoring-job` | 每 15 分 | 呼叫監控（002；注意：依賴 `app.*` settings，可能未啟用） |
| `cleanup-user-states` | 每小時 | `cleanup_old_user_states()` 清過期狀態 |

> ⚠️ **注意兩種排程不要混淆**：
> - **DB 內的 pg_cron**（上表）
> - **GitHub Actions cron**（`daily-report.yml`，每天 02:00 UTC = 台灣 10:00）—— 每日報表走這個

---

## 5. 部署流程

### 自動（主要）
推送到 `main` → GitHub Actions `deploy-supabase.yml` 觸發：
1. `supabase link --project-ref yqpigatgtxvytmkxumxu`
2. `supabase db push`（套用 migrations）
3. 依序 deploy `telegram-webhook` / `line-webhook` / `daily-report` / `mcp-server`（皆 `--no-verify-jwt`）
4. **部署後自動 call `daily-report?mode=healthcheck`** 驗證 / 修復 Telegram webhook

> ⚠️ 歷史雷點：步驟 2 的 `db push` 失敗會中止後面的 function 部署（2026-09 曾因此整個 bot
> 停擺數週）。若 CI 失敗先看是不是卡在 migration。

### Cloudflare Worker（獨立，非 CI）
`mcp.ixo.app` 的 Worker 需手動部署：
```bash
cd cloudflare-worker
npx wrangler login      # cokefever@gmail.com，或設 CLOUDFLARE_API_TOKEN
npx wrangler deploy
```

### 手動部署單一函式（需 supabase login + link）
```bash
supabase functions deploy telegram-webhook --project-ref yqpigatgtxvytmkxumxu --no-verify-jwt
```

---

## 6. 本機環境需求

- **Node.js 20+**（`scripts/` 工具、本地建置）
- **Supabase CLI**（`brew install supabase/tap/supabase`；macOS 本機已裝 v2.117.0）
- **Deno**（Edge runtime；本地若要 `supabase functions serve` 才需要）
- **wrangler**（Cloudflare Worker 部署，`npx wrangler`）
- **gh CLI**（查 CI / 設 secret，選用）

---

## 7. 交接驗證清單（接手後逐項確認）

以下指令可直接複製執行。需要 bot token 的地方以 `<TELEGRAM_BOT_TOKEN>` 標示。

```bash
# --- 公開端點健康檢查（不需密鑰）---
# Telegram webhook 是否指向正確 URL、無積壓
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
#  期望 url = https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook
#  期望 pending_update_count = 0, allowed_updates = ["message","callback_query"]

# Telegram bot 身分
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getMe"
#  期望 username = ixoTraffic_bot

# Cloudflare Worker / MCP discovery（期望 HTTP 200 application/json）
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://mcp.ixo.app/.well-known/oauth-protected-resource/mcp"

# mcp-server 未授權存取（期望 HTTP 401）
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/mcp-server/mcp" \
  -H "Content-Type: application/json" -d '{}'

# --- 需帳號權限 ---
gh secret list                                   # CI secrets（repo 目錄）
gh run list --limit 5                            # 最近 CI 狀態
supabase login && supabase link --project-ref yqpigatgtxvytmkxumxu
supabase secrets list                            # 線上函式 secrets
supabase functions list                          # 已部署函式
supabase functions logs telegram-webhook         # webhook log

# --- 端到端 ---
# 在 Telegram 對 @ixoTraffic_bot 送 /start、/parking，確認有回應
```

**2026-10-16 實測結果（基準）**：上述公開端點全部通過——webhook URL 正確且
pending=0、getMe=ixoTraffic_bot、mcp.ixo.app=200、mcp-server 未授權=401、
最近 Deploy 與 Daily Report workflow 皆 success。

---

## 8. 已知事項 / 技術債 / 雷點

1. **兩套指令邏輯未共用**：Telegram（inline）vs LINE（`_shared/core-handler.ts`）。
   改行為時兩邊都要改，否則會漂移。建議未來統一走 shared handler。
2. **CI 的 `db push` 會阻斷 function 部署**（見第 5 節雷點）。
3. **Telegram webhook 曾被清空導致全站無回應**（2026-10-16 事件，詳見
   `docs/incident-2026-10-16-webhook-outage.md`）。已加自癒機制：daily-report 每天
   檢查並自動重設 webhook，部署後也會立即檢查。
4. **MCP 版本協商**：mcp-lite 寫死支援 `2025-06-18`，用 shim 把新 client 降級。
   目前 Gemini 正常。「某天 Gemini 突然連不上」才需處理（詳見 `mcp/HANDOFF.md`）。
5. **Bot token 曾於維護對話中明文出現**（2026-10-16）。交付者評估非關鍵服務，
   決定暫不 revoke。**接手後建議重新產生 token**：BotFather → `/mybots` →
   @ixoTraffic_bot → API Token → Revoke，取得新 token 後：(a) 更新 Supabase secret
   `TELEGRAM_BOT_TOKEN`，(b) 重新部署或等下次部署，(c) 用新 token 重設 webhook
   （`npm run webhook:set` 或部署後的自癒）。
6. **pg_cron `monitoring-job`** 依賴 `app.monitoring_function_url` 等 DB settings，
   若未設定則該 job 實際不會做事（非每日報表，別搞混）。

---

## 9. 需要向交付者索取的東西（本文件未含）

- [ ] Supabase Dashboard 存取權（或轉移專案 owner）
- [ ] Telegram bot token（或接手後自行 revoke 重產，見 8.5）
- [ ] TDX client_id / client_secret（及 trial key）
- [ ] LINE channel secret / access token（若要維護 LINE）
- [ ] Cloudflare 帳號存取（`cokefever@gmail.com`）或轉移 Worker / `mcp.ixo.app` 網域
- [ ] GitHub repo 存取權（collaborator 或轉移）
- [ ] `SUPABASE_ACCESS_TOKEN`（CI 用；或接手後自行產生新的並更新 GitHub secret）

---

## 10. 相關文件索引

| 文件 | 內容 |
|------|------|
| `README.md` | 功能介紹、支援範圍 |
| `docs/deploy-supabase.md` | Supabase 部署詳解 |
| `docs/github-actions-setup.md` | CI secrets 設定 |
| `docs/tdx-api-guide.md` | TDX API 使用 |
| `docs/user-guide.md` / `docs/quick-start.md` | 使用者指南 |
| `mcp/HANDOFF.md` / `mcp/SPEC.md` / `mcp/DEPLOYMENT.md` | MCP server 細節 |
| `docs/incident-2026-10-16-webhook-outage.md` | Webhook 中斷事件記錄 |
| 本文件 `docs/HANDOFF.md` | 專案整體接手指南 |
