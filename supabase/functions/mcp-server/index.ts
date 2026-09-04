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
import { McpServer, StreamableHttpTransport, InMemorySessionAdapter } from 'mcp-lite';
import { registerTools } from './mcp-tools.ts';
import {
  protectedResourceMetadata,
  authorizationServerMetadata,
  handleAuthorize,
  handleAuthorizeCreate,
  handleAuthorizePoll,
  handleAuthorizeComplete,
  handleToken,
  handleRegister,
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

// Enable stateful sessions so the initialize response carries an
// Mcp-Session-Id header. Spec-compliant clients (incl. Gemini) expect this
// header after initialize and use it on subsequent requests; without it they
// abort the connection. InMemorySessionAdapter is per-instance — acceptable
// because Supabase tends to reuse a warm instance across a client's requests.
// If cross-instance session loss appears, swap for a KV/DB-backed adapter.
const transport = new StreamableHttpTransport({
  sessionAdapter: new InMemorySessionAdapter({ maxEventBufferSize: 1024 }),
});
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

// OAuth authorize (legacy 302 -> Telegram deep link).
// In the current flow, the Cloudflare Worker intercepts GET /authorize and
// serves a same-window polling page; it calls /authorize/create + /authorize/poll
// below. This direct 302 handler is kept as a fallback for clients hitting
// the function directly (e.g. local testing without the Worker).
mcpApp.get('/authorize', (c) => handleAuthorize(new URL(c.req.url)));

// OAuth authorize: create nonce, return Telegram deep link as JSON (Worker calls this).
mcpApp.get('/authorize/create', (c) => handleAuthorizeCreate(new URL(c.req.url)));

// OAuth authorize: poll binding status; returns final redirect (code+state) when ready.
mcpApp.get('/authorize/poll', (c) => handleAuthorizePoll(new URL(c.req.url)));

// OAuth authorize return (legacy: user taps this from Telegram after binding)
mcpApp.get('/authorize/return', (c) => handleAuthorizeComplete(new URL(c.req.url)));

// OAuth token endpoint
mcpApp.post('/token', (c) => handleToken(c.req.raw));

// Dynamic Client Registration (RFC 7591) — Gemini tries this before manual creds
mcpApp.post('/register', (c) => {
  console.log('[oauth] /register HIT (DCR)');
  return handleRegister(c.req.raw);
});

// MCP endpoint (StreamableHTTP).
// Per the MCP authorization spec, an unauthenticated request (including the
// initial `initialize`) must return 401 + WWW-Authenticate pointing at the
// protected-resource metadata, so the client (Gemini) discovers the OAuth
// flow. We enforce this on every JSON-RPC POST that lacks a valid token.
mcpApp.all('/mcp', async (c) => {
  const baseUrl = getServerBaseUrl(c.req.url);

  if (c.req.method === 'POST') {
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const auth = token ? await validateToken(token) : null;
    if (!auth) {
      console.log(`[mcp] POST /mcp 401 (token present=${token ? 'yes' : 'no'})`);
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

  // Log what the client sends so we can see method, Accept, and session id.
  const clientAccept = c.req.header('Accept') || '';
  const clientSession = c.req.header('Mcp-Session-Id') || '';
  let rpcMethod = '';
  if (c.req.method === 'POST') {
    try {
      const peek = await c.req.raw.clone().json();
      rpcMethod = peek?.method || '';
    } catch {
      // ignore
    }
  }
  console.log(
    `[mcp] IN ${c.req.method} rpc=${rpcMethod || '-'} accept="${clientAccept}" session="${clientSession || '-'}"`
  );

  const response = await mcpHttpHandler(c.req.raw);
  console.log(
    `[mcp] OUT ${c.req.method} rpc=${rpcMethod || '-'} -> status ${response.status} ctype=${response.headers.get('content-type')} session-out=${response.headers.get('mcp-session-id') || '-'}`
  );

  // Compatibility shim for Gemini's MCP client.
  //
  // mcp-lite always answers the `initialize` request with a plain
  // application/json body (this is spec-legal). Gemini, however, advertises
  // `Accept: application/json, text/event-stream` and then abandons the
  // connection (immediately sending DELETE) when initialize comes back as
  // JSON — it expects the response as a Server-Sent Events stream, the same
  // way every other method is delivered.
  //
  // So: when the client accepts SSE and mcp-lite handed us a JSON initialize
  // response, re-wrap that JSON-RPC payload as a single SSE event. All headers
  // (notably Mcp-Session-Id) are preserved; only the framing changes.
  const respCtype = response.headers.get('content-type') || '';
  if (
    rpcMethod === 'initialize' &&
    response.status === 200 &&
    respCtype.includes('application/json') &&
    clientAccept.includes('text/event-stream')
  ) {
    const jsonBody = await response.text();
    const sseBody = `event: message\ndata: ${jsonBody}\n\n`;
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/event-stream');
    headers.delete('Content-Length');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Connection', 'keep-alive');
    console.log('[mcp] initialize re-wrapped as SSE for Gemini compatibility');
    return new Response(sseBody, { status: 200, headers });
  }

  return response;
});

// ---------------------------------------------------------------------------
// Outer app: Supabase function-level routing
// ---------------------------------------------------------------------------

const app = new Hono();
app.route('/mcp-server', mcpApp);

Deno.serve(app.fetch);
