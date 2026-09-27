import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getThread, listThreads, type ChatThread } from '@/api/chat';
import { CacheKeys, cached, freshness } from '@/offline/cache';
import { OfflineBanner } from '@/offline/OfflineBanner';
import { haptics } from '@/ui/haptics';
import { useChat, type ChatMessage } from '@/chat/ChatProvider';
import { PlusGlyph } from '@/components/glyphs/TabGlyphs';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { Tag } from '@/components/Tag';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Threads — the AI Hub's conversation list.
 *
 * Matches design/png/03-hub-threads.png. Presented as a route rather than an
 * in-screen drawer so Android's back button closes it for free.
 *
 * Grouping is by recency rather than a server field: the threads route returns
 * `updatedAt`, and deriving "Pinned / Last 7 days / Older" client-side avoids
 * inventing a server capability that does not exist.
 */
export default function ThreadsScreen() {
  const hub = useTheme('hub');
  const insets = useSafeAreaInsets();
  const { loadThread, threadId, reset } = useChat();

  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [cachedAt, setCachedAt] = useState('');

  const load = useCallback(async () => {
    setError(null);
    // Read-through cache: an offline launch still lists the threads the user
    // has seen, labelled with how old they are.
    const hit = await cached(CacheKeys.threads, listThreads);
    setThreads(hit.value ?? []);
    setStale(hit.stale);
    setCachedAt(freshness(hit.at));
    if (!hit.value && hit.error) {
      setError(hit.error instanceof Error ? hit.error.message : 'Could not load threads.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => (t.title ?? '').toLowerCase().includes(q));
  }, [threads, query]);

  const open = useCallback(
    async (thread: ChatThread) => {
      setOpening(thread._id);
      haptics.tap();
      try {
        const detail = await getThread(thread._id);
        loadThread(
          thread,
          detail.messages.map((m, i) => ({
            id: `t${i}`,
            role: m.role,
            content: m.content,
            reasoning: m.reasoning,
          })) satisfies ChatMessage[],
        );
        router.back();
      } catch (err) {
        haptics.warn();
        setError(err instanceof Error ? err.message : 'Could not open that thread.');
      } finally {
        setOpening(null);
      }
    },
    [loadThread],
  );

  return (
    <View style={[styles.screen, { backgroundColor: hub.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BrandWordmark compact />
        <View style={styles.flex} />
        <Tag>Demo</Tag>
      </View>

      <Pressable
        onPress={() => {
          reset();
          router.back();
        }}
        accessibilityRole="button"
        accessibilityLabel="Start a new thread"
        style={({ pressed }) => [
          styles.newButton,
          { backgroundColor: hub.strong },
          pressed ? { opacity: 0.8 } : null,
        ]}
      >
        <PlusGlyph color={hub.bg} size={18} />
        <Text style={[styles.newButtonText, { color: hub.bg }]}>New thread</Text>
      </Pressable>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search threads"
        placeholderTextColor={hub.muted}
        accessibilityLabel="Search threads"
        style={[styles.search, { backgroundColor: hub.soft, color: hub.text }]}
      />

      {stale ? <OfflineBanner message="You're offline. These threads are saved on this device." cachedAt={cachedAt} /> : null}

      {error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: hub.danger }]}>{error}</Text>
          <Pressable onPress={load} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.retry, { color: hub.text }]}>Retry</Text>
          </Pressable>
        </View>
      ) : threads === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={hub.strong} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: hub.text }]}>
            {query ? 'No threads match' : 'No threads yet'}
          </Text>
          <Text style={[styles.emptyBody, { color: hub.muted }]}>
            {query
              ? 'Try a different search.'
              : 'Ask something in the Hub and it will show up here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t._id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.s6 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={item.title ?? 'Untitled thread'}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: hub.line },
                item._id === threadId ? { backgroundColor: hub.soft } : null,
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: hub.soft }]}>
                {opening === item._id ? (
                  <ActivityIndicator size="small" color={hub.strong} />
                ) : (
                  <Text style={[styles.avatarText, { color: hub.text }]}>
                    {(item.title ?? 'T').trim()[0]?.toUpperCase() ?? 'T'}
                  </Text>
                )}
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, { color: hub.text }]} numberOfLines={1}>
                  {item.title ?? 'Untitled thread'}
                </Text>
                <Text style={[styles.rowMeta, { color: hub.muted }]} numberOfLines={1}>
                  {[item.subject, relativeTime(item.updatedAt)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

/** Short relative label. Deliberately coarse — exact times add noise here. */
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.s4,
    paddingTop: space.s3,
    paddingBottom: space.s4,
  },
  newButton: {
    marginHorizontal: space.s4,
    height: 50,
    borderRadius: radius.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newButtonText: { fontFamily: fontFamily.sansSemiBold, fontSize: 15 },
  search: {
    marginHorizontal: space.s4,
    marginTop: space.s3,
    height: 44,
    borderRadius: radius.chip,
    paddingHorizontal: space.s3,
    fontFamily: fontFamily.sans,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    paddingVertical: 13,
    borderBottomWidth: 1.5,
  },
  avatar: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.headingExtraBold, fontSize: 15 },
  rowTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fontFamily.sans, fontSize: 12, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.s6, gap: 8 },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: 17 },
  emptyBody: { fontFamily: fontFamily.sans, fontSize: 13.5, textAlign: 'center' },
  errorText: { fontFamily: fontFamily.sans, fontSize: 14, textAlign: 'center' },
  retry: {
    fontFamily: fontFamily.monoBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
