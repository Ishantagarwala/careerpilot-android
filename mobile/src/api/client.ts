import { Platform } from 'react-native';
import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

/**
 * Mobile auth now uses a short-lived access token (15 min) plus a long-lived
 * refresh token (60 days), issued by POST /api/auth/mobile/token. The previous
 * single 30-day token and its /api/auth/mobile/login endpoint are gone.
 *
 * A single access token therefore expires mid-session, so this client refreshes
 * transparently on a 401 and replays the request once. Callers keep using
 * apiClient() exactly as before and never see the rotation.
 */
const AUTH_TOKEN_KEY = 'careerpilot_auth_token';
const REFRESH_TOKEN_KEY = 'careerpilot_refresh_token';

// In Android emulator, 10.0.2.2 maps to host machine localhost:3000
const DEFAULT_DEV_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || DEFAULT_DEV_URL;
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function getStoredToken(): Promise<string | null> {
  return getSecureItem(AUTH_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return getSecureItem(REFRESH_TOKEN_KEY);
}

/** Access token only — kept for callers that predate the refresh token. */
export async function setStoredToken(token: string): Promise<void> {
  await setSecureItem(AUTH_TOKEN_KEY, token);
}

export async function setStoredTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
}): Promise<void> {
  await setSecureItem(AUTH_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    await setSecureItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function clearStoredToken(): Promise<void> {
  await deleteSecureItem(AUTH_TOKEN_KEY);
  await deleteSecureItem(REFRESH_TOKEN_KEY);
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/** Endpoints that must never trigger the refresh-and-retry path. */
const AUTH_PATHS = ['/api/auth/mobile/refresh', '/api/auth/mobile/token', '/api/auth/mobile/revoke'];

interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
}

/**
 * In-flight refresh, shared by every request that 401s at the same time. Without
 * this, a screen that fires four parallel fetches would rotate the refresh token
 * four times — and the server treats a second use of an already-rotated token as
 * theft, revoking the whole family and signing the user out.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${getApiBaseUrl()}/api/auth/mobile/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as TokenPair | null;
  if (!data?.accessToken) return null;

  await setStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

async function getRefreshedAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Rotates the access token, sharing the single-flight guard above.
 *
 * Exported for the AI Hub stream (studyStream.ts). A streaming request cannot
 * go through `apiClient` because that buffers the whole body, so the stream
 * needs the refresh itself — and it must be *this* refresh, not its own copy.
 * The server treats a second use of an already-rotated refresh token as theft
 * and revokes the whole family, which would sign the user out mid-session.
 */
export async function forceRefreshAccessToken(): Promise<string | null> {
  return getRefreshedAccessToken();
}

export async function apiClient<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p));

  const run = async (bearer: string | null): Promise<Response> => {
    const baseUrl = getApiBaseUrl();
    const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const headers = new Headers(options.headers || {});

    if (bearer && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${bearer}`);
    }

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const timeoutMs = options.timeoutMs || 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let token = await getStoredToken();

  try {
    let response = await run(token);

    // An access token lives 15 minutes, so a 401 usually just means "rotate".
    if (response.status === 401 && !isAuthPath) {
      const refreshed = await getRefreshedAccessToken();
      if (refreshed) {
        token = refreshed;
        response = await run(refreshed);
      }
    }

    const contentType = response.headers.get('content-type');
    let data: any;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        `Request failed with status ${response.status}`;
      throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network request failed', 0);
  }
}

apiClient.get = function <T = any>(path: string, options?: RequestOptions): Promise<T> {
  return apiClient<T>(path, { ...options, method: 'GET' });
};

apiClient.post = function <T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
  return apiClient<T>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
};

apiClient.put = function <T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> {
  return apiClient<T>(path, {
    ...options,
    method: 'PUT',
    body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
};

apiClient.delete = function <T = any>(path: string, options?: RequestOptions): Promise<T> {
  return apiClient<T>(path, { ...options, method: 'DELETE' });
};
