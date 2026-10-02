import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  MAX_MESSAGE_CHARS,
  streamChat,
  type ChatThread,
  type ReasoningEffort,
} from '@/api/chat';

/**
 * Chat state for the Hub.
 *
 * Held in a provider rather than the screen so a streamed reply survives
 * navigation — leaving the Hub mid-answer and coming back must not lose it.
 *
 * The reply is accumulated from `token` deltas, but `done` carries the complete
 * reply and reasoning. On `done` those authoritative values replace whatever
 * was accumulated, so a dropped frame degrades the live view rather than
 * corrupting the stored turn.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** chain-of-thought, shown separately from the answer */
  reasoning?: string;
  /** true while tokens are still arriving */
  streaming?: boolean;
  /** set when the turn failed; content may still hold a partial reply */
  error?: string;
}

interface ChatState {
  threadId: string | null;
  title: string | null;
  messages: ChatMessage[];
  /** reasoning text for the in-flight turn */
  liveReasoning: string;
  isStreaming: boolean;
  error: string | null;
  send(message: string, options?: SendOptions): Promise<void>;
  stop(): void;
  reset(): void;
  loadThread(thread: ChatThread, messages: ChatMessage[]): void;
}

interface SendOptions {
  reasoningEffort?: ReasoningEffort;
  modelSelection?: string;
  documentIds?: string[];
}

const ChatContext = createContext<ChatState | null>(null);

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveReasoning, setLiveReasoning] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so `stop()` works without re-creating the controller.
  const abortRef = useRef<AbortController | null>(null);
  /** Guards against a stale stream writing into a reset/new conversation. */
  const turnRef = useRef(0);
  /**
   * In-flight flag for the send guard.
   *
   * `isStreaming` state lags a render behind, so two sends dispatched in the
   * same tick would both pass a state-based check; the second would then
   * overwrite `abortRef`, leaving the first stream impossible to stop.
   */
  const streamingRef = useRef(false);

  // Abort an in-flight stream when the provider goes away — sign-out, or any
  // tree swap. Otherwise the request keeps running server-side (still billing
  // the model call), its callbacks write into an unmounted tree, and the Stop
  // control has left with the UI.
  useEffect(
    () => () => {
      turnRef.current++;
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const send = useCallback(
    async (message: string, options: SendOptions = {}) => {
      const text = message.trim();
      if (!text || streamingRef.current) return;

      if (text.length > MAX_MESSAGE_CHARS) {
        setError(`That message is too long (limit ${MAX_MESSAGE_CHARS.toLocaleString()} characters).`);
        return;
      }

      setError(null);
      setLiveReasoning('');
      streamingRef.current = true;
      setIsStreaming(true);

      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', content: text },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      const turn = ++turnRef.current;

      /** True once this turn has been superseded by reset() or a newer turn. */
      const stale = () => turn !== turnRef.current;

      const patchAssistant = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
        );

      const appendTo = (field: 'content' | 'reasoning', delta: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, [field]: (m[field] ?? '') + delta } : m,
          ),
        );

      try {
        await streamChat(
          {
            message: text,
            threadId: threadId ?? undefined,
            reasoningEffort: options.reasoningEffort,
            modelSelection: options.modelSelection,
            documentIds: options.documentIds,
          },
          {
            onMeta: (id) => {
              if (stale()) return;
              // A new thread's id only exists here, so capture it immediately.
              setThreadId(id);
            },
            onTitle: (next) => {
              if (!stale()) setTitle(next);
            },
            onReasoning: (delta) => {
              if (stale()) return;
              setLiveReasoning((prev) => prev + delta);
              appendTo('reasoning', delta);
            },
            onToken: (delta) => {
              if (!stale()) appendTo('content', delta);
            },
            onDone: (result) => {
              if (stale()) return;
              // Authoritative values replace the accumulated ones.
              setThreadId(result.threadId);
              patchAssistant({
                content: result.reply,
                reasoning: result.reasoning || undefined,
                streaming: false,
              });
            },
            onError: (message) => {
              if (stale()) return;
              patchAssistant({ streaming: false, error: message });
              setError(message);
            },
          },
          controller.signal,
        );

        if (!stale()) {
          // Covers a stream that closed without a `done` event.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.streaming ? { ...m, streaming: false } : m,
            ),
          );
        }
      } catch (err) {
        const aborted = err instanceof Error && err.name === 'AbortError';
        const message = aborted
          ? 'Stopped.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong.';
        // Patched even when a newer turn has already taken over: this message's
        // "streaming" flag belongs to this turn alone and nothing else will ever
        // clear it. Skipping it (the old "if (stale()) return") left a bubble
        // stuck on "thinking..." forever after stop() plus a quick re-send.
        patchAssistant({ streaming: false, error: message });
        if (!stale() && !aborted) setError(message);
      } finally {
        if (!stale()) {
          streamingRef.current = false;
          setIsStreaming(false);
        }
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [threadId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    // Invalidate any in-flight turn so its callbacks stop writing.
    turnRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setThreadId(null);
    setTitle(null);
    setMessages([]);
    setLiveReasoning('');
    setIsStreaming(false);
    setError(null);
  }, []);

  const loadThread = useCallback((thread: ChatThread, loaded: ChatMessage[]) => {
    turnRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setThreadId(thread._id);
    setTitle(thread.title ?? null);
    setMessages(loaded);
    setLiveReasoning('');
    setIsStreaming(false);
    setError(null);
  }, []);

  const value = useMemo<ChatState>(
    () => ({
      threadId,
      title,
      messages,
      liveReasoning,
      isStreaming,
      error,
      send,
      stop,
      reset,
      loadThread,
    }),
    [threadId, title, messages, liveReasoning, isStreaming, error, send, stop, reset, loadThread],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
