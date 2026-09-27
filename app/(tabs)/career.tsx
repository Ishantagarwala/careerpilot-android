import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { ChevronGlyph } from '@/components/glyphs/TabGlyphs';
import { Tag } from '@/components/Tag';
import { useCareer, milestoneKey } from '@/career/useCareer';
import { OfflineBanner } from '@/offline/OfflineBanner';
import { haptics } from '@/ui/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { brandLight, elevation, fontFamily, radius, space } from '@/theme/tokens';

/**
 * Career — Language A (brand).
 *
 * Matches design/png/04-career.png, now reading live data from
 * career/recommendations and roadmap.
 *
 * This is the one product screen that keeps the brand language, because the
 * career flow is where the product speaks in its own voice: the pinned
 * direction and the next milestone are the app's two most consequential facts.
 * See design/DESIGN_SPEC.md §2 for the lime budget this spends.
 */
export default function CareerScreen() {
  const hub = useTheme('hub');
  const {
    loading,
    error,
    recommendations,
    selected,
    progress,
    pending,
    stale,
    cachedAt,
    reload,
    toggleMilestone,
  } = useCareer();

  const direction = selected?.careerPath ?? null;
  const next = progress.next;

  return (
    <Screen padded={false} style={{ backgroundColor: brandLight.background }}>
      <View style={styles.gutter}>
        <AppBar title="Career" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {stale ? (
          <OfflineBanner
            message="You're offline. Showing your last synced direction."
            cachedAt={cachedAt}
          />
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={brandLight.foreground} />
            <Text style={styles.loadingText}>Loading your direction…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={reload} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !direction ? (
          <View style={styles.card}>
            <Tag tone="dark">Get started</Tag>
            <Text style={styles.direction}>No direction pinned yet.</Text>
            <Text style={styles.emptyBody}>
              Take the assessment and CareerPilot will recommend career paths
              scored against your skills, then build a roadmap for the one you
              pick.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start assessment"
              style={[styles.cta, styles.disabledCta]}
            >
              <Text style={styles.ctaText}>Assessment — coming next</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && direction ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Tag tone="dark">Your direction</Tag>
              <View style={styles.flexChild} />
              {selected?.matchScore != null ? (
                <Text style={styles.changed}>{selected.matchScore}% MATCH</Text>
              ) : null}
            </View>

            <Text style={styles.direction}>{direction}</Text>

            {selected?.reasoning ? (
              <Text style={styles.reasoning} numberOfLines={4}>
                {selected.reasoning}
              </Text>
            ) : null}

            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>ROADMAP</Text>
              <Text style={styles.progressValue}>
                {Math.round(progress.ratio * 100)}%
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${progress.ratio * 100}%` }]} />
            </View>
            <Text style={styles.progressMeta}>
              {progress.completed} of {progress.total} milestones complete
            </Text>
          </View>
        ) : null}

        {!loading && next ? (
          <>
            <SectionLabel>Next milestone</SectionLabel>
            <View style={styles.todayCard}>
              <Text style={styles.todayTitle}>{next.milestone.title}</Text>
              <Text style={styles.todayMeta}>
                {next.stage.title ?? capitalise(next.stage.name)}
                {' · tap to mark complete'}
              </Text>
              <View style={styles.todayActions}>
                <Pressable
                  onPress={async () => {
                    haptics.confirm();
                    await toggleMilestone(milestoneKey(next.milestone), true);
                  }}
                  disabled={pending !== null}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: false,
                    disabled: pending !== null,
                    busy: pending === milestoneKey(next.milestone),
                  }}
                  accessibilityLabel={`Mark ${next.milestone.title} complete`}
                  style={[styles.todayPrimary, pending !== null ? styles.dim : null]}
                >
                  <Text style={styles.todayPrimaryText}>
                    {pending === milestoneKey(next.milestone) ? 'Saving…' : 'Mark done'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(tabs)/roadmap')}
                  accessibilityRole="button"
                  accessibilityLabel="View full roadmap"
                  style={styles.todaySecondary}
                >
                  <Text style={styles.todaySecondaryText}>Full roadmap</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {!loading && recommendations.length > 0 ? (
          <>
            <SectionLabel>Recommended paths</SectionLabel>
            <View style={[styles.listCard, { borderColor: '#cfd6b8' }]}>
              {recommendations.slice(0, 4).map((rec, i, all) => (
                <View
                  key={rec._id}
                  style={[styles.row, i < all.length - 1 ? styles.rowDivider : null]}
                >
                  <View style={styles.rankBox}>
                    <Text style={styles.rankText}>{i + 1}</Text>
                  </View>
                  <View style={styles.flexChild}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {rec.careerPath}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {rec.matchScore != null ? `${rec.matchScore}% match` : 'Awaiting score'}
                      {rec.selected ? ' · your direction' : ''}
                    </Text>
                  </View>
                  {rec.selected ? <Tag tone="lime">Pinned</Tag> : <ChevronGlyph color="#8b9179" />}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!loading && progress.total === 0 && direction ? (
          <Text style={[styles.footnote, { color: hub.muted }]}>
            No roadmap yet. Generate one from the Roadmap tab.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const b = brandLight;

const styles = StyleSheet.create({
  flexChild: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s8 },

  center: { alignItems: 'center', paddingVertical: space.s10, gap: 10 },
  loadingText: { fontFamily: fontFamily.sans, fontSize: 13, color: b.mutedForeground },

  card: {
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.card,
    borderRadius: radius.brand,
    padding: 18,
    ...elevation.brand,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  changed: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: b.mutedForeground,
  },
  direction: {
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 29,
    lineHeight: 31,
    letterSpacing: -1,
    color: b.foreground,
    marginTop: 14,
  },
  reasoning: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 20,
    color: b.mutedForeground,
    marginTop: 10,
  },
  emptyBody: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 21,
    color: b.mutedForeground,
    marginTop: 10,
  },
  cta: {
    marginTop: 16,
    height: 48,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledCta: { borderStyle: 'dashed' },
  ctaText: { fontFamily: fontFamily.heading, fontSize: 15, color: b.foreground },

  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  progressLabel: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: b.foreground,
  },
  progressValue: { fontFamily: fontFamily.headingExtraBold, fontSize: 15, color: b.foreground },
  track: {
    height: 9,
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.muted,
    marginTop: 8,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: b.primary },
  progressMeta: { fontSize: 12.5, color: b.mutedForeground, marginTop: 8 },

  todayCard: {
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.primary,
    borderRadius: radius.brand,
    padding: space.s4,
    ...elevation.brand,
  },
  todayTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 16.5,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: b.primaryForeground,
  },
  todayMeta: { fontSize: 13, marginTop: 5, color: b.foreground, opacity: 0.78 },
  todayActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  todayPrimary: {
    height: 42,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.card,
    borderRadius: radius.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.brandSmall,
  },
  todayPrimaryText: { fontFamily: fontFamily.heading, fontSize: 14.5, color: b.foreground },
  todaySecondary: {
    height: 42,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: b.border,
    borderRadius: radius.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaySecondaryText: { fontFamily: fontFamily.heading, fontSize: 14.5, color: b.foreground },
  dim: { opacity: 0.5 },

  listCard: { borderTopWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1.5, borderBottomColor: '#cfd6b8' },
  rankBox: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    backgroundColor: b.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontFamily: fontFamily.headingExtraBold, fontSize: 15, color: b.foreground },
  rowTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5, color: b.foreground },
  rowMeta: { fontSize: 12, color: b.mutedForeground, marginTop: 2 },

  errorBox: {
    borderWidth: 2,
    borderColor: b.destructive,
    borderRadius: radius.brand,
    padding: space.s4,
    backgroundColor: '#fdf3f3',
    gap: 8,
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 20, color: b.destructive },
  retry: {
    fontFamily: fontFamily.monoBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: b.foreground,
  },

  footnote: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: space.s6,
  },
});
