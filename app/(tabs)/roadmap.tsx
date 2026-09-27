import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { ChevronGlyph, MenuGlyph } from '@/components/glyphs/TabGlyphs';
import { Tag } from '@/components/Tag';
import { IconButton } from '@/components/hub/HubControls';
import { milestoneKey, useCareer } from '@/career/useCareer';
import { OfflineBanner } from '@/offline/OfflineBanner';
import { haptics } from '@/ui/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Roadmap — the milestone spine, Language B (hub).
 *
 * Matches design/png/05-roadmap.png. Milestones are toggled inline; the state
 * is optimistic in useCareer, so the knob fills immediately and rolls back if
 * the write fails.
 *
 * The rail is lime above the current milestone and hairline below it, which is
 * the one place a long lime fill is allowed — it encodes progress, not
 * decoration.
 */
type Filter = 'all' | 'todo' | 'done';

export default function RoadmapScreen() {
  const hub = useTheme('hub');
  const { loading, error, roadmap, progress, pending, stale, cachedAt, reload, toggleMilestone } =
    useCareer();
  const [filter, setFilter] = useState<Filter>('all');

  // Flattened stages so the spine reads as one continuous list, with stage
  // headers acting as the only interruption.
  const stages = roadmap?.stages ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.gutter}>
        <AppBar
          title="Roadmap"
          subtitle={roadmap?.careerPath}
          titleSize="appbar"
          leading={
            <IconButton label="Back" onPress={() => router.back()}>
              <View style={styles.back}>
                <ChevronGlyph color={hub.text} size={20} />
              </View>
            </IconButton>
          }
          trailing={
            progress.total > 0 ? (
              <Tag tone="lime">{Math.round(progress.ratio * 100)}%</Tag>
            ) : undefined
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {stale ? (
          <OfflineBanner message="You're offline. This is your saved roadmap." cachedAt={cachedAt} />
        ) : null}

        {progress.total > 0 ? (
          <View
            style={[styles.segmented, { backgroundColor: hub.soft }]}
            accessibilityRole="tablist"
            accessibilityLabel="Filter milestones"
          >
            {(
              [
                ['all', `All ${progress.total}`],
                ['todo', `Left ${progress.total - progress.completed}`],
                ['done', `Done ${progress.completed}`],
              ] as [Filter, string][]
            ).map(([key, label]) => {
              const active = key === filter;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  style={[styles.segment, active ? { backgroundColor: hub.surface } : null]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active ? hub.text : hub.muted,
                        fontFamily: active ? fontFamily.monoBold : fontFamily.monoMedium,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={hub.strong} />
          </View>
        ) : null}

        {!loading && error ? (
          <View style={[styles.errorBox, { borderColor: hub.danger }]}>
            <Text style={[styles.errorText, { color: hub.danger }]}>{error}</Text>
            <Pressable onPress={reload} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.retry, { color: hub.text }]}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !roadmap ? (
          <View style={styles.center}>
            <Text style={[styles.emptyTitle, { color: hub.text }]}>No roadmap yet</Text>
            <Text style={[styles.emptyBody, { color: hub.muted }]}>
              Pin a career direction first, then CareerPilot builds a staged
              roadmap with milestones for it.
            </Text>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              style={[styles.emptyCta, { borderColor: hub.strong }]}
            >
              <Text style={[styles.emptyCtaText, { color: hub.text }]}>Back to Career</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && roadmap
          ? stages.map((stage) => {
              const visible = (stage.milestones ?? []).filter((m) => {
                if (filter === 'done') return m.completed;
                if (filter === 'todo') return !m.completed;
                return true;
              });
              if (!visible.length) return null;

              const stageDone = (stage.milestones ?? []).every((m) => m.completed);

              return (
                <View key={stage.name}>
                  <SectionLabel>
                    {(stage.title ?? stage.name).toString()}
                    {stageDone ? '  ·  COMPLETE' : ''}
                  </SectionLabel>

                  {visible.map((milestone, index) => {
                    const key = milestoneKey(milestone);
                    const isLast = index === visible.length - 1;
                    // The rail below a milestone is lime when it is done.
                    const railDone = milestone.completed;

                    return (
                      <View key={key} style={styles.milestone}>
                        <View style={styles.rail}>
                          <Pressable
                            onPress={async () => {
                              const target = !milestone.completed;
                              // Fired before the await so the feedback is
                              // immediate; the optimistic update is the visual
                              // half of the same confirmation.
                              if (target) haptics.confirm();
                              else haptics.tap();
                              await toggleMilestone(key, target);
                            }}
                            disabled={pending !== null}
                            accessibilityRole="checkbox"
                            accessibilityState={{
                              checked: milestone.completed,
                              disabled: pending !== null,
                              busy: pending === key,
                            }}
                            accessibilityLabel={`${milestone.title}, ${
                              milestone.completed ? 'completed' : 'not completed'
                            }`}
                            hitSlop={10}
                            style={[
                              styles.knob,
                              {
                                borderColor: milestone.completed ? hub.primary : hub.line,
                                backgroundColor: milestone.completed ? hub.primary : hub.surface,
                              },
                              pending === key ? styles.knobPending : null,
                            ]}
                          >
                            {milestone.completed ? (
                              <View style={styles.check} />
                            ) : (
                              <View style={[styles.knobDot, { backgroundColor: hub.line }]} />
                            )}
                          </Pressable>
                          {!isLast ? (
                            <View
                              style={[
                                styles.railLine,
                                { backgroundColor: railDone ? hub.primary : hub.line },
                              ]}
                            />
                          ) : null}
                        </View>

                        <View style={styles.milestoneBody}>
                          <Text style={[styles.milestoneTitle, { color: hub.text }]}>
                            {milestone.title}
                          </Text>
                          <Text style={[styles.milestoneMeta, { color: hub.muted }]}>
                            {milestone.completed ? 'DONE' : 'TO DO'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          : null}

        {!loading && roadmap && filter !== 'all' ? (
          <Text style={[styles.filterNote, { color: hub.muted }]}>
            Showing {filter === 'done' ? 'completed' : 'remaining'} milestones only.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s8 },
  back: { transform: [{ rotate: '180deg' }] },

  segmented: { flexDirection: 'row', gap: 3, borderRadius: 11, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  segmentText: { fontSize: 11.5, letterSpacing: 0.2 },

  center: { alignItems: 'center', paddingVertical: space.s10, gap: 8 },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: 18 },
  emptyBody: {
    fontFamily: fontFamily.sans,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyCta: {
    marginTop: 8,
    height: 46,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: { fontFamily: fontFamily.sansSemiBold, fontSize: 14 },

  milestone: { flexDirection: 'row', gap: space.s3 },
  rail: { width: 24, alignItems: 'center' },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobPending: { opacity: 0.5 },
  knobDot: { width: 6, height: 6, borderRadius: 3 },
  check: {
    width: 6,
    height: 10,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#151f00',
    transform: [{ rotate: '40deg' }, { translateX: -1 }, { translateY: -2 }],
  },
  railLine: { flex: 1, width: 2, marginVertical: 3 },

  milestoneBody: { flex: 1, paddingBottom: space.s5 },
  milestoneTitle: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 15,
    letterSpacing: -0.1,
    lineHeight: 21,
  },
  milestoneMeta: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 3,
  },

  errorBox: {
    borderWidth: 1.5,
    borderRadius: radius.chip,
    padding: space.s3,
    gap: 6,
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 19 },
  retry: {
    fontFamily: fontFamily.monoBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  filterNote: { fontFamily: fontFamily.sans, fontSize: 12, marginTop: space.s4 },
});
