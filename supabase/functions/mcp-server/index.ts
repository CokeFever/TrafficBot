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

// ---------------------------------------------------------------------------
// MCP server setup
// ---------------------------------------------------------------------------

const mcp = new McpServer({
  name: 'trafficbot',
  version: '1.0.0',
});

// Register find_parking + query_traffic tools
registerTools(mcp);

const transport = new StreamableHttpTransport();
const mcpHttpHandler = transport.bind(mcp);

// ---------------------------------------------------------------------------
// Inner app: MCP + (later) OAuth endpoints
// Base path is the function name so Supabase routes /mcp-server/* correctly.
// ---------------------------------------------------------------------------

const mcpApp = new Hono();

// Health check
mcpApp.get('/', (c) => c.json({ status: 'ok', service: 'trafficbot-mcp', version: '1.0.0' }));

// MCP endpoint (StreamableHTTP)
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
