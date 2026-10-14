export interface ScreenMeta {
  id: string;
  title: string;
  branch: 'home' | 'learn' | 'study' | 'career' | 'account' | null;
  parent: string | null;
  isRoot: boolean;
}

export const SCREEN_REGISTRY: Record<string, ScreenMeta> = {
  // Auth
  welcome: { id: 'welcome', title: 'Welcome', branch: null, parent: null, isRoot: true },
  login: { id: 'login', title: 'Log in', branch: null, parent: 'welcome', isRoot: false },
  register: { id: 'register', title: 'Create account', branch: null, parent: 'welcome', isRoot: false },

  // Roots
  home: { id: 'home', title: 'Career Pilot', branch: 'home', parent: null, isRoot: true },
  'new-home': { id: 'new-home', title: 'Home · new account', branch: 'home', parent: null, isRoot: true },
  learn: { id: 'learn', title: 'Learning roadmap', branch: 'learn', parent: null, isRoot: true },
  study: { id: 'study', title: 'AI Study Hub', branch: 'study', parent: null, isRoot: true },
  career: { id: 'career', title: 'Jobs & internships', branch: 'career', parent: null, isRoot: true },

  // Learning branch
  interests: { id: 'interests', title: 'Assessment · interests', branch: 'learn', parent: 'home', isRoot: false },
  goals: { id: 'goals', title: 'Assessment · goals', branch: 'learn', parent: 'interests', isRoot: false },
  subjects: { id: 'subjects', title: 'Assessment · subjects', branch: 'learn', parent: 'goals', isRoot: false },
  skills: { id: 'skills', title: 'Assessment · skills', branch: 'learn', parent: 'subjects', isRoot: false },
  matches: { id: 'matches', title: 'Career matches', branch: 'learn', parent: 'learn', isRoot: false },
  courses: { id: 'courses', title: 'Courses', branch: 'learn', parent: 'learn', isRoot: false },
  offline: { id: 'offline', title: 'Offline roadmap', branch: 'learn', parent: 'learn', isRoot: false },

  // Study branch
  'new-study': { id: 'new-study', title: 'New conversation', branch: 'study', parent: 'study', isRoot: false },
  conversations: { id: 'conversations', title: 'Conversations', branch: 'study', parent: 'study', isRoot: false },
  library: { id: 'library', title: 'Study materials', branch: 'study', parent: 'study', isRoot: false },
  upload: { id: 'upload', title: 'Upload PDF', branch: 'study', parent: 'library', isRoot: false },
  document: { id: 'document', title: 'Document summary', branch: 'study', parent: 'library', isRoot: false },
  quiz: { id: 'quiz', title: 'Practice quiz', branch: 'study', parent: 'document', isRoot: false },
  flashcards: { id: 'flashcards', title: 'Flashcards', branch: 'study', parent: 'document', isRoot: false },
  focus: { id: 'focus', title: 'Focus session', branch: 'study', parent: 'study', isRoot: false },

  // Career branch
  job: { id: 'job', title: 'Job detail', branch: 'career', parent: 'career', isRoot: false },
  tracker: { id: 'tracker', title: 'Applications', branch: 'career', parent: 'career', isRoot: false },
  'custom-job': { id: 'custom-job', title: 'Add opportunity', branch: 'career', parent: 'tracker', isRoot: false },
  resumes: { id: 'resumes', title: 'Resume builder', branch: 'career', parent: 'career', isRoot: false },
  editor: { id: 'editor', title: 'Edit resume', branch: 'career', parent: 'resumes', isRoot: false },
  'resume-preview': { id: 'resume-preview', title: 'Resume preview', branch: 'career', parent: 'editor', isRoot: false },
  ats: { id: 'ats', title: 'ATS analyzer', branch: 'career', parent: 'career', isRoot: false },
  'ats-result': { id: 'ats-result', title: 'ATS result', branch: 'career', parent: 'ats', isRoot: false },
  projects: { id: 'projects', title: 'Project ideas', branch: 'career', parent: 'career', isRoot: false },
  hackathons: { id: 'hackathons', title: 'Hackathons', branch: 'career', parent: 'projects', isRoot: false },
  teams: { id: 'teams', title: 'Team finder', branch: 'career', parent: 'projects', isRoot: false },
  'team-post': { id: 'team-post', title: 'Create team post', branch: 'career', parent: 'teams', isRoot: false },
  news: { id: 'news', title: 'Tech news', branch: 'career', parent: 'career', isRoot: false },

  // Account
  profile: { id: 'profile', title: 'Your profile', branch: 'account', parent: 'home', isRoot: false },
  settings: { id: 'settings', title: 'Settings', branch: 'account', parent: 'home', isRoot: false },

  // Diagnostics
  error: { id: 'error', title: 'Load failure', branch: 'home', parent: 'home', isRoot: true },
  loading: { id: 'loading', title: 'Loading', branch: 'home', parent: 'home', isRoot: true },
};
