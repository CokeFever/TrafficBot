# AGENTS.md — AI 開發工具入口

> 這是給 AI 開發工具 / 新接手維護者的第一個檔案。**開始任何工作前先讀這份，再讀
> [`docs/HANDOFF.md`](docs/HANDOFF.md)。**

## 這是什麼專案

TrafficBot（泊車小弟）：台灣停車 / 路況查詢聊天機器人，支援 Telegram 與 LINE，
另有給 Gemini Spark 用的 MCP server。後端全部跑在 **Supabase Edge Functions（Deno）**。

## 接手請依序讀這些文件

1. **[`docs/HANDOFF.md`](docs/HANDOFF.md)** — 完整接手指南：所有外部服務、環境變數 /
   secrets、資料庫結構、部署流程、**交接驗證清單**、已知技術債。**這是主文件。**
2. [`README.md`](README.md) — 功能與支援範圍。
3. [`docs/deploy-supabase.md`](docs/deploy-supabase.md) — Supabase 部署細節。
4. [`mcp/HANDOFF.md`](mcp/HANDOFF.md) — MCP server（Gemini 整合）細節。
5. [`docs/incident-2026-10-16-webhook-outage.md`](docs/incident-2026-10-16-webhook-outage.md)
   — 近期重大事件與其防護機制的來龍去脈。

## 立刻要知道的關鍵規則（違反會踩雷）

- **Production 程式在 `supabase/functions/**`**（Deno Edge Functions）。
  **`src/**` 是未部署的舊 Node.js 版本，改它不會生效** —— 別搞錯。
- **Secrets 不在 `.env`**。線上函式的 secrets 在 **Supabase Dashboard → Edge Functions
  → Secrets**；CI 的 secrets 在 GitHub Actions。`.env` 只給 `scripts/` 的本地工具用。
- **部署靠 push 到 `main`** 觸發 GitHub Actions（`deploy-supabase.yml`）。CI 會先
  `supabase db push` 再部署函式——**migration 失敗會中止整個部署**（曾因此全站停擺）。
- **Telegram 與 LINE 的指令邏輯目前沒共用**，改行為兩邊都要顧。
- 關鍵識別：Supabase project ref `yqpigatgtxvytmkxumxu`、Telegram bot `@ixoTraffic_bot`。

## 接手第一步：跑驗證清單

照 `docs/HANDOFF.md` 第 7 節的「交接驗證清單」逐項執行，確認所有服務健康、
你擁有必要的存取權限（第 9 節列出需向交付者索取的項目）。

## 安全提醒

本 repo 文件**不含真實密鑰**。需要的 token / key 向交付者索取，或從各服務 Dashboard
取得。詳見 `docs/HANDOFF.md` 第 3、9 節。
