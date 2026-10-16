# Incident Report — Telegram Bot 全指令無回應

- **日期**：2026-10-16
- **影響服務**：Telegram bot 泊車小弟 [@ixoTraffic_Bot](https://t.me/ixoTraffic_Bot)
- **嚴重度**：High（bot 完全無法使用）
- **偵測方式**：使用者回報 `/parking`（以及後續測試 `/start`、`/help`）皆無回應
- **實際中斷期間**：約自 2026-09-04 起，直到 2026-10-16 修復（約 6 週；期間無人使用故未被察覺）

---

## 症狀

- 在 Telegram 對 bot 送出**任何**指令（`/start`、`/help`、`/parking`…）都完全沒有回應。
- 與此同時，每日排程報表（GitHub Actions `daily-report.yml`）**每天都成功**，報表內容顯示「🏥 系統狀態：正常運行中」。

## 根本原因

兩個**獨立**問題疊加，皆發生在 2026-09-04 一段密集開發 MCP server 的期間：

1. **（主因）Telegram webhook 註冊被清空。**
   `getWebhookInfo` 顯示 `url: ""`、`pending_update_count: 6`。Telegram 不知道要把訊息送到哪，因此所有 update 都卡在 Telegram 端佇列，從未送達 Supabase 函式。推測是在 MCP 重部署 / webhook 操作期間某次 `deleteWebhook`（或等效操作）清掉了註冊，之後再也沒有重新註冊。

2. **（隱患）`telegram-webhook` 函式使用舊版遠端 import。**
   它是唯一仍 `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'` 的函式；其他函式（`daily-report`、`line-webhook`、`mcp-server`）都已改用原生 `Deno.serve`。此遠端 import 在冷啟動時有解析失敗風險，可能使函式開不起來。

## 為什麼「排程正常」是誤導

每日報表走的是 `daily-report` 函式（GitHub Actions 直接 `curl` 觸發），而 Telegram 指令走的是 `telegram-webhook` 函式——**兩者是完全不同的進入點**。報表成功只證明「Supabase 專案未暫停、`daily-report` 函式與資料庫讀取正常」，**完全無法證明** Telegram webhook 收得到請求。再加上報表的健康狀態是寫死的字串「正常運行中」，形成一個假的健康指標，使中斷長達數週未被發現。

## 診斷依據

- `supabase/.temp/project-ref` → 專案 ref `yqpigatgtxvytmkxumxu`。
- `git log` 顯示近期改動全集中於 MCP server；最後動到 `telegram-webhook/index.ts` 的 commit 為 `feb7ea9`（2026-09-04），之後無任何指令邏輯改動。
- CI 紀錄：deploy workflow 曾連續失敗三次，最後靠 `f83cebb fix(db): make migration 012 idempotent to unblock deploy workflow` 才恢復——印證該期間部署狀態不穩。
- `/start` 的處理路徑（`telegram-webhook/index.ts`）純送字串、不碰 DB/配額/TDX，卻也無回應 → 決定性地指向 webhook 層而非業務邏輯。
- 決定性證據：`getWebhookInfo` 回傳 `url: ""`。

## 處置（修復）

1. **立即恢復**：以正確 URL 重新註冊 webhook
   `https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook`，
   `allowed_updates: ["message","callback_query"]`。重設後 `pending_update_count` 歸零，bot 恢復回應。
2. **消除冷啟動隱患**（commit `79fe1d0`）：`telegram-webhook` 改用原生 `Deno.serve`，與其他函式一致；並強化頂層 catch 對非 `Error` 丟出物的處理。
3. **自我修復守衛**（commit `4afaa33`）：
   - `daily-report` 新增 `checkAndRepairWebhook()`——透過 `getWebhookInfo` 檢查 webhook，若遺失或 URL 錯誤則**自動重新註冊**。
   - 每日報表的「系統狀態」改為顯示**真實** webhook 狀態，不再寫死「正常運行中」。
   - 新增 `?mode=healthcheck` 輕量端點，只檢查 / 修復 webhook。
   - `deploy-supabase.yml` 於部署成功後呼叫該端點，讓每次重部署後 webhook 立即被驗證 / 修復（沿用既有 `SUPABASE_ANON_KEY`，無需新增 secret）。

## 驗證

- `getWebhookInfo`：`url` 正確、`pending_update_count: 0`、`allowed_updates: ["message","callback_query"]`。
- healthcheck 端點回傳 `{"success":true,"mode":"healthcheck","webhookStatus":"🔗 Webhook：正常"}`。
- CI 部署成功且新步驟「Ensure Telegram webhook is registered」正常執行。
- 使用者確認 bot 已恢復回應。

## 後續 / 未處理事項

- **Bot token 已在處理過程中於對話明文出現。** 經評估此服務非關鍵，決定**暫不 revoke**。若日後要換：BotFather → `/mybots` → @ixoTraffic_Bot → Revoke，取得新 token 後更新 Supabase 的 `TELEGRAM_BOT_TOKEN` secret，並以新 token 重設一次 webhook。
- （可選）日後可考慮將 `telegram-webhook` 的 inline 邏輯統一改走 `_shared/core-handler.ts`，與 LINE webhook 一致，避免兩套邏輯漂移。

## 經驗教訓

- **健康檢查必須檢查真正的使用者路徑**，而非間接指標。寫死的「正常運行中」比沒有狀態更危險，因為它製造虛假的安心感。
- **部署流程應包含關鍵外部註冊的驗證**（此處為 Telegram webhook），否則一次無關的部署就可能悄悄破壞它。
