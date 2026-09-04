# TrafficBot MCP Server

讓 Gemini Spark 能查詢台灣停車位與路況的 MCP (Model Context Protocol) server。

詳細規格見 [SPEC.md](./SPEC.md)。

## 快速說明

這是 TrafficBot 的 MCP 介面，讓 Gemini Spark 使用者能透過自然語言查詢：
- 附近停車位（路外停車場 + 路邊停車格）
- 即時路況

實際的 Edge Function 程式碼在 `supabase/functions/mcp-server/`。

## 前提條件

使用者需要：
1. **Gemini Spark** 存取權
2. 綁定自己的 **TDX API Key**（先在 Telegram bot 用 `/setup` 設定）

## 開發狀態

見 [SPEC.md 第 10 節](./SPEC.md#10-開發階段)。

目前在 `feature/mcp-server` branch 開發，不影響 production（Telegram/LINE bot）。

## 本地開發

```bash
# 啟動 Supabase 本地環境
supabase start

# 啟動 MCP function
supabase functions serve mcp-server

# 用 MCP Inspector 測試
npx @modelcontextprotocol/inspector
# endpoint: http://localhost:54321/functions/v1/mcp-server/mcp
```

## 部署

```bash
supabase functions deploy mcp-server
```

部署後 URL：`https://<project-ref>.supabase.co/functions/v1/mcp-server/mcp`

在 Gemini web app → Connected Apps → Custom apps 填入此 URL。
