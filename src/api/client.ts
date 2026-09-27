import { API_BASE_URL } from './base';
import { getCredentialHeaders, refreshAccessToken } from './credentials';

/**
 * API client.
 *
 * The app is a standalone client of the production web app — there is no second
 * server (see design/ANDROID_APP_PLAN.md §1). Everything here is transport plus
 * one hard rule: **auth is fail-closed**. A missing or rejected credential
 * surfaces as an error, never as a silent anonymous request.
 */


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
    // Fail closed: an authenticated call with no credential must not go out as
    // an anonymous request.
    const resolved = await getCredentialHeaders();
    if (!resolved.Authorization && !resolved.Cookie) {
      throw new NotAuthenticatedError();
    }
    Object.assign(headers, resolved);
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

  if (res.status === 401 && !anonymous && !_retried) {
    const refreshed = await refreshAccessToken();
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

export { API_BASE_URL };
