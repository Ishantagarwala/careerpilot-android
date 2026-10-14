import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Code, FileCheck, FileText, Plus, Search, Trophy, Users, X } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import {
  ErrorStateView,
  LoadingStateView,
  OfflineBanner,
} from '../../src/components/primitives/StateView';
import {
  ActionRow,
  CircleIconButton,
  Eyebrow,
  InitialSquare,
  MetricRing,
  Pill,
  ProductCard,
  RowDivider,
  Segmented,
  StatTile,
} from '../../src/components/product/ProductKit';
import { elevation, radii, spacing, targetSizes, typography } from '../../src/theme/tokens';
import {
  ResumeItem,
  fetchResumes,
  getAtsScoreMax,
  getCachedResumes,
  saveAtsDraft,
} from '../../src/api/resume';
import {
  ApplicationItem,
  JobListing,
  JobType,
  NormalizedApplication,
  fetchApplications,
  fetchJobs,
  getCachedApplications,
  getCachedJobs,
  normalizeApplication,
  saveJobToApplications,
} from '../../src/api/jobs';
import {
  Hackathon,
  ProjectIdea,
  TeamPost,
  fetchHackathons,
  fetchProjectIdeas,
  fetchTeamPosts,
  formatEventDateRange,
  getCachedHackathons,
  getCachedProjectIdeas,
  getCachedTeamPosts,
} from '../../src/api/projects';

/**
 * Build — the workshop tab (design/png/06-build-resume.png and 07-build-jobs.png).
 *
 * One route, three views. Resume · Projects · Jobs is a local segmented control,
 * exactly as the mockups draw it — the tab bar keeps its four entries and no
 * extra routes exist. The Resume view leads with the ATS metric ring and the
 * ranked fixes; the Jobs view leads with the application counters, fresh matches
 * with their match score and missing skills, and the application tracker.
 *
 * Every number on screen is read from the same endpoints the destination screens
 * call, with the device cache as the offline fallback. A view that could not load
 * says so instead of reporting an empty state, and every destination the old
 * landing screen offered (resume builder, ATS analyzer, projects, hackathons,
 * teams) is still one tap away.
 */

type BuildTab = 'resume' | 'projects' | 'jobs';

const BUILD_TABS: { value: BuildTab; label: string }[] = [
  { value: 'resume', label: 'Resume' },
  { value: 'projects', label: 'Projects' },
  { value: 'jobs', label: 'Jobs' },
];

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'internship', label: 'Internship' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
];

const JOB_TYPE_LABEL: Record<string, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
};

const APPLICATION_LABEL: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** How many fresh matches the Jobs view lists before deferring to /matches. */
const MATCH_LIMIT = 5;

interface Settled<T> {
  items: T[] | null;
  /** true when the live request failed and the view is reading the device cache */
  usedCache: boolean;
  /** true when the live request failed and there is no cache to fall back to */
  failed: boolean;
}

async function settle<T>(
  result: PromiseSettledResult<T[]>,
  readCache: () => Promise<T[] | null>
): Promise<Settled<T>> {
  if (result.status === 'fulfilled') {
    return { items: result.value, usedCache: false, failed: false };
  }
  const cached = await readCache();
  if (cached && cached.length > 0) {
    return { items: cached, usedCache: true, failed: false };
  }
  return { items: null, usedCache: false, failed: true };
}

/** "today" · "yesterday" · "6 days ago" — never a raw timestamp. */
function relativeDay(iso?: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return days + ' days ago';
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : months + ' months ago';
}

function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** First letter of a company name, for the bordered logo square. */
function initialOf(value?: string | null): string {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

/** "Zoho · Chennai · Full-time" — the mockups' company · location · meta line. */
function jobMeta(job: JobListing): string {
  return [job.company, job.location, JOB_TYPE_LABEL[job.type]]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(' · ');
}

function applicationMeta(app: NormalizedApplication): string {
  const when = relativeDay(app.appliedDate);
  if (app.status === 'saved') {
    return when ? 'Saved ' + when : app.company;
  }
  return when ? 'Applied ' + when : app.company;
}

function applicationTone(status: string): 'lime' | 'danger' | 'outline' {
  if (status === 'interview' || status === 'offer') return 'lime';
  if (status === 'rejected') return 'danger';
  return 'outline';
}

export default function BuildScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [tab, setTab] = useState<BuildTab>('resume');
  const [resumes, setResumes] = useState<Settled<ResumeItem> | null>(null);
  const [projects, setProjects] = useState<Settled<ProjectIdea> | null>(null);
  const [hackathons, setHackathons] = useState<Settled<Hackathon> | null>(null);
  const [teams, setTeams] = useState<Settled<TeamPost> | null>(null);
  const [jobs, setJobs] = useState<Settled<JobListing> | null>(null);
  const [applications, setApplications] = useState<Settled<ApplicationItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<JobType>('all');
  const [jobDescription, setJobDescription] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const userId = user?.id;
      const [
        resumeResult,
        projectResult,
        hackathonResult,
        teamResult,
        jobResult,
        applicationResult,
      ] = await Promise.allSettled([
        fetchResumes(),
        fetchProjectIdeas(),
        fetchHackathons(),
        fetchTeamPosts(),
        fetchJobs(),
        fetchApplications(),
      ]);

      const [
        nextResumes,
        nextProjects,
        nextHackathons,
        nextTeams,
        nextJobs,
        nextApplications,
      ] = await Promise.all([
        settle(resumeResult, () => (userId ? getCachedResumes(userId) : Promise.resolve(null))),
        settle(projectResult, () =>
          userId ? getCachedProjectIdeas(userId) : Promise.resolve(null)
        ),
        settle(hackathonResult, () =>
          userId ? getCachedHackathons(userId) : Promise.resolve(null)
        ),
        settle(teamResult, () => (userId ? getCachedTeamPosts(userId) : Promise.resolve(null))),
        settle(jobResult, () => (userId ? getCachedJobs(userId) : Promise.resolve(null))),
        settle(applicationResult, () =>
          userId ? getCachedApplications(userId) : Promise.resolve(null)
        ),
      ]);

      setResumes(nextResumes);
      setProjects(nextProjects);
      setHackathons(nextHackathons);
      setTeams(nextTeams);
      setJobs(nextJobs);
      setApplications(nextApplications);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [user?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = () => load();

  /* ------------------------------------------------------------ derived -- */

  const resumeItems = resumes?.items ?? null;
  const latestResumeUpdate = (resumeItems ?? []).reduce<string | null>(
    (latest, item) =>
      item.updatedAt &&
      (!latest || new Date(item.updatedAt).getTime() > new Date(latest).getTime())
        ? item.updatedAt
        : latest,
    null
  );
  const bestResume = (resumeItems ?? []).reduce<ResumeItem | null>(
    (best, item) =>
      item.atsAnalysis && (!best || item.atsAnalysis.score > best.atsAnalysis!.score)
        ? item
        : best,
    null
  );
  /** The resume the ring describes: the best-scored one, else the newest. */
  const ringResume =
    bestResume ??
    (resumeItems ?? [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ??
    null;

  const atsAnalysis = ringResume?.atsAnalysis;
  const atsMax = getAtsScoreMax(atsAnalysis);
  const atsScore = atsAnalysis?.score ?? 0;
  const atsPercent = atsAnalysis ? Math.round((atsScore / atsMax) * 100) : 0;
  const atsTag = atsAnalysis ? atsScore + '/' + atsMax : undefined;

  const suggestions = atsAnalysis?.suggestions ?? [];
  const deductions = atsAnalysis?.deductionItems ?? [];
  const strengths = atsAnalysis?.strengths ?? [];

  const updatedLabel = relativeDay(ringResume?.updatedAt ?? latestResumeUpdate);
  const resumeStatus = resumes?.failed
    ? 'Could not load your resumes'
    : resumeItems === null
    ? 'Loading…'
    : resumeItems.length === 0
    ? 'No resume yet · start your first one'
    : resumeItems.length +
      ' saved' +
      (updatedLabel ? ' · updated ' + updatedLabel : '');

  const resumeMeta = resumes?.failed
    ? 'Could not load your resumes'
    : resumeItems === null
    ? 'Loading…'
    : [
        updatedLabel ? 'Updated ' + updatedLabel : null,
        ringResume?.template ? titleCase(ringResume.template) + ' template' : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Not scored yet';

  const atsStatus = resumes?.failed
    ? 'Could not load your resumes'
    : atsTag
    ? 'Best score across your resumes'
    : 'No resume scored yet';

  const issueRows = [
    ...deductions.map((text) => ({ text, severity: 'HIGH' as const })),
    ...suggestions.map((text) => ({ text, severity: 'MED' as const })),
  ].slice(0, 4);

  const projectItems = projects?.items ?? null;
  const projectStatus = projects?.failed
    ? 'Could not load project ideas'
    : projectItems === null
    ? 'Loading…'
    : projectItems.length === 0
    ? 'No ideas generated yet'
    : projectItems.length + ' ' + (projectItems.length === 1 ? 'idea' : 'ideas') + ' ready';

  const hackathonItems = hackathons?.items ?? null;
  const openHackathons = (hackathonItems ?? [])
    .filter((h) => h.status !== 'completed')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const nextHackathon = openHackathons[0];
  const hackathonStatus = hackathons?.failed
    ? 'Could not load hackathons'
    : hackathonItems === null
    ? 'Loading…'
    : !nextHackathon
    ? 'No open hackathons right now'
    : nextHackathon.title +
      ' · ' +
      formatEventDateRange(nextHackathon.startDate, nextHackathon.endDate).dateString;

  const teamItems = teams?.items ?? null;
  const openTeams = (teamItems ?? []).filter((t) => t.status === 'open');
  const teamStatus = teams?.failed
    ? 'Could not load team posts'
    : teamItems === null
    ? 'Loading…'
    : openTeams.length === 0
    ? 'No open team posts'
    : openTeams.length + ' open team ' + (openTeams.length === 1 ? 'post' : 'posts');

  const applicationItems = applications?.items ?? null;
  const normalizedApplications = useMemo(
    () => (applicationItems ?? []).map(normalizeApplication),
    [applicationItems]
  );

  const applicationCounts = useMemo(() => {
    const counts = { applied: 0, interview: 0, offer: 0 };
    normalizedApplications.forEach((app) => {
      if (app.status === 'applied' || app.status === 'screening') counts.applied += 1;
      if (app.status === 'interview') counts.interview += 1;
      if (app.status === 'offer') counts.offer += 1;
    });
    return counts;
  }, [normalizedApplications]);

  /** Every job key already saved to applications, so Save can show its state. */
  const savedJobKeys = useMemo(() => {
    const keys = new Set<string>();
    (applicationItems ?? []).forEach((item) => {
      if (typeof item.jobId === 'string') keys.add(item.jobId);
      else if (item.jobId && typeof item.jobId === 'object') keys.add((item.jobId as JobListing)._id);
      if (item.externalJobKey) keys.add(item.externalJobKey);
    });
    return keys;
  }, [applicationItems]);

  const jobItems = jobs?.items ?? null;
  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (jobItems ?? []).filter((job) => {
      if (typeFilter !== 'all' && job.type !== typeFilter) return false;
      if (!needle) return true;
      return [job.title, job.company, job.location, ...(job.skills ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [jobItems, query, typeFilter]);

  const visibleMatches = filteredJobs.slice(0, MATCH_LIMIT);

  const isOffline = [resumes, projects, hackathons, teams, jobs, applications].some(
    (state) => state?.usedCache
  );

  const allFailed =
    !!resumes?.failed &&
    !!projects?.failed &&
    !!hackathons?.failed &&
    !!teams?.failed &&
    !!jobs?.failed;

  const countLabel = (state: Settled<unknown> | null): string => {
    if (!state) return '…';
    if (state.failed) return '—';
    return String(state.items?.length ?? 0);
  };

  /* ------------------------------------------------------------- actions -- */

  const openJob = (job: JobListing) => {
    router.push({ pathname: '/job', params: { id: job._id } } as any);
  };

  const handleSave = async (job: JobListing) => {
    if (!user?.id || savingId) return;
    setSavingId(job._id);
    try {
      await saveJobToApplications(job, 'saved');
      const refreshed = await fetchApplications();
      setApplications({ items: refreshed, usedCache: false, failed: false });
    } catch (err: any) {
      Alert.alert('Could not save', err?.message || 'Try again when the connection is ready.');
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Paste a JD, hit MATCH: the text is handed to the ATS analyzer as its draft
   * so the analyzer opens with the description already in place. Nothing is
   * scored here — the analyzer owns that flow.
   */
  const handleMatch = async () => {
    const description = jobDescription.trim();
    if (description && user?.id) {
      try {
        await saveAtsDraft(user.id, {
          mode: 'saved',
          resumeId: bestResume?._id,
          jobDescription: description,
        });
      } catch {
        // The draft is a convenience; the analyzer still opens without it.
      }
    }
    router.push('/ats' as any);
  };

  const handleHeaderAction = () => {
    if (tab === 'jobs') {
      setSearchOpen((open) => !open);
      return;
    }
    if (tab === 'resume') {
      router.push('/upload' as any);
      return;
    }
    router.push('/projects' as any);
  };

  const headerActionLabel =
    tab === 'jobs'
      ? searchOpen
        ? 'Close match search'
        : 'Search matches'
      : tab === 'resume'
      ? 'Add a resume'
      : 'Open project ideas';

  /* --------------------------------------------------------------- gates -- */

  if (isLoading && !resumes) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <BuildHeader
          topInset={insets.top}
          actionLabel={headerActionLabel}
          onAction={handleHeaderAction}
          tab="resume"
          onTabChange={setTab}
        />
        <LoadingStateView message="Loading your build workspace…" />
      </View>
    );
  }

  if (allFailed) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <BuildHeader
          topInset={insets.top}
          actionLabel={headerActionLabel}
          onAction={handleHeaderAction}
          tab={tab}
          onTabChange={setTab}
        />
        <ErrorStateView
          eyebrow="BUILD UNAVAILABLE"
          title="Could not load your workspace."
          message="Nothing has been changed. Try again when the connection is ready."
          onRetry={handleRetry}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <BuildHeader
        topInset={insets.top}
        actionLabel={headerActionLabel}
        onAction={handleHeaderAction}
        tab={tab}
        onTabChange={setTab}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={hub.text}
            colors={[hub.text]}
          />
        }
      >
        {isOffline && (
          <OfflineBanner onRetry={handleRetry} style={{ marginBottom: spacing.base }} />
        )}

        {tab === 'resume' && (
          <>
            <ProductCard
              onPress={() => router.push('/resumes' as any)}
              accessibilityLabel={'Resume builder. ' + resumeStatus}
            >
              <View style={styles.ringRow}>
                <MetricRing
                  value={atsPercent}
                  max={100}
                  caption="ATS score"
                  accessibilityLabel={
                    atsAnalysis
                      ? 'ATS score ' + atsScore + ' out of ' + atsMax + ', ' + atsPercent + ' percent'
                      : 'No ATS score yet'
                  }
                />
                <View style={styles.ringInfo}>
                  <Text
                    style={[
                      styles.cardHeadline,
                      { color: hub.text, fontFamily: typography.fontBodyBold },
                    ]}
                  >
                    {ringResume?.title ||
                      (resumes?.failed
                        ? 'Resumes unavailable'
                        : resumeItems === null
                        ? 'Loading…'
                        : 'No resume yet')}
                  </Text>
                  <Text
                    style={[
                      styles.cardMeta,
                      { color: hub.muted, fontFamily: typography.fontBody },
                    ]}
                  >
                    {resumeMeta}
                  </Text>
                  <View style={styles.pillWrap}>
                    {atsAnalysis && suggestions.length > 0 && (
                      <Pill
                        label={
                          suggestions.length +
                          (suggestions.length === 1 ? ' suggestion' : ' suggestions')
                        }
                      />
                    )}
                    {atsAnalysis && strengths.length > 0 && (
                      <Pill
                        label={
                          strengths.length + (strengths.length === 1 ? ' strength' : ' strengths')
                        }
                      />
                    )}
                    {atsAnalysis && suggestions.length === 0 && (
                      <Pill label="No open fixes" tone="lime" />
                    )}
                    {!atsAnalysis && resumeItems !== null && (
                      <Pill label="Not scored yet" tone="dashed" />
                    )}
                  </View>
                </View>
              </View>
            </ProductCard>

            <Eyebrow style={styles.sectionGap}>Fix these to score higher</Eyebrow>

            {issueRows.length === 0 ? (
              <ProductCard>
                <ActionRow
                  title={atsAnalysis ? 'Nothing flagged' : 'No analysis yet'}
                  subtitle={
                    atsAnalysis
                      ? 'This resume has no open deductions. Run a fresh check any time.'
                      : 'Score this resume in the ATS analyzer to get ranked fixes.'
                  }
                  trailing={
                    <Pill
                      label="Open ATS"
                      tone="dashed"
                      onPress={() => router.push('/ats' as any)}
                      accessibilityLabel="Open the ATS analyzer"
                    />
                  }
                />
              </ProductCard>
            ) : (
              issueRows.map((issue, index) => (
                <ProductCard key={issue.severity + '-' + index}>
                  <View style={styles.issueRow}>
                    <Pill label={issue.severity} tone={issue.severity === 'HIGH' ? 'danger' : 'quiet'} />
                    <View style={styles.issueText}>
                      <Text
                        style={[
                          styles.issueTitle,
                          { color: hub.text, fontFamily: typography.fontBodyBold },
                        ]}
                      >
                        {issue.text}
                      </Text>
                      {index === 0 && atsAnalysis?.summary ? (
                        <Text
                          style={[
                            styles.issueBody,
                            { color: hub.muted, fontFamily: typography.fontBody },
                          ]}
                        >
                          {atsAnalysis.summary}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </ProductCard>
              ))
            )}

            <Eyebrow style={styles.sectionGap}>Target a job description</Eyebrow>

            <ProductCard>
              <View style={styles.jdRow}>
                <TextInput
                  value={jobDescription}
                  onChangeText={setJobDescription}
                  placeholder="Paste a JD to match against…"
                  placeholderTextColor={hub.muted}
                  multiline={false}
                  accessibilityLabel="Job description to match against"
                  style={[
                    styles.jdInput,
                    { color: hub.text, fontFamily: typography.fontBody },
                  ]}
                />
                <Pill
                  label="Match"
                  tone="strong"
                  onPress={handleMatch}
                  accessibilityLabel="Match this resume against the pasted job description"
                  labelStyle={styles.matchLabel}
                  style={styles.matchPill}
                />
              </View>
            </ProductCard>

            <Eyebrow style={styles.sectionGap}>Resume tools</Eyebrow>

            <ProductCard>
              <ActionRow
                title="Resume builder"
                subtitle={resumeStatus}
                leading={<FileText size={targetSizes.iconSize} color={hub.text} />}
                showChevron
                onPress={() => router.push('/resumes' as any)}
              />
              <RowDivider />
              <ActionRow
                title="ATS analyzer"
                subtitle={atsStatus}
                leading={<FileCheck size={targetSizes.iconSize} color={hub.text} />}
                trailing={atsTag ? <Pill label={atsTag} tone="lime" /> : undefined}
                showChevron
                onPress={() => router.push('/ats' as any)}
              />
            </ProductCard>
          </>
        )}

        {tab === 'projects' && (
          <>
            <Eyebrow>In your workshop</Eyebrow>
            <View style={styles.statRow}>
              <StatTile
                value={countLabel(projects)}
                label="Ideas"
                accessibilityLabel={'Project ideas: ' + countLabel(projects)}
                style={styles.statGap}
              />
              <StatTile
                value={countLabel(hackathons)}
                label="Hackathons"
                accessibilityLabel={'Hackathons on file: ' + countLabel(hackathons)}
                style={styles.statGap}
              />
              <StatTile
                value={countLabel(teams)}
                label="Team posts"
                accessibilityLabel={'Team posts: ' + countLabel(teams)}
              />
            </View>

            <Eyebrow style={styles.sectionGap}>Projects & events</Eyebrow>

            <ProductCard>
              <ActionRow
                title="Project ideas"
                subtitle={projectStatus}
                leading={<Code size={targetSizes.iconSize} color={hub.text} />}
                showChevron
                onPress={() => router.push('/projects' as any)}
              />
              <RowDivider />
              <ActionRow
                title="Hackathons"
                subtitle={hackathonStatus}
                leading={<Trophy size={targetSizes.iconSize} color={hub.text} />}
                showChevron
                onPress={() => router.push('/hackathons' as any)}
              />
              <RowDivider />
              <ActionRow
                title="Team finder"
                subtitle={teamStatus}
                leading={<Users size={targetSizes.iconSize} color={hub.text} />}
                showChevron
                onPress={() => router.push('/teams' as any)}
              />
            </ProductCard>
          </>
        )}

        {tab === 'jobs' && (
          <>
            {searchOpen && (
              <>
                <ProductCard>
                  <View style={styles.searchRow}>
                    <Search size={18} color={hub.muted} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search matches…"
                      placeholderTextColor={hub.muted}
                      autoFocus
                      returnKeyType="search"
                      accessibilityLabel="Search matches by role, company or skill"
                      style={[
                        styles.searchInput,
                        { color: hub.text, fontFamily: typography.fontBody },
                      ]}
                    />
                    {query.length > 0 && (
                      <Pressable
                        onPress={() => setQuery('')}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      >
                        <X size={18} color={hub.muted} />
                      </Pressable>
                    )}
                  </View>
                </ProductCard>
                <View style={styles.chipRow}>
                  {JOB_TYPES.map((option) => (
                    <Pill
                      key={option.value}
                      label={option.label}
                      tone={typeFilter === option.value ? 'strong' : 'outline'}
                      onPress={() => setTypeFilter(option.value)}
                      accessibilityLabel={'Filter matches: ' + option.label}
                      style={styles.chipGap}
                    />
                  ))}
                </View>
              </>
            )}

            <View style={styles.counterRow}>
              <Pill
                label={'Applied ' + applicationCounts.applied}
                tone="strong"
                accessibilityLabel={applicationCounts.applied + ' applications in progress'}
                style={styles.chipGap}
              />
              <Pill
                label={'Interview ' + applicationCounts.interview}
                accessibilityLabel={applicationCounts.interview + ' interviews'}
                style={styles.chipGap}
              />
              <Pill
                label={'Offer ' + applicationCounts.offer}
                accessibilityLabel={applicationCounts.offer + ' offers'}
              />
            </View>

            <Eyebrow style={styles.sectionGap}>Fresh matches</Eyebrow>

            {jobs?.failed && (
              <ProductCard>
                <ActionRow
                  title="Could not load matches"
                  subtitle="Your saved applications are still below."
                  trailing={
                    <Pill
                      label="Retry"
                      tone="dashed"
                      onPress={handleRetry}
                      accessibilityLabel="Retry loading matches"
                    />
                  }
                />
              </ProductCard>
            )}

            {jobs && visibleMatches.length === 0 && (
              <ProductCard>
                <ActionRow
                  title={query.trim() ? 'No matches for “' + query.trim() + '”' : 'No matches yet'}
                  subtitle={
                    query.trim()
                      ? 'Try a shorter search, or clear the filters.'
                      : 'Matches appear once your career path and skills are set.'
                  }
                  trailing={
                    query.trim() || typeFilter !== 'all' ? (
                      <Pill
                        label="Clear"
                        tone="dashed"
                        onPress={() => {
                          setQuery('');
                          setTypeFilter('all');
                        }}
                        accessibilityLabel="Clear search and filters"
                      />
                    ) : undefined
                  }
                />
              </ProductCard>
            )}

            {visibleMatches.map((job, index) => {
              const score = typeof job.matchScore === 'number' ? Math.round(job.matchScore) : null;
              const matched = job.matchedSkills ?? [];
              const missing = (job.skills ?? []).filter((skill) => !matched.includes(skill));
              const saved = savedJobKeys.has(job._id);

              if (index > 0) {
                return (
                  <ProductCard
                    key={job._id}
                    onPress={() => openJob(job)}
                    accessibilityLabel={
                      job.title + ' at ' + job.company + (score !== null ? ', ' + score + '% match' : '')
                    }
                  >
                    <View style={styles.matchHead}>
                      <InitialSquare label={initialOf(job.company)} />
                      <View style={styles.matchText}>
                        <Text
                          style={[
                            styles.matchTitle,
                            { color: hub.text, fontFamily: typography.fontBodyBold },
                          ]}
                        >
                          {job.title}
                        </Text>
                        <Text
                          style={[
                            styles.matchMeta,
                            { color: hub.muted, fontFamily: typography.fontBody },
                          ]}
                        >
                          {jobMeta(job)}
                        </Text>
                      </View>
                      {score !== null && <Pill label={score + '%'} />}
                    </View>
                  </ProductCard>
                );
              }

              return (
                <ProductCard key={job._id}>
                  <View style={styles.matchHead}>
                    <InitialSquare label={initialOf(job.company)} />
                    <View style={styles.matchText}>
                      <Text
                        style={[
                          styles.matchTitle,
                          { color: hub.text, fontFamily: typography.fontBodyBold },
                        ]}
                      >
                        {job.title}
                      </Text>
                      <Text
                        style={[
                          styles.matchMeta,
                          { color: hub.muted, fontFamily: typography.fontBody },
                        ]}
                      >
                        {jobMeta(job)}
                      </Text>
                    </View>
                    {score !== null && (
                      <Pill label={score + '%'} tone={score >= 90 ? 'lime' : 'outline'} />
                    )}
                  </View>

                  {(matched.length > 0 || missing.length > 0) && (
                    <View style={styles.chipRow}>
                      {matched.slice(0, 3).map((skill) => (
                        <Pill key={skill} label={skill} style={styles.chipGap} />
                      ))}
                      {missing.slice(0, 2).map((skill) => (
                        <Pill
                          key={skill}
                          label={'Missing: ' + skill}
                          tone="dashed"
                          style={styles.chipGap}
                        />
                      ))}
                    </View>
                  )}

                  <View style={styles.matchActions}>
                    <Pressable
                      onPress={() => openJob(job)}
                      accessibilityRole="button"
                      accessibilityLabel={'Apply to ' + job.title + ' at ' + job.company}
                      style={({ pressed }) => [
                        styles.applyButton,
                        {
                          backgroundColor: hub.strong,
                          borderColor: hub.strong,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.applyLabel,
                          { color: hub.surface, fontFamily: typography.fontHeading },
                        ]}
                      >
                        Apply
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleSave(job)}
                      disabled={saved || savingId === job._id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        saved ? job.title + ' is saved to applications' : 'Save ' + job.title
                      }
                      accessibilityState={{ disabled: saved || savingId === job._id }}
                      style={({ pressed }) => [
                        styles.saveButton,
                        {
                          backgroundColor: hub.surface,
                          borderColor: hub.line,
                          opacity: saved ? 0.5 : pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.applyLabel,
                          { color: hub.text, fontFamily: typography.fontHeading },
                        ]}
                      >
                        {saved ? 'Saved' : savingId === job._id ? 'Saving…' : 'Save'}
                      </Text>
                    </Pressable>
                  </View>
                </ProductCard>
              );
            })}

            {filteredJobs.length > visibleMatches.length && (
              <Pressable
                onPress={() => router.push('/matches' as any)}
                accessibilityRole="button"
                accessibilityLabel={'See all ' + filteredJobs.length + ' matches'}
                style={({ pressed }) => [
                  styles.ghostButton,
                  { borderColor: hub.line, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.ghostLabel,
                    { color: hub.text, fontFamily: typography.fontHeading },
                  ]}
                >
                  See all {filteredJobs.length} matches
                </Text>
              </Pressable>
            )}

            <Eyebrow style={styles.sectionGap}>Your applications</Eyebrow>

            <ProductCard>
              {applications?.failed && (
                <ActionRow
                  title="Could not load applications"
                  subtitle="Nothing has been changed."
                  trailing={
                    <Pill
                      label="Retry"
                      tone="dashed"
                      onPress={handleRetry}
                      accessibilityLabel="Retry loading applications"
                    />
                  }
                />
              )}

              {!applications?.failed && normalizedApplications.length === 0 && (
                <ActionRow
                  title={applications === null ? 'Loading…' : 'No applications yet'}
                  subtitle="Save a match to start tracking it here."
                  trailing={
                    <Pill
                      label="Tracker"
                      tone="dashed"
                      onPress={() => router.push('/tracker' as any)}
                      accessibilityLabel="Open the application tracker"
                    />
                  }
                />
              )}

              {!applications?.failed &&
                normalizedApplications.slice(0, 6).map((application, index) => (
                  <React.Fragment key={application._id}>
                    {index > 0 && <RowDivider />}
                    <ActionRow
                      title={application.title}
                      subtitle={applicationMeta(application)}
                      leading={<InitialSquare label={initialOf(application.company)} />}
                      trailing={
                        <Pill
                          label={APPLICATION_LABEL[application.status] || application.status}
                          tone={applicationTone(application.status)}
                        />
                      }
                      onPress={() => router.push('/tracker' as any)}
                      accessibilityLabel={
                        application.title +
                        ' at ' +
                        application.company +
                        '. ' +
                        (APPLICATION_LABEL[application.status] || application.status)
                      }
                    />
                  </React.Fragment>
                ))}
            </ProductCard>

            {normalizedApplications.length > 6 && (
              <Pressable
                onPress={() => router.push('/tracker' as any)}
                accessibilityRole="button"
                accessibilityLabel={
                  'See all ' + normalizedApplications.length + ' applications in the tracker'
                }
                style={({ pressed }) => [
                  styles.ghostButton,
                  { borderColor: hub.line, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.ghostLabel,
                    { color: hub.text, fontFamily: typography.fontHeading },
                  ]}
                >
                  See all {normalizedApplications.length} applications
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      {tab === 'resume' && (
        <Pressable
          onPress={() => router.push('/upload' as any)}
          accessibilityRole="button"
          accessibilityLabel="Add a resume"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: hub.strong, opacity: pressed ? 0.85 : 1 },
            elevation.hubFab,
          ]}
        >
          <Plus size={26} color={hub.surface} />
        </Pressable>
      )}
    </View>
  );
}

/** App bar + the Resume · Projects · Jobs segmented control, fixed above the scroll. */
const BuildHeader: React.FC<{
  topInset: number;
  tab: BuildTab;
  onTabChange: (next: BuildTab) => void;
  actionLabel: string;
  onAction: () => void;
}> = ({ topInset, tab, onTabChange, actionLabel, onAction }) => {
  const { hub } = useTheme();

  return (
    <View style={[styles.header, { paddingTop: Math.max(topInset, spacing.sm) }]}>
      <View style={styles.appBar}>
        <Text
          style={[styles.screenTitle, { color: hub.text, fontFamily: typography.fontHeading }]}
        >
          Build
        </Text>
        <CircleIconButton onPress={onAction} accessibilityLabel={actionLabel}>
          {tab === 'jobs' ? (
            <Search size={targetSizes.iconSize} color={hub.text} />
          ) : (
            <Plus size={targetSizes.iconSize} color={hub.text} />
          )}
        </CircleIconButton>
      </View>
      <Segmented
        options={BUILD_TABS}
        value={tab}
        onChange={onTabChange}
        accessibilityLabel="Build sections"
        style={styles.segmented}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  screenTitle: {
    flexShrink: 1,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  segmented: {
    marginTop: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  sectionGap: {
    marginTop: spacing.lg,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    flexWrap: 'wrap',
  },
  ringInfo: {
    flex: 1,
    minWidth: 180,
  },
  cardHeadline: {
    fontSize: 17,
    lineHeight: 22,
  },
  cardMeta: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    marginTop: 3,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  issueText: {
    flex: 1,
    minWidth: 0,
  },
  issueTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  issueBody: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    marginTop: 4,
  },
  jdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  jdInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  matchPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  matchLabel: {
    fontSize: typography.sizes.xs,
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  statGap: {
    marginBottom: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  chipGap: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  matchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  matchText: {
    flex: 1,
    minWidth: 0,
  },
  matchTitle: {
    fontSize: 16,
    lineHeight: 21,
  },
  matchMeta: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  matchActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    marginTop: spacing.base,
  },
  applyButton: {
    flex: 1,
    minHeight: targetSizes.minTouch,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  saveButton: {
    minHeight: targetSizes.minTouch,
    minWidth: 96,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  applyLabel: {
    fontSize: 16.5,
    letterSpacing: -0.2,
  },
  ghostButton: {
    minHeight: targetSizes.minTouch,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginBottom: spacing.base,
  },
  ghostLabel: {
    fontSize: 16,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
