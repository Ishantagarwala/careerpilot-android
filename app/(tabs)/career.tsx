import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { ChevronGlyph, MicGlyph } from '@/components/glyphs/TabGlyphs';
import { Tag } from '@/components/Tag';
import { IconButton } from '@/components/hub/HubControls';
import { useTheme } from '@/theme/ThemeProvider';
import { brandLight, elevation, fontFamily, radius, space } from '@/theme/tokens';

/**
 * Career — Language A (brand).
 *
 * Matches design/png/04-career.png.
 *
 * This is the one product screen that keeps the brand language, because the
 * career flow is where the product speaks in its own voice: the pinned
 * direction and today's milestone are the app's two most consequential pieces
 * of information. See design/DESIGN_SPEC.md §2 for the lime budget this spends.
 *
 * Data is placeholder in this phase; the endpoints it will read are
 * career/recommendations, career/select and roadmap/progress.
 */
export default function CareerScreen() {
  const hub = useTheme('hub');
  const b = brandLight;

  return (
    <Screen padded={false} style={{ backgroundColor: b.background }}>
      <View style={styles.gutter}>
        <AppBar
          title="Career"
          trailing={
            <IconButton bordered label="Answer assessment by voice">
              <MicGlyph color={b.foreground} />
            </IconButton>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {/* Pinned direction — the app's single most important fact */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Tag tone="dark">Your direction</Tag>
            <View style={styles.flexChild} />
            <Text style={styles.changed}>CHANGED 6D AGO</Text>
          </View>

          <Text style={styles.direction}>
            Full Stack{'\n'}Developer
          </Text>

          <View style={styles.tagRow}>
            <Tag>MERN</Tag>
            <Tag>India · entry</Tag>
          </View>

          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>ROADMAP</Text>
            <Text style={styles.progressValue}>38%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: '38%' }]} />
          </View>
          <Text style={styles.progressMeta}>5 of 13 milestones complete</Text>
        </View>

        <SectionLabel>Today</SectionLabel>
        <View style={styles.todayCard}>
          <Text style={styles.todayTitle}>Build a CRUD API with Express</Text>
          <Text style={styles.todayMeta}>Milestone 6 · ~90 min · then push to GitHub</Text>
          <View style={styles.todayActions}>
            <View style={styles.todayPrimary}>
              <Text style={styles.todayPrimaryText}>Open in Hub</Text>
            </View>
            <View style={styles.todaySecondary}>
              <Text style={styles.todaySecondaryText}>Mark done</Text>
            </View>
          </View>
        </View>

        <SectionLabel>Recommended next</SectionLabel>
        <View style={[styles.listCard, { borderColor: '#cfd6b8' }]}>
          {[
            { rank: '1', title: 'Backend Engineer (Node)', meta: '92% match · 4 missing skills' },
            { rank: '2', title: 'Full Stack (MERN)', meta: '88% match · 6 missing skills' },
          ].map((row, i, all) => (
            <Pressable
              key={row.rank}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}, ${row.meta}`}
              style={[styles.row, i < all.length - 1 ? styles.rowDivider : null]}
            >
              <View style={styles.rankBox}>
                <Text style={styles.rankText}>{row.rank}</Text>
              </View>
              <View style={styles.flexChild}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowMeta}>{row.meta}</Text>
              </View>
              <ChevronGlyph color="#8b9179" />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.footnote, { color: hub.muted }]}>
          Recommendations, milestones and progress sync from careerpilot.cc. This
          screen is not yet wired to the API.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const b = brandLight;

const styles = StyleSheet.create({
  flexChild: { flex: 1 },
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s8 },

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
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

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

  listCard: { borderTopWidth: 1.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 13,
  },
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

  footnote: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: space.s6,
  },
});
