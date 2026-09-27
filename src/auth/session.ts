import { API_BASE_URL, ApiError } from '@/api/client';
import { registerRefresher } from '@/api/credentials';
import {
  clearAllCredentials,
  loadSessionCookie,
  loadTokens,
  saveSessionCookie,
  saveTokens,
} from './storage';

/**
 * Authentication.
 *
 * Two mechanisms are implemented because the recommended one does not exist on
 * the server yet (design/API_CONTRACT.md §1.1):
 *
 *   1. Device token exchange — `POST /api/auth/mobile/token`. Preferred. Bearer
 *      tokens, per-device revocation, and it leaves the web app's `SameSite=Lax`
 *      cookie posture untouched.
 *
 *   2. NextAuth credentials + manual cookie replay — works against production
 *      TODAY, with no server change. React Native's fetch does not persist
 *      cookies across requests, so the session cookie is captured once and
 *      replayed on each call.
 *
 * Mechanism 1 is attempted first and mechanism 2 is used only when the endpoint
 * is absent (404/405). When the server ships the route, this file needs no
 * change — the fallback simply stops being reached.
 *
 * Neither path skips bot verification. Problem: hCaptcha is a web widget and
 * does not run in React Native, so `captchaToken` is currently absent and the
 * server's fail-closed chain will reject it. Resolving that is Phase 0.
 */

export type SignInResult =
  | { ok: true; method: 'token' | 'cookie' }
  | { ok: false; error: string };

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

/** Which mechanism produced the current session. Informational/debug only. */
let activeMechanism: 'token' | 'cookie' | null = null;

/* -------------------------------------------------------------------------- */
/* API client wiring                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Hand the JSON client a way to refresh a Bearer token.
 *
 * Registered rather than imported so `api/credentials.ts` can call it without
 * importing this module, which imports it.
 */
registerRefresher(async () => {
  const tokens = await loadTokens();
  if (!tokens) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    // Fail closed — a rejected refresh means the credential is dead.
    if (!res.ok) {
      await clearAllCredentials();
      return null;
    }
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) {
      await clearAllCredentials();
      return null;
    }
    await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    // A network failure is not an invalidation — keep the credential.
    return null;
  }
});

/* -------------------------------------------------------------------------- */
/* Sign in                                                                    */
/* -------------------------------------------------------------------------- */

export async function signIn(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<SignInResult> {
  const tokenResult = await tryTokenExchange(email, password, captchaToken);
  if (tokenResult.ok) return tokenResult;

  // Only fall back when the endpoint genuinely is not there. A rejected
  // credential must surface as a rejection, not as a second auth attempt.
  if (tokenResult.fallbackEligible) {
    return tryCookieSignIn(email, password, captchaToken);
  }
  return tokenResult.result;
}

type TokenAttempt =
  | { ok: true; method: 'token' }
  | { ok: false; fallbackEligible: true }
  | { ok: false; fallbackEligible: false; result: { ok: false; error: string } };

async function tryTokenExchange(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<TokenAttempt> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password, captchaToken }),
    });

    if (res.status === 404 || res.status === 405) {
      return { ok: false, fallbackEligible: true };
    }

    const data = (await res.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
      error?: string;
    };

    if (!res.ok || !data.accessToken || !data.refreshToken) {
      return {
        ok: false,
        fallbackEligible: false,
        result: { ok: false, error: data.error ?? `Sign-in failed (${res.status})` },
      };
    }

    await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    activeMechanism = 'token';
    return { ok: true, method: 'token' };
  } catch (err) {
    // Network-level failure: do not silently try a different auth path.
    return {
      ok: false,
      fallbackEligible: false,
      result: { ok: false, error: networkMessage(err) },
    };
  }
}

/**
 * NextAuth credentials flow, documented in SYSTEM_WORKFLOW.md §3.
 *
 * The login chain is deliberately fail-closed: email-domain allowlist,
 * residential-IP assertion, per-email rate limit, captcha, then bcrypt. This
 * calls the same endpoint the web form does, so every gate still applies.
 */
async function tryCookieSignIn(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<SignInResult> {
  try {
    const csrfRes = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
      headers: { Accept: 'application/json' },
    });
    const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
    if (!csrfToken) return { ok: false, error: 'Could not start sign-in (no CSRF token)' };

    // NextAuth has no captcha field; the token rides along for the mobile path.
    const form = new URLSearchParams({ email, password, csrfToken, json: 'true' });
    if (captchaToken) form.set('captchaToken', captchaToken);

    const res = await fetch(`${API_BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
      redirect: 'manual',
    });

    const cookie = extractSessionCookie(res);
    if (!cookie) {
      return { ok: false, error: await rejectionReason(res) };
    }

    // Verify before persisting — a cookie that does not resolve to a session
    // must not be treated as a successful sign-in.
    const session = await fetchSession(cookie);
    if (!session) {
      return { ok: false, error: 'Signed in, but the session could not be verified.' };
    }

    await saveSessionCookie(cookie);
    activeMechanism = 'cookie';
    return { ok: true, method: 'cookie' };
  } catch (err) {
    return { ok: false, error: networkMessage(err) };
  }
}

/** Pull the session cookie out of a response. RN does not persist it for us. */
function extractSessionCookie(res: Response): string | null {
  const header =
    res.headers.get('set-cookie') ??
    // Some Android stacks expose multiple Set-Cookie headers via getSetCookie().
    (typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie().join(', ')
      : null);

  if (!header) return null;

  const parts = header
    .split(/,(?=[^;]+=)/)
    .map((p) => p.split(';')[0]?.trim())
    .filter((p): p is string => Boolean(p));

  const session = parts.filter(
    (p) => p.startsWith('__Secure-authjs.session-token=') || p.startsWith('authjs.session-token='),
  );
  return session.length ? session.join('; ') : null;
}

/** Ask the server who we are. Returns null when the cookie is not a session. */
async function fetchSession(cookie: string): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
      headers: { Accept: 'application/json', Cookie: cookie },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser } | null;
    return data?.user?.id ? data.user : null;
  } catch {
    return null;
  }
}

async function rejectionReason(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { url?: string; error?: string };
    // NextAuth redirects to /login?error=... on failure.
    const code = data.url?.split('error=')[1] ?? data.error;
    if (code) return decodeURIComponent(code.replace(/&.*$/, ''));
  } catch {
    /* fall through */
  }
  return `Sign-in failed (${res.status})`;
}

function networkMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) {
    return /network|fetch/i.test(err.message)
      ? 'Could not reach CareerPilot. Check your connection.'
      : err.message;
  }
  return 'Something went wrong.';
}

/* -------------------------------------------------------------------------- */
/* Session lifecycle                                                          */
/* -------------------------------------------------------------------------- */

export async function restoreSession(): Promise<SessionUser | null> {
  const tokens = await loadTokens();
  if (tokens) {
    activeMechanism = 'token';
    // Trust but verify: a stale token must not present as signed in.
    const session = await verifyToken(tokens.accessToken);
    if (session) return session;
    await clearAllCredentials();
    activeMechanism = null;
    return null;
  }

  const cookie = await loadSessionCookie();
  if (cookie) {
    const session = await fetchSession(cookie);
    if (session) {
      activeMechanism = 'cookie';
      return session;
    }
    await clearAllCredentials();
  }
  return null;
}

async function verifyToken(accessToken: string): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/session`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404 || res.status === 405) {
      // Endpoint not shipped yet; a stored token is the best evidence we have.
      return { id: 'unknown' };
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser } | null;
    return data?.user ?? null;
  } catch {
    // Offline: keep the session rather than signing the user out.
    return { id: 'unknown' };
  }
}

export async function signOut(): Promise<void> {
  const cookie = await loadSessionCookie();
  await clearAllCredentials();
  activeMechanism = null;
  if (cookie) {
    // Best-effort server-side sign-out; local credentials are already gone.
    fetch(`${API_BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body: 'json=true',
    }).catch(() => undefined);
  }
}

export function currentMechanism(): 'token' | 'cookie' | null {
  return activeMechanism;
}
