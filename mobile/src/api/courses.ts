import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';
import { trackCourseCompletion } from './progress';

export interface CourseItem {
  _id: string;
  title: string;
  platform: string;
  url: string;
  careerPath: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  isFree: boolean;
  rating?: number;
  /** Roadmap milestone the course was sourced for. */
  sourceTopic?: string;
  thumbnailUrl?: string;
  /** `youtube:<videoId>` for a real video, `youtube-search:…` for a search deep link. */
  externalId?: string;
  roadmapHash?: string;
  fetchedAt?: string;
}

export interface CoursesMeta {
  careerPath: string;
  roadmapHash: string;
  source: 'live' | 'cache' | string;
  youtubeEnabled: boolean;
  youtubeCount?: number;
  liveYouTubeCount?: number;
  topicCount?: number;
  topicOrder?: string[];
}

export interface CoursesResult {
  courses: CourseItem[];
  meta: CoursesMeta | null;
}

export interface CourseFilter {
  level?: 'all' | 'beginner' | 'intermediate' | 'advanced';
  budget?: 'all' | 'free' | 'paid';
}

const COURSES_CACHE_PREFIX = '@careerpilot_courses_cache_';
const COMPLETIONS_CACHE_PREFIX = '@careerpilot_completions_cache_';

/**
 * GET /api/courses answers `{ courses, meta }`; courses are sourced live and
 * keyed to the roadmap, so there is no per-course completion in the payload.
 */
export async function fetchCourses(
  filters: CourseFilter = {},
  signal?: AbortSignal
): Promise<CoursesResult> {
  const params = new URLSearchParams();
  if (filters.level && filters.level !== 'all') {
    params.set('level', filters.level);
  }
  if (filters.budget && filters.budget !== 'all') {
    params.set('budget', filters.budget);
  }

  const query = params.toString();
  const path = query ? `/api/courses?${query}` : '/api/courses';

  const res = await apiClient<{ courses?: CourseItem[]; meta?: CoursesMeta | null }>(path, {
    method: 'GET',
    signal,
    timeoutMs: 25000,
  });

  return {
    courses: Array.isArray(res?.courses) ? res.courses : [],
    meta: res?.meta ?? null,
  };
}

export interface CoursesBlockedReason {
  code: 'NO_ROADMAP' | 'NO_CAREER_PATH';
  message: string;
}

/**
 * Courses cannot be recommended before the user has a roadmap. The route says
 * so with a 404 — `NO_ROADMAP` when a career path is selected but no roadmap
 * has been generated, and an uncoded 404 when no career path is selected at
 * all. Callers render a "generate a roadmap" state for both instead of an
 * empty list.
 */
export function getCoursesBlockedReason(err: unknown): CoursesBlockedReason | null {
  const apiError = err as
    | { status?: number; data?: { code?: string; message?: string } }
    | null
    | undefined;

  if (apiError?.status !== 404) return null;

  return {
    code: apiError.data?.code === 'NO_ROADMAP' ? 'NO_ROADMAP' : 'NO_CAREER_PATH',
    message:
      apiError.data?.message ||
      'Generate a roadmap for your career path before courses can be recommended.',
  };
}

/**
 * Per-course completion is tracked on the device now (the backend only keeps a
 * bare counter), so this reads the user-scoped local set.
 */
export async function fetchCompletions(userId: string): Promise<string[]> {
  const cached = await getCachedCompletions(userId);
  return cached ?? [];
}

/**
 * Persists the completed-course set locally and notifies the backend with the
 * identity-free `complete_course` / `uncomplete_course` action so the
 * dashboard counter stays roughly right.
 */
export async function toggleCourseCompletion(
  userId: string,
  courseId: string,
  completed: boolean
): Promise<{ completed: boolean; completedIds: string[] }> {
  const current = (await getCachedCompletions(userId)) ?? [];
  const next = completed
    ? Array.from(new Set([...current, courseId]))
    : current.filter((id) => id !== courseId);

  await trackCourseCompletion(
    completed ? 'complete_course' : 'uncomplete_course',
    userId
  );
  await setCachedCompletions(userId, next);

  return { completed, completedIds: next };
}

export async function getCachedCourses(userId: string): Promise<CourseItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${COURSES_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached courses:', err);
  }
  return null;
}

export async function setCachedCourses(userId: string, data: CourseItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${COURSES_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache courses:', err);
  }
}

export async function getCachedCompletions(userId: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${COMPLETIONS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached completions:', err);
  }
  return null;
}

export async function setCachedCompletions(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${COMPLETIONS_CACHE_PREFIX}${userId}`, JSON.stringify(ids));
  } catch (err) {
    console.warn('Failed to cache completions:', err);
  }
}
