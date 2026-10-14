import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface Milestone {
  _id?: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface RoadmapSubtopic {
  id?: string;
  _id?: string;
  title: string;
  completed?: boolean;
  completedAt?: string | null;
}

export interface RoadmapTopic {
  id?: string;
  _id?: string;
  title: string;
  description?: string;
  type?: 'required' | 'recommended' | 'optional' | 'project' | 'career';
  whyItMatters?: string;
  nonTechTip?: string;
  timeEstimate?: string;
  subtopics?: RoadmapSubtopic[];
  resources?: { title: string; url?: string; type?: string; free?: boolean }[];
  youtubeVideos?: { title: string; channel: string; url: string; duration?: string }[];
  deliverable?: string;
  prerequisites?: string[];
  completed?: boolean;
  completedAt?: string | null;
}

/**
 * Stages carry both the legacy `milestones` list and the richer topic graph.
 * Milestones are still populated, so the milestone UI keeps working, but they
 * are optional here so a topic-only stage is not a type error.
 */
export interface RoadmapStage {
  name: 'beginner' | 'intermediate' | 'advanced';
  title?: string;
  description?: string;
  milestones?: Milestone[];
  topics?: RoadmapTopic[];
}

export interface RoadmapData {
  _id?: string;
  userId?: string;
  careerPath: string;
  overview?: string;
  totalEstimatedWeeks?: string;
  targetRole?: string;
  stages: RoadmapStage[];
  currentStage: 'beginner' | 'intermediate' | 'advanced';
  pathChanged?: boolean;
  selectedCareerPath?: string;
  totalMilestones?: number;
  completedMilestones?: number;
  milestoneCompletionRate?: number;
}

const ROADMAP_CACHE_PREFIX = '@careerpilot_roadmap_cache_';

export function computeRoadmapStats(roadmap: RoadmapData | null | undefined): {
  total: number;
  completed: number;
  percent: number;
} {
  if (!roadmap || !Array.isArray(roadmap.stages)) {
    return { total: 0, completed: 0, percent: 0 };
  }

  let total = 0;
  let completed = 0;

  for (const stage of roadmap.stages) {
    if (Array.isArray(stage.milestones)) {
      for (const m of stage.milestones) {
        total++;
        if (m.completed) {
          completed++;
        }
      }
    }
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

export async function fetchRoadmap(): Promise<RoadmapData | null> {
  try {
    // Normally a cached read, but the route also generates when the cached
    // roadmap predates the topic graph — give it the same budget as a refresh
    // so a first load does not time out mid-generation.
    const res = await apiClient<RoadmapData>('/api/roadmap', {
      method: 'GET',
      timeoutMs: 90000,
    });
    return res;
  } catch (err: any) {
    if (err?.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Regeneration is a GET with ?refresh=1 now: the POST handler is gone and the
 * route answers with the roadmap object directly. Generation runs the LLM, so
 * the client waits longer than it does for a cached read.
 */
export async function generateRoadmap(): Promise<RoadmapData> {
  return await apiClient<RoadmapData>('/api/roadmap?refresh=1', {
    method: 'GET',
    timeoutMs: 90000,
  });
}

export async function updateMilestoneProgress(
  milestoneId: string,
  completed: boolean
): Promise<RoadmapData> {
  const res = await apiClient<{ message: string; roadmap: RoadmapData }>('/api/roadmap/progress', {
    method: 'PUT',
    body: JSON.stringify({ milestoneId, completed }),
    timeoutMs: 15000,
  });
  return res.roadmap;
}

export async function getCachedRoadmap(userId: string): Promise<RoadmapData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ROADMAP_CACHE_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to read cached roadmap:', err);
  }
  return null;
}

export async function setCachedRoadmap(userId: string, data: RoadmapData): Promise<void> {
  try {
    await AsyncStorage.setItem(`${ROADMAP_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache roadmap:', err);
  }
}
