import Constants from 'expo-constants';

/**
 * API client.
 *
 * The app is a standalone client of the production web app — there is no second
 * server (see design/ANDROID_APP_PLAN.md §1). Everything here is transport plus
 * one hard rule: **auth is fail-closed**. A missing or rejected credential
 * surfaces as an error, never as a silent anonymous request.
 */

export const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'https://careerpilot.cc';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the caller has no usable credential. Never swallowed. */
export class NotAuthenticatedError extends ApiError {
  constructor(message = 'Not signed in') {
    super(message, 401);
    this.name = 'NotAuthenticatedError';
  }
}

/**
 * The credential holder is injected rather than imported, so this module stays
 * free of storage concerns and is testable without a device.
 */
export interface AuthCredentials {
  getAccessToken(): Promise<string | null>;
  /**
   * Session cookie fallback, used while the token-exchange route does not yet
   * exist on the server. React Native's fetch does not persist cookies across
   * requests, so the app captures the cookie once and replays it manually.
   */
  getCookie?(): Promise<string | null>;
  /** Called on a 401 so the implementation can refresh once and retry. */
  refresh?(): Promise<string | null>;
}

let credentials: AuthCredentials | null = null;

export function configureAuth(next: AuthCredentials): void {
  credentials = next;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set for multipart bodies — the caller supplies the FormData. */
  formData?: FormData;
  signal?: AbortSignal;
  /** Skip the Authorization header (sign-in, register). */
  anonymous?: boolean;
  /** Retry once after a refresh on 401. Internal, prevents loops. */
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal, anonymous = false, _retried = false } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (!anonymous) {
    const token = await credentials?.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      const cookie = await credentials?.getCookie?.();
      if (cookie) {
        headers.Cookie = cookie;
      } else {
        // Fail closed: an authenticated call with no credential must not go out
        // as an anonymous request.
        throw new NotAuthenticatedError();
      }
    }
  }

  let payload: BodyInit | undefined;
  if (formData) {
    // Do NOT set Content-Type — fetch must add the multipart boundary.
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: payload,
    signal,
  });

  if (res.status === 401 && !anonymous && !_retried && credentials?.refresh) {
    const refreshed = await credentials.refresh();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    throw new NotAuthenticatedError();
  }

  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(errorMessage(parsed, res.status), res.status, parsed);
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === 'string') return err;
  }
  if (typeof body === 'string' && body.trim()) return body.slice(0, 200);
  return `Request failed (${status})`;
}

/**
 * Server-sent events.
 *
 * React Native's `fetch` cannot stream, so the Hub's chat needs a different
 * transport. Problem 1 in design/API_CONTRACT.md §2.1: the route separates
 * reasoning-model chain-of-thought from the answer on distinct fields, and any
 * change to that envelope is a breaking client change.
 */
export interface StreamHandlers {
  onDelta?(text: string): void;
  /** chain-of-thought, rendered separately from the answer */
  onReasoning?(text: string): void;
  onDone?(): void;
  onError?(error: Error): void;
}

/**
 * NOT YET IMPLEMENTED — Phase 2.
 *
 * Planned: `expo/fetch` (streaming-capable) or `react-native-sse`, whichever
 * proves stable against the deployed route. This stub exists so the Hub screen
 * can be wired without guessing at the transport, and it fails loudly rather
 * than pretending to work.
 */
export async function streamChat(
  _payload: { threadId: string; message: string; model?: string },
  _handlers: StreamHandlers,
  _signal?: AbortSignal,
): Promise<void> {
  throw new Error(
    'streamChat is not implemented yet (Phase 2). See design/API_CONTRACT.md §2.1 ' +
      'for the SSE contract this must satisfy.',
  );
}
