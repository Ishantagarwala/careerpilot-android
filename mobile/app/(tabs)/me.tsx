import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Settings, Timer } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { Sheet } from '../../src/components/primitives/Sheet';
import {
  ErrorStateView,
  LoadingStateView,
  OfflineBanner,
} from '../../src/components/primitives/StateView';
import {
  ActionRow,
  CircleIconButton,
  Eyebrow,
  NoticeBanner,
  Pill,
  ProductCard,
  RowDivider,
  Segmented,
  StatTile,
  TogglePill,
} from '../../src/components/product/ProductKit';
import { radii, spacing, targetSizes, typography } from '../../src/theme/tokens';
import {
  computeReadinessBreakdown,
  fetchHomeProgress,
  getCachedHomeProgress,
  HomeProgressData,
} from '../../src/api/progress';
import {
  ResumeAtsAnalysis,
  ResumeItem,
  fetchResumes,
  getAtsScoreMax,
  getCachedResumes,
} from '../../src/api/resume';
import {
  StudyDocument,
  fetchThreads,
  getCachedDocuments,
  getCachedThreads,
} from '../../src/api/study';
import { getStoredRefreshToken, getStoredToken } from '../../src/api/client';

/**
 * Me — account, appearance and study stats (design/png/08-me.png).
 *
 * Profile block, the three stat tiles, Appearance (theme + voice replies),
 * Account (profile, remembered sign-in, offline downloads) and the muted
 * security footnote, in the mockup's order.
 *
 * What used to be a dashboard on this tab now lives where the mockups put it:
 * the pinned career path, milestone progress and the week-by-week streak grid
 * are Career's job, so they are gone from here. The readiness breakdown was the
 * only place that composite score could be explained, so it keeps a row and its
 * sheet at the bottom, together with the focus-session and (for an account with
 * no career path yet) the interests assessment entry points — nothing that was
 * reachable from Me before has been dropped.
 */

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];

/** Device-local preference: read replies aloud. */
const VOICE_REPLIES_KEY = '@careerpilot_voice_replies';

/** Short, stable digest of the remembered session — the row's fingerprint. */
function fingerprintOf(token: string): string {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
}

/**
 * The client never sees the PDF bytes, so the honest size of an offline
 * download is the serialised size of the cached document records.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function pickBestScored(resumes: ResumeItem[]): ResumeAtsAnalysis | null {
  return resumes.reduce<ResumeAtsAnalysis | null>((best, item) => {
    if (!item.atsAnalysis) return best;
    if (!best || item.atsAnalysis.score > best.score) return item.atsAnalysis;
    return best;
  }, null);
}

export default function MeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub, mode, setThemeMode } = useTheme();
  const { user, isDemo } = useAuth();

  const [progressData, setProgressData] = useState<HomeProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReadinessSheet, setShowReadinessSheet] = useState(false);

  const [threadCount, setThreadCount] = useState<number | null>(null);
  const [atsAnalysis, setAtsAnalysis] = useState<ResumeAtsAnalysis | null>(null);
  const [documents, setDocuments] = useState<StudyDocument[] | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [voiceReplies, setVoiceReplies] = useState(false);

  const loadProgress = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      }

      let currentData = progressData;
      if (!currentData && !isRefresh) {
        const cached = await getCachedHomeProgress(user?.id);
        if (cached) {
          currentData = cached;
          setProgressData(cached);
          setIsLoading(false);
        }
      }

      try {
        const fresh = await fetchHomeProgress(user?.id);
        setProgressData(fresh);
        setError(null);
      } catch (err: any) {
        if (!currentData) {
          setError(err.message || 'Unable to load your learning journey.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user, progressData]
  );

  useEffect(() => {
    loadProgress();
  }, [user?.id]);

  /* Stats, the ATS tag, the offline downloads and the remembered session all
     read what the rest of the app already fetched — the device cache stands in
     when the connection is gone. */
  const loadSecondary = useCallback(async () => {
    const userId = user?.id;

    try {
      const threads = await fetchThreads();
      setThreadCount(Array.isArray(threads) ? threads.length : 0);
    } catch {
      const cached = userId ? await getCachedThreads(userId) : null;
      setThreadCount(cached ? cached.length : null);
    }

    try {
      const resumes = await fetchResumes();
      setAtsAnalysis(pickBestScored(resumes));
    } catch {
      const cached = userId ? await getCachedResumes(userId) : null;
      setAtsAnalysis(cached ? pickBestScored(cached) : null);
    }

    if (userId) {
      const cachedDocuments = await getCachedDocuments(userId);
      setDocuments(cachedDocuments);
    }

    try {
      const token = (await getStoredRefreshToken()) || (await getStoredToken());
      setFingerprint(token ? fingerprintOf(token) : null);
    } catch {
      setFingerprint(null);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSecondary();
  }, [loadSecondary]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(VOICE_REPLIES_KEY);
        if (stored === 'on') setVoiceReplies(true);
      } catch {
        // A missing preference simply means off.
      }
    })();
  }, []);

  const handleVoiceReplies = async (next: boolean) => {
    setVoiceReplies(next);
    try {
      await AsyncStorage.setItem(VOICE_REPLIES_KEY, next ? 'on' : 'off');
    } catch {
      // The switch still reflects the tap for this session.
    }
  };

  const handleRefresh = () => {
    loadProgress(true);
    loadSecondary();
  };

  if (isLoading && !progressData) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <MeHeader topInset={insets.top} />
        <LoadingStateView message="Loading your learning journey…" />
      </View>
    );
  }

  if (error && !progressData) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <MeHeader topInset={insets.top} />
        <ErrorStateView
          eyebrow="OVERVIEW UNAVAILABLE"
          title="Could not load your progress."
          message={error}
          onRetry={() => loadProgress(false)}
        />
      </View>
    );
  }

  const hasCareerPath = Boolean(
    progressData?.roadmap?.careerPath && progressData.roadmap.careerPath.trim().length > 0
  );

  const displayName = user?.name || 'Your account';
  const email = user?.email || 'Not signed in';
  const currentStageRaw = progressData?.roadmap?.currentStage || 'beginner';
  const stageName = currentStageRaw.charAt(0).toUpperCase() + currentStageRaw.slice(1);
  const totalMilestones = progressData?.roadmap?.totalMilestones || 0;
  const completedMilestones = progressData?.roadmap?.completedMilestones || 0;
  const milestoneCompletionRate = progressData?.roadmap?.milestoneCompletionRate || 0;
  const milestoneMeta =
    totalMilestones > 0
      ? stageName + ' · ' + completedMilestones + ' of ' + totalMilestones + ' milestones'
      : stageName + ' · Getting started';

  const readinessScore = progressData?.readinessScore ?? 0;
  const coursesCompleted = progressData?.metrics?.coursesCompleted || 0;
  const pdfsAnalyzed = progressData?.metrics?.pdfsAnalyzed || 0;
  const tutorSessions = progressData?.metrics?.tutorSessions || 0;
  const streakDays = progressData?.metrics?.streakDays || 0;

  const breakdown = progressData
    ? computeReadinessBreakdown(progressData)
    : {
        milestoneScore: 0,
        milestoneCompletionRate: 0,
        coursesScore: 0,
        pdfsScore: 0,
        tutorScore: 0,
        totalScore: 0,
      };

  const atsMax = getAtsScoreMax(atsAnalysis ?? undefined);
  const atsTag = atsAnalysis ? 'ATS ' + atsAnalysis.score + '/' + atsMax : null;

  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  const offlineLabel =
    documents && documents.length > 0
      ? documents.length +
        (documents.length === 1 ? ' document' : ' documents') +
        ' · ' +
        formatBytes(JSON.stringify(documents).length)
      : 'Nothing saved on this device yet';

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <MeHeader topInset={insets.top} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={hub.text}
            colors={[hub.text]}
          />
        }
      >
        {progressData?.isCached && (
          <OfflineBanner onRetry={handleRefresh} style={{ marginBottom: spacing.base }} />
        )}

        {/* Profile */}
        <Pressable
          onPress={() => router.push('/profile' as any)}
          accessibilityRole="button"
          accessibilityLabel={'Open your profile. ' + displayName + ', ' + email}
          style={({ pressed }) => [styles.profileRow, pressed ? { opacity: 0.75 } : null]}
        >
          <View style={[styles.avatar, { backgroundColor: hub.strong }]}>
            <Text
              style={[
                styles.avatarText,
                { color: hub.surface, fontFamily: typography.fontHeadingExtraBold },
              ]}
            >
              {initial}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text
              style={[
                styles.profileName,
                { color: hub.text, fontFamily: typography.fontHeading },
              ]}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.profileEmail, { color: hub.muted, fontFamily: typography.fontBody }]}
            >
              {email}
            </Text>
            <View style={styles.pillWrap}>
              {atsTag ? (
                <Pill label={atsTag} tone="lime" />
              ) : (
                <Pill label="No ATS score" tone="dashed" />
              )}
              <Pill label={isDemo ? 'Demo account' : 'Student account'} />
            </View>
          </View>
        </Pressable>

        {/* Stats */}
        <View style={styles.statRow}>
          <StatTile
            value={String(streakDays)}
            label="Day streak"
            accessibilityLabel={streakDays + ' day streak'}
            style={styles.statGap}
          />
          <StatTile
            value={threadCount === null ? '—' : String(threadCount)}
            label="Threads"
            accessibilityLabel={
              threadCount === null ? 'Threads unavailable' : threadCount + ' study threads'
            }
            style={styles.statGap}
          />
          <StatTile
            value={String(pdfsAnalyzed)}
            label="Docs"
            accessibilityLabel={pdfsAnalyzed + ' documents studied'}
          />
        </View>

        {/* Appearance */}
        <Eyebrow style={styles.sectionGap}>Appearance</Eyebrow>
        <ProductCard>
          <View style={styles.themeRow}>
            <Text
              style={[styles.rowTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}
            >
              Theme
            </Text>
            <Segmented
              options={THEME_OPTIONS}
              value={mode}
              onChange={(next) => {
                setThemeMode(next);
              }}
              accessibilityLabel="Appearance theme"
              style={styles.themeSegmented}
            />
          </View>
          <RowDivider style={styles.rowDivider} />
          <ActionRow
            title="Voice replies"
            subtitle="Read replies aloud on this device"
            trailing={
              <TogglePill
                value={voiceReplies}
                onChange={handleVoiceReplies}
                label="Voice replies"
                accessibilityLabel="Voice replies"
              />
            }
          />
        </ProductCard>

        {/* Account */}
        <Eyebrow style={styles.sectionGap}>Account</Eyebrow>
        <ProductCard>
          <ActionRow
            title="Edit profile"
            showChevron
            onPress={() => router.push('/profile' as any)}
            accessibilityLabel="Edit your profile"
          />
          <RowDivider />
          <ActionRow
            title="Remembered sign-in"
            subtitle={
              fingerprint
                ? 'Session remembered on this device'
                : 'No session stored on this device'
            }
            trailing={<Pill label={fingerprint ? 'FP ' + fingerprint : 'Fingerprint'} />}
            onPress={() => router.push('/settings' as any)}
            accessibilityLabel={
              fingerprint
                ? 'Remembered sign-in. Fingerprint ' + fingerprint + '. Open settings'
                : 'Remembered sign-in. No session stored. Open settings'
            }
          />
          <RowDivider />
          <ActionRow
            title="Offline downloads"
            subtitle={offlineLabel}
            showChevron
            onPress={() => router.push('/library' as any)}
            accessibilityLabel={'Offline downloads. ' + offlineLabel}
          />
        </ProductCard>

        {/* Progress — the dashboard this tab used to carry, kept reachable */}
        <Eyebrow style={styles.sectionGap}>Progress</Eyebrow>
        <ProductCard>
          <ActionRow
            title="Readiness indicator"
            subtitle={readinessScore + '/100 · ' + milestoneMeta}
            leading={<Compass size={targetSizes.iconSize} color={hub.text} />}
            showChevron
            onPress={() => setShowReadinessSheet(true)}
            accessibilityLabel={
              'Readiness indicator. ' + readinessScore + ' out of 100. How is this calculated'
            }
          />
          <RowDivider />
          <ActionRow
            title="Focus session"
            subtitle="Start a 25-minute study session"
            leading={<Timer size={targetSizes.iconSize} color={hub.text} />}
            showChevron
            onPress={() => router.push('/focus' as any)}
          />
          {!hasCareerPath && (
            <>
              <RowDivider />
              <ActionRow
                title="Find your path"
                subtitle="A short assessment picks your starting point"
                leading={<Compass size={targetSizes.iconSize} color={hub.text} />}
                showChevron
                onPress={() => router.push('/interests' as any)}
              />
            </>
          )}
        </ProductCard>

        {/* Security footnote */}
        <NoticeBanner style={styles.footnote}>
          Sign-in is restricted to residential IPs. Turn off VPN if login fails.
        </NoticeBanner>
      </ScrollView>

      {/* Dynamic Readiness Explanation Sheet */}
      <Sheet
        visible={showReadinessSheet}
        title="Readiness indicator"
        onClose={() => setShowReadinessSheet(false)}
      >
        <Text
          style={[
            styles.sheetParagraph,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          This activity indicator combines roadmap milestones, completed courses, PDFs studied and tutor activity. It is not a prediction of employment.
        </Text>

        <View
          style={[
            styles.sheetBreakdownCard,
            { backgroundColor: hub.surface, borderColor: hub.line },
          ]}
        >
          <Text
            style={[
              styles.sheetCardHeader,
              { color: hub.muted, fontFamily: typography.fontMonoMedium },
            ]}
          >
            CURRENT BREAKDOWN
          </Text>

          <View style={styles.sheetRow}>
            <View style={styles.sheetRowText}>
              <Text
                style={[
                  styles.sheetRowLabel,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                Roadmap milestones
              </Text>
              <Text
                style={[
                  styles.sheetRowMeta,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                {completedMilestones} of {totalMilestones} complete ({Math.round(milestoneCompletionRate)}%) · 40% weight
              </Text>
            </View>
            <Text
              style={[
                styles.sheetRowPoints,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              +{breakdown.milestoneScore}
            </Text>
          </View>

          <View style={[styles.sheetDivider, { backgroundColor: hub.line }]} />

          <View style={styles.sheetRow}>
            <View style={styles.sheetRowText}>
              <Text
                style={[
                  styles.sheetRowLabel,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                Courses complete
              </Text>
              <Text
                style={[
                  styles.sheetRowMeta,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                {coursesCompleted} courses (10 pts each, max 30) · 30% weight
              </Text>
            </View>
            <Text
              style={[
                styles.sheetRowPoints,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              +{breakdown.coursesScore}
            </Text>
          </View>

          <View style={[styles.sheetDivider, { backgroundColor: hub.line }]} />

          <View style={styles.sheetRow}>
            <View style={styles.sheetRowText}>
              <Text
                style={[
                  styles.sheetRowLabel,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                PDFs studied
              </Text>
              <Text
                style={[
                  styles.sheetRowMeta,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                {pdfsAnalyzed} PDFs (5 pts each, max 15) · 15% weight
              </Text>
            </View>
            <Text
              style={[
                styles.sheetRowPoints,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              +{breakdown.pdfsScore}
            </Text>
          </View>

          <View style={[styles.sheetDivider, { backgroundColor: hub.line }]} />

          <View style={styles.sheetRow}>
            <View style={styles.sheetRowText}>
              <Text
                style={[
                  styles.sheetRowLabel,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                AI tutor sessions
              </Text>
              <Text
                style={[
                  styles.sheetRowMeta,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                {tutorSessions} sessions (3 pts each, max 15) · 15% weight
              </Text>
            </View>
            <Text
              style={[
                styles.sheetRowPoints,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              +{breakdown.tutorScore}
            </Text>
          </View>

          <View style={[styles.sheetDivider, { backgroundColor: hub.line }]} />

          <View style={styles.sheetTotalRow}>
            <Text
              style={[
                styles.sheetTotalLabel,
                { color: hub.text, fontFamily: typography.fontHeadingMedium },
              ]}
            >
              Current readiness
            </Text>
            <Text
              style={[
                styles.sheetTotalValue,
                { color: hub.text, fontFamily: typography.fontMonoMedium },
              ]}
            >
              {breakdown.totalScore} / 100
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.sheetFine,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Formula weights: Milestones (40%), Courses (30%), PDFs studied (15%), AI tutor sessions (15%).
        </Text>
      </Sheet>
    </View>
  );
}

/** App bar: the mockup's large Anybody title plus the circular settings action. */
const MeHeader: React.FC<{ topInset: number }> = ({ topInset }) => {
  const router = useRouter();
  const { hub } = useTheme();

  return (
    <View style={[styles.header, { paddingTop: Math.max(topInset, spacing.sm) }]}>
      <View style={styles.appBar}>
        <Text
          style={[styles.screenTitle, { color: hub.text, fontFamily: typography.fontHeading }]}
        >
          Me
        </Text>
        <CircleIconButton
          onPress={() => router.push('/settings' as any)}
          accessibilityLabel="Open settings"
        >
          <Settings size={targetSizes.iconSize} color={hub.text} />
        </CircleIconButton>
      </View>
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
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: targetSizes.minTouch,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    lineHeight: 36,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  statGap: {
    marginBottom: 0,
  },
  sectionGap: {
    marginTop: spacing.xl,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    minHeight: targetSizes.minTouch,
    paddingVertical: spacing.xs,
  },
  themeSegmented: {
    flexGrow: 1,
    flexBasis: 190,
    maxWidth: 260,
  },
  rowDivider: {
    marginTop: spacing.xs,
  },
  rowTitle: {
    fontSize: typography.sizes.md,
    lineHeight: 21,
  },
  footnote: {
    marginTop: spacing.xl,
  },
  sheetParagraph: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
    marginBottom: spacing.base,
  },
  sheetBreakdownCard: {
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  sheetCardHeader: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  sheetRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  sheetRowLabel: {
    fontSize: typography.sizes.body,
  },
  sheetRowMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  sheetRowPoints: {
    fontSize: typography.sizes.body,
  },
  sheetDivider: {
    height: 1.5,
    marginVertical: spacing.xs,
  },
  sheetTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  sheetTotalLabel: {
    fontSize: typography.sizes.md,
  },
  sheetTotalValue: {
    fontSize: typography.sizes.md,
  },
  sheetFine: {
    fontSize: typography.sizes.fine,
    lineHeight: 18,
  },
});
