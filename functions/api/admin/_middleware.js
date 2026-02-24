/**
 * Auth middleware for /api/admin/* routes
 *
 * Verifies the al_auth cookie.
 * Returns 401 JSON for unauthenticated requests.
 */

export async function onRequest(context) {
  const { request, env } = context;

  // In local dev, skip auth
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return context.next();
  }

  const cookie = parseCookie(request.headers.get('Cookie') || '', 'al_auth');
  if (cookie && await verifyToken(cookie, env.AUTH_SECRET)) {
    return context.next();
  }

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, hex] = parts;
  const age = Date.now() - parseInt(timestamp);
  if (isNaN(age) || age > 14400000 || age < 0) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(timestamp)
  );
  const expectedHex = [...new Uint8Array(expected)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === expectedHex;
}

function parseCookie(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}
