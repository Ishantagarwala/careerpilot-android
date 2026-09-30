import { apiFetch } from './client';

/**
 * Resume, ATS and jobs API for the Build tab.
 *
 * Shapes read from models/Resume.ts, models/JobListing.ts and the routes.
 * Envelopes differ per route and are easy to get wrong:
 *
 *   resume                    -> bare ARRAY
 *   resume/ats-analyze        -> the ATS result spread, plus careerDomain
 *   jobs                      -> { jobs, meta }
 *   jobs/applications         -> bare ARRAY
 *   resume/[id]/match-jd      -> { matchScore, matchedKeywords, missingKeywords,
 *                                  recommendedEdits, summary }
 */

/* -------------------------------------------------------------------------- */
/* Resume                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The ATS result. Field names are fixed by the product schema — the LLM prompt
 * in lib/resume.ts pins them.
 *
 * The `legacy` block (keywordDensity/formatting/readability/impact) is absent on
 * analyses produced by the current HackerRank rubric, so every read of it must
 * be optional.
 */
export interface AtsAnalysis {
  score: number;
  openSource?: number;
  selfProjects?: number;
  production?: number;
  technicalSkills?: number;
  bonus?: number;
  deductions?: number;
  tier?: string;
  summary?: string;
  strengths?: string[];
  suggestions?: string[];
  bonusItems?: string[];
  deductionItems?: string[];
  evidence?: {
    openSource?: string[];
    selfProjects?: string[];
    production?: string[];
    technicalSkills?: string[];
  };
  analyzedAt?: string;
}

export interface Resume {
  _id: string;
  title: string;
  template?: string;
  isActive?: boolean;
  atsAnalysis?: AtsAnalysis;
  updatedAt?: string;
}

export async function listResumes(): Promise<Resume[]> {
  const data = await apiFetch<Resume[] | { resumes?: Resume[] }>('/api/resume');
  if (Array.isArray(data)) return data;
  return data?.resumes ?? [];
}

/**
 * Score a resume.
 *
 * This runs an LLM call server-side, so it is slow and costs money — only call
 * it from an explicit user action, never on mount.
 */
export async function analyzeAts(input: {
  resumeId?: string;
  resumeText?: string;
}): Promise<AtsAnalysis> {
  return apiFetch<AtsAnalysis>('/api/resume/ats-analyze', {
    method: 'POST',
    body: input,
  });
}

export interface JdMatch {
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  recommendedEdits: string[];
  summary?: string;
}

export async function matchJobDescription(
  resumeId: string,
  jobDescription: string,
): Promise<JdMatch> {
  return apiFetch<JdMatch>(`/api/resume/${resumeId}/match-jd`, {
    method: 'POST',
    body: { jobDescription },
  });
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

export type JobType = 'internship' | 'full-time' | 'part-time' | 'contract';

export interface Job {
  _id?: string;
  title: string;
  company: string;
  companyLogo?: string;
  type: JobType;
  location: string;
  remote?: boolean;
  salary?: { min?: number; max?: number; currency?: string; period?: string };
  description?: string;
  requirements?: string[];
  skills?: string[];
  applyUrl?: string;
  postedDate?: string;
  /** added by the route, not stored on the model */
  matchScore?: number;
  /** skills the user has that this job wants */
  matchedSkills?: string[];
}

export interface JobsMeta {
  query?: string;
  careerPath?: string;
  count: number;
  sources?: string[];
  enabledProviders?: string[];
}

export async function searchJobs(
  options: { search?: string; location?: string } = {},
): Promise<{ jobs: Job[]; meta: JobsMeta }> {
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.location) params.set('location', options.location);
  const qs = params.toString();

  const data = await apiFetch<{ jobs?: Job[]; meta?: JobsMeta }>(
    `/api/jobs${qs ? `?${qs}` : ''}`,
  );
  return { jobs: data?.jobs ?? [], meta: data?.meta ?? { count: 0 } };
}

/**
 * Skills the job wants that the user's resume does not show.
 *
 * The route returns `matchedSkills`, so the gap is the complement. Shown on the
 * job card because "why is this only 62%" is the question the score raises.
 */
export function missingSkills(job: Job, limit = 3): string[] {
  if (!job.skills?.length) return [];
  const matched = new Set((job.matchedSkills ?? []).map((s) => s.toLowerCase()));
  return job.skills.filter((s) => !matched.has(s.toLowerCase())).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Applications                                                               */
/* -------------------------------------------------------------------------- */

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface Application {
  _id: string;
  jobId?: string;
  externalJobKey?: string;
  customJob?: { title?: string; company?: string; url?: string };
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export async function listApplications(): Promise<Application[]> {
  const data = await apiFetch<Application[] | { applications?: Application[] }>(
    '/api/jobs/applications',
  );
  if (Array.isArray(data)) return data;
  return data?.applications ?? [];
}

/** Human labels for the status enum. Kept beside it so they cannot drift. */
export const APPLICATION_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
