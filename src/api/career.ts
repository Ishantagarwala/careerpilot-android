import { apiFetch, ApiError } from './client';

/**
 * Career + roadmap API.
 *
 * Field names and response envelopes are read from the web app's models and
 * routes — models/CareerRecommendation.ts, models/Roadmap.ts,
 * app/api/career/* and app/api/roadmap/*. Notably:
 *
 *   career/recommendations -> a bare ARRAY of recommendations (not wrapped)
 *   roadmap                -> a bare Roadmap document (not wrapped)
 *   roadmap/progress       -> { message, roadmap }
 *
 * Changing any of those envelopes is a breaking client change
 * (design/API_CONTRACT.md §2.3).
 */

/* -------------------------------------------------------------------------- */
/* Career recommendations                                                     */
/* -------------------------------------------------------------------------- */

export interface CareerRecommendation {
  _id: string;
  careerPath: string;
  /** 0-100 AI compatibility score */
  matchScore?: number;
  reasoning?: string;
  selected: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Returns a bare array; normalised here so callers never see the difference. */
export async function getRecommendations(): Promise<CareerRecommendation[]> {
  const data = await apiFetch<CareerRecommendation[] | { recommendations?: CareerRecommendation[] }>(
    '/api/career/recommendations',
  );
  if (Array.isArray(data)) return data;
  return data.recommendations ?? [];
}

/** The recommendation the user pinned as their direction, if any. */
export async function getSelectedCareer(): Promise<CareerRecommendation | null> {
  const all = await getRecommendations();
  return all.find((r) => r.selected) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Roadmap                                                                    */
/* -------------------------------------------------------------------------- */

export interface Subtopic {
  id?: string;
  title: string;
  completed: boolean;
}

export type TopicType = 'required' | 'recommended' | 'optional' | 'project' | 'career';

export interface RoadmapTopic {
  id: string;
  title: string;
  description: string;
  type?: TopicType;
  whyItMatters?: string;
  timeEstimate?: string;
  subtopics?: Subtopic[];
  completed: boolean;
}

export interface Milestone {
  _id?: string;
  title: string;
  completed: boolean;
  completedAt?: string | null;
}

export interface RoadmapStage {
  name: 'beginner' | 'intermediate' | 'advanced';
  title?: string;
  description?: string;
  milestones: Milestone[];
  topics?: RoadmapTopic[];
}

export interface Roadmap {
  _id?: string;
  careerPath: string;
  overview?: string;
  totalEstimatedWeeks?: string;
  targetRole?: string;
  stages: RoadmapStage[];
  currentStage: 'beginner' | 'intermediate' | 'advanced';
  updatedAt?: string;
}

/**
 * Fetch the roadmap.
 *
 * `refresh=1` asks the server to regenerate it with the LLM, which is slow and
 * costs a model call — only pass it from an explicit user action.
 *
 * Throws on failure rather than returning null: the offline cache needs to SEE
 * the failure so it can fall back to a stored roadmap. Callers that treat "no
 * roadmap yet" as normal go through `cached()`, which returns null for both a
 * missing roadmap and an unreachable server — the 404 case is handled here.
 */
export async function getRoadmap(options: { refresh?: boolean } = {}): Promise<Roadmap | null> {
  const path = options.refresh ? '/api/roadmap?refresh=1' : '/api/roadmap';
  try {
    return await apiFetch<Roadmap>(path);
  } catch (err) {
    // A 404 means no roadmap has been generated yet — a real answer, not a
    // failure, and caching it would pin an empty state.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Mark a milestone complete/incomplete. Only the id of one of the two is sent. */
export async function updateProgress(input: {
  topicId?: string;
  milestoneId?: string;
  completed?: boolean;
  subtopicId?: string;
}): Promise<Roadmap | null> {
  const data = await apiFetch<{ roadmap?: Roadmap }>('/api/roadmap/progress', {
    method: 'POST',
    body: {
      topicId: input.topicId,
      milestoneId: input.milestoneId,
      subtopicId: input.subtopicId,
      completed: input.completed,
    },
  });
  return data.roadmap ?? null;
}

/* -------------------------------------------------------------------------- */
/* Derived progress                                                           */
/* -------------------------------------------------------------------------- */

export interface RoadmapProgress {
  completed: number;
  total: number;
  /** 0..1 */
  ratio: number;
  /** the first incomplete milestone, i.e. what to do next */
  next: { milestone: Milestone; stage: RoadmapStage } | null;
}

/**
 * Progress is derived on the client.
 *
 * The model has no aggregate counter, and computing it from the document we
 * already hold avoids a second request. Milestones are the unit the mockup
 * shows ("5 of 13 milestones complete").
 */
export function computeProgress(roadmap: Roadmap | null): RoadmapProgress {
  if (!roadmap?.stages?.length) return { completed: 0, total: 0, ratio: 0, next: null };

  let completed = 0;
  let total = 0;
  let next: RoadmapProgress['next'] = null;

  for (const stage of roadmap.stages) {
    for (const milestone of stage.milestones ?? []) {
      total++;
      if (milestone.completed) {
        completed++;
      } else if (!next) {
        next = { milestone, stage };
      }
    }
  }

  return { completed, total, ratio: total ? completed / total : 0, next };
}
