import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface AssessmentSkill {
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface AssessmentDraft {
  interests: string[];
  goals: string;
  subjects: string[];
  skills: AssessmentSkill[];
  lastUpdated?: number;
}

export interface CareerRecommendation {
  _id: string;
  userId?: string;
  careerPath: string;
  matchScore: number;
  reasoning: string;
  selected: boolean;
}

const DRAFT_PREFIX = '@careerpilot_assessment_draft_';
const RECOMMENDATIONS_CACHE_PREFIX = '@careerpilot_recommendations_cache_';

export const DEFAULT_ASSESSMENT_DRAFT: AssessmentDraft = {
  interests: ['Software engineering', 'Web development'],
  goals:
    'I want to become a software engineer and build useful products. I enjoy solving problems and want to get ready for an internship.',
  subjects: ['Programming', 'Data structures'],
  skills: [{ name: 'Python', level: 'Beginner' }],
};

export async function getAssessmentDraft(userId: string): Promise<AssessmentDraft> {
  try {
    const raw = await AsyncStorage.getItem(`${DRAFT_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        interests: Array.isArray(parsed.interests) ? parsed.interests : DEFAULT_ASSESSMENT_DRAFT.interests,
        goals: typeof parsed.goals === 'string' ? parsed.goals : DEFAULT_ASSESSMENT_DRAFT.goals,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : DEFAULT_ASSESSMENT_DRAFT.subjects,
        skills: Array.isArray(parsed.skills) ? parsed.skills : DEFAULT_ASSESSMENT_DRAFT.skills,
        lastUpdated: parsed.lastUpdated || Date.now(),
      };
    }
  } catch (err) {
    console.warn('Failed to load assessment draft from storage:', err);
  }
  return { ...DEFAULT_ASSESSMENT_DRAFT };
}

export async function saveAssessmentDraft(
  userId: string,
  partial: Partial<AssessmentDraft>
): Promise<AssessmentDraft> {
  const current = await getAssessmentDraft(userId);
  const updated: AssessmentDraft = {
    ...current,
    ...partial,
    lastUpdated: Date.now(),
  };
  try {
    await AsyncStorage.setItem(`${DRAFT_PREFIX}${userId}`, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save assessment draft to storage:', err);
  }
  return updated;
}

export async function clearAssessmentDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${DRAFT_PREFIX}${userId}`);
  } catch (err) {
    console.warn('Failed to clear assessment draft from storage:', err);
  }
}

export async function submitAssessment(draft: AssessmentDraft): Promise<CareerRecommendation[]> {
  const payload = {
    interests: draft.interests,
    goals: draft.goals,
    subjects: draft.subjects,
    skills: draft.skills.map((s) => ({
      name: s.name.trim(),
      level: s.level.toLowerCase(),
    })),
  };

  // Allow up to 45 seconds for AI recommendation generation
  const res = await apiClient<{ recommendations: CareerRecommendation[] }>('/api/career/assess', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 45000,
  });

  return res.recommendations || [];
}

export async function fetchRecommendations(): Promise<CareerRecommendation[]> {
  const res = await apiClient<CareerRecommendation[]>('/api/career/recommendations', {
    method: 'GET',
    timeoutMs: 15000,
  });
  return Array.isArray(res) ? res : [];
}

export async function selectCareerPath(recommendationId: string): Promise<CareerRecommendation> {
  const res = await apiClient<{ recommendation: CareerRecommendation }>('/api/career/select', {
    method: 'POST',
    body: JSON.stringify({ recommendationId }),
    timeoutMs: 15000,
  });
  return res.recommendation;
}

export async function getCachedRecommendations(
  userId: string
): Promise<CareerRecommendation[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${RECOMMENDATIONS_CACHE_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to read cached recommendations:', err);
  }
  return null;
}

export async function setCachedRecommendations(
  userId: string,
  data: CareerRecommendation[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${RECOMMENDATIONS_CACHE_PREFIX}${userId}`,
      JSON.stringify(data)
    );
  } catch (err) {
    console.warn('Failed to cache recommendations:', err);
  }
}
