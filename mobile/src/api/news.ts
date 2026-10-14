import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface NewsArticle {
  _id: string;
  title: string;
  summary: string;
  content?: string;
  publishedAt: string;
  readTime: string;
  tags: string[];
  category: 'Featured' | 'Live Feed' | 'In-Depth Analysis' | string;
  imageUrl?: string;
  imageAlt?: string;
  sourceUrl?: string;
  source?: string;
  fetchedAt?: string;
}

export interface NewsFeed {
  articles: NewsArticle[];
  /** Domain id the feed was curated for (technology, healthcare, …). */
  domain: string | null;
  /** Human label for that domain. */
  domainLabel: string | null;
}

export interface CachedNewsPayload {
  items: NewsArticle[];
  cachedAt: number;
}

const NEWS_CACHE_PREFIX = '@careerpilot_news_cache_';
const LAST_REFRESH_PREFIX = '@careerpilot_news_last_refresh_';

// Bound refresh frequency: minimum 10 seconds between background cache invalidations
const MIN_REFRESH_INTERVAL_MS = 10000;

export function formatNewsRelativeTime(dateString?: string): string {
  if (!dateString) return 'Recent';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recent';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
}

export function formatNewsFreshness(cachedAt?: number): { label: string; isLive: boolean } {
  if (!cachedAt) {
    return { label: 'Cached', isLive: false };
  }
  const diffMs = Date.now() - cachedAt;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 2) {
    return { label: 'Live feed', isLive: true };
  }
  if (diffMin < 60) {
    return { label: `Updated ${diffMin}m ago`, isLive: false };
  }
  const diffHour = Math.floor(diffMin / 60);
  return { label: `Saved · Updated ${diffHour}h ago`, isLive: false };
}

export async function fetchNewsFeed(
  options: { tag?: string; query?: string; forceRefresh?: boolean } = {},
  signal?: AbortSignal
): Promise<NewsFeed> {
  const queryParams = new URLSearchParams();
  if (options.tag && options.tag.toLowerCase() !== 'all') {
    queryParams.set('tag', options.tag);
  }
  if (options.query) {
    queryParams.set('q', options.query.trim());
  }

  // Guard against hammering refresh
  if (options.forceRefresh) {
    try {
      const last = await AsyncStorage.getItem(LAST_REFRESH_PREFIX);
      const lastTime = last ? parseInt(last, 10) : 0;
      if (Date.now() - lastTime > MIN_REFRESH_INTERVAL_MS) {
        queryParams.set('refresh', 'true');
        await AsyncStorage.setItem(LAST_REFRESH_PREFIX, Date.now().toString());
      }
    } catch {
      queryParams.set('refresh', 'true');
    }
  }

  const qs = queryParams.toString();
  const path = qs ? `/api/news?${qs}` : '/api/news';

  // GET /api/news answers { domain, domainLabel, articles }.
  const data = await apiClient.get<{
    articles?: NewsArticle[];
    domain?: string;
    domainLabel?: string;
  }>(path, {
    signal,
    timeoutMs: 15000,
  });

  return {
    articles: Array.isArray(data?.articles) ? data.articles : [],
    domain: data?.domain ?? null,
    domainLabel: data?.domainLabel ?? null,
  };
}

/** Convenience for callers that only render the articles. */
export async function fetchNewsArticles(
  options: { tag?: string; query?: string; forceRefresh?: boolean } = {},
  signal?: AbortSignal
): Promise<NewsArticle[]> {
  const feed = await fetchNewsFeed(options, signal);
  return feed.articles;
}

export async function getCachedNews(userId: string): Promise<CachedNewsPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(`${NEWS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached news:', err);
  }
  return null;
}

export async function setCachedNews(userId: string, items: NewsArticle[]): Promise<void> {
  try {
    const payload: CachedNewsPayload = {
      items,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(`${NEWS_CACHE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to write cached news:', err);
  }
}
