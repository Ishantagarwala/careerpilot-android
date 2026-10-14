import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Field } from '../src/components/primitives/Field';
import { Button } from '../src/components/primitives/Button';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import {
  ApplicationStatus,
  createCustomOpportunity,
  getCustomJobDraft,
  saveCustomJobDraft,
  clearCustomJobDraft,
} from '../src/api/jobs';

const STATUS_CHOICES: { label: string; value: ApplicationStatus }[] = [
  { label: 'Saved', value: 'saved' },
  { label: 'Applied', value: 'applied' },
  { label: 'Interview', value: 'interview' },
  { label: 'Screening', value: 'screening' },
];

export default function CustomJobScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('saved');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialLoadedRef = useRef(false);

  // Restore draft on mount
  useEffect(() => {
    async function restoreDraft() {
      if (!user?.id) return;
      try {
        const draft = await getCustomJobDraft(user.id);
        if (draft) {
          if (draft.title) setTitle(draft.title);
          if (draft.company) setCompany(draft.company);
          if (draft.url) setUrl(draft.url);
          if (draft.status) setStatus(draft.status);
          if (draft.notes) setNotes(draft.notes);
        }
      } catch (err) {
        console.warn('Failed to load custom job draft:', err);
      } finally {
        initialLoadedRef.current = true;
      }
    }
    restoreDraft();
  }, [user?.id]);

  // Persist draft on changes
  useEffect(() => {
    if (!initialLoadedRef.current || !user?.id) return;

    const hasAnyContent =
      title.trim() || company.trim() || url.trim() || notes.trim();

    if (hasAnyContent) {
      saveCustomJobDraft(user.id, {
        title,
        company,
        url,
        status,
        notes,
      });
    }
  }, [title, company, url, status, notes, user?.id]);

  const isDirty = Boolean(
    title.trim() || company.trim() || url.trim() || notes.trim()
  );

  // Guard dirty back navigation
  const handleBackPress = () => {
    if (isDirty && !submitting) {
      Alert.alert(
        'Discard draft?',
        'You have unsaved details for this opportunity. Are you sure you want to discard them?',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              if (user?.id) {
                await clearCustomJobDraft(user.id);
              }
              router.back();
            },
          },
        ]
      );
      return true;
    }
    router.back();
    return true;
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );
    return () => sub.remove();
  }, [isDirty, submitting, user?.id]);

  const validateUrl = (val: string): boolean => {
    if (!val.trim()) return true; // URL is optional
    const trimmed = val.trim();
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/.test(trimmed)
    );
  };

  const handleSave = async () => {
    if (submitting) return;

    let hasErrors = false;
    setTitleError(null);
    setCompanyError(null);
    setUrlError(null);
    setSubmitError(null);

    const trimmedTitle = title.trim();
    const trimmedCompany = company.trim();
    let trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setTitleError('Job title is required');
      hasErrors = true;
    }

    if (!trimmedCompany) {
      setCompanyError('Company name is required');
      hasErrors = true;
    }

    if (trimmedUrl && !validateUrl(trimmedUrl)) {
      setUrlError('Please enter a valid website or application URL');
      hasErrors = true;
    }

    if (hasErrors) return;

    // Normalise URL scheme if missing
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `https://${trimmedUrl}`;
    }

    setSubmitting(true);

    try {
      await createCustomOpportunity({
        title: trimmedTitle,
        company: trimmedCompany,
        url: trimmedUrl,
        status,
        notes: notes.trim(),
      });

      // Clear draft on confirmed save
      if (user?.id) {
        await clearCustomJobDraft(user.id);
      }

      // Return to Applications with newly created opportunity visible
      router.back();
    } catch (err: any) {
      setSubmitError(
        err.message || 'Failed to save opportunity. Your draft has been kept.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader
        title="Add opportunity"
        isRoot={false}
        onBackPress={handleBackPress}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={[
            styles.eyebrow,
            { color: hub.muted, fontFamily: typography.fontMonoMedium },
          ]}
        >
          APPLICATION TRACKER
        </Text>

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          An opportunity{'\n'}worth keeping.
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Add a job you found elsewhere.
        </Text>

        {submitError && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: hub.soft, borderColor: hub.line },
            ]}
          >
            <AlertCircle size={16} color={hub.text} />
            <Text
              style={[
                styles.errorBannerText,
                { color: hub.text, fontFamily: typography.fontBody },
              ]}
            >
              {submitError}
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Field
            label="Job title"
            placeholder="e.g. Frontend Developer Intern"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (titleError) setTitleError(null);
            }}
            error={titleError || undefined}
          />

          <Field
            label="Company"
            placeholder="Company name"
            value={company}
            onChangeText={(c) => {
              setCompany(c);
              if (companyError) setCompanyError(null);
            }}
            error={companyError || undefined}
          />

          <Field
            label="Job URL (Optional)"
            placeholder="https://…"
            value={url}
            onChangeText={(u) => {
              setUrl(u);
              if (urlError) setUrlError(null);
            }}
            keyboardType="url"
            autoCapitalize="none"
            error={urlError || undefined}
          />

          {/* Initial Status Selector */}
          <View style={styles.statusSection}>
            <Text
              style={[
                styles.sectionLabel,
                { color: hub.text, fontFamily: typography.fontBodyMedium },
              ]}
            >
              Initial status
            </Text>
            <View style={styles.statusPills}>
              {STATUS_CHOICES.map((choice) => {
                const isSelected = status === choice.value;
                return (
                  <Pressable
                    key={choice.value}
                    onPress={() => setStatus(choice.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set status ${choice.label}`}
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isSelected ? hub.text : hub.surface,
                        borderColor: isSelected ? hub.text : hub.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isSelected ? hub.bg : hub.text,
                          fontFamily: isSelected
                            ? typography.fontBodyBold
                            : typography.fontBody,
                        },
                      ]}
                    >
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field
            label="Notes / Next step (Optional)"
            placeholder="e.g. Follow up with recruiter on Tuesday"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          <Button
            label={submitting ? 'Saving opportunity…' : 'Save opportunity'}
            onPress={handleSave}
            variant="primary"
            loading={submitting}
            style={styles.saveButton}
          />
        </View>
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
  form: {
    gap: spacing.base,
  },
  statusSection: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.sizes.body,
  },
  statusPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    minHeight: targetSizes.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPillText: {
    fontSize: typography.sizes.fine,
  },
  saveButton: {
    marginTop: spacing.md,
  },
});
