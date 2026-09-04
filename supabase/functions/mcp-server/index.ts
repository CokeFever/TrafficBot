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

// OAuth authorize return (user taps this from Telegram after binding)
mcpApp.get('/authorize/return', (c) => handleAuthorizeComplete(new URL(c.req.url)));

// OAuth token endpoint
mcpApp.post('/token', (c) => handleToken(c.req.raw));

// MCP endpoint (StreamableHTTP).
// Emits 401 + WWW-Authenticate (RFC 9728) when a tools/call is attempted
// without a valid token, so Gemini knows to start the OAuth flow.
// initialize / tools/list are allowed unauthenticated for discovery.
mcpApp.all('/mcp', async (c) => {
  const baseUrl = getServerBaseUrl(c.req.url);

  // Peek at the JSON-RPC method to decide whether auth is required.
  if (c.req.method === 'POST') {
    let method = '';
    let rawBody = '';
    try {
      rawBody = await c.req.raw.clone().text();
      const parsed = JSON.parse(rawBody);
      method = Array.isArray(parsed) ? parsed[0]?.method : parsed?.method;
    } catch {
      // ignore parse errors; let the transport handle malformed requests
    }

    const requiresAuth = method === 'tools/call';
    if (requiresAuth) {
      const authHeader = c.req.header('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const auth = token ? await validateToken(token) : null;
      if (!auth) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32001, message: 'Unauthorized: valid access token required' },
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
            },
          }
        );
      }
    }
  }

  const response = await mcpHttpHandler(c.req.raw);
  return response;
});

// ---------------------------------------------------------------------------
// Outer app: Supabase function-level routing
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/mcp-server', mcpApp);

Deno.serve(app.fetch);
