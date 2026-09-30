import { API_BASE_URL, NotAuthenticatedError, ApiError } from './client';
import { getCredentialHeaders } from './credentials';
import { parseJsonFrame, SseFrameParser } from './sse';

/**
 * Chat + threads API for the AI Hub.
 *
 * Every type and event name here was read from the web app's
 * `app/api/ai-hub/chat/route.ts` — this is the real wire contract, not a guess.
 * See design/API_CONTRACT.md §2.1: the reasoning/answer split is FRAGILE, and
 * changing it on the server is a breaking client change.
 */

/** Provider's own levels; an unknown value is a 400 from the provider. */
export const REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'medium';

/** Mirrors MAX_MESSAGE_CHARS in the route; enforced client-side to fail fast. */
export const MAX_MESSAGE_CHARS = 12_000;

/* -------------------------------------------------------------------------- */
/* Wire types                                                                 */
/* -------------------------------------------------------------------------- */

export interface ChatThread {
  _id: string;
  title?: string;
  subject?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface DocumentRef {
  _id: string;
  filename: string;
  pages?: number;
}

/** Events the route emits, in the order it emits them. */
export type ChatEvent =
  | { type: 'meta'; threadId: string; documentsUsed: unknown[] }
  | { type: 'reasoning'; content: string }
  | { type: 'token'; content: string }
  | { type: 'title'; title: string }
  | { type: 'done'; threadId: string; reply: string; reasoning: string }
  | { type: 'error'; message: string };

export interface ChatRequest {
  message: string;
  /** omit to start a new thread; the server returns the id in `meta` */
  threadId?: string;
  reasoningEffort?: ReasoningEffort;
  modelSelection?: string;
  documentIds?: string[];
}

export interface StreamCallbacks {
  /** Fires once, carrying the thread id — a new thread's id arrives here. */
  onMeta?(threadId: string, documentsUsed: unknown[]): void;
  onReasoning?(delta: string): void;
  onToken?(delta: string): void;
  onTitle?(title: string): void;
  onDone?(result: { threadId: string; reply: string; reasoning: string }): void;
  onError?(message: string): void;
}

/* -------------------------------------------------------------------------- */
/* SSE transport                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Stream a chat turn.
 *
 * React Native's global `fetch` cannot stream — `response.body` is null — so
 * this uses `expo/fetch`, which exposes a real ReadableStream. If that ever
 * regresses we fail loudly rather than silently rendering an empty reply.
 *
 * Throws on a non-2xx response and on transport failure; in-band `error` events
 * are surfaced through `onError` so a half-finished answer is not thrown away.
 */
export async function streamChat(
  request: ChatRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(await getCredentialHeaders()),
  };
  if (!headers.Authorization && !headers.Cookie) throw new NotAuthenticatedError();

  // Imported lazily: `expo/fetch` is native-backed and must not be pulled into
  // any bundle path that only needs the plain JSON client.
  const { fetch: expoFetch } = await import('expo/fetch');

  const res = await expoFetch(`${API_BASE_URL}/api/ai-hub/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: request.message,
      ...(request.threadId ? { threadId: request.threadId } : {}),
      ...(request.reasoningEffort ? { reasoningEffort: request.reasoningEffort } : {}),
      ...(request.modelSelection ? { modelSelection: request.modelSelection } : {}),
      ...(request.documentIds?.length ? { documentIds: request.documentIds } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(describeHttpError(res.status, text), res.status, text);
  }

  if (!res.body) {
    throw new Error(
      'Streaming is unavailable in this runtime: the response has no body. ' +
        'Chat requires expo/fetch with ReadableStream support.',
    );
  }

  await consumeSse(res.body, callbacks);
}

/** Non-2xx bodies from this route are `{ message }`, not `{ error }`. */
function describeHttpError(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    const msg = parsed.message ?? parsed.error;
    if (msg) return msg;
  } catch {
    /* not JSON */
  }
  if (status === 413) return 'That message is too long.';
  if (status === 401) return 'Your session expired. Sign in again.';
  return `Request failed (${status})`;
}

/**
 * Consume the response stream.
 *
 * Defers the actual framing to `SseFrameParser`, which is unit-tested against
 * chunk-boundary and malformed-input cases. Keeping a second copy of that logic
 * here would mean the tests proved nothing about the shipped path.
 */
async function consumeSse(
  body: ReadableStream<Uint8Array>,
  callbacks: StreamCallbacks,
): Promise<void> {
  const reader = body.getReader();
  const parser = new SseFrameParser();

  const dispatch = (frames: ReturnType<SseFrameParser['push']>) => {
    for (const frame of frames) {
      const event = parseJsonFrame<ChatEvent>(frame);
      if (!event) continue; // a malformed frame must not kill the stream
      emit(event, callbacks);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      dispatch(parser.push(value));
    }
    // The server may close without a trailing blank line.
    dispatch(parser.flush());
  } finally {
    reader.releaseLock();
  }
}

function emit(event: ChatEvent, callbacks: StreamCallbacks): void {
  switch (event.type) {
    case 'meta':
      callbacks.onMeta?.(event.threadId, event.documentsUsed);
      break;
    case 'reasoning':
      callbacks.onReasoning?.(event.content);
      break;
    case 'token':
      callbacks.onToken?.(event.content);
      break;
    case 'title':
      callbacks.onTitle?.(event.title);
      break;
    case 'done':
      callbacks.onDone?.({
        threadId: event.threadId,
        reply: event.reply,
        reasoning: event.reasoning,
      });
      break;
    case 'error':
      callbacks.onError?.(event.message);
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* Threads                                                                    */
/* -------------------------------------------------------------------------- */

interface ThreadListResponse {
  threads?: ChatThread[];
}

export async function listThreads(): Promise<ChatThread[]> {
  const { apiFetch } = await import('./client');
  const data = await apiFetch<ThreadListResponse | ChatThread[]>('/api/ai-hub/threads');
  if (Array.isArray(data)) return data;
  return data?.threads ?? [];
}

export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
}

interface ThreadDetailResponse {
  messages?: ThreadMessage[];
  thread?: ChatThread;
}

export async function getThread(id: string): Promise<{
  messages: ThreadMessage[];
  thread?: ChatThread;
}> {
  const { apiFetch } = await import('./client');
  const data = await apiFetch<ThreadDetailResponse>(`/api/ai-hub/threads/${id}`);
  return { messages: data?.messages ?? [], thread: data?.thread };
}
