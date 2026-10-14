import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeProgressData } from '../api/progress';
import { RoadmapData } from '../api/roadmap';
import { CareerRecommendation, AssessmentDraft } from '../api/career';
import { CourseItem } from '../api/courses';
import { StudyDocument, StudyThread } from '../api/study';
import { JobListing, ApplicationItem } from '../api/jobs';
import { ProjectIdea, Hackathon, TeamPost } from '../api/projects';
import { NewsArticle } from '../api/news';
import { ResumeItem, ResumeDetail } from '../api/resume';
import { TodoItem } from '../api/todo';
import { UserProfileData } from '../api/profile';

export const DEMO_USER_ID = 'demo_student_user';
export const DEMO_USER_EMAIL = 'demo@careerpilot.com';
export const DEMO_USER_NAME = 'Demo Student';

export async function seedDemoSessionData(userId: string = DEMO_USER_ID): Promise<void> {
  const now = new Date();

  // 1. Home Progress Data
  const demoHomeProgress: HomeProgressData = {
    metrics: {
      coursesCompleted: 2,
      pdfsAnalyzed: 1,
      tutorSessions: 2,
      streakDays: 5,
      lastActive: now.toISOString(),
    },
    roadmap: {
      careerPath: 'Full-Stack Web Developer',
      currentStage: 'intermediate',
      totalMilestones: 8,
      completedMilestones: 4,
      milestoneCompletionRate: 50,
      stageProgress: {
        beginner: { completed: 3, total: 3 },
        intermediate: { completed: 1, total: 3 },
        advanced: { completed: 0, total: 2 },
      },
    },
    readinessScore: 78,
    isCached: true,
  };

  // 2. Roadmap Data
  const demoRoadmap: RoadmapData = {
    _id: 'roadmap-demo-1',
    userId,
    careerPath: 'Full-Stack Web Developer',
    currentStage: 'intermediate',
    stages: [
      {
        name: 'beginner',
        milestones: [
          {
            _id: 'm1',
            title: 'Master HTML & CSS foundations, including layout grids',
            completed: true,
            completedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          },
          {
            _id: 'm2',
            title: 'Learn Git/GitHub workflows, branches, and collaboration',
            completed: true,
            completedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
          },
          {
            _id: 'm3',
            title: 'Understand Javascript DOM manipulation and event loops',
            completed: true,
            completedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          },
        ],
      },
      {
        name: 'intermediate',
        milestones: [
          {
            _id: 'm4',
            title: 'Build single-page apps using React component states',
            completed: true,
            completedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          },
          {
            _id: 'm5',
            title: 'Design clean document schemas using Mongoose & MongoDB',
            completed: false,
          },
          {
            _id: 'm6',
            title: 'Secure backend routes with token authentication (NextAuth)',
            completed: false,
          },
        ],
      },
      {
        name: 'advanced',
        milestones: [
          {
            _id: 'm7',
            title: 'Optimize server components and asset compression in Next.js',
            completed: false,
          },
          {
            _id: 'm8',
            title: 'Deploy apps to Vercel and set up CI/CD pipelines',
            completed: false,
          },
        ],
      },
    ],
    totalMilestones: 8,
    completedMilestones: 4,
    milestoneCompletionRate: 50,
  };

  // 3. Career Recommendations
  const demoRecommendations: CareerRecommendation[] = [
    {
      _id: 'rec-demo-1',
      userId,
      careerPath: 'Full-Stack Web Developer',
      matchScore: 94,
      reasoning:
        'Based on your interest in interactive web interfaces, design systems, and database management, a Full-Stack Web Developer path fits you perfectly. Your solid foundation in JavaScript matches the core requirements.',
      selected: true,
    },
    {
      _id: 'rec-demo-2',
      userId,
      careerPath: 'AI Systems Engineer',
      matchScore: 88,
      reasoning:
        'Strong analytical mindset and interest in full-stack architecture makes AI systems development a compelling alternative path.',
      selected: false,
    },
    {
      _id: 'rec-demo-3',
      userId,
      careerPath: 'Frontend Specialist (React/Mobile)',
      matchScore: 84,
      reasoning:
        'Focus on UI component architecture, accessible state management, and modern fluid layouts.',
      selected: false,
    },
  ];

  // 4. Assessment Draft
  const demoAssessmentDraft: AssessmentDraft = {
    interests: ['Web Development', 'Design Systems', 'Cloud Systems'],
    goals:
      'I want to build interactive client applications and master full-stack software architecture to secure an engineering internship.',
    subjects: ['Web Technology', 'Data Structures', 'Database Systems'],
    skills: [
      { name: 'JavaScript', level: 'Intermediate' },
      { name: 'React', level: 'Intermediate' },
      { name: 'HTML/CSS', level: 'Intermediate' },
      { name: 'Node.js', level: 'Beginner' },
    ],
    lastUpdated: Date.now(),
  };

  // 5. Courses
  const demoCourses: CourseItem[] = [
    {
      _id: 'course-demo-1',
      title: 'HTML & CSS for Beginners',
      platform: 'Scrimba',
      url: 'https://scrimba.com/learn/htmlandcss',
      careerPath: 'Full-Stack Web Developer',
      skillLevel: 'beginner',
      isFree: true,
      rating: 4.8,
    },
    {
      _id: 'course-demo-2',
      title: 'Modern JavaScript (ES6+)',
      platform: 'Udemy',
      url: 'https://www.udemy.com/course/modern-javascript-from-the-beginning/',
      careerPath: 'Full-Stack Web Developer',
      skillLevel: 'beginner',
      isFree: false,
      rating: 4.7,
    },
    {
      _id: 'course-demo-3',
      title: 'React Fundamentals Tutorial',
      platform: 'freeCodeCamp',
      url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
      careerPath: 'Full-Stack Web Developer',
      skillLevel: 'intermediate',
      isFree: true,
      rating: 4.9,
    },
    {
      _id: 'course-demo-4',
      title: 'Complete Next.js Web Developer',
      platform: 'ZTM Academy',
      url: 'https://zerotomastery.io/courses/learn-next-js/',
      careerPath: 'Full-Stack Web Developer',
      skillLevel: 'advanced',
      isFree: false,
      rating: 4.8,
    },
  ];
  const demoCompletions = ['course-demo-1', 'course-demo-3'];

  // 6. Study Document
  const docId = 'doc-demo-1';
  const demoDoc: StudyDocument = {
    _id: docId,
    filename: 'Web_Dev_Syllabus.pdf',
    fileUrl: '/uploads/Web_Dev_Syllabus.pdf',
    summary:
      '### Course Overview\nThis syllabus outlines the foundational components of modern Full-Stack Web Development, focusing on React, Next.js, Node.js, and MongoDB database integration.\n\n### Key Learning Outcomes\n- Understand Client-Server architecture and RESTful APIs.\n- Learn state management and React hook lifecycles.\n- Integrate server-side rendering (SSR) and routing configurations.\n\n### Grading Policies\n- 40% Practical assignments and mini-projects.\n- 60% Final term project and evaluation.',
    questions: [
      {
        question: 'What server-side technologies are introduced in the syllabus outcomes?',
        options: ['React & Next.js', 'Java & Spring Boot', 'Django & Python', 'Laravel & PHP'],
        answer: 'React & Next.js',
        type: 'mcq',
      },
      {
        question: 'What percentage of the final evaluation grade is decided by practical assignments?',
        options: ['20%', '30%', '40%', '60%'],
        answer: '40%',
        type: 'mcq',
      },
      {
        question:
          'Explain the difference between Client-Side Rendering (CSR) and Server-Side Rendering (SSR) in Next.js.',
        answer:
          "Client-Side Rendering (CSR) downloads a minimal HTML shell and rendering happens in the user's browser via JavaScript. Server-Side Rendering (SSR) generates the full HTML page on the server for each request, delivering faster initial loads and better SEO.",
        type: 'flashcard',
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // 7. Study Thread
  const demoThread: StudyThread = {
    _id: 'thread-demo-1',
    userId,
    threadTitle: 'React State & Component Lifecycle',
    threadType: 'general',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    messages: [
      {
        _id: 'msg-1',
        role: 'user',
        content: 'Hi! Can you explain how React state works under the hood?',
        sentAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        _id: 'msg-2',
        role: 'assistant',
        content:
          'Hello! In React, **State** is local component memory that persists across renders.\n\nWhen a component state updates:\n1. React schedules a re-render.\n2. In the next render pass, it compares the virtual DOM tree.\n3. It updates only the specific changed elements in the actual DOM.',
        sentAt: new Date(Date.now() - 1700000).toISOString(),
      },
    ],
  };

  // 8. Jobs & Applications
  const demoJobs: JobListing[] = [
    {
      _id: 'job-demo-1',
      title: 'Frontend Engineer Intern',
      company: 'Google India',
      companyLogo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
      type: 'internship',
      location: 'Bangalore, KA',
      remote: false,
      salary: { min: 45000, max: 60000, currency: 'INR' },
      description:
        'Google is looking for a frontend engineering intern to help build next-generation web applications using React and modern design systems.',
      requirements: [
        'Strong proficiency in JS/TypeScript',
        'Experience with React/Next.js frameworks',
        'Good understanding of CSS and layout grids',
      ],
      skills: ['JavaScript', 'React', 'TypeScript', 'CSS/HTML'],
      careerPaths: ['Full-Stack Web Developer', 'Frontend Developer'],
      applyUrl: 'https://careers.google.com',
      postedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      deadline: new Date(Date.now() + 15 * 86400000).toISOString(),
      matchScore: 92,
      matchedSkills: ['JavaScript', 'React', 'CSS/HTML'],
    },
    {
      _id: 'job-demo-2',
      title: 'Software Engineer - Full Stack',
      company: 'Swiggy',
      companyLogo: 'https://upload.wikimedia.org/wikipedia/en/1/12/Swiggy_logo.svg',
      type: 'full-time',
      location: 'Bangalore, KA',
      remote: false,
      salary: { min: 80000, max: 120000, currency: 'INR' },
      description:
        'Join our consumer experience team to scale and optimize consumer-facing web flows and backend APIs using React, Node.js, and MongoDB.',
      requirements: [
        '1+ years experience in Node.js and React',
        'Strong database schema design skills',
        'Experience with RESTful APIs',
      ],
      skills: ['JavaScript', 'CSS/HTML', 'React', 'Node.js', 'Databases'],
      careerPaths: ['Full-Stack Web Developer'],
      applyUrl: 'https://careers.swiggy.com',
      postedDate: new Date(Date.now() - 5 * 86400000).toISOString(),
      deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      matchScore: 88,
      matchedSkills: ['JavaScript', 'React', 'CSS/HTML'],
    },
    {
      _id: 'job-demo-3',
      title: 'Backend Engineering Intern',
      company: 'Zerodha',
      companyLogo: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Zerodha_logo.svg',
      type: 'internship',
      location: 'Remote, India',
      remote: true,
      salary: { min: 50000, max: 50000, currency: 'INR' },
      description:
        'Help build scalable backend services for our trading platform. You will work on database optimization and microservice architectures.',
      requirements: [
        'Familiarity with Go or Node.js',
        'Solid understanding of relational and NoSQL databases',
        'Basic Git experience',
      ],
      skills: ['Go', 'Node.js', 'Databases', 'Git'],
      careerPaths: ['Full-Stack Web Developer', 'Backend Engineer'],
      applyUrl: 'https://careers.zerodha.com',
      postedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
      deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
      matchScore: 75,
      matchedSkills: ['Databases'],
    },
  ];

  const demoApplications: ApplicationItem[] = [
    {
      _id: 'app-demo-1',
      userId,
      jobId: demoJobs[0],
      status: 'interview',
      appliedDate: new Date(Date.now() - 4 * 86400000).toISOString(),
      notes: 'Technical screening interview confirmed for Thursday.',
    },
    {
      _id: 'app-demo-2',
      userId,
      jobId: demoJobs[1],
      status: 'applied',
      appliedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      notes: 'Applied via team referral link.',
    },
    {
      _id: 'app-demo-3',
      userId,
      jobId: demoJobs[2],
      status: 'saved',
      notes: 'Review backend concurrency requirements before submitting.',
    },
  ];

  // 9. Projects & Hackathons
  const demoProjects: ProjectIdea[] = [
    {
      _id: 'project-demo-1',
      title: 'TaskPilot Kanban System',
      description:
        'A collaborative project planning app featuring a drag-and-drop Kanban interface, user workspaces, and status updates.',
      difficulty: 'intermediate',
      careerPaths: ['Full-Stack Web Developer'],
      technologies: ['React', 'Node.js', 'MongoDB', 'Tailwind CSS'],
      estimatedTime: '2 weeks',
      features: ['Drag and drop task boards', 'Multi-user collaboration', 'Interactive milestones'],
    },
    {
      _id: 'project-demo-2',
      title: 'AI-Powered PDF Flashcard Generator',
      description:
        'An educational application that parses syllabus/study PDFs, extracts core concepts, and leverages an LLM to generate interactive revision flashcards and quizzes.',
      difficulty: 'advanced',
      careerPaths: ['Full-Stack Web Developer', 'AI Engineer'],
      technologies: ['Next.js', 'pdf-parse', 'OpenAI API', 'Tailwind CSS'],
      estimatedTime: '3 weeks',
      features: ['PDF parsing engine', 'OpenAI completion', 'Spaced repetition flashcards'],
    },
  ];

  const demoHackathons: Hackathon[] = [
    {
      _id: 'hack-demo-1',
      title: 'Smart India Hackathon 2026',
      organizer: 'Ministry of Education',
      platform: 'other',
      url: 'https://sih.gov.in',
      description:
        'A nationwide initiative to provide students a platform to solve pressing daily problems.',
      startDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      mode: 'offline',
      location: 'New Delhi, India',
      prizes: '₹1,00,000 per problem statement',
      themes: ['Healthcare', 'Agriculture', 'Smart Cities'],
      status: 'upcoming',
    },
    {
      _id: 'hack-demo-2',
      title: 'ETHIndia 2026',
      organizer: 'Devfolio',
      platform: 'devfolio',
      url: 'https://ethindia.co',
      description: "The world's largest Ethereum hackathon. Build the future of decentralization.",
      startDate: new Date(Date.now() + 12 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      mode: 'hybrid',
      location: 'Bangalore, India',
      prizes: '$50,000 USD',
      themes: ['Blockchain', 'Web3', 'DeFi'],
      status: 'upcoming',
    },
    {
      _id: 'hack-demo-3',
      title: 'Google Gemini API Competition',
      organizer: 'Google',
      platform: 'other',
      url: 'https://ai.google.dev/competition',
      description: 'Showcase your engineering skills by building apps powered by Gemini models.',
      startDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 45 * 86400000).toISOString(),
      mode: 'online',
      prizes: '$1,000,000 USD Grand Prize',
      themes: ['AI/ML', 'Creative Apps', 'Open Source'],
      status: 'upcoming',
    },
  ];

  const demoTeams: TeamPost[] = [
    {
      _id: 'team-demo-1',
      userId: { _id: userId, name: DEMO_USER_NAME, email: DEMO_USER_EMAIL },
      hackathonId: 'hack-demo-1',
      title: 'Looking for a React developer for SIH 2026',
      description:
        'We are building an offline healthcare monitoring dashboard. Need someone skilled in Tailwind and React chart libraries.',
      lookingFor: ['React', 'Tailwind CSS', 'Charts'],
      teamSize: 4,
      currentMembers: 2,
      status: 'open',
      contactMethod: 'Discord (demo#1234)',
      createdAt: now.toISOString(),
    },
  ];

  // 10. News Articles
  const demoNews: NewsArticle[] = [
    {
      _id: 'news-demo-1',
      title: 'Top Tech Internship Programs Opening in India: Summer 2026 Roundup',
      summary:
        'Major companies including Google, Microsoft, and Amazon have opened their summer 2026 internship applications.',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      readTime: '3 Min Read',
      tags: ['Internship', 'Hiring', 'India'],
      category: 'Featured',
      source: 'Inc42',
      sourceUrl: 'https://inc42.com',
    },
    {
      _id: 'news-demo-2',
      title: "India's New AI Regulation Framework: Implications for Developers",
      summary:
        'A deep dive into draft policies requiring algorithmic transparency and implications for modern tech stacks.',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      readTime: '4 Min Read',
      tags: ['Policy', 'AI/ML'],
      category: 'Live Feed',
      source: 'YourStory',
      sourceUrl: 'https://yourstory.com',
    },
  ];

  // 11. Resumes
  const resumeId = 'resume-demo-1';
  const demoResumesList: ResumeItem[] = [
    {
      _id: resumeId,
      title: 'Full-Stack Developer Resume',
      template: 'modern',
      atsAnalysis: {
        score: 88,
        readability: 92,
        impact: 85,
        formatting: 90,
        keywordDensity: 86,
        strengths: [
          'Strong quantifiable achievement metrics in React and API optimization',
          'Clean section hierarchy matching modern ATS scanners',
          'Direct alignment with Full-Stack developer job specifications',
        ],
        suggestions: [
          'Add cloud deployment metrics (e.g. AWS or Docker containerization)',
          'Include unit test coverage percentages in project bullets',
        ],
        analyzedAt: now.toISOString(),
      },
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const demoResumeDetail: ResumeDetail = {
    _id: resumeId,
    title: 'Full-Stack Developer Resume',
    template: 'modern',
    atsAnalysis: demoResumesList[0].atsAnalysis,
    createdAt: demoResumesList[0].createdAt,
    updatedAt: demoResumesList[0].updatedAt,
    content: {
      personalInfo: {
        fullName: DEMO_USER_NAME,
        email: DEMO_USER_EMAIL,
        phone: '+91 98765 43210',
        location: 'Bangalore, India',
        linkedin: 'linkedin.com/in/demostudent',
        github: 'github.com/demostudent',
        portfolio: 'demostudent.dev',
        summary:
          'Proactive Full-Stack Software Engineering student passionate about responsive web interfaces, robust backend APIs, and developer tool performance.',
      },
      education: [
        {
          id: 'edu-1',
          institution: 'National Institute of Technology',
          degree: 'B.Tech',
          field: 'Computer Science & Engineering',
          startDate: '2022',
          endDate: '2026',
          gpa: '8.8 / 10.0',
          achievements: ["Dean's Merit List", 'Lead organizer at Developer Student Club'],
        },
      ],
      experience: [
        {
          id: 'exp-1',
          company: 'TechCorp Labs',
          title: 'Software Developer Intern',
          location: 'Remote',
          startDate: 'May 2025',
          endDate: 'July 2025',
          current: false,
          bullets: [
            'Architected reusable React components reducing UI bundle size by 18%',
            'Integrated REST endpoints with sub-100ms response latency',
          ],
          technologies: ['React', 'TypeScript', 'Node.js', 'Express'],
        },
      ],
      projects: [
        {
          id: 'proj-1',
          name: 'TaskPilot Kanban System',
          description:
            'Collaborative task planner with drag-and-drop boards and real-time updates.',
          technologies: ['React', 'Next.js', 'Node.js', 'MongoDB', 'Tailwind CSS'],
          bullets: [
            'Implemented optimistic UI mutations reducing perceived latency to zero',
            'Supported multi-user state synchronization with WebSockets',
          ],
        },
      ],
      skills: {
        technical: ['JavaScript', 'TypeScript', 'HTML/CSS', 'Python', 'SQL'],
        frameworks: ['React', 'Next.js', 'Node.js', 'Express'],
        tools: ['Git', 'Docker', 'VS Code', 'Postman', 'MongoDB Compass'],
        soft: ['Problem Solving', 'Team Collaboration', 'Technical Writing'],
      },
      certifications: [
        {
          id: 'cert-1',
          name: 'Meta Front-End Developer Professional Certificate',
          issuer: 'Coursera',
          date: '2025',
        },
      ],
      customSections: [],
    },
  };

  // 12. Daily Todos
  const demoTodos: TodoItem[] = [
    { _id: 'todo-1', userId, text: 'Review Web Dev Syllabus PDF', completed: true },
    { _id: 'todo-2', userId, text: 'Complete React components milestone', completed: true },
    { _id: 'todo-3', userId, text: 'Practice 25-minute Pomodoro focus session', completed: false },
    { _id: 'todo-4', userId, text: 'Tailor resume for Google India internship', completed: false },
    { _id: 'todo-5', userId, text: 'Take practice quiz on CSR vs SSR', completed: false },
  ];

  // 13. Profile
  const demoProfile: UserProfileData = {
    name: DEMO_USER_NAME,
    email: DEMO_USER_EMAIL,
    currentCourse: 'B.Tech in Computer Science & Engineering',
    activeCurriculum: [
      {
        title: 'Advanced Web Systems Architecture',
        platform: 'Stanford Online',
        progress: 68,
        estCompletion: 'Q3 2026',
      },
      {
        title: 'Modern Full-Stack Applications',
        platform: 'Coursera',
        progress: 45,
        estCompletion: 'Q4 2026',
      },
    ],
    futureGoals: {
      shortTerm: [
        'Complete Full-Stack Web Developer Roadmap',
        'Secure a software engineering internship',
      ],
      longTerm: [
        'Senior Full-Stack Engineer at top technology firm',
        'Build open-source educational software',
      ],
    },
    goals: 'Become a Full-Stack Web Developer and build highly interactive client interfaces.',
    interests: ['Coding', 'Web UI', 'Design Systems'],
    subjects: ['Web Technology', 'Database Systems'],
    skills: [
      { name: 'JavaScript', level: 'intermediate' },
      { name: 'CSS/HTML', level: 'intermediate' },
      { name: 'Databases', level: 'beginner' },
    ],
  };

  // Persist all entries in AsyncStorage for instant offline & demo access
  const pairs: [string, string][] = [
    [`@cache_home_progress_${userId}`, JSON.stringify(demoHomeProgress)],
    [`@careerpilot_roadmap_cache_${userId}`, JSON.stringify(demoRoadmap)],
    [`@careerpilot_recommendations_cache_${userId}`, JSON.stringify(demoRecommendations)],
    [`@careerpilot_assessment_draft_${userId}`, JSON.stringify(demoAssessmentDraft)],
    [`@careerpilot_courses_cache_${userId}`, JSON.stringify(demoCourses)],
    [`@careerpilot_completions_cache_${userId}`, JSON.stringify(demoCompletions)],
    [`@careerpilot_docs_${userId}`, JSON.stringify([demoDoc])],
    [`@careerpilot_doc_summary_${docId}`, JSON.stringify({ id: docId, filename: demoDoc.filename, summary: demoDoc.summary })],
    [`@careerpilot_doc_questions_${docId}`, JSON.stringify({ id: docId, filename: demoDoc.filename, questions: demoDoc.questions })],
    ['@careerpilot_selected_study_docs', JSON.stringify([{ id: docId, filename: demoDoc.filename }])],
    [`@careerpilot_threads_${userId}`, JSON.stringify([demoThread])],
    [`@cache_jobs_${userId}`, JSON.stringify(demoJobs)],
    [`@cache_applications_${userId}`, JSON.stringify(demoApplications)],
    [`@careerpilot_project_ideas_cache_${userId}`, JSON.stringify(demoProjects)],
    ['@careerpilot_hackathons_cache', JSON.stringify(demoHackathons)],
    [`@careerpilot_teams_cache_${userId}`, JSON.stringify(demoTeams)],
    [`@careerpilot_news_cache_${userId}`, JSON.stringify({ items: demoNews, cachedAt: Date.now() })],
    [`@careerpilot_resumes_cache_${userId}`, JSON.stringify(demoResumesList)],
    [`@careerpilot_resume_detail_${resumeId}`, JSON.stringify(demoResumeDetail)],
    [`@cache_todo_${userId}`, JSON.stringify(demoTodos)],
    [`@profile_cache_${userId}`, JSON.stringify(demoProfile)],
  ];

  try {
    await AsyncStorage.multiSet(pairs);
  } catch (err) {
    console.warn('[demoService] Failed to cache demo data pairs:', err);
  }
}
