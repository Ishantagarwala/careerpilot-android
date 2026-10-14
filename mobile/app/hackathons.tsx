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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, Calendar, Users, RotateCw, Trophy } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import { OfflineBanner } from '../src/components/primitives/StateView';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  Hackathon,
  fetchHackathons,
  getCachedHackathons,
  setCachedHackathons,
  formatEventDateRange,
} from '../src/api/projects';

export default function HackathonsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHackathons = useCallback(
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

      // Check cache first for instant presentation
      if (user?.id) {
        const cached = await getCachedHackathons(user.id);
        if (cached && cached.length > 0 && !isManualRefresh) {
          setHackathons(cached);
          setIsOfflineCache(true);
          setLoading(false);
        }
      }

      try {
        const remoteData = await fetchHackathons(controller.signal);
        setHackathons(remoteData);
        setIsOfflineCache(false);
        if (user?.id) {
          await setCachedHackathons(user.id, remoteData);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        // Fall back to offline cache
        if (user?.id) {
          const cached = await getCachedHackathons(user.id);
          if (cached && cached.length > 0) {
            setHackathons(cached);
            setIsOfflineCache(true);
            setError(null);
            return;
          }
        }
        setError(err.message || 'Unable to connect to hackathon providers. Please check your network.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadHackathons();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadHackathons]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadHackathons(true);
  };

  const handleOpenEventUrl = async (url?: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      Alert.alert('Link Unavailable', 'No direct URL was provided by the event organizer.');
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
      Alert.alert('Error', 'An error occurred while opening the event website.');
    }
  };

  const handleFindTeammates = (event: Hackathon) => {
    router.push({
      pathname: '/teams',
      params: {
        eventId: event._id,
        eventTitle: event.title,
      },
    } as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Hackathons" isRoot={false} />

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
          CREATE WITH OTHERS
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          A place to test{'\n'}your ideas.
        </Text>

        {/* Segmented Navigation: Ideas | Hackathons | Teams */}
        <View style={[styles.segmentsContainer, { backgroundColor: hub.surface, borderColor: hub.line }]}>
          <Pressable
            onPress={() => router.replace('/projects' as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            accessibilityLabel="Ideas tab"
            style={styles.segmentItem}
          >
            <Text style={[styles.segmentText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Ideas
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            accessibilityLabel="Hackathons tab, active"
            style={[styles.segmentItem, { backgroundColor: hub.text }]}
          >
            <Text style={[styles.segmentText, { color: hub.bg, fontFamily: typography.fontBodyBold }]}>
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

        {/* Offline Banner */}
        {isOfflineCache && <OfflineBanner onRetry={() => loadHackathons(true)} />}

        {/* Error State */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={() => loadHackathons(true)}
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
              Finding hackathons and events…
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && hackathons.length === 0 && !error && (
          <Card style={styles.emptyCard}>
            <Trophy size={36} color={hub.muted} />
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No hackathons found
            </Text>
            <Text style={[styles.emptyDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
              No events are currently scheduled from available sources. Pull down to refresh or check back soon.
            </Text>
            <Button
              label="Refresh events"
              onPress={() => loadHackathons(true)}
              variant="secondary"
              icon={<RotateCw size={16} color={hub.text} />}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Hackathon Cards List */}
        {!loading &&
          hackathons.map((item) => {
            const modeLabel = (item.mode || 'ONLINE').toUpperCase();
            const sourceLabel = (item.platform || item.organizer || 'EVENT').toUpperCase();
            const { dateString, isExpired, isOngoing } = formatEventDateRange(
              item.startDate,
              item.endDate
            );

            let statusSubtitle = 'Check the source before registering';
            if (isExpired) {
              statusSubtitle = 'Event has concluded';
            } else if (isOngoing) {
              statusSubtitle = 'Currently ongoing';
            }

            const themesList = Array.isArray(item.themes) ? item.themes : [];

            return (
              <Card key={item._id} style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={[styles.modeTag, { borderColor: hub.line }]}>
                    <Text style={[styles.modeTagText, { color: hub.text, fontFamily: typography.fontMonoMedium }]}>
                      {modeLabel}
                    </Text>
                  </View>
                  <Text style={[styles.sourceText, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                    {sourceLabel}
                  </Text>
                </View>

                <Text style={[styles.title, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                  {item.title}
                </Text>

                <Text style={[styles.desc, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  {item.description}
                </Text>

                {/* Date & Time Row */}
                <View style={[styles.calendarRow, { borderTopColor: hub.line, borderBottomColor: hub.line }]}>
                  <Calendar size={18} color={isExpired ? hub.muted : hub.text} style={{ marginTop: 2 }} />
                  <View style={styles.dateTextContainer}>
                    <Text
                      style={[
                        styles.dateTitle,
                        {
                          color: isExpired ? hub.muted : hub.text,
                          fontFamily: typography.fontBodyBold,
                        },
                      ]}
                    >
                      {dateString}
                    </Text>
                    <Text
                      style={[
                        styles.dateSubtitle,
                        {
                          color: isExpired ? hub.danger : hub.muted,
                          fontFamily: typography.fontBody,
                        },
                      ]}
                    >
                      {statusSubtitle}
                    </Text>
                  </View>
                </View>

                {/* Themes / Tech Pills */}
                {themesList.length > 0 && (
                  <View style={styles.themesRow}>
                    {themesList.map((theme) => (
                      <View key={theme} style={[styles.themeChip, { backgroundColor: hub.soft }]}>
                        <Text style={[styles.themeChipText, { color: hub.text, fontFamily: typography.fontBody }]}>
                          {theme}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Primary: Visit event button */}
                <Button
                  label="Visit event"
                  onPress={() => handleOpenEventUrl(item.url)}
                  variant="primary"
                  icon={<ExternalLink size={16} color={hub.bg} />}
                  iconPosition="right"
                  style={styles.visitButton}
                />

                {/* Secondary: Find teammates button */}
                <Button
                  label="Find teammates"
                  onPress={() => handleFindTeammates(item)}
                  variant="secondary"
                  icon={<Users size={16} color={hub.text} />}
                  iconPosition="left"
                  style={styles.findButton}
                />
              </Card>
            );
          })}
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
  segmentsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.chip,
    padding: 2,
    marginBottom: spacing.lg,
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
  card: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modeTag: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  modeTagText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  sourceText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: typography.sizes.heading,
    marginBottom: spacing.xs,
  },
  desc: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateTitle: {
    fontSize: typography.sizes.body,
    marginBottom: 2,
  },
  dateSubtitle: {
    fontSize: typography.sizes.fine,
  },
  themesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  themeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  themeChipText: {
    fontSize: typography.sizes.fine,
  },
  visitButton: {
    marginBottom: spacing.sm,
  },
  findButton: {
    marginTop: 0,
  },
});
