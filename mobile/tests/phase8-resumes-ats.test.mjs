import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P24: Resume List Logic, Status Resolution & Isolation
// -------------------------------------------------------------

function resolveResumeListDisplay(resumes, options = {}) {
  const { networkError, cache } = options;

  if (networkError) {
    if (cache && cache.length > 0) {
      return {
        status: 'cached',
        items: cache.map((r) => ({
          ...r,
          scoreBadge: r.atsAnalysis?.score != null ? `ATS ${r.atsAnalysis.score}/100` : null,
        })),
        error: 'Network connection failed. Showing offline resumes.',
      };
    }
    return {
      status: 'error',
      items: [],
      error: 'Failed to load resumes. Check your connection.',
    };
  }

  if (!resumes || resumes.length === 0) {
    return {
      status: 'empty',
      items: [],
      message: 'No resumes yet',
    };
  }

  return {
    status: 'success',
    items: resumes.map((r) => ({
      ...r,
      scoreBadge: r.atsAnalysis?.score != null ? `ATS ${r.atsAnalysis.score}/100` : null,
    })),
  };
}

test('P24: Resume list state resolution - empty list, success, and offline cache fallback', () => {
  const emptyRes = resolveResumeListDisplay([]);
  assert.equal(emptyRes.status, 'empty');
  assert.equal(emptyRes.items.length, 0);

  const realResumes = [
    {
      _id: 'res-1',
      title: 'Full Stack Resume',
      template: 'modern',
      updatedAt: '2026-10-04T08:00:00Z',
      atsAnalysis: { score: 85 },
    },
    {
      _id: 'res-2',
      title: 'Data Science Resume',
      template: 'modern',
      updatedAt: '2026-10-03T10:00:00Z',
    },
  ];

  const successRes = resolveResumeListDisplay(realResumes);
  assert.equal(successRes.status, 'success');
  assert.equal(successRes.items.length, 2);
  assert.equal(successRes.items[0].scoreBadge, 'ATS 85/100');
  // Critical requirement: never invent a scored state for unanalyzed resumes
  assert.equal(successRes.items[1].scoreBadge, null);

  const offlineRes = resolveResumeListDisplay(null, { networkError: true, cache: realResumes });
  assert.equal(offlineRes.status, 'cached');
  assert.equal(offlineRes.items.length, 2);
  assert.equal(offlineRes.items[0].title, 'Full Stack Resume');

  const errorRes = resolveResumeListDisplay(null, { networkError: true, cache: [] });
  assert.equal(errorRes.status, 'error');
  assert.equal(errorRes.items.length, 0);
});

test('P24: Cross-account isolation - cache keys segregated by userId', () => {
  function getCacheKeyForUser(userId) {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error('Valid userId is required for cache scoping');
    }
    return `@careerpilot_resumes_cache_${userId.trim()}`;
  }

  assert.equal(getCacheKeyForUser('user_alice'), '@careerpilot_resumes_cache_user_alice');
  assert.equal(getCacheKeyForUser('user_bob'), '@careerpilot_resumes_cache_user_bob');
  assert.notEqual(getCacheKeyForUser('user_alice'), getCacheKeyForUser('user_bob'));
  assert.throws(() => getCacheKeyForUser(''), /Valid userId is required/);
});

test('P24: Resume deletion confirmation & draft cleanup', () => {
  const store = new Map();
  store.set('@careerpilot_resume_draft_res_100', JSON.stringify({ title: 'Draft to delete' }));

  function deleteResumeAndDraft(resumeId, confirmAction) {
    if (confirmAction !== 'confirmed') {
      return { deleted: false, reason: 'Confirmation cancelled' };
    }
    store.delete(`@careerpilot_resume_draft_${resumeId}`);
    return { deleted: true, cleanedDraft: true };
  }

  const cancelled = deleteResumeAndDraft('res_100', 'cancel');
  assert.equal(cancelled.deleted, false);
  assert.ok(store.has('@careerpilot_resume_draft_res_100'));

  const confirmed = deleteResumeAndDraft('res_100', 'confirmed');
  assert.equal(confirmed.deleted, true);
  assert.equal(store.has('@careerpilot_resume_draft_res_100'), false);
});

// -------------------------------------------------------------
// P25: Resume Editor State, Sections & Navigation Guard
// -------------------------------------------------------------

function evaluateEditorDirtyState(serverSnapshot, currentTitle, currentContent) {
  const currentSnapshot = JSON.stringify({
    title: currentTitle,
    content: currentContent,
  });
  return serverSnapshot !== '' && currentSnapshot !== serverSnapshot;
}

test('P25: Dirty state tracking across section edits', () => {
  const initialContent = {
    personalInfo: { fullName: 'Aritra', email: 'aritra@example.com' },
    education: [],
    experience: [],
    projects: [],
    skills: { technical: ['Python'], frameworks: [], tools: [], soft: [] },
    certifications: [],
    customSections: [],
  };
  const serverSnapshot = JSON.stringify({
    title: 'Software Engineer',
    content: initialContent,
  });

  // Untouched state is not dirty
  assert.equal(evaluateEditorDirtyState(serverSnapshot, 'Software Engineer', initialContent), false);

  // Edit in personal section
  const editedPersonal = {
    ...initialContent,
    personalInfo: { ...initialContent.personalInfo, fullName: 'Aritra Basu' },
  };
  assert.equal(evaluateEditorDirtyState(serverSnapshot, 'Software Engineer', editedPersonal), true);

  // Switching section to Skills and adding a skill retains dirty state without loss
  const editedSkills = {
    ...editedPersonal,
    skills: { ...editedPersonal.skills, technical: ['Python', 'TypeScript'] },
  };
  assert.equal(evaluateEditorDirtyState(serverSnapshot, 'Software Engineer', editedSkills), true);
  assert.equal(editedSkills.personalInfo.fullName, 'Aritra Basu', 'Personal edits preserved when in skills section');
});

test('P25: Navigation guard - prompt on dirty back, safe exit on clean', () => {
  function handleNavigation(isDirty, userChoice) {
    if (!isDirty) {
      return { allowed: true, action: 'navigate_back' };
    }

    if (userChoice === 'stay') {
      return { allowed: false, action: 'keep_editing' };
    }
    if (userChoice === 'discard') {
      return { allowed: true, action: 'discard_draft_and_back' };
    }
    if (userChoice === 'save_and_exit') {
      return { allowed: true, action: 'save_to_server_and_back' };
    }
    return { allowed: false, action: 'prompt_required' };
  }

  assert.deepEqual(handleNavigation(false, null), { allowed: true, action: 'navigate_back' });
  assert.deepEqual(handleNavigation(true, 'stay'), { allowed: false, action: 'keep_editing' });
  assert.deepEqual(handleNavigation(true, 'discard'), { allowed: true, action: 'discard_draft_and_back' });
  assert.deepEqual(handleNavigation(true, 'save_and_exit'), { allowed: true, action: 'save_to_server_and_back' });
});

test('P25: Draft reconciliation - loads newer local draft over older server version', () => {
  const serverResume = {
    _id: 'res-abc',
    title: 'Server Title',
    updatedAt: '2026-10-04T07:00:00.000Z', // 7:00 AM
    content: {
      personalInfo: { fullName: 'Server Name' },
    },
  };

  const newerDraft = {
    resumeId: 'res-abc',
    title: 'Newer Draft Title',
    savedAt: new Date('2026-10-04T07:15:00.000Z').getTime(), // 7:15 AM
    content: {
      personalInfo: { fullName: 'Newer Draft Name' },
    },
  };

  const olderDraft = {
    resumeId: 'res-abc',
    title: 'Stale Title',
    savedAt: new Date('2026-10-04T06:30:00.000Z').getTime(), // 6:30 AM
    content: {
      personalInfo: { fullName: 'Stale Name' },
    },
  };

  function reconcileResumeData(server, draft) {
    const serverTime = server.updatedAt ? new Date(server.updatedAt).getTime() : 0;
    if (draft && draft.savedAt > serverTime) {
      return {
        isDraft: true,
        title: draft.title,
        content: draft.content,
      };
    }
    return {
      isDraft: false,
      title: server.title,
      content: server.content,
    };
  }

  const withNewer = reconcileResumeData(serverResume, newerDraft);
  assert.equal(withNewer.isDraft, true);
  assert.equal(withNewer.title, 'Newer Draft Title');
  assert.equal(withNewer.content.personalInfo.fullName, 'Newer Draft Name');

  const withOlder = reconcileResumeData(serverResume, olderDraft);
  assert.equal(withOlder.isDraft, false);
  assert.equal(withOlder.title, 'Server Title');
  assert.equal(withOlder.content.personalInfo.fullName, 'Server Name');
});

test('P25: Entry removal safety - requires confirmation only when entry has content', () => {
  function checkRemovalRequiresConfirmation(entry) {
    if (!entry) return false;
    const values = Object.values(entry).filter((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      return Boolean(v);
    });
    return values.length > 0;
  }

  const emptyEdu = { institution: '', degree: '', field: '', achievements: [] };
  const filledEdu = { institution: 'IIT Kharagpur', degree: 'B.Tech', field: 'CS', achievements: ['Dean list'] };

  assert.equal(checkRemovalRequiresConfirmation(emptyEdu), false);
  assert.equal(checkRemovalRequiresConfirmation(filledEdu), true);
});

// -------------------------------------------------------------
// P26: HTML Generation for Genuine PDF Export
// -------------------------------------------------------------

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateResumeHtml(resume) {
  const content = resume?.content || {};
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
  <title>${escapeHtml(personal.fullName || resume.title || 'Resume')}</title>
  <style>
    @page { margin: 0.45in; }
    .section { page-break-inside: avoid; }
  </style>
</head>
<body>
  <h1>${escapeHtml(personal.fullName || 'Your Name')}</h1>
  ${contactItems.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}
  ${educationHtml}
  ${experienceHtml}
  ${projectsHtml}
  ${skillsHtml}
  ${certsHtml}
  ${customSectionsHtml}
</body>
</html>`;
}

test('P26: HTML generation renders real resume content without placeholder injection', () => {
  const testResume = {
    title: 'Software Engineering Resume',
    content: {
      personalInfo: {
        fullName: 'Aritra Basu',
        email: 'student@example.com',
        location: 'Kolkata, India',
        github: 'github.com/aritraio',
        summary: 'Passionate software engineer building cross-platform React Native and AI applications.',
      },
      education: [
        {
          institution: 'State University',
          degree: 'Bachelor of Technology',
          field: 'Computer Science',
          startDate: '2022',
          endDate: '2026',
          gpa: '8.9 / 10',
          achievements: ['Won 1st place in Inter-College Hackathon'],
        },
      ],
      experience: [
        {
          company: 'Tech Solutions',
          title: 'Mobile Engineer Intern',
          location: 'Bengaluru',
          startDate: 'Jun 2024',
          endDate: 'Aug 2024',
          current: false,
          technologies: ['React Native', 'TypeScript'],
          bullets: ['Developed high-performance UI components with offline caching.'],
        },
      ],
      projects: [
        {
          name: 'CareerPilot AI',
          description: 'AI-assisted career and study preparation platform.',
          technologies: ['React Native', 'Node.js', 'MongoDB'],
          bullets: ['Engineered responsive PDF export and ATS keyword analysis.'],
        },
      ],
      skills: {
        technical: ['JavaScript', 'TypeScript', 'Python'],
        frameworks: ['React Native', 'Next.js'],
        tools: ['Git', 'Docker'],
        soft: ['Communication', 'Teamwork'],
      },
      certifications: [
        {
          name: 'AWS Certified Cloud Practitioner',
          issuer: 'Amazon Web Services',
          date: '2024',
        },
      ],
      customSections: [
        {
          title: 'Leadership & Volunteering',
          items: [
            {
              heading: 'Lead Organizer',
              subheading: 'Tech Club',
              date: '2023 - 2024',
              bullets: ['Mentored 40+ junior developers in full-stack web dev.'],
            },
          ],
        },
      ],
    },
  };

  const html = generateResumeHtml(testResume);

  // Validate critical elements and styles in generated HTML
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Aritra Basu'));
  assert.ok(html.includes('student@example.com'));
  assert.ok(html.includes('Kolkata, India'));
  assert.ok(html.includes('State University'));
  assert.ok(html.includes('Bachelor of Technology in Computer Science'));
  assert.ok(html.includes('8.9 / 10'));
  assert.ok(html.includes('Tech Solutions – Mobile Engineer Intern'));
  assert.ok(html.includes('CareerPilot AI'));
  assert.ok(html.includes('JavaScript, TypeScript, Python'));
  assert.ok(html.includes('AWS Certified Cloud Practitioner'));
  assert.ok(html.includes('Leadership &amp; Volunteering'));
  assert.ok(html.includes('Lead Organizer'));

  // Ensure print-ready CSS is included
  assert.ok(html.includes('@page'));
  assert.ok(html.includes('page-break-inside: avoid'));
});

// -------------------------------------------------------------
// P27: ATS Analyzer Input Validation & Mode Isolation
// -------------------------------------------------------------

function validateAtsInput(mode, inputs) {
  const { resumeId, file, resumeText, jobDescription } = inputs;

  const errors = {};

  if (!jobDescription || jobDescription.trim().length < 10) {
    errors.jobDescription = 'Job description must be at least 10 characters.';
  }

  if (mode === 'saved') {
    if (!resumeId || !resumeId.trim()) {
      errors.source = 'Please select a saved resume.';
    }
  } else if (mode === 'upload') {
    if (!file || !file.uri) {
      errors.source = 'Please upload a resume PDF.';
    } else if (file.size && file.size > 10 * 1024 * 1024) {
      errors.source = 'File exceeds the 10 MB limit.';
    }
  } else if (mode === 'text') {
    if (!resumeText || resumeText.trim().length < 20) {
      errors.source = 'Resume text must be at least 20 characters.';
    }
  } else {
    errors.mode = 'Invalid mode selected.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

test('P27: ATS input validation isolates selected mode without leaking inactive modes', () => {
  // Saved mode valid
  const savedValid = validateAtsInput('saved', {
    resumeId: 'res-1',
    resumeText: '', // inactive mode value
    jobDescription: 'Software Engineer with experience in React and TypeScript.',
  });
  assert.equal(savedValid.isValid, true);

  // Saved mode missing resumeId
  const savedMissing = validateAtsInput('saved', {
    resumeId: '',
    jobDescription: 'Software Engineer with experience in React and TypeScript.',
  });
  assert.equal(savedMissing.isValid, false);
  assert.equal(savedMissing.errors.source, 'Please select a saved resume.');

  // Upload mode valid
  const uploadValid = validateAtsInput('upload', {
    file: { uri: 'file://resume.pdf', size: 1024 * 100 },
    jobDescription: 'Frontend developer needed.',
  });
  assert.equal(uploadValid.isValid, true);

  // Upload mode oversized file (> 10 MB)
  const uploadOversized = validateAtsInput('upload', {
    file: { uri: 'file://giant.pdf', size: 12 * 1024 * 1024 },
    jobDescription: 'Frontend developer needed.',
  });
  assert.equal(uploadOversized.isValid, false);
  assert.equal(uploadOversized.errors.source, 'File exceeds the 10 MB limit.');

  // Text mode valid
  const textValid = validateAtsInput('text', {
    resumeText: 'Experienced developer with 4 years in web and mobile engineering.',
    jobDescription: 'Looking for a senior full-stack engineer.',
  });
  assert.equal(textValid.isValid, true);

  // Text mode too short
  const textShort = validateAtsInput('text', {
    resumeText: 'Hi, I code.',
    jobDescription: 'Looking for a senior full-stack engineer.',
  });
  assert.equal(textShort.isValid, false);
  assert.equal(textShort.errors.source, 'Resume text must be at least 20 characters.');

  // Short JD rejects across all modes
  const shortJd = validateAtsInput('saved', {
    resumeId: 'res-1',
    jobDescription: 'Too short',
  });
  assert.equal(shortJd.isValid, false);
  assert.equal(shortJd.errors.jobDescription, 'Job description must be at least 10 characters.');
});

// -------------------------------------------------------------
// P28: ATS Result Validation & Advisory Language
// -------------------------------------------------------------

test('P28: ATS result renders verified real output and strictly avoids fake keywords', () => {
  const sampleResult = {
    matchScore: 78,
    keywordMatching: {
      score: 80,
      matched: ['JavaScript', 'Git', 'Web development'],
      missing: ['React', 'Accessibility'],
    },
    formatting: {
      score: 90,
      feedback: ['Clean layout with consistent date headings.'],
    },
    readability: {
      score: 85,
      feedback: ['Concise bullet points with strong action verbs.'],
    },
    impact: {
      score: 70,
      feedback: ['Include quantifiable metrics in project outcomes.'],
    },
    recommendedEdits: [
      'Add React to relevant project descriptions if you have worked with it.',
      'Highlight accessible UI principles in your frontend experience.',
    ],
    summary: 'Your projects describe practical work. Make the technologies and outcomes easier to spot.',
  };

  function parseAtsResult(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      matchScore: typeof raw.matchScore === 'number' ? Math.max(0, Math.min(100, Math.round(raw.matchScore))) : 0,
      matchedKeywords: Array.isArray(raw.keywordMatching?.matched) ? raw.keywordMatching.matched : [],
      missingKeywords: Array.isArray(raw.keywordMatching?.missing) ? raw.keywordMatching.missing : [],
      recommendedEdits: Array.isArray(raw.recommendedEdits) ? raw.recommendedEdits : [],
      summary: raw.summary || '',
      advisoryNote: 'Advisory AI analysis: Scores and recommendations reflect algorithmic keyword matching and structural heuristics.',
    };
  }

  const parsed = parseAtsResult(sampleResult);
  assert.equal(parsed.matchScore, 78);
  assert.deepEqual(parsed.matchedKeywords, ['JavaScript', 'Git', 'Web development']);
  assert.deepEqual(parsed.missingKeywords, ['React', 'Accessibility']);
  assert.equal(parsed.recommendedEdits.length, 2);
  assert.ok(parsed.advisoryNote.includes('Advisory AI analysis'));

  // Critical requirement: empty or partial result does NOT hallucinate default keywords
  const emptyResult = parseAtsResult({});
  assert.equal(emptyResult.matchScore, 0);
  assert.deepEqual(emptyResult.matchedKeywords, []);
  assert.deepEqual(emptyResult.missingKeywords, []);
  assert.deepEqual(emptyResult.recommendedEdits, []);
});

test('P28: Source to editing route isolation - only saved resume connects to editor id', () => {
  function resolveNextAction(sourceMode, resumeId) {
    if (sourceMode === 'saved' && resumeId) {
      return {
        action: 'edit_saved_resume',
        targetPath: `/editor?id=${resumeId}`,
      };
    }
    return {
      action: 'return_to_analyzer',
      targetPath: '/ats',
    };
  }

  const fromSaved = resolveNextAction('saved', 'res_123');
  assert.equal(fromSaved.action, 'edit_saved_resume');
  assert.equal(fromSaved.targetPath, '/editor?id=res_123');

  const fromUpload = resolveNextAction('upload', null);
  assert.equal(fromUpload.action, 'return_to_analyzer');
  assert.equal(fromUpload.targetPath, '/ats');

  const fromText = resolveNextAction('text', null);
  assert.equal(fromText.action, 'return_to_analyzer');
  assert.equal(fromText.targetPath, '/ats');
});
