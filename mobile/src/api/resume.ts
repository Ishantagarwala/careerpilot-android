import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './client';

export interface PersonalInfo {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary?: string;
}

export interface EducationItem {
  id?: string;
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  achievements?: string[];
}

export interface ExperienceItem {
  id?: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets?: string[];
  technologies?: string[];
}

export interface ProjectItem {
  id?: string;
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
  github?: string;
  bullets?: string[];
  year?: string;
}

export interface SkillsData {
  technical: string[];
  frameworks: string[];
  tools: string[];
  soft: string[];
}

export interface CertificationItem {
  id?: string;
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

export interface CustomSectionItem {
  id?: string;
  heading: string;
  subheading?: string;
  date?: string;
  link?: string;
  bullets?: string[];
}

export interface CustomSection {
  id?: string;
  title: string;
  items: CustomSectionItem[];
}

export interface ResumeContent {
  personalInfo: PersonalInfo;
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  skills: SkillsData;
  certifications: CertificationItem[];
  customSections: CustomSection[];
}

/**
 * HackerRank-style resume rubric: four buckets (35 + 30 + 25 + 10) plus bonus
 * and deductions, scored out of 120. Legacy keyword/formatting fields are kept
 * optional because resumes analysed before the rubric change still carry them.
 */
export interface ResumeAtsAnalysis {
  score: number;
  openSource?: number;
  selfProjects?: number;
  production?: number;
  technicalSkills?: number;
  bonus?: number;
  deductions?: number;
  tier?: string;
  evidence?: {
    openSource?: string[];
    selfProjects?: string[];
    production?: string[];
    technicalSkills?: string[];
  };
  bonusItems?: string[];
  deductionItems?: string[];
  strengths?: string[];
  suggestions?: string[];
  summary?: string;
  analyzedAt?: string;
  // legacy (pre-rubric) fields
  keywordDensity?: number;
  formatting?: number;
  readability?: number;
  impact?: number;
}

/** Rubric scores run to 120; pre-rubric analyses were out of 100. */
export function getAtsScoreMax(analysis?: ResumeAtsAnalysis): number {
  const isHackerRank =
    analysis &&
    (typeof analysis.openSource === 'number' ||
      typeof analysis.selfProjects === 'number' ||
      typeof analysis.production === 'number' ||
      typeof analysis.technicalSkills === 'number' ||
      Boolean(analysis.tier));
  return isHackerRank ? 120 : 100;
}

export interface ResumeItem {
  _id: string;
  title: string;
  template: string;
  isActive?: boolean;
  atsAnalysis?: ResumeAtsAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDetail extends ResumeItem {
  content: ResumeContent;
}

/**
 * Shape of POST /api/resume/ats-analyze: the normalised HackerRank rubric plus
 * the domain it was scored for. There is no matchScore/keyword block any more.
 */
export interface AtsAnalysisResult {
  score: number;
  openSource: number;
  selfProjects: number;
  production: number;
  technicalSkills: number;
  bonus: number;
  deductions: number;
  tier: string;
  evidence: {
    openSource: string[];
    selfProjects: string[];
    production: string[];
    technicalSkills: string[];
  };
  bonusItems: string[];
  deductionItems: string[];
  strengths: string[];
  suggestions: string[];
  summary: string;
  careerDomain?: string;
}

export const DEFAULT_RESUME_CONTENT: ResumeContent = {
  personalInfo: {
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
    summary: '',
  },
  education: [],
  experience: [],
  projects: [],
  skills: {
    technical: [],
    frameworks: [],
    tools: [],
    soft: [],
  },
  certifications: [],
  customSections: [],
};

const RESUMES_CACHE_PREFIX = '@careerpilot_resumes_cache_';
const RESUME_DRAFT_PREFIX = '@careerpilot_resume_draft_';
const ATS_DRAFT_PREFIX = '@careerpilot_ats_draft_';

// -------------------------------------------------------------
// API Calls
// -------------------------------------------------------------

export async function fetchResumes(): Promise<ResumeItem[]> {
  const res = await apiClient<ResumeItem[]>('/api/resume', {
    method: 'GET',
    timeoutMs: 15000,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchResume(id: string): Promise<ResumeDetail> {
  const res = await apiClient<ResumeDetail>(`/api/resume/${id}`, {
    method: 'GET',
    timeoutMs: 15000,
  });
  return res;
}

export async function createResume(
  title: string = 'My Resume',
  content?: Partial<ResumeContent>
): Promise<ResumeDetail> {
  const payload = {
    title: title.trim() || 'My Resume',
    content: {
      ...DEFAULT_RESUME_CONTENT,
      ...(content || {}),
    },
  };
  const res = await apiClient<ResumeDetail>('/api/resume', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 15000,
  });
  return res;
}

export async function updateResume(
  id: string,
  updates: {
    title?: string;
    template?: string;
    content?: ResumeContent;
  }
): Promise<ResumeDetail> {
  const res = await apiClient<ResumeDetail>(`/api/resume/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
    timeoutMs: 15000,
  });
  return res;
}

export async function deleteResume(id: string): Promise<void> {
  await apiClient(`/api/resume/${id}`, {
    method: 'DELETE',
    timeoutMs: 15000,
  });
}

export interface AtsAnalyzeParams {
  resumeId?: string;
  resumeText?: string;
  file?: {
    uri: string;
    name: string;
    type?: string;
  };
  /**
   * Sent only when supplied. The rubric endpoint scores the resume against the
   * career rubric and ignores the job description.
   */
  jobDescription?: string;
}

export async function analyzeAts(params: AtsAnalyzeParams): Promise<AtsAnalysisResult> {
  const jobDescription = params.jobDescription?.trim();

  if (params.file) {
    const formData = new FormData();
    if (jobDescription) {
      formData.append('jobDescription', jobDescription);
    }
    // React Native File representation in FormData
    formData.append('file', {
      uri: params.file.uri,
      name: params.file.name,
      type: params.file.type || 'application/pdf',
    } as any);

    return await apiClient<AtsAnalysisResult>('/api/resume/ats-analyze', {
      method: 'POST',
      body: formData,
      timeoutMs: 45000,
    });
  }

  const payload: Record<string, string> = {};
  if (jobDescription) {
    payload.jobDescription = jobDescription;
  }
  if (params.resumeId) {
    payload.resumeId = params.resumeId;
  } else if (params.resumeText) {
    payload.resumeText = params.resumeText;
  }

  return await apiClient<AtsAnalysisResult>('/api/resume/ats-analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 45000,
  });
}

// -------------------------------------------------------------
// Offline Caching & Draft Management
// -------------------------------------------------------------

export async function getCachedResumes(userId: string): Promise<ResumeItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${RESUMES_CACHE_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to read cached resumes:', err);
  }
  return null;
}

export async function setCachedResumes(userId: string, data: ResumeItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${RESUMES_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache resumes:', err);
  }
}

export interface ResumeDraft {
  resumeId: string;
  title: string;
  content: ResumeContent;
  savedAt: number;
}

export async function getResumeDraft(resumeId: string): Promise<ResumeDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(`${RESUME_DRAFT_PREFIX}${resumeId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load resume draft:', err);
  }
  return null;
}

export async function saveResumeDraft(
  resumeId: string,
  draft: { title: string; content: ResumeContent }
): Promise<void> {
  try {
    const payload: ResumeDraft = {
      resumeId,
      title: draft.title,
      content: draft.content,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(`${RESUME_DRAFT_PREFIX}${resumeId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save resume draft:', err);
  }
}

export async function clearResumeDraft(resumeId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${RESUME_DRAFT_PREFIX}${resumeId}`);
  } catch (err) {
    console.warn('Failed to clear resume draft:', err);
  }
}

export interface AtsDraft {
  mode: 'saved' | 'upload' | 'text';
  resumeId?: string;
  resumeText?: string;
  jobDescription: string;
  fileName?: string;
  fileUri?: string;
  updatedAt: number;
}

export async function getAtsDraft(userId: string): Promise<AtsDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ATS_DRAFT_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load ATS draft:', err);
  }
  return null;
}

export async function saveAtsDraft(
  userId: string,
  draft: Omit<AtsDraft, 'updatedAt'>
): Promise<void> {
  try {
    const payload: AtsDraft = {
      ...draft,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(`${ATS_DRAFT_PREFIX}${userId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save ATS draft:', err);
  }
}

export async function clearAtsDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${ATS_DRAFT_PREFIX}${userId}`);
  } catch (err) {
    console.warn('Failed to clear ATS draft:', err);
  }
}

// -------------------------------------------------------------
// HTML Generation for PDF Export & System Print
// -------------------------------------------------------------

function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateResumeHtml(resume: {
  title?: string;
  content: ResumeContent;
}): string {
  const content = resume?.content || DEFAULT_RESUME_CONTENT;
  const personal = content.personalInfo || {};
  const skills = content.skills || { technical: [], frameworks: [], tools: [], soft: [] };

  const contactItems = [
    personal.phone,
    personal.email,
    personal.location,
    personal.linkedin,
    personal.github,
    personal.portfolio,
  ].filter(Boolean);

  const educationHtml = (content.education || [])
    .map((edu) => {
      const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
      const sub = [edu.degree, edu.field].filter(Boolean).join(' in ');
      const achievements = (edu.achievements || [])
        .filter(Boolean)
        .map((a) => `<li>${escapeHtml(a)}</li>`)
        .join('');

      return `
      <div class="entry">
        <div class="row">
          <span class="entry-title">${escapeHtml(edu.institution)}</span>
          <span class="entry-meta">${escapeHtml(dates)}</span>
        </div>
        ${sub ? `<div class="entry-sub">${escapeHtml(sub)}${edu.gpa ? ` <span class="gpa">| CGPA: ${escapeHtml(edu.gpa)}</span>` : ''}</div>` : ''}
        ${achievements ? `<ul class="bullets">${achievements}</ul>` : ''}
      </div>`;
    })
    .join('');

  const experienceHtml = (content.experience || [])
    .map((exp) => {
      const dates = [exp.startDate, exp.current ? 'Present' : exp.endDate]
        .filter(Boolean)
        .join(' – ');
      const bullets = (exp.bullets || [])
        .filter(Boolean)
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('');
      const tech = (exp.technologies || []).filter(Boolean).join(', ');

      return `
      <div class="entry">
        <div class="row">
          <span class="entry-title">${escapeHtml(exp.company)} – ${escapeHtml(exp.title)}</span>
          <span class="entry-meta">${escapeHtml(dates)}</span>
        </div>
        ${exp.location ? `<div class="entry-sub">${escapeHtml(exp.location)}</div>` : ''}
        ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
        ${tech ? `<div class="tech-stack"><strong>Technologies:</strong> ${escapeHtml(tech)}</div>` : ''}
      </div>`;
    })
    .join('');

  const projectsHtml = (content.projects || [])
    .map((proj) => {
      const tech = (proj.technologies || []).filter(Boolean).join(', ');
      const bullets = (proj.bullets || [])
        .filter(Boolean)
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('');

      return `
      <div class="entry">
        <div class="row">
          <span class="entry-title">${escapeHtml(proj.name)}${tech ? ` <span class="tech-inline">| ${escapeHtml(tech)}</span>` : ''}</span>
          <span class="entry-meta">${escapeHtml(proj.year || '')}</span>
        </div>
        ${proj.url || proj.github ? `<div class="entry-sub">${escapeHtml(proj.github || proj.url)}</div>` : ''}
        ${proj.description ? `<p class="desc">${escapeHtml(proj.description)}</p>` : ''}
        ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
      </div>`;
    })
    .join('');

  const skillCategories = [
    { label: 'Technical Languages', items: skills.technical },
    { label: 'Frameworks & Libraries', items: skills.frameworks },
    { label: 'Developer Tools', items: skills.tools },
    { label: 'Interpersonal', items: skills.soft },
  ].filter((c) => Array.isArray(c.items) && c.items.length > 0);

  const skillsHtml = skillCategories
    .map(
      (cat) =>
        `<div class="skill-row"><strong>${escapeHtml(cat.label)}:</strong> ${escapeHtml(cat.items.join(', '))}</div>`
    )
    .join('');

  const certsHtml = (content.certifications || [])
    .map((cert) => {
      return `
      <div class="entry">
        <div class="row">
          <span class="entry-title">${escapeHtml(cert.name)}</span>
          <span class="entry-meta">${escapeHtml(cert.date || '')}</span>
        </div>
        ${cert.issuer ? `<div class="entry-sub">${escapeHtml(cert.issuer)}${cert.url ? ` | ${escapeHtml(cert.url)}` : ''}</div>` : ''}
      </div>`;
    })
    .join('');

  const customSectionsHtml = (content.customSections || [])
    .filter((sec) => sec.title && sec.items?.length > 0)
    .map((sec) => {
      const itemsHtml = sec.items
        .map((item) => {
          const bullets = (item.bullets || [])
            .filter(Boolean)
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join('');
          return `
          <div class="entry">
            <div class="row">
              <span class="entry-title">${escapeHtml(item.heading)}</span>
              <span class="entry-meta">${escapeHtml(item.date || '')}</span>
            </div>
            ${item.subheading ? `<div class="entry-sub">${escapeHtml(item.subheading)}${item.link ? ` | ${escapeHtml(item.link)}` : ''}</div>` : ''}
            ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
          </div>`;
        })
        .join('');

      return `
      <section class="section">
        <h2 class="section-title">${escapeHtml(sec.title)}</h2>
        ${itemsHtml}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(personal.fullName || resume.title || 'Resume')}</title>
  <style>
    @page {
      margin: 0.45in 0.45in;
      size: letter portrait;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111111;
      background: #ffffff;
      line-height: 1.4;
      font-size: 11pt;
      padding: 0.2in;
    }
    header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #222222;
    }
    h1 {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #000000;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .contact {
      font-size: 9.5pt;
      color: #444444;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
    .contact span:not(:last-child)::after {
      content: " • ";
      margin-left: 8px;
      color: #888888;
    }
    .section {
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1px solid #111111;
      padding-bottom: 2px;
      margin-bottom: 8px;
      color: #000000;
    }
    .summary-text {
      font-size: 10pt;
      line-height: 1.45;
      color: #222222;
    }
    .entry {
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .entry-title {
      font-weight: 700;
      font-size: 10.5pt;
      color: #000000;
    }
    .entry-meta {
      font-size: 9pt;
      font-weight: 600;
      color: #555555;
      text-align: right;
      white-space: nowrap;
    }
    .entry-sub {
      font-size: 9.5pt;
      color: #444444;
      font-style: italic;
      margin-top: 1px;
    }
    .tech-inline {
      font-weight: normal;
      font-style: italic;
      color: #555555;
      font-size: 9.5pt;
    }
    .tech-stack {
      font-size: 9pt;
      color: #444444;
      margin-top: 2px;
    }
    .desc {
      font-size: 9.5pt;
      color: #222222;
      margin-top: 2px;
    }
    .bullets {
      margin-left: 18px;
      margin-top: 3px;
      font-size: 9.5pt;
      line-height: 1.35;
      color: #222222;
    }
    .bullets li {
      margin-bottom: 2px;
    }
    .skill-row {
      font-size: 9.5pt;
      margin-bottom: 3px;
      line-height: 1.35;
    }
    .gpa {
      font-weight: 600;
      color: #333333;
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(personal.fullName || 'Your Name')}</h1>
    ${contactItems.length > 0 ? `<div class="contact">${contactItems.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>` : ''}
  </header>

  ${personal.summary ? `
  <section class="section">
    <h2 class="section-title">Summary</h2>
    <p class="summary-text">${escapeHtml(personal.summary)}</p>
  </section>` : ''}

  ${educationHtml ? `
  <section class="section">
    <h2 class="section-title">Education</h2>
    ${educationHtml}
  </section>` : ''}

  ${experienceHtml ? `
  <section class="section">
    <h2 class="section-title">Experience</h2>
    ${experienceHtml}
  </section>` : ''}

  ${projectsHtml ? `
  <section class="section">
    <h2 class="section-title">Projects</h2>
    ${projectsHtml}
  </section>` : ''}

  ${skillsHtml ? `
  <section class="section">
    <h2 class="section-title">Technical Skills</h2>
    ${skillsHtml}
  </section>` : ''}

  ${certsHtml ? `
  <section class="section">
    <h2 class="section-title">Certifications</h2>
    ${certsHtml}
  </section>` : ''}

  ${customSectionsHtml}
</body>
</html>`;
}
