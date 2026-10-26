# Telegram Bot 全指令無回應 — 根因調查報告

**狀態：READ-ONLY 調查（未修改任何程式碼、未重啟任何服務）**
**日期：調查當日**
**Supabase 專案 ref：`yqpigatgtxvytmkxumxu`（來源：`supabase/.temp/project-ref`）**

> **重要更新（調查中收到的新事實）：** 不只是 `/parking`，**所有指令（連 `/start` 都）無回應**。這把根因從「停車/配額業務邏輯」決定性地收斂到**整條 inbound webhook 路徑壞掉**。本報告已依此重新排序：trial 配額、`user_states` 寫入、停車查詢等「只會影響 `/parking`」的因素已降級為非主因。

---

## 摘要（先講結論）

使用者在 Telegram 送出**任何**指令（`/start`、`/parking`、…）都完全沒有回應。這代表問題在 **webhook 進入點之前或啟動階段**，而不是任何單一指令的處理邏輯。

決定性證據：`/start` 的處理路徑**完全不碰資料庫、不碰 TDX、不碰配額**。
`telegram-webhook/index.ts:116-123`：
```ts
case 'start':
  if (args.length > 0 && args[0].startsWith('mcpauth_')) { ... break; }
  await sendMessage(chatId, getWelcomeMessage(), botToken);   // 純字串，無 DB
  break;
```
`getWelcomeMessage()` 是一個純回傳字串的函式（`index.ts` 下半），不讀 DB、不讀 env。
**因此「連 `/start` 都沒反應」只可能有三種解釋：**(a) 這個函式根本沒被呼叫到（webhook 未送達），(b) 函式在跑到 handler 之前就開機失敗，或 (c) `sendMessage` 送到 Telegram 的呼叫失敗（例如 bot token 失效）。業務邏輯一律排除。

對照「每日排程報表正常」：這**無法**證明 webhook 健康。兩者是不同進入點：

- 每日報表由 GitHub Actions (`.github/workflows/daily-report.yml`) 直接用 anon key `curl` 打 `daily-report` 函式——走 `daily-report/index.ts`，不碰 webhook。
- 所有 Telegram 指令走 `telegram-webhook` 函式——走 `telegram-webhook/index.ts`。
- 報表每天成功只代表「Supabase 專案沒被暫停、`daily-report` 函式與 DB 讀取正常」，**完全不代表** Telegram webhook 收得到請求、開得起來、或 bot token 有效。

### 依可能性排序的根因

1. **【最可能】Telegram webhook 註冊指向過期/錯誤 URL，或在近期一連串 MCP 部署中被覆蓋/刪除** → update 根本沒送達函式 → 全指令無回應。
2. **【最可能，並列】`telegram-webhook` 函式啟動階段就失敗**：
   - 2a. 冷啟動 import 失敗——它是**唯一**還在用舊版 `serve` 遠端 import 的函式。
   - 2b. 啟動時缺必要環境變數/Secret（`TELEGRAM_BOT_TOKEN` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`），導致處理每個 update 時立刻丟例外並被頂層 catch 吞掉回 200。
   - 2c. 最近一次部署失敗、或該函式被停用，導致線上版本壞掉或不存在。
3. **【高度可能】`TELEGRAM_BOT_TOKEN` 失效/錯誤** → 函式有在跑、`sendMessage` 卻拿到 Telegram 非 2xx，而程式只 `console.error` 不重試不告警 → 全指令靜默。
4. **【已降級 / 非主因】** trial 配額（`checkAndUpdateTrialUsage`）、`user_states` 寫入失敗、`TDX_TRIAL_API_KEY` 缺失、停車查詢邏輯——這些**只會影響 `/parking` 的後段步驟**，無法解釋 `/start` 也死。保留於文末僅供日後查 `/parking` 專屬問題時參考。

---

## 證據（含檔案與行號）

### A. 部署的程式碼路徑確認

- Production = Edge Functions；`src/` 只是本地 Node 版本。`README.md`「專案結構」明確標註 `src/` 為「Node.js 本地開發版本」、`supabase/functions/` 為「Edge Functions (Production)」。
- 部署清單在 `.github/workflows/deploy-supabase.yml`：只部署 `telegram-webhook`、`line-webhook`、`daily-report`、`mcp-server`，全部 `--no-verify-jwt`。
- 因此 `src/handlers/parking-handler.ts`、`src/handlers/bot-handler.ts`（Telegraf 版，`src/handlers/bot-handler.ts:1` import `telegraf`）**並未部署**，排除。
- Telegram webhook **沒有 import `_shared/core-handler.ts`**；它自己 inline 複製了 `sendMessage`、`handleCommand` 等全部邏輯（`telegram-webhook/index.ts:865` 等）。只有 **LINE** webhook 用 shared handler（`line-webhook/index.ts:5-18`）。所以分析 Telegram 故障看 `telegram-webhook/index.ts` 本身。

### B.【根因 1】Webhook 註冊 URL 與近期部署史

- 註冊腳本 `scripts/setup-webhook.ts:33` 組出 URL：
  ```ts
  const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
  ```
  `:46` 設 `allowed_updates: ['message', 'callback_query']`（涵蓋所有指令，正確）。URL 完全取決於環境變數 `SUPABASE_URL`。
- 腳本亦有 `delete` 子命令（`:124`）——若曾執行 `setup-webhook delete` 而未重設，或曾用錯誤的 `SUPABASE_URL` 跑 `set`，Telegram 端的 webhook 就會指向錯誤/空位址，**所有 update 都不會送達**，與「全指令無回應」完全吻合。
- 近期 git 歷史幾乎全是 MCP 相關改動（`git log --oneline -20`：`f83cebb`…`44dc135` 連續一大串 `mcp`），含多次「trigger redeploy」「Cloudflare Worker / custom domain」操作（`1149ef2`、`0ec8d08 ... custom_domain for mcp.ixo.app`）。這是**部署與網域設定被頻繁變動的高風險時間窗**，webhook 註冊很可能在此期間漂移或被覆蓋。
- 最後一次真的改到 `telegram-webhook/index.ts` 的 commit 是 `feb7ea9 fix(mcp): same-window OAuth flow`（`2026-09-04`）。近期**沒有任何** `/start` 或指令分派邏輯的改動——再次把嫌疑指向 webhook 層（註冊/部署/啟動），而非程式邏輯。
- 無真實 secret，無法直接呼叫 Telegram API，故此項需靠下方「確認方式」當場驗證。

### C.【根因 2a】唯一使用舊版 `serve` import 的函式（冷啟動風險）

`supabase/functions/telegram-webhook/index.ts:1`：
```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
```
`:31` 用 `serve(async (req) => { ... })`。

對照其他函式——全部已改用原生 `Deno.serve`：
- `daily-report/index.ts:5` → `Deno.serve(...)`（**正常運行的那個**）
- `line-webhook/index.ts:23` → `Deno.serve(...)`
- `mcp-server/index.ts:249` → `Deno.serve(app.fetch)`

意義：`telegram-webhook` 是唯一在冷啟動需去 `deno.land/std@0.168.0` 下載並解析遠端模組的函式。若該 import 無法解析，**函式在跑到任何 handler（含 `/start`）之前就開機失敗**，Telegram 收不到 200，全指令無回應。`daily-report` 不依賴它，故照常成功——完美符合「排程正常、webhook 全死」。

### D.【根因 2b】啟動 / 每次處理所需的環境變數，與吞例外回 200

`telegram-webhook/index.ts` 進入點（`:31` 起）在處理**每個** update 時都會：
```ts
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;              // :~46
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // :~47
const supabase = createClient(supabaseUrl, supabaseKey);
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
await processUpdate(update, supabase, botToken);
```
- 這些值用 `!` 斷言。若任一 Secret 缺失，取到 `undefined`，後續 `createClient` 或送訊息時丟例外。
- 頂層錯誤處理 `:59-65`：
  ```ts
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Return 200 to prevent Telegram from retrying
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200, ... });
  }
  ```
  **這是「吞例外」模式**：任何例外都被接住、記 log、回 **200 OK 且不送任何 Telegram 訊息**。對使用者而言全指令靜默（像死掉），函式卻技術上「成功」——正好解釋「排程說正常、使用者無回應」的落差。
  （另註：`:62` 存取 `error.message` 在嚴格 TS 下屬型別議題，屬 build 期，非本次執行主因。）

### E.【根因 3】Bot token 失效 → `sendMessage` 靜默失敗

inline `sendMessage`（`:865`）：
```ts
const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {...});
if (!response.ok) {
  console.error('Failed to send message:', await response.text());   // :879-882 只記 log
}
```
若 `TELEGRAM_BOT_TOKEN` 被 revoke / 錯誤，**每一次** `sendMessage`（包含 `/start` 的歡迎訊息）都會拿到 Telegram 401/404，但程式只 `console.error`、不丟例外、不重試、不改回應——使用者端表現就是**全指令完全靜默**。這與現象高度吻合，且不需要函式崩潰即可發生。

### F.【根因 2c】部署失敗 / 函式被停用

- 最新 `main` commit `f83cebb` 的訊息是 `fix(db): make migration 012 idempotent to unblock deploy workflow`——明示**先前的部署 workflow 曾被卡住**。若某次部署在推 migration 階段失敗，`supabase functions deploy telegram-webhook`（在 `db push` 之後，見 `deploy-supabase.yml` 的執行順序）可能**根本沒跑到**，導致線上 `telegram-webhook` 停留在舊/壞版本，或與預期不符。需至 Dashboard 確認該函式最後成功部署時間。

### G. 已排除／非原因

- **JWT 驗證**：部署用 `--no-verify-jwt`（`deploy-supabase.yml`），且無 `supabase/config.toml`，排除。
- **Telegram secret token 驗證**：全函式無任何 `secret_token` / `x-telegram-bot-api-secret-token` 檢查（`grep` 無結果），排除。
- **`src/` Telegraf 版**：未部署，排除。
- **停車/配額/`user_states` 專屬邏輯**：只影響 `/parking` 後段，**無法解釋 `/start` 也死**，故非本次主因（詳見文末附錄）。

---

## 執行追蹤：為什麼連 `/start` 都沒反應

1. Telegram POST update → `https://<SUPABASE_URL>/functions/v1/telegram-webhook`。
   - **斷點 ①（根因 1）**：Telegram 端 webhook URL 是舊的/空的 → update 從未送達 → **所有指令**無回應。
   - **斷點 ②（根因 2a）**：函式冷啟動 import（`:1`）失敗 → 開不起來 → 無 200。
2. `serve` handler（`:31`）→ 檢查 `POST`（`:35`）→ `await req.json()`（`:39`）→ 讀 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `TELEGRAM_BOT_TOKEN`（`!` 斷言）。
   - **斷點 ③（根因 2b）**：任一 env/Secret 缺失 → 立刻丟例外 → 被 `:59` catch 吞掉 → 回 200、**無任何訊息**。
3. `processUpdate`（`:51`）→ `message` 以 `/` 開頭 → `handleCommand`。
4. `handleCommand`（`:104`）→ `case 'start'`（`:116`）→ `sendMessage(getWelcomeMessage())`（**純字串，無 DB、無配額**）。
   - **斷點 ④（根因 3）**：`sendMessage`（`:865`）打 Telegram API 拿到非 2xx（token 失效）→ 只 `console.error`（`:879`）→ 使用者**無回應**。
5. 正常情況使用者應收到歡迎訊息。`/parking` 的 DB/配額/TDX 邏輯要到更後面才會碰到，與「全指令無回應」無關。

---

## 無法驗證的部分（需 live Telegram / Supabase / secret 存取）

1. **Telegram 端 webhook 實際 URL / 錯誤狀態**——需 `getWebhookInfo`（要真實 `TELEGRAM_BOT_TOKEN`）。read-only 且無 secret，無法執行。
2. **`telegram-webhook` 冷啟動是否 import 失敗 / 處理時丟例外**——需看該函式執行 log。
3. **`TELEGRAM_BOT_TOKEN` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 等 Secret 是否存在且正確、token 是否仍有效**——需 Supabase Dashboard / BotFather。
4. **該函式最後一次成功部署時間、是否被停用、最近部署是否失敗**——需 Dashboard 或 CI log（`f83cebb` 暗示近期部署曾卡住）。

---

## 建議的確認順序（最快找出真因）

1. **先看 Telegram webhook 狀態（最快、最可能一槍命中「全指令無回應」）：**
   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
   ```
   檢查回傳的 `url`（是否 = `https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook`）、`last_error_date`、`last_error_message`、`pending_update_count`。
   - `url` 空/錯、或 `pending_update_count` 一直累積 → **根因 1**，重設 webhook 即可。
   - `last_error_message` 顯示 5xx/逾時 → 指向 **根因 2**（開機或處理失敗）。
   - 若此指令本身回 401 → **根因 3**（bot token 已失效）。

2. **看 `telegram-webhook` 的 Supabase 函式 log：**
   ```bash
   supabase functions logs telegram-webhook   # 需 CLI 登入 + link；或用 Dashboard → Edge Functions → Logs
   ```
   - 有 **boot / import error** → 根因 2a。
   - 看得到 `Received update:`（`:41`）卻接著 `Error processing webhook:`（`:60`）→ 根因 2b（多半是 env/Secret 缺失或 createClient 失敗）。
   - 看得到 `Received update:` 與 `Handling command: /start`（`:113`）但隨後 `Failed to send message:`（`:880`）→ 根因 3（token 失效）。
   - **完全沒有** `Received update:` → update 沒進來（根因 1）或函式開不起來（根因 2a/2c）。

3. **確認 Edge Function Secrets 存在且正確：**
   ```bash
   supabase secrets list   # 確認 TELEGRAM_BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
   ```
   並在 BotFather 確認 bot token 未被 revoke。

4. **確認線上部署版本與最近部署結果**（Dashboard 的 deploy 時間；對照 `f83cebb` 之後的 deploy workflow 是否成功）。

---

## 建議修復（本次不實作，僅建議）

- **對應根因 1：** 用正確的 `.env`（確認 `SUPABASE_URL`）重跑 `npm run setup-webhook set`，再以 `getWebhookInfo` 驗證 `url` 與無 `last_error`。
- **對應根因 2a：** 將 `telegram-webhook/index.ts:1,31` 的 `serve` 遠端 import 改為原生 `Deno.serve(...)`，與 `daily-report`、`line-webhook` 一致，移除冷啟動遠端 import 風險。
- **對應根因 2b / 3（避免 bot「靜默死掉」）：** （1）啟動時明確檢查必要 env，缺失就在 log 清楚報出；（2）在頂層 catch（`:59`）盡量補送一則「系統忙碌，請稍後再試」給使用者，使失敗「可見」；（3）`sendMessage` 遇非 2xx 時升級為告警（而非只 `console.error`），並修正 `:62` 的 `error.message` 型別存取。
- **對應根因 2c：** 確認最新一次 `telegram-webhook` 部署成功；若 deploy workflow 因 migration 卡住，確保函式部署步驟不被前面的 `db push` 失敗連帶中止。
- **架構層面：** Telegram webhook 目前整份 inline 複製 `core-handler.ts` 邏輯，與 LINE 走 shared handler 不一致，建議後續統一走 `_shared/core-handler.ts` 以免兩套邏輯漂移。

---

## 附錄：僅影響 `/parking` 的次要風險（非本次「全指令無回應」主因）

保留供日後排查 `/parking` 專屬問題時參考：

- `telegram-webhook/index.ts:147` `handleParkingCommand` 第一步 `saveUserState` 寫 `user_states`；若 DB 寫入失敗會被頂層 catch 吞掉。但 `/start` 不走此路徑，故不是全指令無回應的原因。
- `_shared/tdx-client.ts:90-91` `DEFAULT_TRIAL_KEY = Deno.env.get('TDX_TRIAL_API_KEY') || ''`、`TRIAL_DAILY_LIMIT = 5`；trial key 缺失只在使用者走到實際查詢那步才炸。
- `checkAndUpdateTrialUsage`（配額）同理，只影響 `/parking` 後段。

---

## 關鍵檔案與行號索引

- `supabase/functions/telegram-webhook/index.ts:1` — 舊版 `serve` import（根因 2a）
- `supabase/functions/telegram-webhook/index.ts:31` — `serve(async (req) => {`
- `supabase/functions/telegram-webhook/index.ts:46-51` — 讀 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`TELEGRAM_BOT_TOKEN` + `processUpdate`（根因 2b）
- `supabase/functions/telegram-webhook/index.ts:59-65` — 吞例外回 200（讓失敗靜默）
- `supabase/functions/telegram-webhook/index.ts:104,113` — `handleCommand` 與 `Handling command:` log
- `supabase/functions/telegram-webhook/index.ts:116-123` — `/start`：純 `sendMessage(getWelcomeMessage())`，無 DB（證明非業務邏輯）
- `supabase/functions/telegram-webhook/index.ts:865,879-882` — inline `sendMessage`，非 2xx 只 log（根因 3）
- `supabase/functions/daily-report/index.ts:5` — `Deno.serve`（正常運行、不同進入點）
- `supabase/functions/line-webhook/index.ts:5-18,23` — LINE 用 shared `core-handler` + `Deno.serve`
- `scripts/setup-webhook.ts:33,46,124` — webhook URL 組法、`allowed_updates`、`delete` 子命令（根因 1）
- `.github/workflows/deploy-supabase.yml` — 部署清單、`--no-verify-jwt`、`db push` 先於 functions deploy（根因 2c）
- `.github/workflows/daily-report.yml` — 排程直接 curl `daily-report`（證明與 webhook 不同路徑）
- git：`f83cebb fix(db): make migration 012 idempotent to unblock deploy workflow`（近期部署曾卡住）；`git log -1 -- telegram-webhook/index.ts` → `feb7ea9`（近期無指令邏輯改動）
