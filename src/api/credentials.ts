import { loadSessionCookie, loadTokens, saveTokens, clearAllCredentials } from '@/auth/storage';
import { API_BASE_URL } from './base';

/**
 * Credential resolution, shared by the JSON client and the SSE transport.
 *
 * Kept out of both so neither owns it: `client.ts` stays storage-free enough to
 * test, and the SSE path gets the same rules without going through `apiFetch`.
 *
 * Precedence is token-then-cookie, matching the auth layer. An empty result
 * means "no credential", and callers MUST treat that as a hard failure rather
 * than continuing anonymously.
 *
 * The refresh implementation is injected from `auth/session.ts` via
 * `registerRefresher` rather than imported, because session.ts imports this
 * module — importing back would be a cycle.
 */
export async function getCredentialHeaders(): Promise<Record<string, string>> {
  const tokens = await loadTokens();
  if (tokens?.accessToken) {
    return { Authorization: `Bearer ${tokens.accessToken}` };
  }
  const cookie = await loadSessionCookie();
  if (cookie) {
    return { Cookie: cookie };
  }
  return {};
}

type Refresher = () => Promise<string | null>;

let refresher: Refresher | null = null;

export function registerRefresher(fn: Refresher): void {
  refresher = fn;
}

/**
 * The refresh currently in flight, shared by every caller that needs one.
 *
 * Refresh tokens rotate ONE TIME and reuse is detected server-side: presenting
 * an already-rotated token revokes every session the user has, on every device
 * (design/API_CONTRACT.md §1.1). Two requests failing with 401 at the same
 * moment — a screen that loads two resources in parallel, a retry landing
 * beside a fresh call — would otherwise present the same token twice and sign
 * the user out everywhere. Sharing one promise makes that trade happen once.
 */
let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Exchange the refresh token for a new access token.
 *
 * Only the token mechanism can refresh — a rejected NextAuth session cookie
 * means the session is genuinely gone, so this returns null and the caller
 * fails closed.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  const attempt = runRefresh();
  inFlightRefresh = attempt;
  void attempt.finally(() => {
    // Identity check, so a refresh started after this one settled is not erased.
    if (inFlightRefresh === attempt) inFlightRefresh = null;
  });
  return attempt;
}

async function runRefresh(): Promise<string | null> {
  // A refresher that throws must not reject the shared promise, or every
  // caller awaiting it would take an unhandled rejection.
  try {
    if (refresher) return await refresher();
    return await exchangeRefreshToken();
  } catch {
    return null;
  }
}

async function exchangeRefreshToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      // Only a *rejection* means the credential is dead. These routes are rate
      // limited (429 + Retry-After) and 5xx is transient; wiping the credential
      // for either would sign the user out over a hiccup — the same rule the
      // network catch below already follows.
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
}
