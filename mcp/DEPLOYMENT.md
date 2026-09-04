# MCP Server 部署與測試指南

## 前置需求（本機）

需要安裝以下工具（這台開發機目前**沒有**安裝，需補上）：

```bash
# Deno (Supabase Edge Functions runtime)
# Windows (PowerShell):
irm https://deno.land/install.ps1 | iex

# Supabase CLI
# 建議用 scoop 或直接下載：https://github.com/supabase/cli/releases
scoop install supabase
```

## 步驟 1：套用資料庫 migration

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

這會建立 `mcp_oauth_nonces` 與 `mcp_oauth_tokens` 表（migration 011）。

## 步驟 2：設定 Edge Function Secrets

```bash
supabase secrets set TELEGRAM_BOT_USERNAME=ixoTraffic_Bot
# 選用（本地測試 fallback，正式環境不需要，因為走 per-user key）：
# supabase secrets set TDX_MCP_API_KEY=<client_id>:<client_secret>
```

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` Edge Functions 會自動注入。

## 步驟 3：本地測試（可選，但建議）

```bash
# 啟動本地 Supabase
supabase start

# 另開 terminal，serve MCP function
supabase functions serve mcp-server --no-verify-jwt

# MCP server 位於：
# http://localhost:54321/functions/v1/mcp-server/mcp
```

### 用 MCP Inspector 測試

```bash
npx @modelcontextprotocol/inspector
```

在 Inspector UI 填入 endpoint：`http://localhost:54321/functions/v1/mcp-server/mcp`

**注意**：本地測試 tools 時，OAuth 尚未綁定，`ctx.state.tdxApiKey` 為空，
會 fallback 到 `TDX_MCP_API_KEY` 環境變數。所以本地測試前記得設定該變數。

### 用 curl 測試 tools/list

```bash
curl -X POST http://localhost:54321/functions/v1/mcp-server/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 步驟 4：部署到 production

```bash
supabase functions deploy mcp-server --no-verify-jwt
```

> `--no-verify-jwt`：因為 MCP 用自己的 OAuth，不用 Supabase 內建 JWT 驗證。

部署後 endpoint：
```
https://<project-ref>.supabase.co/functions/v1/mcp-server/mcp
```

## 步驟 5：在 Gemini Spark 連結

1. 用**個人 Google 帳號 (美國)** 登入 Gemini web app (gemini.google.com)
2. 確認 Keep Activity 已開啟
3. Settings → Connected Apps → Custom apps
4. 填入 MCP server URL：
   `https://<project-ref>.supabase.co/functions/v1/mcp-server/mcp`
5. Gemini 會導向 OAuth 授權 → 302 到 Telegram
6. 在 Telegram 完成綁定（需已設定 TDX API Key）
7. 回到 Gemini，即可用自然語言查詢

## OAuth 流程驗證清單

- [ ] `GET /mcp-server/.well-known/oauth-protected-resource` 回傳 JSON
- [ ] `GET /mcp-server/.well-known/oauth-authorization-server` 回傳 JSON
- [ ] `GET /mcp-server/authorize?...` 302 到 t.me/ixoTraffic_Bot?start=mcpauth_xxx
- [ ] Telegram `/start mcpauth_xxx`：未設 TDX key → 提示先 /setup
- [ ] Telegram `/start mcpauth_xxx`：已設 TDX key → 綁定成功
- [ ] `GET /mcp-server/authorize/complete?nonce=xxx`：綁定前 202 pending，綁定後 302 帶 code
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

## 待辦（Phase 5 完成後）

- [ ] 部署到 production 並實測
- [ ] daily-report 加入 MCP 使用統計
- [ ] merge feature/mcp-server → main
