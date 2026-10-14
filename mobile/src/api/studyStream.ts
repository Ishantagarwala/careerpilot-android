import { fetch as streamingFetch } from 'expo/fetch';
import {
  ApiError,
  forceRefreshAccessToken,
  getApiBaseUrl,
  getStoredToken,
} from './client';

/**
 * The AI Hub chat stream.
 *
 * `apiClient` cannot be used for this endpoint: it buffers the whole response
 * before parsing, and React Native's global `fetch` cannot stream a body at all.
 * `expo/fetch` returns a real `ReadableStream`, which is why this is its own
 * module rather than another function in study.ts.
 *
 * The event contract is `app/api/ai-hub/chat/route.ts`. It emits, in order:
 *
 *   { type: "meta",      threadId, documentsUsed: [{id, filename}] }
 *   { type: "reasoning", content }   ← 0..n, the chain-of-thought channel
 *   { type: "token",     content }   ← 0..n, the answer channel
 *   { type: "title",     title }     ← first exchange only
 *   { type: "done",      threadId, reply, reasoning }
 *   { type: "error",     message }   ← stream-level failure
 *
 * Framing is `data: <json>\n\n` (sseEncode, route.ts:230).
 *
 * Two failure modes have to be told apart:
 *
 *  - **Pre-stream** — auth, rate limit, or a provider error before any bytes:
 *    the route returns a JSON body with an HTTP error status. Detected by
 *    content-type and surfaced as an ApiError, matching apiClient's behaviour.
 *  - **Mid-stream** — the provider dies after tokens have been emitted: HTTP is
 *    already 200, so the failure arrives as `{type:"error"}` and is thrown from
 *    inside the read loop. The caller keeps whatever text already streamed.
 */

export interface ChatStreamMeta {
  threadId: string;
  documentsUsed?: Array<{ id: string; filename: string }>;
}

/** Progressive callbacks fired while a reply streams in. */
export interface ChatStreamHandlers {
  onMeta?: (meta: ChatStreamMeta) => void;
  onReasoning?: (delta: string) => void;
  onToken?: (delta: string) => void;
  onTitle?: (title: string) => void;
}

export interface ChatStreamParams extends ChatStreamHandlers {
  message: string;
  threadId?: string;
  documentIds?: string[];
  attachments?: unknown[];
  /**
   * Which model to answer with. Defaults to DEFAULT_MODEL_SELECTION — see the
   * note on that constant for why the client names one explicitly.
   */
  modelSelection?: string;
  /** Abort the turn — e.g. the user leaves the screen. */
  signal?: AbortSignal;
  /** Inactivity guard. The whole turn may legitimately run for minutes. */
  timeoutMs?: number;
}

/**
 * The model requested when the caller does not name one.
 *
 * The client must name a model, because the SERVER'S DEFAULT IS BROKEN on the
 * live deployment. Verified against https://careerpilot.cc:
 *
 *   no modelSelection        -> HTTP 500 {"message":"Model not available."}
 *   deepseek-ai/DeepSeek-V4.1-Flash (the advertised default)
 *                            -> {"message":"DeepSeek V4.1 reasoning_effort must
 *                                be low, high, xhigh, max, or an integer …"}
 *   zai-org/GLM-5.3          -> streams correctly
 *
 * So an unqualified request fails every time, which is why the Hub appeared
 * broken. Naming a model sidesteps a server-side bug this client cannot fix.
 *
 * WHEN THE SERVER DEFAULT IS FIXED, this can become `undefined` again and let
 * the server choose. Until then it is deliberately an explicit, known-good id.
 */
const DEFAULT_MODEL_SELECTION = 'zai-org/GLM-5.3';

export interface ChatResult {
  reply: string;
  reasoning?: string;
  threadId: string;
  documentsUsed?: Array<{ id: string; filename: string }>;
}

interface ChatStreamEvent {
  type?: string;
  content?: string;
  threadId?: string;
  message?: string;
  reply?: string;
  reasoning?: string;
  title?: string;
  documentsUsed?: Array<{ id: string; filename: string }>;
}

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Opens the SSE request, replaying it once behind a token refresh.
 *
 * The retry is safe only because nothing has been streamed yet — this is called
 * before the read loop starts, so a 401 here has produced no tokens to lose.
 */
async function openStream(
  path: string,
  body: string,
  signal: AbortSignal | undefined
): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;

  const send = async (bearer: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return await streamingFetch(url, { method: 'POST', headers, body, signal });
  };

  let response = await send(await getStoredToken());

  // An access token lives 15 minutes, so mid-session this is routine.
  if (response.status === 401) {
    // A refresh that rotates the token family while another request holds the
    // old one is treated by the server as theft, so reuse the client's
    // single-flight refresh rather than racing it.
    const refreshed = await forceRefreshAccessToken();
    if (refreshed) response = await send(refreshed);
  }

  return response as unknown as Response;
}

/**
 * Sends a turn and streams the reply.
 *
 * Resolves with the authoritative `done` payload — the caller should reconcile
 * its optimistic bubble against this, not against the accumulated deltas, since
 * the server may have capped or replaced the text before storing it.
 */
export async function sendChatMessage(
  params: ChatStreamParams
): Promise<ChatResult> {
  const { message, threadId, documentIds, attachments } = params;
  const modelSelection = params.modelSelection || DEFAULT_MODEL_SELECTION;

  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  const disarm = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  // Honour an externally supplied signal as well as the inactivity timer.
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener('abort', () => controller.abort());
  }

  arm();

  try {
    const response = await openStream(
      '/api/ai-hub/chat',
      JSON.stringify({
        message: message.trim(),
        threadId: threadId || undefined,
        documentIds: (documentIds || []).slice(0, 3),
        attachments: attachments || [],
        modelSelection,
      }),
      controller.signal
    );

    // Pre-stream failure: an HTTP error status with a JSON body.
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/event-stream')) {
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(
        payload?.message || payload?.error || `Request failed with status ${response.status}`,
        response.status,
        payload
      );
    }

    const stream = (response as unknown as { body: ReadableStream<Uint8Array> | null }).body;
    if (!stream) {
      throw new ApiError('The response stream was empty.', 0);
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let reply = '';
    let reasoning = '';
    let resolvedThreadId = threadId || '';
    let documentsUsed: ChatStreamMeta['documentsUsed'];
    let finished = false;
    let streamError: string | null = null;

    const handleEvent = (event: ChatStreamEvent) => {
      // Any traffic proves the connection is alive.
      arm();

      switch (event.type) {
        case 'meta':
          if (event.threadId) resolvedThreadId = event.threadId;
          documentsUsed = event.documentsUsed;
          params.onMeta?.({ threadId: resolvedThreadId, documentsUsed });
          break;

        case 'reasoning':
          if (event.content) {
            reasoning += event.content;
            params.onReasoning?.(event.content);
          }
          break;

        case 'token':
          if (event.content) {
            reply += event.content;
            params.onToken?.(event.content);
          }
          break;

        case 'title':
          if (event.title) params.onTitle?.(event.title);
          break;

        case 'done':
          if (event.threadId) resolvedThreadId = event.threadId;
          if (typeof event.reply === 'string') reply = event.reply;
          if (typeof event.reasoning === 'string') reasoning = event.reasoning;
          finished = true;
          break;

        case 'error':
          streamError = event.message || 'The AI response failed.';
          break;

        default:
          break;
      }
    };

    while (!finished && !streamError) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line.
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        // A frame may carry several `data:` lines; concatenate their payloads,
        // which is what the SSE spec requires for a multi-line data field.
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');

        if (data) {
          try {
            handleEvent(JSON.parse(data) as ChatStreamEvent);
          } catch {
            // A malformed frame is not worth killing a good reply over.
            console.warn('AI Hub stream: skipped an unparseable frame');
          }
        }

        if (finished || streamError) break;
        boundary = buffer.indexOf('\n\n');
      }
    }

    // Release the reader without cancelling an already-closed stream.
    reader.cancel().catch(() => {});

    if (streamError) {
      throw new ApiError(streamError, 500);
    }

    /*
     * The server always emits `done`. Reaching the end of the stream without it
     * means the connection dropped mid-reply — worth surfacing, because a
     * silently truncated answer is worse than an error the student can retry.
     */
    if (!finished) {
      throw new ApiError('The AI response ended unexpectedly before it was complete.', 0);
    }

    if (!reply.trim()) {
      throw new ApiError('The AI did not return a reply. Please try again.', 0);
    }

    return {
      reply,
      reasoning: reasoning || undefined,
      threadId: resolvedThreadId,
      documentsUsed,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 408);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(error?.message || 'Network request failed', 0);
  } finally {
    disarm();
  }
}
