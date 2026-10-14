import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface ProjectIdea {
  _id: string;
  title: string;
  description: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  careerPaths?: string[];
  technologies?: string[];
  estimatedTime?: string;
  features?: string[];
  isAIGenerated?: boolean;
  userId?: string;
  createdAt?: string;
}

export interface Hackathon {
  _id: string;
  title: string;
  organizer: string;
  platform: string;
  url: string;
  description: string;
  startDate: string;
  endDate: string;
  mode: 'online' | 'offline' | 'hybrid';
  location?: string;
  prizes?: string;
  themes?: string[];
  status: 'upcoming' | 'active' | 'completed';
}

export interface TeamPost {
  _id: string;
  userId: { _id: string; name?: string; email?: string } | string;
  hackathonId?: any;
  title: string;
  description: string;
  lookingFor: string[];
  teamSize: number;
  currentMembers: number;
  status: 'open' | 'closed';
  contactMethod: string;
  createdAt: string;
}

export interface CreateTeamPostPayload {
  title: string;
  description: string;
  lookingFor: string[];
  teamSize: number;
  contactMethod: string;
  hackathonId?: string;
}

const IDEAS_CACHE_PREFIX = '@careerpilot_project_ideas_cache_';
const HACKATHONS_CACHE_PREFIX = '@careerpilot_hackathons_cache_';
const TEAMS_CACHE_PREFIX = '@careerpilot_teams_cache_';
const TEAM_POST_DRAFT_PREFIX = '@careerpilot_team_post_draft_';

// -------------------------------------------------------------
// Date & Identity Normalization Utilities
// -------------------------------------------------------------

export function normalizeEventId(eventId?: string | null): string | undefined {
  if (!eventId || typeof eventId !== 'string') return undefined;
  const trimmed = eventId.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

export function formatEventDateRange(
  startDate?: string,
  endDate?: string
): { dateString: string; isExpired: boolean; isOngoing: boolean } {
  if (!startDate && !endDate) {
    return {
      dateString: 'Dates provided by organizer',
      isExpired: false,
      isOngoing: false,
    };
  }

  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const isValidStart = start && !isNaN(start.getTime());
  const isValidEnd = end && !isNaN(end.getTime());

  if (!isValidStart && !isValidEnd) {
    return {
      dateString: 'Dates provided by organizer',
      isExpired: false,
      isOngoing: false,
    };
  }

  const isExpired = !!(isValidEnd && end! < now);
  const isOngoing = !!(isValidStart && isValidEnd && start! <= now && end! >= now);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (isValidStart && isValidEnd) {
    const sMonth = months[start!.getUTCMonth()];
    const sDay = start!.getUTCDate();
    const eMonth = months[end!.getUTCMonth()];
    const eDay = end!.getUTCDate();
    const year = end!.getUTCFullYear();

    if (sMonth === eMonth && start!.getUTCFullYear() === end!.getUTCFullYear()) {
      return {
        dateString: `${sMonth} ${sDay} – ${eDay}, ${year}`,
        isExpired,
        isOngoing,
      };
    }

    return {
      dateString: `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`,
      isExpired,
      isOngoing,
    };
  }

  if (isValidStart) {
    const sMonth = months[start!.getUTCMonth()];
    const sDay = start!.getUTCDate();
    const year = start!.getUTCFullYear();
    return {
      dateString: `Starts ${sMonth} ${sDay}, ${year}`,
      isExpired,
      isOngoing,
    };
  }

  const eMonth = months[end!.getUTCMonth()];
  const eDay = end!.getUTCDate();
  const year = end!.getUTCFullYear();
  return {
    dateString: `Ends ${eMonth} ${eDay}, ${year}`,
    isExpired,
    isOngoing,
  };
}

// -------------------------------------------------------------
// Project Ideas API
// -------------------------------------------------------------

export async function fetchProjectIdeas(signal?: AbortSignal): Promise<ProjectIdea[]> {
  const data = await apiClient.get<ProjectIdea[]>('/api/projects', {
    signal,
    timeoutMs: 15000,
  });
  return Array.isArray(data) ? data : [];
}

export async function generateProjectIdeas(signal?: AbortSignal): Promise<ProjectIdea[]> {
  // Allow up to 45s for LLM structured JSON generation
  const data = await apiClient.post<ProjectIdea[]>('/api/projects', {}, {
    signal,
    timeoutMs: 45000,
  });
  return Array.isArray(data) ? data : [];
}

export async function getCachedProjectIdeas(userId: string): Promise<ProjectIdea[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${IDEAS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached project ideas:', err);
  }
  return null;
}

export async function setCachedProjectIdeas(userId: string, data: ProjectIdea[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${IDEAS_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to write cached project ideas:', err);
  }
}

// -------------------------------------------------------------
// Hackathons API
// -------------------------------------------------------------

export async function fetchHackathons(signal?: AbortSignal): Promise<Hackathon[]> {
  const data = await apiClient.get<Hackathon[]>('/api/projects?mode=hackathons', {
    signal,
    timeoutMs: 20000,
  });
  return Array.isArray(data) ? data : [];
}

export async function getCachedHackathons(userId: string): Promise<Hackathon[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${HACKATHONS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached hackathons:', err);
  }
  return null;
}

export async function setCachedHackathons(userId: string, data: Hackathon[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${HACKATHONS_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to write cached hackathons:', err);
  }
}

// -------------------------------------------------------------
// Teams API
// -------------------------------------------------------------

export async function fetchTeamPosts(signal?: AbortSignal): Promise<TeamPost[]> {
  const data = await apiClient.get<TeamPost[]>('/api/projects/teams', {
    signal,
    timeoutMs: 15000,
  });
  return Array.isArray(data) ? data : [];
}

export async function createTeamPost(payload: CreateTeamPostPayload): Promise<TeamPost> {
  return await apiClient.post<TeamPost>('/api/projects/teams', payload, {
    timeoutMs: 15000,
  });
}

export async function getCachedTeamPosts(userId: string): Promise<TeamPost[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${TEAMS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read cached teams:', err);
  }
  return null;
}

export async function setCachedTeamPosts(userId: string, data: TeamPost[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${TEAMS_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to write cached teams:', err);
  }
}

// -------------------------------------------------------------
// Team Post Draft (P32 navigation guard & failure retention)
// -------------------------------------------------------------

export async function getTeamPostDraft(userId: string): Promise<Partial<CreateTeamPostPayload> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${TEAM_POST_DRAFT_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read team post draft:', err);
  }
  return null;
}

export async function setTeamPostDraft(
  userId: string,
  draft: Partial<CreateTeamPostPayload>
): Promise<void> {
  try {
    await AsyncStorage.setItem(`${TEAM_POST_DRAFT_PREFIX}${userId}`, JSON.stringify(draft));
  } catch (err) {
    console.warn('Failed to save team post draft:', err);
  }
}

export async function clearTeamPostDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${TEAM_POST_DRAFT_PREFIX}${userId}`);
  } catch (err) {
    console.warn('Failed to clear team post draft:', err);
  }
}
