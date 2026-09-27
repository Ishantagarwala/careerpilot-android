import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Collapsible chain-of-thought disclosure.
 *
 * The route streams reasoning separately from the answer precisely so the hub
 * can show it as a disclosure rather than mixing thinking into the reply. It is
 * collapsed by default: PRODUCT.md principle 5 says thinking states stay quiet.
 *
 * While streaming and empty of reasoning, this renders the three-dot indicator.
 */
export function ReasoningDisclosure({
  reasoning,
  streaming,
  defaultOpen = false,
}: {
  reasoning: string;
  streaming: boolean;
  defaultOpen?: boolean;
}) {
  const hub = useTheme('hub');
  const [open, setOpen] = useState(defaultOpen);

  if (!reasoning && !streaming) return null;

  // Nothing to expand yet — just the quiet indicator.
  if (!reasoning) {
    return (
      <View style={styles.thinking}>
        <View style={[styles.dot, styles.dot1, { backgroundColor: hub.muted }]} />
        <View style={[styles.dot, styles.dot2, { backgroundColor: hub.muted }]} />
        <View style={[styles.dot, styles.dot3, { backgroundColor: hub.muted }]} />
        <Text style={[styles.thinkingLabel, { color: hub.muted }]}>thinking…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide thinking' : 'Show thinking'}
        hitSlop={8}
        style={styles.header}
      >
        <View style={[styles.rule, { backgroundColor: hub.primary }]} />
        <Text style={[styles.headerText, { color: hub.muted }]}>
          {open ? 'Hide thinking' : `Thought for a moment · ${reasoning.length} chars`}
        </Text>
      </Pressable>
      {open ? (
        <Text style={[styles.body, { color: hub.muted }]} selectable>
          {reasoning}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rule: { width: 16, height: 2, borderRadius: 1 },
  headerText: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 8,
    paddingLeft: 24,
    borderLeftWidth: 2,
    borderLeftColor: '#eceef2',
  },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.s3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  thinkingLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    marginLeft: 4,
  },
});
