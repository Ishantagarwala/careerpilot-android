import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { StepTrack } from '../src/components/primitives/StepTrack';
import { ChoiceButton } from '../src/components/primitives/ChoiceButton';
import { Button } from '../src/components/primitives/Button';
import { getAssessmentDraft, saveAssessmentDraft } from '../src/api/career';
import { spacing, typography } from '../src/theme/tokens';

const SUBJECT_OPTIONS = [
  'Programming',
  'Mathematics',
  'Statistics',
  'Data structures',
  'Database systems',
  'Computer networks',
  'Operating systems',
  'Design',
];

export default function SubjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [selected, setSelected] = useState<string[]>(['Programming', 'Data structures']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAssessmentDraft(userId).then((draft) => {
      if (isMounted) {
        if (draft.subjects && draft.subjects.length > 0) {
          setSelected(draft.subjects);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const toggleSubject = (subject: string) => {
    setErrorMessage(null);
    setSelected((prev) => {
      const next = prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject];
      saveAssessmentDraft(userId, { subjects: next });
      return next;
    });
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      setErrorMessage('Please select at least one subject to continue.');
      return;
    }
    setErrorMessage(null);
    saveAssessmentDraft(userId, { subjects: selected });
    router.push('/skills' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Assessment · subjects" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.eyebrow,
              { color: hub.muted, fontFamily: typography.fontMonoMedium },
            ]}
          >
            CAREER DISCOVERY
          </Text>
          <Text
            style={[
              styles.stepMeta,
              { color: hub.muted, fontFamily: typography.fontMono },
            ]}
          >
            STEP 3 OF 4
          </Text>
        </View>

        <StepTrack currentStep={3} totalSteps={4} />

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          Which subjects{'\n'}do you enjoy?
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Select at least one subject.
        </Text>

        <View style={styles.chipGrid}>
          {SUBJECT_OPTIONS.map((subject) => (
            <ChoiceButton
              key={subject}
              label={subject}
              selected={selected.includes(subject)}
              onPress={() => toggleSubject(subject)}
            />
          ))}
        </View>

        {errorMessage && (
          <View style={[styles.errorContainer, { borderColor: hub.danger }]}>
            <AlertCircle size={16} color={hub.danger} />
            <Text
              style={[
                styles.errorText,
                { color: hub.danger, fontFamily: typography.fontBodyMedium },
              ]}
            >
              {errorMessage}
            </Text>
          </View>
        )}

        <Button
          label="Continue"
          onPress={handleContinue}
          variant="primary"
          icon={<ArrowRight size={18} color={hub.bg} />}
          iconPosition="right"
          style={styles.continueButton}
        />
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
  },
  stepMeta: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  chipGrid: {
    flexDirection: 'column',
    marginBottom: spacing.base,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    flex: 1,
  },
  continueButton: {
    marginTop: spacing.xs,
  },
});
