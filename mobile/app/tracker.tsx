import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  ArrowRight,
  ExternalLink,
  WifiOff,
  AlertCircle,
  MoreHorizontal,
  RotateCw,
  Briefcase,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { Sheet } from '../src/components/primitives/Sheet';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import {
  ApplicationItem,
  ApplicationStatus,
  NormalizedApplication,
  normalizeApplication,
  fetchApplications,
  getCachedApplications,
  setCachedApplications,
  updateApplicationStatus,
} from '../src/api/jobs';

const ALL_STATUSES: { label: string; value: ApplicationStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Saved', value: 'saved' },
  { label: 'Applied', value: 'applied' },
  { label: 'Screening', value: 'screening' },
  { label: 'Interview', value: 'interview' },
  { label: 'Offer', value: 'offer' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

const EDITABLE_STATUSES: { label: string; value: ApplicationStatus }[] = [
  { label: 'Saved', value: 'saved' },
  { label: 'Applied', value: 'applied' },
  { label: 'Screening', value: 'screening' },
  { label: 'Interview', value: 'interview' },
  { label: 'Offer', value: 'offer' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

export default function TrackerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [applications, setApplications] = useState<NormalizedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Filter
  const [selectedFilter, setSelectedFilter] = useState<ApplicationStatus | 'all'>('all');

  // Sheet State
  const [activeSheetItem, setActiveSheetItem] = useState<NormalizedApplication | null>(null);
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus>('saved');
  const [targetNotes, setTargetNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const loadData = useCallback(
    async (isManual = false) => {
      if (!isManual) setLoading(true);
      setError(null);

      try {
        const rawApps = await fetchApplications();
        const normalized = rawApps.map(normalizeApplication);
        setApplications(normalized);
        setIsOffline(false);
        if (user?.id) {
          await setCachedApplications(user.id, rawApps);
        }
      } catch (err: any) {
        if (user?.id) {
          const cached = await getCachedApplications(user.id);
          if (cached && cached.length > 0) {
            setApplications(cached.map(normalizeApplication));
            setIsOffline(true);
            setError(null);
            return;
          }
        }
        setError(err.message || 'Unable to load applications');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleOpenSheet = (item: NormalizedApplication) => {
    setActiveSheetItem(item);
    setTargetStatus(item.status);
    setTargetNotes(item.notes);
    setSheetError(null);
  };

  const handleCloseSheet = () => {
    if (isUpdating) return;
    setActiveSheetItem(null);
    setSheetError(null);
  };

  const handleSaveStatus = async () => {
    if (!activeSheetItem) return;
    setIsUpdating(true);
    setSheetError(null);

    const prevApps = [...applications];
    const updatedId = activeSheetItem._id;
    const newStatus = targetStatus;
    const newNotes = targetNotes.trim();

    // Optimistic UI update
    setApplications((prev) =>
      prev.map((app) =>
        app._id === updatedId
          ? { ...app, status: newStatus, notes: newNotes }
          : app
      )
    );

    try {
      await updateApplicationStatus(updatedId, newStatus, newNotes);
      // Persist to offline cache
      if (user?.id) {
        const rawList = applications.map((a) =>
          a._id === updatedId
            ? { ...a.raw, status: newStatus, notes: newNotes }
            : a.raw
        );
        await setCachedApplications(user.id, rawList);
      }
      setActiveSheetItem(null);
    } catch (err: any) {
      // Rollback on failure
      setApplications(prevApps);
      setSheetError(err.message || 'Failed to update application status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenExternal = (url: string) => {
    if (!url) return;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      Linking.openURL(trimmed).catch(() => {
        Alert.alert('Error', 'Unable to open application link.');
      });
    }
  };

  const filteredApps =
    selectedFilter === 'all'
      ? applications
      : applications.filter((app) => app.status === selectedFilter);

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Applications" isRoot={false} />

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
        <Text
          style={[
            styles.eyebrow,
            { color: hub.muted, fontFamily: typography.fontMonoMedium },
          ]}
        >
          APPLICATION TRACKER
        </Text>

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          Keep your next{'\n'}steps in view.
        </Text>

        <Button
          label="Add an opportunity"
          onPress={() => router.push('/custom-job' as any)}
          variant="secondary"
          icon={<Plus size={18} color={hub.text} />}
          iconPosition="left"
          style={styles.addButton}
        />

        {/* Offline Banner */}
        {isOffline && (
          <View
            style={[
              styles.offlineBanner,
              { backgroundColor: hub.soft, borderColor: hub.line },
            ]}
          >
            <WifiOff size={16} color={hub.text} />
            <Text
              style={[
                styles.offlineText,
                { color: hub.text, fontFamily: typography.fontBody },
              ]}
            >
              Offline — displaying locally cached applications
            </Text>
          </View>
        )}

        {/* Status Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {ALL_STATUSES.map((item) => {
            const isSelected = selectedFilter === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setSelectedFilter(item.value)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${item.label}`}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? hub.text : hub.surface,
                    borderColor: isSelected ? hub.text : hub.line,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isSelected ? hub.bg : hub.text,
                      fontFamily: isSelected
                        ? typography.fontBodyBold
                        : typography.fontBody,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={hub.text} />
            <Text
              style={[
                styles.loadingText,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Loading your tracker…
            </Text>
          </View>
        )}

        {/* Error State */}
        {!loading && error && (
          <Card style={styles.errorCard}>
            <AlertCircle size={28} color={hub.text} />
            <Text
              style={[
                styles.errorTitle,
                { color: hub.text, fontFamily: typography.fontHeadingMedium },
              ]}
            >
              Unable to load applications
            </Text>
            <Text
              style={[
                styles.errorDesc,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={() => loadData()}
              variant="secondary"
              icon={<RotateCw size={16} color={hub.text} />}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && filteredApps.length === 0 && (
          <Card style={styles.emptyCard}>
            <Briefcase size={32} color={hub.muted} />
            <Text
              style={[
                styles.emptyTitle,
                { color: hub.text, fontFamily: typography.fontHeadingMedium },
              ]}
            >
              {selectedFilter === 'all'
                ? 'No tracked applications yet'
                : `No applications in ${selectedFilter}`}
            </Text>
            <Text
              style={[
                styles.emptyDesc,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              {selectedFilter === 'all'
                ? 'Save opportunities from Jobs or tap "Add an opportunity" above to track positions you found elsewhere.'
                : `You don’t have any opportunities marked as ${selectedFilter}.`}
            </Text>
            {selectedFilter !== 'all' && (
              <Button
                label="View all applications"
                onPress={() => setSelectedFilter('all')}
                variant="secondary"
                style={{ marginTop: spacing.base }}
              />
            )}
          </Card>
        )}

        {/* Applications List */}
        {!loading &&
          !error &&
          filteredApps.map((item) => {
            const statusUpper = item.status.toUpperCase();
            const locationText = `${item.company} · ${item.location}`;

            return (
              <Card key={item._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: hub.soft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: hub.text,
                          fontFamily: typography.fontMonoMedium,
                        },
                      ]}
                    >
                      {statusUpper}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleOpenSheet(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Update status for ${item.title}`}
                    hitSlop={8}
                    style={styles.moreButton}
                  >
                    <MoreHorizontal size={20} color={hub.muted} />
                  </Pressable>
                </View>

                <Text
                  style={[
                    styles.roleTitle,
                    {
                      color: hub.text,
                      fontFamily: typography.fontHeadingMedium,
                    },
                  ]}
                >
                  {item.title}
                </Text>

                <Text
                  style={[
                    styles.companyText,
                    { color: hub.muted, fontFamily: typography.fontBody },
                  ]}
                >
                  {locationText}
                </Text>

                {item.notes.length > 0 && (
                  <Text
                    style={[
                      styles.notesText,
                      { color: hub.muted, fontFamily: typography.fontBody },
                    ]}
                  >
                    Next step: {item.notes}
                  </Text>
                )}

                {/* Destination actions */}
                <View
                  style={[
                    styles.actionRow,
                    { borderTopColor: hub.line },
                  ]}
                >
                  {item.jobId ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/job',
                          params: { id: item.jobId },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Review opportunity detail"
                      style={styles.actionLink}
                    >
                      <Text
                        style={[
                          styles.actionLinkText,
                          {
                            color: hub.text,
                            fontFamily: typography.fontBodyBold,
                          },
                        ]}
                      >
                        Review opportunity
                      </Text>
                      <ArrowRight size={14} color={hub.text} />
                    </Pressable>
                  ) : item.url ? (
                    <Pressable
                      onPress={() => handleOpenExternal(item.url)}
                      accessibilityRole="button"
                      accessibilityLabel="View external listing"
                      style={styles.actionLink}
                    >
                      <Text
                        style={[
                          styles.actionLinkText,
                          {
                            color: hub.text,
                            fontFamily: typography.fontBodyBold,
                          },
                        ]}
                      >
                        View listing
                      </Text>
                      <ExternalLink size={14} color={hub.text} />
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => handleOpenSheet(item)}
                    accessibilityRole="button"
                    accessibilityLabel="Change status"
                    style={styles.updateLink}
                  >
                    <Text
                      style={[
                        styles.updateLinkText,
                        {
                          color: hub.muted,
                          fontFamily: typography.fontBodyMedium,
                        },
                      ]}
                    >
                      Update status
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
      </ScrollView>

      {/* Status update sheet */}
      <Sheet
        visible={!!activeSheetItem}
        title="Application status"
        onClose={handleCloseSheet}
      >
        {activeSheetItem && (
          <View style={styles.sheetForm}>
            {sheetError && (
              <View
                style={[
                  styles.sheetErrorBox,
                  { backgroundColor: hub.soft, borderColor: hub.line },
                ]}
              >
                <AlertCircle size={14} color={hub.text} />
                <Text
                  style={[
                    styles.sheetErrorText,
                    { color: hub.text, fontFamily: typography.fontBody },
                  ]}
                >
                  {sheetError}
                </Text>
              </View>
            )}

            <Text
              style={[
                styles.sheetLabel,
                { color: hub.text, fontFamily: typography.fontBodyMedium },
              ]}
            >
              Status
            </Text>

            <View style={styles.sheetPillsGrid}>
              {EDITABLE_STATUSES.map((opt) => {
                const isSelected = targetStatus === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setTargetStatus(opt.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Set status to ${opt.label}`}
                    style={[
                      styles.sheetPill,
                      {
                        backgroundColor: isSelected ? hub.text : hub.surface,
                        borderColor: isSelected ? hub.text : hub.line,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sheetPillText,
                        {
                          color: isSelected ? hub.bg : hub.text,
                          fontFamily: isSelected
                            ? typography.fontBodyBold
                            : typography.fontBody,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.sheetLabel,
                {
                  color: hub.text,
                  fontFamily: typography.fontBodyMedium,
                  marginTop: spacing.sm,
                },
              ]}
            >
              Notes / Next step
            </Text>

            <TextInput
              value={targetNotes}
              onChangeText={setTargetNotes}
              placeholder="Your next step…"
              placeholderTextColor={hub.muted}
              multiline
              numberOfLines={3}
              style={[
                styles.sheetTextarea,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
              accessibilityLabel="Application notes"
            />

            <Button
              label={isUpdating ? 'Saving…' : 'Save status'}
              onPress={handleSaveStatus}
              variant="primary"
              loading={isUpdating}
              style={{ marginTop: spacing.md }}
            />
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
  addButton: {
    marginBottom: spacing.base,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  offlineText: {
    fontSize: typography.sizes.fine,
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.base,
  },
  filterPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    minHeight: targetSizes.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterText: {
    fontSize: typography.sizes.body,
  },
  centerContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.body,
  },
  errorCard: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  errorTitle: {
    fontSize: typography.sizes.md,
    marginTop: spacing.xs,
  },
  errorDesc: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    marginTop: spacing.xs,
  },
  emptyDesc: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    marginBottom: spacing.base,
    padding: spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  statusText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.5,
  },
  moreButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: typography.sizes.md,
    marginBottom: spacing.xxs,
  },
  companyText: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.sizes.fine,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  actionLinkText: {
    fontSize: typography.sizes.body,
  },
  updateLink: {
    paddingVertical: spacing.xxs,
  },
  updateLinkText: {
    fontSize: typography.sizes.fine,
  },
  sheetForm: {
    gap: spacing.xs,
  },
  sheetErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  sheetErrorText: {
    fontSize: typography.sizes.fine,
    flex: 1,
  },
  sheetLabel: {
    fontSize: typography.sizes.body,
  },
  sheetPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sheetPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    minHeight: targetSizes.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetPillText: {
    fontSize: typography.sizes.fine,
  },
  sheetTextarea: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: typography.sizes.body,
    textAlignVertical: 'top',
    minHeight: 80,
  },
});
