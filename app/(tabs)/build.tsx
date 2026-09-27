import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { Tag } from '@/components/Tag';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';
import {
  APPLICATION_LABELS,
  analyzeAts,
  listApplications,
  listResumes,
  missingSkills,
  searchJobs,
  type Application,
  type Job,
  type Resume,
} from '@/api/build';

/**
 * Build — Resume, Projects, Jobs. Language B (hub).
 *
 * Matches design/png/06-build-resume.png and 07-build-jobs.png, on live data.
 *
 * The ATS score is the Resume panel's single focal number. Scoring runs an LLM
 * call server-side, so it is triggered only by an explicit tap — never on
 * mount — and the control says what it will do before you press it.
 */
type Segment = 'Resume' | 'Projects' | 'Jobs';
const SEGMENTS: Segment[] = ['Resume', 'Projects', 'Jobs'];

export default function BuildScreen() {
  const hub = useTheme('hub');
  const [segment, setSegment] = useState<Segment>('Resume');

  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scoring, setScoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [resumeResult, appsResult, jobsResult] = await Promise.allSettled([
      listResumes(),
      listApplications(),
      searchJobs(),
    ]);

    if (resumeResult.status === 'fulfilled') setResumes(resumeResult.value);
    else setResumes([]);

    if (appsResult.status === 'fulfilled') setApplications(appsResult.value);

    if (jobsResult.status === 'fulfilled') setJobs(jobsResult.value.jobs);
    else setJobs([]);

    // Only report a failure when nothing loaded — a partial screen beats an
    // error banner covering content that is actually there.
    if (
      resumeResult.status === 'rejected' &&
      appsResult.status === 'rejected' &&
      jobsResult.status === 'rejected'
    ) {
      setError(messageOf(resumeResult.reason));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Score a resume. Slow (LLM-backed) and therefore explicit. */
  const scoreResume = useCallback(async (resume: Resume) => {
    setScoring(resume._id);
    setError(null);
    try {
      const result = await analyzeAts({ resumeId: resume._id });
      setResumes(
        (prev) =>
          prev?.map((r) =>
            r._id === resume._id ? { ...r, atsAnalysis: { ...r.atsAnalysis, ...result } } : r,
          ) ?? null,
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setScoring(null);
    }
  }, []);

  return (
    <Screen padded={false}>
      <View style={styles.gutter}>
        <AppBar title="Build" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={hub.strong} />
        }
      >
        <Segmented value={segment} onChange={setSegment} />

        {error ? (
          <View style={[styles.errorBox, { borderColor: hub.danger }]}>
            <Text style={[styles.errorText, { color: hub.danger }]}>{error}</Text>
          </View>
        ) : null}

        {segment === 'Resume' ? (
          <ResumePanel resumes={resumes} scoring={scoring} onScore={scoreResume} />
        ) : null}
        {segment === 'Jobs' ? <JobsPanel jobs={jobs} applications={applications} /> : null}
        {segment === 'Projects' ? <ProjectsPanel /> : null}
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

function Segmented({ value, onChange }: { value: Segment; onChange: (next: Segment) => void }) {
  const hub = useTheme('hub');
  return (
    <View
      style={[styles.segmented, { backgroundColor: hub.soft }]}
      accessibilityRole="tablist"
      accessibilityLabel="Build section"
    >
      {SEGMENTS.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
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
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ResumePanel({
  resumes,
  scoring,
  onScore,
}: {
  resumes: Resume[] | null;
  scoring: string | null;
  onScore: (resume: Resume) => void;
}) {
  const hub = useTheme('hub');

  if (resumes === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={hub.strong} />
      </View>
    );
  }

  if (resumes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyTitle, { color: hub.text }]}>No resumes yet</Text>
        <Text style={[styles.emptyBody, { color: hub.muted }]}>
          Build a resume on the web, then score it here. The builder itself is not
          in the app yet.
        </Text>
      </View>
    );
  }

  // The active resume, else the most recently updated one.
  const primary = resumes.find((r) => r.isActive) ?? resumes[0]!;
  const ats = primary.atsAnalysis;

  return (
    <>
      <View
        style={[styles.card, styles.row, { borderColor: hub.line, backgroundColor: hub.surface }]}
      >
        {ats?.score != null ? (
          <ScoreRing
            value={ats.score}
            label={ats.tier ?? 'ATS score'}
            track={hub.soft}
            fill={hub.primary}
            text={hub.text}
            muted={hub.muted}
          />
        ) : (
          <View style={[styles.noScore, { backgroundColor: hub.soft }]}>
            <Text style={[styles.noScoreText, { color: hub.muted }]}>—</Text>
          </View>
        )}
        <View style={styles.flexChild}>
          <Text style={[styles.cardTitle, { color: hub.text }]} numberOfLines={2}>
            {primary.title}
          </Text>
          <Text style={[styles.cardMeta, { color: hub.muted }]}>
            {ats?.analyzedAt ? `Scored ${relativeTime(ats.analyzedAt)}` : 'Not scored yet'}
          </Text>
          {ats?.tier ? (
            <View style={styles.tagRow}>
              <Tag tone={ats.score >= 70 ? 'lime' : 'outline'}>{ats.tier}</Tag>
            </View>
          ) : null}
          <Pressable
            onPress={() => onScore(primary)}
            disabled={scoring !== null}
            accessibilityRole="button"
            accessibilityLabel={ats ? 'Re-score resume' : 'Score resume with ATS'}
            accessibilityState={{ busy: scoring === primary._id, disabled: scoring !== null }}
            style={[
              styles.scoreButton,
              { borderColor: hub.strong },
              scoring !== null ? styles.dim : null,
            ]}
          >
            {scoring === primary._id ? (
              <ActivityIndicator size="small" color={hub.text} />
            ) : (
              <Text style={[styles.scoreButtonText, { color: hub.text }]}>
                {ats ? 'Re-score' : 'Score with ATS'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {ats?.summary ? (
        <>
          <SectionLabel>Recruiter summary</SectionLabel>
          <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.surface }]}>
            <Text style={[styles.bodyText, { color: hub.text }]}>{ats.summary}</Text>
          </View>
        </>
      ) : null}

      {ats?.suggestions?.length ? (
        <>
          <SectionLabel>Fix these to score higher</SectionLabel>
          <View style={styles.stack}>
            {ats.suggestions.slice(0, 4).map((s, i) => (
              <View
                key={i}
                style={[
                  styles.card,
                  styles.row,
                  styles.alignTop,
                  { borderColor: hub.line, backgroundColor: hub.surface },
                ]}
              >
                <Tag tone={i === 0 ? 'danger' : 'outline'}>
                  {i === 0 ? 'HIGH' : i === 1 ? 'MED' : 'LOW'}
                </Tag>
                <Text style={[styles.bodyText, { color: hub.text, flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {ats?.strengths?.length ? (
        <>
          <SectionLabel>What is working</SectionLabel>
          <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.surface }]}>
            {ats.strengths.slice(0, 4).map((s, i) => (
              <Text key={i} style={[styles.bulletLine, { color: hub.text }]}>
                {'·  '}
                {s}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {resumes.length > 1 ? (
        <>
          <SectionLabel>Other resumes</SectionLabel>
          {resumes
            .filter((r) => r._id !== primary._id)
            .map((r) => (
              <View
                key={r._id}
                style={[
                  styles.card,
                  styles.row,
                  {
                    borderColor: hub.line,
                    backgroundColor: hub.surface,
                    marginBottom: space.s2,
                  },
                ]}
              >
                <View style={styles.flexChild}>
                  <Text style={[styles.rowTitle, { color: hub.text }]} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={[styles.cardMeta, { color: hub.muted }]}>
                    {r.atsAnalysis?.score != null ? `Score ${r.atsAnalysis.score}` : 'Not scored'}
                  </Text>
                </View>
              </View>
            ))}
        </>
      ) : null}
    </>
  );
}

function JobsPanel({ jobs, applications }: { jobs: Job[] | null; applications: Application[] }) {
  const hub = useTheme('hub');

  const counts = applications.reduce<Record<string, number>>((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {});

  if (jobs === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={hub.strong} />
      </View>
    );
  }

  return (
    <>
      {applications.length > 0 ? (
        <View style={styles.chipRow}>
          {(['applied', 'interview', 'offer'] as const)
            .filter((s) => counts[s])
            .map((s) => (
              <Tag key={s} tone={s === 'offer' ? 'lime' : 'outline'}>
                {APPLICATION_LABELS[s]} {counts[s]}
              </Tag>
            ))}
        </View>
      ) : null}

      <SectionLabel>Fresh matches</SectionLabel>

      {jobs.length === 0 ? (
        <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.surface }]}>
          <Text style={[styles.bodyText, { color: hub.muted }]}>
            No jobs returned. Listings are aggregated server-side from several
            providers and can be slow or rate-limited — pull to refresh.
          </Text>
        </View>
      ) : null}

      <View style={styles.stack}>
        {jobs.slice(0, 8).map((job, i) => {
          const gap = missingSkills(job);
          return (
            <View
              key={job._id ?? `${job.title}-${i}`}
              style={[styles.card, { borderColor: hub.line, backgroundColor: hub.surface }]}
            >
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: hub.soft }]}>
                  <Text style={[styles.avatarText, { color: hub.text }]}>
                    {job.company.trim()[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={styles.flexChild}>
                  <Text style={[styles.jobTitle, { color: hub.text }]} numberOfLines={2}>
                    {job.title}
                  </Text>
                  <Text style={[styles.cardMeta, { color: hub.muted }]} numberOfLines={1}>
                    {[job.company, job.location, job.remote ? 'Remote' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {job.matchScore != null ? (
                  <Tag tone={job.matchScore >= 85 ? 'lime' : 'outline'}>{job.matchScore}%</Tag>
                ) : null}
              </View>

              {gap.length ? (
                <View style={styles.tagRow}>
                  {(job.matchedSkills ?? []).slice(0, 2).map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                  <Tag tone="outline">Missing: {gap.join(', ')}</Tag>
                </View>
              ) : null}

              {job.applyUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(job.applyUrl!).catch(() => undefined)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open the posting for ${job.title}`}
                  style={[styles.applyButton, { backgroundColor: hub.strong }]}
                >
                  <Text style={[styles.applyText, { color: hub.bg }]}>Open posting</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {applications.length > 0 ? (
        <>
          <SectionLabel>Your applications</SectionLabel>
          <View
            style={[
              styles.card,
              { borderColor: hub.line, backgroundColor: hub.surface, paddingVertical: 0 },
            ]}
          >
            {applications.slice(0, 6).map((app, i, all) => (
              <View
                key={app._id}
                style={[
                  styles.appRow,
                  i < all.length - 1
                    ? { borderBottomWidth: 1.5, borderBottomColor: hub.line }
                    : null,
                ]}
              >
                <View style={styles.flexChild}>
                  <Text style={[styles.rowTitle, { color: hub.text }]} numberOfLines={1}>
                    {app.customJob?.title ?? 'Application'}
                  </Text>
                  {app.customJob?.company ? (
                    <Text style={[styles.cardMeta, { color: hub.muted }]}>
                      {app.customJob.company}
                    </Text>
                  ) : null}
                </View>
                <Tag tone={app.status === 'offer' ? 'lime' : 'outline'}>
                  {APPLICATION_LABELS[app.status]}
                </Tag>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function ProjectsPanel() {
  const hub = useTheme('hub');
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: hub.text }]}>Projects — not in the app yet</Text>
      <Text style={[styles.emptyBody, { color: hub.muted }]}>
        Project ideas and team posts come from projects and projects/teams. This
        panel is a placeholder until those are wired.
      </Text>
    </View>
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
  // The rubric clamps to 0-120, so the ring must not assume 0-100.
  const pct = Math.max(0, Math.min(100, value));

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityValue={{ min: 0, max: 120, now: value }}
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
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={[styles.ringValue, { color: text }]}>{value}</Text>
        <Text style={[styles.ringCaption, { color: muted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    return /network|fetch|timeout/i.test(err.message)
      ? 'Could not reach CareerPilot. Check your connection.'
      : err.message;
  }
  return 'Something went wrong.';
}

const styles = StyleSheet.create({
  flexChild: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s8 },

  segmented: { flexDirection: 'row', gap: 3, borderRadius: 11, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  segmentText: { fontSize: 11.5, letterSpacing: 0.2 },

  card: { borderWidth: 1.5, borderRadius: radius.card, padding: space.s4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  alignTop: { alignItems: 'flex-start' },
  stack: { gap: space.s2 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: space.s4 },

  cardTitle: { fontFamily: fontFamily.heading, fontSize: 17, letterSpacing: -0.2 },
  cardMeta: { fontFamily: fontFamily.sans, fontSize: 13, marginTop: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  bodyText: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21 },
  bulletLine: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 21, marginBottom: 4 },
  rowTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5 },
  jobTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 15, letterSpacing: -0.1 },

  noScore: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noScoreText: { fontFamily: fontFamily.headingExtraBold, fontSize: 34 },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ringValue: { fontFamily: fontFamily.headingExtraBold, fontSize: 40, letterSpacing: -1.6 },
  ringCaption: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 5,
  },

  scoreButton: {
    marginTop: 14,
    height: 42,
    borderWidth: 1.5,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreButtonText: { fontFamily: fontFamily.sansSemiBold, fontSize: 14 },
  dim: { opacity: 0.5 },

  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.headingExtraBold, fontSize: 16 },
  applyButton: {
    marginTop: 14,
    height: 40,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontFamily: fontFamily.sansSemiBold, fontSize: 14 },

  appRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: 13 },

  center: { alignItems: 'center', paddingVertical: space.s8, gap: 8 },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: 17, textAlign: 'center' },
  emptyBody: {
    fontFamily: fontFamily.sans,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 310,
  },
  errorBox: {
    borderWidth: 1.5,
    borderRadius: radius.chip,
    padding: space.s3,
    marginTop: space.s3,
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 19 },
});
