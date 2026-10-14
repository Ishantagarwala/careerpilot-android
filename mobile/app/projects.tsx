import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, ArrowRight, CheckCircle2, RotateCw } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import { Sheet } from '../src/components/primitives/Sheet';
import { OfflineBanner } from '../src/components/primitives/StateView';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  ProjectIdea,
  fetchProjectIdeas,
  generateProjectIdeas,
  getCachedProjectIdeas,
  setCachedProjectIdeas,
} from '../src/api/projects';

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ProjectIdea | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadIdeas = useCallback(
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

      // Try local cache first for instant response
      if (user?.id) {
        const cached = await getCachedProjectIdeas(user.id);
        if (cached && cached.length > 0 && !isManualRefresh) {
          setIdeas(cached);
          setIsOfflineCache(true);
          setLoading(false);
        }
      }

      try {
        const remoteData = await fetchProjectIdeas(controller.signal);
        setIdeas(remoteData);
        setIsOfflineCache(false);
        if (user?.id) {
          await setCachedProjectIdeas(user.id, remoteData);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        // If network failed but we had cached items, keep them
        if (user?.id) {
          const cached = await getCachedProjectIdeas(user.id);
          if (cached && cached.length > 0) {
            setIdeas(cached);
            setIsOfflineCache(true);
            setError(null);
            return;
          }
        }
        setError(err.message || 'Unable to load project ideas');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadIdeas();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadIdeas]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadIdeas(true);
  };

  const handleGenerateIdeas = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);

    try {
      const generated = await generateProjectIdeas();
      if (generated && generated.length > 0) {
        // Prepend new AI generated ideas while deduplicating by _id
        setIdeas((prev) => {
          const existingIds = new Set(generated.map((g) => g._id));
          const filteredPrev = prev.filter((p) => !existingIds.has(p._id));
          const updated = [...generated, ...filteredPrev];
          if (user?.id) {
            setCachedProjectIdeas(user.id, updated).catch(() => {});
          }
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate project ideas. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Project ideas" isRoot={false} />

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
          BUILD SOMETHING REAL
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Skills become{'\n'}stronger in practice.
        </Text>

        {/* Segmented Navigation: Ideas | Hackathons | Teams */}
        <View style={[styles.segmentsContainer, { backgroundColor: hub.surface, borderColor: hub.line }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            accessibilityLabel="Ideas tab, active"
            style={[styles.segmentItem, { backgroundColor: hub.text }]}
          >
            <Text style={[styles.segmentText, { color: hub.bg, fontFamily: typography.fontBodyBold }]}>
              Ideas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/hackathons' as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            accessibilityLabel="Hackathons tab"
            style={styles.segmentItem}
          >
            <Text style={[styles.segmentText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Hackathons
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/teams' as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            accessibilityLabel="Teams tab"
            style={styles.segmentItem}
          >
            <Text style={[styles.segmentText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Teams
            </Text>
          </Pressable>
        </View>

        {/* Generate Project Ideas Action Button */}
        <Pressable
          onPress={handleGenerateIdeas}
          disabled={generating}
          accessibilityRole="button"
          accessibilityLabel="Generate project ideas with AI"
          style={({ pressed }) => [
            styles.generateButton,
            {
              backgroundColor: hub.surface,
              borderColor: hub.line,
              opacity: generating || pressed ? 0.75 : 1,
            },
          ]}
        >
          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator size="small" color={hub.text} />
              <Text style={[styles.generateLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                Generating tailored ideas…
              </Text>
            </View>
          ) : (
            <View style={styles.generatingRow}>
              <Sparkles size={18} color={hub.text} />
              <Text style={[styles.generateLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                Generate project ideas
              </Text>
            </View>
          )}
        </Pressable>

        {/* Offline Banner */}
        {isOfflineCache && <OfflineBanner onRetry={() => loadIdeas(true)} />}

        {/* Error message */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Try again"
              onPress={() => loadIdeas(true)}
              variant="secondary"
              icon={<RotateCw size={14} color={hub.text} />}
              style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
            />
          </View>
        )}

        {/* Loading indicator */}
        {loading && !refreshing && (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={hub.text} />
            <Text style={[styles.loadingText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Loading project ideas…
            </Text>
          </View>
        )}

        {/* Empty state */}
        {!loading && ideas.length === 0 && !error && (
          <Card style={styles.emptyCard}>
            <Sparkles size={36} color={hub.muted} />
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No project ideas yet
            </Text>
            <Text style={[styles.emptyDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Generate personalized project ideas aligned with your chosen career path to build your portfolio.
            </Text>
            <Button
              label="Generate project ideas"
              onPress={handleGenerateIdeas}
              variant="primary"
              icon={<Sparkles size={16} color={hub.bg} />}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Ideas List */}
        {!loading &&
          ideas.map((idea) => {
            const difficultyUpper = idea.difficulty ? idea.difficulty.toUpperCase() : null;
            const techList = Array.isArray(idea.technologies) ? idea.technologies : [];

            return (
              <Card key={idea._id} style={styles.ideaCard}>
                {difficultyUpper && (
                  <View style={[styles.difficultyTag, { borderColor: hub.line }]}>
                    <Text style={[styles.difficultyText, { color: hub.text, fontFamily: typography.fontMonoMedium }]}>
                      {difficultyUpper}
                    </Text>
                  </View>
                )}

                <Text style={[styles.ideaTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                  {idea.title}
                </Text>

                <Text style={[styles.ideaDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  {idea.description}
                </Text>

                {techList.length > 0 && (
                  <View style={styles.techRow}>
                    {techList.map((tech) => (
                      <View key={tech} style={[styles.techChip, { backgroundColor: hub.soft }]}>
                        <Text style={[styles.techChipText, { color: hub.text, fontFamily: typography.fontBody }]}>
                          {tech}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {idea.estimatedTime ? (
                  <Text style={[styles.timeText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    Estimated time · {idea.estimatedTime}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => setSelectedIdea(idea)}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore idea: ${idea.title}`}
                  hitSlop={8}
                  style={styles.exploreLink}
                >
                  <Text style={[styles.exploreText, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                    Explore the idea
                  </Text>
                  <ArrowRight size={16} color={hub.text} />
                </Pressable>
              </Card>
            );
          })}
      </ScrollView>

      {/* Project Detail Disclosure Sheet */}
      <Sheet
        visible={!!selectedIdea}
        title={selectedIdea?.title || 'Project Details'}
        onClose={() => setSelectedIdea(null)}
      >
        {selectedIdea && (
          <View style={styles.sheetBody}>
            {selectedIdea.difficulty && (
              <View style={[styles.difficultyTag, { borderColor: hub.line, alignSelf: 'flex-start' }]}>
                <Text style={[styles.difficultyText, { color: hub.text, fontFamily: typography.fontMonoMedium }]}>
                  {selectedIdea.difficulty.toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={[styles.sheetSectionTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Overview
            </Text>
            <Text style={[styles.sheetText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {selectedIdea.description}
            </Text>

            {selectedIdea.estimatedTime && (
              <View style={styles.sheetMetaRow}>
                <Text style={[styles.sheetMetaLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                  Estimated Duration:
                </Text>
                <Text style={[styles.sheetText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  {selectedIdea.estimatedTime}
                </Text>
              </View>
            )}

            {Array.isArray(selectedIdea.technologies) && selectedIdea.technologies.length > 0 && (
              <View style={styles.sheetSection}>
                <Text style={[styles.sheetSectionTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                  Recommended Technologies
                </Text>
                <View style={styles.techRow}>
                  {selectedIdea.technologies.map((t) => (
                    <View key={t} style={[styles.techChip, { backgroundColor: hub.soft }]}>
                      <Text style={[styles.techChipText, { color: hub.text, fontFamily: typography.fontBody }]}>
                        {t}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {Array.isArray(selectedIdea.features) && selectedIdea.features.length > 0 && (
              <View style={styles.sheetSection}>
                <Text style={[styles.sheetSectionTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                  Core Features to Build
                </Text>
                {selectedIdea.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <CheckCircle2 size={16} color={hub.text} style={{ marginTop: 2 }} />
                    <Text style={[styles.featureText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sheetActions}>
              <Button
                label="Find teammates for this"
                onPress={() => {
                  const title = selectedIdea.title;
                  setSelectedIdea(null);
                  router.push({
                    pathname: '/team-post',
                    params: { prefillTitle: title },
                  } as any);
                }}
                variant="primary"
                style={{ width: '100%' }}
              />
            </View>
          </View>
        )}
      </Sheet>
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
  segmentsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.chip,
    padding: 2,
    marginBottom: spacing.base,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.none,
  },
  segmentText: {
    fontSize: typography.sizes.sm,
  },
  generateButton: {
    borderWidth: 1,
    borderRadius: radii.chip,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  generateLabel: {
    fontSize: typography.sizes.body,
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
    textAlign: 'center',
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
  ideaCard: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  difficultyTag: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
    marginBottom: spacing.sm,
  },
  difficultyText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  ideaTitle: {
    fontSize: typography.sizes.heading,
    marginBottom: spacing.xs,
  },
  ideaDesc: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  techRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  techChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  techChipText: {
    fontSize: typography.sizes.fine,
  },
  timeText: {
    fontSize: typography.sizes.fine,
    marginBottom: spacing.md,
  },
  exploreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  exploreText: {
    fontSize: typography.sizes.body,
  },
  sheetBody: {
    gap: spacing.sm,
  },
  sheetSection: {
    marginTop: spacing.xs,
  },
  sheetSectionTitle: {
    fontSize: typography.sizes.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
  },
  sheetText: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  sheetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sheetMetaLabel: {
    fontSize: typography.sizes.body,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  featureText: {
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  sheetActions: {
    marginTop: spacing.base,
    paddingTop: spacing.sm,
  },
});
