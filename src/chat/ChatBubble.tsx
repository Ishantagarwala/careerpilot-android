import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';
import type { ChatMessage } from './ChatProvider';
import { MarkdownContent } from './MarkdownContent';
import { ReasoningDisclosure } from './ReasoningDisclosure';

/**
 * One turn in the thread.
 *
 * Matches design/png/02-hub-chat.png: the user's message is a near-black bubble
 * aligned right; the assistant's is flowing prose with a lime identity rule,
 * not a bubble. The message IS the content (PRODUCT.md principle 2), so the
 * assistant side deliberately has no container.
 */
export function ChatBubble({ message }: { message: ChatMessage }) {
  const hub = useTheme('hub');

  if (message.role === 'user') {
    return (
      <View style={[styles.userBubble, { backgroundColor: hub.strong }]}>
        <Text style={[styles.userText, { color: hub.bg === '#0f1115' ? '#15171b' : '#ffffff' }]} selectable>
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.reply}>
      <View style={styles.identity}>
        <View style={[styles.mark, { backgroundColor: hub.primary }]} />
        <Text style={[styles.name, { color: hub.muted }]}>CareerPilot</Text>
      </View>

      <ReasoningDisclosure
        reasoning={message.reasoning ?? ''}
        streaming={Boolean(message.streaming)}
      />

      {message.content ? <MarkdownContent>{message.content}</MarkdownContent> : null}

      {message.error ? (
        <View
          style={[styles.error, { borderColor: hub.danger }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.errorText, { color: hub.danger }]}>{message.error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: space.s4,
    paddingVertical: 13,
    marginTop: space.s4,
  },
  userText: { fontFamily: fontFamily.sans, fontSize: 15, lineHeight: 22 },

  reply: { marginTop: space.s6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  mark: { width: 20, height: 3, borderRadius: 2 },
  name: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  error: {
    borderWidth: 1.5,
    borderRadius: radius.chip,
    paddingHorizontal: space.s3,
    paddingVertical: 10,
    marginTop: space.s2,
  },
  errorText: { fontFamily: fontFamily.sans, fontSize: 13.5, lineHeight: 19 },
});
