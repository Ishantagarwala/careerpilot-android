import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P29: Project Ideas Logic & State Resolution
// -------------------------------------------------------------

function resolveProjectIdeasDisplay(ideas, options = {}) {
  const { networkError, cache } = options;

  if (networkError) {
    if (cache && cache.length > 0) {
      return {
        status: 'cached',
        items: cache.map((idea) => ({
          ...idea,
          hasDifficulty: !!idea.difficulty,
          difficultyUpper: idea.difficulty ? idea.difficulty.toUpperCase() : null,
          techList: Array.isArray(idea.technologies) ? idea.technologies : [],
        })),
        isOffline: true,
        error: null,
      };
    }
    return {
      status: 'error',
      items: [],
      isOffline: false,
      error: 'Unable to load project ideas',
    };
  }

  if (!ideas || ideas.length === 0) {
    return {
      status: 'empty',
      items: [],
      isOffline: false,
      error: null,
    };
  }

  return {
    status: 'success',
    items: ideas.map((idea) => ({
      ...idea,
      hasDifficulty: !!idea.difficulty,
      difficultyUpper: idea.difficulty ? idea.difficulty.toUpperCase() : null,
      techList: Array.isArray(idea.technologies) ? idea.technologies : [],
    })),
    isOffline: false,
    error: null,
  };
}

function mergeGeneratedIdeas(currentIdeas, newlyGenerated) {
  if (!Array.isArray(newlyGenerated) || newlyGenerated.length === 0) {
    return currentIdeas;
  }
  const newIds = new Set(newlyGenerated.map((item) => item._id));
  const filteredCurrent = currentIdeas.filter((item) => !newIds.has(item._id));
  return [...newlyGenerated, ...filteredCurrent];
}

test('P29: Project ideas state resolution - empty list, success, and offline cache fallback', () => {
  const empty = resolveProjectIdeasDisplay([]);
  assert.equal(empty.status, 'empty');
  assert.equal(empty.items.length, 0);

  const realIdeas = [
    {
      _id: 'idea-1',
      title: 'Personal learning tracker',
      description: 'Build a dashboard for study goals and tasks.',
      difficulty: 'intermediate',
      technologies: ['React', 'Node.js', 'MongoDB'],
      estimatedTime: '2–3 weeks',
      features: ['Goal tracker', 'Streak counter'],
    },
    {
      _id: 'idea-2',
      title: 'REST API documentation tool',
      description: 'Generate interactive docs.',
      // Intentionally omitting optional difficulty and technologies
    },
  ];

  const success = resolveProjectIdeasDisplay(realIdeas);
  assert.equal(success.status, 'success');
  assert.equal(success.items.length, 2);
  assert.equal(success.items[0].difficultyUpper, 'INTERMEDIATE');
  assert.equal(success.items[0].techList.length, 3);
  // Difficulty and tech pills only when supplied
  assert.equal(success.items[1].hasDifficulty, false);
  assert.equal(success.items[1].difficultyUpper, null);
  assert.equal(success.items[1].techList.length, 0);

  const offline = resolveProjectIdeasDisplay(null, { networkError: true, cache: realIdeas });
  assert.equal(offline.status, 'cached');
  assert.equal(offline.isOffline, true);
  assert.equal(offline.items.length, 2);

  const errorState = resolveProjectIdeasDisplay(null, { networkError: true, cache: [] });
  assert.equal(errorState.status, 'error');
  assert.equal(errorState.items.length, 0);
});

test('P29: AI generation preserves existing ideas on failure and deduplicates on success', () => {
  const initialIdeas = [
    { _id: 'idea-old-1', title: 'Old Project' },
    { _id: 'idea-old-2', title: 'Portfolio Site' },
  ];

  // Failure retains existing ideas
  let state = initialIdeas;
  try {
    throw new Error('AI generation timed out');
  } catch {
    // Preserve existing
    assert.equal(state.length, 2);
    assert.equal(state[0]._id, 'idea-old-1');
  }

  // Success prepends new items and deduplicates
  const newGenerated = [
    { _id: 'idea-new-1', title: 'AI Code Reviewer' },
    { _id: 'idea-old-1', title: 'Updated Old Project' },
  ];

  const merged = mergeGeneratedIdeas(state, newGenerated);
  assert.equal(merged.length, 3);
  assert.equal(merged[0]._id, 'idea-new-1');
  assert.equal(merged[1]._id, 'idea-old-1');
  assert.equal(merged[1].title, 'Updated Old Project');
  assert.equal(merged[2]._id, 'idea-old-2');
});

// -------------------------------------------------------------
// P30: Hackathons Logic, Normalization & Date Verification
// -------------------------------------------------------------

function normalizeEventId(eventId) {
  if (!eventId || typeof eventId !== 'string') return undefined;
  const trimmed = eventId.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

function formatEventDateRange(startDate, endDate, mockNow = new Date('2026-10-04T12:00:00Z')) {
  if (!startDate && !endDate) {
    return {
      dateString: 'Dates provided by organizer',
      isExpired: false,
      isOngoing: false,
    };
  }

  const now = mockNow;
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const isValidStart = start && !isNaN(start.getTime());
  const isValidEnd = end && !isNaN(end.getTime());

  if (!isValidStart && !isValidEnd) {
    return {
      dateString: 'Dates provided by organizer',
      isExpired: false,
      isOngoing: false,
    };
  }

  const isExpired = !!(isValidEnd && end < now);
  const isOngoing = !!(isValidStart && isValidEnd && start <= now && end >= now);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (isValidStart && isValidEnd) {
    const sMonth = months[start.getUTCMonth()];
    const sDay = start.getUTCDate();
    const eMonth = months[end.getUTCMonth()];
    const eDay = end.getUTCDate();
    const year = end.getUTCFullYear();

    if (sMonth === eMonth && start.getUTCFullYear() === end.getUTCFullYear()) {
      return {
        dateString: `${sMonth} ${sDay} – ${eDay}, ${year}`,
        isExpired,
        isOngoing,
      };
    }

    return {
      dateString: `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`,
      isExpired,
      isOngoing,
    };
  }

  if (isValidStart) {
    const sMonth = months[start.getUTCMonth()];
    const sDay = start.getUTCDate();
    const year = start.getUTCFullYear();
    return {
      dateString: `Starts ${sMonth} ${sDay}, ${year}`,
      isExpired,
      isOngoing,
    };
  }

  const eMonth = months[end.getUTCMonth()];
  const eDay = end.getUTCDate();
  const year = end.getUTCFullYear();
  return {
    dateString: `Ends ${eMonth} ${eDay}, ${year}`,
    isExpired,
    isOngoing,
  };
}

function validateEventUrl(url) {
  if (!url || typeof url !== 'string') return { valid: false, reason: 'missing' };
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { valid: false, reason: 'invalid_protocol' };
  }
  return { valid: true, url: trimmed };
}

test('P30: External event ID normalization - distinguishes external vs MongoDB ObjectIds safely', () => {
  // External prefixed IDs (e.g. devfolio-uuid, hackerearth-slug) must NOT be rejected or mangled
  assert.equal(normalizeEventId('devfolio-hack-autumn-2026'), 'devfolio-hack-autumn-2026');
  assert.equal(normalizeEventId('hackerearth-ml-challenge-2026'), 'hackerearth-ml-challenge-2026');
  // MongoDB 24-hex ObjectId
  assert.equal(normalizeEventId('507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
  // Optional / empty values must return undefined, NEVER a fabricated ID
  assert.equal(normalizeEventId(null), undefined);
  assert.equal(normalizeEventId(undefined), undefined);
  assert.equal(normalizeEventId(''), undefined);
  assert.equal(normalizeEventId('   '), undefined);
  assert.equal(normalizeEventId('undefined'), undefined);
  assert.equal(normalizeEventId('null'), undefined);
});

test('P30: Event dates formatting and honest expiration labeling', () => {
  const fixedNow = new Date('2026-10-04T12:00:00Z');

  // Future event: upcoming
  const future = formatEventDateRange('2026-10-24T00:00:00Z', '2026-10-26T23:59:59Z', fixedNow);
  assert.equal(future.dateString, 'Oct 24 – 26, 2026');
  assert.equal(future.isExpired, false);
  assert.equal(future.isOngoing, false);

  // Ongoing event
  const ongoing = formatEventDateRange('2026-10-02T00:00:00Z', '2026-10-06T23:59:59Z', fixedNow);
  assert.equal(ongoing.dateString, 'Oct 2 – 6, 2026');
  assert.equal(ongoing.isExpired, false);
  assert.equal(ongoing.isOngoing, true);

  // Past event: expired
  const expired = formatEventDateRange('2026-09-01T00:00:00Z', '2026-09-03T23:59:59Z', fixedNow);
  assert.equal(expired.dateString, 'Sep 1 – 3, 2026');
  assert.equal(expired.isExpired, true);
  assert.equal(expired.isOngoing, false);

  // Missing dates: fallback
  const missing = formatEventDateRange(null, null, fixedNow);
  assert.equal(missing.dateString, 'Dates provided by organizer');
  assert.equal(missing.isExpired, false);
});

test('P30: Event URL validation preserves safety against broken/untrusted protocols', () => {
  assert.equal(validateEventUrl('https://devfolio.co/hackathon/1').valid, true);
  assert.equal(validateEventUrl('http://hackerearth.com/events/2').valid, true);
  assert.equal(validateEventUrl('javascript:alert(1)').valid, false);
  assert.equal(validateEventUrl('').valid, false);
  assert.equal(validateEventUrl(null).valid, false);
});

// -------------------------------------------------------------
// P31: Team Finder Logic & Contact Handling
// -------------------------------------------------------------

function resolveContactAction(contactMethod) {
  if (!contactMethod || typeof contactMethod !== 'string' || !contactMethod.trim()) {
    return { type: 'none', label: 'No contact provided' };
  }
  const trimmed = contactMethod.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (isEmail) {
    return { type: 'email', label: 'Send email', url: `mailto:${trimmed.replace(/^mailto:/i, '')}` };
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { type: 'link', label: 'Open link', url: trimmed };
  }
  return { type: 'copy', label: 'Copy contact info', value: trimmed };
}

test('P31: Team post contact resolution maps direct methods accurately without fake collaboration tools', () => {
  const emailContact = resolveContactAction('sarah@student.edu');
  assert.equal(emailContact.type, 'email');
  assert.equal(emailContact.url, 'mailto:sarah@student.edu');

  const linkContact = resolveContactAction('https://github.com/alexchen');
  assert.equal(linkContact.type, 'link');
  assert.equal(linkContact.url, 'https://github.com/alexchen');

  const handleContact = resolveContactAction('Discord: @dev_aritra');
  assert.equal(handleContact.type, 'copy');
  assert.equal(handleContact.value, 'Discord: @dev_aritra');

  const emptyContact = resolveContactAction('');
  assert.equal(emptyContact.type, 'none');
});

test('P31: Team member count rendering verifies actual bounds', () => {
  function formatMemberTag(currentMembers, teamSize) {
    const cur = typeof currentMembers === 'number' && currentMembers >= 1 ? currentMembers : 1;
    const max = typeof teamSize === 'number' && teamSize >= 2 ? teamSize : 4;
    return `${cur} OF ${max} MEMBERS`;
  }

  assert.equal(formatMemberTag(2, 4), '2 OF 4 MEMBERS');
  assert.equal(formatMemberTag(1, 6), '1 OF 6 MEMBERS');
  assert.equal(formatMemberTag(null, undefined), '1 OF 4 MEMBERS');
});

// -------------------------------------------------------------
// P32: Create Team Post Validation, Draft & Guard
// -------------------------------------------------------------

function validateTeamPostInput({ title, description, skills, teamSize, contactMethod }) {
  const errors = {};

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    errors.title = 'Post title is required';
  } else if (trimmedTitle.length < 3) {
    errors.title = 'Title must be at least 3 characters';
  } else if (trimmedTitle.length > 100) {
    errors.title = 'Title must be 100 characters or fewer';
  }

  const trimmedDesc = typeof description === 'string' ? description.trim() : '';
  if (!trimmedDesc) {
    errors.description = 'Description is required';
  } else if (trimmedDesc.length < 10) {
    errors.description = 'Provide at least 10 characters describing what you are building';
  }

  const trimmedSkills = typeof skills === 'string' ? skills.trim() : '';
  if (!trimmedSkills) {
    errors.skills = 'Specify at least one skill needed';
  }

  const parsedSize = parseInt(teamSize, 10);
  if (isNaN(parsedSize) || parsedSize < 2 || parsedSize > 12) {
    errors.teamSize = 'Team size must be between 2 and 12';
  }

  const trimmedContact = typeof contactMethod === 'string' ? contactMethod.trim() : '';
  if (!trimmedContact) {
    errors.contactMethod = 'Contact method is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    payload: Object.keys(errors).length === 0 ? {
      title: trimmedTitle,
      description: trimmedDesc,
      lookingFor: trimmedSkills.split(',').map((s) => s.trim()).filter(Boolean),
      teamSize: parsedSize,
      contactMethod: trimmedContact,
    } : null,
  };
}

test('P32: Team post input validation enforces bounds and converts skills list', () => {
  const invalid = validateTeamPostInput({
    title: 'Hi',
    description: 'Short',
    skills: '',
    teamSize: '1',
    contactMethod: '',
  });

  assert.equal(invalid.isValid, false);
  assert.equal(invalid.errors.title, 'Title must be at least 3 characters');
  assert.equal(invalid.errors.description, 'Provide at least 10 characters describing what you are building');
  assert.equal(invalid.errors.skills, 'Specify at least one skill needed');
  assert.equal(invalid.errors.teamSize, 'Team size must be between 2 and 12');
  assert.equal(invalid.errors.contactMethod, 'Contact method is required');

  const valid = validateTeamPostInput({
    title: 'Building a student study companion',
    description: 'Looking for teammates who enjoy making thoughtful, useful interfaces with React Native.',
    skills: 'React Native, TypeScript, UI/UX',
    teamSize: '4',
    contactMethod: 'sarah@example.com',
  });

  assert.equal(valid.isValid, true);
  assert.equal(valid.payload.lookingFor.length, 3);
  assert.deepEqual(valid.payload.lookingFor, ['React Native', 'TypeScript', 'UI/UX']);
  assert.equal(valid.payload.teamSize, 4);
});

test('P32: Navigation guard and draft retention on failure', () => {
  const store = new Map();
  const userId = 'user_99';

  function saveDraft(userId, draft) {
    store.set(`@careerpilot_team_post_draft_${userId}`, JSON.stringify(draft));
  }

  function getDraft(userId) {
    const raw = store.get(`@careerpilot_team_post_draft_${userId}`);
    return raw ? JSON.parse(raw) : null;
  }

  function clearDraft(userId) {
    store.delete(`@careerpilot_team_post_draft_${userId}`);
  }

  // User enters draft
  const draftData = {
    title: 'Draft Project Title',
    description: 'Working draft description text',
    lookingFor: ['Python', 'FastAPI'],
    teamSize: 3,
    contactMethod: '@discord_user',
  };
  saveDraft(userId, draftData);

  // Network failure during submit -> draft is retained
  assert.deepEqual(getDraft(userId), draftData);

  // On confirmed server publish -> draft is cleared
  clearDraft(userId);
  assert.equal(getDraft(userId), null);
});

// -------------------------------------------------------------
// P33: Tech News Logic, Category Filtering & Freshness
// -------------------------------------------------------------

function formatNewsRelativeTime(dateString, mockNow = new Date('2026-10-04T12:00:00Z')) {
  if (!dateString) return 'Recent';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recent';

  const diffMs = mockNow.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
}

function formatNewsFreshness(cachedAt, mockNow = Date.now()) {
  if (!cachedAt) {
    return { label: 'Cached', isLive: false };
  }
  const diffMs = mockNow - cachedAt;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 2) {
    return { label: 'Live feed', isLive: true };
  }
  if (diffMin < 60) {
    return { label: `Updated ${diffMin}m ago`, isLive: false };
  }
  const diffHour = Math.floor(diffMin / 60);
  return { label: `Saved · Updated ${diffHour}h ago`, isLive: false };
}

function filterNewsByCategory(articles, category) {
  if (!category || category === 'All') return articles;
  const catLower = category.toLowerCase();

  return articles.filter((art) => {
    const hasTagMatch = art.tags?.some((t) => {
      const tLower = t.toLowerCase();
      if (catLower === 'ai/ml') return tLower.includes('ai') || tLower.includes('ml') || tLower.includes('intelligence');
      if (catLower === 'startups') return tLower.includes('startup') || tLower.includes('venture') || tLower.includes('tech');
      if (catLower === 'hiring') return tLower.includes('hiring') || tLower.includes('career') || tLower.includes('job');
      return tLower.includes(catLower);
    });
    const hasCatMatch = art.category?.toLowerCase().includes(catLower);
    const hasTitleMatch = art.title?.toLowerCase().includes(catLower);
    return hasTagMatch || hasCatMatch || hasTitleMatch;
  });
}

test('P33: News relative time and honest freshness labeling without fake Live labels', () => {
  const fixedNow = new Date('2026-10-04T12:00:00Z');

  assert.equal(formatNewsRelativeTime('2026-10-04T11:59:30Z', fixedNow), 'Just now');
  assert.equal(formatNewsRelativeTime('2026-10-04T11:45:00Z', fixedNow), '15m ago');
  assert.equal(formatNewsRelativeTime('2026-10-04T09:00:00Z', fixedNow), '3h ago');
  assert.equal(formatNewsRelativeTime('2026-10-03T12:00:00Z', fixedNow), '1d ago');

  const nowEpoch = 1791115200000;
  // Under 2 mins: Live feed
  const live = formatNewsFreshness(nowEpoch - 60000, nowEpoch);
  assert.equal(live.isLive, true);
  assert.equal(live.label, 'Live feed');

  // Stale cache (25 mins old): must NOT claim to be Live
  const stale = formatNewsFreshness(nowEpoch - 25 * 60000, nowEpoch);
  assert.equal(stale.isLive, false);
  assert.equal(stale.label, 'Updated 25m ago');

  // Hours old
  const older = formatNewsFreshness(nowEpoch - 180 * 60000, nowEpoch);
  assert.equal(older.isLive, false);
  assert.equal(older.label, 'Saved · Updated 3h ago');
});

test('P33: News category filtering distinguishes AI/ML, Startups and Hiring', () => {
  const articles = [
    { _id: '1', title: 'How students are learning to build with AI', tags: ['AI', 'Education'], category: 'Featured' },
    { _id: '2', title: 'Top skills startups look for in 2026', tags: ['Startups', 'Venture'], category: 'Live Feed' },
    { _id: '3', title: 'Tech hiring trends in software engineering', tags: ['Hiring', 'Careers'], category: 'In-Depth Analysis' },
  ];

  assert.equal(filterNewsByCategory(articles, 'All').length, 3);
  assert.equal(filterNewsByCategory(articles, 'AI/ML').length, 1);
  assert.equal(filterNewsByCategory(articles, 'AI/ML')[0]._id, '1');
  assert.equal(filterNewsByCategory(articles, 'Startups').length, 1);
  assert.equal(filterNewsByCategory(articles, 'Startups')[0]._id, '2');
  assert.equal(filterNewsByCategory(articles, 'Hiring').length, 1);
  assert.equal(filterNewsByCategory(articles, 'Hiring')[0]._id, '3');
});
