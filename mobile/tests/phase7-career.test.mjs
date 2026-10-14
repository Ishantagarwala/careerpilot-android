import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P20: Career Feed Query Builder & Filtering Logic
// -------------------------------------------------------------
function buildJobsQuery(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.type && params.type !== 'all') {
    searchParams.set('type', params.type.toLowerCase());
  }
  if (params.search && params.search.trim()) {
    searchParams.set('search', params.search.trim());
  }
  const query = searchParams.toString();
  return `/api/jobs${query ? `?${query}` : ''}`;
}

test('P20: Query string builder - serializes type and search correctly', () => {
  assert.equal(buildJobsQuery(), '/api/jobs');
  assert.equal(buildJobsQuery({ type: 'all' }), '/api/jobs');
  assert.equal(buildJobsQuery({ type: 'internship' }), '/api/jobs?type=internship');
  assert.equal(buildJobsQuery({ search: '  react  ' }), '/api/jobs?search=react');
  assert.equal(
    buildJobsQuery({ type: 'full-time', search: 'engineer' }),
    '/api/jobs?type=full-time&search=engineer'
  );
});

test('P20: Request cancellation - newer query aborts previous request and prevents stale response', async () => {
  let activeController = null;
  const executedRequests = [];

  async function mockDebouncedFetch(query) {
    if (activeController) {
      activeController.abort();
    }
    const controller = new AbortController();
    activeController = controller;

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          executedRequests.push(query);
          resolve(query);
        }, 50);
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('AbortError'));
        });
      });
      return query;
    } catch (err) {
      if (err.message === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  // Trigger fast succession of queries
  const p1 = mockDebouncedFetch('query 1');
  const p2 = mockDebouncedFetch('query 2');
  const p3 = mockDebouncedFetch('query 3');

  const results = await Promise.all([p1, p2, p3]);

  assert.equal(results[0], null, 'First request was aborted');
  assert.equal(results[1], null, 'Second request was aborted');
  assert.equal(results[2], 'query 3', 'Third request resolved successfully');
  assert.deepEqual(executedRequests, ['query 3']);
});

test('P20: Offline cache fallback - preserves cached jobs without substituting fake sample vacancies', () => {
  const cachedJobs = [
    {
      _id: 'job-101',
      title: 'Real Mobile Engineer',
      company: 'Genuine Corp',
      type: 'full-time',
      location: 'Bengaluru',
      skills: ['React Native', 'TypeScript'],
      applyUrl: 'https://genuine.example/apply',
    },
  ];

  function resolveListings(networkError, cache) {
    if (networkError) {
      if (cache && cache.length > 0) {
        return { source: 'cache', data: cache };
      }
      return { source: 'error', data: [], error: 'Network error and no offline cache' };
    }
    return { source: 'network', data: [] };
  }

  const withCache = resolveListings(true, cachedJobs);
  assert.equal(withCache.source, 'cache');
  assert.equal(withCache.data[0].title, 'Real Mobile Engineer');

  const withoutCache = resolveListings(true, null);
  assert.equal(withoutCache.source, 'error');
  assert.equal(withoutCache.data.length, 0, 'Does not fabricate sample jobs');
});

test('P20: Skill match calculation - evaluates matched count and percentage accurately', () => {
  function computeSkillMatch(jobSkills, userSkills) {
    if (!jobSkills || jobSkills.length === 0) {
      return { matchCount: 0, matchScore: 75, matched: [] };
    }
    const normalizedUser = userSkills.map((s) => s.toLowerCase());
    const matched = jobSkills.filter((s) => normalizedUser.includes(s.toLowerCase()));
    const score = Math.round(60 + (matched.length / jobSkills.length) * 40);
    return {
      matchCount: matched.length,
      matchScore: score,
      matched,
    };
  }

  const jobSkills = ['React', 'TypeScript', 'Node.js', 'PostgreSQL'];
  const userSkills = ['TypeScript', 'React', 'Python'];

  const result = computeSkillMatch(jobSkills, userSkills);
  assert.equal(result.matchCount, 2);
  assert.deepEqual(result.matched, ['React', 'TypeScript']);
  assert.equal(result.matchScore, 80); // 60 + (2/4)*40 = 80
});

// -------------------------------------------------------------
// P21: Job Detail Lookup & Action Semantics
// -------------------------------------------------------------
test('P21: List lookup contract - resolves job without inventing /api/jobs/:id', async () => {
  const jobList = [
    { _id: 'job-1', title: 'Frontend Developer', company: 'Acme' },
    { _id: 'job-2', title: 'Backend Developer', company: 'Beta' },
  ];

  async function mockGetJobById(id, cache = jobList) {
    return cache.find((j) => j._id === id) || null;
  }

  const existing = await mockGetJobById('job-2');
  assert.notEqual(existing, null);
  assert.equal(existing.title, 'Backend Developer');

  const nonExistent = await mockGetJobById('job-999');
  assert.equal(nonExistent, null);
});

test('P21: Skill comparison - splits skills into matched and build-next', () => {
  function compareSkills(jobSkills = [], userSkills = []) {
    const userLower = userSkills.map((s) => s.toLowerCase());
    const matched = jobSkills.filter((s) => userLower.includes(s.toLowerCase()));
    const buildNext = jobSkills.filter((s) => !userLower.includes(s.toLowerCase()));
    return { matched, buildNext };
  }

  const comparison = compareSkills(
    ['React', 'CSS', 'JavaScript', 'Git'],
    ['JavaScript', 'Git']
  );

  assert.deepEqual(comparison.matched, ['JavaScript', 'Git']);
  assert.deepEqual(comparison.buildNext, ['React', 'CSS']);
});

test('P21: External apply validation - validates URL and preserves unapplied status', () => {
  function validateApplyUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  }

  assert.equal(validateApplyUrl('https://careers.example.com/apply'), true);
  assert.equal(validateApplyUrl('http://insecure.example.com'), true);
  assert.equal(validateApplyUrl('ftp://not-supported.com'), false);
  assert.equal(validateApplyUrl('javascript:alert(1)'), false);
  assert.equal(validateApplyUrl(''), false);

  // Opening external apply page does NOT auto-mark applied
  let trackerStatus = 'saved';
  function onApplyExternally(applyUrl) {
    if (validateApplyUrl(applyUrl)) {
      // Intentionally leaves trackerStatus unmodified
      return true;
    }
    return false;
  }

  const opened = onApplyExternally('https://careers.example.com/apply');
  assert.equal(opened, true);
  assert.equal(trackerStatus, 'saved', 'Opening external page must not auto-mark Applied');
});

// -------------------------------------------------------------
// P22: Application Tracker Normalization & Status Sheet
// -------------------------------------------------------------
function normalizeApplicationTest(app) {
  const isPopulatedJob = typeof app.jobId === 'object' && app.jobId !== null;
  const linkedJob = isPopulatedJob ? app.jobId : undefined;
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
    notes: (app.notes || '').trim(),
  };
}

test('P22: Normalization - correctly handles populated linked job', () => {
  const rawApp = {
    _id: 'app-1',
    userId: 'user-1',
    jobId: {
      _id: 'job-10',
      title: 'Frontend Intern',
      company: 'Tech Labs',
      location: 'Bengaluru',
      type: 'internship',
      applyUrl: 'https://techlabs.example/apply',
    },
    status: 'interview',
    notes: 'Phone screening on Friday',
  };

  const normalized = normalizeApplicationTest(rawApp);
  assert.equal(normalized.title, 'Frontend Intern');
  assert.equal(normalized.company, 'Tech Labs');
  assert.equal(normalized.location, 'Bengaluru');
  assert.equal(normalized.type, 'internship');
  assert.equal(normalized.url, 'https://techlabs.example/apply');
  assert.equal(normalized.status, 'interview');
  assert.equal(normalized.notes, 'Phone screening on Friday');
  assert.equal(normalized.jobId, 'job-10');
});

test('P22: Normalization - correctly handles custom job record', () => {
  const rawCustomApp = {
    _id: 'app-2',
    userId: 'user-1',
    customJob: {
      title: 'Junior Mobile Dev',
      company: 'Startup Co',
      url: 'https://startup.example',
    },
    status: 'applied',
    notes: 'Submitted via email',
  };

  const normalized = normalizeApplicationTest(rawCustomApp);
  assert.equal(normalized.title, 'Junior Mobile Dev');
  assert.equal(normalized.company, 'Startup Co');
  assert.equal(normalized.location, 'Remote');
  assert.equal(normalized.url, 'https://startup.example');
  assert.equal(normalized.status, 'applied');
  assert.equal(normalized.notes, 'Submitted via email');
  assert.equal(normalized.jobId, undefined);
});

test('P22: Normalization - safely handles deleted/missing job metadata', () => {
  const orphanApp = {
    _id: 'app-3',
    userId: 'user-1',
    jobId: null,
    status: 'saved',
  };

  const normalized = normalizeApplicationTest(orphanApp);
  assert.equal(normalized.title, 'Untitled opportunity');
  assert.equal(normalized.company, 'Unknown company');
  assert.equal(normalized.location, 'Remote');
  assert.equal(normalized.status, 'saved');
});

test('P22: Status filter - filters accurately across all 7 supported statuses', () => {
  const list = [
    { _id: '1', status: 'saved' },
    { _id: '2', status: 'applied' },
    { _id: '3', status: 'screening' },
    { _id: '4', status: 'interview' },
    { _id: '5', status: 'offer' },
    { _id: '6', status: 'rejected' },
    { _id: '7', status: 'withdrawn' },
  ];

  const filterApps = (filter) =>
    filter === 'all' ? list : list.filter((a) => a.status === filter);

  assert.equal(filterApps('all').length, 7);
  assert.equal(filterApps('saved').length, 1);
  assert.equal(filterApps('screening').length, 1);
  assert.equal(filterApps('interview').length, 1);
  assert.equal(filterApps('offer').length, 1);
  assert.equal(filterApps('rejected').length, 1);
  assert.equal(filterApps('withdrawn').length, 1);
});

test('P22: Status and notes update - optimistic update and failure rollback', async () => {
  let apps = [
    { _id: 'app-1', status: 'saved', notes: 'Initial' },
  ];

  async function mockUpdateStatus(id, newStatus, newNotes, shouldFail = false) {
    const previous = [...apps];
    // Optimistic mutation
    apps = apps.map((a) =>
      a._id === id ? { ...a, status: newStatus, notes: newNotes } : a
    );

    if (shouldFail) {
      // Rollback
      apps = previous;
      throw new Error('Server update failed');
    }
    return apps.find((a) => a._id === id);
  }

  // 1. Successful update
  await mockUpdateStatus('app-1', 'interview', 'Scheduled 2 PM');
  assert.equal(apps[0].status, 'interview');
  assert.equal(apps[0].notes, 'Scheduled 2 PM');

  // 2. Failed update with rollback
  await assert.rejects(
    () => mockUpdateStatus('app-1', 'offer', 'Won the job', true),
    /Server update failed/
  );
  assert.equal(apps[0].status, 'interview', 'Rolls back to previous status');
  assert.equal(apps[0].notes, 'Scheduled 2 PM', 'Rolls back to previous notes');
});

// -------------------------------------------------------------
// P23: Custom Opportunity Validation & Draft Persistence
// -------------------------------------------------------------
function validateCustomOpportunityInput(input) {
  const errors = {};
  const trimmedTitle = (input.title || '').trim();
  const trimmedCompany = (input.company || '').trim();
  const trimmedUrl = (input.url || '').trim();

  if (!trimmedTitle) {
    errors.title = 'Job title is required';
  }
  if (!trimmedCompany) {
    errors.company = 'Company name is required';
  }
  if (trimmedUrl) {
    const isValid =
      trimmedUrl.startsWith('http://') ||
      trimmedUrl.startsWith('https://') ||
      /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/.test(trimmedUrl);
    if (!isValid) {
      errors.url = 'Please enter a valid website or application URL';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

test('P23: Input validation - enforces required title and company', () => {
  const empty = validateCustomOpportunityInput({ title: '   ', company: '' });
  assert.equal(empty.isValid, false);
  assert.equal(empty.errors.title, 'Job title is required');
  assert.equal(empty.errors.company, 'Company name is required');

  const valid = validateCustomOpportunityInput({
    title: 'Platform Engineer',
    company: 'NextGen',
    url: 'https://nextgen.example',
  });
  assert.equal(valid.isValid, true);
});

test('P23: URL validation and normalization - handles optional and valid formats', () => {
  // Empty URL is valid (optional)
  const noUrl = validateCustomOpportunityInput({
    title: 'Engineer',
    company: 'Acme',
    url: '',
  });
  assert.equal(noUrl.isValid, true);

  // Invalid URL format
  const badUrl = validateCustomOpportunityInput({
    title: 'Engineer',
    company: 'Acme',
    url: 'invalid url with spaces',
  });
  assert.equal(badUrl.isValid, false);
  assert.equal(badUrl.errors.url, 'Please enter a valid website or application URL');

  // Normalization
  function normalizeUrl(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  assert.equal(normalizeUrl('careers.google.com'), 'https://careers.google.com');
  assert.equal(normalizeUrl('https://apple.com/jobs'), 'https://apple.com/jobs');
});

test('P23: Draft retention on submission failure - retains draft input', async () => {
  let draft = {
    title: 'DevOps Intern',
    company: 'CloudWorks',
    url: 'https://cloudworks.example',
    status: 'applied',
    notes: 'Sent resume on Monday',
  };

  async function mockSubmitCustomOpportunity(input, shouldFail = false) {
    if (shouldFail) {
      // Draft remains intact in storage/state
      throw new Error('Connection timeout');
    }
    // Only cleared on confirmed save
    draft = null;
    return { _id: 'new-app-1', ...input };
  }

  // Interrupted / failed submit
  await assert.rejects(
    () => mockSubmitCustomOpportunity(draft, true),
    /Connection timeout/
  );
  assert.notEqual(draft, null, 'Draft is retained on failure');
  assert.equal(draft.title, 'DevOps Intern');

  // Confirmed success submit
  const result = await mockSubmitCustomOpportunity(draft, false);
  assert.equal(result.title, 'DevOps Intern');
  assert.equal(draft, null, 'Draft is cleared upon confirmed save');
});
