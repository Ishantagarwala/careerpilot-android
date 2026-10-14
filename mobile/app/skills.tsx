import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, ArrowRight, AlertCircle, Sparkles } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { StepTrack } from '../src/components/primitives/StepTrack';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import {
  AssessmentDraft,
  AssessmentSkill,
  getAssessmentDraft,
  saveAssessmentDraft,
  clearAssessmentDraft,
  submitAssessment,
  setCachedRecommendations,
} from '../src/api/career';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';

export default function SkillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [skillName, setSkillName] = useState('JavaScript');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [skillsList, setSkillsList] = useState<AssessmentSkill[]>([
    { name: 'Python', level: 'Beginner' },
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getAssessmentDraft(userId).then((d) => {
      if (isMounted) {
        setDraft(d);
        if (d.skills && d.skills.length > 0) {
          setSkillsList(d.skills);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleAddSkill = () => {
    const trimmed = skillName.trim();
    if (!trimmed) {
      setErrorMessage('Please type a skill name first.');
      return;
    }
    const alreadyExists = skillsList.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setErrorMessage(`"${trimmed}" is already added.`);
      return;
    }

    setErrorMessage(null);
    const updated = [...skillsList, { name: trimmed, level }];
    setSkillsList(updated);
    setSkillName('');
    saveAssessmentDraft(userId, { skills: updated });
  };

  const handleRemoveSkill = (index: number) => {
    setErrorMessage(null);
    const updated = skillsList.filter((_, idx) => idx !== index);
    setSkillsList(updated);
    saveAssessmentDraft(userId, { skills: updated });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Auto-add pending typed skill if valid and not yet added
    const finalSkills = [...skillsList];
    const pendingName = skillName.trim();
    if (pendingName) {
      const alreadyExists = finalSkills.some(
        (s) => s.name.toLowerCase() === pendingName.toLowerCase()
      );
      if (!alreadyExists) {
        finalSkills.push({ name: pendingName, level });
        setSkillsList(finalSkills);
        setSkillName('');
      }
    }

    if (finalSkills.length === 0) {
      setErrorMessage('Please add at least one skill before finding matches.');
      return;
    }

    const currentDraft = await getAssessmentDraft(userId);
    if (!currentDraft.interests || currentDraft.interests.length === 0) {
      setErrorMessage('Please complete Step 1 (Interests) first.');
      router.push('/interests' as any);
      return;
    }
    if (!currentDraft.goals || currentDraft.goals.trim().length < 10) {
      setErrorMessage('Please complete Step 2 (Goals) first.');
      router.push('/goals' as any);
      return;
    }
    if (!currentDraft.subjects || currentDraft.subjects.length === 0) {
      setErrorMessage('Please complete Step 3 (Subjects) first.');
      router.push('/subjects' as any);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const fullPayload: AssessmentDraft = {
        interests: currentDraft.interests,
        goals: currentDraft.goals,
        subjects: currentDraft.subjects,
        skills: finalSkills,
      };

      const recommendations = await submitAssessment(fullPayload);

      // Cache recommendations for offline resilience
      if (recommendations && recommendations.length > 0) {
        await setCachedRecommendations(userId, recommendations);
      }

      // Clear draft ONLY after confirmed success
      await clearAssessmentDraft(userId);

      // Route to career matches
      router.push('/matches' as any);
    } catch (err: any) {
      console.error('Assessment submission error:', err);
      // Preserve draft on error so work is not lost
      await saveAssessmentDraft(userId, { skills: finalSkills });
      setErrorMessage(
        err?.message || 'Could not generate recommendations. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: hub.bg }]}
    >
      <AppHeader title="Assessment · skills" isRoot={false} />

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
            STEP 4 OF 4
          </Text>
        </View>

        <StepTrack currentStep={4} totalSteps={4} />

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          Build on what{'\n'}you already know.
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Add a skill and your current comfort level.
        </Text>

        {/* Input Form Card */}
        <Card style={styles.formCard}>
          <Text
            style={[
              styles.inputLabel,
              { color: hub.muted, fontFamily: typography.fontBodyMedium },
            ]}
          >
            Skill
          </Text>
          <TextInput
            value={skillName}
            onChangeText={(t) => {
              setSkillName(t);
              setErrorMessage(null);
            }}
            placeholder="e.g. Python, Figma"
            placeholderTextColor={hub.muted}
            style={[
              styles.input,
              {
                backgroundColor: hub.surface,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
              },
            ]}
          />

          <Text
            style={[
              styles.inputLabel,
              {
                color: hub.muted,
                fontFamily: typography.fontBodyMedium,
                marginTop: spacing.md,
              },
            ]}
          >
            Level
          </Text>
          <View style={styles.levelRow}>
            {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => {
              const isSelected = level === lvl;
              return (
                <Pressable
                  key={lvl}
                  onPress={() => setLevel(lvl)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Level ${lvl}`}
                  style={[
                    styles.levelButton,
                    {
                      backgroundColor: isSelected ? hub.primary : hub.surface,
                      borderColor: hub.line,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.levelText,
                      {
                        color: isSelected ? hub.primaryForeground : hub.text,
                        fontFamily: isSelected
                          ? typography.fontBodyBold
                          : typography.fontBody,
                      },
                    ]}
                  >
                    {lvl}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label="Add skill"
            onPress={handleAddSkill}
            variant="secondary"
            icon={<Plus size={18} color={hub.text} />}
            iconPosition="left"
            style={styles.addButton}
          />
        </Card>

        {/* Added skills list */}
        <View style={styles.skillsList}>
          {skillsList.map((skill, index) => (
            <View
              key={`${skill.name}-${index}`}
              style={[
                styles.skillItem,
                { backgroundColor: hub.surface, borderColor: hub.line },
              ]}
            >
              <View style={styles.skillItemContent}>
                <Text
                  style={[
                    styles.skillItemName,
                    { color: hub.text, fontFamily: typography.fontBodyBold },
                  ]}
                >
                  {skill.name}
                </Text>
                <Text
                  style={[
                    styles.skillItemLevel,
                    { color: hub.muted, fontFamily: typography.fontBody },
                  ]}
                >
                  {skill.level}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRemoveSkill(index)}
                style={styles.removeButton}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${skill.name}`}
              >
                <X size={18} color={hub.muted} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Retained Assessment Summary Card */}
        {draft && (
          <Card style={[styles.summaryCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text
              style={[
                styles.summaryEyebrow,
                { color: hub.muted, fontFamily: typography.fontMonoMedium },
              ]}
            >
              ASSESSMENT REVIEW
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
                Interests:
              </Text>
              <Text
                style={[styles.summaryValue, { color: hub.text, fontFamily: typography.fontBodyMedium }]}
                numberOfLines={1}
              >
                {draft.interests?.join(', ') || 'None selected'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: hub.muted, fontFamily: typography.fontBody }]}>
                Subjects:
              </Text>
              <Text
                style={[styles.summaryValue, { color: hub.text, fontFamily: typography.fontBodyMedium }]}
                numberOfLines={1}
              >
                {draft.subjects?.join(', ') || 'None selected'}
              </Text>
            </View>
          </Card>
        )}

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

        {isSubmitting ? (
          <View style={styles.generatingState}>
            <ActivityIndicator size="small" color={hub.muted} />
            <Text
              style={[
                styles.generatingText,
                { color: hub.muted, fontFamily: typography.fontBodyMedium },
              ]}
            >
              Analyzing your profile and finding top matches…
            </Text>
          </View>
        ) : (
          <Button
            label="Find my matches"
            onPress={handleSubmit}
            variant="primary"
            icon={<ArrowRight size={18} color={hub.bg} />}
            iconPosition="right"
            style={styles.matchesButton}
          />
        )}
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
    marginBottom: spacing.base,
  },
  formCard: {
    marginBottom: spacing.base,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  levelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontSize: typography.sizes.xs,
  },
  addButton: {
    marginTop: spacing.xs,
  },
  skillsList: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  skillItemContent: {
    flex: 1,
  },
  skillItemName: {
    fontSize: typography.sizes.body,
  },
  skillItemLevel: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  removeButton: {
    width: targetSizes.minTouch,
    height: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginBottom: spacing.base,
    padding: spacing.md,
  },
  summaryEyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    width: 65,
  },
  summaryValue: {
    fontSize: typography.sizes.xs,
    flex: 1,
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
  generatingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.base,
    marginTop: spacing.sm,
  },
  generatingText: {
    fontSize: typography.sizes.body,
  },
  matchesButton: {
    marginTop: spacing.sm,
  },
});
