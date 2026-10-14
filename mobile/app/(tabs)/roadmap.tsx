import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  DimensionValue,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Check,
  Compass,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { Button } from '../../src/components/primitives/Button';
import {
  LoadingStateView,
  ErrorStateView,
  OfflineBanner,
} from '../../src/components/primitives/StateView';
import {
  Milestone,
  RoadmapData,
  RoadmapStage,
  RoadmapTopic,
  computeRoadmapStats,
  fetchRoadmap,
  generateRoadmap,
  updateMilestoneProgress,
  getCachedRoadmap,
  setCachedRoadmap,
} from '../../src/api/roadmap';
import { radii, spacing, targetSizes, typography } from '../../src/theme/tokens';

/** The counters under the app bar, mirroring "All 13 · Done 5 · Left 8". */
type MilestoneFilter = 'all' | 'done' | 'left';

type MilestoneState = 'done' | 'now' | 'next' | 'locked';

/** "2D AGO" — used when a milestone has no time estimate of its own. */
function relativeDays(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - then.getTime()) / 86400000));
  return days === 0 ? 'TODAY' : days + 'D AGO';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The meta line: "DONE · 2 WEEKS" / "IN PROGRESS · 4 OF 7 SUBTOPICS". */
function buildMeta(
  state: MilestoneState,
  milestone: Milestone,
  topic: RoadmapTopic | undefined
): string {
  const subtopics = topic?.subtopics || [];
  const doneSubtopics = subtopics.filter((subtopic) => subtopic.completed).length;

  const parts: (string | null | undefined)[] =
    state === 'done'
      ? ['DONE', topic?.timeEstimate || relativeDays(milestone.completedAt)]
      : state === 'now'
      ? [
          'IN PROGRESS',
          subtopics.length > 0 ? doneSubtopics + ' OF ' + subtopics.length + ' SUBTOPICS' : null,
          topic?.timeEstimate,
        ]
      : state === 'next'
      ? ['NEXT', topic?.timeEstimate]
      : ['LOCKED', topic?.timeEstimate];

  return parts.filter((part): part is string => !!part).join(' · ').toUpperCase();
}

export default function RoadmapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState<MilestoneFilter>('all');

  // Track stage expansion: default expand intermediate if current, else beginner
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    beginner: false,
    intermediate: true,
    advanced: false,
  });

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    // 1. Check local cache
    const cached = await getCachedRoadmap(userId);
    if (cached && !isRefresh) {
      setRoadmap(cached);
      setLoading(false);
    }

    // 2. Fetch authoritative data from server
    try {
      const data = await fetchRoadmap();
      if (data) {
        setRoadmap(data);
        await setCachedRoadmap(userId, data);
        setIsOffline(false);

        // Auto-expand current active stage
        const current = data.currentStage || 'beginner';
        setExpandedStages({
          beginner: current === 'beginner',
          intermediate: current === 'intermediate',
          advanced: current === 'advanced',
        });
      } else {
        setRoadmap(null);
      }
    } catch (err: any) {
      console.warn('Roadmap fetch error:', err);
      if (cached) {
        setIsOffline(true);
      } else {
        setError(err?.message || 'Could not load your roadmap.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const toggleStage = (stageName: string) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageName]: !prev[stageName],
    }));
  };

  const handleToggleMilestone = async (milestoneId: string, currentCompleted: boolean) => {
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'You are currently viewing a cached roadmap. Connect to the internet to save milestone progress.'
      );
      return;
    }

    if (!roadmap) return;

    const nextCompleted = !currentCompleted;

    // Optimistic update
    const previousRoadmap = roadmap;
    const optimisticStages = roadmap.stages.map((stage) => ({
      ...stage,
      milestones: (stage.milestones || []).map((m) =>
        m._id === milestoneId || m.title === milestoneId
          ? { ...m, completed: nextCompleted }
          : m
      ),
    }));

    setRoadmap({ ...roadmap, stages: optimisticStages });

    try {
      const updated = await updateMilestoneProgress(milestoneId, nextCompleted);
      setRoadmap(updated);
      await setCachedRoadmap(userId, updated);
    } catch (err: any) {
      console.error('Milestone toggle failed:', err);
      // Safe rollback
      setRoadmap(previousRoadmap);
      Alert.alert(
        'Update Failed',
        err?.message || 'Could not update milestone. Please try again.'
      );
    }
  };

  const handleRegenerateRoadmap = async () => {
    setIsGenerating(true);
    try {
      const regenerated = await generateRoadmap();
      setRoadmap(regenerated);
      await setCachedRoadmap(userId, regenerated);
    } catch (err: any) {
      Alert.alert(
        'Generation Failed',
        err?.message || 'Could not generate roadmap for new path. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Drill-down app bar: back arrow, "Roadmap", the path it belongs to, and the
   * percentage tag (design 05-roadmap). Reused by every state so the back arrow
   * is never lost — including while the roadmap is still loading.
   */
  const renderAppBar = (subtitle: string, percentValue: number | null) => (
    <View style={[styles.appbar, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <ArrowLeft size={targetSizes.iconSizeLarge} color={hub.text} />
      </Pressable>
      <View style={styles.appbarText}>
        <Text
          style={[
            styles.appbarTitle,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          Roadmap
        </Text>
        <Text
          style={[
            styles.appbarSub,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      {percentValue !== null && (
        <View style={[styles.percentTag, { backgroundColor: hub.primary }]}>
          <Text
            style={[
              styles.percentTagText,
              { color: hub.primaryForeground, fontFamily: typography.fontMonoMedium },
            ]}
          >
            {percentValue}%
          </Text>
        </View>
      )}
    </View>
  );

  if (loading && !roadmap) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        {renderAppBar('Your learning path', null)}
        <LoadingStateView message="Loading your roadmap…" />
      </View>
    );
  }

  if (error && !roadmap) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        {renderAppBar('Your learning path', null)}
        <ErrorStateView
          title="Could not load roadmap"
          message={error}
          onRetry={() => loadData(false)}
        />
      </View>
    );
  }

  // No career path selected state
  if (!roadmap || !roadmap.careerPath) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        {renderAppBar('Your learning path', null)}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
          ]}
        >
          <Text
            style={[
              styles.eyebrow,
              { color: hub.muted, fontFamily: typography.fontMonoMedium },
            ]}
          >
            YOUR LEARNING ROADMAP
          </Text>

          <View
            style={[
              styles.hubCard,
              styles.noPathCard,
              { backgroundColor: hub.surface, borderColor: hub.line },
            ]}
          >
            <Compass size={32} color={hub.text} />
            <Text
              style={[
                styles.noPathTitle,
                { color: hub.text, fontFamily: typography.fontHeading },
              ]}
            >
              No career path selected yet
            </Text>
            <Text
              style={[
                styles.noPathDesc,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Complete your career discovery assessment to generate a personalized,
              step-by-step learning roadmap.
            </Text>
            <Pressable
              onPress={() => router.push('/interests' as any)}
              accessibilityRole="button"
              accessibilityLabel="Find my career path"
              style={({ pressed }) => [
                styles.solidButton,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.solidButtonText,
                  { color: hub.text, fontFamily: typography.fontHeading },
                ]}
              >
                Find my path
              </Text>
              <ArrowRight size={18} color={hub.text} />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const { total, completed, percent } = computeRoadmapStats(roadmap);

  // Ordered spine: which milestone is in progress, which comes next, what is locked.
  const ordered = roadmap.stages.flatMap((stage) =>
    (stage.milestones || []).map((milestone) => ({ stage, milestone }))
  );
  const currentIndex = ordered.findIndex((entry) => !entry.milestone.completed);
  const nextIndex =
    currentIndex === -1
      ? -1
      : ordered.findIndex(
          (entry, index) => index > currentIndex && !entry.milestone.completed
        );

  const stateForIndex = (index: number, milestone: Milestone): MilestoneState => {
    if (milestone.completed) return 'done';
    if (index === currentIndex) return 'now';
    if (index === nextIndex) return 'next';
    return 'locked';
  };

  const counters: { key: MilestoneFilter; label: string }[] = [
    { key: 'all', label: 'All ' + total },
    { key: 'done', label: 'Done ' + completed },
    { key: 'left', label: 'Left ' + (total - completed) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      {renderAppBar(roadmap.careerPath, percent)}

      {isOffline && <OfflineBanner />}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            tintColor={hub.text}
            colors={[hub.text]}
          />
        }
      >
        {/* Counters — All · Done · Left, and a live filter over the spine */}
        <View
          style={[
            styles.segmented,
            { backgroundColor: hub.soft },
          ]}
        >
          {counters.map((counter) => {
            const isActive = filter === counter.key;
            return (
              <Pressable
                key={counter.key}
                onPress={() => setFilter(counter.key)}
                accessibilityRole="button"
                accessibilityLabel={
                  isActive ? counter.label + ', selected' : 'Show ' + counter.label
                }
                accessibilityState={{ selected: isActive }}
                style={({ pressed }) => [
                  styles.segment,
                  {
                    backgroundColor: isActive ? hub.surface : 'transparent',
                    borderColor: isActive ? hub.line : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isActive ? hub.text : hub.muted,
                      fontFamily: typography.fontMonoMedium,
                    },
                  ]}
                >
                  {counter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push('/matches' as any)}
          accessibilityRole="button"
          accessibilityLabel="Change career path"
          style={({ pressed }) => [styles.changePath, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text
            style={[
              styles.changePathText,
              { color: hub.muted, fontFamily: typography.fontMonoMedium },
            ]}
          >
            CHANGE PATH
          </Text>
        </Pressable>

        {/* Path Changed Banner */}
        {roadmap.pathChanged && (
          <View
            style={[
              styles.hubCard,
              styles.pathChangedCard,
              { backgroundColor: hub.surface, borderColor: hub.line },
            ]}
          >
            <View style={styles.pathChangedHead}>
              <Sparkles size={16} color={hub.text} />
              <Text
                style={[
                  styles.pathChangedTitle,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                Path updated to {roadmap.selectedCareerPath}
              </Text>
            </View>
            <Text
              style={[
                styles.pathChangedText,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Generate an updated roadmap tailored to your new direction.
            </Text>
            <Button
              label={isGenerating ? 'Generating…' : 'Generate updated roadmap'}
              onPress={handleRegenerateRoadmap}
              variant="secondary"
              disabled={isGenerating}
              loading={isGenerating}
              style={{
                ...styles.pathChangedButton,
                backgroundColor: hub.surface,
                borderColor: hub.line,
                borderWidth: 1.5,
                borderRadius: radii.sm,
              }}
              textStyle={{ color: hub.text }}
            />
          </View>
        )}

        {/* Stage sections — one eyebrow per stage, then the milestone spine */}
        {roadmap.stages.map((stage: RoadmapStage) => {
          const stageName = stage.name;
          const stageMilestones = stage.milestones || [];
          const stageCompletedCount = stageMilestones.filter((m) => m.completed).length;
          const stageTotalCount = stageMilestones.length;
          const isCurrentStage = roadmap.currentStage === stageName;
          const isExpanded = !!expandedStages[stageName];

          const visibleMilestones = stageMilestones.filter((milestone) =>
            filter === 'all'
              ? true
              : filter === 'done'
              ? milestone.completed
              : !milestone.completed
          );

          if (filter !== 'all' && visibleMilestones.length === 0) return null;

          return (
            <View key={stageName} style={styles.stage}>
              <Pressable
                onPress={() => toggleStage(stageName)}
                accessibilityRole="button"
                accessibilityLabel={
                  capitalize(stageName) +
                  ' stage, ' +
                  stageCompletedCount +
                  ' of ' +
                  stageTotalCount +
                  ' milestones complete'
                }
                accessibilityState={{ expanded: isExpanded }}
                style={({ pressed }) => [styles.stageHeader, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text
                  style={[
                    styles.stageEyebrow,
                    { color: hub.muted, fontFamily: typography.fontMonoMedium },
                  ]}
                >
                  {capitalize(stageName).toUpperCase() +
                    ' · ' +
                    stageCompletedCount +
                    ' OF ' +
                    stageTotalCount +
                    ' DONE' +
                    (isCurrentStage ? ' · CURRENT' : '')}
                </Text>
                <View style={styles.spacer} />
                {isExpanded ? (
                  <ChevronUp size={18} color={hub.muted} />
                ) : (
                  <ChevronDown size={18} color={hub.muted} />
                )}
              </Pressable>

              {isExpanded &&
                visibleMilestones.map((milestone, visibleIndex) => {
                  const spineIndex = ordered.findIndex((entry) => entry.milestone === milestone);
                  const state = stateForIndex(spineIndex, milestone);
                  const topic = (stage.topics || []).find(
                    (candidate) => candidate.title === milestone.title
                  );
                  const subtopics = topic?.subtopics || [];
                  const doneSubtopics = subtopics.filter((subtopic) => subtopic.completed).length;
                  const remainingTasks = subtopics.length - doneSubtopics;
                  const progressPercent =
                    subtopics.length > 0 ? Math.round((doneSubtopics / subtopics.length) * 100) : 0;
                  const milestoneId = milestone._id || milestone.title;
                  const isLast = visibleIndex === visibleMilestones.length - 1;

                  return (
                    <Pressable
                      key={milestoneId}
                      onPress={() => handleToggleMilestone(milestoneId, milestone.completed)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: milestone.completed }}
                      accessibilityLabel={milestone.title}
                      style={({ pressed }) => [styles.milestoneRow, { opacity: pressed ? 0.8 : 1 }]}
                    >
                      <View style={styles.rail}>
                        <View
                          style={[
                            styles.knob,
                            state === 'done'
                              ? {
                                  backgroundColor: hub.primary,
                                  borderColor: hub.primary,
                                  borderWidth: 2,
                                }
                              : state === 'now'
                              ? {
                                  backgroundColor: hub.surface,
                                  borderColor: hub.strong,
                                  borderWidth: 3,
                                }
                              : {
                                  backgroundColor: hub.surface,
                                  borderColor: hub.line,
                                  borderWidth: 2,
                                },
                          ]}
                        >
                          {state === 'done' && <Check size={13} color={hub.primaryForeground} />}
                          {state === 'now' && (
                            <View style={[styles.knobDot, { backgroundColor: hub.strong }]} />
                          )}
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.railLine,
                              { backgroundColor: state === 'done' ? hub.primary : hub.line },
                            ]}
                          />
                        )}
                      </View>

                      <View style={styles.milestoneBody}>
                        <Text
                          style={[
                            styles.milestoneTitle,
                            { color: hub.text, fontFamily: typography.fontBodyBold },
                          ]}
                        >
                          {milestone.title}
                        </Text>
                        <Text
                          style={[
                            styles.milestoneMeta,
                            { color: hub.muted, fontFamily: typography.fontMonoMedium },
                          ]}
                        >
                          {buildMeta(state, milestone, topic)}
                        </Text>

                        {!!topic?.description && (
                          <Text
                            style={[
                              styles.milestoneDesc,
                              { color: hub.muted, fontFamily: typography.fontBody },
                            ]}
                          >
                            {topic.description}
                          </Text>
                        )}

                        {state === 'now' && (remainingTasks > 0 || !!topic?.deliverable) && (
                          <View style={styles.tagRow}>
                            {remainingTasks > 0 && (
                              <View
                                style={[
                                  styles.tag,
                                  { backgroundColor: hub.strong, borderColor: hub.strong },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.tagText,
                                    { color: hub.surface, fontFamily: typography.fontMonoMedium },
                                  ]}
                                >
                                  {remainingTasks} TASKS LEFT
                                </Text>
                              </View>
                            )}
                            {!!topic?.deliverable && (
                              <View style={[styles.tag, { borderColor: hub.line }]}>
                                <Text
                                  style={[
                                    styles.tagText,
                                    { color: hub.muted, fontFamily: typography.fontMonoMedium },
                                  ]}
                                >
                                  {'PROJECT: ' + topic.deliverable.toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {state === 'now' && (
                          <View
                            accessibilityRole="progressbar"
                            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
                            style={[
                              styles.milestoneTrack,
                              { backgroundColor: hub.soft },
                            ]}
                          >
                            <View
                              style={[
                                styles.milestoneFill,
                                {
                                  width: (progressPercent + '%') as DimensionValue,
                                  backgroundColor: hub.primary,
                                },
                              ]}
                            />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}

              {/* Course recommendation action inside the current stage */}
              {isExpanded && isCurrentStage && (
                <Pressable
                  onPress={() => router.push('/courses' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Explore recommended courses"
                  style={({ pressed }) => [
                    styles.solidButton,
                    {
                      backgroundColor: hub.surface,
                      borderColor: hub.line,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.solidButtonText,
                      { color: hub.text, fontFamily: typography.fontHeading },
                    ]}
                  >
                    Explore recommended courses
                  </Text>
                  <ArrowRight size={16} color={hub.text} />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  backButton: {
    width: targetSizes.minTouch,
    height: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appbarText: {
    flex: 1,
    minWidth: 0,
  },
  appbarTitle: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  appbarSub: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    marginTop: 1,
  },
  percentTag: {
    minHeight: 25,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentTagText: {
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radii.chip,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  changePath: {
    alignSelf: 'flex-end',
    minHeight: targetSizes.minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  changePathText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.1,
  },
  hubCard: {
    borderWidth: 1.5,
    borderRadius: radii.card,
  },
  pathChangedCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pathChangedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pathChangedTitle: {
    fontSize: typography.sizes.body,
    flexShrink: 1,
  },
  pathChangedText: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  pathChangedButton: {
    marginTop: spacing.sm,
  },
  stage: {
    marginTop: spacing.sm,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: targetSizes.minTouch,
  },
  stageEyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.1,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  rail: {
    width: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobDot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
  },
  railLine: {
    flex: 1,
    width: 2,
    marginTop: 3,
    marginBottom: -2,
  },
  milestoneBody: {
    flex: 1,
    minWidth: 0,
    paddingBottom: spacing.md,
  },
  milestoneTitle: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  milestoneMeta: {
    fontSize: typography.sizes.fine,
    lineHeight: 16,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  milestoneDesc: {
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 7,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    minHeight: 25,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  milestoneTrack: {
    height: 7,
    borderRadius: radii.xs,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  milestoneFill: {
    height: '100%',
  },
  solidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: targetSizes.minTouch,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  solidButtonText: {
    fontSize: 14.5,
    letterSpacing: -0.1,
    textAlign: 'center',
    flexShrink: 1,
  },
  noPathCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  noPathTitle: {
    fontSize: typography.sizes.heading,
    textAlign: 'center',
  },
  noPathDesc: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    textAlign: 'center',
  },
});
