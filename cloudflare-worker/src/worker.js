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

    // Same-window OAuth: intercept the authorize page and serve HTML here.
    //
    // Supabase Edge downgrades text/html responses to text/plain, so the
    // interactive page cannot be served from the function. The Worker has no
    // such restriction, so it renders the page: create a nonce upstream, then
    // keep the user inside Gemini's OAuth popup, poll for the Telegram binding,
    // and navigate the popup to the client's redirect_uri (with code + state)
    // once ready — so Gemini's watcher sees the callback and calls /token.
    if (request.method === 'GET' && path === '/authorize') {
      return handleAuthorizePage(url);
    }

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

/**
 * Serve the same-window OAuth authorize page.
 *
 * Steps:
 *  1. Forward the OAuth query params to the function's /authorize/create,
 *     which validates them, stores the PKCE challenge + redirect_uri, and
 *     returns a nonce + Telegram deep link.
 *  2. Render an HTML page (in Gemini's popup) that opens Telegram in a new
 *     tab and polls /authorize/poll?nonce=... every 2s.
 *  3. When polling returns { status: "ready", redirect }, the page sets
 *     window.location = redirect, completing the OAuth callback in the same
 *     window Gemini is watching.
 *
 * @param {URL} url
 */
async function handleAuthorizePage(url) {
  const createUrl = UPSTREAM + '/authorize/create' + url.search;
  let data;
  try {
    const resp = await fetch(createUrl, { method: 'GET' });
    data = await resp.json();
    if (!resp.ok || !data.nonce) {
      return errorPage(data && data.error_description ? data.error_description : 'Authorization request was invalid.');
    }
  } catch (_e) {
    return errorPage('Could not reach the authorization server. Please try again.');
  }

  const html = authorizePageHtml(data.nonce, data.telegram_url);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * @param {string} nonce
 * @param {string} telegramUrl
 */
function authorizePageHtml(nonce, telegramUrl) {
  // nonce + telegramUrl are server-generated (hex nonce, fixed t.me URL),
  // so JSON.stringify is sufficient to embed them safely.
  const nonceJson = JSON.stringify(nonce);
  const tgJson = JSON.stringify(telegramUrl);
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>連結 TrafficBot</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
    background: #0f172a; color: #e2e8f0;
  }
  .card {
    max-width: 420px; width: calc(100% - 48px); padding: 32px; border-radius: 16px;
    background: #1e293b; box-shadow: 0 10px 40px rgba(0,0,0,0.4); text-align: center;
  }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 8px 0; }
  .btn {
    display: inline-block; margin: 20px 0 8px; padding: 12px 24px; border-radius: 10px;
    background: #229ED9; color: #fff; text-decoration: none; font-weight: 600; font-size: 15px;
  }
  .btn:active { opacity: 0.85; }
  .status { margin-top: 20px; font-size: 13px; color: #64748b; min-height: 20px; }
  .spinner {
    display: inline-block; width: 14px; height: 14px; margin-right: 8px; vertical-align: -2px;
    border: 2px solid #475569; border-top-color: #229ED9; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error { color: #f87171; }
  .ok { color: #4ade80; }
</style>
</head>
<body>
  <div class="card">
    <h1>連結 TrafficBot 到 Gemini</h1>
    <p>點擊下方按鈕，在 Telegram 完成身分綁定。<br/>綁定後請回到此頁面，會自動完成連結。</p>
    <a class="btn" id="tgBtn" href=${tgJson} target="_blank" rel="noopener">在 Telegram 綁定</a>
    <div class="status" id="status">
      <span class="spinner"></span>等待在 Telegram 完成綁定…
    </div>
  </div>
<script>
  (function () {
    var nonce = ${nonceJson};
    var statusEl = document.getElementById('status');
    var pollUrl = '/authorize/poll?nonce=' + encodeURIComponent(nonce);
    var stopped = false;

    function setStatus(html, cls) {
      statusEl.innerHTML = html;
      statusEl.className = 'status' + (cls ? ' ' + cls : '');
    }

    function poll() {
      if (stopped) return;
      fetch(pollUrl, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (stopped) return;
          if (d.status === 'ready' && d.redirect) {
            stopped = true;
            setStatus('✅ 綁定成功，正在返回 Gemini…', 'ok');
            window.location.href = d.redirect;
            return;
          }
          if (d.status === 'expired') {
            stopped = true;
            setStatus('⏰ 連結已過期，請回到 Gemini 重新發起。', 'error');
            return;
          }
          if (d.status === 'error') {
            stopped = true;
            setStatus('❌ ' + (d.error_description || '發生錯誤，請重新發起。'), 'error');
            return;
          }
          setTimeout(poll, 2000);
        })
        .catch(function () {
          if (stopped) return;
          setTimeout(poll, 3000);
        });
    }
    setTimeout(poll, 1500);
  })();
</script>
</body>
</html>`;
}

/**
 * @param {string} message
 */
function errorPage(message) {
  const msg = JSON.stringify(message);
  const html = `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>連結失敗</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#e2e8f0}.card{max-width:420px;width:calc(100% - 48px);padding:32px;border-radius:16px;background:#1e293b;text-align:center}.err{color:#f87171;font-size:14px}</style>
</head><body><div class="card"><h1>無法連結</h1><p class="err" id="m"></p></div>
<script>document.getElementById('m').textContent=${msg};</script>
</body></html>`;
  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
