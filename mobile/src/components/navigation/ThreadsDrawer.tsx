import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search, RotateCcw, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BrandWordmark } from '../brand/BrandWordmark';
import { radii, spacing, targetSizes, typography } from '../../theme/tokens';
import {
  ThreadSummary,
  fetchThreads,
  deleteThread,
  getCachedThreads,
  setCachedThreads,
} from '../../api/study';

/**
 * Threads drawer — design/png/03-hub-threads.png.
 *
 *   screens.py:160-216  "threads persist server-side (ai-hub/threads)" — a
 *                       316px sheet over the hub, with search, a Pinned group
 *                       and a recency-grouped list.
 *
 * Geometry, from android-shared.css :450-464:
 *
 *   .scrim      inset 0, rgba(9,11,6,.5)
 *   .sheet      width 316, radius 0 26 26 0, 1.5px right hairline,
 *               padding 16px 16px 0
 *   .searchbox  44px, radius 12, --hub-soft, "Search threads"
 *   .rowline    padding 13px 0, 1.5px bottom hairline, 40x40 radius-11 initial
 *               tile, 14.5/600 title, 12px meta, mono 11px tail
 *   .btn-primary  the full-width "New thread", 50px, no shadow
 *
 * It is a Modal rather than a router Drawer on purpose: the mockup shows the
 * sheet sliding over the HUB, with the hub's own app bar and bottom
 * navigation still visible behind the scrim. A nested Drawer layout would
 * bring its own chrome and cover the tab bar.
 *
 * Pinned is the last 24 hours; the second group is everything older. The API
 * exposes no pinned flag, so the grouping is honest about what it is — a
 * recency split — rather than inventing a pin the user never set.
 */
interface ThreadsDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  /**
   * Fired after a thread is deleted, with its id. The Hub uses this to clear its
   * own transcript when the thread it is currently showing is the one deleted —
   * otherwise the drawer would drop a row while the chat behind it kept
   * displaying that thread's messages.
   */
  onDeleted?: (threadId: string) => void;
}

const DAY_MS = 86400000;

/**
 * A destructive confirmation, cross-platform.
 *
 * `Alert.alert` is a no-op on react-native-web, so a delete confirmed by Alert
 * alone would silently do nothing on web. `window.confirm` is the equivalent
 * there.
 */
function confirmDelete(title: string, onConfirm: () => void) {
  const message = `"${title}" and its messages will be permanently deleted. This cannot be undone.`;

  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== 'undefined' && window.confirm(`Delete thread?\n\n${message}`);
    if (ok) onConfirm();
    return;
  }

  Alert.alert('Delete thread?', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

function relativeLabel(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + 'd';
}

export const ThreadsDrawer: React.FC<ThreadsDrawerProps> = ({
  visible,
  onClose,
  onSelectThread,
  onNewThread,
  onDeleted,
}) => {
  const { hub } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The row currently being deleted, so it can show a spinner and dim. */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);

    // Read-through: show what this device already has, immediately.
    let cached: ThreadSummary[] | null = null;
    if (user?.id) {
      cached = await getCachedThreads(user.id);
      if (cached && cached.length) setThreads(cached);
    }

    setLoading(true);
    try {
      const live = await fetchThreads();
      const sorted = Array.isArray(live)
        ? [...live].sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
          )
        : [];
      setThreads(sorted);
      if (user?.id) await setCachedThreads(user.id, sorted);
    } catch {
      /*
       * Offline or unreachable. If the cache had anything, keep showing it and
       * stay quiet — the list is real, just not fresh, and replacing it with an
       * error would hide threads the student can still open. Only report a
       * failure when there is genuinely nothing to show.
       */
      if (!cached || !cached.length) setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const { pinned, recent } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? threads.filter((t) => (t.threadTitle || '').toLowerCase().includes(needle))
      : threads;
    const cut = Date.now() - DAY_MS;
    return {
      pinned: matching.filter(
        (t) => new Date(t.updatedAt || t.createdAt).getTime() >= cut
      ),
      recent: matching.filter((t) => new Date(t.updatedAt || t.createdAt).getTime() < cut),
    };
  }, [threads, query]);

  const handleDelete = useCallback(
    (item: ThreadSummary) => {
      confirmDelete(item.threadTitle || 'Untitled thread', async () => {
        /*
         * Optimistic: the row disappears immediately, and comes back if the
         * server refuses. Deleting is cheap to retry and the delay on a slow
         * connection is the more visible problem.
         */
        const previous = threads;
        const remaining = threads.filter((t) => t._id !== item._id);
        setThreads(remaining);
        setDeletingId(item._id);

        try {
          await deleteThread(item._id);
          // Keep the list cache in step so the row does not reappear on reopen.
          if (user?.id) await setCachedThreads(user.id, remaining);
          onDeleted?.(item._id);
        } catch (err: any) {
          setThreads(previous);
          const msg = err?.message || 'Could not delete the thread.';
          if (Platform.OS === 'web') {
            // eslint-disable-next-line no-alert
            if (typeof window !== 'undefined') window.alert(msg);
          } else {
            Alert.alert('Delete failed', msg);
          }
        } finally {
          setDeletingId(null);
        }
      });
    },
    [threads, user?.id, onDeleted]
  );

  const renderRow = (item: ThreadSummary) => {
    const initial = (item.threadTitle || 'T').trim().charAt(0).toUpperCase();
    const isDeleting = deletingId === item._id;

    return (
      <View key={item._id} style={[styles.row, { borderBottomColor: hub.line }]}>
        <Pressable
          onPress={() => onSelectThread(item._id)}
          accessibilityRole="button"
          accessibilityLabel={`Open thread ${item.threadTitle}`}
          style={({ pressed }) => [styles.rowMain, { opacity: isDeleting ? 0.4 : pressed ? 0.6 : 1 }]}
        >
          <View style={[styles.rowAvatar, { backgroundColor: hub.soft }]}>
            <Text style={[styles.rowAvatarText, { color: hub.text }]}>{initial}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: hub.text }]}>
              {item.threadTitle}
            </Text>
            <Text numberOfLines={1} style={[styles.rowMeta, { color: hub.muted }]}>
              {item.threadType === 'document' ? 'Document notes' : 'General'}
            </Text>
          </View>
          <Text style={[styles.rowTail, { color: hub.muted }]}>
            {relativeLabel(item.updatedAt || item.createdAt)}
          </Text>
        </Pressable>

        {/*
          Delete sits OUTSIDE the row's pressable. Nesting a Pressable inside
          another on Android makes the inner target unreliable — the outer one
          wins the touch — which is the classic way a delete button ends up
          opening the thread instead.
        */}
        <Pressable
          onPress={() => handleDelete(item)}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={`Delete thread ${item.threadTitle}`}
          accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={hub.muted} />
          ) : (
            <Trash2 size={16} color={hub.muted} />
          )}
        </Pressable>
      </View>
    );
  };

  const isEmpty = !loading && !failed && pinned.length === 0 && recent.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* .scrim — tapping it closes the drawer */}
        <Pressable
          style={[styles.scrim, { backgroundColor: 'rgba(9, 11, 6, 0.5)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close threads"
        />

        {/* .sheet — 316px, radius on the leading corner only */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: hub.surface,
              borderRightColor: hub.line,
              paddingTop: insets.top + spacing.base,
              paddingBottom: Math.max(insets.bottom, spacing.base),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <BrandWordmark compact />
            <View style={styles.sheetHeaderSpacer} />
            <View style={[styles.demoTag, { borderColor: hub.line }]}>
              <Text style={[styles.demoTagText, { color: hub.muted }]}>Demo</Text>
            </View>
          </View>

          {/* .searchbox */}
          <View style={[styles.searchBox, { backgroundColor: hub.soft }]}>
            <Search size={15} color={hub.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search threads"
              placeholderTextColor={hub.muted}
              style={[styles.searchInput, { color: hub.text }]}
              accessibilityLabel="Search threads"
            />
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && threads.length === 0 && (
              <View style={styles.stateRow}>
                <ActivityIndicator size="small" color={hub.muted} />
                <Text style={[styles.stateText, { color: hub.muted }]}>Loading threads…</Text>
              </View>
            )}

            {failed && threads.length === 0 && (
              <View style={styles.stateRow}>
                <Text style={[styles.stateText, { color: hub.muted }]}>
                  Could not reach your threads.
                </Text>
                <Pressable
                  onPress={load}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading threads"
                  hitSlop={10}
                  style={styles.retryRow}
                >
                  <RotateCcw size={14} color={hub.text} />
                  <Text style={[styles.retryText, { color: hub.text }]}>Retry</Text>
                </Pressable>
              </View>
            )}

            {pinned.length > 0 && (
              <>
                <Text style={[styles.groupLabel, { color: hub.muted }]}>Pinned</Text>
                <View>{pinned.map(renderRow)}</View>
              </>
            )}

            {recent.length > 0 && (
              <>
                <Text
                  style={[
                    styles.groupLabel,
                    { color: hub.muted, marginTop: spacing.lg },
                  ]}
                >
                  Last 7 days
                </Text>
                <View>{recent.map(renderRow)}</View>
              </>
            )}

            {isEmpty && (
              <Text style={[styles.stateText, { color: hub.muted, marginTop: spacing.md }]}>
                {query.trim()
                  ? 'No threads match “' + query.trim() + '”.'
                  : 'No threads yet. Start one below.'}
              </Text>
            )}
          </ScrollView>

          {/* .btn-primary — full width, 50px, no offset shadow */}
          <Pressable
            onPress={onNewThread}
            accessibilityRole="button"
            accessibilityLabel="Start a new thread"
            style={({ pressed }) => [
              styles.newThread,
              {
                backgroundColor: hub.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Plus size={18} color={hub.primaryForeground} />
            <Text style={[styles.newThreadText, { color: hub.primaryForeground }]}>
              New thread
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const SHEET_WIDTH = 316;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    // css:452-457
    width: SHEET_WIDTH,
    maxWidth: '88%',
    height: '100%',
    borderRightWidth: 1.5,
    borderTopRightRadius: radii.sheet,
    borderBottomRightRadius: radii.sheet,
    paddingHorizontal: spacing.base,
    ...Platform.select({
      web: { boxShadow: '8px 0 32px rgba(9, 11, 6, 0.28)' },
      default: {
        shadowColor: '#090b06',
        shadowOffset: { width: 8, height: 0 },
        shadowOpacity: 0.28,
        shadowRadius: 32,
        elevation: 16,
      },
    }),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    // The wordmark is the sheet's identity and must never be compressed away
    // by a long tag or a narrow device — it keeps its intrinsic width.
    flexShrink: 0,
  },
  sheetHeaderSpacer: { flex: 1, minWidth: spacing.sm },
  demoTag: {
    // `.tag` at mockup scale
    height: 25,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTagText: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
  searchBox: {
    // css:458-460 — 44px, radius 12, --hub-soft, no visible field of its own
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    /*
     * The input is the whole box, not a box inside a box. react-native-web
     * gives an <input> a 1px solid border and a focus ring by default, which
     * drew a stray rectangle inside the soft pill on every focus. On Android
     * the platform underline does the same. Both are suppressed here so the
     * only visible field is `.searchbox` itself, per the mockup.
     */
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.body,
    paddingVertical: 0,
    paddingHorizontal: 0,
    height: 44,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  list: { flex: 1, marginTop: spacing.lg },
  listContent: { paddingBottom: spacing.base },
  groupLabel: {
    // css:175-176 — .label
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    // css:362-374 — .rowline. The row is a container now: the tappable area and
    // the delete button are siblings so the button cannot lose the touch to the
    // row on Android.
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1.5,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  deleteBtn: {
    // 36dp visual, 52dp target with the 8dp hitSlop below.
    width: 36,
    height: 36,
    marginLeft: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatar: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: {
    fontFamily: typography.fontHeadingExtraBold,
    fontSize: 15,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14.5,
  },
  rowMeta: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  rowTail: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.fine,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stateText: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.meta,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  retryText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: typography.sizes.xs,
  },
  newThread: {
    // screens.py:209-210 — height 50, no shadow, full width
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radii.sm,
    marginTop: spacing.md,
  },
  newThreadText: {
    fontFamily: typography.fontHeading,
    fontSize: 15,
  },
});
