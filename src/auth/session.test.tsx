import * as SecureStore from 'expo-secure-store';

import { restoreSession, signIn, signOut } from './session';
import { loadSessionCookie, loadTokens } from './storage';

describe('auth session flows', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('signs in via mobile token when the endpoint succeeds', async () => {
    global.fetch = jest.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/auth/mobile/token')) {
        return new Response(
          JSON.stringify({
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const res = await signIn('user@example.com', 'password123');
    expect(res).toEqual({ ok: true, method: 'token' });

    const tokens = await loadTokens();
    expect(tokens?.accessToken).toBe('test-access-token');
    expect(tokens?.refreshToken).toBe('test-refresh-token');
  });

  /**
   * The server's bot gate is answered with a captcha, NOT by replaying the
   * password through the NextAuth cookie flow.
   *
   * That fallback used to run here. It could never succeed: the cookie flow runs
   * the same bot gate and this client sends it no captcha either, so the user got
   * a second refusal for their trouble. A sideloaded build cannot use Play
   * Integrity at all, so the captcha is the only way through — which means the
   * client has to say so rather than silently trying something else.
   */
  it('asks for a captcha when the server refuses with bot_check', async () => {
    let cookieFlowAttempted = false;

    global.fetch = jest.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/auth/mobile/token')) {
        return new Response(
          JSON.stringify({ message: 'Could not verify this device.', reason: 'bot_check' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (u.includes('/api/auth/csrf') || u.includes('/api/auth/callback')) {
        cookieFlowAttempted = true;
      }
      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const res = await signIn('user@example.com', 'password123');

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.needsCaptcha).toBe(true);
    expect(res.ok === false && res.error).toBe('Could not verify this device.');
    expect(cookieFlowAttempted).toBe(false);
  });

  it('sends the captcha token on the retry and signs in', async () => {
    let body: Record<string, unknown> | undefined;

    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/auth/mobile/token')) {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ accessToken: 'a', refreshToken: 'r' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const res = await signIn('user@example.com', 'password123', 'captcha-token-abc');

    expect(res).toEqual({ ok: true, method: 'token' });
    expect(body?.captchaToken).toBe('captcha-token-abc');
    // The captcha replaces the integrity token; sending both would make the
    // server prefer attestation and refuse a build that cannot pass it.
    expect(body?.integrityToken).toBeUndefined();
  });

  it('falls back to the NextAuth cookie flow only when the mobile route is absent', async () => {
    let credentialsCookieHeader: string | undefined;

    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/auth/mobile/token')) {
        // 404 = the route does not exist, the one case that is a real fallback.
        return new Response('Not found', { status: 404 });
      }
      if (u.includes('/api/auth/csrf')) {
        const r = new Response(JSON.stringify({ csrfToken: 'fake-csrf-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
        r.headers.set(
          'set-cookie',
          '__Host-authjs.csrf-token=csrf-token-secret; Path=/; HttpOnly; Secure',
        );
        return r;
      }
      if (u.includes('/api/auth/callback/credentials')) {
        const headers = init?.headers as Record<string, string>;
        credentialsCookieHeader = headers?.['Cookie'] ?? headers?.['cookie'];
        const r = new Response(null, {
          status: 302,
          headers: {
            Location: 'https://careerpilot.cc',
          },
        });
        r.headers.set(
          'set-cookie',
          '__Secure-authjs.session-token=mock-session-cookie; Path=/; HttpOnly; Secure',
        );
        return r;
      }
      if (u.includes('/api/auth/session')) {
        return new Response(
          JSON.stringify({ user: { id: 'user-1', email: 'user@example.com' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const res = await signIn('user@example.com', 'password123');
    expect(res).toEqual({ ok: true, method: 'cookie' });

    // Verify CSRF cookie was forwarded to credentials callback
    expect(credentialsCookieHeader).toContain('__Host-authjs.csrf-token=csrf-token-secret');

    // Verify session cookie was stored
    const savedCookie = await loadSessionCookie();
    expect(savedCookie).toContain('__Secure-authjs.session-token=mock-session-cookie');

    // Verify session restoration
    const restored = await restoreSession();
    expect(restored?.id).toBe('user-1');
    expect(restored?.email).toBe('user@example.com');
  });

  it('returns clean error message when NextAuth rejects credentials', async () => {
    global.fetch = jest.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/auth/mobile/token')) {
        return new Response('Not found', { status: 404 });
      }
      if (u.includes('/api/auth/csrf')) {
        const r = new Response(JSON.stringify({ csrfToken: 'fake-csrf-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
        r.headers.set('set-cookie', '__Host-authjs.csrf-token=token; Path=/');
        return r;
      }
      if (u.includes('/api/auth/callback/credentials')) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://careerpilot.cc/login?error=CredentialsSignin&code=credentials',
          },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    const res = await signIn('wrong@example.com', 'badpassword');
    expect(res).toEqual({ ok: false, error: 'Email or password is incorrect.' });
  });

  it('signOut clears credentials', async () => {
    await SecureStore.setItemAsync('careerpilot.sessionCookie', 'some-cookie');
    await signOut();
    const cookie = await loadSessionCookie();
    expect(cookie).toBeNull();
  });
});
