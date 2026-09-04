# MCP Server 接手筆記（Gemini Spark 整合）

> 換電腦接手用。所有進度都在 GitHub `main`（最新 commit `1149ef2`）。
> 回家 `git pull` 即可續作。工作目錄乾淨，無未 commit 變更。

## 更新（commit feb7ea9）：已改成「同視窗」OAuth 流程

採用了下方「方案 A」。out-of-band Telegram 手動 return 連結已移除，改為 Gemini
popup 內的輪詢頁面，綁定完成後由頁面自身導回 Gemini callback，讓 Gemini 接著打 `/token`。

改動：
- `oauth.ts`：新增 `/authorize/create`（回 JSON：nonce + Telegram deep link）與
  `/authorize/poll`（回 `pending` / `ready`+`redirect` / `expired` / `error`）。
  保留舊的 `/authorize` 302 與 `/authorize/return` 當 fallback。
- `index.ts`：接上 `/authorize/create`、`/authorize/poll` 路由。
- `cloudflare-worker/src/worker.js`：攔截 `GET /authorize`，改由 **Worker 直接產 HTML**
  同視窗頁面（避開 Supabase 把 text/html 降級成 text/plain 的問題）。頁面開 Telegram
  綁定、每 2 秒 poll `/authorize/poll`，`ready` 時 `window.location = redirect`。
- `telegram-webhook/index.ts`：綁定成功訊息簡化，不再需要手動點 return 連結。

已部署 / 已驗證：
- ✅ Supabase functions `mcp-server` + `telegram-webhook` 已用 CLI 部署（並 push 到 main，CI 同步）。
- ✅ `curl` 驗證 `/authorize/create` 回正確 JSON、`/authorize/poll` 回 `pending`、
  未知 nonce 回 error、缺參數回 400，clean domain (`mcp.ixo.app`) pass-through 正常。
- ⏳ **待辦：部署 Cloudflare Worker**（新的 HTML 頁面尚未上線）。這台可能還沒登入 Cloudflare。
  ```bash
  cd cloudflare-worker
  npx wrangler login        # 用 cokefever@gmail.com；或設 CLOUDFLARE_API_TOKEN 免瀏覽器
  npx wrangler deploy
  ```
  部署後：`curl -i https://mcp.ixo.app/authorize?response_type=code&redirect_uri=...&code_challenge=...&code_challenge_method=S256`
  應回 **200 text/html**（而非 302），代表新流程上線。之後在 Gemini 重新連 `https://mcp.ixo.app/mcp` 實測。

---

## （歷史）目前狀態：卡在 OAuth 最後一段（token exchange）

整條 MCP + OAuth 探索鏈路已通，卡在**綁定後 Gemini 沒有完成連線**。

### 已完成且驗證通過 ✅

- **MCP server** 部署在 Supabase Edge Function `mcp-server`，兩個工具
  `find_parking` / `query_traffic`，本地實測回傳真實 TDX 資料
  （台北101 → 71 筆停車、台北車站 → 37 筆路況）。
- **Cloudflare Worker** 部署在 `mcp.ixo.app`（Custom Domain，DNS + TLS 自動），
  當薄代理把乾淨路徑轉發到 Supabase function。程式碼在 `cloudflare-worker/`。
  - 帳號 cokefever@gmail.com / CokeFever（wrangler 已在**這台**登入；另一台需重新 `npx wrangler login` 或用 API token）。
- **OAuth 探索**（RFC 9728 / 8414）全部指向乾淨網域，已用 curl 驗證：
  - `https://mcp.ixo.app/.well-known/oauth-protected-resource/mcp`
    → `{"resource":"https://mcp.ixo.app/mcp","authorization_servers":["https://mcp.ixo.app"]}`
  - `https://mcp.ixo.app/.well-known/oauth-authorization-server`
    → issuer / authorize / token / register 皆 `https://mcp.ixo.app/...`
  - `POST https://mcp.ixo.app/mcp` (initialize, 無 token) → **401 + WWW-Authenticate**
    指向 `https://mcp.ixo.app/.well-known/oauth-protected-resource`
  - `POST /register` → 201 + client_id（DCR 正常）
  - `POST /token`（壞 code）→ 正確 JSON error（Worker POST 轉發正常）
- **Supabase secrets** 已設：`MCP_PUBLIC_URL=https://mcp.ixo.app`、
  `MCP_SERVER_URL=https://mcp.ixo.app`（function 已重新部署吃到）。
- **Telegram 綁定成功**：Gemini → `/authorize` → 302 到 Telegram bot
  → 使用者綁定 → bot 回傳 return 連結。

### 卡住的點 ❌

在 Gemini Spark 填 `https://mcp.ixo.app/mcp`、走完 Telegram 綁定、點了 bot 給的
return 連結後，Gemini 顯示：**"We had trouble connecting to this server."**

## 根因分析（推測，尚未用 log 證實）

目前 OAuth 是「**out-of-band Telegram 綁定**」設計：
1. Gemini 在 popup 開 `/authorize` → 我們 **立刻 302 到 `t.me/...`**（離開 Gemini 的 OAuth 視窗）
2. 使用者在 Telegram 綁定，拿到一個 **需手動點擊** 的 return 連結
   `https://mcp.ixo.app/authorize/return?nonce=...`
3. 該連結 302 回 Gemini 的 `redirect_uri`，帶 `code` + `state`

**問題**：Gemini 的 OAuth 是在它自己開的視窗等待 `/authorize` 最終 302 回它的
callback。但我們的流程中途跳去 Telegram、又要使用者**在別的地方手動點 return 連結**，
Gemini 原本監聽的視窗/context 收不到那個回呼，於是 `/token` 從未被呼叫。

參考佐證：有人回報即使完全照規範（DCR/PKCE/exact redirect/state）實作，
Gemini Spark 收到 302 callback 後仍不呼叫 `/token`
（<https://discuss.ai.google.dev/t/gemini-spark-custom-mcp-oauth-stops-after-302-callback-and-never-calls-token/177327>）。
我們的情況更複雜，因為多了 Telegram 手動 return 這一跳。

## 下一步（回家後續作）

### 1. 先拿真實 log 確認失敗點（最重要）
用 Supabase CLI tail function log，重跑一次 Gemini 連線，看 `/token` 到底有沒有被呼叫：
```bash
supabase login   # 需要 access token
supabase functions logs mcp-server --project-ref yqpigatgtxvytmkxumxu
# 或 dashboard: Edge Functions → mcp-server → Logs
```
判讀：
- 若 **完全沒有 `/token`**：問題是 Gemini 的 callback context 斷掉（見方案 A）。
- 若 **有 `/token` 但回錯**：看是 PKCE / code 過期 / redirect_uri 比對問題。

### 2. 方案 A：改成「同視窗」OAuth（推薦，避免 out-of-band 斷鏈）
把 `/authorize` 從「立刻 302 到 Telegram」改成**回一個 HTML 頁面**（在 Gemini 開的
同一個視窗），該頁面：
- 提供按鈕開 Telegram（新分頁）做綁定
- 每 2 秒輪詢 `/authorize/poll?nonce=...`
- 綁定完成後由頁面自身 `window.location = <redirect_uri>?code=...&state=...`
  → 在 Gemini 原視窗完成 callback，Gemini 才會接著打 `/token`

⚠️ 已知風險：**Supabase Edge 會把 `text/html` 回應改寫成 `text/plain`**（先前踩過）。
需要先驗證這點是否仍成立：
```bash
curl -i https://mcp.ixo.app/authorize-test-html   # 看 Content-Type 有沒有被改成 text/plain
```
若 HTML 被降級，改用 **Cloudflare Worker 直接產生那個 HTML 頁面**（Worker 不受 Supabase
的 content-type 改寫限制），Worker 再輪詢 Supabase 的 poll endpoint。這其實是目前架構
的自然延伸（Worker 已經在 `mcp.ixo.app` 前面）。

### 3. 方案 B：驗證是否為 Gemini Spark 本身的 callback bug
上面論壇案例顯示可能是 Gemini 端問題。可先用標準 MCP client（如 MCP Inspector 或
`npx @modelcontextprotocol/inspector`）連 `https://mcp.ixo.app/mcp` 跑完整 OAuth，
確認我們 server 端 OAuth 是完全正確的 —— 若 Inspector 能成功，代表 server 沒問題，
是 Gemini Spark 對 out-of-band 流程的相容性問題，就走方案 A 的同視窗設計。

## 關鍵檔案 / 資訊

| 項目 | 位置 / 值 |
|------|-----------|
| MCP server 程式 | `supabase/functions/mcp-server/{index,oauth,mcp-tools,geocode}.ts` |
| OAuth 邏輯 | `supabase/functions/mcp-server/oauth.ts`（`handleAuthorize` / `handleAuthorizeComplete` = `/authorize/return` / `handleToken` / `handleRegister`）|
| Cloudflare Worker | `cloudflare-worker/src/worker.js` + `wrangler.toml`（custom_domain）|
| Telegram 綁定 | `supabase/functions/telegram-webhook/index.ts`（`handleMcpAuthBinding`，`/start mcpauth_<nonce>`）|
| DB schema | `supabase/migrations/011_add_mcp_oauth.sql`（`mcp_oauth_nonces` + `mcp_oauth_tokens`）|
| 部署 | GitHub Actions `deploy-supabase.yml`，push 到 main 自動部署 function + `supabase db push`。Worker 需另外 `npx wrangler deploy`。|
| 對外 MCP URL | `https://mcp.ixo.app/mcp`（給 Gemini 填的）|
| Supabase project ref | `yqpigatgtxvytmkxumxu` |
| nonce TTL | 10 分鐘；auth code 一次性（換 token 後刪除）|

## 環境備忘（換電腦要重建）
- deno（Supabase Edge runtime）、supabase CLI、node 20+、wrangler
- **這台**：deno 在 `%LOCALAPPDATA%\Microsoft\WinGet\Links\deno.exe`（winget shim，不在 PATH，要用絕對路徑）；supabase 在 `%USERPROFILE%\scoop\shims`
- 另一台需重新 `npx wrangler login`（或用 Cloudflare API token）與 `supabase login`
- 前提提醒：使用者要在 Telegram bot `/setup` 設好自己的 TDX API key，MCP 才查得到資料（不共用 trial key）
