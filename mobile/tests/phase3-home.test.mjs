import test from 'node:test';
import assert from 'node:assert/strict';

// Test readiness breakdown and score computation matching backend formula
function computeReadinessBreakdown(data) {
  const milestoneCompletionRate = data.roadmap?.milestoneCompletionRate || 0;
  const milestoneScore = Math.round(milestoneCompletionRate * 0.4);
  const coursesScore = Math.min((data.metrics?.coursesCompleted || 0) * 10, 30);
  const pdfsScore = Math.min((data.metrics?.pdfsAnalyzed || 0) * 5, 15);
  const tutorScore = Math.min((data.metrics?.tutorSessions || 0) * 3, 15);
  const rawTotal = (milestoneCompletionRate * 0.4) + coursesScore + pdfsScore + tutorScore;
  const totalScore = Math.min(Math.floor(rawTotal), 100);

  return {
    milestoneScore,
    milestoneCompletionRate,
    coursesScore,
    pdfsScore,
    tutorScore,
    totalScore,
  };
}

// Test streak week calculation logic
function isDayInStreak(dayIndex, todayDayIndex, streakDays) {
  if (streakDays <= 0) return false;
  if (streakDays >= 7) return true;
  const diff = (todayDayIndex - dayIndex + 7) % 7;
  return diff < streakDays;
}

// Test account state decision
function resolveHomeAccountState(progressData) {
  const hasCareerPath = Boolean(
    progressData?.roadmap?.careerPath && progressData.roadmap.careerPath.trim().length > 0
  );
  return hasCareerPath ? 'returning' : 'new';
}

test('P04: Home state resolution - new account with no career path', () => {
  const newAccountData = {
    metrics: { coursesCompleted: 0, pdfsAnalyzed: 0, tutorSessions: 0, streakDays: 0 },
    roadmap: { careerPath: null, totalMilestones: 0, completedMilestones: 0 },
    readinessScore: 0,
  };

  assert.equal(resolveHomeAccountState(newAccountData), 'new');
  assert.equal(resolveHomeAccountState(null), 'new');
  assert.equal(resolveHomeAccountState({ roadmap: { careerPath: '' } }), 'new');
});

test('P04: Home state resolution - returning account with active career path', () => {
  const returningData = {
    metrics: { coursesCompleted: 3, pdfsAnalyzed: 3, tutorSessions: 1, streakDays: 7 },
    roadmap: {
      careerPath: 'Software Engineer',
      currentStage: 'intermediate',
      totalMilestones: 12,
      completedMilestones: 5,
    },
    readinessScore: 64,
  };

  assert.equal(resolveHomeAccountState(returningData), 'returning');
});

test('P04: Readiness score - approved preview example (5/12 milestones, 3 courses, 3 PDFs, 1 tutor)', () => {
  const previewData = {
    metrics: {
      coursesCompleted: 3,
      pdfsAnalyzed: 3,
      tutorSessions: 1,
      streakDays: 7,
    },
    roadmap: {
      careerPath: 'Software Engineer',
      totalMilestones: 12,
      completedMilestones: 5,
      milestoneCompletionRate: (5 / 12) * 100, // 41.666%
    },
  };

  const breakdown = computeReadinessBreakdown(previewData);

  // Milestones: 41.666% * 0.4 = 16.666 -> rounded to 17 pts
  assert.equal(breakdown.milestoneScore, 17);
  // Courses: 3 * 10 = 30 pts (max 30)
  assert.equal(breakdown.coursesScore, 30);
  // PDFs: 3 * 5 = 15 pts (max 15)
  assert.equal(breakdown.pdfsScore, 15);
  // Tutor: 1 * 3 = 3 pts
  assert.equal(breakdown.tutorScore, 3);
  // Total: floor(16.666 + 30 + 15 + 3) = floor(64.666) = 64 / 100
  assert.equal(breakdown.totalScore, 64);
});

test('P04: Readiness score - new account with zero progress', () => {
  const zeroData = {
    metrics: { coursesCompleted: 0, pdfsAnalyzed: 0, tutorSessions: 0 },
    roadmap: { milestoneCompletionRate: 0 },
  };

  const breakdown = computeReadinessBreakdown(zeroData);
  assert.equal(breakdown.milestoneScore, 0);
  assert.equal(breakdown.coursesScore, 0);
  assert.equal(breakdown.pdfsScore, 0);
  assert.equal(breakdown.tutorScore, 0);
  assert.equal(breakdown.totalScore, 0);
});

test('P04: Readiness score - maximum capped progress (100/100 limit)', () => {
  const maxData = {
    metrics: {
      coursesCompleted: 10, // capped at 30
      pdfsAnalyzed: 10, // capped at 15
      tutorSessions: 20, // capped at 15
    },
    roadmap: { milestoneCompletionRate: 100 }, // 40
  };

  const breakdown = computeReadinessBreakdown(maxData);
  assert.equal(breakdown.milestoneScore, 40);
  assert.equal(breakdown.coursesScore, 30);
  assert.equal(breakdown.pdfsScore, 15);
  assert.equal(breakdown.tutorScore, 15);
  assert.equal(breakdown.totalScore, 100);
});

test('P04: Streak week grid - zero streak days marks all days inactive', () => {
  const todayIndex = 2; // Tuesday
  for (let day = 0; day < 7; day++) {
    assert.equal(isDayInStreak(day, todayIndex, 0), false);
  }
});

test('P04: Streak week grid - 7-day streak marks all days active', () => {
  const todayIndex = 6; // Saturday
  for (let day = 0; day < 7; day++) {
    assert.equal(isDayInStreak(day, todayIndex, 7), true);
  }
});

test('P04: Streak week grid - 3-day streak ending Tuesday marks Sun, Mon, Tue active', () => {
  const todayIndex = 2; // Tuesday
  assert.equal(isDayInStreak(2, todayIndex, 3), true);  // Tuesday (today)
  assert.equal(isDayInStreak(1, todayIndex, 3), true);  // Monday (yesterday)
  assert.equal(isDayInStreak(0, todayIndex, 3), true);  // Sunday (2 days ago)
  assert.equal(isDayInStreak(3, todayIndex, 3), false); // Wednesday
  assert.equal(isDayInStreak(4, todayIndex, 3), false); // Thursday
  assert.equal(isDayInStreak(5, todayIndex, 3), false); // Friday
  assert.equal(isDayInStreak(6, todayIndex, 3), false); // Saturday
});

test('P04: Streak week grid - week boundary wrap (Sunday today with 2-day streak)', () => {
  const todayIndex = 0; // Sunday
  assert.equal(isDayInStreak(0, todayIndex, 2), true);  // Sunday (today)
  assert.equal(isDayInStreak(6, todayIndex, 2), true);  // Saturday (yesterday)
  assert.equal(isDayInStreak(5, todayIndex, 2), false); // Friday
  assert.equal(isDayInStreak(1, todayIndex, 2), false); // Monday
});

test('P04: Offline cache fallback contract', () => {
  const mockCacheStore = new Map();
  const cacheKey = '@cache_home_progress_usr_123';

  const sampleProgress = {
    metrics: { coursesCompleted: 2, pdfsAnalyzed: 1, tutorSessions: 0, streakDays: 3 },
    roadmap: { careerPath: 'Frontend Developer', totalMilestones: 8, completedMilestones: 2 },
    readinessScore: 35,
  };

  mockCacheStore.set(cacheKey, JSON.stringify(sampleProgress));

  // Retrieve from cache
  const cachedRaw = mockCacheStore.get(cacheKey);
  assert.ok(cachedRaw);
  const parsed = { ...JSON.parse(cachedRaw), isCached: true };
  assert.equal(parsed.isCached, true);
  assert.equal(parsed.roadmap.careerPath, 'Frontend Developer');
  assert.equal(parsed.readinessScore, 35);
});
