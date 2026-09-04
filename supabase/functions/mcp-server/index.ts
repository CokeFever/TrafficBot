// TrafficBot MCP Server — Gemini Spark integration
// Provides parking + traffic query tools over MCP (StreamableHTTP transport).
//
// Two Hono apps pattern (required by Supabase Edge Functions):
//   - outer app: handles function-level routing (/mcp-server/*)
//   - mcpApp: handles the actual MCP + OAuth endpoints
//
// See mcp/SPEC.md for full design.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { Hono } from 'hono';
import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { registerTools } from './mcp-tools.ts';
import {
  protectedResourceMetadata,
  authorizationServerMetadata,
  handleAuthorize,
  handleAuthorizeComplete,
  handleToken,
  validateToken,
  getServerBaseUrl,
} from './oauth.ts';

// ---------------------------------------------------------------------------
// MCP server setup
// ---------------------------------------------------------------------------

const mcp = new McpServer({
  name: 'trafficbot',
  version: '1.0.0',
  logger: {
    error: console.error,
    warn: console.warn,
    info: () => {},
    debug: () => {},
  },
});

// Auth middleware: resolve Bearer token → per-user TDX key into ctx.state
// deno-lint-ignore no-explicit-any
mcp.use(async (ctx: any, next: any) => {
  const authHeader = ctx.request?.headers?.get?.('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    const auth = await validateToken(token);
    if (auth) {
      ctx.state.tdxApiKey = auth.tdxApiKey;
      ctx.state.telegramUserId = auth.telegramUserId;
    }
  }
  await next();
});

// Register find_parking + query_traffic tools
registerTools(mcp);

const transport = new StreamableHttpTransport();
const mcpHttpHandler = transport.bind(mcp);

// ---------------------------------------------------------------------------
// Inner app: MCP + OAuth endpoints
// ---------------------------------------------------------------------------

const mcpApp = new Hono();

// Health check
mcpApp.get('/', (c) => c.json({ status: 'ok', service: 'trafficbot-mcp', version: '1.0.0' }));

// OAuth discovery metadata
mcpApp.get('/.well-known/oauth-protected-resource', (c) => {
  const baseUrl = getServerBaseUrl(c.req.url);
  return c.json(protectedResourceMetadata(baseUrl));
});

mcpApp.get('/.well-known/oauth-authorization-server', (c) => {
  const baseUrl = getServerBaseUrl(c.req.url);
  return c.json(authorizationServerMetadata(baseUrl));
});

// OAuth authorize (302 -> Telegram deep link)
mcpApp.get('/authorize', (c) => handleAuthorize(new URL(c.req.url)));

// OAuth authorize completion (polled after Telegram binding)
mcpApp.get('/authorize/complete', (c) => handleAuthorizeComplete(new URL(c.req.url)));

// OAuth token endpoint
mcpApp.post('/token', (c) => handleToken(c.req.raw));

// MCP endpoint (StreamableHTTP) — returns 401 w/ WWW-Authenticate when unauthenticated
mcpApp.all('/mcp', async (c) => {
  const response = await mcpHttpHandler(c.req.raw);
  return response;
});

// ---------------------------------------------------------------------------
// Outer app: Supabase function-level routing
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/mcp-server', mcpApp);

Deno.serve(app.fetch);
