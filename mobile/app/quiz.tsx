import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, RotateCcw, CheckCircle2, HelpCircle } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { ProgressTrack } from '../src/components/primitives/ProgressTrack';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  StudyQuestion,
  fetchDocumentQuestions,
  fetchDocuments,
  getCachedDocQuestions,
  setCachedDocQuestions,
} from '../src/api/study';

export default function QuizScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const params = useLocalSearchParams<{ docId?: string }>();

  const [filename, setFilename] = useState<string>('STUDY NOTES');
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Attempt State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setSelectedOption(null);
    setChecked(false);
    setScore(0);
    setQuizFinished(false);

    let targetDocId = params.docId;

    if (!targetDocId) {
      try {
        const docs = await fetchDocuments();
        if (docs && docs.length > 0) {
          targetDocId = docs[0]._id;
        }
      } catch {
        // Ignored
      }
    }

    if (!targetDocId) {
      setLoading(false);
      setError('No document specified for practice quiz.');
      return;
    }

    // Try reading cached questions first
    const cached = await getCachedDocQuestions(targetDocId);
    if (cached && Array.isArray(cached.questions) && cached.questions.length > 0) {
      const mcqs = cached.questions.filter(
        (q) => q.type === 'mcq' || (Array.isArray(q.options) && q.options.length > 0)
      );
      if (mcqs.length > 0) {
        setFilename(cached.filename || 'STUDY NOTES');
        setQuestions(mcqs);
        setLoading(false);
      }
    }

    try {
      const live = await fetchDocumentQuestions(targetDocId);
      if (live && Array.isArray(live.questions)) {
        const mcqs = live.questions.filter(
          (q) => q.type === 'mcq' || (Array.isArray(q.options) && q.options.length > 0)
        );
        setFilename(live.filename || 'STUDY NOTES');
        setQuestions(mcqs);
        await setCachedDocQuestions(targetDocId, live);
      }
    } catch (err: any) {
      console.warn('Failed to fetch questions:', err);
      if (questions.length === 0) {
        setError(err?.message || 'Could not load quiz questions. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  }, [params.docId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const currentQuestion = questions[currentIndex];

  const handleCheckAnswer = () => {
    if (!selectedOption || checked || !currentQuestion) return;

    setChecked(true);
    const isCorrect =
      selectedOption.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setChecked(false);
    } else {
      setQuizFinished(true);
    }
  };

  const handleReviewSummary = () => {
    if (params.docId) {
      router.push({
        pathname: '/document',
        params: { docId: params.docId },
      } as any);
    } else {
      router.push('/(tabs)/study' as any);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setChecked(false);
    setScore(0);
    setQuizFinished(false);
  };

  const isSelectedCorrect =
    currentQuestion &&
    selectedOption?.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();

  const progressFraction =
    questions.length > 0 ? (currentIndex + (checked ? 1 : 0.5)) / questions.length : 0;

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Practice quiz" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.labelRow}>
          <Text
            style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}
            numberOfLines={1}
          >
            {filename.toUpperCase()}
          </Text>
          {questions.length > 0 && !quizFinished && (
            <Text style={[styles.meta, { color: hub.muted, fontFamily: typography.fontMono }]}>
              QUESTION {currentIndex + 1} OF {questions.length}
            </Text>
          )}
        </View>

        {questions.length > 0 && !quizFinished && (
          <ProgressTrack progress={progressFraction} style={styles.track} />
        )}

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Check your{'\n'}understanding.
        </Text>

        {/* Loading state */}
        {loading && questions.length === 0 && (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={hub.muted} />
            <Text style={[styles.stateText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Loading practice questions…
            </Text>
          </View>
        )}

        {/* Error state */}
        {error && questions.length === 0 && (
          <View style={[styles.errorCard, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Text style={[styles.errorTitle, { color: hub.danger, fontFamily: typography.fontBodyBold }]}>
              Could not load questions
            </Text>
            <Text style={[styles.errorSubtitle, { color: hub.text, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={loadQuestions}
              variant="secondary"
              icon={<RotateCcw size={16} color={hub.text} />}
              style={styles.retryBtn}
            />
          </View>
        )}

        {/* No questions empty state */}
        {!loading && !error && questions.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: hub.soft }]}>
              <HelpCircle size={28} color={hub.text} />
            </View>
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No questions found
            </Text>
            <Text style={[styles.emptySubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
              This document does not have multiple choice questions generated yet.
            </Text>
            <Button
              label="Review summary"
              onPress={handleReviewSummary}
              variant="primary"
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Quiz Finished Screen */}
        {quizFinished && (
          <View style={styles.resultsCard}>
            <View style={[styles.scoreBadge, { backgroundColor: hub.soft }]}>
              <CheckCircle2 size={32} color={hub.text} />
            </View>
            <Text style={[styles.resultsTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Quiz complete!
            </Text>
            <Text style={[styles.scoreSummary, { color: hub.text, fontFamily: typography.fontHeading }]}>
              {score} of {questions.length} correct
            </Text>
            <Text style={[styles.scoreDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {score === questions.length
                ? 'Outstanding! You have mastered these concepts.'
                : 'Good effort! Review the summary notes or try the flashcards to strengthen weak spots.'}
            </Text>

            <View style={styles.resultsButtons}>
              <Button
                label="Review summary"
                onPress={handleReviewSummary}
                variant="primary"
                icon={<ArrowRight size={18} color={hub.bg} />}
                iconPosition="right"
                style={styles.actionButton}
              />
              <Button
                label="Retry quiz"
                onPress={handleRestartQuiz}
                variant="secondary"
                icon={<RotateCcw size={16} color={hub.text} />}
                iconPosition="left"
                style={styles.actionButton}
              />
            </View>
          </View>
        )}

        {/* Active Question Screen */}
        {!quizFinished && currentQuestion && (
          <>
            <Text style={[styles.question, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              {currentQuestion.question}
            </Text>

            <View style={styles.optionsList}>
              {(currentQuestion.options || []).map((opt, idx) => {
                const isSelected = selectedOption === opt;
                const isCorrectOption =
                  checked && opt.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();
                const isIncorrectSelected = checked && isSelected && !isSelectedCorrect;

                let cardBorderColor = hub.line;
                if (isSelected && !checked) cardBorderColor = hub.strong;
                if (checked && isCorrectOption) cardBorderColor = hub.strong;
                if (checked && isIncorrectSelected) cardBorderColor = hub.danger;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      if (!checked) setSelectedOption(opt);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: hub.surface,
                        borderColor: cardBorderColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: cardBorderColor,
                          backgroundColor: isSelected ? cardBorderColor : 'transparent',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? hub.text : hub.muted,
                          fontFamily: isSelected ? typography.fontBodyBold : typography.fontBody,
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {checked ? (
              <>
                <View
                  style={[
                    styles.feedbackBox,
                    {
                      backgroundColor: hub.soft,
                      borderColor: isSelectedCorrect ? hub.strong : hub.danger,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.feedbackText,
                      {
                        color: isSelectedCorrect ? hub.text : hub.danger,
                        fontFamily: typography.fontBody,
                      },
                    ]}
                  >
                    {isSelectedCorrect
                      ? `Correct. ${currentQuestion.answer}`
                      : `Not quite. The correct answer is: ${currentQuestion.answer}`}
                  </Text>
                </View>

                <Button
                  label={currentIndex < questions.length - 1 ? 'Next question' : 'Finish quiz'}
                  onPress={handleNextQuestion}
                  variant="primary"
                  icon={<ArrowRight size={18} color={hub.bg} />}
                  iconPosition="right"
                  style={styles.actionButton}
                />
              </>
            ) : (
              <Button
                label="Check answer"
                onPress={handleCheckAnswer}
                disabled={!selectedOption}
                variant="primary"
                style={styles.actionButton}
              />
            )}
          </>
        )}
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
    flex: 1,
    marginRight: spacing.sm,
  },
  meta: {
    fontSize: typography.sizes.fine,
  },
  track: {
    marginBottom: spacing.base,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.base,
  },
  question: {
    fontSize: typography.sizes.subheading,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    minHeight: 52,
    gap: spacing.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    borderWidth: 1.5,
  },
  optionText: {
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  feedbackBox: {
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  feedbackText: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
  centerState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    fontSize: typography.sizes.body,
  },
  errorCard: {
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  errorTitle: {
    fontSize: typography.sizes.sm,
  },
  errorSubtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.sizes.subheading,
  },
  emptySubtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  resultsCard: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  resultsTitle: {
    fontSize: typography.sizes.md,
  },
  scoreSummary: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  scoreDesc: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  resultsButtons: {
    width: '100%',
    gap: spacing.sm,
  },
});
