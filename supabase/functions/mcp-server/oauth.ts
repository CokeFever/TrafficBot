// OAuth 2.1 endpoints for the TrafficBot MCP server.
//
// The MCP server is an OAuth Resource Server. It also embeds a minimal
// Authorization Server whose "user authentication" is delegated to the
// existing Telegram bot (deep-link binding).
//
// Flow (see mcp/SPEC.md section 4):
//   /.well-known/oauth-protected-resource   -> points to this auth server
//   /.well-known/oauth-authorization-server -> OAuth metadata
//   /authorize  -> create nonce, 302 redirect to Telegram deep link
//   (user binds in Telegram; telegram-webhook marks nonce authorized)
//   /authorize continues via polling page -> 302 back to Gemini with code
//   /token      -> exchange code (+ PKCE verifier) for access token
//   validateToken() -> used by MCP middleware to resolve telegram_user_id

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// --- Config ---------------------------------------------------------------

const TELEGRAM_BOT_USERNAME = Deno.env.get('TELEGRAM_BOT_USERNAME') || 'ixoTraffic_Bot';
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getSupabase(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

// Base URL of this MCP server (used in metadata documents).
// Supabase serves the function under /functions/v1/mcp-server
function getServerBaseUrl(reqUrl: string): string {
  const url = new URL(reqUrl);
  return `${url.protocol}//${url.host}/functions/v1/mcp-server`;
}

// --- Helpers --------------------------------------------------------------

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- OAuth metadata documents (RFC 9728 / RFC 8414) -----------------------

export function protectedResourceMetadata(baseUrl: string): Record<string, unknown> {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
  };
}

export function authorizationServerMetadata(baseUrl: string): Record<string, unknown> {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['parking', 'traffic'],
  };
}

// --- /authorize -----------------------------------------------------------
// Creates a nonce, stores PKCE challenge + redirect, redirects to Telegram.

export async function handleAuthorize(url: URL): Promise<Response> {
  const responseType = url.searchParams.get('response_type');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';
  const state = url.searchParams.get('state') || '';

  if (responseType !== 'code' || !redirectUri || !codeChallenge) {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'Missing required OAuth params' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (codeChallengeMethod !== 'S256') {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'Only S256 PKCE supported' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = getSupabase();
  const nonce = randomToken(16);
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

  const { error } = await supabase.from('mcp_oauth_nonces').insert({
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    redirect_uri: redirectUri,
    client_state: state,
    authorized: false,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('Failed to create nonce:', error);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Redirect user to Telegram to complete binding.
  const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=mcpauth_${nonce}`;
  return new Response(null, {
    status: 302,
    headers: { Location: telegramUrl },
  });
}

// --- /authorize/complete --------------------------------------------------
// After the user binds in Telegram, Gemini/the browser hits this endpoint
// (polled). When the nonce is authorized, issue an auth code and redirect
// back to the client's redirect_uri.

export async function handleAuthorizeComplete(url: URL): Promise<Response> {
  const nonce = url.searchParams.get('nonce');
  if (!nonce) {
    return new Response(JSON.stringify({ error: 'invalid_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('mcp_oauth_nonces')
    .select('*')
    .eq('nonce', nonce)
    .single();

  if (!row) {
    return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Unknown nonce' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'expired', error_description: 'Authorization expired' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!row.authorized || !row.telegram_user_id) {
    // Still waiting for Telegram binding
    return new Response(JSON.stringify({ status: 'pending' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Issue an authorization code (reuse nonce row)
  let authCode = row.auth_code;
  if (!authCode) {
    authCode = randomToken(24);
    await supabase
      .from('mcp_oauth_nonces')
      .update({ auth_code: authCode, expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString() })
      .eq('nonce', nonce);
  }

  // Redirect back to the client with code + state
  const redirect = new URL(row.redirect_uri);
  redirect.searchParams.set('code', authCode);
  if (row.client_state) redirect.searchParams.set('state', row.client_state);

  return new Response(null, {
    status: 302,
    headers: { Location: redirect.toString() },
  });
}

// --- /token ---------------------------------------------------------------
// Exchange authorization code (+ PKCE verifier) for an access token,
// or exchange a refresh token.

export async function handleToken(req: Request): Promise<Response> {
  let params: URLSearchParams;
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    params = new URLSearchParams(await req.text());
  } else if (contentType.includes('application/json')) {
    const body = await req.json();
    params = new URLSearchParams(body as Record<string, string>);
  } else {
    params = new URLSearchParams(await req.text());
  }

  const grantType = params.get('grant_type');
  const supabase = getSupabase();

  if (grantType === 'authorization_code') {
    const code = params.get('code');
    const codeVerifier = params.get('code_verifier');
    if (!code || !codeVerifier) {
      return tokenError('invalid_request', 'Missing code or code_verifier');
    }

    const { data: row } = await supabase
      .from('mcp_oauth_nonces')
      .select('*')
      .eq('auth_code', code)
      .single();

    if (!row || !row.authorized || !row.telegram_user_id) {
      return tokenError('invalid_grant', 'Invalid authorization code');
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return tokenError('invalid_grant', 'Authorization code expired');
    }

    // Verify PKCE
    const expectedChallenge = await sha256Base64Url(codeVerifier);
    if (expectedChallenge !== row.code_challenge) {
      return tokenError('invalid_grant', 'PKCE verification failed');
    }

    // Issue tokens
    const accessToken = randomToken(32);
    const refreshToken = randomToken(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    await supabase.from('mcp_oauth_tokens').insert({
      access_token: accessToken,
      refresh_token: refreshToken,
      telegram_user_id: row.telegram_user_id,
      expires_at: expiresAt,
    });

    // Consume the nonce (one-time use)
    await supabase.from('mcp_oauth_nonces').delete().eq('nonce', row.nonce);

    return tokenSuccess(accessToken, refreshToken);
  }

  if (grantType === 'refresh_token') {
    const refreshToken = params.get('refresh_token');
    if (!refreshToken) return tokenError('invalid_request', 'Missing refresh_token');

    const { data: row } = await supabase
      .from('mcp_oauth_tokens')
      .select('*')
      .eq('refresh_token', refreshToken)
      .single();

    if (!row) return tokenError('invalid_grant', 'Invalid refresh token');

    // Rotate access token
    const accessToken = randomToken(32);
    const newRefresh = randomToken(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    await supabase.from('mcp_oauth_tokens').delete().eq('access_token', row.access_token);
    await supabase.from('mcp_oauth_tokens').insert({
      access_token: accessToken,
      refresh_token: newRefresh,
      telegram_user_id: row.telegram_user_id,
      expires_at: expiresAt,
    });

    return tokenSuccess(accessToken, newRefresh);
  }

  return tokenError('unsupported_grant_type', `Unsupported grant_type: ${grantType}`);
}

function tokenSuccess(accessToken: string, refreshToken: string): Response {
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}

function tokenError(error: string, description: string): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// --- Token validation (used by MCP middleware) ----------------------------
// Returns the user's TDX API key (via telegram_user_id lookup) or null.

export interface AuthResult {
  telegramUserId: string;
  tdxApiKey: string;
}

export async function validateToken(accessToken: string): Promise<AuthResult | null> {
  if (!accessToken) return null;
  const supabase = getSupabase();

  const { data: tokenRow } = await supabase
    .from('mcp_oauth_tokens')
    .select('*')
    .eq('access_token', accessToken)
    .single();

  if (!tokenRow) return null;
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) return null;

  // Look up the user's TDX key
  const { data: config } = await supabase
    .from('user_configs')
    .select('tdx_api_key')
    .eq('user_id', tokenRow.telegram_user_id)
    .single();

  if (!config?.tdx_api_key) return null;

  return {
    telegramUserId: tokenRow.telegram_user_id,
    tdxApiKey: config.tdx_api_key,
  };
}

export { getServerBaseUrl };
