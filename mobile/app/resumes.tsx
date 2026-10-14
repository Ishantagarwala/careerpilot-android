import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, FileText, ChevronRight, AlertCircle, Trash2 } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { LoadingStateView, EmptyStateView } from '../src/components/primitives/StateView';
import { radii, spacing, typography, targetSizes } from '../src/theme/tokens';
import {
  ResumeItem,
  fetchResumes,
  createResume,
  deleteResume,
  getCachedResumes,
  setCachedResumes,
  clearResumeDraft,
  getAtsScoreMax,
} from '../src/api/resume';

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Updated recently';
  const then = new Date(dateString).getTime();
  const diffMs = Date.now() - then;
  if (diffMs < 60 * 1000) return 'Updated just now';
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) return `Updated ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays}d ago`;
}

export default function ResumesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    // Check offline cache first
    if (user?.id) {
      const cached = await getCachedResumes(user.id);
      if (cached && !isRefresh) {
        setResumes(cached);
      }
    }

    try {
      const live = await fetchResumes();
      setResumes(live);
      if (user?.id) {
        await setCachedResumes(user.id, live);
      }
    } catch (err: any) {
      if (!isRefresh && resumes.length === 0) {
        setError(err.message || 'Failed to load resumes. Check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, resumes.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const newResume = await createResume('My Resume');
      setResumes((prev) => [newResume, ...prev]);
      if (user?.id) {
        await setCachedResumes(user.id, [newResume, ...resumes]);
      }
      router.push({
        pathname: '/editor',
        params: { id: newResume._id },
      });
    } catch (err: any) {
      Alert.alert(
        'Create Resume Failed',
        err.message || 'Could not create a new resume. Please try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (item: ResumeItem) => {
    Alert.alert(
      'Delete Resume',
      `Are you sure you want to delete "${item.title || 'Untitled'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteResume(item._id);
              await clearResumeDraft(item._id);
              const remaining = resumes.filter((r) => r._id !== item._id);
              setResumes(remaining);
              if (user?.id) {
                await setCachedResumes(user.id, remaining);
              }
            } catch (err: any) {
              Alert.alert('Delete failed', err.message || 'Could not delete resume.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Resume builder" isRoot={false} />

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
            tintColor={hub.soft}
          />
        }
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          RESUME BUILDER
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Tell your story{'\n'}with clarity.
        </Text>

        <Text style={[styles.subtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
          A focused resume for your next opportunity.
        </Text>

        <Button
          label={creating ? 'Creating resume…' : 'Create resume'}
          onPress={handleCreate}
          variant="primary"
          icon={<Plus size={18} color={hub.bg} />}
          iconPosition="left"
          loading={creating}
          style={styles.createButton}
        />

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <AlertCircle size={18} color={hub.danger} />
            <Text style={[styles.errorBannerText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Pressable onPress={() => loadData()}>
              <Text style={[styles.retryText, { color: hub.soft, fontFamily: typography.fontBodyBold }]}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {loading && resumes.length === 0 ? (
          <LoadingStateView message="Loading resumes…" />
        ) : resumes.length === 0 && !error ? (
          <EmptyStateView
            title="No resumes yet"
            message="Create your first resume to highlight your education, projects and technical skills."
            actionLabel="Create resume"
            onAction={handleCreate}
          />
        ) : (
          resumes.map((item, index) => (
            <Card key={item._id} style={styles.card}>
              <View style={styles.labelRow}>
                <View style={styles.tagsContainer}>
                  <View style={[styles.tag, { backgroundColor: hub.soft }]}>
                    <Text style={[styles.tagText, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                      {index === 0 ? 'MY RESUME' : 'RESUME'}
                    </Text>
                  </View>
                  {item.atsAnalysis?.score != null && (
                    <View style={[styles.tag, { backgroundColor: hub.soft }]}>
                      <Text style={[styles.tagText, { color: hub.text, fontFamily: typography.fontMonoMedium }]}>
                        {`ATS ${item.atsAnalysis.score}/${getAtsScoreMax(item.atsAnalysis)}`}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardHeaderActions}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => handleDelete(item)}
                    style={styles.deleteButton}
                    accessibilityLabel={`Delete ${item.title}`}
                  >
                    <Trash2 size={16} color={hub.muted} />
                  </Pressable>
                  <FileText size={18} color={hub.muted} />
                </View>
              </View>

              <Text style={[styles.resumeTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                {item.title || 'Software engineering'}
              </Text>

              <Text style={[styles.resumeMeta, { color: hub.muted, fontFamily: typography.fontBody }]}>
                {formatRelativeTime(item.updatedAt)}
              </Text>

              <View style={styles.actions}>
                <Button
                  label="Edit resume"
                  onPress={() =>
                    router.push({
                      pathname: '/editor',
                      params: { id: item._id },
                    })
                  }
                  variant="secondary"
                  style={styles.actionBtn}
                />
                <Button
                  label="Preview"
                  onPress={() =>
                    router.push({
                      pathname: '/resume-preview',
                      params: { id: item._id },
                    })
                  }
                  variant="secondary"
                  style={styles.actionBtn}
                />
              </View>
            </Card>
          ))
        )}

        {/* ATS Navigation Link matching mockup */}
        <Pressable
          style={[styles.atsCard, { borderColor: hub.line }]}
          onPress={() => router.push('/ats' as any)}
          accessibilityRole="button"
          accessibilityLabel="Match a job description"
        >
          <View style={styles.atsIcon}>
            <FileText size={22} color={hub.text} />
          </View>
          <View style={styles.atsText}>
            <Text style={[styles.atsTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Match a job description
            </Text>
            <Text style={[styles.atsSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Find keywords and practical edits
            </Text>
          </View>
          <ChevronRight size={20} color={hub.muted} />
        </Pressable>
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
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
    marginBottom: spacing.xxs,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.base,
  },
  createButton: {
    marginBottom: spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  errorBannerText: {
    fontSize: typography.sizes.fine,
    flex: 1,
  },
  retryText: {
    fontSize: typography.sizes.fine,
    textDecorationLine: 'underline',
  },
  card: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  tagText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deleteButton: {
    minHeight: targetSizes.minTouch,
    minWidth: targetSizes.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeTitle: {
    fontSize: typography.sizes.heading,
    marginBottom: spacing.xxs,
  },
  resumeMeta: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.base,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  atsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  atsIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  atsText: {
    flex: 1,
  },
  atsTitle: {
    fontSize: typography.sizes.body,
    marginBottom: 2,
  },
  atsSubtitle: {
    fontSize: typography.sizes.xs,
  },
});
