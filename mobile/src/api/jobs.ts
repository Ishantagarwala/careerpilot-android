import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export type JobType = 'all' | 'internship' | 'full-time' | 'part-time' | 'contract';

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface JobListing {
  _id: string;
  title: string;
  company: string;
  companyLogo?: string;
  type: 'internship' | 'full-time' | 'part-time' | 'contract';
  location: string;
  remote?: boolean;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  description: string;
  requirements?: string[];
  skills?: string[];
  careerPaths?: string[];
  applyUrl: string;
  postedDate?: string | Date;
  deadline?: string | Date;
  matchScore?: number;
  matchedSkills?: string[];
}

export interface JobsMeta {
  query: string;
  careerPath: string | null;
  count: number;
  /** Live providers that answered (remotive, jsearch, …). */
  sources?: string[];
  /** Providers that are configured/enabled on the server. */
  enabledProviders?: string[];
}

export interface ApplicationItem {
  _id: string;
  userId: string;
  jobId?: JobListing | string;
  /** Stable key for live-board jobs (remotive-*, jsearch-*, …) that have no Mongo id. */
  externalJobKey?: string;
  customJob?: {
    title: string;
    company: string;
    url?: string;
  };
  status: ApplicationStatus;
  appliedDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NormalizedApplication {
  _id: string;
  jobId?: string;
  title: string;
  company: string;
  location: string;
  type?: string;
  url: string;
  status: ApplicationStatus;
  appliedDate?: string;
  notes: string;
  raw: ApplicationItem;
}

export interface CustomJobInput {
  title: string;
  company: string;
  url?: string;
  status?: ApplicationStatus;
  notes?: string;
}

const CACHE_JOBS_PREFIX = '@cache_jobs_';
const CACHE_APPS_PREFIX = '@cache_applications_';
const CACHE_DETAIL_PREFIX = '@cache_job_detail_';
const DRAFT_CUSTOM_JOB_PREFIX = '@custom_job_draft_';

// Normalize linked job/custom-job records
export function normalizeApplication(app: ApplicationItem): NormalizedApplication {
  const isPopulatedJob = typeof app.jobId === 'object' && app.jobId !== null;
  const linkedJob = isPopulatedJob ? (app.jobId as JobListing) : undefined;
  const linkedJobId = typeof app.jobId === 'string' ? app.jobId : linkedJob?._id;

  const title =
    linkedJob?.title?.trim() ||
    app.customJob?.title?.trim() ||
    'Untitled opportunity';

  const company =
    linkedJob?.company?.trim() ||
    app.customJob?.company?.trim() ||
    'Unknown company';

  const location = linkedJob?.location?.trim() || 'Remote';
  const type = linkedJob?.type;
  const url = linkedJob?.applyUrl?.trim() || app.customJob?.url?.trim() || '';

  return {
    _id: app._id,
    jobId: linkedJobId,
    title,
    company,
    location,
    type,
    url,
    status: app.status || 'saved',
    appliedDate: app.appliedDate || app.createdAt,
    notes: (app.notes || '').trim(),
    raw: app,
  };
}

// Fetch jobs from backend GET /api/jobs?type=&search=
// The route answers { jobs, meta }; screens render the list, so only the jobs
// array is returned here (each job carries matchScore/matchedSkills).
export async function fetchJobs(
  params?: { type?: string; search?: string },
  signal?: AbortSignal
): Promise<JobListing[]> {
  const searchParams = new URLSearchParams();
  if (params?.type && params.type !== 'all') {
    searchParams.set('type', params.type.toLowerCase());
  }
  if (params?.search && params.search.trim()) {
    searchParams.set('search', params.search.trim());
  }

  const query = searchParams.toString();
  const endpoint = `/api/jobs${query ? `?${query}` : ''}`;

  const res = await apiClient<{ jobs?: JobListing[]; meta?: JobsMeta }>(endpoint, {
    method: 'GET',
    signal,
    timeoutMs: 15000,
  });

  return Array.isArray(res?.jobs) ? res.jobs : [];
}

// Offline Caching for Jobs
export async function getCachedJobs(userId: string): Promise<JobListing[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_JOBS_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to load cached jobs:', err);
  }
  return null;
}

export async function setCachedJobs(userId: string, jobs: JobListing[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_JOBS_PREFIX}${userId}`, JSON.stringify(jobs));
  } catch (err) {
    console.warn('Failed to cache jobs:', err);
  }
}

// Single Job Lookup
export async function getCachedJobDetail(id: string): Promise<JobListing | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_DETAIL_PREFIX}${id}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load cached job detail:', err);
  }
  return null;
}

export async function setCachedJobDetail(job: JobListing): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_DETAIL_PREFIX}${job._id}`, JSON.stringify(job));
  } catch (err) {
    console.warn('Failed to cache job detail:', err);
  }
}

// Detail lookup through verified list lookup contract without inventing /api/jobs/:id
export async function getJobById(
  id: string,
  cachedJobs?: JobListing[]
): Promise<JobListing | null> {
  if (!id) return null;

  // 1. Check in provided cached array
  if (cachedJobs && cachedJobs.length > 0) {
    const found = cachedJobs.find((j) => j._id === id);
    if (found) {
      await setCachedJobDetail(found);
      return found;
    }
  }

  // 2. Check local single job cache
  const cachedSingle = await getCachedJobDetail(id);
  if (cachedSingle) {
    return cachedSingle;
  }

  // 3. Fallback: fetch list and find item
  try {
    const freshList = await fetchJobs();
    const match = freshList.find((j) => j._id === id);
    if (match) {
      await setCachedJobDetail(match);
      return match;
    }
  } catch (err) {
    console.warn('Failed to fetch job list for detail lookup:', err);
  }

  return null;
}

// Applications API calls
export async function fetchApplications(): Promise<ApplicationItem[]> {
  const res = await apiClient<ApplicationItem[]>('/api/jobs/applications', {
    method: 'GET',
    timeoutMs: 15000,
  });
  return Array.isArray(res) ? res : [];
}

export async function getCachedApplications(userId: string): Promise<ApplicationItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_APPS_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to load cached applications:', err);
  }
  return null;
}

export async function setCachedApplications(
  userId: string,
  apps: ApplicationItem[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_APPS_PREFIX}${userId}`, JSON.stringify(apps));
  } catch (err) {
    console.warn('Failed to cache applications:', err);
  }
}

function is24HexObjectId(val: string): boolean {
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
}

export async function saveJobToApplications(
  job: JobListing,
  status: ApplicationStatus = 'saved',
  notes: string = ''
): Promise<ApplicationItem> {
  const isMongoId = is24HexObjectId(job._id);

  const payload: any = {
    status,
    notes,
  };

  if (isMongoId) {
    payload.jobId = job._id;
  } else {
    // Live board ids (remotive-*, jsearch-*, …) are not Mongo ids. The route
    // keys external applications by externalJobKey, which is what makes the
    // "already saved" check and the unique index work for them.
    payload.externalJobKey = job._id;
    payload.customJob = {
      title: job.title,
      company: job.company,
      url: job.applyUrl || '',
    };
  }

  return await apiClient<ApplicationItem>('/api/jobs/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 15000,
  });
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  notes?: string
): Promise<ApplicationItem> {
  return await apiClient<ApplicationItem>('/api/jobs/applications', {
    method: 'PUT',
    body: JSON.stringify({
      applicationId,
      status,
      notes,
    }),
    timeoutMs: 15000,
  });
}

export async function createCustomOpportunity(
  input: CustomJobInput
): Promise<ApplicationItem> {
  const trimmedTitle = input.title.trim();
  const trimmedCompany = input.company.trim();
  const trimmedUrl = input.url?.trim() || '';

  if (!trimmedTitle) {
    throw new Error('Role title is required');
  }
  if (!trimmedCompany) {
    throw new Error('Company name is required');
  }

  return await apiClient<ApplicationItem>('/api/jobs/applications', {
    method: 'POST',
    body: JSON.stringify({
      customJob: {
        title: trimmedTitle,
        company: trimmedCompany,
        url: trimmedUrl,
      },
      status: input.status || 'saved',
      notes: input.notes?.trim() || '',
    }),
    timeoutMs: 15000,
  });
}

// Custom Job Draft persistence
export async function getCustomJobDraft(userId: string): Promise<CustomJobInput | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DRAFT_CUSTOM_JOB_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load custom job draft:', err);
  }
  return null;
}

export async function saveCustomJobDraft(
  userId: string,
  draft: CustomJobInput
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${DRAFT_CUSTOM_JOB_PREFIX}${userId}`,
      JSON.stringify(draft)
    );
  } catch (err) {
    console.warn('Failed to save custom job draft:', err);
  }
}

export async function clearCustomJobDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${DRAFT_CUSTOM_JOB_PREFIX}${userId}`);
  } catch (err) {
    console.warn('Failed to clear custom job draft:', err);
  }
}
