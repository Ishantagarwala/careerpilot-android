import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  computeProgress,
  getRecommendations,
  getRoadmap,
  updateProgress,
  type CareerRecommendation,
  type Roadmap,
  type RoadmapProgress,
} from '@/api/career';

/**
 * Career + roadmap state.
 *
 * A hook rather than a provider because Career and Roadmap are sibling tabs that
 * never need to be mounted at once; a provider would keep this data alive for
 * the whole session for no benefit.
 *
 * Milestone toggles are OPTIMISTIC: the checkbox flips immediately and rolls
 * back if the request fails. A progress tap that waits on a round trip feels
 * broken, and this is the app's most-tapped control.
 */
export interface CareerState {
  loading: boolean;
  error: string | null;
  roadmap: Roadmap | null;
  recommendations: CareerRecommendation[];
  selected: CareerRecommendation | null;
  progress: RoadmapProgress;
  /** id of a milestone whose update is in flight */
  pending: string | null;
  reload(): Promise<void>;
  toggleMilestone(milestoneId: string, completed: boolean): Promise<void>;
}

export function useCareer(): CareerState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Recommendations are a nice-to-have; a failure there must not blank the
    // whole screen when the roadmap loaded fine.
    const [roadmapResult, recsResult] = await Promise.allSettled([
      getRoadmap(),
      getRecommendations(),
    ]);

    if (roadmapResult.status === 'fulfilled') {
      setRoadmap(roadmapResult.value);
    } else {
      setRoadmap(null);
    }

    if (recsResult.status === 'fulfilled') {
      setRecommendations(recsResult.value);
    } else {
      setRecommendations([]);
      // Surface it only when the roadmap also failed, otherwise the screen has
      // content and this is background noise.
      if (roadmapResult.status === 'rejected') {
        setError(messageOf(recsResult.reason));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMilestone = useCallback(
    async (milestoneId: string, completed: boolean) => {
      if (pending) return;
      setPending(milestoneId);
      setError(null);

      // Snapshot for rollback.
      const before = roadmap;
      setRoadmap((prev) => prev && patchMilestone(prev, milestoneId, completed));

      try {
        const updated = await updateProgress({ milestoneId, completed });
        // The route returns the whole roadmap, so prefer the server's copy —
        // it may have recomputed currentStage.
        if (updated) setRoadmap(updated);
      } catch (err) {
        setRoadmap(before);
        setError(messageOf(err));
      } finally {
        setPending(null);
      }
    },
    [pending, roadmap],
  );

  const progress = useMemo(() => computeProgress(roadmap), [roadmap]);
  const selected = useMemo(
    () => recommendations.find((r) => r.selected) ?? null,
    [recommendations],
  );

  return {
    loading,
    error,
    roadmap,
    recommendations,
    selected,
    progress,
    pending,
    reload: load,
    toggleMilestone,
  };
}

/** Immutably flip one milestone's `completed` across every stage. */
function patchMilestone(roadmap: Roadmap, milestoneId: string, completed: boolean): Roadmap {
  return {
    ...roadmap,
    stages: roadmap.stages.map((stage) => ({
      ...stage,
      milestones: (stage.milestones ?? []).map((m) =>
        milestoneKey(m) === milestoneId ? { ...m, completed } : m,
      ),
    })),
  };
}

/**
 * A milestone's stable id.
 *
 * The model gives each milestone a Mongo `_id`, but a roadmap generated before
 * that field existed may only have a title — fall back to the title so the
 * control still works rather than silently doing nothing.
 */
export function milestoneKey(milestone: { _id?: string; title: string }): string {
  return milestone._id ?? milestone.title;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    return /network|fetch|timeout/i.test(err.message)
      ? 'Could not reach CareerPilot. Check your connection.'
      : err.message;
  }
  return 'Something went wrong.';
}
