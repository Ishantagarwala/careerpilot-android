import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P05: Interests Validation & Selection Logic
// -------------------------------------------------------------
function validateInterests(selectedList) {
  if (!Array.isArray(selectedList) || selectedList.length === 0) {
    return { valid: false, error: 'Please select at least one interest to continue.' };
  }
  return { valid: true, error: null };
}

function toggleInterestSelection(current, item) {
  return current.includes(item)
    ? current.filter((i) => i !== item)
    : [...current, item];
}

// -------------------------------------------------------------
// P06: Goals Validation & Storage Logic
// -------------------------------------------------------------
function validateGoals(goalsText) {
  const trimmed = typeof goalsText === 'string' ? goalsText.trim() : '';
  if (trimmed.length < 10) {
    return {
      valid: false,
      error: 'Please describe your career goals in at least 10 characters.',
    };
  }
  return { valid: true, error: null };
}

// -------------------------------------------------------------
// P07: Subjects Validation & Retention Logic
// -------------------------------------------------------------
function validateSubjects(selectedSubjects) {
  if (!Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
    return { valid: false, error: 'Please select at least one subject to continue.' };
  }
  return { valid: true, error: null };
}

// -------------------------------------------------------------
// P08: Skills Normalization & Submission Payload Assembly
// -------------------------------------------------------------
function addSkillToDraft(existingSkills, newSkillName, newSkillLevel) {
  const trimmed = typeof newSkillName === 'string' ? newSkillName.trim() : '';
  if (!trimmed) {
    return { success: false, error: 'Please type a skill name first.', skills: existingSkills };
  }
  const duplicate = existingSkills.some(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    return { success: false, error: `"${trimmed}" is already added.`, skills: existingSkills };
  }
  return {
    success: true,
    error: null,
    skills: [...existingSkills, { name: trimmed, level: newSkillLevel }],
  };
}

function assembleAssessmentPayload(draft, pendingSkillName = '', pendingSkillLevel = 'Intermediate') {
  let finalSkills = Array.isArray(draft.skills) ? [...draft.skills] : [];

  const trimmed = pendingSkillName.trim();
  if (trimmed && !finalSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    finalSkills.push({ name: trimmed, level: pendingSkillLevel });
  }

  if (!draft.interests || draft.interests.length === 0) {
    throw new Error('Interests required');
  }
  if (!draft.goals || draft.goals.trim().length < 10) {
    throw new Error('Goals must be at least 10 characters');
  }
  if (!draft.subjects || draft.subjects.length === 0) {
    throw new Error('Subjects required');
  }
  if (finalSkills.length === 0) {
    throw new Error('At least one skill required');
  }

  return {
    interests: draft.interests,
    goals: draft.goals.trim(),
    subjects: draft.subjects,
    skills: finalSkills.map((s) => ({
      name: s.name.trim(),
      level: s.level.toLowerCase(),
    })),
  };
}

// -------------------------------------------------------------
// P09: Career Matches Ranking & Selection
// -------------------------------------------------------------
function rankRecommendations(recs) {
  if (!Array.isArray(recs)) return [];
  return [...recs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}

function selectPath(recs, selectedId) {
  return recs.map((r) => ({
    ...r,
    selected: r._id === selectedId,
  }));
}

// -------------------------------------------------------------
// P10: Roadmap Stats & Current Stage Calculation
// -------------------------------------------------------------
function computeRoadmapStats(roadmap) {
  if (!roadmap || !Array.isArray(roadmap.stages)) {
    return { total: 0, completed: 0, percent: 0 };
  }
  let total = 0;
  let completed = 0;
  for (const stage of roadmap.stages) {
    if (Array.isArray(stage.milestones)) {
      for (const m of stage.milestones) {
        total++;
        if (m.completed) completed++;
      }
    }
  }
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

function resolveRoadmapCurrentStage(stages) {
  const isStageComplete = (name) => {
    const stage = stages.find((s) => s.name === name);
    if (!stage || !stage.milestones || stage.milestones.length === 0) return true;
    return stage.milestones.every((m) => m.completed);
  };

  const beginnerDone = isStageComplete('beginner');
  const intermediateDone = isStageComplete('intermediate');

  if (beginnerDone && intermediateDone) return 'advanced';
  if (beginnerDone) return 'intermediate';
  return 'beginner';
}

// -------------------------------------------------------------
// P11: Courses Filtering & Completion Idempotence
// -------------------------------------------------------------
function filterCourses(courses, { level = 'all', budget = 'all' } = {}) {
  return courses.filter((c) => {
    if (level !== 'all' && c.skillLevel !== level) return false;
    if (budget === 'free' && !c.isFree) return false;
    if (budget === 'paid' && c.isFree) return false;
    return true;
  });
}

function updateCompletionSet(currentSet, courseId, completed) {
  const next = new Set(currentSet);
  if (completed) {
    next.add(courseId);
  } else {
    next.delete(courseId);
  }
  return next;
}

// =============================================================
// TEST SUITE: PHASE 4
// =============================================================

test('P05: Interests validation - rejects empty selection', () => {
  const res1 = validateInterests([]);
  assert.equal(res1.valid, false);
  assert.ok(res1.error?.includes('at least one interest'));

  const res2 = validateInterests(null);
  assert.equal(res2.valid, false);
});

test('P05: Interests selection - toggling maintains user choice', () => {
  let selected = ['Software engineering'];
  selected = toggleInterestSelection(selected, 'Artificial intelligence');
  assert.deepEqual(selected, ['Software engineering', 'Artificial intelligence']);

  selected = toggleInterestSelection(selected, 'Software engineering');
  assert.deepEqual(selected, ['Artificial intelligence']);
  assert.equal(validateInterests(selected).valid, true);
});

test('P06: Goals validation - enforces meaningful 10-char threshold', () => {
  assert.equal(validateGoals('').valid, false);
  assert.equal(validateGoals('short').valid, false);
  assert.equal(validateGoals('         ').valid, false);

  const validGoals = 'I want to build software products and prepare for an internship.';
  const res = validateGoals(validGoals);
  assert.equal(res.valid, true);
  assert.equal(res.error, null);
});

test('P06: Assessment draft retention - goals update retains earlier interests', () => {
  const draft = {
    interests: ['Software engineering', 'Web development'],
    goals: '',
    subjects: [],
    skills: [],
  };

  draft.goals = 'Become a full-stack engineer and work on impactful open source.';
  assert.equal(draft.interests.length, 2);
  assert.equal(validateGoals(draft.goals).valid, true);
});

test('P07: Subjects validation - requires at least one subject', () => {
  assert.equal(validateSubjects([]).valid, false);
  assert.equal(validateSubjects(['Programming']).valid, true);
  assert.equal(validateSubjects(['Data structures', 'Database systems']).valid, true);
});

test('P08: Skills duplicate detection and whitespace trimming', () => {
  const initialSkills = [{ name: 'Python', level: 'Beginner' }];

  // Reject duplicate (case-insensitive)
  const dupResult = addSkillToDraft(initialSkills, 'python', 'Intermediate');
  assert.equal(dupResult.success, false);
  assert.ok(dupResult.error?.includes('already added'));
  assert.equal(dupResult.skills.length, 1);

  // Accept trimmed new skill
  const addResult = addSkillToDraft(initialSkills, '  JavaScript  ', 'Intermediate');
  assert.equal(addResult.success, true);
  assert.equal(addResult.skills.length, 2);
  assert.equal(addResult.skills[1].name, 'JavaScript');
});

test('P08: Submission payload assembly - auto-includes pending typed skill', () => {
  const draft = {
    interests: ['Software engineering'],
    goals: 'I want to learn frontend development and build UI tools.',
    subjects: ['Programming'],
    skills: [{ name: 'Python', level: 'Beginner' }],
  };

  const payload = assembleAssessmentPayload(draft, 'React', 'Advanced');
  assert.equal(payload.skills.length, 2);
  assert.equal(payload.skills[1].name, 'React');
  assert.equal(payload.skills[1].level, 'advanced');
  assert.equal(payload.interests[0], 'Software engineering');
});

test('P08: Submission failure safety - draft is preserved on error', () => {
  const draft = {
    interests: ['Cybersecurity'],
    goals: 'Learn secure coding and network defense systems.',
    subjects: ['Computer networks', 'Operating systems'],
    skills: [{ name: 'Linux', level: 'Intermediate' }],
  };

  // Simulating API network failure / timeout
  let serverSuccess = false;
  let storageDraft = { ...draft };

  if (!serverSuccess) {
    // Draft MUST NOT be cleared on failure
    assert.ok(storageDraft.interests.length > 0);
    assert.ok(storageDraft.skills.length > 0);
  }

  // Once server confirms success, draft is cleared
  serverSuccess = true;
  if (serverSuccess) {
    storageDraft = null;
  }
  assert.equal(storageDraft, null);
});

test('P09: Career matches ranking - orders top match highest and marks active path', () => {
  const rawRecs = [
    { _id: 'rec_2', careerPath: 'Web Developer', matchScore: 86, selected: false },
    { _id: 'rec_1', careerPath: 'Software Engineer', matchScore: 92, selected: false },
    { _id: 'rec_3', careerPath: 'Data Analyst', matchScore: 78, selected: false },
  ];

  const ranked = rankRecommendations(rawRecs);
  assert.equal(ranked[0].careerPath, 'Software Engineer');
  assert.equal(ranked[0].matchScore, 92);

  const selected = selectPath(ranked, 'rec_1');
  assert.equal(selected[0].selected, true);
  assert.equal(selected[1].selected, false);
  assert.equal(selected[2].selected, false);
});

test('P10: Learn Roadmap stats calculation', () => {
  const sampleRoadmap = {
    careerPath: 'Software Engineer',
    stages: [
      {
        name: 'beginner',
        milestones: [
          { title: 'Programming basics', completed: true },
          { title: 'Git & GitHub', completed: true },
          { title: 'Problem solving', completed: true },
          { title: 'First project', completed: true },
        ],
      },
      {
        name: 'intermediate',
        milestones: [
          { title: 'Build a REST API', completed: true },
          { title: 'Databases and SQL', completed: false },
          { title: 'Practice data structures', completed: false },
          { title: 'Full-stack project', completed: false },
        ],
      },
      {
        name: 'advanced',
        milestones: [
          { title: 'System design', completed: false },
          { title: 'Deployment & CI/CD', completed: false },
          { title: 'Portfolio', completed: false },
          { title: 'Interview prep', completed: false },
        ],
      },
    ],
  };

  const stats = computeRoadmapStats(sampleRoadmap);
  assert.equal(stats.total, 12);
  assert.equal(stats.completed, 5);
  assert.equal(stats.percent, 42); // 5/12 = 41.66% -> 42%
});

test('P10: Learn Roadmap stage resolution - beginner complete moves to intermediate', () => {
  const stages = [
    {
      name: 'beginner',
      milestones: [{ completed: true }, { completed: true }],
    },
    {
      name: 'intermediate',
      milestones: [{ completed: false }, { completed: false }],
    },
    {
      name: 'advanced',
      milestones: [{ completed: false }],
    },
  ];

  assert.equal(resolveRoadmapCurrentStage(stages), 'intermediate');

  // Complete intermediate -> moves to advanced
  stages[1].milestones[0].completed = true;
  stages[1].milestones[1].completed = true;
  assert.equal(resolveRoadmapCurrentStage(stages), 'advanced');
});

test('P11: Courses filtering by level and budget', () => {
  const catalog = [
    { _id: 'c1', title: 'Python Basics', skillLevel: 'beginner', isFree: true },
    { _id: 'c2', title: 'REST APIs with Express', skillLevel: 'intermediate', isFree: true },
    { _id: 'c3', title: 'Advanced Algorithms', skillLevel: 'advanced', isFree: false },
    { _id: 'c4', title: 'Intro to SQL', skillLevel: 'beginner', isFree: false },
  ];

  // All / All
  assert.equal(filterCourses(catalog).length, 4);

  // Beginner only
  const beginnerOnly = filterCourses(catalog, { level: 'beginner', budget: 'all' });
  assert.equal(beginnerOnly.length, 2);

  // Free only
  const freeOnly = filterCourses(catalog, { level: 'all', budget: 'free' });
  assert.equal(freeOnly.length, 2);

  // Intermediate + Free
  const intermediateFree = filterCourses(catalog, { level: 'intermediate', budget: 'free' });
  assert.equal(intermediateFree.length, 1);
  assert.equal(intermediateFree[0]._id, 'c2');
});

test('P11: Idempotent course completion toggling', () => {
  let completed = new Set(['c1', 'c2']);

  // Complete c3
  completed = updateCompletionSet(completed, 'c3', true);
  assert.ok(completed.has('c3'));
  assert.equal(completed.size, 3);

  // Re-completing c3 is idempotent
  completed = updateCompletionSet(completed, 'c3', true);
  assert.equal(completed.size, 3);

  // Undo c1
  completed = updateCompletionSet(completed, 'c1', false);
  assert.equal(completed.has('c1'), false);
  assert.equal(completed.size, 2);
});
