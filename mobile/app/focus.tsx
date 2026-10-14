import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  RotateCcw,
  Music2,
  Plus,
  Check,
  Trash2,
  SkipForward,
  Bell,
  BellOff,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import { useFocus, FocusMode } from '../src/context/FocusContext';
import { MAX_TODO_TEXT_LENGTH } from '../src/api/todo';

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();

  const {
    mode,
    status,
    formattedTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    switchMode,
    formattedFocusedToday,
    sessionsCompletedToday,
    tasks,
    tasksLoading,
    tasksError,
    addTask,
    toggleTask,
    deleteTask,
    audioStatus,
    playMusic,
    pauseMusic,
    nextTrack,
    notificationPermission,
    requestNotificationPermission,
  } = useFocus();

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [taskInputError, setTaskInputError] = useState<string | null>(null);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const handleStartPauseResume = () => {
    if (status === 'running') {
      pauseTimer();
    } else if (status === 'paused') {
      resumeTimer();
    } else {
      // idle or completed
      startTimer();
    }
  };

  const handleCreateTask = async () => {
    const trimmed = newTaskText.trim();
    if (!trimmed) {
      setTaskInputError('Please enter a task description.');
      return;
    }

    setTaskInputError(null);
    setIsSubmittingTask(true);
    const success = await addTask(trimmed);
    setIsSubmittingTask(false);

    if (success) {
      setNewTaskText('');
      setIsAddingTask(false);
    }
  };

  const getStatusEyebrow = () => {
    switch (status) {
      case 'running':
        return 'SESSION ACTIVE';
      case 'paused':
        return 'SESSION PAUSED';
      case 'completed':
        return 'SESSION COMPLETE';
      default:
        return 'READY WHEN YOU ARE';
    }
  };

  const getPrimaryActionLabel = () => {
    if (status === 'running') return 'Pause';
    if (status === 'paused') return 'Resume';
    return 'Start';
  };

  const getPrimaryActionIcon = () => {
    if (status === 'running') {
      return <Pause size={18} color={hub.bg} />;
    }
    return <Play size={18} color={hub.bg} />;
  };

  const segments: { label: string; mode: FocusMode }[] = [
    { label: 'Focus', mode: 'focus' },
    { label: 'Short break', mode: 'shortBreak' },
    { label: 'Long break', mode: 'longBreak' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Focus session" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          MAKE SPACE TO LEARN
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Focus session.
        </Text>

        {/* Duration Segments */}
        <View style={[styles.segmentsContainer, { backgroundColor: hub.soft, borderColor: hub.line }]}>
          {segments.map((item) => {
            const isSelected = mode === item.mode;
            return (
              <Pressable
                key={item.mode}
                onPress={() => switchMode(item.mode)}
                style={[
                  styles.segmentItem,
                  isSelected && { backgroundColor: hub.surface },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${item.label} mode`}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isSelected ? hub.text : hub.muted,
                      fontFamily: isSelected ? typography.fontBodyBold : typography.fontBody,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Timer Card */}
        <Card style={styles.timerCard}>
          <Text style={[styles.timerStatus, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
            {getStatusEyebrow()}
          </Text>

          <Text
            style={[styles.timerValue, { color: hub.text, fontFamily: typography.fontMono }]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Time remaining: ${formattedTime}`}
          >
            {formattedTime}
          </Text>

          <View style={styles.timerActions}>
            <Button
              label={getPrimaryActionLabel()}
              onPress={handleStartPauseResume}
              variant="primary"
              icon={getPrimaryActionIcon()}
              iconPosition="left"
              style={styles.actionBtn}
            />
            <Button
              label="Reset"
              onPress={resetTimer}
              variant="secondary"
              icon={<RotateCcw size={18} color={hub.text} />}
              iconPosition="left"
              style={styles.actionBtn}
            />
          </View>

          {/* Local alert permission badge */}
          <Pressable
            onPress={requestNotificationPermission}
            style={styles.notificationRow}
            accessibilityRole="button"
            accessibilityLabel={`Notification alerts status: ${notificationPermission}. Tap to configure.`}
          >
            {notificationPermission === 'granted' ? (
              <Bell size={14} color={hub.text} />
            ) : notificationPermission === 'denied' ? (
              <BellOff size={14} color={hub.muted} />
            ) : (
              <Bell size={14} color={hub.text} />
            )}
            <Text style={[styles.notificationText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {notificationPermission === 'granted'
                ? 'Local alerts active'
                : notificationPermission === 'denied'
                ? 'Local alerts muted (permission denied)'
                : 'Enable local completion alert'}
            </Text>
          </Pressable>
        </Card>

        {/* Background Music Card */}
        <View style={[styles.musicCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
          <View style={[styles.musicIconWrap, { backgroundColor: hub.soft }]}>
            <Music2 size={20} color={hub.text} />
          </View>
          <View style={styles.musicInfo}>
            <Text style={[styles.musicTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              Background music
            </Text>
            <Text
              style={[
                styles.musicSubtitle,
                {
                  color: audioStatus.state === 'error' ? hub.danger : hub.muted,
                  fontFamily: typography.fontBody,
                },
              ]}
              numberOfLines={1}
            >
              {audioStatus.state === 'playing'
                ? `${audioStatus.currentTrack.title} · Playing`
                : audioStatus.state === 'loading'
                ? `${audioStatus.currentTrack.title} · Buffering...`
                : audioStatus.state === 'paused'
                ? `${audioStatus.currentTrack.title} · Paused`
                : audioStatus.state === 'interrupted'
                ? `${audioStatus.currentTrack.title} · Interrupted`
                : audioStatus.state === 'error'
                ? audioStatus.errorMessage || 'Audio unavailable offline'
                : `${audioStatus.currentTrack.title} · Ready`}
            </Text>
          </View>

          <View style={styles.musicControls}>
            <Pressable
              onPress={nextTrack}
              style={[styles.musicSubButton, { backgroundColor: hub.soft }]}
              accessibilityRole="button"
              accessibilityLabel="Next background track"
            >
              <SkipForward size={16} color={hub.text} />
            </Pressable>

            <Pressable
              onPress={() => {
                if (audioStatus.state === 'playing') {
                  pauseMusic();
                } else {
                  playMusic();
                }
              }}
              style={[styles.musicPlayButton, { backgroundColor: hub.strong }]}
              accessibilityRole="button"
              accessibilityLabel={audioStatus.state === 'playing' ? 'Pause music' : 'Play music'}
            >
              {audioStatus.state === 'loading' ? (
                <ActivityIndicator size="small" color={hub.bg} />
              ) : audioStatus.state === 'playing' ? (
                <Pause size={18} color={hub.bg} />
              ) : (
                <Play size={18} color={hub.bg} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Daily Tasks Header */}
        <View style={styles.tasksHeader}>
          <Text style={[styles.sectionHeading, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            Daily tasks
          </Text>
          <Pressable
            onPress={() => {
              setIsAddingTask((prev) => !prev);
              setTaskInputError(null);
            }}
            style={[styles.addTaskIconBtn, { backgroundColor: hub.soft }]}
            accessibilityRole="button"
            accessibilityLabel={isAddingTask ? 'Cancel adding task' : 'Add task'}
          >
            {isAddingTask ? (
              <X size={18} color={hub.text} />
            ) : (
              <Plus size={18} color={hub.text} />
            )}
          </Pressable>
        </View>

        {/* Inline Add Task Form */}
        {isAddingTask && (
          <View style={[styles.addTaskBox, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <TextInput
              style={[
                styles.taskInput,
                {
                  color: hub.text,
                  borderColor: taskInputError ? hub.danger : hub.line,
                  backgroundColor: hub.bg,
                  fontFamily: typography.fontBody,
                },
              ]}
              placeholder="e.g. Solve five tree traversal problems..."
              placeholderTextColor={hub.muted}
              value={newTaskText}
              onChangeText={(val) => {
                setNewTaskText(val);
                if (taskInputError) setTaskInputError(null);
              }}
              returnKeyType="done"
              onSubmitEditing={handleCreateTask}
              maxLength={MAX_TODO_TEXT_LENGTH}
              autoFocus
            />
            {taskInputError && (
              <Text style={[styles.taskInputErrorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                {taskInputError}
              </Text>
            )}
            <View style={styles.addTaskActions}>
              <Button
                label="Cancel"
                onPress={() => {
                  setIsAddingTask(false);
                  setNewTaskText('');
                  setTaskInputError(null);
                }}
                variant="text"
              />
              <Button
                label="Add task"
                onPress={handleCreateTask}
                variant="primary"
                loading={isSubmittingTask}
                disabled={!newTaskText.trim() || isSubmittingTask}
              />
            </View>
          </View>
        )}

        {/* Task Error Banner if rollback / failure */}
        {tasksError && (
          <View style={[styles.errorBanner, { backgroundColor: hub.soft, borderColor: hub.danger }]}>
            <AlertCircle size={16} color={hub.danger} />
            <Text style={[styles.errorBannerText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {tasksError}
            </Text>
          </View>
        )}

        {/* Tasks List */}
        <View style={styles.tasksList}>
          {tasksLoading && tasks.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={hub.muted} />
              <Text style={[styles.loadingText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                Syncing tasks...
              </Text>
            </View>
          ) : tasks.length === 0 ? (
            <View style={[styles.emptyTasksBox, { backgroundColor: hub.surface, borderColor: hub.line }]}>
              <Text style={[styles.emptyTasksText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                No tasks for today. Add one above to keep your focus sharp.
              </Text>
            </View>
          ) : (
            tasks.map((task) => (
              <View
                key={task._id}
                style={[
                  styles.taskRow,
                  {
                    backgroundColor: hub.surface,
                    borderColor: hub.line,
                    opacity: task.isPending ? 0.7 : 1,
                  },
                ]}
              >
                <Pressable
                  onPress={() => toggleTask(task._id)}
                  style={styles.taskTogglePressable}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.completed }}
                  accessibilityLabel={`Task: ${task.text}, ${task.completed ? 'completed' : 'incomplete'}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: task.completed ? hub.primary : hub.line,
                        backgroundColor: task.completed ? hub.primary : 'transparent',
                      },
                    ]}
                  >
                    {task.completed && <Check size={14} color={hub.primaryForeground} />}
                  </View>
                  <Text
                    style={[
                      styles.taskTitle,
                      {
                        color: task.completed ? hub.muted : hub.text,
                        textDecorationLine: task.completed ? 'line-through' : 'none',
                        fontFamily: typography.fontBody,
                      },
                    ]}
                  >
                    {task.text}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => deleteTask(task._id)}
                  style={styles.deleteTaskBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete task ${task.text}`}
                >
                  <Trash2 size={16} color={hub.muted} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Focus History */}
        <View style={styles.historyHeader}>
          <Text style={[styles.sectionHeading, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            Focus history
          </Text>
          <Text style={[styles.historyMeta, { color: hub.muted, fontFamily: typography.fontMono }]}>
            On this device
          </Text>
        </View>

        <View style={styles.historyRow}>
          <View style={[styles.historyCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.historyNumber, { color: hub.text, fontFamily: typography.fontHeading }]}>
              {formattedFocusedToday}
            </Text>
            <Text style={[styles.historyLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Focused today
            </Text>
          </View>

          <View style={[styles.historyCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.historyNumber, { color: hub.text, fontFamily: typography.fontHeading }]}>
              {sessionsCompletedToday}
            </Text>
            <Text style={[styles.historyLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {sessionsCompletedToday === 1 ? 'Session complete' : 'Sessions complete'}
            </Text>
          </View>
        </View>

        <Text style={[styles.historyExplanation, { color: hub.muted, fontFamily: typography.fontBody }]}>
          Focus history records completed 25-minute intervals locally on this device.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  eyebrow: {
    fontSize: typography.sizes.sm,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: typography.sizes.title,
    lineHeight: typography.sizes.title * 1.15,
    marginBottom: spacing.lg,
  },
  segmentsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.lg,
    borderRadius: radii.none,
  },
  segmentItem: {
    flex: 1,
    minHeight: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  segmentText: {
    fontSize: typography.sizes.sm,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  timerStatus: {
    fontSize: typography.sizes.sm,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  timerValue: {
    fontSize: 52,
    lineHeight: 58,
    marginBottom: spacing.xl,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  notificationText: {
    fontSize: typography.sizes.fine,
  },
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  musicIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  musicInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  musicTitle: {
    fontSize: typography.sizes.sm,
    marginBottom: 2,
  },
  musicSubtitle: {
    fontSize: typography.sizes.fine,
  },
  musicControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  musicSubButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicPlayButton: {
    width: targetSizes.minTouch,
    height: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeading: {
    fontSize: typography.sizes.subheading,
  },
  addTaskIconBtn: {
    width: targetSizes.minTouch,
    height: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTaskBox: {
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  taskInput: {
    borderWidth: 1,
    padding: spacing.md,
    fontSize: typography.sizes.body,
    marginBottom: spacing.sm,
  },
  taskInputErrorText: {
    fontSize: typography.sizes.fine,
    marginBottom: spacing.sm,
  },
  addTaskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorBannerText: {
    fontSize: typography.sizes.fine,
    flex: 1,
  },
  tasksList: {
    marginBottom: spacing.xl,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
  },
  emptyTasksBox: {
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyTasksText: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  taskTogglePressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    minHeight: targetSizes.minTouch,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: typography.sizes.body,
    flex: 1,
  },
  deleteTaskBtn: {
    width: targetSizes.minTouch,
    height: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  historyMeta: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  historyCard: {
    flex: 1,
    borderWidth: 1,
    padding: spacing.base,
    alignItems: 'flex-start',
  },
  historyNumber: {
    fontSize: typography.sizes.title,
    lineHeight: typography.sizes.title * 1.1,
    marginBottom: spacing.xs,
  },
  historyLabel: {
    fontSize: typography.sizes.sm,
  },
  historyExplanation: {
    fontSize: typography.sizes.fine,
    marginTop: spacing.xs,
    lineHeight: typography.sizes.fine * 1.4,
  },
});
