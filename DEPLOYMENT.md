# 部署指南

本專案使用 Supabase Edge Functions 進行部署。

## 快速開始

詳細的部署步驟請參考：[Supabase 部署指南](docs/deploy-supabase.md)

## 部署平台

- **生產環境**: Supabase Edge Functions
- **資料庫**: Supabase PostgreSQL
- **通訊方式**: Webhook

## 為什麼選擇 Supabase Edge Functions？

- ✅ 完全免費（在免費額度內）
- ✅ 無需維護伺服器
- ✅ 自動擴展
- ✅ 即時回應（Webhook 模式）
- ✅ 全球 CDN
- ✅ 內建資料庫

## 快速部署指令

```bash
# 1. 安裝 Supabase CLI
npm install -g supabase

# 2. 登入
supabase login

# 3. 連結專案
supabase link --project-ref your-project-ref

# 4. 部署資料庫
supabase db push

# 5. 部署 Edge Function
supabase functions deploy telegram-webhook

# 6. 設定 Webhook
npm run setup-webhook

# 7. 查看狀態
npm run webhook:info
supabase functions logs telegram-webhook
```

## 更多資訊

- [Supabase 完整部署指南](docs/deploy-supabase.md)
- [快速開始指南](docs/quick-start.md)
- [使用者指南](docs/user-guide.md)
- [TDX API 指南](docs/tdx-api-guide.md)

## 監控

查看應用狀態：
```bash
supabase functions list
supabase functions logs telegram-webhook --follow
npm run webhook:info
```

## 更新部署

```bash
supabase functions deploy telegram-webhook
```

## 支援

如有問題，請查看：
- [Supabase 文檔](https://supabase.com/docs/guides/functions)
- [專案 GitHub Issues](https://github.com/CokeFever/TrafficBot/issues)
