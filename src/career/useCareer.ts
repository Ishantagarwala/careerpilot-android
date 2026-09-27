import { useCallback, useEffect, useMemo, useState } from 'react';

import { CacheKeys, cached, freshness } from '@/offline/cache';
import { computeProgress, milestoneKey } from './progress';

// Screens import milestoneKey from this module; keep that path working while
// the implementation lives in the testable ./progress module.
export { milestoneKey };
import {
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
  /** true when the shown data came from the offline cache */
  stale: boolean;
  /** 'just now' / '2h ago' — how old the cached value is */
  cachedAt: string;
  reload(): Promise<void>;
  toggleMilestone(milestoneId: string, completed: boolean): Promise<void>;
}

export function useCareer(): CareerState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [cachedAt, setCachedAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Both go through the cache, so an offline launch still shows the last
    // known roadmap instead of an empty screen.
    const [roadmapHit, recsHit] = await Promise.all([
      cached(CacheKeys.roadmap, getRoadmap),
      cached(CacheKeys.recommendations, getRecommendations),
    ]);

    setRoadmap(roadmapHit.value);
    setRecommendations(recsHit.value ?? []);

    const anythingStale = roadmapHit.stale || recsHit.stale;
    setStale(anythingStale);
    setCachedAt(freshness(roadmapHit.at ?? recsHit.at));

    // Only surface an error when there is nothing to show at all. A stale
    // roadmap is useful; covering it with an error banner is not.
    if (!roadmapHit.value && !recsHit.value) {
      const reason = roadmapHit.error ?? recsHit.error;
      if (reason) setError(messageOf(reason));
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
    stale,
    cachedAt,
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


function messageOf(err: unknown): string {
  if (err instanceof Error) {
    return /network|fetch|timeout/i.test(err.message)
      ? 'Could not reach CareerPilot. Check your connection.'
      : err.message;
  }
  return 'Something went wrong.';
}
