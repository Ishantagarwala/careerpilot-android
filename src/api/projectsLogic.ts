/**
 * Pure helpers for the Projects panel.
 *
 * Split from `api/projects.ts` because that module imports the API client and
 * therefore expo-constants, which cannot load under `node --test`.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TeamPostSeatInfo {
  teamSize: number;
  currentMembers: number;
}

/**
 * Open seats on a team post.
 *
 * Clamped at zero because the model allows `currentMembers` to reach `teamSize`
 * and a roster edited outside this flow could exceed it. "-1 spots" on a card is
 * worse than "Full".
 */
export function seatsRemaining(post: TeamPostSeatInfo): number {
  return Math.max(0, post.teamSize - post.currentMembers);
}

/** Human label for difficulty, kept beside the enum so they cannot drift. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/**
 * Label for a difficulty the API returned.
 *
 * Falls back to the raw value rather than printing "undefined" if the server
 * ever adds a level the client does not know about.
 */
export function difficultyLabel(value: string): string {
  return DIFFICULTY_LABELS[value as Difficulty] ?? value;
}
