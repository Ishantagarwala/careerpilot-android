import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// P19: Timer Calculations & Formatting Logic
// -------------------------------------------------------------
const MODE_DURATIONS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

function calculateRemainingSeconds(targetDeadline, now = Date.now()) {
  if (!targetDeadline) return 0;
  const diff = targetDeadline - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 1000);
}

function formatTimerDisplay(secondsRemaining) {
  const clamped = Math.max(0, secondsRemaining);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// -------------------------------------------------------------
// P19: Timer State Machine
// -------------------------------------------------------------
function createTimerState(initialMode = 'focus') {
  return {
    mode: initialMode,
    status: 'idle',
    secondsRemaining: MODE_DURATIONS[initialMode],
    targetDeadline: null,
    sessionId: null,
    completedSessionIds: [],
  };
}

function startTimer(state, now = Date.now()) {
  const duration = state.secondsRemaining > 0 ? state.secondsRemaining : MODE_DURATIONS[state.mode];
  const deadline = now + duration * 1000;
  const sessionId = `session_${now}`;
  return {
    ...state,
    status: 'running',
    targetDeadline: deadline,
    secondsRemaining: duration,
    sessionId,
  };
}

function pauseTimer(state, now = Date.now()) {
  if (state.status !== 'running' || !state.targetDeadline) return state;
  const remaining = calculateRemainingSeconds(state.targetDeadline, now);
  return {
    ...state,
    status: 'paused',
    secondsRemaining: remaining,
    targetDeadline: null,
  };
}

function resumeTimer(state, now = Date.now()) {
  if (state.status !== 'paused') return state;
  const deadline = now + state.secondsRemaining * 1000;
  return {
    ...state,
    status: 'running',
    targetDeadline: deadline,
  };
}

function resetTimer(state) {
  const defaultDuration = MODE_DURATIONS[state.mode];
  return {
    ...state,
    status: 'idle',
    secondsRemaining: defaultDuration,
    targetDeadline: null,
    sessionId: null,
  };
}

function switchTimerMode(state, newMode) {
  const defaultDuration = MODE_DURATIONS[newMode];
  return {
    ...state,
    mode: newMode,
    status: 'idle',
    secondsRemaining: defaultDuration,
    targetDeadline: null,
    sessionId: null,
  };
}

function handleTimerTickOrRestore(state, now = Date.now()) {
  if (state.status !== 'running' || !state.targetDeadline) {
    return { state, completionEvent: null };
  }

  const remaining = calculateRemainingSeconds(state.targetDeadline, now);

  if (remaining <= 0) {
    const isAlreadyCompleted = state.completedSessionIds.includes(state.sessionId);
    const updatedCompletedIds = isAlreadyCompleted
      ? state.completedSessionIds
      : [...state.completedSessionIds, state.sessionId];

    const nextState = {
      ...state,
      status: 'completed',
      secondsRemaining: 0,
      targetDeadline: null,
      completedSessionIds: updatedCompletedIds,
    };

    const completionEvent = isAlreadyCompleted
      ? null
      : {
          sessionId: state.sessionId,
          mode: state.mode,
          minutes: state.mode === 'focus' ? 25 : 0,
        };

    return { state: nextState, completionEvent };
  }

  return {
    state: { ...state, secondsRemaining: remaining },
    completionEvent: null,
  };
}

// -------------------------------------------------------------
// P19: Focus History & Daily Metrics
// -------------------------------------------------------------
function calculateDailyFocusMetrics(history, referenceDate = new Date()) {
  const startOfDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  const todaySessions = history.filter((h) => {
    const time = new Date(h.completedAt).getTime();
    return time >= startOfDay;
  });

  const totalMinutes = todaySessions.reduce((acc, curr) => acc + (curr.minutes || 0), 0);
  const sessionCount = todaySessions.length;

  let formattedTime = `${totalMinutes}m`;
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    formattedTime = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return {
    todaySessions,
    totalMinutes,
    sessionCount,
    formattedTime,
  };
}

// -------------------------------------------------------------
// P19: Task CRUD & Optimistic Rollback
// -------------------------------------------------------------
function validateTaskInput(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { valid: false, error: 'Task text is required.' };
  }
  return { valid: true, error: null, text: trimmed };
}

function applyOptimisticTaskAdd(currentTasks, text) {
  const tempId = `temp_${Date.now()}`;
  const newTask = {
    _id: tempId,
    text,
    completed: false,
    isPending: true,
  };
  return {
    tasks: [newTask, ...currentTasks],
    tempId,
  };
}

function reconcileTaskAddSuccess(tasks, tempId, serverTask) {
  return tasks.map((t) => (t._id === tempId ? { ...serverTask, isPending: false } : t));
}

function rollbackTaskAddFailure(tasks, tempId) {
  return tasks.filter((t) => t._id !== tempId);
}

function applyOptimisticToggle(tasks, taskId) {
  const target = tasks.find((t) => t._id === taskId);
  if (!target) return { tasks, previousState: null };
  const previousState = target.completed;
  const updatedTasks = tasks.map((t) =>
    t._id === taskId ? { ...t, completed: !previousState } : t
  );
  return { tasks: updatedTasks, previousState };
}

function rollbackOptimisticToggle(tasks, taskId, previousState) {
  return tasks.map((t) =>
    t._id === taskId ? { ...t, completed: previousState } : t
  );
}

function applyOptimisticDelete(tasks, taskId) {
  const targetIndex = tasks.findIndex((t) => t._id === taskId);
  if (targetIndex === -1) return { tasks, removedTask: null, index: -1 };
  const removedTask = tasks[targetIndex];
  return {
    tasks: tasks.filter((t) => t._id !== taskId),
    removedTask,
    index: targetIndex,
  };
}

function rollbackOptimisticDelete(tasks, removedTask, index) {
  if (!removedTask) return tasks;
  const restored = [...tasks];
  restored.splice(index, 0, removedTask);
  return restored;
}

// -------------------------------------------------------------
// Tests
// -------------------------------------------------------------

test('P19: Timer calculation - calculates remaining time accurately from timestamp deadline', () => {
  const now = 1700000000000;
  // 25 minutes from now
  const deadline = now + 25 * 60 * 1000;

  assert.equal(calculateRemainingSeconds(deadline, now), 1500);

  // 10 minutes elapsed
  const tenMinsLater = now + 10 * 60 * 1000;
  assert.equal(calculateRemainingSeconds(deadline, tenMinsLater), 15 * 60);

  // Exactly at deadline
  assert.equal(calculateRemainingSeconds(deadline, deadline), 0);

  // After deadline passed
  assert.equal(calculateRemainingSeconds(deadline, deadline + 5000), 0);
});

test('P19: Timer formatting - tabular digits format for all durations', () => {
  assert.equal(formatTimerDisplay(25 * 60), '25:00');
  assert.equal(formatTimerDisplay(5 * 60), '05:00');
  assert.equal(formatTimerDisplay(15 * 60), '15:00');
  assert.equal(formatTimerDisplay(65), '01:05');
  assert.equal(formatTimerDisplay(9), '00:09');
  assert.equal(formatTimerDisplay(0), '00:00');
  assert.equal(formatTimerDisplay(-10), '00:00');
});

test('P19: Timer state transitions - Start, Pause, Resume, Reset, and Mode switch', () => {
  const t0 = 1700000000000;
  let state = createTimerState('focus');
  assert.equal(state.status, 'idle');
  assert.equal(state.secondsRemaining, 1500);

  // 1. Start timer
  state = startTimer(state, t0);
  assert.equal(state.status, 'running');
  assert.equal(state.targetDeadline, t0 + 1500 * 1000);
  assert.ok(state.sessionId);

  // 2. Pause timer after 500 seconds
  const t1 = t0 + 500 * 1000;
  state = pauseTimer(state, t1);
  assert.equal(state.status, 'paused');
  assert.equal(state.secondsRemaining, 1000);
  assert.equal(state.targetDeadline, null);

  // 3. Resume timer 200 seconds later (paused time does not decrement)
  const t2 = t1 + 200 * 1000;
  state = resumeTimer(state, t2);
  assert.equal(state.status, 'running');
  assert.equal(state.targetDeadline, t2 + 1000 * 1000);

  // 4. Reset timer
  state = resetTimer(state);
  assert.equal(state.status, 'idle');
  assert.equal(state.secondsRemaining, 1500);
  assert.equal(state.targetDeadline, null);

  // 5. Switch to Short Break
  state = switchTimerMode(state, 'shortBreak');
  assert.equal(state.mode, 'shortBreak');
  assert.equal(state.secondsRemaining, 300);

  // 6. Switch to Long Break
  state = switchTimerMode(state, 'longBreak');
  assert.equal(state.mode, 'longBreak');
  assert.equal(state.secondsRemaining, 900);
});

test('P19: Background restoration - restores accurate remaining time after app backgrounding', () => {
  const t0 = 1700000000000;
  let state = createTimerState('focus');
  state = startTimer(state, t0);

  // App is backgrounded for 12 minutes
  const tBackgroundReturn = t0 + 12 * 60 * 1000;
  const result = handleTimerTickOrRestore(state, tBackgroundReturn);

  assert.equal(result.state.status, 'running');
  assert.equal(result.state.secondsRemaining, 13 * 60); // 25 - 12 = 13 minutes remaining
  assert.equal(result.completionEvent, null);
});

test('P19: Completion idempotency - completes session once and prevents duplicate award', () => {
  const t0 = 1700000000000;
  let state = createTimerState('focus');
  state = startTimer(state, t0);

  // App returns after full 25 minutes elapsed
  const tDone = t0 + 26 * 60 * 1000;
  const firstTick = handleTimerTickOrRestore(state, tDone);

  assert.equal(firstTick.state.status, 'completed');
  assert.equal(firstTick.state.secondsRemaining, 0);
  assert.ok(firstTick.completionEvent);
  assert.equal(firstTick.completionEvent.minutes, 25);
  assert.equal(firstTick.completionEvent.sessionId, state.sessionId);

  // Subsequent ticks or background triggers must NOT trigger completion again
  const secondTick = handleTimerTickOrRestore(firstTick.state, tDone + 1000);
  assert.equal(secondTick.completionEvent, null);
  assert.equal(secondTick.state.completedSessionIds.length, 1);
});

test('P19: Breaks do not award focus history minutes', () => {
  const t0 = 1700000000000;
  let breakState = createTimerState('shortBreak');
  breakState = startTimer(breakState, t0);

  const tBreakDone = t0 + 6 * 60 * 1000;
  const breakResult = handleTimerTickOrRestore(breakState, tBreakDone);

  assert.equal(breakResult.state.status, 'completed');
  assert.ok(breakResult.completionEvent);
  assert.equal(breakResult.completionEvent.minutes, 0); // 0 focus minutes for breaks
});

test('P19: Daily focus metrics - calculates device-local history for today and formats display', () => {
  const reference = new Date(2026, 9, 4, 14, 0, 0); // Oct 4, 2026 14:00
  const yesterday = new Date(2026, 9, 3, 16, 0, 0); // Oct 3, 2026

  const history = [
    { id: '1', completedAt: new Date(2026, 9, 4, 9, 30, 0).toISOString(), minutes: 25 },
    { id: '2', completedAt: new Date(2026, 9, 4, 11, 0, 0).toISOString(), minutes: 25 },
    { id: '3', completedAt: yesterday.toISOString(), minutes: 25 }, // From yesterday, should not count in today
  ];

  const metrics = calculateDailyFocusMetrics(history, reference);
  assert.equal(metrics.todaySessions.length, 2);
  assert.equal(metrics.totalMinutes, 50);
  assert.equal(metrics.sessionCount, 2);
  assert.equal(metrics.formattedTime, '50m');

  // Multi-hour formatting
  const threeSessions = [
    ...history,
    { id: '4', completedAt: new Date(2026, 9, 4, 13, 0, 0).toISOString(), minutes: 25 },
  ];
  const metricsThree = calculateDailyFocusMetrics(threeSessions, reference);
  assert.equal(metricsThree.totalMinutes, 75);
  assert.equal(metricsThree.formattedTime, '1h 15m');
});

test('P19: Task input validation - rejects empty and trims whitespace', () => {
  assert.equal(validateTaskInput('').valid, false);
  assert.equal(validateTaskInput('   ').valid, false);
  assert.equal(validateTaskInput(null).valid, false);

  const valid = validateTaskInput('  Complete LeetCode DP challenge  ');
  assert.equal(valid.valid, true);
  assert.equal(valid.text, 'Complete LeetCode DP challenge');
});

test('P19: Task CRUD - optimistic addition and failure rollback', () => {
  const initial = [{ _id: '1', text: 'Existing task', completed: false }];

  // 1. Optimistic insert
  const { tasks: pendingTasks, tempId } = applyOptimisticTaskAdd(initial, 'New study goal');
  assert.equal(pendingTasks.length, 2);
  assert.equal(pendingTasks[0].isPending, true);
  assert.equal(pendingTasks[0].text, 'New study goal');

  // 2. Server success reconciliation
  const serverTask = { _id: 'server_99', text: 'New study goal', completed: false };
  const reconciled = reconcileTaskAddSuccess(pendingTasks, tempId, serverTask);
  assert.equal(reconciled.length, 2);
  assert.equal(reconciled[0]._id, 'server_99');
  assert.equal(reconciled[0].isPending, false);

  // 3. Rollback on failure
  const rolledBack = rollbackTaskAddFailure(pendingTasks, tempId);
  assert.equal(rolledBack.length, 1);
  assert.equal(rolledBack[0]._id, '1');
});

test('P19: Task CRUD - optimistic toggle and rollback on error', () => {
  const tasks = [{ _id: 'task_1', text: 'Study SQL joins', completed: false }];

  // 1. Optimistic toggle
  const { tasks: toggled, previousState } = applyOptimisticToggle(tasks, 'task_1');
  assert.equal(previousState, false);
  assert.equal(toggled[0].completed, true);

  // 2. Failure rollback
  const reverted = rollbackOptimisticToggle(toggled, 'task_1', previousState);
  assert.equal(reverted[0].completed, false);
});

test('P19: Task CRUD - optimistic delete and rollback on error', () => {
  const tasks = [
    { _id: 'task_1', text: 'Task 1', completed: false },
    { _id: 'task_2', text: 'Task 2', completed: false },
  ];

  // 1. Optimistic delete of task_1
  const { tasks: afterDelete, removedTask, index } = applyOptimisticDelete(tasks, 'task_1');
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0]._id, 'task_2');
  assert.equal(index, 0);

  // 2. Rollback on failure
  const restored = rollbackOptimisticDelete(afterDelete, removedTask, index);
  assert.equal(restored.length, 2);
  assert.equal(restored[0]._id, 'task_1');
  assert.equal(restored[1]._id, 'task_2');
});
