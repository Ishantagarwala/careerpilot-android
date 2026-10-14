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
import { ChevronLeft, ChevronRight, RotateCcw, HelpCircle, Eye } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import {
  StudyQuestion,
  fetchDocumentQuestions,
  fetchDocuments,
  getCachedDocQuestions,
  setCachedDocQuestions,
} from '../src/api/study';

export default function FlashcardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const params = useLocalSearchParams<{ docId?: string }>();

  const [filename, setFilename] = useState<string>('STUDY NOTES');
  const [cards, setCards] = useState<StudyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCardIndex(0);
    setIsFlipped(false);

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
      setError('No document specified for flashcards.');
      return;
    }

    // Try reading cached questions
    const cached = await getCachedDocQuestions(targetDocId);
    if (cached && Array.isArray(cached.questions) && cached.questions.length > 0) {
      const flashcardItems = cached.questions.filter(
        (q) => q.type === 'flashcard' || (!q.options || q.options.length === 0)
      );
      const chosen = flashcardItems.length > 0 ? flashcardItems : cached.questions;
      setFilename(cached.filename || 'STUDY NOTES');
      setCards(chosen);
      setLoading(false);
    }

    try {
      const live = await fetchDocumentQuestions(targetDocId);
      if (live && Array.isArray(live.questions)) {
        const flashcardItems = live.questions.filter(
          (q) => q.type === 'flashcard' || (!q.options || q.options.length === 0)
        );
        const chosen = flashcardItems.length > 0 ? flashcardItems : live.questions;
        setFilename(live.filename || 'STUDY NOTES');
        setCards(chosen);
        await setCachedDocQuestions(targetDocId, live);
      }
    } catch (err: any) {
      console.warn('Failed to load flashcards:', err);
      if (cards.length === 0) {
        setError(err?.message || 'Could not load flashcards. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  }, [params.docId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const currentCard = cards[cardIndex];

  const handlePrev = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setCardIndex((prev) => (prev > 0 ? prev - 1 : cards.length - 1));
  };

  const handleNext = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setCardIndex((prev) => (prev < cards.length - 1 ? prev + 1 : 0));
  };

  const handleToggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleBackToSummary = () => {
    if (params.docId) {
      router.push({
        pathname: '/document',
        params: { docId: params.docId },
      } as any);
    } else {
      router.push('/(tabs)/study' as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Flashcards" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}
          numberOfLines={1}
        >
          {filename.toUpperCase()}
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Small cards.{'\n'}Lasting knowledge.
        </Text>

        {/* Loading state */}
        {loading && cards.length === 0 && (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={hub.muted} />
            <Text style={[styles.stateText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Loading flashcards…
            </Text>
          </View>
        )}

        {/* Error state */}
        {error && cards.length === 0 && (
          <View style={[styles.errorCard, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Text style={[styles.errorTitle, { color: hub.danger, fontFamily: typography.fontBodyBold }]}>
              Could not load flashcards
            </Text>
            <Text style={[styles.errorSubtitle, { color: hub.text, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={loadCards}
              variant="secondary"
              icon={<RotateCcw size={16} color={hub.text} />}
              style={styles.retryBtn}
            />
          </View>
        )}

        {/* Empty state */}
        {!loading && !error && cards.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: hub.soft }]}>
              <HelpCircle size={28} color={hub.text} />
            </View>
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No flashcards available
            </Text>
            <Text style={[styles.emptySubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
              This document does not contain flashcards yet.
            </Text>
            <Button
              label="Back to summary"
              onPress={handleBackToSummary}
              variant="primary"
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Flippable Flashcard Card */}
        {currentCard && (
          <>
            <Pressable
              onPress={handleToggleFlip}
              accessibilityRole="button"
              accessibilityLabel={`Flashcard. Tap to flip. Currently showing ${
                isFlipped ? 'Answer' : 'Question'
              }`}
              style={[styles.flashcard, { backgroundColor: hub.surface, borderColor: hub.line }]}
            >
              <Text style={[styles.cardType, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                {isFlipped ? 'ANSWER' : 'QUESTION'}
              </Text>

              <Text
                selectable
                style={[
                  styles.cardContent,
                  { color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                {isFlipped ? currentCard.answer : currentCard.question}
              </Text>

              <Text style={[styles.cardHint, { color: hub.muted, fontFamily: typography.fontBody }]}>
                Tap to show {isFlipped ? 'question' : 'answer'}
              </Text>
            </Pressable>

            {/* Explicit labelled action to show question/answer */}
            <Button
              label={isFlipped ? 'Show question' : 'Show answer'}
              onPress={handleToggleFlip}
              variant="secondary"
              icon={<Eye size={16} color={hub.text} />}
              iconPosition="left"
              style={styles.toggleButton}
            />

            {/* Card Navigation Controls */}
            <View style={styles.controlsRow}>
              <Pressable
                onPress={handlePrev}
                style={[styles.controlButton, { backgroundColor: hub.surface, borderColor: hub.line }]}
                accessibilityRole="button"
                accessibilityLabel="Previous card"
              >
                <ChevronLeft size={20} color={hub.text} />
              </Pressable>

              <Text style={[styles.countText, { color: hub.muted, fontFamily: typography.fontMono }]}>
                {cardIndex + 1} of {cards.length}
              </Text>

              <Pressable
                onPress={handleNext}
                style={[styles.controlButton, { backgroundColor: hub.surface, borderColor: hub.line }]}
                accessibilityRole="button"
                accessibilityLabel="Next card"
              >
                <ChevronRight size={20} color={hub.text} />
              </Pressable>
            </View>

            <Button
              label="Back to summary"
              onPress={handleBackToSummary}
              variant="secondary"
              style={styles.backButton}
            />
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
    marginBottom: spacing.xl,
  },
  flashcard: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.xl,
    minHeight: 220,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardType: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
  },
  cardContent: {
    fontSize: typography.sizes.heading,
    lineHeight: 30,
    marginVertical: spacing.base,
  },
  cardHint: {
    fontSize: typography.sizes.xs,
  },
  toggleButton: {
    marginBottom: spacing.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  controlButton: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    borderRadius: radii.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: typography.sizes.sm,
  },
  backButton: {
    marginTop: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.sm,
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
});
