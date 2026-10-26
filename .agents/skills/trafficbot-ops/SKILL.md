---
name: trafficbot-ops
description: Run operational health checks, verify Telegram/LINE webhooks, inspect Supabase Edge Functions, and manage deployments for TrafficBot.
---

# TrafficBot Operations & Verification Skill

This skill provides operational procedures, healthcheck runbooks, and deployment instructions for TrafficBot (泊車小弟).

## System Architecture Reference

- **Backend**: Supabase Edge Functions (Deno runtime) on project ref `yqpigatgtxvytmkxumxu`.
- **Functions**:
  - `telegram-webhook`: Telegram bot commands & updates.
  - `line-webhook`: LINE messaging updates (via `_shared/core-handler.ts`).
  - `daily-report`: Daily statistics + Telegram webhook healthcheck/self-repair.
  - `mcp-server`: MCP server for Gemini Spark (OAuth 2.1).
- **Cloudflare Worker**: Reverse proxy and OAuth discovery for `mcp.ixo.app`.
- **Database**: Supabase Postgres with schema migrations in `supabase/migrations/`.

## Health Check & Verification Runbook

### 1. Public Endpoint Verification

Run without secrets:
```bash
# Cloudflare Worker / MCP Discovery (Expect HTTP 200 application/json)
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://mcp.ixo.app/.well-known/oauth-protected-resource/mcp"

# MCP Server Unauthorized Check (Expect HTTP 401)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/mcp-server/mcp" \
  -H "Content-Type: application/json" -d '{}'
```

### 2. GitHub Actions CI Verification

```bash
# Verify CI secrets
gh secret list

# Check recent workflow runs (Deploy to Supabase, Daily Report)
gh run list --limit 5
```

### 3. Supabase Edge Functions Status

```bash
# List deployed Edge Functions (all should show status: ACTIVE)
supabase functions list --project-ref yqpigatgtxvytmkxumxu

# List Edge Function secrets (confirm TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY, TDX_TRIAL_API_KEY)
supabase secrets list --project-ref yqpigatgtxvytmkxumxu
```

### 4. Telegram Webhook Verification & Self-Healing

Telegram webhook verification can be checked directly via the `daily-report` endpoint:
```bash
# Verify / trigger webhook auto-repair
curl -s "https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/daily-report?mode=healthcheck" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json"
# Expected response: {"success":true,"mode":"healthcheck","webhookStatus":"🔗 Webhook：正常"}
```

Or when `TELEGRAM_BOT_TOKEN` is available:
```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
# Expected url: https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/telegram-webhook
# Expected pending_update_count: 0
```

## Deployment Runbook

1. **Production Code Location**:
   Only code under `supabase/functions/**` is deployed to production. `src/**` is legacy Node.js and is NOT deployed.
2. **Trigger Deployment**:
   Pushing to `main` triggers GitHub Actions (`.github/workflows/deploy-supabase.yml`).
   CI runs:
   1. `supabase link --project-ref yqpigatgtxvytmkxumxu`
   2. `supabase db push` (Note: db push failure will abort deployment)
   3. `supabase functions deploy <name> --no-verify-jwt`
   4. Post-deploy webhook healthcheck call to `daily-report?mode=healthcheck`.
3. **Manual Function Deployment** (if needed):
   ```bash
   supabase functions deploy <function-name> --project-ref yqpigatgtxvytmkxumxu --no-verify-jwt
   ```
