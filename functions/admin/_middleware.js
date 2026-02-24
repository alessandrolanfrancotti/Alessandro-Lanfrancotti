/**
 * Auth middleware for /admin/* routes
 *
 * Protects admin panel with username + password.
 * Cookie al_auth: Max-Age 4h, HttpOnly, Secure.
 *
 * Environment variables (set as secrets in Cloudflare Pages):
 * - ADMIN_USER
 * - ADMIN_PASSWORD
 * - AUTH_SECRET: HMAC signing key
 */

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow static assets through
  if (
    path.endsWith('.css') ||
    path.endsWith('.js') ||
    path.endsWith('.ico') ||
    path.endsWith('.png') ||
    path.endsWith('.svg')
  ) {
    return next();
  }

  // In local dev, skip auth
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return next();
  }

  // POST login
  if (request.method === 'POST' && path === '/admin/__auth') {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (username === env.ADMIN_USER && password === env.ADMIN_PASSWORD) {
      const token = await generateToken(env.AUTH_SECRET);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/admin/__session',
          'Set-Cookie': `al_auth=${token}; Max-Age=14400; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    return loginPage(true);
  }

  // GET logout — clear cookie and redirect to login
  if (request.method === 'GET' && path === '/admin/__logout') {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin/',
        'Set-Cookie': 'al_auth=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
      },
    });
  }

  // Verify cookie
  const cookie = parseCookie(request.headers.get('Cookie') || '', 'al_auth');
  if (!cookie || !await verifyToken(cookie, env.AUTH_SECRET)) {
    return loginPage(false);
  }

  // GET session bridge — set sessionStorage via JS then redirect to admin
  if (request.method === 'GET' && path === '/admin/__session') {
    return new Response(
      `<!DOCTYPE html><html><head><script>sessionStorage.setItem('al_session','1');location.replace('/admin/');</script></head><body></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
    );
  }

  return next();
}

async function generateToken(secret) {
  const timestamp = Date.now().toString();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(timestamp)
  );
  const hex = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestamp}.${hex}`;
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

function loginPage(error) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Login - Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #000;
      color: #fff;
      padding: env(safe-area-inset-top, 0) 1rem env(safe-area-inset-bottom, 0);
    }
    form {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      max-width: 400px;
    }
    input {
      width: 100%;
      font-size: 16px;
      padding: 0.75rem 1rem;
      border: 1px solid #2a2b2d;
      border-radius: 8px;
      background: #1a1a1a;
      color: #fff;
      text-align: center;
      outline: none;
    }
    input:focus { border-color: #6a6b6d; }
    input::placeholder { color: #8a8f98; }
    button {
      width: 100%;
      font-size: 16px;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #000;
      cursor: pointer;
      margin-top: 0.25rem;
    }
    button:hover, button:active { opacity: 0.6; }
    .error { color: #b00020; font-size: 14px; }
  </style>
</head>
<body>
  <form method="POST" action="/admin/__auth">
    <input type="text" name="username" placeholder="Username" autocomplete="username" autofocus>
    <input type="password" name="password" placeholder="Password" autocomplete="current-password">
    ${error ? '<p class="error">Invalid credentials</p>' : ''}
    <button type="submit">Log in</button>
  </form>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
