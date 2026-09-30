import { apiFetch } from './client';
// Imported for local use AND re-exported, so consumers get one entry point.
// `export type { X } from '...'` alone does not put X in this module's scope.
import type { Difficulty } from './projectsLogic';

export {
  DIFFICULTY_LABELS,
  difficultyLabel,
  seatsRemaining,
} from './projectsLogic';
export type { Difficulty } from './projectsLogic';

/**
 * Projects and team posts for the Build tab.
 *
 * Shapes read from models/ProjectIdea.ts, models/TeamPost.ts and the routes.
 *
 * `GET /api/projects` is mode-dependent and both modes return a bare ARRAY:
 *   ?mode=ideas      -> ProjectIdea[]
 *   ?mode=hackathons -> saved projects
 * With no mode it defaults to ideas. `GET /api/projects/teams` returns a bare
 * TeamPost[] and supports ?hackathonId=.
 */

export interface ProjectIdea {
  _id?: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  careerPaths?: string[];
  technologies?: string[];
  estimatedTime: string;
  features?: string[];
  isAIGenerated?: boolean;
}

export interface TeamPost {
  _id: string;
  title: string;
  description: string;
  lookingFor?: string[];
  teamSize: number;
  currentMembers: number;
  status: 'open' | 'closed';
  contactMethod?: string;
  createdAt?: string;
}

export async function listProjectIdeas(): Promise<ProjectIdea[]> {
  const data = await apiFetch<ProjectIdea[] | { ideas?: ProjectIdea[] }>(
    '/api/projects?mode=ideas',
  );
  if (Array.isArray(data)) return data;
  return data?.ideas ?? [];
}

export async function listTeamPosts(): Promise<TeamPost[]> {
  const data = await apiFetch<TeamPost[] | { posts?: TeamPost[] }>('/api/projects/teams');
  if (Array.isArray(data)) return data;
  return data?.posts ?? [];
}

