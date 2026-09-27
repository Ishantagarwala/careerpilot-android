import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline read-through cache.
 *
 * AsyncStorage, NOT SecureStore: this is study content, not credentials, and
 * SecureStore has a small per-item size limit that documents and threads would
 * blow through. Credentials stay in SecureStore (src/auth/storage.ts).
 *
 * Every operation is failure-tolerant — a cache that throws is worse than no
 * cache, because it turns a working network request into a crash.
 */

const PREFIX = 'careerpilot.cache.';

interface Entry<T> {
  value: T;
  /** epoch ms, for staleness display */
  at: number;
}

export async function readCache<T>(key: string): Promise<{ value: T; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.at !== 'number') return null;
    return { value: parsed.value, at: parsed.at };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const entry: Entry<T> = { value, at: Date.now() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* non-fatal */
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    /* non-fatal */
  }
}

/**
 * Fetch with cache fallback.
 *
 * On success the cache is refreshed and `stale` is false. On failure the last
 * known value is returned with `stale: true` and the caller decides how loudly
 * to say so — a stale roadmap is useful, a silently stale one is not.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ value: T | null; stale: boolean; at: number | null; error: unknown }> {
  try {
    const value = await fetcher();
    await writeCache(key, value);
    return { value, stale: false, at: Date.now(), error: null };
  } catch (error) {
    const hit = await readCache<T>(key);
    if (hit) return { value: hit.value, stale: true, at: hit.at, error };
    return { value: null, stale: false, at: null, error };
  }
}

/** Human label for how old a cached value is. */
export function freshness(at: number | null): string {
  if (!at) return '';
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const CacheKeys = {
  threads: 'ai-hub.threads',
  roadmap: 'roadmap',
  recommendations: 'career.recommendations',
  resumes: 'resume.list',
  jobs: 'jobs.list',
  applications: 'jobs.applications',
} as const;
