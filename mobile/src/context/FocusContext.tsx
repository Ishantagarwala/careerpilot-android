import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { audioService, AudioStatus } from '../services/audioService';
import { notificationService, NotificationPermissionStatus } from '../services/notificationService';
import {
  TodoItem,
  fetchTodos,
  createTodo as apiCreateTodo,
  updateTodo as apiUpdateTodo,
  deleteTodo as apiDeleteTodo,
  getCachedTodos,
  setCachedTodos,
} from '../api/todo';

export type FocusMode = 'focus' | 'shortBreak' | 'longBreak';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export const MODE_DURATIONS: Record<FocusMode, number> = {
  focus: 25 * 60,      // 25 minutes (1500s)
  shortBreak: 5 * 60,   // 5 minutes (300s)
  longBreak: 15 * 60,   // 15 minutes (900s)
};

export interface FocusSessionRecord {
  id: string;
  completedAt: string;
  minutes: number;
}

interface PersistedTimerState {
  mode: FocusMode;
  status: TimerStatus;
  targetDeadline: number | null;
  remainingSeconds: number;
  sessionId: string | null;
  completedSessionIds: string[];
}

interface FocusContextType {
  // Timer state
  mode: FocusMode;
  status: TimerStatus;
  secondsRemaining: number;
  totalDurationSeconds: number;
  formattedTime: string;

  // Timer actions
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  switchMode: (newMode: FocusMode) => void;

  // History & Metrics
  history: FocusSessionRecord[];
  focusedTodayMinutes: number;
  sessionsCompletedToday: number;
  formattedFocusedToday: string;

  // Tasks
  tasks: TodoItem[];
  tasksLoading: boolean;
  tasksError: string | null;
  addTask: (text: string) => Promise<boolean>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refreshTasks: () => Promise<void>;

  // Music
  audioStatus: AudioStatus;
  playMusic: () => void;
  pauseMusic: () => void;
  nextTrack: () => void;
  selectTrack: (index: number) => void;

  // Notifications
  notificationPermission: NotificationPermissionStatus;
  requestNotificationPermission: () => Promise<NotificationPermissionStatus>;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

const TIMER_STORAGE_PREFIX = '@cache_focus_timer_';
const HISTORY_STORAGE_PREFIX = '@cache_focus_history_';

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  // Timer states
  const [mode, setMode] = useState<FocusMode>('focus');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(MODE_DURATIONS.focus);
  const [targetDeadline, setTargetDeadline] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedSessionIds, setCompletedSessionIds] = useState<string[]>([]);

  // History states
  const [history, setHistory] = useState<FocusSessionRecord[]>([]);

  // Tasks states
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Audio & Notification states
  const [audioStatus, setAudioStatus] = useState<AudioStatus>(audioService.getStatus());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionStatus>('undetermined');

  const timerIntervalRef = useRef<any>(null);

  // -------------------------------------------------------------
  // Storage keys scoped to authenticated user
  // -------------------------------------------------------------
  const timerKey = `${TIMER_STORAGE_PREFIX}${userId}`;
  const historyKey = `${HISTORY_STORAGE_PREFIX}${userId}`;

  // -------------------------------------------------------------
  // Persist Timer State helper
  // -------------------------------------------------------------
  const persistTimer = useCallback(
    async (
      newMode: FocusMode,
      newStatus: TimerStatus,
      newDeadline: number | null,
      newRemaining: number,
      newSessionId: string | null,
      newCompletedIds: string[]
    ) => {
      try {
        const payload: PersistedTimerState = {
          mode: newMode,
          status: newStatus,
          targetDeadline: newDeadline,
          remainingSeconds: newRemaining,
          sessionId: newSessionId,
          completedSessionIds: newCompletedIds,
        };
        await AsyncStorage.setItem(timerKey, JSON.stringify(payload));
      } catch (err) {
        console.warn('[focus] Failed to persist timer state:', err);
      }
    },
    [timerKey]
  );

  // -------------------------------------------------------------
  // Completion Handler (Idempotent: runs at most once per session)
  // -------------------------------------------------------------
  const handleSessionCompletion = useCallback(
    (completedMode: FocusMode, currentSessionId: string | null, prevCompletedIds: string[]) => {
      if (!currentSessionId || prevCompletedIds.includes(currentSessionId)) {
        return; // Already processed
      }

      const updatedCompleted = [...prevCompletedIds, currentSessionId];
      setCompletedSessionIds(updatedCompleted);

      // Only 25-minute focus sessions record in device-local history
      if (completedMode === 'focus') {
        const newRecord: FocusSessionRecord = {
          id: currentSessionId,
          completedAt: new Date().toISOString(),
          minutes: 25,
        };

        setHistory((prev) => {
          const updated = [newRecord, ...prev];
          AsyncStorage.setItem(historyKey, JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        // Trigger local notification
        notificationService.notifySessionComplete(
          'Focus Session Complete!',
          'Great work! You finished a 25-minute focus session. Take a break.'
        );
      } else {
        // Break complete
        notificationService.notifySessionComplete(
          'Break Complete!',
          'Ready to get back to focused work?'
        );
      }

      // Persist completed state
      persistTimer(completedMode, 'completed', null, 0, currentSessionId, updatedCompleted);
    },
    [historyKey, persistTimer]
  );

  // -------------------------------------------------------------
  // Load History & Timer on Mount / User Change
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        // 1. Load History
        const rawHistory = await AsyncStorage.getItem(historyKey);
        if (rawHistory && isMounted) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        } else if (isMounted) {
          setHistory([]);
        }

        // 2. Load Timer state
        const rawTimer = await AsyncStorage.getItem(timerKey);
        if (rawTimer && isMounted) {
          const state: PersistedTimerState = JSON.parse(rawTimer);
          const currentMode = state.mode || 'focus';
          setMode(currentMode);
          setCompletedSessionIds(state.completedSessionIds || []);
          setSessionId(state.sessionId);

          if (state.status === 'running' && state.targetDeadline) {
            const now = Date.now();
            if (now >= state.targetDeadline) {
              // Timer completed while away
              setStatus('completed');
              setSecondsRemaining(0);
              setTargetDeadline(null);
              handleSessionCompletion(currentMode, state.sessionId, state.completedSessionIds || []);
            } else {
              // Still running
              setStatus('running');
              setTargetDeadline(state.targetDeadline);
              const remaining = Math.max(0, Math.ceil((state.targetDeadline - now) / 1000));
              setSecondsRemaining(remaining);
            }
          } else if (state.status === 'paused') {
            setStatus('paused');
            setSecondsRemaining(state.remainingSeconds);
            setTargetDeadline(null);
          } else if (state.status === 'completed') {
            setStatus('completed');
            setSecondsRemaining(0);
            setTargetDeadline(null);
          } else {
            setStatus('idle');
            setSecondsRemaining(MODE_DURATIONS[currentMode]);
            setTargetDeadline(null);
          }
        } else if (isMounted) {
          // Fresh default
          setMode('focus');
          setStatus('idle');
          setSecondsRemaining(MODE_DURATIONS.focus);
          setTargetDeadline(null);
        }

        // 3. Load Cached Tasks
        const cached = await getCachedTodos(userId);
        if (isMounted) {
          setTasks(cached);
        }
      } catch (err) {
        console.warn('[focus] Failed to restore timer or history:', err);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [userId, timerKey, historyKey, handleSessionCompletion]);

  // -------------------------------------------------------------
  // Subscribe to Audio Service & Notification Permissions
  // -------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = audioService.subscribe((newStatus) => {
      setAudioStatus(newStatus);
    });

    notificationService.getPermissionStatus().then((status) => {
      setNotificationPermission(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------
  // Active Running Timer Tick: Timestamp-based (wall-clock accurate)
  // -------------------------------------------------------------
  useEffect(() => {
    if (status === 'running' && targetDeadline) {
      // Clear any existing ticker
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const diff = targetDeadline - now;

        if (diff <= 0) {
          // Timer finished
          clearInterval(timerIntervalRef.current);
          setStatus('completed');
          setSecondsRemaining(0);
          setTargetDeadline(null);
          handleSessionCompletion(mode, sessionId, completedSessionIds);
        } else {
          // Stable wall-clock calculation
          const remaining = Math.ceil(diff / 1000);
          setSecondsRemaining(remaining);
        }
      }, 500); // Check every 500ms for responsiveness without drift
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [status, targetDeadline, mode, sessionId, completedSessionIds, handleSessionCompletion]);

  // -------------------------------------------------------------
  // AppState Listener: Handles backgrounding / screen lock
  // -------------------------------------------------------------
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && status === 'running' && targetDeadline) {
        const now = Date.now();
        if (now >= targetDeadline) {
          setStatus('completed');
          setSecondsRemaining(0);
          setTargetDeadline(null);
          handleSessionCompletion(mode, sessionId, completedSessionIds);
        } else {
          const remaining = Math.max(0, Math.ceil((targetDeadline - now) / 1000));
          setSecondsRemaining(remaining);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [status, targetDeadline, mode, sessionId, completedSessionIds, handleSessionCompletion]);

  // -------------------------------------------------------------
  // Timer Controls
  // -------------------------------------------------------------
  const startTimer = useCallback(() => {
    const now = Date.now();
    const duration = secondsRemaining > 0 ? secondsRemaining : MODE_DURATIONS[mode];
    const deadline = now + duration * 1000;
    const newSessionId = `focus_${now}_${Math.random().toString(36).substring(2, 7)}`;

    setSessionId(newSessionId);
    setTargetDeadline(deadline);
    setSecondsRemaining(duration);
    setStatus('running');

    persistTimer(mode, 'running', deadline, duration, newSessionId, completedSessionIds);
  }, [secondsRemaining, mode, completedSessionIds, persistTimer]);

  const pauseTimer = useCallback(() => {
    if (status !== 'running' || !targetDeadline) return;

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetDeadline - now) / 1000));

    setStatus('paused');
    setSecondsRemaining(remaining);
    setTargetDeadline(null);

    persistTimer(mode, 'paused', null, remaining, sessionId, completedSessionIds);
  }, [status, targetDeadline, mode, sessionId, completedSessionIds, persistTimer]);

  const resumeTimer = useCallback(() => {
    if (status !== 'paused') return;

    const now = Date.now();
    const deadline = now + secondsRemaining * 1000;

    setStatus('running');
    setTargetDeadline(deadline);

    persistTimer(mode, 'running', deadline, secondsRemaining, sessionId, completedSessionIds);
  }, [status, secondsRemaining, mode, sessionId, completedSessionIds, persistTimer]);

  const resetTimer = useCallback(() => {
    const defaultDuration = MODE_DURATIONS[mode];

    setStatus('idle');
    setSecondsRemaining(defaultDuration);
    setTargetDeadline(null);
    setSessionId(null);

    persistTimer(mode, 'idle', null, defaultDuration, null, completedSessionIds);
  }, [mode, completedSessionIds, persistTimer]);

  const switchMode = useCallback(
    (newMode: FocusMode) => {
      setMode(newMode);
      setStatus('idle');
      const defaultDuration = MODE_DURATIONS[newMode];
      setSecondsRemaining(defaultDuration);
      setTargetDeadline(null);
      setSessionId(null);

      persistTimer(newMode, 'idle', null, defaultDuration, null, completedSessionIds);
    },
    [completedSessionIds, persistTimer]
  );

  // -------------------------------------------------------------
  // History Metrics Calculation (Device-Local, Current Calendar Day)
  // -------------------------------------------------------------
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todaySessions = history.filter((h) => {
    const sessionTime = new Date(h.completedAt).getTime();
    return sessionTime >= startOfToday;
  });

  const focusedTodayMinutes = todaySessions.reduce((acc, curr) => acc + (curr.minutes || 0), 0);
  const sessionsCompletedToday = todaySessions.length;

  const formattedFocusedToday =
    focusedTodayMinutes >= 60
      ? `${Math.floor(focusedTodayMinutes / 60)}h ${focusedTodayMinutes % 60}m`
      : `${focusedTodayMinutes}m`;

  const minutesDisplay = Math.floor(secondsRemaining / 60);
  const secondsDisplay = secondsRemaining % 60;
  const formattedTime = `${String(minutesDisplay).padStart(2, '0')}:${String(secondsDisplay).padStart(2, '0')}`;

  // -------------------------------------------------------------
  // Tasks CRUD with Optimistic Rollback & Conflict Handling
  // -------------------------------------------------------------
  const refreshTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const serverTasks = await fetchTodos();
      setTasks(serverTasks);
      await setCachedTodos(serverTasks, userId);
    } catch (err: any) {
      setTasksError('Could not sync tasks. Showing saved offline tasks.');
      const cached = await getCachedTodos(userId);
      setTasks(cached);
    } finally {
      setTasksLoading(false);
    }
  }, [userId]);

  // Load server tasks once on mount or user change
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  const addTask = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      const tempId = `temp_${Date.now()}`;
      const optimisticTask: TodoItem = {
        _id: tempId,
        text: trimmed,
        completed: false,
        isPending: true,
      };

      // Optimistic insert
      setTasks((prev) => [optimisticTask, ...prev]);
      setTasksError(null);

      try {
        const created = await apiCreateTodo(trimmed);
        setTasks((prev) =>
          prev.map((t) => (t._id === tempId ? { ...created, isPending: false } : t))
        );
        const current = await getCachedTodos(userId);
        await setCachedTodos([created, ...current], userId);
        return true;
      } catch (err: any) {
        // Rollback on failure
        setTasks((prev) => prev.filter((t) => t._id !== tempId));
        setTasksError('Failed to save task to server. Please try again.');
        return false;
      }
    },
    [userId]
  );

  const toggleTask = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t._id === id);
      if (!target) return;

      const previousCompleted = target.completed;
      const nextCompleted = !previousCompleted;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t._id === id ? { ...t, completed: nextCompleted } : t))
      );
      setTasksError(null);

      try {
        await apiUpdateTodo(id, { completed: nextCompleted });
        const current = tasks.map((t) => (t._id === id ? { ...t, completed: nextCompleted } : t));
        await setCachedTodos(current, userId);
      } catch (err: any) {
        // Rollback to previous state
        setTasks((prev) =>
          prev.map((t) => (t._id === id ? { ...t, completed: previousCompleted } : t))
        );
        setTasksError('Failed to update task. Changes rolled back.');
      }
    },
    [tasks, userId]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const targetIndex = tasks.findIndex((t) => t._id === id);
      if (targetIndex === -1) return;
      const removedTask = tasks[targetIndex];

      // Optimistic delete
      setTasks((prev) => prev.filter((t) => t._id !== id));
      setTasksError(null);

      try {
        await apiDeleteTodo(id);
        const current = tasks.filter((t) => t._id !== id);
        await setCachedTodos(current, userId);
      } catch (err: any) {
        // Rollback on failure: reinsert at original index
        setTasks((prev) => {
          const next = [...prev];
          next.splice(targetIndex, 0, removedTask);
          return next;
        });
        setTasksError('Failed to delete task. Restored.');
      }
    },
    [tasks, userId]
  );

  // -------------------------------------------------------------
  // Music & Notification Controls
  // -------------------------------------------------------------
  const playMusic = useCallback(() => {
    audioService.play();
  }, []);

  const pauseMusic = useCallback(() => {
    audioService.pause();
  }, []);

  const nextTrack = useCallback(() => {
    audioService.nextTrack(audioStatus.state === 'playing');
  }, [audioStatus.state]);

  const selectTrack = useCallback((index: number) => {
    audioService.selectTrack(index);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    const result = await notificationService.requestPermission();
    setNotificationPermission(result);
    return result;
  }, []);

  return (
    <FocusContext.Provider
      value={{
        mode,
        status,
        secondsRemaining,
        totalDurationSeconds: MODE_DURATIONS[mode],
        formattedTime,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        switchMode,
        history,
        focusedTodayMinutes,
        sessionsCompletedToday,
        formattedFocusedToday,
        tasks,
        tasksLoading,
        tasksError,
        addTask,
        toggleTask,
        deleteTask,
        refreshTasks,
        audioStatus,
        playMusic,
        pauseMusic,
        nextTrack,
        selectTrack,
        notificationPermission,
        requestNotificationPermission,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
};

export const useFocus = (): FocusContextType => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
};
