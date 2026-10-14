import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, apiClient } from './client';
import { parseMarkdownCodeBlocks as parseMarkdownCodeBlocksImpl } from './replyParsers';

export interface ThreadAttachment {
  type: 'image' | 'file';
  filename: string;
  fileUrl: string;
}

export interface ThreadMessage {
  _id?: string;
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  /**
   * Chain-of-thought from a reasoning model, kept on its own channel so it is
   * rendered as a separate trace and never mixed into the answer
   * (app/api/ai-hub/chat/route.ts splits these deliberately).
   */
  reasoning?: string;
  title?: string;
  codeSnippet?: string;
  documentIds?: string[];
  contextDoc?: string;
  attachments?: ThreadAttachment[];
  showPracticeAction?: boolean;
  sentAt?: string | Date;
}

export interface StudyThread {
  _id: string;
  userId: string;
  threadTitle: string;
  threadType: 'general' | 'document';
  messages: ThreadMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ThreadSummary {
  _id: string;
  threadTitle: string;
  threadType: 'general' | 'document';
  createdAt: string;
  updatedAt: string;
}

export interface StudyQuestion {
  question: string;
  options?: string[];
  answer: string;
  type: 'mcq' | 'short' | 'flashcard';
}

export interface StudyDocument {
  _id: string;
  filename: string;
  fileUrl: string;
  summary?: string;
  questions?: StudyQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentSummaryResponse {
  id: string;
  filename: string;
  summary: string;
}

export interface DocumentQuestionsResponse {
  id: string;
  filename: string;
  questions: StudyQuestion[];
}

export interface ChatResponse {
  reply: string;
  threadId: string;
  messages: ThreadMessage[];
  /** Chain-of-thought for the turn, when a reasoning model produced one. */
  reasoning?: string;
  /**
   * The documents the server actually attached to the turn.
   *
   * NOTE: this carries only `{id, filename}` — there is no page number and no
   * chunk count, so a citation cannot say "page 14 · grounded on 3 chunks".
   * See docs/ai-hub-audit.md; that needs a server change.
   */
  documentsUsed?: Array<{ id: string; filename: string }>;
}

export interface SelectedDocContext {
  id: string;
  filename: string;
}

/** The last thread this device opened, for offline reading. */
export interface CachedThread {
  id: string;
  title: string | null;
  messages: ThreadMessage[];
  cachedAt: string;
}

// Storage keys
const THREADS_CACHE_PREFIX = '@careerpilot_threads_';
const DOCS_CACHE_PREFIX = '@careerpilot_docs_';
const DOC_SUMMARY_CACHE_PREFIX = '@careerpilot_doc_summary_';
const DOC_QUESTIONS_CACHE_PREFIX = '@careerpilot_doc_questions_';
const SELECTED_DOCS_KEY = '@careerpilot_selected_study_docs';
/**
 * Read-through cache for a single OPENED thread.
 *
 * ANDROID_APP_PLAN.md §5: "Threads + messages — local store, read-through
 * cache. Opened threads are readable offline." `getCachedThreads` holds only
 * summaries, so it cannot serve a transcript. This is what design/png/
 * 10-dark-offline.png reads from.
 *
 * One fixed key keeps the most recently opened thread, so the Hub can fall back
 * to "the thread you were last in" without knowing its id while offline.
 */
const OPEN_THREAD_CACHE_PREFIX = '@careerpilot_open_thread_';

// ==========================================
// Context & Selection helpers
// ==========================================

export async function getStoredSelectedDocs(): Promise<SelectedDocContext[]> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3);
      }
    }
  } catch (err) {
    console.warn('Failed to get selected study docs:', err);
  }
  return [];
}

export async function setStoredSelectedDocs(docs: SelectedDocContext[]): Promise<void> {
  try {
    const bounded = docs.slice(0, 3);
    await AsyncStorage.setItem(SELECTED_DOCS_KEY, JSON.stringify(bounded));
  } catch (err) {
    console.warn('Failed to save selected study docs:', err);
  }
}

// ==========================================
// Thread API Calls
// ==========================================

export async function fetchThreads(): Promise<ThreadSummary[]> {
  return await apiClient<ThreadSummary[]>('/api/ai-hub/threads', {
    method: 'GET',
    timeoutMs: 15000,
  });
}

export async function fetchThread(threadId: string): Promise<StudyThread> {
  return await apiClient<StudyThread>(`/api/ai-hub/threads/${threadId}`, {
    method: 'GET',
    timeoutMs: 15000,
  });
}

export async function createThread(title = 'New conversation', type: 'general' | 'document' = 'general'): Promise<StudyThread> {
  return await apiClient<StudyThread>('/api/ai-hub/threads', {
    method: 'POST',
    body: JSON.stringify({ title, type }),
    timeoutMs: 15000,
  });
}

export async function renameThread(threadId: string, title: string): Promise<StudyThread> {
  return await apiClient<StudyThread>(`/api/ai-hub/threads/${threadId}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
    timeoutMs: 15000,
  });
}

export async function deleteThread(threadId: string): Promise<{ message: string }> {
  return await apiClient<{ message: string }>(`/api/ai-hub/threads/${threadId}`, {
    method: 'DELETE',
    timeoutMs: 15000,
  });
}

/*
 * `sendChatMessage` is a streaming call and lives in ./studyStream, together
 * with its `ChatStreamHandlers` / `ChatStreamMeta` types. It is re-exported at
 * the bottom of this file so callers keep importing from one place.
 *
 * It cannot live here: this module's `apiClient` buffers a whole response body,
 * and the AI Hub chat endpoint is SSE. React Native's global fetch cannot stream
 * either, so the stream uses `expo/fetch`.
 */

// ==========================================
// Document API Calls
// ==========================================

export async function fetchDocuments(): Promise<StudyDocument[]> {
  return await apiClient<StudyDocument[]>('/api/ai-hub/documents', {
    method: 'GET',
    timeoutMs: 15000,
  });
}

/**
 * A document's stored summary.
 *
 * There is no `/api/pdf/summary/:id` route any more — it was removed when PDF
 * upload stopped running an LLM eagerly. The summary now lives on the document
 * row itself and arrives with `GET /api/ai-hub/documents`
 * (`app/api/ai-hub/documents/route.ts` selects `summary questions`), so this
 * resolves from that list rather than inventing an endpoint.
 */
export async function fetchDocumentSummary(docId: string): Promise<DocumentSummaryResponse> {
  const docs = await apiClient<StudyDocument[]>('/api/ai-hub/documents', {
    method: 'GET',
    timeoutMs: 15000,
  });
  const doc = (docs || []).find((d) => d._id === docId);
  if (!doc) {
    throw new ApiError('This document is no longer in your library.', 404);
  }
  return { id: doc._id, filename: doc.filename, summary: doc.summary || '' };
}

/** Questions are stored the same way, on the document row. */
export async function fetchDocumentQuestions(docId: string): Promise<DocumentQuestionsResponse> {
  const docs = await apiClient<StudyDocument[]>('/api/ai-hub/documents', {
    method: 'GET',
    timeoutMs: 15000,
  });
  const doc = (docs || []).find((d) => d._id === docId);
  if (!doc) {
    throw new ApiError('This document is no longer in your library.', 404);
  }
  return { id: doc._id, filename: doc.filename, questions: doc.questions || [] };
}

export async function uploadStudyDocument(formData: FormData): Promise<{
  type: string;
  docId: string;
  filename: string;
  fileUrl: string;
  summary?: string;
  questions?: StudyQuestion[];
}> {
  return await apiClient<{
    type: string;
    docId: string;
    filename: string;
    fileUrl: string;
    summary?: string;
    questions?: StudyQuestion[];
  }>('/api/ai-hub/upload', {
    method: 'POST',
    body: formData,
    timeoutMs: 60000, // OCR/PDF extraction + LLM analysis
  });
}

// ==========================================
// Caching / Offline Helpers
// ==========================================

export async function getCachedThreads(userId: string): Promise<ThreadSummary[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${THREADS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached threads:', err);
  }
  return null;
}

export async function setCachedThreads(userId: string, threads: ThreadSummary[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${THREADS_CACHE_PREFIX}${userId}`, JSON.stringify(threads));
  } catch (err) {
    console.warn('Failed to cache threads:', err);
  }
}

/** Stores the transcript of the thread the user just opened. */
export async function setCachedThread(
  userId: string,
  thread: Omit<CachedThread, 'cachedAt'>
): Promise<void> {
  try {
    const payload: CachedThread = { ...thread, cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(`${OPEN_THREAD_CACHE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to cache open thread:', err);
  }
}

/**
 * The last opened thread, or a specific one when `threadId` is given.
 *
 * Passing a threadId returns null unless it matches, which is deliberate: the
 * Hub must not show thread A's transcript as though it were thread B's.
 */
export async function getCachedThread(
  userId: string,
  threadId?: string | null
): Promise<CachedThread | null> {
  try {
    const raw = await AsyncStorage.getItem(`${OPEN_THREAD_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed: CachedThread = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    if (threadId && parsed.id !== threadId) return null;
    return parsed;
  } catch (err) {
    console.warn('Failed to read cached open thread:', err);
    return null;
  }
}

export async function getCachedDocuments(userId: string): Promise<StudyDocument[] | null> {  try {
    const raw = await AsyncStorage.getItem(`${DOCS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached documents:', err);
  }
  return null;
}

export async function setCachedDocuments(userId: string, docs: StudyDocument[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DOCS_CACHE_PREFIX}${userId}`, JSON.stringify(docs));
  } catch (err) {
    console.warn('Failed to cache documents:', err);
  }
}

export async function getCachedDocSummary(docId: string): Promise<DocumentSummaryResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DOC_SUMMARY_CACHE_PREFIX}${docId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached doc summary:', err);
  }
  return null;
}

export async function setCachedDocSummary(docId: string, summary: DocumentSummaryResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DOC_SUMMARY_CACHE_PREFIX}${docId}`, JSON.stringify(summary));
  } catch (err) {
    console.warn('Failed to cache doc summary:', err);
  }
}

export async function getCachedDocQuestions(docId: string): Promise<DocumentQuestionsResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DOC_QUESTIONS_CACHE_PREFIX}${docId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached doc questions:', err);
  }
  return null;
}

export async function setCachedDocQuestions(docId: string, questions: DocumentQuestionsResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DOC_QUESTIONS_CACHE_PREFIX}${docId}`, JSON.stringify(questions));
  } catch (err) {
    console.warn('Failed to cache doc questions:', err);
  }
}

// ==========================================
// Parsing & Formatting Utilities
// ==========================================

export function groupThreadsByDate(threads: ThreadSummary[]): {
  today: ThreadSummary[];
  earlier: ThreadSummary[];
} {
  const today: ThreadSummary[] = [];
  const earlier: ThreadSummary[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const t of threads) {
    const threadDate = new Date(t.updatedAt || t.createdAt).getTime();
    if (threadDate >= startOfToday) {
      today.push(t);
    } else {
      earlier.push(t);
    }
  }

  return { today, earlier };
}

export function formatThreadTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function parseMarkdownCodeBlocks(content: string): {
  mainText: string;
  codeBlocks: string[];
} {
  return parseMarkdownCodeBlocksImpl(content);
}

/* ===========================================================================
 * Re-exports
 *
 * Both of these live in their own modules for good reasons — the parsers are
 * pure, and the chat stream needs `expo/fetch` instead of `apiClient` — but
 * callers should keep importing from `api/study` so there is one obvious place
 * to look for "how does the AI Hub talk to the server".
 * ========================================================================= */

export {
  parseInline,
  parseReplyBlocks,
  parseChartSpec,
  parseGeneratedFileSpec,
} from './replyParsers';
export type {
  ReplyBlock,
  InlineRun,
  ChartSpec,
  GeneratedFileSpec,
} from './replyParsers';

export { sendChatMessage } from './studyStream';
export type {
  ChatStreamHandlers,
  ChatStreamMeta,
  ChatStreamParams,
  ChatResult,
} from './studyStream';
