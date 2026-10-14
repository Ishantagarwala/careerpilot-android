import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  MessageSquare,
  ChevronRight,
  Ellipsis,
  RotateCcw,
  X,
  Trash2,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import {
  ThreadSummary,
  fetchThreads,
  renameThread,
  deleteThread,
  getCachedThreads,
  setCachedThreads,
  groupThreadsByDate,
  formatThreadTime,
} from '../src/api/study';

export default function ConversationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manage modal sheet state
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ThreadSummary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try reading user cache first
    if (user?.id) {
      const cached = await getCachedThreads(user.id);
      if (cached && cached.length > 0) {
        setThreads(cached);
        setLoading(false);
      }
    }

    try {
      const liveThreads = await fetchThreads();
      const sorted = Array.isArray(liveThreads)
        ? liveThreads.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
          )
        : [];
      setThreads(sorted);
      if (user?.id) {
        await setCachedThreads(user.id, sorted);
      }
    } catch (err: any) {
      console.warn('Failed to fetch threads:', err);
      if (threads.length === 0) {
        setError(err?.message || 'Could not load conversations. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleOpenThread = (threadId: string) => {
    router.push({
      pathname: '/(tabs)/study',
      params: { threadId },
    } as any);
  };

  const handleNewConversation = () => {
    router.push({
      pathname: '/(tabs)/study',
      params: { newChat: 'true' },
    } as any);
  };

  const handleOpenManage = (thread?: ThreadSummary) => {
    const target = thread || threads[0] || null;
    if (!target) return;
    setSelectedThread(target);
    setEditTitle(target.threadTitle);
    setIsManageOpen(true);
  };

  const handleSaveTitle = async () => {
    if (!selectedThread || !editTitle.trim() || isSavingTitle) return;

    setIsSavingTitle(true);
    try {
      const updated = await renameThread(selectedThread._id, editTitle.trim());
      const updatedList = threads.map((t) =>
        t._id === selectedThread._id ? { ...t, threadTitle: updated.threadTitle } : t
      );
      setThreads(updatedList);
      if (user?.id) {
        await setCachedThreads(user.id, updatedList);
      }
      setIsManageOpen(false);
      setSelectedThread(null);
    } catch (err: any) {
      Alert.alert('Rename Error', err?.message || 'Failed to update conversation title.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleDeleteConversation = () => {
    if (!selectedThread || isDeleting) return;

    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${selectedThread.threadTitle}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteThread(selectedThread._id);
              const remaining = threads.filter((t) => t._id !== selectedThread._id);
              setThreads(remaining);
              if (user?.id) {
                await setCachedThreads(user.id, remaining);
              }
              setIsManageOpen(false);
              setSelectedThread(null);
            } catch (err: any) {
              Alert.alert('Delete Error', err?.message || 'Failed to delete conversation.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const { today, earlier } = groupThreadsByDate(threads);

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Conversations" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          YOUR AI STUDY HUB
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Pick up where{'\n'}you left off.
        </Text>

        <Button
          label="New conversation"
          onPress={handleNewConversation}
          variant="primary"
          icon={<Plus size={18} color={hub.bg} />}
          iconPosition="left"
          style={styles.newButton}
        />

        {/* Loading */}
        {loading && threads.length === 0 && (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="small" color={hub.muted} />
            <Text style={[styles.stateText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Loading conversations…
            </Text>
          </View>
        )}

        {/* Error */}
        {error && threads.length === 0 && (
          <View style={[styles.errorCard, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Text style={[styles.errorTitle, { color: hub.danger, fontFamily: typography.fontBodyBold }]}>
              Could not load conversations
            </Text>
            <Text style={[styles.errorSubtitle, { color: hub.text, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={loadThreads}
              variant="secondary"
              icon={<RotateCcw size={16} color={hub.text} />}
              style={styles.retryBtn}
            />
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && threads.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No conversations yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Start a new session with your tutor to ask questions, explore topics, or review study materials.
            </Text>
          </View>
        )}

        {/* Today Group */}
        {today.length > 0 && (
          <>
            <Text style={[styles.sectionHeading, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
              TODAY
            </Text>
            <View style={styles.listContainer}>
              {today.map((item) => (
                <Pressable
                  key={item._id}
                  onPress={() => handleOpenThread(item._id)}
                  style={[styles.convRow, { backgroundColor: hub.surface, borderColor: hub.line }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Conversation: ${item.threadTitle}`}
                >
                  <MessageSquare size={18} color={hub.text} />
                  <View style={styles.convText}>
                    <Text
                      style={[styles.convTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}
                      numberOfLines={1}
                    >
                      {item.threadTitle}
                    </Text>
                    <Text style={[styles.convSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
                      {item.threadType === 'document' ? 'Document notes' : 'General conversation'}
                      {item.updatedAt ? ` · ${formatThreadTime(item.updatedAt)}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleOpenManage(item)}
                    style={styles.ellipsisButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Manage conversation ${item.threadTitle}`}
                  >
                    <Ellipsis size={18} color={hub.muted} />
                  </Pressable>
                  <ChevronRight size={18} color={hub.muted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Earlier Group */}
        {earlier.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionHeading,
                { color: hub.muted, fontFamily: typography.fontMonoMedium, marginTop: spacing.xl },
              ]}
            >
              EARLIER
            </Text>
            <View style={styles.listContainer}>
              {earlier.map((item) => (
                <Pressable
                  key={item._id}
                  onPress={() => handleOpenThread(item._id)}
                  style={[styles.convRow, { backgroundColor: hub.surface, borderColor: hub.line }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Conversation: ${item.threadTitle}`}
                >
                  <MessageSquare size={18} color={hub.text} />
                  <View style={styles.convText}>
                    <Text
                      style={[styles.convTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}
                      numberOfLines={1}
                    >
                      {item.threadTitle}
                    </Text>
                    <Text style={[styles.convSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
                      {item.threadType === 'document' ? 'Document notes' : 'General conversation'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleOpenManage(item)}
                    style={styles.ellipsisButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Manage conversation ${item.threadTitle}`}
                  >
                    <Ellipsis size={18} color={hub.muted} />
                  </Pressable>
                  <ChevronRight size={18} color={hub.muted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Manage a conversation action matching approved preview */}
        {threads.length > 0 && (
          <Button
            label="Manage a conversation"
            onPress={() => handleOpenManage()}
            variant="secondary"
            icon={<Ellipsis size={18} color={hub.text} />}
            iconPosition="right"
            style={styles.manageButton}
          />
        )}
      </ScrollView>

      {/* Manage Conversation Bottom Sheet Modal */}
      <Modal
        visible={isManageOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsManageOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsManageOpen(false)} />
          <View
            style={[
              styles.sheetContent,
              {
                backgroundColor: hub.surface,
                borderTopColor: hub.line,
                paddingBottom: Math.max(insets.bottom, spacing.base) + spacing.base,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                Conversation actions
              </Text>
              <Pressable
                onPress={() => setIsManageOpen(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close actions"
              >
                <X size={20} color={hub.muted} />
              </Pressable>
            </View>

            <View style={styles.sheetForm}>
              <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                TITLE
              </Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Conversation title"
                placeholderTextColor={hub.muted}
                style={[
                  styles.sheetInput,
                  {
                    color: hub.text,
                    borderColor: hub.line,
                    backgroundColor: hub.bg,
                    fontFamily: typography.fontBody,
                  },
                ]}
              />

              <Button
                label={isSavingTitle ? 'Saving…' : 'Save title'}
                onPress={handleSaveTitle}
                disabled={!editTitle.trim() || isSavingTitle}
                variant="primary"
                icon={<Check size={18} color={hub.bg} />}
                iconPosition="left"
                style={styles.sheetAction}
              />

              <Button
                label={isDeleting ? 'Deleting…' : 'Delete conversation'}
                onPress={handleDeleteConversation}
                disabled={isDeleting}
                variant="secondary"
                icon={<Trash2 size={18} color={hub.danger} />}
                iconPosition="left"
                style={styles.sheetDeleteAction}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  newButton: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  listContainer: {
    gap: spacing.sm,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    minHeight: 56,
  },
  convText: {
    flex: 1,
  },
  convTitle: {
    fontSize: typography.sizes.body,
  },
  convSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  ellipsisButton: {
    padding: spacing.xs,
  },
  manageButton: {
    marginTop: spacing.xl,
  },
  stateCenter: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    fontSize: typography.sizes.body,
  },
  errorCard: {
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  errorTitle: {
    fontSize: typography.sizes.sm,
  },
  errorSubtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.sizes.subheading,
  },
  emptySubtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContent: {
    borderTopLeftRadius: radii.xs,
    borderTopRightRadius: radii.xs,
    borderTopWidth: 1,
    padding: spacing.base,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  sheetTitle: {
    fontSize: typography.sizes.md,
  },
  closeBtn: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetForm: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1,
  },
  sheetInput: {
    height: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
  },
  sheetAction: {
    marginTop: spacing.xs,
  },
  sheetDeleteAction: {
    marginTop: spacing.xs,
  },
});
