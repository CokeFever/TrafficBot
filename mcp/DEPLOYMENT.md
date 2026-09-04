# MCP Server 部署與測試指南

## 部署方式：GitHub Actions（push 到 main 自動觸發）

本專案的 Supabase 部署一律由 `.github/workflows/deploy-supabase.yml` 處理：
push 到 `main` 時，CI 會 `supabase db push`（套用 migrations）並
`supabase functions deploy` 每個 function（含 `mcp-server`）。

**不需要**在本機手動 deploy。合併 `feature/mcp-server` → `main` 後即自動部署。

CI 已包含 mcp-server：
```yaml
supabase functions deploy mcp-server --no-verify-jwt
```
> `--no-verify-jwt`：Gemini 呼叫時不帶 Supabase JWT，驗證由 function 自己的 OAuth 2.1 層處理。

migration 011（`mcp_oauth_nonces`、`mcp_oauth_tokens`）會由 CI 的 `supabase db push` 自動套用。

## ⚠️ 為什麼需要 Cloudflare Worker（乾淨網域前置代理）

Gemini 依 RFC 9728 / RFC 8414 探索 OAuth metadata 時，會打 **網域根目錄** 的
well-known 路徑，例如：
```
https://<host>/.well-known/oauth-protected-resource/mcp
https://<host>/.well-known/oauth-authorization-server
```
但 Supabase Edge Function 只能掛在 `/functions/v1/<name>/` 底下，**根目錄的
`/.well-known/...` 到不了 function**（回 404/401）。所以直接把 Supabase URL 給
Gemini 會失敗，錯誤訊息：*"This MCP server uses an authentication method that
Gemini doesn't support"*。

**解法**：用一個 Cloudflare Worker 掛在 `mcp.ixo.app`，把乾淨路徑轉發到 Supabase
function，並在根目錄提供 well-known。給 Gemini 的 URL 變成 `https://mcp.ixo.app/mcp`。

Worker 程式碼在 `cloudflare-worker/`，是透明薄代理（不碰 body / token / auth）。

### 部署 Worker

```bash
cd cloudflare-worker
npx wrangler deploy
```

前提：`ixo.app` 是此 Cloudflare 帳號的 active zone（DNS 已在 Cloudflare）。
`wrangler.toml` 的 route `mcp.ixo.app/*` 會自動建立對應的 DNS/route。
若 `mcp` 子網域尚未存在，wrangler 部署時會提示建立（或手動在 Cloudflare DNS 加一筆
proxied 記錄）。

### 驗證 Worker

```bash
curl https://mcp.ixo.app/.well-known/oauth-protected-resource/mcp
# → {"resource":"https://mcp.ixo.app/mcp","authorization_servers":["https://mcp.ixo.app"],...}
curl -X POST https://mcp.ixo.app/mcp -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
# → 401 + WWW-Authenticate（OAuth 探索觸發）
```

## Secrets 設定（一次性，在 Supabase Dashboard）

現有 function 的 secrets（`TELEGRAM_BOT_TOKEN`、`LINE_CHANNEL_ACCESS_TOKEN`、
`SUPABASE_SERVICE_ROLE_KEY` 等）都設在 Supabase Dashboard（Project Settings → Edge Functions → Secrets），
CI 不負責設定 secrets。

搭配 Cloudflare Worker 後，**必須**設定兩個 secret 讓 metadata 與回連結指向乾淨網域：

| Env | 值 | 是否需手動設 |
|-----|------|--------------|
| `MCP_PUBLIC_URL` | `https://mcp.ixo.app` | **是**（metadata 用乾淨網域，OAuth 探索才會成功）|
| `MCP_SERVER_URL` | `https://mcp.ixo.app` | **是**（Telegram 回連 Gemini 的 return link）|
| `TELEGRAM_BOT_USERNAME` | `ixoTraffic_Bot` | 否（預設即此值）|
| `TDX_MCP_API_KEY` | 無 | 否（正式環境走 per-user key，此僅本地 fallback）|

在 Supabase Dashboard → Edge Functions → Secrets 新增：
```
MCP_PUBLIC_URL = https://mcp.ixo.app
MCP_SERVER_URL = https://mcp.ixo.app
```

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` Edge Functions 會自動注入。

## 本地測試（已驗證，開發機用 deno 直跑）

開發機已安裝 deno（winget shim）與 supabase CLI。最快的本地驗證是直接跑 function：

```bash
# 在 supabase/functions/mcp-server/ 底下
deno run --allow-net --allow-env --env-file=../../../.env index.ts
# → Listening on http://localhost:8000/
```

MCP endpoint：`http://localhost:8000/mcp-server/mcp`

本地測試 tools 時 OAuth 尚未綁定，`ctx.state.tdxApiKey` 為空，會 fallback 到
`TDX_MCP_API_KEY` 環境變數（`<client_id>:<client_secret>` 格式）。正式環境走 per-user key，不需要此變數。

### 用 curl 測試

```bash
# tools/list
curl -X POST http://localhost:8000/mcp-server/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# tools/call 不帶 token → 預期 401 + WWW-Authenticate（OAuth 守門正常）
```

已驗證：`initialize`、`tools/list`（兩工具 schema 正確）、`tools/call` 401 守門、
OAuth discovery endpoints；並透過 handler 直呼驗證 find_parking（台北101 → 71 筆）
與 query_traffic（台北車站 → 37 筆）都回傳真實 TDX 資料。

### （可選）用 Supabase 本地 runtime + MCP Inspector

```bash
supabase start
supabase functions serve mcp-server --no-verify-jwt
# endpoint: http://localhost:54321/functions/v1/mcp-server/mcp
npx @modelcontextprotocol/inspector
```

## 部署到 production

合併 `feature/mcp-server` → `main`，GitHub Actions 會自動部署。

部署後（透過 Cloudflare Worker）對外 endpoint：
```
https://mcp.ixo.app/mcp
```

## 在 Gemini Spark 連結

1. 用**個人 Google 帳號 (美國)** 登入 Gemini web app (gemini.google.com)
2. 確認 Keep Activity 已開啟
3. Settings → Connected Apps → Custom apps
4. 填入 MCP server URL（**乾淨網域，非 Supabase URL**）：
   `https://mcp.ixo.app/mcp`
5. Client ID / Client secret **留空**（走 Dynamic Client Registration）
6. Gemini 會導向 OAuth 授權 → 302 到 Telegram
7. 在 Telegram 完成綁定（需已設定 TDX API Key）
8. 回到 Gemini，即可用自然語言查詢

## OAuth 流程驗證清單

- [ ] `GET /mcp-server/.well-known/oauth-protected-resource` 回傳 JSON
- [ ] `GET /mcp-server/.well-known/oauth-authorization-server` 回傳 JSON
- [ ] `GET /mcp-server/authorize?...` 302 到 t.me/ixoTraffic_Bot?start=mcpauth_xxx
- [ ] Telegram `/start mcpauth_xxx`：未設 TDX key → 提示先 /setup
- [ ] Telegram `/start mcpauth_xxx`：已設 TDX key → 綁定成功並回傳「返回 Gemini」連結
- [ ] `GET /mcp-server/authorize/return?nonce=xxx`：綁定前 202 pending，綁定後 302 帶 code
- [ ] `POST /mcp-server/token`（code + PKCE verifier）→ 回 access_token
- [ ] `POST /mcp-server/mcp`（Bearer token）→ tools 可執行且用該使用者的 TDX key

## 疑難排解

| 問題 | 檢查 |
|------|------|
| tools/list 空 | 確認 registerTools 有被呼叫 |
| 401 一直出現 | 確認 token 有效、mcp_oauth_tokens 有紀錄 |
| No TDX API key available | 使用者未 /setup，或 token 對應的 user_configs 無 tdx_api_key |
| 綁定連結失效 | nonce 10 分鐘過期，重新從 Gemini 發起 |
| CPU timeout | 台北查詢抓 TCMSV 2.8MB，注意 2 秒限制；靜態資料建議加快取 |

## 待辦

- [ ] merge feature/mcp-server → main（觸發 GitHub Actions 自動部署）
- [ ] 部署後在 Gemini Spark 實測 OAuth 綁定 + 查詢
- [ ] daily-report 加入 MCP 使用統計
