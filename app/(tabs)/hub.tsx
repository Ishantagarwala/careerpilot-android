import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { Chip, ComposerShell, IconButton, SendButton } from '@/components/hub/HubControls';
import { MenuGlyph, PaperclipGlyph, SendGlyph } from '@/components/glyphs/TabGlyphs';
import { ChatBubble } from '@/chat/ChatBubble';
import { useChat } from '@/chat/ChatProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';
import { MAX_MESSAGE_CHARS } from '@/api/chat';
import { OfflineBanner } from '@/offline/OfflineBanner';
import { useConnectivity } from '@/offline/useConnectivity';

/**
 * Hub — the AI study surface and the app's default tab.
 *
 * Wired to the real `POST /api/ai-hub/chat` SSE route. The reply streams token
 * by token; reasoning arrives on a separate channel and stays collapsed behind
 * a disclosure until asked for.
 *
 * Offline queueing is not implemented yet (Phase 5, design/ANDROID_APP_PLAN.md
 * §5). Until then a failed send surfaces the error in the thread and the
 * composer stays usable, rather than silently dropping the prompt.
 */
const STARTERS = [
  { t: 'Explain a concept', s: 'Grounded on your uploaded notes' },
  { t: 'Build a study plan', s: 'For a milestone you are stuck on' },
  { t: 'Quiz me', s: 'On anything in your documents' },
];

export default function HubScreen() {
  const hub = useTheme('hub');
  const { user } = useAuth();
  const { messages, send, stop, isStreaming, error, title, threadId, reset } = useChat();
  const { isOnline } = useConnectivity();

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  const firstName = user?.name?.split(' ')[0] ?? null;
  // Offline deliberately disables sending rather than queueing. design/
  // ANDROID_APP_PLAN.md §5: a prompt that silently sends later is worse than
  // one that says it cannot go now.
  const canSend = draft.trim().length > 0 && !isStreaming && isOnline;
  const overLimit = draft.length > MAX_MESSAGE_CHARS;

  const submit = useCallback(
    async (text?: string) => {
      const value = (text ?? draft).trim();
      if (!value || isStreaming || value.length > MAX_MESSAGE_CHARS) return;
      setDraft('');
      await send(value);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    [draft, isStreaming, send],
  );

  const streaming = isStreaming || messages.some((m) => m.streaming);

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.gutter}>
          <AppBar
            title={title ?? 'Hub'}
            subtitle={title ? `${messages.length} messages` : undefined}
            titleSize={title ? 'appbar' : 'screen'}
            leading={
              <IconButton label="Open threads" onPress={() => router.push('/threads')}>
                <MenuGlyph color={hub.text} />
              </IconButton>
            }
            trailing={
              messages.length > 0 ? (
                <Pressable
                  onPress={reset}
                  accessibilityRole="button"
                  accessibilityLabel="Start a new thread"
                  hitSlop={8}
                >
                  <Text style={[styles.newThread, { color: hub.muted }]}>New</Text>
                </Pressable>
              ) : (
                <View style={[styles.modelPill, { borderColor: hub.line }]}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.modelText, { color: hub.text }]}>V4 Flash</Text>
                </View>
              )
            }
          />
        </View>

        {!isOnline ? <OfflineBanner /> : null}

        {messages.length === 0 ? (
          <View style={[styles.gutter, styles.flex]}>
            <Text style={[styles.greeting, { color: hub.text }]}>
              {firstName ? (
                <>
                  {'Good to see you,\n'}
                  <Text style={{ color: hub.muted }}>{firstName}.</Text>
                </>
              ) : (
                <>
                  {'What are we\n'}
                  <Text style={{ color: hub.muted }}>working on?</Text>
                </>
              )}
            </Text>

            <SectionLabel>Try</SectionLabel>
            <View style={styles.starters}>
              {STARTERS.map((row) => (
                <Pressable
                  key={row.t}
                  onPress={() => submit(row.t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.t}. ${row.s}`}
                  style={({ pressed }) => [
                    styles.starter,
                    { borderColor: hub.line, backgroundColor: hub.surface },
                    pressed ? { opacity: 0.6 } : null,
                  ]}
                >
                  <View style={styles.flex}>
                    <Text style={[styles.starterTitle, { color: hub.text }]}>{row.t}</Text>
                    <Text style={[styles.starterSub, { color: hub.muted }]}>{row.s}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {threadId ? null : (
              <Text style={[styles.hint, { color: hub.muted }]}>
                Threads are saved to your CareerPilot account as you go.
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={styles.listBody}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              streaming ? (
                <View style={styles.streamingRow}>
                  <Text style={[styles.streamingText, { color: hub.muted }]}>
                    {isStreaming ? 'responding…' : ''}
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        {error ? (
          <View style={[styles.gutter, styles.errorWrap]}>
            <View
              style={[styles.errorBox, { borderColor: hub.danger }]}
              accessibilityLiveRegion="polite"
            >
              <Text style={[styles.errorText, { color: hub.danger }]}>{error}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.gutter}>
          <ComposerShell>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              editable={isOnline}
              placeholder={isOnline ? 'Ask about your notes…' : 'Reconnect to ask a follow-up…'}
              placeholderTextColor={hub.muted}
              multiline
              maxLength={MAX_MESSAGE_CHARS + 1}
              accessibilityLabel="Message"
              style={[styles.input, { color: hub.text }]}
            />
            <View style={styles.composerBar}>
              <Chip
                label="Attach"
                leading={<PaperclipGlyph color={hub.muted} />}
                accessibilityLabel="Attach a document"
              />
              {overLimit ? (
                <Text style={[styles.limit, { color: hub.danger }]}>
                  {draft.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
                </Text>
              ) : null}
              <View style={styles.flex} />
              {isStreaming ? (
                <Pressable
                  onPress={stop}
                  accessibilityRole="button"
                  accessibilityLabel="Stop responding"
                  style={[styles.stopButton, { borderColor: hub.line }]}
                >
                  <View style={[styles.stopSquare, { backgroundColor: hub.strong }]} />
                </Pressable>
              ) : (
                <SendButton onPress={() => submit()} disabled={!canSend}>
                  <SendGlyph color={canSend ? hub.bg : hub.soft} />
                </SendButton>
              )}
            </View>
          </ComposerShell>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: space.s4 },
  listBody: { paddingHorizontal: space.s4, paddingBottom: space.s6 },

  newThread: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  modelPill: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16a34a' },
  modelText: { fontFamily: fontFamily.monoMedium, fontSize: 11.5 },

  greeting: {
    fontFamily: fontFamily.heading,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    marginTop: space.s2,
  },
  starters: { gap: space.s2 },
  starter: {
    borderWidth: 1.5,
    borderRadius: radius.card,
    paddingHorizontal: space.s4,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  starterTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5 },
  starterSub: { fontFamily: fontFamily.sans, fontSize: 12.5, marginTop: 2 },
  hint: { fontFamily: fontFamily.sans, fontSize: 12, marginTop: space.s4 },

  input: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 140,
    paddingTop: 2,
    paddingBottom: 10,
  },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  limit: { fontFamily: fontFamily.monoMedium, fontSize: 11 },

  stopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: { width: 13, height: 13, borderRadius: 3 },

  streamingRow: { paddingTop: space.s2 },
  streamingText: { fontFamily: fontFamily.mono, fontSize: 11 },

  errorWrap: { paddingBottom: space.s2 },
  errorBox: {
    borderWidth: 1.5,
    borderRadius: radius.chip,
    paddingHorizontal: space.s3,
    paddingVertical: 10,
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 19 },
});
