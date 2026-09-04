# TrafficBot MCP Server — 規格文件

> Model Context Protocol server，讓 Gemini Spark 能查詢台灣停車位與路況。
> Status: **開發中** (feature/mcp-server branch)
> Last updated: 2026-08

---

## 1. 目標

把現有 TrafficBot 的「找停車位」與「查路況」功能，以 MCP (Model Context Protocol)
server 的形式提供給 Gemini Spark 使用。相較於 Telegram/LINE 的一問一答互動，
Gemini 可以：

- 自動判斷使用者意圖（找車、查路況）
- 取得多筆結構化結果後，自行分析並推薦最佳選項
- 直接串接 Google Maps 導航

## 2. 前提條件（硬性限制）

| 條件 | 說明 | 來源 |
|------|------|------|
| Gemini Spark | 使用者必須有 Gemini Spark 存取權 | Google 官方 |
| 地區/帳號 | 需在美國、年滿 18、個人 Google 帳號 | Google 官方 |
| 語言 | Custom MCP apps 目前僅支援英文（tool description 用英文） | Google 官方 |
| Keep Activity | 必須開啟 | Google 官方 |
| 設定位置 | 只能在 Gemini web app 加入 custom app | Google 官方 |
| **TDX API Key** | 使用者必須綁定自己的 TDX key，**不使用共用試用 key** | 專案決策 |

## 3. 架構

```
Gemini Spark (US account, English)
    │ StreamableHTTP + OAuth 2.1
    ↓
Supabase Edge Function: mcp-server
    ├── /.well-known/oauth-protected-resource   (JSON)   RFC 9728
    ├── /.well-known/oauth-authorization-server (JSON)   RFC 8414
    ├── /authorize   → 302 redirect 到 Telegram deep link
    ├── /token       → code 換 access token (JSON)
    └── /mcp         → MCP protocol (initialize / tools/list / tools/call)
    ↓
Telegram Bot (既有) — /start <nonce> 綁定 + 檢查 TDX key
    ↓
_shared/tdx-client.ts (重用：停車 / 路況 / TCMSV)
```

### 技術棧

| 元件 | 選擇 | 依據 |
|------|------|------|
| MCP 框架 | mcp-lite | Supabase 官方推薦，零依賴，Deno 原生 |
| 路由 | Two Hono apps pattern | Supabase Edge Function 路由要求 |
| 傳輸 | StreamableHTTP | Gemini + MCP spec 要求（不支援舊 SSE） |
| 部署 | Supabase Edge Functions | 重用現有基礎設施 |
| 認證 | OAuth 2.1 + PKCE + Telegram 綁定 | MCP spec + 重用既有身分 |

## 4. OAuth 2.1 流程

MCP server 扮演 **OAuth Resource Server** 角色。採用 Authorization Code + PKCE (S256)。

```
1. Gemini 呼叫 /mcp tools/call（無 token）
2. Server 回 401 + WWW-Authenticate → 指向 protected resource metadata
3. Gemini 讀 /.well-known/oauth-protected-resource → 得知 auth server
4. Gemini 讀 /.well-known/oauth-authorization-server → OAuth metadata
5. Gemini 導向 /authorize（帶 PKCE challenge, redirect_uri, state）
6. /authorize 產生 nonce，302 redirect 到 t.me/ixoTraffic_Bot?start=mcpauth_<nonce>
7. 使用者在 Telegram 完成綁定：
   - Bot 收到 /start mcpauth_<nonce>
   - 檢查該 Telegram user 是否已設定 TDX key
     - ❌ 未設定 → 回覆「請先 /setup 設定 TDX API Key」，綁定失敗
     - ✅ 已設定 → nonce 標記 authorized + 綁定 telegram_user_id
       並回覆一個「返回 Gemini 完成連結」的按鈕/連結，指向
       /authorize/return?nonce=<nonce>
8. 使用者點該連結 → /authorize/return 檢查 nonce 已授權 →
   產生 auth code → 302 redirect 回 Gemini 的 redirect_uri（帶 code + state）
9. Gemini 用 code + PKCE verifier 呼叫 /token → 拿 access_token
10. Gemini 之後每次呼叫 /mcp 都帶此 token
```

> 說明：因為身分驗證是「帶外 (out-of-band)」透過 Telegram，標準 OAuth 的
> 「/authorize 直接 redirect 回 client」被拆成兩段：先去 Telegram 綁定，
> 綁定成功後 Telegram 給一個「返回連結」讓使用者回到 /authorize/return，
> 由它 302 回 Gemini。這樣完全用 302（不需 HTML 頁面），符合 Supabase 限制。

### 為什麼用 Telegram 綁定？

- 重用既有的 Telegram 使用者身分，不用另建帳號系統
- 使用者的 TDX API key 已存在 DB（用 telegram_user_id 索引）
- MCP 呼叫時透過 token → telegram_user_id → 取得該使用者的 TDX key

## 5. MCP Tools

所有 tool 為唯讀，設 `readOnlyHint: true` 以跳過 Gemini 的手動確認。
Description 使用英文（Google 限制）。回傳結構化 JSON（非 Markdown），讓 Gemini 自行分析。

### `find_parking`

```
Description: Find nearby parking lots and on-street parking in Taiwan.
Input:
  - location: string   # place name (e.g. "Taipei 101") or "lat,lon"
  - radius: number     # 250 | 500 | 1000 (meters), default 1000
  - vehicle_type: string  # "car" | "motorcycle" | "all", default "all"
Output (JSON):
  {
    "parking_lots": [
      {
        "name", "category" (offstreet|onstreet), "address",
        "distance_m", "available_spaces", "total_spaces",
        "fare", "service_time", "latitude", "longitude",
        "navigation_url"
      }
    ],
    "query_location": { "latitude", "longitude", "resolved_name" },
    "total_found"
  }
```

### `query_traffic`

```
Description: Query real-time traffic conditions near a location in Taiwan.
Input:
  - location: string
  - radius: number     # 250 | 500 | 1000
Output (JSON):
  {
    "traffic": [
      { "road_name", "status" (smooth|slow|congested),
        "distance_m", "message", "speed_kmh", "type" (cms|vd) }
    ],
    "query_location": { ... }
  }
```

## 6. 資料庫 Schema（新增，不影響現有表）

```sql
-- OAuth authorization nonces (Telegram 綁定用，短期有效)
CREATE TABLE mcp_oauth_nonces (
  nonce           TEXT PRIMARY KEY,
  code_challenge  TEXT NOT NULL,       -- PKCE S256 challenge
  redirect_uri    TEXT NOT NULL,
  state           TEXT,
  telegram_user_id TEXT,               -- 綁定後填入
  authorized      BOOLEAN DEFAULT FALSE,
  auth_code       TEXT,                -- 授權後產生的 code
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL -- 建議 10 分鐘
);

-- OAuth access tokens
CREATE TABLE mcp_oauth_tokens (
  access_token     TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL -- 建議 30 天，可搭配 refresh
);

-- 兩張表都啟用 RLS，只允許 service_role 存取
```

## 7. 檔案結構（獨立資料夾管理）

```
mcp/                              # MCP 相關文件與工具（此資料夾）
├── SPEC.md                       # 本規格文件
├── README.md                     # 開發/部署快速指南
└── DEPLOYMENT.md                 # 部署步驟（Phase 5 補上）

supabase/functions/
├── mcp-server/                   # 新增：MCP Edge Function
│   ├── index.ts                  # Two Hono apps: OAuth + MCP (mcp-lite)
│   ├── oauth.ts                  # OAuth 2.1 endpoints + PKCE + nonce/token
│   ├── mcp-tools.ts              # find_parking, query_traffic tool 定義
│   └── deno.json                 # import map
├── _shared/
│   └── tdx-client.ts             # 重用（唯讀，不修改）
└── telegram-webhook/
    └── index.ts                  # 修改：新增 /start <nonce> 綁定分支

supabase/migrations/
└── 0XX_add_mcp_oauth.sql         # 新增 oauth 資料表
```

## 8. 隔離性保證（不影響現有服務）

| 面向 | 隔離狀況 |
|------|----------|
| Edge Function | 全新 `mcp-server`，不碰現有 telegram/line/daily-report |
| 部署 | 各 function 獨立部署 |
| 共用邏輯 | 只讀 `_shared/tdx-client.ts`，純新增 mcp-tools/oauth |
| 資料表 | 只新增 mcp_oauth_*，不改現有表 |
| Telegram bot | 唯一接觸點：`/start <nonce>` 新增分支，無參數行為不變 |
| Git | feature/mcp-server branch，不觸發 main 的自動部署 |

## 9. Supabase 免費方案評估

| 資源 | 免費額度 | MCP 影響 | 風險 |
|------|----------|----------|------|
| Edge Function 呼叫 | 500K/月 | 每查詢 1-2 次 | 🟢 極低 |
| 資料庫 | 500 MB | oauth 表很小 | 🟢 無 |
| 頻寬 egress | 10 GB/月 | JSON 回應小 | 🟢 可接受 |
| 自動暫停 | 閒置 1 週 | 已由 daily-report cron keep-alive | 🟢 已解決 |

## 10. 開發階段

- [x] Phase 0: 規格確認 + branch 建立
- [x] Phase 1: MCP 骨架 (mcp-lite + Two Hono) + find_parking
- [x] Phase 2: query_traffic tool
- [x] Phase 3: OAuth 2.1 endpoints + PKCE
- [x] Phase 4: Telegram 綁定 flow + DB schema (migration 011)
- [ ] Phase 5: 部署 + Gemini Spark 實測（需 deno/supabase CLI）

### 實作對應檔案

| 元件 | 檔案 |
|------|------|
| MCP server 入口 + auth middleware | `supabase/functions/mcp-server/index.ts` |
| MCP tools | `supabase/functions/mcp-server/mcp-tools.ts` |
| 地點解析 | `supabase/functions/mcp-server/geocode.ts` |
| OAuth 2.1 | `supabase/functions/mcp-server/oauth.ts` |
| Telegram 綁定 | `supabase/functions/telegram-webhook/index.ts` (`handleMcpAuthBinding`) |
| DB schema | `supabase/migrations/011_add_mcp_oauth.sql` |

### 需要的環境變數 (Edge Function Secrets)

| 變數 | 用途 |
|------|------|
| `SUPABASE_URL` | 已有 |
| `SUPABASE_SERVICE_ROLE_KEY` | 已有 |
| `TELEGRAM_BOT_USERNAME` | Telegram deep link（預設 ixoTraffic_Bot）|
| `MCP_SERVER_URL` | Telegram 回傳連結用的 MCP base URL（預設 `${SUPABASE_URL}/functions/v1/mcp-server`）|
| `TDX_MCP_API_KEY` | 選用，Phase 1 本地測試用的 fallback key |

## 11. 開發原則

- Tool 回傳結構化 JSON，讓 Gemini 自行分析推薦
- 所有 tool description 用英文
- 唯讀 tool 設 readOnlyHint 跳過確認
- Edge Function CPU 限制 2 秒 → 查詢需快速（善用快取）
- 台北市停車走 TCMSV，其他城市走 TDX
