/**
 * Roadmap progress maths.
 *
 * Split out of `api/career.ts` because that module imports the API client,
 * which pulls in `expo-constants` and cannot run under `node --test`. Keeping
 * the derivation here means it is unit-tested against real edge cases instead
 * of being first exercised on a device.
 *
 * Types are declared structurally so this file has no imports at all.
 */

export interface ProgressMilestone {
  _id?: string;
  title: string;
  completed: boolean;
}

export interface ProgressStage {
  name: string;
  title?: string;
  milestones?: ProgressMilestone[];
}

export interface ProgressRoadmap {
  stages?: ProgressStage[];
}

export interface RoadmapProgress {
  completed: number;
  total: number;
  /** 0..1 — 0 when there are no milestones, never NaN */
  ratio: number;
  /** the first incomplete milestone, i.e. what to do next */
  next: { milestone: ProgressMilestone; stage: ProgressStage } | null;
}

/**
 * Milestones are the unit the UI counts ("5 of 13 milestones complete"), and
 * the model carries no aggregate counter, so it is derived here.
 */
export function computeProgress(roadmap: ProgressRoadmap | null | undefined): RoadmapProgress {
  const stages = roadmap?.stages;
  if (!stages?.length) return { completed: 0, total: 0, ratio: 0, next: null };

  let completed = 0;
  let total = 0;
  let next: RoadmapProgress['next'] = null;

  for (const stage of stages) {
    for (const milestone of stage.milestones ?? []) {
      total++;
      if (milestone.completed) {
        completed++;
      } else if (!next) {
        next = { milestone, stage };
      }
    }
  }

  // Guard total === 0 as well: a roadmap whose stages have no milestones would
  // otherwise produce 0/0 = NaN and render as "NaN%".
  return { completed, total, ratio: total ? completed / total : 0, next };
}

/**
 * A milestone's stable identity.
 *
 * The model normally gives a Mongo `_id`, but a roadmap generated before that
 * field existed may only carry a title. Falling back to the title keeps the
 * completion control working instead of silently doing nothing.
 *
 * Note the consequence: two milestones with the same title in one roadmap are
 * indistinguishable. That is a data problem, and the alternative — a control
 * that cannot address its own milestone — is worse.
 */
export function milestoneKey(milestone: { _id?: string; title: string }): string {
  return milestone._id ?? milestone.title;
}
