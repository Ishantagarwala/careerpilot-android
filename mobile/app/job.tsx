import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bookmark,
  ExternalLink,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import {
  JobListing,
  getJobById,
  saveJobToApplications,
  fetchApplications,
  getCachedApplications,
} from '../src/api/jobs';
import { getAssessmentDraft } from '../src/api/career';

export default function JobDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();

  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load user profile skills for skill match comparison
  useEffect(() => {
    async function loadSkills() {
      if (!user?.id) return;
      try {
        const draft = await getAssessmentDraft(user.id);
        if (draft && Array.isArray(draft.skills)) {
          setUserSkills(draft.skills.map((s) => s.name.trim().toLowerCase()));
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadSkills();
  }, [user?.id]);

  // Load job via list lookup contract without inventing /api/jobs/:id
  const loadJobData = useCallback(async () => {
    if (!params.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const foundJob = await getJobById(params.id);
      setJob(foundJob);

      // Check if already in applications
      if (user?.id) {
        const cachedApps = await getCachedApplications(user.id);
        const matchInCached = cachedApps?.some((a) => {
          if (a.externalJobKey) return a.externalJobKey === params.id;
          if (typeof a.jobId === 'string') return a.jobId === params.id;
          return a.jobId?._id === params.id;
        });

        if (matchInCached) {
          setIsSaved(true);
        } else {
          // Check fresh from backend
          fetchApplications()
            .then((apps) => {
              const matched = apps.some((a) => {
                if (a.externalJobKey) return a.externalJobKey === params.id;
                if (typeof a.jobId === 'string') return a.jobId === params.id;
                return a.jobId?._id === params.id;
              });
              if (matched) setIsSaved(true);
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Failed to load job detail:', err);
    } finally {
      setLoading(false);
    }
  }, [params.id, user]);

  useEffect(() => {
    loadJobData();
  }, [loadJobData]);

  // Save opportunity to tracker
  const handleSaveOpportunity = async () => {
    if (!job || isSaved || saving) return;
    setSaving(true);
    try {
      await saveJobToApplications(job, 'saved');
      setIsSaved(true);
      setSaveMessage('Saved to application tracker');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        setIsSaved(true);
        setSaveMessage('Already in your applications');
      } else {
        setSaveMessage(err.message || 'Failed to save opportunity');
      }
      setTimeout(() => setSaveMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  // Open employer site externally (CRITICAL: Does NOT auto-mark Applied)
  const handleApplyExternally = async () => {
    if (!job?.applyUrl) {
      Alert.alert(
        'Application Link Unavailable',
        'This employer did not supply an external URL. Check back soon or visit the company website directly.'
      );
      return;
    }

    const trimmed = job.applyUrl.trim();
    const canOpen =
      trimmed.startsWith('http://') || trimmed.startsWith('https://');

    if (!canOpen) {
      Alert.alert(
        'Invalid Application Link',
        'The provided link could not be opened safely.'
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(trimmed);
      if (supported) {
        await Linking.openURL(trimmed);
      } else {
        Alert.alert(
          'Unable to open link',
          `Could not open ${trimmed} on this device.`
        );
      }
    } catch {
      Alert.alert('Error', 'An error occurred while opening the browser.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Job detail" isRoot={false} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={hub.text} />
          <Text
            style={[
              styles.loadingText,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            Loading opportunity…
          </Text>
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Job detail" isRoot={false} />
        <View style={[styles.scrollContent, styles.centerContainer]}>
          <Card style={styles.notFoundCard}>
            <AlertCircle size={32} color={hub.text} />
            <Text
              style={[
                styles.notFoundTitle,
                { color: hub.text, fontFamily: typography.fontHeadingMedium },
              ]}
            >
              Opportunity unavailable
            </Text>
            <Text
              style={[
                styles.notFoundDesc,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              This opportunity could not be found, or has expired and was removed
              from the active job feed.
            </Text>
            <Button
              label="Back to opportunities"
              onPress={() => router.back()}
              variant="secondary"
              icon={<ArrowLeft size={16} color={hub.text} />}
              iconPosition="left"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </View>
    );
  }

  // Calculate skill comparison
  const jobSkills = Array.isArray(job.skills) ? job.skills : [];
  const matchedSkillsList = jobSkills.filter((s) =>
    userSkills.includes(s.toLowerCase())
  );
  const missingSkillsList = jobSkills.filter(
    (s) => !userSkills.includes(s.toLowerCase())
  );

  const tagLabel = `${job.type.toUpperCase()}${job.remote ? ' · REMOTE' : job.location ? ` · ${job.location.toUpperCase()}` : ''}`;
  const formattedDate = job.postedDate
    ? new Date(job.postedDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Job detail" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.labelRow}>
          <View style={[styles.tag, { backgroundColor: hub.soft }]}>
            <Text
              style={[
                styles.tagText,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              {tagLabel}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          {job.title}
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          {job.company} · {job.location || 'Remote'}
          {job.salary?.min
            ? ` · ${job.salary.currency || '₹'} ${job.salary.min.toLocaleString()}${job.salary.max ? ` - ${job.salary.max.toLocaleString()}` : ''}`
            : ''}
        </Text>

        {/* Feedback Banner */}
        {saveMessage && (
          <View
            style={[
              styles.feedbackBanner,
              { backgroundColor: hub.soft, borderColor: hub.line },
            ]}
          >
            <CheckCircle2 size={16} color={hub.text} />
            <Text
              style={[
                styles.feedbackText,
                { color: hub.text, fontFamily: typography.fontBodyMedium },
              ]}
            >
              {saveMessage}
            </Text>
          </View>
        )}

        {/* About the role */}
        <Card style={styles.card}>
          <Text
            style={[
              styles.sectionTitle,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            About the role
          </Text>
          <Text
            style={[
              styles.bodyText,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            {job.description}
          </Text>

          {/* Requirements */}
          {Array.isArray(job.requirements) && job.requirements.length > 0 && (
            <View style={{ marginTop: spacing.base }}>
              <Text
                style={[
                  styles.subSectionTitle,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                Key requirements
              </Text>
              {job.requirements.map((req, i) => (
                <View key={i} style={styles.reqItem}>
                  <Text style={[styles.reqBullet, { color: hub.text }]}>•</Text>
                  <Text
                    style={[
                      styles.reqText,
                      { color: hub.muted, fontFamily: typography.fontBody },
                    ]}
                  >
                    {req}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Skills Required */}
          {jobSkills.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                Skills to bring
              </Text>
              <View style={styles.tagsRow}>
                {jobSkills.map((skill, index) => (
                  <View
                    key={`${skill}-${index}`}
                    style={[
                      styles.skillTag,
                      { backgroundColor: hub.soft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.skillTagText,
                        {
                          color: hub.muted,
                          fontFamily: typography.fontBody,
                        },
                      ]}
                    >
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Your Profile Match */}
          <View style={{ marginTop: spacing.lg }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: hub.text, fontFamily: typography.fontHeadingMedium },
              ]}
            >
              Your profile match
            </Text>
            <View style={styles.matchContainer}>
              <Text
                style={[
                  styles.matchLabel,
                  { color: hub.text, fontFamily: typography.fontBodyMedium },
                ]}
              >
                Matched:{' '}
                <Text
                  style={[
                    styles.matchValue,
                    {
                      color:
                        matchedSkillsList.length > 0
                          ? hub.text
                          : hub.muted,
                      fontFamily: typography.fontBody,
                    },
                  ]}
                >
                  {matchedSkillsList.length > 0
                    ? matchedSkillsList.join(', ')
                    : 'No matching skills recorded yet'}
                </Text>
              </Text>

              {missingSkillsList.length > 0 && (
                <Text
                  style={[
                    styles.matchLabel,
                    {
                      color: hub.muted,
                      fontFamily: typography.fontBodyMedium,
                      marginTop: spacing.xxs,
                    },
                  ]}
                >
                  Build next:{' '}
                  <Text
                    style={[
                      styles.matchValue,
                      { color: hub.muted, fontFamily: typography.fontBody },
                    ]}
                  >
                    {missingSkillsList.join(', ')}
                  </Text>
                </Text>
              )}
            </View>
          </View>

          {/* Before you apply */}
          <View style={{ marginTop: spacing.lg }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: hub.text, fontFamily: typography.fontHeadingMedium },
              ]}
            >
              Before you apply
            </Text>
            <Text
              style={[
                styles.bodyText,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Review the full listing, tailor your resume and check the
              employer’s application requirements.
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            label="Apply externally"
            onPress={handleApplyExternally}
            variant="primary"
            icon={<ExternalLink size={18} color={hub.bg} />}
            iconPosition="right"
          />

          <Button
            label={isSaved ? 'Saved to applications' : 'Save opportunity'}
            onPress={handleSaveOpportunity}
            variant="secondary"
            loading={saving}
            icon={
              <Bookmark
                size={18}
                color={hub.text}
                fill={isSaved ? hub.text : 'transparent'}
              />
            }
            iconPosition="left"
          />
        </View>

        {/* Source citation */}
        <Text
          style={[
            styles.footnote,
            { color: hub.muted, fontFamily: typography.fontMono },
          ]}
        >
          Source: {job.company}
          {formattedDate ? ` · Posted ${formattedDate}` : ' · Active opportunity'}
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.body,
  },
  notFoundCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  notFoundTitle: {
    fontSize: typography.sizes.md,
    marginTop: spacing.xs,
  },
  notFoundDesc: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  labelRow: {
    marginBottom: spacing.xs,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  tagText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.base,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  feedbackText: {
    fontSize: typography.sizes.fine,
    flex: 1,
  },
  card: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    marginBottom: spacing.xs,
  },
  subSectionTitle: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.xs,
  },
  bodyText: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  reqItem: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  reqBullet: {
    fontSize: typography.sizes.body,
  },
  reqText: {
    fontSize: typography.sizes.body,
    flex: 1,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  skillTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  skillTagText: {
    fontSize: typography.sizes.fine,
  },
  matchContainer: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  matchLabel: {
    fontSize: typography.sizes.body,
  },
  matchValue: {
    fontSize: typography.sizes.body,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  footnote: {
    fontSize: typography.sizes.fine,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.base,
  },
});
