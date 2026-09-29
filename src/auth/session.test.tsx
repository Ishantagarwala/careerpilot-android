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

  it('falls back to NextAuth credentials cookie sign-in when mobile token returns 403 bot_check', async () => {
    let credentialsCookieHeader: string | undefined;

    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/auth/mobile/token')) {
        return new Response(
          JSON.stringify({
            message: 'Play Integrity must be configured on both.',
            reason: 'bot_check',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
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
        return new Response(
          JSON.stringify({
            message: 'Play Integrity must be configured on both.',
            reason: 'bot_check',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
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
