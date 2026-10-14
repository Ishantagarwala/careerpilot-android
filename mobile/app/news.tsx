import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, Newspaper, RotateCw, Radio, Sparkles } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import { OfflineBanner } from '../src/components/primitives/StateView';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  NewsArticle,
  fetchNewsFeed,
  getCachedNews,
  setCachedNews,
  formatNewsRelativeTime,
  formatNewsFreshness,
} from '../src/api/news';

const CATEGORIES = ['All', 'AI/ML', 'Startups', 'Hiring'];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  const [cachedTimestamp, setCachedTimestamp] = useState<number | null>(null);
  const [domainLabel, setDomainLabel] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadNews = useCallback(
    async (isManualRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!isManualRefresh) {
        setLoading(true);
      }
      setError(null);

      // Check offline cache first
      if (user?.id) {
        const cached = await getCachedNews(user.id);
        if (cached && cached.items.length > 0 && !isManualRefresh) {
          setArticles(cached.items);
          setCachedTimestamp(cached.cachedAt);
          setIsOfflineCache(true);
          setLoading(false);
        }
      }

      try {
        const feed = await fetchNewsFeed(
          {
            tag: selectedCategory !== 'All' ? selectedCategory : undefined,
            forceRefresh: isManualRefresh,
          },
          controller.signal
        );

        setArticles(feed.articles);
        setDomainLabel(feed.domainLabel);
        setIsOfflineCache(false);
        setCachedTimestamp(Date.now());

        if (user?.id) {
          await setCachedNews(user.id, feed.articles);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        // Fall back to offline cache
        if (user?.id) {
          const cached = await getCachedNews(user.id);
          if (cached && cached.items.length > 0) {
            setArticles(cached.items);
            setCachedTimestamp(cached.cachedAt);
            setIsOfflineCache(true);
            setError(null);
            return;
          }
        }
        setError(err.message || 'Unable to load tech news feeds. Please check your connection.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, selectedCategory]
  );

  useEffect(() => {
    loadNews();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadNews]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNews(true);
  };

  const handleOpenArticle = async (url?: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      Alert.alert('Link Unavailable', 'No direct URL is available for this article.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to Open Link', `Could not open ${url}`);
      }
    } catch {
      Alert.alert('Error', 'An error occurred while opening the article.');
    }
  };

  // Filter articles based on selected category tag
  const filteredArticles = articles.filter((art) => {
    if (selectedCategory === 'All') return true;
    const catLower = selectedCategory.toLowerCase();
    const hasTagMatch = art.tags?.some((t) => {
      const tLower = t.toLowerCase();
      if (catLower === 'ai/ml') return tLower.includes('ai') || tLower.includes('ml') || tLower.includes('intelligence');
      if (catLower === 'startups') return tLower.includes('startup') || tLower.includes('venture') || tLower.includes('tech');
      if (catLower === 'hiring') return tLower.includes('hiring') || tLower.includes('career') || tLower.includes('job');
      return tLower.includes(catLower);
    });
    const hasCatMatch = art.category?.toLowerCase().includes(catLower);
    const hasTitleMatch = art.title?.toLowerCase().includes(catLower);
    return hasTagMatch || hasCatMatch || hasTitleMatch;
  });

  const featuredArticle = filteredArticles[0];
  const standardArticles = filteredArticles.slice(1);

  const { label: freshnessLabel, isLive } = formatNewsFreshness(cachedTimestamp || undefined);

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Tech news" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={hub.text}
            colors={[hub.text]}
          />
        }
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          STAY CURIOUS
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          What’s moving{'\n'}the tech world.
        </Text>

        {/* Category Filter Controls */}
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Category ${cat}`}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? hub.text : hub.surface,
                    borderColor: isSelected ? hub.text : hub.line,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: isSelected ? hub.bg : hub.text,
                      fontFamily: isSelected ? typography.fontBodyBold : typography.fontBody,
                    },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Honest Freshness Label / Offline Status */}
        {cachedTimestamp && !error && (
          <View style={styles.freshnessRow}>
            <Radio size={12} color={isLive ? hub.text : hub.muted} />
            <Text style={[styles.freshnessText, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
              {isOfflineCache
                ? 'Offline · showing saved stories'
                : domainLabel
                ? `${freshnessLabel} · ${domainLabel}`
                : freshnessLabel}
            </Text>
          </View>
        )}

        {/* Offline Banner */}
        {isOfflineCache && <OfflineBanner onRetry={() => loadNews(true)} />}

        {/* Error State: Provider Failure */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={() => loadNews(true)}
              variant="secondary"
              icon={<RotateCw size={14} color={hub.text} />}
              style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
            />
          </View>
        )}

        {/* Loading Indicator */}
        {loading && !refreshing && (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={hub.text} />
            <Text style={[styles.loadingText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Fetching latest tech stories…
            </Text>
          </View>
        )}

        {/* Empty State: No results for category */}
        {!loading && filteredArticles.length === 0 && !error && (
          <Card style={styles.emptyCard}>
            <Newspaper size={36} color={hub.muted} />
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No articles found
            </Text>
            <Text style={[styles.emptyDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
              No current articles match category "{selectedCategory}". Check other categories or refresh the feed.
            </Text>
            <Button
              label="Show all news"
              onPress={() => setSelectedCategory('All')}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Featured Top Article Card */}
        {!loading && featuredArticle && (
          <Card style={styles.featuredCard}>
            <Text style={[styles.featuredTag, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
              {`${featuredArticle.source?.toUpperCase() || 'ARTICLE'} · ${featuredArticle.category?.toUpperCase() || 'TECHNOLOGY'}`}
            </Text>

            {/* Display image ONLY when supplied and valid */}
            {featuredArticle.imageUrl && featuredArticle.imageUrl.startsWith('http') ? (
              <Image
                source={{ uri: featuredArticle.imageUrl }}
                style={styles.featuredImage}
                resizeMode="cover"
                accessibilityLabel={featuredArticle.imageAlt || featuredArticle.title}
              />
            ) : null}

            <Text style={[styles.featuredTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              {featuredArticle.title}
            </Text>

            <Text style={[styles.featuredSummary, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {featuredArticle.summary}
            </Text>

            <View style={[styles.featuredFooter, { borderTopColor: hub.line }]}>
              <Text style={[styles.footerSource, { color: hub.muted, fontFamily: typography.fontBody }]}>
                {`${featuredArticle.source || 'Editorial'} · ${formatNewsRelativeTime(featuredArticle.publishedAt)}`}
              </Text>

              <Pressable
                onPress={() => handleOpenArticle(featuredArticle.sourceUrl)}
                accessibilityRole="button"
                accessibilityLabel={`Read article: ${featuredArticle.title}`}
                hitSlop={8}
                style={styles.readArticleLink}
              >
                <Text style={[styles.readArticleText, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                  Read article
                </Text>
                <ExternalLink size={16} color={hub.text} />
              </Pressable>
            </View>
          </Card>
        )}

        {/* Compact Standard Article Cards */}
        {!loading &&
          standardArticles.map((article) => (
            <Pressable
              key={article._id}
              onPress={() => handleOpenArticle(article.sourceUrl)}
              accessibilityRole="button"
              accessibilityLabel={`Read article: ${article.title}`}
              style={({ pressed }) => [
                styles.standardCard,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Newspaper size={20} color={hub.muted} style={{ marginTop: 2 }} />

              <View style={styles.standardContent}>
                <Text
                  numberOfLines={2}
                  style={[styles.standardTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}
                >
                  {article.title}
                </Text>

                <Text style={[styles.standardMeta, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  {`${article.source || 'Editorial'} · ${article.tags?.[0] || article.readTime || formatNewsRelativeTime(article.publishedAt)}`}
                </Text>
              </View>

              <ExternalLink size={16} color={hub.muted} />
            </Pressable>
          ))}
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
    marginBottom: spacing.base,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  categoryChip: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.none,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
  },
  freshnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
    paddingHorizontal: 2,
  },
  freshnessText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  errorCard: {
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.card,
    marginBottom: spacing.base,
  },
  errorText: {
    fontSize: typography.sizes.sm,
  },
  loadingCenter: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  emptyTitle: {
    fontSize: typography.sizes.heading,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  featuredCard: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  featuredTag: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  featuredImage: {
    width: '100%',
    height: 160,
    borderRadius: radii.card,
    marginBottom: spacing.sm,
  },
  featuredTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: spacing.xs,
  },
  featuredSummary: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.base,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  footerSource: {
    fontSize: typography.sizes.fine,
  },
  readArticleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  readArticleText: {
    fontSize: typography.sizes.sm,
  },
  standardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  standardContent: {
    flex: 1,
    gap: 2,
  },
  standardTitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  standardMeta: {
    fontSize: typography.sizes.fine,
  },
});
