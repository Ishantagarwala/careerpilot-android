import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface ActiveCurriculumItem {
  title: string;
  platform: string;
  progress: number;
  estCompletion: string;
}

export interface FutureGoals {
  shortTerm: string[];
  longTerm: string[];
}

export interface UserProfileData {
  name: string;
  email: string;
  image?: string | null;
  currentCourse: string;
  activeCurriculum: ActiveCurriculumItem[];
  futureGoals: FutureGoals;
  goals?: string;
  interests?: string[];
  subjects?: string[];
  skills?: { name: string; level: 'beginner' | 'intermediate' | 'advanced' }[];
}

export const PROFILE_CACHE_PREFIX = '@profile_cache_';
export const PROFILE_DRAFT_PREFIX = '@profile_draft_';

export const DEFAULT_INITIAL_PROFILE: UserProfileData = {
  name: 'Aritra',
  email: 'student@example.com',
  currentCourse: 'Computer science student',
  activeCurriculum: [
    {
      title: 'Database systems',
      platform: 'Self-paced',
      progress: 40,
      estCompletion: '40% complete',
    },
  ],
  futureGoals: {
    shortTerm: [
      'Build a full-stack project.',
      'Prepare for a software internship.',
    ],
    longTerm: [],
  },
  goals: 'Build a full-stack project.\nPrepare for a software internship.',
};

async function readCachedProfile(userId: string): Promise<UserProfileData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore cache read errors
  }
  return null;
}

/**
 * Fetch profile data with offline cache fallback.
 */
export async function fetchProfile(
  userId: string,
  fallbackUser?: { name?: string; email?: string }
): Promise<UserProfileData> {
  const cacheKey = `${PROFILE_CACHE_PREFIX}${userId}`;

  try {
    const data = await apiClient<UserProfileData>('/api/profile');
    if (data && data.name) {
      // Normalize curriculum and goals arrays
      const normalized: UserProfileData = {
        name: data.name || fallbackUser?.name || 'Aritra',
        email: data.email || fallbackUser?.email || 'student@example.com',
        image: data.image || null,
        currentCourse: data.currentCourse || '',
        activeCurriculum: Array.isArray(data.activeCurriculum) ? data.activeCurriculum : [],
        futureGoals: {
          shortTerm: Array.isArray(data.futureGoals?.shortTerm) ? data.futureGoals.shortTerm : [],
          longTerm: Array.isArray(data.futureGoals?.longTerm) ? data.futureGoals.longTerm : [],
        },
        goals: data.goals || '',
        interests: data.interests || [],
        subjects: data.subjects || [],
        skills: data.skills || [],
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(normalized)).catch(() => {});
      return normalized;
    }
  } catch (err) {
    // Attempt cache restoration on network failure or offline
    const cached = await readCachedProfile(userId);
    if (cached) {
      return cached;
    }
  }

  // Default fallback matching approved mockup
  return {
    ...DEFAULT_INITIAL_PROFILE,
    name: fallbackUser?.name || DEFAULT_INITIAL_PROFILE.name,
    email: fallbackUser?.email || DEFAULT_INITIAL_PROFILE.email,
  };
}

/**
 * Save profile changes to server and local cache.
 *
 * PUT /api/profile accepts only name/currentCourse/activeCurriculum/futureGoals
 * (the `goals` field is not part of the schema any more — the web app derives a
 * goal list from futureGoals.shortTerm), and it resets any of those fields that
 * are omitted. It also answers with only that narrow slice, so the response is
 * merged into the cached profile instead of being written straight back: a
 * partial object in AsyncStorage would drop email, image, interests, subjects
 * and skills, and the next offline load would look like a new account.
 */
export async function updateProfile(
  payload: {
    name?: string;
    currentCourse?: string;
    activeCurriculum?: ActiveCurriculumItem[];
    futureGoals?: FutureGoals;
    /** Cache-only; never sent to the server. */
    goals?: string;
  },
  userId: string
): Promise<UserProfileData> {
  const cacheKey = `${PROFILE_CACHE_PREFIX}${userId}`;
  const { goals, ...changes } = payload;

  // Fall back to an empty profile, not the demo defaults: this object is merged
  // into what gets cached, and placeholder identity data would then survive as
  // the user's offline profile.
  const base: UserProfileData = (await readCachedProfile(userId)) ?? {
    name: '',
    email: '',
    image: null,
    currentCourse: '',
    activeCurriculum: [],
    futureGoals: { shortTerm: [], longTerm: [] },
    goals: '',
    interests: [],
    subjects: [],
    skills: [],
  };

  const serverPayload = {
    currentCourse: changes.currentCourse ?? base.currentCourse,
    activeCurriculum: changes.activeCurriculum ?? base.activeCurriculum,
    futureGoals: changes.futureGoals ?? base.futureGoals,
    ...(changes.name !== undefined ? { name: changes.name } : {}),
  };

  const res = await apiClient.put<{ message: string; profile: Partial<UserProfileData> }>(
    '/api/profile',
    serverPayload
  );

  const saved = res?.profile || {};

  const savedProfile: UserProfileData = {
    ...base,
    name: saved.name ?? serverPayload.name ?? base.name,
    currentCourse: saved.currentCourse ?? serverPayload.currentCourse,
    activeCurriculum: saved.activeCurriculum ?? serverPayload.activeCurriculum,
    futureGoals: saved.futureGoals ?? serverPayload.futureGoals,
    goals: goals ?? base.goals,
  };

  // Persist the complete profile to cache
  await AsyncStorage.setItem(cacheKey, JSON.stringify(savedProfile)).catch(() => {});

  // Clear any existing pending draft on confirmed server save
  await clearProfileDraft(userId);

  return savedProfile;
}

/**
 * Retrieve pending profile draft from local device storage
 */
export async function getProfileDraft(userId: string): Promise<Partial<UserProfileData> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PROFILE_DRAFT_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore draft parse errors
  }
  return null;
}

/**
 * Save profile draft to local device storage for crash / failure survival
 */
export async function saveProfileDraft(
  userId: string,
  draft: Partial<UserProfileData>
): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PROFILE_DRAFT_PREFIX}${userId}`, JSON.stringify(draft));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Remove local profile draft
 */
export async function clearProfileDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PROFILE_DRAFT_PREFIX}${userId}`);
  } catch {
    // Ignore
  }
}

/**
 * Permanently delete user account and all remote records
 */
export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/api/profile');
}

/**
 * Clear local offline storage, caches and drafts without deleting cloud data.
 */
export async function clearLocalDeviceCache(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  // The @careerpilot_* prefixes below are the keys the api modules actually
  // write today; the shorter legacy prefixes are kept so caches written by older
  // builds are cleared too. Theme mode and notification permission also start
  // with @careerpilot_ and are deliberately not matched.
  const cacheKeys = allKeys.filter(
    (k) =>
      k.startsWith(PROFILE_CACHE_PREFIX) ||
      k.startsWith(PROFILE_DRAFT_PREFIX) ||
      k.startsWith('@careerpilot_courses_cache_') ||
      k.startsWith('@careerpilot_completions_cache_') ||
      k.startsWith('@careerpilot_roadmap_cache_') ||
      k.startsWith('@careerpilot_news_cache_') ||
      k.startsWith('@careerpilot_news_last_refresh_') ||
      k.startsWith('@careerpilot_resumes_cache_') ||
      k.startsWith('@careerpilot_resume_draft_') ||
      k.startsWith('@careerpilot_ats_draft_') ||
      k.startsWith('@careerpilot_project_ideas_cache_') ||
      k.startsWith('@careerpilot_hackathons_cache_') ||
      k.startsWith('@careerpilot_teams_cache_') ||
      k.startsWith('@careerpilot_team_post_draft_') ||
      k.startsWith('@careerpilot_assessment_draft_') ||
      k.startsWith('@careerpilot_recommendations_cache_') ||
      k.startsWith('@custom_job_draft_') ||
      k.startsWith('@draft_') ||
      k.startsWith('@cache_') ||
      k.startsWith('@focus_') ||
      k.startsWith('@resumes_') ||
      k.startsWith('@resume_') ||
      k.startsWith('@ats_') ||
      k.startsWith('@study_') ||
      k.startsWith('@courses_') ||
      k.startsWith('@completions_') ||
      k.startsWith('@recommendations_') ||
      k.startsWith('@roadmap_') ||
      k.startsWith('@news_') ||
      k.startsWith('@todo_') ||
      k.startsWith('@projects_')
  );

  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}
