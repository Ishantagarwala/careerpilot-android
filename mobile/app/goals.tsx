import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { StepTrack } from '../src/components/primitives/StepTrack';
import { Button } from '../src/components/primitives/Button';
import { getAssessmentDraft, saveAssessmentDraft } from '../src/api/career';
import { radii, spacing, typography } from '../src/theme/tokens';

export default function GoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [goals, setGoals] = useState(
    'I want to become a software engineer and build useful products. I enjoy solving problems and want to get ready for an internship.'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAssessmentDraft(userId).then((draft) => {
      if (isMounted && draft.goals) {
        setGoals(draft.goals);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleChangeGoals = (text: string) => {
    setGoals(text);
    if (text.trim().length >= 10) {
      setErrorMessage(null);
    }
    saveAssessmentDraft(userId, { goals: text });
  };

  const handleContinue = () => {
    const trimmed = goals.trim();
    if (trimmed.length < 10) {
      setErrorMessage('Please describe your career goals in at least 10 characters.');
      return;
    }
    setErrorMessage(null);
    saveAssessmentDraft(userId, { goals: trimmed });
    router.push('/subjects' as any);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: hub.bg }]}
    >
      <AppHeader title="Assessment · goals" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
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
            STEP 2 OF 4
          </Text>
        </View>

        <StepTrack currentStep={2} totalSteps={4} />

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          What do you{'\n'}want to achieve?
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Think about the work you would like to do and the skills you want to build.
        </Text>

        <View style={styles.formGroup}>
          <Text
            style={[
              styles.label,
              { color: hub.muted, fontFamily: typography.fontBodyMedium },
            ]}
          >
            Your career goals
          </Text>
          <TextInput
            value={goals}
            onChangeText={handleChangeGoals}
            multiline
            numberOfLines={6}
            placeholder="Describe the work you want to do or skills you want to build..."
            placeholderTextColor={hub.muted}
            textAlignVertical="top"
            style={[
              styles.textArea,
              {
                backgroundColor: hub.surface,
                borderColor: errorMessage ? hub.danger : hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
              },
            ]}
          />
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
    </KeyboardAvoidingView>
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
  formGroup: {
    marginBottom: spacing.base,
  },
  label: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  textArea: {
    minHeight: 140,
    padding: spacing.base,
    borderRadius: radii.input,
    borderWidth: 1,
    fontSize: typography.sizes.body,
    lineHeight: 22,
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
