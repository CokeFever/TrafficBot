/**
 * Cloudflare Worker: clean public front for the TrafficBot MCP server.
 *
 * Why this exists
 * ---------------
 * Gemini (and other MCP OAuth clients) discover a server's OAuth metadata by
 * probing origin-root well-known paths per RFC 9728 / RFC 8414, e.g.
 *   https://mcp.ixo.app/.well-known/oauth-protected-resource/mcp
 *   https://mcp.ixo.app/.well-known/oauth-authorization-server
 * Supabase Edge Functions can only be served under /functions/v1/<name>/,
 * so those root paths are unreachable there. This Worker sits on mcp.ixo.app
 * and rewrites clean paths onto the Supabase function, so the whole OAuth
 * discovery + MCP flow works with a tidy public URL:
 *   MCP endpoint for Gemini:  https://mcp.ixo.app/mcp
 *
 * It is a thin, transparent proxy: it does NOT touch bodies, tokens, or auth.
 * All logic (OAuth, PKCE, Telegram binding, tools) stays in the function.
 */

// Supabase function base (no trailing slash).
const UPSTREAM = 'https://yqpigatgtxvytmkxumxu.supabase.co/functions/v1/mcp-server';

export default {
  /**
   * @param {Request} request
   */
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;

    // RFC 9728 §3.1 / RFC 8414: clients append the resource path to the
    // well-known URI. Normalize any of these to the function's flat
    // well-known endpoints:
    //   /.well-known/oauth-protected-resource            (root)
    //   /.well-known/oauth-protected-resource/mcp         (path-based)
    //   /.well-known/oauth-authorization-server           (root)
    //   /.well-known/oauth-authorization-server/mcp       (path-based)
    if (path.startsWith('/.well-known/oauth-protected-resource')) {
      path = '/.well-known/oauth-protected-resource';
    } else if (path.startsWith('/.well-known/oauth-authorization-server')) {
      path = '/.well-known/oauth-authorization-server';
    }

    // Build upstream URL: UPSTREAM + path + original query string.
    const upstreamUrl = UPSTREAM + path + url.search;

    // Clone the request onto the upstream URL, preserving method/headers/body.
    const upstreamReq = new Request(upstreamUrl, {
      method: request.method,
      headers: request.headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'manual', // pass 302s (e.g. /authorize -> Telegram) straight through
    });

    const resp = await fetch(upstreamReq);

    // Return the upstream response as-is (status, headers, body).
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  },
};
