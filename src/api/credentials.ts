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
 * Exchange the refresh token for a new access token.
 *
 * Only the token mechanism can refresh — a rejected NextAuth session cookie
 * means the session is genuinely gone, so this returns null and the caller
 * fails closed.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refresher) return refresher();

  const tokens = await loadTokens();
  if (!tokens) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/mobile/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      // A rejected refresh means the credential is dead — fail closed.
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
}
