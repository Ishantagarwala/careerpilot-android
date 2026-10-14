import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P34: Profile Logic, Validation, Dirty State & Drafts
// -------------------------------------------------------------

function validateProfileForm(input) {
  const errors = {};
  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Full name is required.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      name: (input.name || '').trim(),
      currentCourse: (input.currentCourse || '').trim(),
    },
  };
}

function parseCourseInput(input) {
  const errors = {};
  const trimmedTitle = (input.title || '').trim();
  if (!trimmedTitle) {
    errors.title = 'Course title cannot be empty.';
  }

  const rawProgress = typeof input.progress === 'string'
    ? parseInt(input.progress.replace('%', '').trim(), 10)
    : input.progress;
  const progress = isNaN(rawProgress) ? 0 : Math.min(100, Math.max(0, rawProgress));

  const platform = (input.platform || '').trim() || 'Self-paced';
  const estCompletion = (input.estCompletion || '').trim() || `${progress}% complete`;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    course: {
      title: trimmedTitle,
      platform,
      progress,
      estCompletion,
    },
  };
}

function parseGoalInput(input) {
  const errors = {};
  const trimmed = (input || '').trim();
  if (trimmed.length < 3) {
    errors.goal = 'Goal must be at least 3 characters long.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    goal: trimmed,
  };
}

function computeProfileDirtyState(current, baseline) {
  if (!baseline) return false;

  const nameDirty = (current.name || '').trim() !== (baseline.name || '').trim();
  const courseDirty = (current.currentCourse || '').trim() !== (baseline.currentCourse || '').trim();
  const curriculumDirty =
    JSON.stringify(current.activeCurriculum || []) !==
    JSON.stringify(baseline.activeCurriculum || []);
  const goalsDirty =
    JSON.stringify(current.futureGoals?.shortTerm || []) !==
    JSON.stringify(baseline.futureGoals?.shortTerm || []);

  return nameDirty || courseDirty || curriculumDirty || goalsDirty;
}

function reconcileProfileWithDraft(serverProfile, localDraft) {
  if (!localDraft) return serverProfile;

  return {
    ...serverProfile,
    name: localDraft.name !== undefined ? localDraft.name : serverProfile.name,
    email: serverProfile.email, // Email is immutable identity
    currentCourse:
      localDraft.currentCourse !== undefined
        ? localDraft.currentCourse
        : serverProfile.currentCourse,
    activeCurriculum: Array.isArray(localDraft.activeCurriculum)
      ? localDraft.activeCurriculum
      : serverProfile.activeCurriculum,
    futureGoals: {
      shortTerm: Array.isArray(localDraft.futureGoals?.shortTerm)
        ? localDraft.futureGoals.shortTerm
        : serverProfile.futureGoals?.shortTerm || [],
      longTerm: Array.isArray(localDraft.futureGoals?.longTerm)
        ? localDraft.futureGoals.longTerm
        : serverProfile.futureGoals?.longTerm || [],
    },
    isDraftApplied: true,
  };
}

// -------------------------------------------------------------
// P35: Settings, Themes, Permissions & Cache Lifecycle
// -------------------------------------------------------------

const THEME_OPTIONS = [
  { label: 'Monolith Dark', mode: 'dark' },
  { label: 'Monolith Light', mode: 'light' },
  { label: 'Device setting', mode: 'system' },
];

function resolveThemeMode(savedMode, systemIsDark = true) {
  const validModes = ['dark', 'light', 'system'];
  const mode = validModes.includes(savedMode) ? savedMode : 'dark';
  const effectiveDark = mode === 'system' ? systemIsDark : mode === 'dark';
  return {
    mode,
    effectiveDark,
    tokens: effectiveDark ? 'darkTokens' : 'lightTokens',
  };
}

function handleReminderToggle(currentEnabled, permissionStatus) {
  if (currentEnabled) {
    // Toggling off
    return {
      enabled: false,
      newPermissionStatus: 'denied',
      alertRequired: false,
    };
  }

  // Toggling on
  if (permissionStatus === 'granted') {
    return {
      enabled: true,
      newPermissionStatus: 'granted',
      alertRequired: false,
    };
  }

  // Permission denied or undetermined
  return {
    enabled: false, // Honest reflection, DO NOT set enabled to true!
    newPermissionStatus: 'denied',
    alertRequired: true,
    alertMessage: 'Focus-session reminders require notification permissions.',
  };
}

function filterCacheKeysForPurge(allKeys, mode = 'device_clear') {
  if (mode === 'device_clear') {
    // Local device cache clear: removes offline models, drafts, and local sessions
    // Leaves auth token and theme intact
    return allKeys.filter(
      (k) =>
        k.startsWith('@profile_cache_') ||
        k.startsWith('@profile_draft_') ||
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
  }

  if (mode === 'logout_purge') {
    // Logout / account switch: purge ALL user data, tokens, and credentials
    // Preserve ONLY device-level theme setting
    const preserveKeys = ['@careerpilot_theme_mode'];
    return allKeys.filter((k) => !preserveKeys.includes(k));
  }

  return [];
}

// =============================================================
// TEST SUITE: P34 — Profile, Curriculum and Goals
// =============================================================

test('P34: Profile input validation - requires full name and trims whitespace', () => {
  const invalid = validateProfileForm({ name: '   ', currentCourse: 'Software student' });
  assert.equal(invalid.isValid, false);
  assert.equal(invalid.errors.name, 'Full name is required.');

  const valid = validateProfileForm({ name: '  Aritra Roy  ', currentCourse: '  Computer Science  ' });
  assert.equal(valid.isValid, true);
  assert.equal(valid.sanitized.name, 'Aritra Roy');
  assert.equal(valid.sanitized.currentCourse, 'Computer Science');
});

test('P34: Email immutability - prevents arbitrary client modification of identity', () => {
  const serverProfile = {
    name: 'Aritra',
    email: 'student@example.com',
    currentCourse: 'Computer science student',
    activeCurriculum: [],
    futureGoals: { shortTerm: [], longTerm: [] },
  };

  const maliciousClientDraft = {
    name: 'Aritra Modified',
    email: 'hacker@malicious.com', // Attempted override
    currentCourse: 'Cybersecurity',
  };

  const reconciled = reconcileProfileWithDraft(serverProfile, maliciousClientDraft);
  assert.equal(reconciled.name, 'Aritra Modified');
  // Email MUST remain strictly from server identity record
  assert.equal(reconciled.email, 'student@example.com');
});

test('P34: Active curriculum course parsing and bounds enforcement', () => {
  const emptyCourse = parseCourseInput({ title: '   ' });
  assert.equal(emptyCourse.isValid, false);
  assert.equal(emptyCourse.errors.title, 'Course title cannot be empty.');

  // Bounds check: clamp progress between 0 and 100, parse percent string
  const courseWithPercent = parseCourseInput({
    title: 'Database systems',
    platform: 'Self-paced',
    progress: '40%',
    estCompletion: '40% complete',
  });
  assert.equal(courseWithPercent.isValid, true);
  assert.equal(courseWithPercent.course.progress, 40);
  assert.equal(courseWithPercent.course.platform, 'Self-paced');
  assert.equal(courseWithPercent.course.estCompletion, '40% complete');

  const overflowProgress = parseCourseInput({
    title: 'Advanced AI',
    progress: '150',
  });
  assert.equal(overflowProgress.course.progress, 100);

  const underflowProgress = parseCourseInput({
    title: 'Intro to Python',
    progress: '-20',
  });
  assert.equal(underflowProgress.course.progress, 0);
});

test('P34: Goal validation and list management', () => {
  const invalidGoal = parseGoalInput('No');
  assert.equal(invalidGoal.isValid, false);
  assert.equal(invalidGoal.errors.goal, 'Goal must be at least 3 characters long.');

  const validGoal = parseGoalInput('  Build a full-stack project.  ');
  assert.equal(validGoal.isValid, true);
  assert.equal(validGoal.goal, 'Build a full-stack project.');
});

test('P34: Dirty state calculation across profile, curriculum and goals', () => {
  const baseline = {
    name: 'Aritra',
    currentCourse: 'Computer science student',
    activeCurriculum: [
      { title: 'Database systems', platform: 'Self-paced', progress: 40, estCompletion: '40% complete' },
    ],
    futureGoals: {
      shortTerm: ['Build a full-stack project.'],
      longTerm: [],
    },
  };

  // Identical data is clean
  assert.equal(
    computeProfileDirtyState(
      {
        name: 'Aritra',
        currentCourse: 'Computer science student',
        activeCurriculum: [
          { title: 'Database systems', platform: 'Self-paced', progress: 40, estCompletion: '40% complete' },
        ],
        futureGoals: { shortTerm: ['Build a full-stack project.'] },
      },
      baseline
    ),
    false
  );

  // Name change is dirty
  assert.equal(
    computeProfileDirtyState({ ...baseline, name: 'Aritra Updated' }, baseline),
    true
  );

  // Curriculum addition is dirty
  assert.equal(
    computeProfileDirtyState(
      {
        ...baseline,
        activeCurriculum: [
          ...baseline.activeCurriculum,
          { title: 'Algorithms', platform: 'Coursera', progress: 10, estCompletion: 'In progress' },
        ],
      },
      baseline
    ),
    true
  );

  // Goals addition is dirty
  assert.equal(
    computeProfileDirtyState(
      {
        ...baseline,
        futureGoals: { shortTerm: ['Build a full-stack project.', 'Prepare for an internship.'] },
      },
      baseline
    ),
    true
  );
});

test('P34: Draft retention on save failure and recovery over older server state', () => {
  const oldServerProfile = {
    name: 'Aritra',
    email: 'student@example.com',
    currentCourse: 'Computer science student',
    activeCurriculum: [],
    futureGoals: { shortTerm: [], longTerm: [] },
  };

  const pendingDraft = {
    name: 'Aritra (Drafted)',
    currentCourse: 'AI/ML Engineering Student',
    activeCurriculum: [
      { title: 'Distributed Systems', platform: 'Self-paced', progress: 20, estCompletion: 'In progress' },
    ],
    futureGoals: {
      shortTerm: ['Finish capstone project.'],
    },
  };

  const recovered = reconcileProfileWithDraft(oldServerProfile, pendingDraft);
  assert.equal(recovered.name, 'Aritra (Drafted)');
  assert.equal(recovered.currentCourse, 'AI/ML Engineering Student');
  assert.equal(recovered.activeCurriculum.length, 1);
  assert.equal(recovered.activeCurriculum[0].title, 'Distributed Systems');
  assert.equal(recovered.futureGoals.shortTerm[0], 'Finish capstone project.');
});

// =============================================================
// TEST SUITE: P35 — Settings and Account Lifecycle
// =============================================================

test('P35: Theme option mapping and token resolution', () => {
  assert.equal(THEME_OPTIONS.length, 3);
  assert.equal(THEME_OPTIONS[0].label, 'Monolith Dark');
  assert.equal(THEME_OPTIONS[1].label, 'Monolith Light');
  assert.equal(THEME_OPTIONS[2].label, 'Device setting');

  // Explicit dark
  const darkRes = resolveThemeMode('dark', false);
  assert.equal(darkRes.effectiveDark, true);
  assert.equal(darkRes.tokens, 'darkTokens');

  // Explicit light
  const lightRes = resolveThemeMode('light', true);
  assert.equal(lightRes.effectiveDark, false);
  assert.equal(lightRes.tokens, 'lightTokens');

  // System follows systemIsDark
  const systemDark = resolveThemeMode('system', true);
  assert.equal(systemDark.effectiveDark, true);

  const systemLight = resolveThemeMode('system', false);
  assert.equal(systemLight.effectiveDark, false);
});

test('P35: Notification permission reflection - reflects denied permission honestly', () => {
  // If permission is already granted, toggle on succeeds
  const grantedToggle = handleReminderToggle(false, 'granted');
  assert.equal(grantedToggle.enabled, true);
  assert.equal(grantedToggle.alertRequired, false);

  // If permission is denied, toggle on MUST NOT show enabled
  const deniedToggle = handleReminderToggle(false, 'denied');
  assert.equal(deniedToggle.enabled, false);
  assert.equal(deniedToggle.alertRequired, true);
  assert.match(deniedToggle.alertMessage, /require notification permissions/);

  // Disabling active reminder turns it off
  const turnOff = handleReminderToggle(true, 'granted');
  assert.equal(turnOff.enabled, false);
  assert.equal(turnOff.newPermissionStatus, 'denied');
});

test('P35: Local device cache clearing does NOT delete server tokens or credentials', () => {
  const dummyAsyncStorageKeys = [
    '@profile_cache_user_123',
    '@profile_draft_user_123',
    '@focus_timer_user_123',
    '@focus_history_user_123',
    '@cache_jobs_user_123',
    '@careerpilot_theme_mode',
    '@auth_user',
    'careerpilot_auth_token',
  ];

  const keysToClear = filterCacheKeysForPurge(dummyAsyncStorageKeys, 'device_clear');

  // Caches and drafts are marked for removal
  assert.ok(keysToClear.includes('@profile_cache_user_123'));
  assert.ok(keysToClear.includes('@profile_draft_user_123'));
  assert.ok(keysToClear.includes('@focus_timer_user_123'));
  assert.ok(keysToClear.includes('@focus_history_user_123'));
  assert.ok(keysToClear.includes('@cache_jobs_user_123'));

  // Critical authentication records and theme MUST NOT be purged by clear-cache
  assert.ok(!keysToClear.includes('@careerpilot_theme_mode'));
  assert.ok(!keysToClear.includes('@auth_user'));
  assert.ok(!keysToClear.includes('careerpilot_auth_token'));
});

test('P35: Cross-account isolation - logout purges all user data so Account B has zero residual state', () => {
  const accountAStorageKeys = [
    '@auth_user',
    'careerpilot_auth_token',
    '@profile_cache_acc_A',
    '@profile_draft_acc_A',
    '@focus_timer_acc_A',
    '@focus_history_acc_A',
    '@resumes_cache_acc_A',
    '@resume_draft_res_99',
    '@study_materials_acc_A',
    '@recommendations_cache_acc_A',
    '@todo_cache_acc_A',
    '@careerpilot_theme_mode', // Device theme setting
  ];

  const keysPurgedOnLogout = filterCacheKeysForPurge(accountAStorageKeys, 'logout_purge');

  // Every single user-sensitive key must be purged
  assert.ok(keysPurgedOnLogout.includes('@auth_user'));
  assert.ok(keysPurgedOnLogout.includes('careerpilot_auth_token'));
  assert.ok(keysPurgedOnLogout.includes('@profile_cache_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@profile_draft_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@focus_timer_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@focus_history_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@resumes_cache_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@resume_draft_res_99'));
  assert.ok(keysPurgedOnLogout.includes('@study_materials_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@recommendations_cache_acc_A'));
  assert.ok(keysPurgedOnLogout.includes('@todo_cache_acc_A'));

  // Only the device-level theme setting is preserved across logins
  assert.ok(!keysPurgedOnLogout.includes('@careerpilot_theme_mode'));

  // Simulate Account B inspecting storage: zero keys from Account A remain
  const remainingKeysAfterLogout = accountAStorageKeys.filter(
    (k) => !keysPurgedOnLogout.includes(k)
  );
  assert.deepEqual(remainingKeysAfterLogout, ['@careerpilot_theme_mode']);
});
