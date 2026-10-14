import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Compass } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import {
  LoadingStateView,
  ErrorStateView,
  EmptyStateView,
  OfflineBanner,
} from '../src/components/primitives/StateView';
import {
  CareerRecommendation,
  fetchRecommendations,
  selectCareerPath,
  getCachedRecommendations,
  setCachedRecommendations,
} from '../src/api/career';
import { radii, spacing, typography } from '../src/theme/tokens';

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    // 1. Try cache first for instant response
    const cached = await getCachedRecommendations(userId);
    if (cached && cached.length > 0 && !isRefresh) {
      setRecommendations(cached);
      setLoading(false);
    }

    // 2. Fetch fresh authoritative recommendations from server
    try {
      const live = await fetchRecommendations();
      setRecommendations(live);
      await setCachedRecommendations(userId, live);
      setIsOffline(false);
    } catch (err: any) {
      console.warn('Matches fetch error:', err);
      if (cached && cached.length > 0) {
        setIsOffline(true);
      } else {
        setError(err?.message || 'Could not load career matches.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleSelect = async (rec: CareerRecommendation) => {
    if (rec.selected) {
      // Already selected path, go straight to learn roadmap
      router.push('/(tabs)/learn' as any);
      return;
    }

    const currentSelected = recommendations.find((r) => r.selected);
    const performSelection = async () => {
      setSelectingId(rec._id);
      try {
        await selectCareerPath(rec._id);

        const updated = recommendations.map((r) => ({
          ...r,
          selected: r._id === rec._id,
        }));
        setRecommendations(updated);
        await setCachedRecommendations(userId, updated);

        // Navigate to learn roadmap
        router.push('/(tabs)/learn' as any);
      } catch (err: any) {
        Alert.alert(
          'Selection Failed',
          err?.message || 'Failed to select this career path. Please try again.'
        );
      } finally {
        setSelectingId(null);
      }
    };

    if (currentSelected) {
      Alert.alert(
        'Change Career Path',
        `Switch active career path from "${currentSelected.careerPath}" to "${rec.careerPath}"? Your learning roadmap will be updated.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Change Path', onPress: performSelection },
        ]
      );
    } else {
      performSelection();
    }
  };

  if (loading && recommendations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Career matches" isRoot={false} />
        <LoadingStateView message="Loading your career matches…" />
      </View>
    );
  }

  if (error && recommendations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Career matches" isRoot={false} />
        <ErrorStateView
          title="Could not load matches"
          message={error}
          onRetry={() => loadData(false)}
        />
      </View>
    );
  }

  if (!loading && recommendations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Career matches" isRoot={false} />
        <EmptyStateView
          title="No career matches yet"
          message="Complete a short assessment to discover personalized career paths."
          actionLabel="Start assessment"
          onAction={() => router.push('/interests' as any)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Career matches" isRoot={false} />
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
          YOUR CAREER MATCHES
        </Text>

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          Explore your{'\n'}possibilities.
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Suggestions based on your interests, goals and skills.
        </Text>

        {recommendations.map((rec, index) => {
          const isTop = index === 0;
          const isSelected = rec.selected;
          const isProcessing = selectingId === rec._id;

          return (
            <Card key={rec._id} style={styles.card}>
              <View style={styles.labelRow}>
                {isSelected ? (
                  <View style={[styles.tag, { backgroundColor: hub.soft, borderColor: hub.primary }]}>
                    <Text
                      style={[
                        styles.tagText,
                        { color: hub.text, fontFamily: typography.fontMonoMedium },
                      ]}
                    >
                      CURRENT PATH
                    </Text>
                  </View>
                ) : isTop ? (
                  <View style={[styles.tag, { backgroundColor: hub.soft }]}>
                    <Text
                      style={[
                        styles.tagText,
                        { color: hub.text, fontFamily: typography.fontMonoMedium },
                      ]}
                    >
                      TOP AI MATCH
                    </Text>
                  </View>
                ) : (
                  <View />
                )}
                <Text
                  style={[
                    styles.matchScore,
                    {
                      color: isTop ? hub.text : hub.muted,
                      fontFamily: typography.fontHeading,
                    },
                  ]}
                >
                  {rec.matchScore}%
                </Text>
              </View>

              <Text
                style={[
                  styles.matchTitle,
                  { color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                {rec.careerPath}
              </Text>

              <Text
                style={[
                  styles.matchDesc,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                {rec.reasoning}
              </Text>

              <Button
                label={
                  isSelected
                    ? 'Active path'
                    : isProcessing
                    ? 'Selecting…'
                    : 'Choose this path'
                }
                onPress={() => handleSelect(rec)}
                variant={isTop || isSelected ? 'primary' : 'secondary'}
                disabled={isProcessing}
                loading={isProcessing}
                icon={
                  isSelected ? (
                    <Check size={18} color={isTop ? hub.bg : hub.text} />
                  ) : (
                    <ArrowRight
                      size={18}
                      color={isTop ? hub.bg : hub.text}
                    />
                  )
                }
                iconPosition="right"
                style={styles.actionButton}
              />
            </Card>
          );
        })}

        <Text
          style={[
            styles.finePrint,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          AI matches are guidance, not guarantees. Explore the reasoning and choose
          what fits your goals.
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
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.lg,
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
  matchScore: {
    fontSize: 28,
    lineHeight: 32,
  },
  matchTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: spacing.xs,
  },
  matchDesc: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.base,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
  finePrint: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
