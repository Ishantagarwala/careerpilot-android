import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { PlusGlyph } from '@/components/glyphs/TabGlyphs';
import { IconButton } from '@/components/hub/HubControls';
import { Tag } from '@/components/Tag';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Build — Resume, Projects, Jobs. Language B (hub).
 *
 * Matches design/png/06-build-resume.png and 07-build-jobs.png.
 *
 * The ATS score is the screen's single focal number: a progress ring with the
 * value in Anybody 800 and a mono uppercase caption. Ranked fixes sit under it
 * because a score without a next action is just anxiety.
 */
type Segment = 'Resume' | 'Projects' | 'Jobs';
const SEGMENTS: Segment[] = ['Resume', 'Projects', 'Jobs'];

export default function BuildScreen() {
  const hub = useTheme('hub');
  const [segment, setSegment] = useState<Segment>('Resume');

  return (
    <Screen padded={false}>
      <View style={styles.gutter}>
        <AppBar
          title="Build"
          trailing={
            <IconButton bordered label="Add">
              <PlusGlyph color={hub.text} />
            </IconButton>
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Segmented
          options={SEGMENTS}
          value={segment}
          onChange={setSegment}
          track={hub.soft}
          surface={hub.surface}
          text={hub.text}
          muted={hub.muted}
        />

        {segment === 'Resume' ? <ResumePanel /> : null}
        {segment === 'Jobs' ? <JobsPanel /> : null}
        {segment === 'Projects' ? <ProjectsPanel /> : null}
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

function Segmented<T extends string>({
  options,
  value,
  onChange,
  track,
  surface,
  text,
  muted,
}: {
  options: T[];
  value: T;
  onChange: (next: T) => void;
  track: string;
  surface: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: track }]} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Text
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            suppressHighlighting
            style={[
              styles.segment,
              {
                backgroundColor: active ? surface : 'transparent',
                color: active ? text : muted,
                fontFamily: active ? fontFamily.monoBold : fontFamily.monoMedium,
              },
            ]}
          >
            {opt}
          </Text>
        );
      })}
    </View>
  );
}

function ResumePanel() {
  const hub = useTheme('hub');
  const score = 71;

  return (
    <>
      <View style={[styles.card, styles.row, { borderColor: hub.line, backgroundColor: hub.surface }]}>
        <ScoreRing value={score} label="ATS score" track={hub.soft} fill={hub.primary} text={hub.text} muted={hub.muted} />
        <View style={styles.flexChild}>
          <Text style={[styles.cardTitle, { color: hub.text }]}>Fullstack_Resume_v4</Text>
          <Text style={[styles.cardMeta, { color: hub.muted }]}>Updated 2 days ago · 1 page</Text>
          <View style={styles.tagRow}>
            <Tag>3 keywords missing</Tag>
            <Tag>1 weak bullet</Tag>
          </View>
        </View>
      </View>

      <SectionLabel>Fix these to score higher</SectionLabel>
      <View style={styles.stack}>
        <FixRow
          priority="HIGH"
          tone="danger"
          title="Add “Docker” and “CI/CD”."
          detail="Present in 78% of the backend roles you match."
        />
        <FixRow
          priority="MED"
          tone="outline"
          title="Quantify the project bullet."
          detail="“Built an API” → add users or request volume."
        />
      </View>

      <SectionLabel>Target a job description</SectionLabel>
      <View style={[styles.card, styles.row, { borderColor: hub.line, backgroundColor: hub.surface }]}>
        <Text style={[styles.pasteHint, { color: hub.muted }]}>
          Paste a JD to match against…
        </Text>
        <Tag tone="dark">Match</Tag>
      </View>

      <Text style={[styles.footnote, { color: hub.muted }]}>
        Scores come from resume/ats-analyze. Not yet wired to the API.
      </Text>
    </>
  );
}

function FixRow({
  priority,
  tone,
  title,
  detail,
}: {
  priority: string;
  tone: 'danger' | 'outline';
  title: string;
  detail: string;
}) {
  const hub = useTheme('hub');
  return (
    <View style={[styles.card, styles.row, styles.alignTop, { borderColor: hub.line, backgroundColor: hub.surface }]}>
      <Tag tone={tone}>{priority}</Tag>
      <View style={styles.flexChild}>
        <Text style={[styles.fixTitle, { color: hub.text }]}>{title}</Text>
        <Text style={[styles.fixDetail, { color: hub.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

function JobsPanel() {
  const hub = useTheme('hub');
  return (
    <>
      <View style={styles.chipRow}>
        <Tag tone="dark">Applied 7</Tag>
        <Tag>Interview 2</Tag>
        <Tag>Offer 1</Tag>
      </View>

      <SectionLabel>Fresh matches</SectionLabel>
      <View style={styles.stack}>
        {[
          { co: 'Z', title: 'Backend Engineer — Node.js', meta: 'Zoho · Chennai · ₹6–9 LPA', match: '92%', missing: 'Missing: Docker' },
          { co: 'F', title: 'Full Stack Developer', meta: 'Freshworks · Remote · ₹7–11 LPA', match: '81%', missing: null },
        ].map((job) => (
          <View
            key={job.title}
            style={[styles.card, { borderColor: hub.line, backgroundColor: hub.surface }]}
          >
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: hub.soft }]}>
                <Text style={[styles.avatarText, { color: hub.text }]}>{job.co}</Text>
              </View>
              <View style={styles.flexChild}>
                <Text style={[styles.jobTitle, { color: hub.text }]}>{job.title}</Text>
                <Text style={[styles.cardMeta, { color: hub.muted }]}>{job.meta}</Text>
              </View>
              <Tag tone={job.match === '92%' ? 'lime' : 'outline'}>{job.match}</Tag>
            </View>
            {job.missing ? (
              <View style={styles.tagRow}>
                <Tag>Node</Tag>
                <Tag>MongoDB</Tag>
                <Tag tone="outline">{job.missing}</Tag>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Text style={[styles.footnote, { color: hub.muted }]}>
        Jobs aggregate from multiple providers (jobs, jobs/applications). Not yet
        wired to the API.
      </Text>
    </>
  );
}

function ProjectsPanel() {
  const hub = useTheme('hub');
  return (
    <>
      <SectionLabel>Team posts</SectionLabel>
      <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.surface }]}>
        <Text style={[styles.fixTitle, { color: hub.text }]}>
          Looking for a frontend partner
        </Text>
        <Text style={[styles.fixDetail, { color: hub.muted }]}>
          React + Tailwind, 2 evenings a week, building a campus marketplace.
        </Text>
        <View style={styles.tagRow}>
          <Tag>React</Tag>
          <Tag>2 spots</Tag>
        </View>
      </View>
      <Text style={[styles.footnote, { color: hub.muted }]}>
        Sourced from projects and projects/teams. Not yet wired to the API.
      </Text>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/** 132dp ring, 12dp stroke, round caps — DESIGN_SPEC.md §5. */
function ScoreRing({
  value,
  label,
  track,
  fill,
  text,
  muted,
}: {
  value: number;
  label: string;
  track: string;
  fill: string;
  text: string;
  muted: string;
}) {
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2 - 3;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${clamped} out of 100`}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fill}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={[styles.ringValue, { color: text }]}>{clamped}</Text>
        <Text style={[styles.ringCaption, { color: muted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flexChild: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s8 },

  segmented: { flexDirection: 'row', gap: 3, borderRadius: 11, padding: 3 },
  segment: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11.5,
    letterSpacing: 0.2,
    paddingVertical: 9,
    borderRadius: 8,
    overflow: 'hidden',
  },

  card: {
    borderWidth: 1.5,
    borderRadius: radius.card,
    padding: space.s4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  alignTop: { alignItems: 'flex-start' },
  stack: { gap: space.s2 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: space.s4 },

  cardTitle: { fontFamily: fontFamily.heading, fontSize: 17, letterSpacing: -0.2 },
  cardMeta: { fontFamily: fontFamily.sans, fontSize: 13, marginTop: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },

  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { fontFamily: fontFamily.headingExtraBold, fontSize: 40, letterSpacing: -1.6 },
  ringCaption: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 5,
  },

  fixTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5, lineHeight: 21 },
  fixDetail: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 20, marginTop: 3 },
  pasteHint: { fontFamily: fontFamily.sans, fontSize: 14, flex: 1 },

  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.headingExtraBold, fontSize: 16 },
  jobTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 15, letterSpacing: -0.1 },

  footnote: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: space.s6,
  },
});
