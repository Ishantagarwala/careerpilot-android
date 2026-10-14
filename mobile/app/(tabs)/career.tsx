import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  DimensionValue,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, ArrowRight, ChevronRight } from 'lucide-react-native';
import { usePalette } from '../../src/theme/ThemeContext';
import { usePrimitiveSkin } from '../../src/components/primitives/skin';
import { useAuth } from '../../src/context/AuthContext';
import { AppHeader } from '../../src/components/navigation/AppHeader';
import { spacing, targetSizes, typography, radii } from '../../src/theme/tokens';
import { useBrandElevation } from '../../src/components/brand/brandElevation';
import {
  CareerRecommendation,
  fetchRecommendations,
  getAssessmentDraft,
  getCachedRecommendations,
} from '../../src/api/career';
import {
  RoadmapData,
  computeRoadmapStats,
  fetchRoadmap,
  getCachedRoadmap,
  setCachedRoadmap,
  updateMilestoneProgress,
} from '../../src/api/roadmap';

/**
 * Career — design/png/04-career.png, the ONE product screen in Language A.
 *
 *   screens.py:218-222  "the pinned direction + today's next action. This is the
 *                        one product screen that keeps language A, because the
 *                        career flow is the brand's own voice."
 *
 * The screen is exactly three blocks, in this order (screens.py:223-293):
 *
 *   1. app bar        title + one 44dp ghost-line mic action
 *   2. Your direction pinned path, disposition chips, roadmap progress
 *   3. Today          the next milestone, lime-filled because the card IS the
 *                     action, with "Open in Hub" / "Mark done"
 *   4. Recommended next  two ranked rows on a #cfd6b8 hairline
 *
 * It used to also carry a complete jobs browser — an EXPLORE pill row, a
 * Jobs/Applications segmented control, a search field, a job-type filter sheet
 * and a list of job cards. None of that is in mockup 04, and it all already
 * exists on the Build tab's Jobs segment (search + type filter + Save/Apply) and
 * in the tracker. Removing it here is what makes this screen match the design,
 * and it is why this file is now ~200 lines of interface instead of 1,700.
 *
 * Language A is cream in BOTH themes: DESIGN_SPEC.md §1 defines a dark variant
 * for the hub only, and screens.py:748 says so explicitly. So this screen reads
 * `usePalette('brand')` rather than the theme-dependent legacy `colors` alias.
 */

/**
 * Language A hairline for list separators. design/screens.py draws the
 * "recommended next" rows with 'border-color:#cfd6b8' — the brand's soft olive
 * rule, not the pure-black keyline the cards carry.
 */
const HAIRLINE = '#cfd6b8';

/**
 * Section-label colour. screens.py:258 / :273 paint every `.label` on this
 * screen with `var(--hub-muted)` (#6b7280) rather than Language A's own
 * #434933 — the mockup keeps the quiet grey labels on the cream surface too.
 * Constant, because Language A has no dark variant (DESIGN_SPEC.md §1).
 */
const SECTION_LABEL = '#6b7280';

/** "6d AGO" — the mockup's "CHANGED 6d AGO" reads the roadmap's own timestamp. */
function changedAgoLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'CHANGED TODAY';
  return 'CHANGED ' + days + 'd AGO';
}

export default function CareerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const brand = usePalette('brand');
  const brandSkin = usePrimitiveSkin('brand');
  // Language A's hard offset shadow, recoloured for the active theme.
  const shadow = useBrandElevation();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([]);
  const [stackChip, setStackChip] = useState<string | null>(null);
  const [milestoneBusy, setMilestoneBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  /**
   * The pinned direction, today's milestone and the assessment's matches.
   * Every call degrades quietly — the cached roadmap stands if the network or
   * the API is unavailable, so the screen is never blank.
   */
  const loadDirection = useCallback(async () => {
    if (!user?.id) return;

    const cachedRoadmap = await getCachedRoadmap(user.id);
    if (cachedRoadmap) setRoadmap(cachedRoadmap);

    const draft = await getAssessmentDraft(user.id);
    if (draft.lastUpdated) {
      const names = (draft.skills || [])
        .map((s) => s.name)
        .filter((name) => !!name)
        .slice(0, 2);
      if (names.length) setStackChip(names.join(' · ').toUpperCase());
    }

    try {
      const data = await fetchRoadmap();
      if (data) setRoadmap(data);
    } catch {
      // Offline or not assessed yet — the cached roadmap (if any) stands.
    }

    try {
      setRecommendations(await fetchRecommendations());
    } catch {
      const cachedRecs = await getCachedRecommendations(user.id);
      if (cachedRecs) setRecommendations(cachedRecs);
    }
  }, [user?.id]);

  // Re-read on focus: "Mark done" on the Roadmap screen must be reflected here.
  useFocusEffect(
    useCallback(() => {
      loadDirection();
    }, [loadDirection])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDirection();
    } finally {
      setRefreshing(false);
    }
  }, [loadDirection]);

  /**
   * "Mark done" on today's milestone — the same write the roadmap screen
   * performs, so both surfaces agree afterwards.
   */
  const handleMarkMilestoneDone = async (milestoneId: string, title: string) => {
    if (!roadmap || milestoneBusy) return;
    setMilestoneBusy(true);
    try {
      const updated = await updateMilestoneProgress(milestoneId, true);
      setRoadmap(updated);
      if (user?.id) await setCachedRoadmap(user.id, updated);
      setFeedback('Marked "' + title + '" complete');
    } catch (err: any) {
      setFeedback(err?.message || 'Could not update milestone');
    } finally {
      setMilestoneBusy(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // ---- Derivations --------------------------------------------------------
  const stats = computeRoadmapStats(roadmap);
  const flatMilestones = (roadmap?.stages || []).flatMap((stage) =>
    (stage.milestones || []).map((milestone) => ({ stage, milestone }))
  );
  const todayEntry = flatMilestones.find((entry) => !entry.milestone.completed) || null;
  const todayPosition = todayEntry ? flatMilestones.indexOf(todayEntry) + 1 : 0;
  const todayTopic = todayEntry
    ? (todayEntry.stage.topics || []).find((topic) => topic.title === todayEntry.milestone.title)
    : undefined;
  const changedLabel = changedAgoLabel((roadmap as any)?.updatedAt as string | undefined);

  /*
   * Disposition chips. The mockup shows a stack ("MERN") and a
   * location-plus-level pair ("INDIA · ENTRY"); the profile API carries no
   * country or seniority, so the second chip reports the real signals we do
   * have: the roadmap's current stage and its total duration estimate.
   */
  const stageLabel = roadmap?.currentStage ? roadmap.currentStage.toUpperCase() : null;
  const dispositionChips = [
    stackChip,
    roadmap
      ? [stageLabel, roadmap.totalEstimatedWeeks].filter(Boolean).join(' · ').toUpperCase()
      : null,
  ].filter((chip): chip is string => !!chip);

  const todayMeta = todayEntry
    ? [
        'Milestone ' + todayPosition + ' of ' + flatMilestones.length,
        todayEntry.stage.name.charAt(0).toUpperCase() + todayEntry.stage.name.slice(1),
        todayTopic?.timeEstimate,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const recommendedNext = [...recommendations]
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 3)
    .map((rec, index) => ({
      ...rec,
      rank: index + 1,
      isCurrentPath:
        !!roadmap?.careerPath &&
        rec.careerPath.trim().toLowerCase() === roadmap.careerPath.trim().toLowerCase(),
    }));

  return (
    <View style={[styles.container, { backgroundColor: brand.background }]}>
      {/*
       * App bar — screens.py:225-229: title left, one trailing 44dp
       * `.iconbtn.ghost-line` action carrying a mic. Painted in Language A via
       * the skin, so its keyline is the brand's 2px black, not a hub hairline.
       */}
      <AppHeader
        title="Career"
        isRoot
        language="brand"
        trailing={<Mic size={targetSizes.iconSize} color={brandSkin.text} />}
        trailingLabel="Ask CareerPilot by voice"
        onTrailingPress={() => router.push('/(tabs)/hub' as any)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={brand.foreground}
            colors={[brand.foreground]}
          />
        }
      >
        {/* ---------------- YOUR DIRECTION ---------------- */}
        <View
          style={[
            styles.brandCard,
            styles.directionCard,
            { backgroundColor: brand.card, borderColor: brand.border },
            shadow.brand,
          ]}
        >
          <View style={styles.cardTopRow}>
            {/*
             * screens.py:234 — `.tag.dark` with border-width:2px. The pill is
             * #050505, has its own 2px black keyline, is 25px tall with a 7px
             * radius, and its label is Space Grotesk 600.
             */}
            <View style={styles.darkPill}>
              <Text style={[styles.darkPillText, { color: '#FFFFFF' }]}>YOUR DIRECTION</Text>
            </View>
            {changedLabel && (
              <Text style={[styles.changedLabel, { color: brand.foreground }]}>
                {changedLabel}
              </Text>
            )}
          </View>

          <Text
            style={[
              styles.directionTitle,
              { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
            ]}
          >
            {roadmap?.careerPath || 'No direction pinned yet'}
          </Text>

          {dispositionChips.length > 0 && (
            <View style={styles.chipRow}>
              {dispositionChips.map((chip) => (
                <View key={chip} style={[styles.chip, { borderColor: brand.border }]}>
                  <Text style={[styles.chipText, { color: brand.foreground }]}>{chip}</Text>
                </View>
              ))}
            </View>
          )}

          {roadmap ? (
            <View style={styles.roadmapBlock}>
              <View style={styles.roadmapRow}>
                <Text style={[styles.roadmapLabel, { color: brand.foreground }]}>ROADMAP</Text>
                <Text
                  style={[
                    styles.roadmapPercent,
                    { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
                  ]}
                >
                  {stats.percent}%
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: stats.percent }}
                style={[
                  styles.roadmapTrack,
                  { backgroundColor: brand.muted, borderColor: brand.border },
                ]}
              >
                <View
                  style={[
                    styles.roadmapFill,
                    {
                      width: (stats.percent + '%') as DimensionValue,
                      backgroundColor: brand.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.roadmapMeta, { color: brand.mutedForeground }]}>
                {stats.completed} of {stats.total} milestones complete
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/interests' as any)}
              accessibilityRole="button"
              accessibilityLabel="Take the career assessment to pin a direction"
              style={({ pressed }) => [
                styles.pinDirectionButton,
                {
                  backgroundColor: brand.card,
                  borderColor: brand.border,
                  opacity: pressed ? 0.75 : 1,
                },
                shadow.brandSmall,
              ]}
            >
              <Text
                style={[
                  styles.pinDirectionText,
                  { color: brand.foreground, fontFamily: typography.fontHeading },
                ]}
              >
                Find my path
              </Text>
              <ArrowRight size={16} color={brand.foreground} />
            </Pressable>
          )}
        </View>

        {/* ---------------- TODAY ---------------- */}
        {roadmap && (
          <>
            <Text style={[styles.eyebrow, { color: SECTION_LABEL }]}>TODAY</Text>

            {/*
             * The one full-lime card in the app. DESIGN_SPEC.md §2 flags it as
             * the known edge case and defends it: "the card IS the action".
             */}
            <View
              style={[
                styles.todayCard,
                { backgroundColor: brand.primary, borderColor: brand.border },
                shadow.brand,
              ]}
            >
              <Text
                style={[
                  styles.todayTitle,
                  { color: brand.primaryForeground, fontFamily: typography.fontHeading },
                ]}
              >
                {todayEntry?.milestone.title || 'Every milestone is complete'}
              </Text>
              <Text style={[styles.todayMeta, { color: brand.primaryForeground }]}>
                {todayMeta || 'Pick the next direction whenever you are ready'}
              </Text>

              <View style={styles.todayActions}>
                <Pressable
                  onPress={() => router.push('/(tabs)/hub' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Open today's milestone in the AI Hub"
                  style={({ pressed }) => [
                    styles.solidButton,
                    {
                      backgroundColor: brand.card,
                      borderColor: brand.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                    shadow.brandSmall,
                  ]}
                >
                  <Text
                    style={[
                      styles.solidButtonText,
                      { color: brand.foreground, fontFamily: typography.fontHeading },
                    ]}
                  >
                    Open in Hub
                  </Text>
                </Pressable>

                {todayEntry && (
                  <Pressable
                    onPress={() =>
                      handleMarkMilestoneDone(
                        todayEntry.milestone._id || todayEntry.milestone.title,
                        todayEntry.milestone.title
                      )
                    }
                    disabled={milestoneBusy}
                    accessibilityRole="button"
                    accessibilityLabel={'Mark ' + todayEntry.milestone.title + ' complete'}
                    accessibilityState={{ disabled: milestoneBusy, busy: milestoneBusy }}
                    style={({ pressed }) => [
                      styles.ghostButton,
                      {
                        borderColor: brand.border,
                        opacity: milestoneBusy ? 0.5 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    {milestoneBusy ? (
                      <ActivityIndicator size="small" color={brand.primaryForeground} />
                    ) : (
                      <Text
                        style={[
                          styles.solidButtonText,
                          {
                            color: brand.primaryForeground,
                            fontFamily: typography.fontHeading,
                          },
                        ]}
                      >
                        Mark done
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}

        {/* Confirmation / failure for the milestone write, and nothing else —
            the jobs feedback banner that used to live here went with the
            browser. */}
        {!!feedback && (
          <View
            style={[
              styles.feedbackBanner,
              { backgroundColor: brand.card, borderColor: brand.border },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.feedbackText, { color: brand.foreground }]}>{feedback}</Text>
          </View>
        )}

        {/* ---------------- RECOMMENDED NEXT ---------------- */}
        {recommendedNext.length > 0 && (
          <>
            <Text style={[styles.eyebrow, { color: SECTION_LABEL }]}>RECOMMENDED NEXT</Text>

            <View>
              {recommendedNext.map((rec, index) => (
                <Pressable
                  key={rec._id || rec.careerPath}
                  onPress={() => router.push('/matches' as any)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    rec.careerPath + ', ' + rec.matchScore + '% match. Open career matches'
                  }
                  style={({ pressed }) => [
                    styles.recRow,
                    index < recommendedNext.length - 1
                      ? { borderBottomWidth: 1.5, borderBottomColor: HAIRLINE }
                      : null,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  {/* screens.py:276-277 — the rank tile is a WHITE fill with a
                      2px black keyline, so it reads as a counter, not a hole. */}
                  <View
                    style={[
                      styles.recBadge,
                      { borderColor: brand.border, backgroundColor: brand.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.recBadgeText,
                        {
                          color: brand.foreground,
                          fontFamily: typography.fontHeadingExtraBold,
                        },
                      ]}
                    >
                      {rec.rank}
                    </Text>
                  </View>
                  <View style={styles.recBody}>
                    <Text
                      style={[
                        styles.recTitle,
                        { color: brand.foreground, fontFamily: typography.fontBodyBold },
                      ]}
                    >
                      {rec.careerPath}
                    </Text>
                    <Text style={[styles.recMeta, { color: SECTION_LABEL }]}>
                      {rec.matchScore}% match ·{' '}
                      {rec.isCurrentPath ? 'your direction' : 'from your assessment'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={brand.foreground} style={styles.recChevron} />
                </Pressable>
              ))}
            </View>
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
  },
  eyebrow: {
    // css:175-176 — .label: Space Grotesk 600 / 11 / .1em uppercase
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    lineHeight: typography.sizes.fine * typography.lineHeights.label,
    letterSpacing: 1.1, // .1em at 11px
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  brandCard: {
    // css / screens.py:231 — 2px solid #000, radius 8, 4px 4px 0 #000
    borderWidth: 2,
    borderRadius: radii.sm,
  },
  directionCard: {
    padding: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  darkPill: {
    // screens.py:234 `.tag dark` with border-width:2px
    height: 25,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: '#050505',
    borderColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkPillText: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44, // .04em at 11px
    textTransform: 'uppercase',
  },
  changedLabel: {
    // screens.py:236 — mono 11 / 600
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
  directionTitle: {
    // screens.py:238-240 — Anybody 800 29 / 1.05 / -.03em
    fontSize: 29,
    lineHeight: 30,
    letterSpacing: -0.87, // -.03em at 29px
    marginTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    // screens.py:242-243 — `.tag` 25px / radius 7 / 1.5px keyline
    height: 25,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
  roadmapBlock: {
    marginTop: spacing.base,
  },
  roadmapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roadmapLabel: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.88, // .08em at 11px
  },
  roadmapPercent: {
    fontSize: 15,
  },
  roadmapTrack: {
    // screens.py:251-252 — height 9, 2px keyline, --muted fill, square fill
    height: 9,
    borderRadius: 0,
    borderWidth: 2,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  roadmapFill: {
    height: '100%',
    borderRadius: 0,
  },
  roadmapMeta: {
    // screens.py:253 — 12.5px
    fontFamily: typography.fontBody,
    fontSize: 12.5,
    lineHeight: 12.5 * typography.lineHeights.meta,
    marginTop: spacing.sm,
  },
  pinDirectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // screens.py:266 — the mockup's inline buttons are 42px tall
    minHeight: 42,
    borderWidth: 2,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.base,
    marginTop: spacing.base,
  },
  pinDirectionText: {
    fontSize: typography.sizes.md,
  },
  todayCard: {
    borderWidth: 2,
    borderRadius: radii.sm,
    padding: spacing.base,
  },
  todayTitle: {
    // screens.py:261-262 — Anybody 700 16.5
    fontSize: 16.5,
    lineHeight: 16.5 * typography.lineHeights.section,
    letterSpacing: -0.17,
  },
  todayMeta: {
    // screens.py:263-264 — 13px at .78 opacity
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.meta,
    marginTop: 5,
    opacity: 0.78,
  },
  todayActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 14,
  },
  solidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // screens.py:266-269 — height 42, 14.5px label
    minHeight: 42,
    borderWidth: 2,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.base,
  },
  solidButtonText: {
    fontFamily: typography.fontHeading,
    fontSize: 14.5,
    letterSpacing: -0.15,
  },
  ghostButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.base,
  },
  feedbackBanner: {
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  feedbackText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: typography.sizes.sm,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // screens.py:275 — the mockup's `.rowline` is padding: 13px 0
    minHeight: targetSizes.minTouch,
    paddingVertical: 13,
  },
  recBadge: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadgeText: {
    fontSize: 15,
  },
  recBody: {
    flex: 1,
    minWidth: 0,
  },
  recTitle: {
    fontSize: 14.5,
    lineHeight: 14.5 * typography.lineHeights.normal,
  },
  recMeta: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.xs,
    lineHeight: typography.sizes.xs * typography.lineHeights.meta,
    marginTop: 2,
  },
  recChevron: {
    opacity: 0.5,
  },
});
