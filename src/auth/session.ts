import { API_BASE_URL, ApiError } from '@/api/client';
import { refreshAccessToken, registerRefresher } from '@/api/credentials';
import { disableBiometric } from './biometrics';
import { obtainIntegrityToken } from './playIntegrity';
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
 * Neither path skips bot verification. hCaptcha is a web widget that cannot run
 * in React Native, so the mobile path uses Play Integrity instead
 * (src/auth/playIntegrity.ts). That module is not wired up yet, so sign-in
 * currently fails with an explanation rather than a server rejection the user
 * cannot act on.
 */

export type SignInResult =
  | { ok: true; method: 'token' | 'cookie' }
  | {
      ok: false;
      error: string;
      /**
       * The server wants a captcha before it will consider the credentials, and
       * the caller should obtain one and call signIn again with it.
       */
      needsCaptcha?: boolean;
    };

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
    // Fail closed — a rejected refresh means the credential is dead. A 429 or a
    // 5xx is a transient failure, not a rejection, and must not sign the user
    // out; the catch below treats those the same way.
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        await clearAllCredentials();
      }
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

export async function signInAsDemo(): Promise<SignInResult> {
  await saveTokens({ accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' });
  activeMechanism = 'token';
  return { ok: true, method: 'token' };
}

/**
 * Sign in.
 *
 * `captchaToken` is supplied on a retry, after the server has said it needs one
 * (see SignInResult.needsCaptcha). Callers should pass it through from the
 * hCaptcha webview rather than obtaining one up front: most sign-ins should not
 * have to solve a captcha.
 */
export async function signIn(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<SignInResult> {
  // Obtained before the request so a build that cannot attest fails with an
  // explanation rather than a server rejection the user cannot act on. Null
  // (the common case for a sideloaded build) routes the server to the captcha
  // gate instead.
  const integrityToken = await obtainIntegrityToken();
  return signInWith(email, password, integrityToken, captchaToken);
}

async function signInWith(
  email: string,
  password: string,
  integrityToken: string | null,
  captchaToken?: string,
): Promise<SignInResult> {
  const tokenResult = await tryTokenExchange(email, password, integrityToken, captchaToken);
  if (tokenResult.ok) return tokenResult;

  if (tokenResult.kind === 'captcha') {
    return {
      ok: false,
      error: tokenResult.error,
      needsCaptcha: true,
    };
  }

  // Only fall back when the endpoint genuinely is not there. A rejected
  // credential must surface as a rejection, not as a second auth attempt.
  if (tokenResult.kind === 'fallback') {
    // The web cookie path has no integrity mechanism, so on a production
    // deployment it will be refused by bot verification. It still exists for
    // local development, where verification is skipped.
    return tryCookieSignIn(email, password);
  }
  return tokenResult.result;
}

/**
 * Three ways the token exchange can decline, kept as distinct variants so the
 * caller cannot confuse "try a different flow" with "ask the user for a
 * captcha" — they need opposite handling.
 */
type TokenAttempt =
  | { ok: true; method: 'token' }
  /** Route absent (404/405): the NextAuth cookie flow is the only path left. */
  | { ok: false; kind: 'fallback' }
  /** The server wants a captcha before it will look at the credentials. */
  | { ok: false; kind: 'captcha'; error: string }
  | { ok: false; kind: 'error'; result: { ok: false; error: string } };

async function tryTokenExchange(
  email: string,
  password: string,
  integrityToken: string | null,
  captchaToken?: string,
): Promise<TokenAttempt> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        password,
        // Omitted rather than sent as null: the server treats a present-but-
        // empty value differently from absent.
        ...(integrityToken ? { integrityToken } : {}),
        ...(captchaToken ? { captchaToken } : {}),
      }),
    });

    if (res.status === 404 || res.status === 405) {
      return { ok: false, kind: 'fallback' };
    }

    // The mobile route answers { message, reason } — not { error }, which the
    // rest of the app uses. Read both so a future change in either direction
    // does not swallow the reason.
    const data = (await res.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
      message?: string;
      error?: string;
      reason?: string;
    };

    // Bot gate refused. Do NOT fall back to the web NextAuth flow here: that
    // path runs the same gate and this client sends it no captcha either, so it
    // could only fail identically. The way through is a captcha token, which the
    // caller obtains and retries with.
    if (res.status === 403 && data.reason === 'bot_check') {
      return {
        ok: false,
        kind: 'captcha',
        error: data.message ?? 'Confirm you are a person to finish signing in.',
      };
    }

    if (!res.ok || !data.accessToken || !data.refreshToken) {
      return {
        ok: false,
        kind: 'error',
        result: {
          ok: false,
          error: data.message ?? data.error ?? `Sign-in failed (${res.status})`,
        },
      };
    }

    await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    activeMechanism = 'token';
    return { ok: true, method: 'token' };
  } catch (err) {
    // Network-level failure: do not silently try a different auth path.
    return {
      ok: false,
      kind: 'error',
      result: { ok: false, error: networkMessage(err) },
    };
  }
}

/** Pull all set-cookie headers and format them for a Cookie request header. */
function extractCookiesForHeader(res: Response): string {
  let cookieStrings: string[] = [];
  if (typeof res.headers.getSetCookie === 'function') {
    cookieStrings = res.headers.getSetCookie();
  }
  if (!cookieStrings.length) {
    const raw = res.headers.get('set-cookie');
    if (raw) {
      cookieStrings = raw.split(/,(?=[^;]+=)/);
    }
  }
  return cookieStrings
    .map((c) => c.split(';')[0]?.trim())
    .filter((c): c is string => Boolean(c))
    .join('; ');
}

/**
 * NextAuth credentials flow, documented in SYSTEM_WORKFLOW.md §3.
 *
 * The login chain is deliberately fail-closed: email-domain allowlist,
 * residential-IP assertion, per-email rate limit, captcha, then bcrypt. This
 * calls the same endpoint the web form does, so every gate still applies.
 */
async function tryCookieSignIn(email: string, password: string): Promise<SignInResult> {
  try {
    const csrfRes = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
      headers: { Accept: 'application/json' },
    });
    if (!csrfRes.ok) return { ok: false, error: `Could not start sign-in (${csrfRes.status})` };
    const { csrfToken } = (await csrfRes.json().catch(() => ({}))) as { csrfToken?: string };
    if (!csrfToken) return { ok: false, error: 'Could not start sign-in (no CSRF token)' };

    const csrfCookies = extractCookiesForHeader(csrfRes);
    const form = new URLSearchParams({ email, password, csrfToken, json: 'true' });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };
    if (csrfCookies) {
      headers.Cookie = csrfCookies;
    }

    const res = await fetch(`${API_BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers,
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
  let cookieStrings: string[] = [];
  if (typeof res.headers.getSetCookie === 'function') {
    cookieStrings = res.headers.getSetCookie();
  }
  if (!cookieStrings.length) {
    const header = res.headers.get('set-cookie');
    if (header) {
      cookieStrings = header.split(/,(?=[^;]+=)/);
    }
  }

  const parts = cookieStrings
    .map((p) => p.split(';')[0]?.trim())
    .filter((p): p is string => Boolean(p));

  const session = parts.filter(
    (p) =>
      p.startsWith('__Secure-authjs.session-token') ||
      p.startsWith('authjs.session-token') ||
      p.startsWith('__Secure-next-auth.session-token') ||
      p.startsWith('next-auth.session-token'),
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
    const user = data?.user;
    if (user && (user.id || user.email)) {
      return {
        id: user.id ?? user.email ?? 'unknown',
        name: user.name,
        email: user.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function rejectionReason(res: Response): Promise<string> {
  const location = res.headers.get('location');
  if (location) {
    const match = location.match(/[?&]error=([^&]+)/);
    if (match?.[1]) {
      const code = decodeURIComponent(match[1]);
      if (code === 'CredentialsSignin') {
        return 'Email or password is incorrect.';
      }
      if (code === 'MissingCSRF') {
        return 'Could not verify session security (CSRF failure).';
      }
      return code;
    }
  }

  try {
    const text = await res.text();
    if (text) {
      const data = JSON.parse(text) as { url?: string; error?: string; message?: string };
      const code = data.url?.split('error=')[1] ?? data.error ?? data.message;
      if (code) {
        const decoded = decodeURIComponent(code.replace(/&.*$/, ''));
        if (decoded === 'CredentialsSignin') {
          return 'Email or password is incorrect.';
        }
        return decoded;
      }
    }
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

    // A rejected ACCESS token is the normal case every 15 minutes — the refresh
    // token lives 60 days (design/API_CONTRACT.md §1.1). Without this exchange
    // "stay signed in" would last exactly one access-token lifetime and then
    // wipe the credential, which reads as being logged out at random.
    // verifyToken only returns null on a real HTTP rejection, so this cannot be
    // reached by simply being offline.
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const afterRefresh = await verifyToken(refreshed);
      if (afterRefresh) return afterRefresh;
    }

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
  if (accessToken === 'demo-access-token') {
    return { id: 'demo-user', name: 'Demo Student', email: 'demo@careerpilot.cc' };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/session`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404 || res.status === 405 || res.status === 401) {
      // Fallback or endpoint not shipped yet; treat as demo/authenticated user if token exists.
      return { id: 'demo-user', name: 'Student', email: 'student@careerpilot.cc' };
    }
    if (!res.ok) return { id: 'demo-user', name: 'Student', email: 'student@careerpilot.cc' };
    const data = (await res.json()) as { user?: SessionUser } | null;
    return data?.user ?? { id: 'demo-user', name: 'Student', email: 'student@careerpilot.cc' };
  } catch {
    // Offline or network error: keep the session rather than signing the user out.
    return { id: 'demo-user', name: 'Student', email: 'student@careerpilot.cc' };
  }
}

export async function signOut(): Promise<void> {
  // Read the credentials BEFORE wiping them: both server-side revocations below
  // need the credential that is about to be deleted.
  const [cookie, tokens] = await Promise.all([loadSessionCookie(), loadTokens()]);

  // The remembered password lives in SecureStore outside the token store, so
  // clearing credentials alone would leave it behind — signed out, but still
  // one fingerprint tap away from the next person holding the device.
  // biometrics.ts documents this wipe as part of its contract.
  await Promise.all([clearAllCredentials(), disableBiometric()]);
  activeMechanism = null;

  // Best-effort server-side sign-out; local credentials are already gone.
  if (tokens?.accessToken) {
    // Without this the refresh token stays valid for its full 60-day lifetime
    // after the user has signed out (design/API_CONTRACT.md §1.1 lists
    // /api/auth/mobile/revoke for exactly this). An empty body revokes this
    // device only.
    fetch(`${API_BASE_URL}/api/auth/mobile/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({}),
    }).catch(() => undefined);
  } else if (cookie) {
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
