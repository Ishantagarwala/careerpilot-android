import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface RoadmapStageProgress {
  completed: number;
  total: number;
}

export interface HomeProgressData {
  metrics: {
    coursesCompleted: number;
    pdfsAnalyzed: number;
    tutorSessions: number;
    streakDays: number;
    lastActive: string | null;
  };
  roadmap: {
    careerPath: string | null;
    currentStage: string | null;
    totalMilestones: number;
    completedMilestones: number;
    milestoneCompletionRate: number;
    stageProgress: {
      beginner: RoadmapStageProgress;
      intermediate: RoadmapStageProgress;
      advanced: RoadmapStageProgress;
    };
  };
  readinessScore: number;
  isCached?: boolean;
}

export interface ReadinessBreakdown {
  milestoneScore: number;
  milestoneCompletionRate: number;
  coursesScore: number;
  pdfsScore: number;
  tutorScore: number;
  totalScore: number;
}

export function computeReadinessBreakdown(
  data: Pick<HomeProgressData, 'metrics' | 'roadmap'>
): ReadinessBreakdown {
  const milestoneCompletionRate = data.roadmap?.milestoneCompletionRate || 0;
  const milestoneScore = Math.round(milestoneCompletionRate * 0.4);
  const coursesScore = Math.min((data.metrics?.coursesCompleted || 0) * 10, 30);
  const pdfsScore = Math.min((data.metrics?.pdfsAnalyzed || 0) * 5, 15);
  const tutorScore = Math.min((data.metrics?.tutorSessions || 0) * 3, 15);
  const rawTotal = (milestoneCompletionRate * 0.4) + coursesScore + pdfsScore + tutorScore;
  const totalScore = Math.min(Math.floor(rawTotal), 100);

  return {
    milestoneScore,
    milestoneCompletionRate,
    coursesScore,
    pdfsScore,
    tutorScore,
    totalScore,
  };
}

const PROGRESS_CACHE_KEY_PREFIX = '@cache_home_progress_';

export async function getCachedHomeProgress(userId?: string): Promise<HomeProgressData | null> {
  try {
    const key = `${PROGRESS_CACHE_KEY_PREFIX}${userId || 'default'}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, isCached: true };
  } catch {
    return null;
  }
}

export async function setCachedHomeProgress(data: HomeProgressData, userId?: string): Promise<void> {
  try {
    const key = `${PROGRESS_CACHE_KEY_PREFIX}${userId || 'default'}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore cache persistence errors
  }
}

export async function clearCachedHomeProgress(userId?: string): Promise<void> {
  try {
    const key = `${PROGRESS_CACHE_KEY_PREFIX}${userId || 'default'}`;
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore cache removal errors
  }
}

export async function fetchHomeProgress(userId?: string): Promise<HomeProgressData> {
  try {
    // GET /api/progress answers with { metrics, roadmap } only — the readiness
    // score is derived from those numbers on the client, so hydrate it here
    // instead of rendering the 0 an absent field would produce.
    const data = await apiClient.get<Omit<HomeProgressData, 'readinessScore'>>('/api/progress');
    const hydrated: HomeProgressData = {
      ...data,
      readinessScore: computeReadinessBreakdown(data).totalScore,
    };
    await setCachedHomeProgress(hydrated, userId);
    return { ...hydrated, isCached: false };
  } catch (error: any) {
    const cached = await getCachedHomeProgress(userId);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

export type CourseProgressAction = 'complete_course' | 'uncomplete_course';

/**
 * PUT /api/progress now only mutates a bare counter: it has no per-course
 * identity, so it cannot say *which* course was completed. Per-course state is
 * device-local (see api/courses.ts) and this call just keeps the dashboard
 * metric roughly in sync.
 */
export async function trackCourseCompletion(
  action: CourseProgressAction,
  userId?: string
): Promise<number> {
  const res = await apiClient<{ message?: string; coursesCompleted?: number }>('/api/progress', {
    method: 'PUT',
    body: JSON.stringify({ action }),
    timeoutMs: 15000,
  });

  // The counter moved, so any cached home payload is stale.
  await clearCachedHomeProgress(userId);

  return typeof res?.coursesCompleted === 'number' ? res.coursesCompleted : 0;
}

export function getInitialNewAccountProgress(): HomeProgressData {
  return {
    metrics: {
      coursesCompleted: 0,
      pdfsAnalyzed: 0,
      tutorSessions: 0,
      streakDays: 0,
      lastActive: null,
    },
    roadmap: {
      careerPath: null,
      currentStage: null,
      totalMilestones: 0,
      completedMilestones: 0,
      milestoneCompletionRate: 0,
      stageProgress: {
        beginner: { completed: 0, total: 0 },
        intermediate: { completed: 0, total: 0 },
        advanced: { completed: 0, total: 0 },
      },
    },
    readinessScore: 0,
  };
}
