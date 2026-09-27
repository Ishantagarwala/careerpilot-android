import { apiFetch } from './client';

/**
 * Career assessment.
 *
 * Shapes read from app/api/career/assess/route.ts and niche-catalog/route.ts.
 *
 * POST /assess requires all four of interests, goals, subjects and skills — the
 * route answers 400 without them — and returns the generated recommendations.
 * It is also rate limited twice over: 10 per IP per hour, and an LLM budget of
 * 5 per user per hour costing 2 calls each. That is why the client must confirm
 * before submitting rather than firing on a stray tap.
 *
 * GET /assess returns the saved UserProfile, or null when the user has never
 * assessed. Null is a normal first-run state, not an error.
 */

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface SkillItem {
  name: string;
  level: SkillLevel;
}

/**
 * Mirrors CAREER_DOMAINS in lib/careerDomains.ts — all nine, in the same order.
 * Getting this wrong is silent: the server falls back to inferring a domain
 * from the answers, so a typo produces a plausible but unintended result rather
 * than an error.
 */
export const CAREER_DOMAINS = [
  'technology',
  'healthcare',
  'business',
  'design',
  'law',
  'education',
  'science',
  'engineering',
  'other',
] as const;

export type CareerDomain = (typeof CAREER_DOMAINS)[number];

/** Labels as the web app presents them, so the two do not diverge. */
export const DOMAIN_LABELS: Record<CareerDomain, string> = {
  technology: 'Technology',
  healthcare: 'Healthcare',
  business: 'Business & Finance',
  design: 'Design & Creative',
  law: 'Law & Public Policy',
  education: 'Education & Teaching',
  science: 'Science & Research',
  engineering: 'Core Engineering',
  other: 'Other / Niche Path',
};

export interface AssessmentAnswers {
  careerDomain?: CareerDomain;
  careerNiche?: string;
  interests: string[];
  goals: string;
  subjects: string[];
  skills: SkillItem[];
}

export interface AssessedRecommendation {
  _id: string;
  careerPath: string;
  matchScore?: number;
  reasoning?: string;
  selected: boolean;
}

export interface AssessResult {
  recommendations: AssessedRecommendation[];
  /** false when a re-assessment dropped a previously pinned direction */
  selectionPreserved: boolean;
}

/** The saved profile. Only the fields this app reads are typed. */
export interface AssessmentProfile {
  interests?: string[];
  goals?: string;
  subjects?: string[];
  skills?: SkillItem[];
  careerDomain?: string;
  careerNiche?: string;
}

export async function getAssessmentProfile(): Promise<AssessmentProfile | null> {
  return apiFetch<AssessmentProfile | null>('/api/career/assess');
}

/**
 * Run the assessment.
 *
 * Long-running (two model calls) and budgeted, so the caller must show progress
 * and never retry automatically.
 */
export async function runAssessment(answers: AssessmentAnswers): Promise<AssessResult> {
  const data = await apiFetch<{
    recommendations?: AssessedRecommendation[];
    selectionPreserved?: boolean;
  }>('/api/career/assess', {
    method: 'POST',
    body: {
      careerDomain: answers.careerDomain,
      // Omitted rather than sent as an empty string: the route trims and treats
      // empty as absent, and an explicit undefined keeps the payload honest.
      careerNiche: answers.careerNiche?.trim() || undefined,
      interests: answers.interests,
      goals: answers.goals,
      subjects: answers.subjects,
      skills: answers.skills,
    },
  });

  return {
    recommendations: data.recommendations ?? [],
    selectionPreserved: data.selectionPreserved ?? true,
  };
}

export interface NicheCatalog {
  interests: string[];
  subjects: string[];
  skills: string[];
}

/**
 * Generate suggestions for a niche the built-in domains do not cover.
 *
 * This is what makes the assessment usable for a student aiming at something
 * specific — hotel management, commercial pilot, organic farming — rather than
 * only the eight hard-coded domains.
 */
export async function generateNicheCatalog(niche: string): Promise<NicheCatalog> {
  const data = await apiFetch<Partial<NicheCatalog>>('/api/career/niche-catalog', {
    method: 'POST',
    body: { niche: niche.trim() },
  });
  return {
    interests: data.interests ?? [],
    subjects: data.subjects ?? [],
    skills: data.skills ?? [],
  };
}
