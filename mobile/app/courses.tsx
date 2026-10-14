import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SlidersHorizontal,
  ExternalLink,
  Check,
  RotateCcw,
  Compass,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import { Sheet } from '../src/components/primitives/Sheet';
import {
  LoadingStateView,
  ErrorStateView,
  EmptyStateView,
  OfflineBanner,
} from '../src/components/primitives/StateView';
import {
  CourseItem,
  CourseFilter,
  CoursesBlockedReason,
  fetchCourses,
  fetchCompletions,
  toggleCourseCompletion,
  getCoursesBlockedReason,
  getCachedCourses,
  setCachedCourses,
  getCachedCompletions,
  setCachedCompletions,
} from '../src/api/courses';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';

const LEVEL_OPTIONS: ('all' | 'beginner' | 'intermediate' | 'advanced')[] = [
  'all',
  'beginner',
  'intermediate',
  'advanced',
];

const BUDGET_OPTIONS: ('all' | 'free' | 'paid')[] = ['all', 'free', 'paid'];

export default function CoursesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  // Courses exist only once a roadmap does; the route answers 404 until then.
  const [blocked, setBlocked] = useState<CoursesBlockedReason | null>(null);

  // Active filters
  const [filters, setFilters] = useState<CourseFilter>({
    level: 'all',
    budget: 'all',
  });

  // Filter Sheet state
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<CourseFilter>({
    level: 'all',
    budget: 'all',
  });

  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);

  const loadData = async (isRefresh = false, activeFilters = filters) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    // 1. Try local cache first
    const [cachedCourses, cachedCompletions] = await Promise.all([
      getCachedCourses(userId),
      getCachedCompletions(userId),
    ]);

    if (cachedCourses && !isRefresh) {
      setCourses(cachedCourses);
      if (cachedCompletions) setCompletedIds(new Set(cachedCompletions));
      setLoading(false);
    }

    // 2. Fetch fresh from server
    try {
      const [result, liveCompletions] = await Promise.all([
        fetchCourses(activeFilters),
        fetchCompletions(userId),
      ]);

      setCourses(result.courses);
      setCompletedIds(new Set(liveCompletions));
      setBlocked(null);

      await Promise.all([
        setCachedCourses(userId, result.courses),
        setCachedCompletions(userId, liveCompletions),
      ]);
      setIsOffline(false);
    } catch (err: any) {
      console.warn('Courses fetch error:', err);
      const blockedReason = getCoursesBlockedReason(err);
      if (blockedReason) {
        // Authoritative: there is no roadmap to key courses to, so cached
        // courses from an older roadmap must not stand in for a live list.
        setBlocked(blockedReason);
        setCourses([]);
        setIsOffline(false);
      } else if (cachedCourses) {
        setIsOffline(true);
      } else {
        setError(err?.message || 'Could not load courses.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleOpenFilterSheet = () => {
    setDraftFilters({ ...filters });
    setShowFilters(true);
  };

  const handleApplyFilters = () => {
    setShowFilters(false);
    setFilters(draftFilters);
    loadData(false, draftFilters);
  };

  const handleResetFilters = () => {
    const reset: CourseFilter = { level: 'all', budget: 'all' };
    setDraftFilters(reset);
    setFilters(reset);
    setShowFilters(false);
    loadData(false, reset);
  };

  const handleToggleCompletion = async (courseId: string) => {
    const isCompleted = completedIds.has(courseId);
    const nextCompleted = !isCompleted;

    // Optimistic update
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (nextCompleted) {
        next.add(courseId);
      } else {
        next.delete(courseId);
      }
      return next;
    });

    setTogglingCourseId(courseId);

    try {
      // Per-course state is stored on the device; the backend only receives the
      // identity-free counter action.
      const result = await toggleCourseCompletion(userId, courseId, nextCompleted);
      setCompletedIds(new Set(result.completedIds));
    } catch (err: any) {
      console.error('Course completion toggle failed:', err);
      // Rollback on error
      setCompletedIds((prev) => {
        const rollback = new Set(prev);
        if (isCompleted) {
          rollback.add(courseId);
        } else {
          rollback.delete(courseId);
        }
        return rollback;
      });
      Alert.alert(
        'Update Failed',
        err?.message || 'Failed to update course completion. Please try again.'
      );
    } finally {
      setTogglingCourseId(null);
    }
  };

  const handleOpenCourseUrl = async (url: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open link', `Cannot open ${url}`);
      }
    } catch (err) {
      console.warn('Error opening link:', err);
    }
  };

  const formatFilterTag = (type: 'level' | 'budget', val?: string) => {
    if (!val || val === 'all') return type === 'level' ? 'All levels' : 'All budgets';
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  if (loading && courses.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Courses" isRoot={false} />
        <LoadingStateView message="Loading recommended courses…" />
      </View>
    );
  }

  if (blocked && courses.length === 0) {
    const needsCareerPath = blocked.code === 'NO_CAREER_PATH';

    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Courses" isRoot={false} />
        <View style={styles.blockedContainer}>
          <EmptyStateView
            icon={<Compass size={32} color={hub.muted} />}
            title={needsCareerPath ? 'Choose a career path first' : 'Generate your roadmap first'}
            message={blocked.message}
            actionLabel={needsCareerPath ? 'Find my path' : 'Go to my roadmap'}
            onAction={() =>
              router.push((needsCareerPath ? '/interests' : '/(tabs)/learn') as any)
            }
          />
        </View>
      </View>
    );
  }

  if (error && courses.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Courses" isRoot={false} />
        <ErrorStateView
          title="Could not load courses"
          message={error}
          onRetry={() => loadData(false)}
        />
      </View>
    );
  }

  const isFiltered = filters.level !== 'all' || filters.budget !== 'all';

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Courses" isRoot={false} />
      {isOffline && <OfflineBanner />}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
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
        <Text
          style={[
            styles.eyebrow,
            { color: hub.muted, fontFamily: typography.fontMonoMedium },
          ]}
        >
          LEARN WITH PURPOSE
        </Text>

        <View style={styles.titleRow}>
          <Text
            style={[
              styles.heading,
              { color: hub.text, fontFamily: typography.fontHeading },
            ]}
          >
            Recommended{'\n'}courses.
          </Text>
          <Pressable
            onPress={handleOpenFilterSheet}
            style={styles.filterButton}
            accessibilityRole="button"
            accessibilityLabel="Filter courses"
          >
            <SlidersHorizontal size={20} color={hub.text} />
          </Pressable>
        </View>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Courses to support your roadmap.
        </Text>

        {/* Filter tags row */}
        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: hub.soft }]}>
            <Text
              style={[
                styles.tagText,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              {formatFilterTag('level', filters.level)}
            </Text>
          </View>
          <View style={[styles.tag, { backgroundColor: hub.soft }]}>
            <Text
              style={[
                styles.tagText,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              {formatFilterTag('budget', filters.budget)}
            </Text>
          </View>
          {isFiltered && (
            <Pressable
              onPress={handleResetFilters}
              style={[styles.resetTag, { borderColor: hub.line }]}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <RotateCcw size={12} color={hub.muted} />
              <Text
                style={[
                  styles.resetTagText,
                  { color: hub.muted, fontFamily: typography.fontMono },
                ]}
              >
                Reset
              </Text>
            </Pressable>
          )}
        </View>

        {/* Empty filter results */}
        {courses.length === 0 ? (
          <EmptyStateView
            title="No matching courses"
            message="No courses found for the selected level and budget filters."
            actionLabel="Reset filters"
            onAction={handleResetFilters}
          />
        ) : (
          courses.map((course) => {
            const isCompleted = completedIds.has(course._id);
            const isToggling = togglingCourseId === course._id;
            const levelLabel =
              course.skillLevel.charAt(0).toUpperCase() + course.skillLevel.slice(1);

            return (
              <Card key={course._id} style={styles.card}>
                <View style={styles.labelRow}>
                  <Text
                    style={[
                      styles.providerText,
                      { color: hub.muted, fontFamily: typography.fontMonoMedium },
                    ]}
                  >
                    {course.platform.toUpperCase()}
                  </Text>
                  <View style={[styles.tag, { backgroundColor: hub.soft }]}>
                    <Text
                      style={[
                        styles.tagText,
                        { color: hub.text, fontFamily: typography.fontMonoMedium },
                      ]}
                    >
                      {course.isFree ? 'FREE' : 'PAID'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.courseTitle,
                    { color: hub.text, fontFamily: typography.fontHeadingMedium },
                  ]}
                >
                  {course.title}
                </Text>

                <Text
                  style={[
                    styles.courseMeta,
                    { color: hub.muted, fontFamily: typography.fontBody },
                  ]}
                >
                  {levelLabel} · {course.careerPath}
                  {course.rating ? ` · ★ ${course.rating}` : ''}
                </Text>

                <Button
                  label="Open course"
                  onPress={() => handleOpenCourseUrl(course.url)}
                  variant="primary"
                  icon={<ExternalLink size={16} color={hub.bg} />}
                  iconPosition="right"
                  style={styles.openButton}
                />

                <Button
                  label={
                    isCompleted
                      ? 'Completed · undo'
                      : isToggling
                      ? 'Updating…'
                      : 'Mark complete'
                  }
                  onPress={() => handleToggleCompletion(course._id)}
                  variant="secondary"
                  disabled={isToggling}
                  loading={isToggling}
                  icon={
                    isCompleted ? (
                      <Check size={16} color={hub.text} />
                    ) : undefined
                  }
                  iconPosition="left"
                  style={styles.completeButton}
                />
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Filter Bottom Sheet */}
      <Sheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="Course filters"
      >
        <Text
          style={[
            styles.sheetSectionTitle,
            { color: hub.text, fontFamily: typography.fontBodyBold },
          ]}
        >
          Level
        </Text>
        <View style={styles.sheetOptionsGrid}>
          {LEVEL_OPTIONS.map((lvl) => {
            const isSelected = (draftFilters.level || 'all') === lvl;
            const label = lvl === 'all' ? 'All' : lvl.charAt(0).toUpperCase() + lvl.slice(1);
            return (
              <Pressable
                key={lvl}
                onPress={() => setDraftFilters((prev) => ({ ...prev, level: lvl }))}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.sheetOptionButton,
                  {
                    backgroundColor: isSelected ? hub.primary : hub.surface,
                    borderColor: hub.line,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    {
                      color: isSelected ? hub.primaryForeground : hub.text,
                      fontFamily: isSelected
                        ? typography.fontBodyBold
                        : typography.fontBody,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={[
            styles.sheetSectionTitle,
            {
              color: hub.text,
              fontFamily: typography.fontBodyBold,
              marginTop: spacing.lg,
            },
          ]}
        >
          Budget
        </Text>
        <View style={styles.sheetOptionsGrid}>
          {BUDGET_OPTIONS.map((b) => {
            const isSelected = (draftFilters.budget || 'all') === b;
            const label = b === 'all' ? 'All' : b.charAt(0).toUpperCase() + b.slice(1);
            return (
              <Pressable
                key={b}
                onPress={() => setDraftFilters((prev) => ({ ...prev, budget: b }))}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.sheetOptionButton,
                  {
                    backgroundColor: isSelected ? hub.primary : hub.surface,
                    borderColor: hub.line,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    {
                      color: isSelected ? hub.primaryForeground : hub.text,
                      fontFamily: isSelected
                        ? typography.fontBodyBold
                        : typography.fontBody,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label="Apply filters"
          onPress={handleApplyFilters}
          variant="primary"
          style={{ marginTop: spacing.xl }}
        />

        <Button
          label="Reset filters"
          onPress={handleResetFilters}
          variant="secondary"
          style={{ marginTop: spacing.xs }}
        />
      </Sheet>
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
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
    marginBottom: spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  filterButton: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.none,
    borderWidth: 1,
  },
  tagText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  resetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: radii.none,
  },
  resetTagText: {
    fontSize: typography.sizes.fine,
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  card: {
    marginBottom: spacing.base,
    padding: spacing.base,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  providerText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1,
  },
  courseTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginVertical: spacing.xs,
  },
  courseMeta: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.base,
  },
  openButton: {
    marginTop: spacing.xs,
  },
  completeButton: {
    marginTop: spacing.sm,
  },
  sheetSectionTitle: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  sheetOptionsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  sheetOptionButton: {
    flex: 1,
    minWidth: 70,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  sheetOptionText: {
    fontSize: typography.sizes.xs,
  },
});
