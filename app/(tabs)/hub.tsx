import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { Chip, ComposerShell, IconButton, SendButton } from '@/components/hub/HubControls';
import {
  MenuGlyph,
  PaperclipGlyph,
  SendGlyph,
} from '@/components/glyphs/TabGlyphs';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Hub — the AI study surface, and the app's default tab.
 *
 * Matches design/png/02-hub-chat.png for the empty state.
 *
 * The composer is deliberately non-functional in this phase: `streamChat` is an
 * explicit stub (src/api/client.ts) because React Native's fetch cannot stream
 * and the SSE transport is Phase 2 work. The input is disabled rather than
 * accepting text it cannot send — a box that swallows a prompt is worse than
 * one that says it is not ready.
 */
export default function HubScreen() {
  const hub = useTheme('hub');
  const { user } = useAuth();
  const [draft, setDraft] = useState('');

  const firstName = user?.name?.split(' ')[0] ?? null;

  return (
    <Screen padded={false}>
      <View style={styles.gutter}>
        <AppBar
          title="Hub"
          leading={
            <IconButton label="Open threads">
              <MenuGlyph color={hub.text} />
            </IconButton>
          }
          trailing={
            <View style={[styles.modelPill, { borderColor: hub.line }]}>
              <View style={styles.liveDot} />
              <Text style={[styles.modelText, { color: hub.text }]}>V4 Flash</Text>
            </View>
          }
        />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
      >
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

        <SectionLabel>Not ready yet</SectionLabel>
        <View
          style={[styles.notice, { borderColor: hub.line, backgroundColor: hub.raised }]}
        >
          <Text style={[styles.noticeTitle, { color: hub.text }]}>
            Streaming chat lands next
          </Text>
          <Text style={[styles.noticeBody, { color: hub.muted }]}>
            The app authenticates and syncs against careerpilot.cc today. Chat
            needs a streaming transport — React Native&apos;s fetch cannot stream
            server-sent events, so the Hub composer stays disabled until that is
            wired up.
          </Text>
        </View>

        <SectionLabel>Planned for this screen</SectionLabel>
        <View style={styles.suggestions}>
          {[
            { t: 'Explain a concept', s: 'Grounded on your uploaded notes' },
            { t: 'Build a study plan', s: 'For a milestone you are stuck on' },
            { t: 'Quiz me', s: 'On anything in your documents' },
          ].map((row) => (
            <View
              key={row.t}
              style={[
                styles.suggestion,
                { borderColor: hub.line, backgroundColor: hub.surface },
              ]}
            >
              <View style={styles.flexChild}>
                <Text style={[styles.suggestionTitle, { color: hub.text }]}>{row.t}</Text>
                <Text style={[styles.suggestionSub, { color: hub.muted }]}>{row.s}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.gutter}>
        <ComposerShell>
          <Text style={[styles.placeholder, { color: hub.muted }]}>
            Chat is not available yet…
          </Text>
          <View style={styles.composerBar}>
            <Chip
              label="Attach"
              leading={<PaperclipGlyph color={hub.muted} />}
              accessibilityLabel="Attach a document"
            />
            <Chip label="Study plan" />
            <View style={styles.flexChild} />
            <SendButton disabled>
              <SendGlyph color={hub.soft} />
            </SendButton>
          </View>
        </ComposerShell>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexChild: { flex: 1 },
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s6 },

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

  notice: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    padding: space.s4,
  },
  noticeTitle: { fontFamily: fontFamily.heading, fontSize: 15, letterSpacing: -0.2 },
  noticeBody: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 20, marginTop: 6 },

  suggestions: { gap: space.s2 },
  suggestion: {
    borderWidth: 1.5,
    borderRadius: radius.card,
    paddingHorizontal: space.s4,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  suggestionTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5 },
  suggestionSub: { fontFamily: fontFamily.sans, fontSize: 12.5, marginTop: 2 },

  placeholder: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    paddingBottom: 10,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
  },
});
