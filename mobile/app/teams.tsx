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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Users,
  ArrowRight,
  Mail,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  X,
  MessageSquare,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import { Sheet } from '../src/components/primitives/Sheet';
import { OfflineBanner } from '../src/components/primitives/StateView';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  TeamPost,
  fetchTeamPosts,
  getCachedTeamPosts,
  setCachedTeamPosts,
} from '../src/api/projects';

export default function TeamsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string; eventTitle?: string }>();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  // Event filter context if navigated from Hackathons
  const [activeEventFilter, setActiveEventFilter] = useState<string | null>(params.eventId || null);
  const [activeEventTitle, setActiveEventTitle] = useState<string | null>(params.eventTitle || null);

  // Selected post for Contact Sheet
  const [selectedPost, setSelectedPost] = useState<TeamPost | null>(null);
  const [copied, setCopied] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadTeams = useCallback(
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

      // Check cache first
      if (user?.id) {
        const cached = await getCachedTeamPosts(user.id);
        if (cached && cached.length > 0 && !isManualRefresh) {
          setPosts(cached);
          setIsOfflineCache(true);
          setLoading(false);
        }
      }

      try {
        const remoteData = await fetchTeamPosts(controller.signal);
        setPosts(remoteData);
        setIsOfflineCache(false);
        if (user?.id) {
          await setCachedTeamPosts(user.id, remoteData);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        if (user?.id) {
          const cached = await getCachedTeamPosts(user.id);
          if (cached && cached.length > 0) {
            setPosts(cached);
            setIsOfflineCache(true);
            setError(null);
            return;
          }
        }
        setError(err.message || 'Unable to load team posts. Please check your network.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadTeams();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadTeams]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTeams(true);
  };

  const handleCreatePost = () => {
    router.push({
      pathname: '/team-post',
      params: {
        eventId: activeEventFilter || undefined,
        eventTitle: activeEventTitle || undefined,
      },
    } as any);
  };

  const handleCopyContact = async (contact: string) => {
    try {
      await Clipboard.setStringAsync(contact);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert('Copy Failed', contact);
    }
  };

  const handleDirectContact = async (contact: string) => {
    const trimmed = contact.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (isEmail) {
      const email = trimmed.replace(/^mailto:/i, '');
      await Linking.openURL(`mailto:${email}`);
      return;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      await Linking.openURL(trimmed);
      return;
    }
    // Otherwise copy to clipboard
    handleCopyContact(trimmed);
  };

  // Filter posts if activeEventFilter is selected
  const displayedPosts = posts.filter((post) => {
    if (!activeEventFilter) return true;
    const postEventId =
      typeof post.hackathonId === 'object' && post.hackathonId?._id
        ? post.hackathonId._id
        : String(post.hackathonId || '');
    return postEventId === activeEventFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Team finder" isRoot={false} />

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
          TEAM FINDER
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Good ideas{'\n'}need good people.
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
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            accessibilityLabel="Teams tab, active"
            style={[styles.segmentItem, { backgroundColor: hub.text }]}
          >
            <Text style={[styles.segmentText, { color: hub.bg, fontFamily: typography.fontBodyBold }]}>
              Teams
            </Text>
          </Pressable>
        </View>

        {/* Active Event Filter Banner */}
        {activeEventFilter && (
          <View style={[styles.filterBanner, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.filterBannerTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                Showing teams for event
              </Text>
              <Text numberOfLines={1} style={[styles.filterBannerSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
                {activeEventTitle || activeEventFilter}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setActiveEventFilter(null);
                setActiveEventTitle(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear event filter"
              hitSlop={8}
              style={styles.clearFilterButton}
            >
              <X size={18} color={hub.text} />
            </Pressable>
          </View>
        )}

        {/* Create Team Post Action Button */}
        <Pressable
          onPress={handleCreatePost}
          accessibilityRole="button"
          accessibilityLabel="Create a team post"
          style={({ pressed }) => [
            styles.createPostButton,
            {
              backgroundColor: hub.surface,
              borderColor: hub.line,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Plus size={18} color={hub.text} />
          <Text style={[styles.createPostLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
            Create a team post
          </Text>
        </Pressable>

        {/* Offline Banner */}
        {isOfflineCache && <OfflineBanner onRetry={() => loadTeams(true)} />}

        {/* Error State */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={() => loadTeams(true)}
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
              Finding open teams…
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && displayedPosts.length === 0 && !error && (
          <Card style={styles.emptyCard}>
            <Users size={36} color={hub.muted} />
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No team posts yet
            </Text>
            <Text style={[styles.emptyDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
              {activeEventFilter
                ? 'No team is currently seeking members for this event. Create the first team post!'
                : 'Looking to build together? Publish a post to find collaborators for your project or hackathon.'}
            </Text>
            <Button
              label="Create a team post"
              onPress={handleCreatePost}
              variant="primary"
              icon={<Plus size={16} color={hub.bg} />}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Team Cards List */}
        {!loading &&
          displayedPosts.map((post) => {
            const currentCount = post.currentMembers || 1;
            const maxCount = post.teamSize || 4;
            const skillsList = Array.isArray(post.lookingFor) ? post.lookingFor : [];
            const linkedEventTitle =
              typeof post.hackathonId === 'object' && post.hackathonId?.title
                ? post.hackathonId.title
                : typeof post.hackathonId === 'string' && post.hackathonId
                ? post.hackathonId
                : null;

            return (
              <Card key={post._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.membersTag, { borderColor: hub.line }]}>
                    <Text style={[styles.membersText, { color: hub.text, fontFamily: typography.fontMonoMedium }]}>
                      {currentCount} OF {maxCount} MEMBERS
                    </Text>
                  </View>
                  <Users size={18} color={hub.muted} />
                </View>

                {linkedEventTitle && (
                  <Text style={[styles.eventLabel, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                    {linkedEventTitle.toUpperCase()}
                  </Text>
                )}

                <Text style={[styles.postTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                  {post.title}
                </Text>

                <Text style={[styles.postDesc, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  {post.description}
                </Text>

                {skillsList.length > 0 && (
                  <View style={styles.skillsSection}>
                    <Text style={[styles.skillsHeader, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                      SKILLS NEEDED
                    </Text>
                    <View style={styles.skillsRow}>
                      {skillsList.map((skill) => (
                        <View key={skill} style={[styles.skillChip, { backgroundColor: hub.soft }]}>
                          <Text style={[styles.skillChipText, { color: hub.text, fontFamily: typography.fontBody }]}>
                            {skill}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* View contact details Action */}
                <Button
                  label="View contact details"
                  onPress={() => setSelectedPost(post)}
                  variant="primary"
                  icon={<ArrowRight size={16} color={hub.bg} />}
                  iconPosition="right"
                  style={styles.contactButton}
                />
              </Card>
            );
          })}
      </ScrollView>

      {/* Team Contact Sheet */}
      <Sheet
        visible={!!selectedPost}
        title="Team contact"
        onClose={() => {
          setSelectedPost(null);
          setCopied(false);
        }}
      >
        {selectedPost && (
          <View style={styles.sheetContent}>
            <Text style={[styles.sheetSubheading, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              {selectedPost.title}
            </Text>

            {typeof selectedPost.userId === 'object' && selectedPost.userId?.name && (
              <View style={styles.sheetInfoRow}>
                <Text style={[styles.sheetLabel, { color: hub.muted, fontFamily: typography.fontBodyBold }]}>
                  Posted by:
                </Text>
                <Text style={[styles.sheetValue, { color: hub.text, fontFamily: typography.fontBody }]}>
                  {selectedPost.userId.name}
                </Text>
              </View>
            )}

            <View style={[styles.contactCard, { backgroundColor: hub.soft, borderColor: hub.line }]}>
              <Text style={[styles.contactCardEyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                PROVIDED CONTACT METHOD
              </Text>
              <Text style={[styles.contactValue, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                {selectedPost.contactMethod}
              </Text>
            </View>

            <Text style={[styles.contactAdvice, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Career Pilot facilitates direct peer collaboration. Reach out directly using the provided handle or email to join this team.
            </Text>

            <View style={styles.sheetActions}>
              <Button
                label={copied ? 'Copied to clipboard!' : 'Copy contact info'}
                onPress={() => handleCopyContact(selectedPost.contactMethod)}
                variant="secondary"
                icon={copied ? <Check size={16} color={hub.text} /> : <Copy size={16} color={hub.text} />}
                style={{ flex: 1 }}
              />

              {((/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedPost.contactMethod.trim())) || selectedPost.contactMethod.startsWith('http')) && (
                <Button
                  label={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedPost.contactMethod.trim()) ? 'Send email' : 'Open link'}
                  onPress={() => handleDirectContact(selectedPost.contactMethod)}
                  variant="primary"
                  icon={
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedPost.contactMethod.trim()) ? (
                      <Mail size={16} color={hub.bg} />
                    ) : (
                      <ExternalLink size={16} color={hub.bg} />
                    )
                  }
                  style={{ flex: 1 }}
                />
              )}
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
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.base,
  },
  filterBannerTitle: {
    fontSize: typography.sizes.xs,
  },
  filterBannerSubtitle: {
    fontSize: typography.sizes.fine,
    marginTop: 2,
  },
  clearFilterButton: {
    padding: spacing.xs,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.chip,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  createPostLabel: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  membersTag: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  membersText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  eventLabel: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  postTitle: {
    fontSize: typography.sizes.heading,
    marginBottom: spacing.xs,
  },
  postDesc: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  skillsSection: {
    marginBottom: spacing.md,
  },
  skillsHeader: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  skillChipText: {
    fontSize: typography.sizes.fine,
  },
  contactButton: {
    marginTop: spacing.xs,
  },
  sheetContent: {
    gap: spacing.base,
  },
  sheetSubheading: {
    fontSize: typography.sizes.subheading,
  },
  sheetInfoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sheetLabel: {
    fontSize: typography.sizes.sm,
  },
  sheetValue: {
    fontSize: typography.sizes.sm,
  },
  contactCard: {
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
  },
  contactCardEyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
    marginBottom: spacing.xxs,
  },
  contactValue: {
    fontSize: typography.sizes.heading,
  },
  contactAdvice: {
    fontSize: typography.sizes.fine,
    lineHeight: 18,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
