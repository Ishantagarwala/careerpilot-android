import { StyleSheet, Text, View } from 'react-native';

import { brandLight, elevation, fontFamily, radius } from '@/theme/tokens';

/**
 * The brand wordmark: a bordered chip with a lime square, lifted by a hard
 * offset shadow. Language A only.
 */
export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={[styles.shell, compact ? styles.shellCompact : null]}
      accessibilityRole="image"
      accessibilityLabel="CareerPilot"
    >
      <View style={[styles.dot, compact ? styles.dotCompact : null]} />
      <Text style={[styles.text, compact ? styles.textCompact : null]}>CareerPilot</Text>
    </View>
  );
}

const b = brandLight;

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.card,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.brand,
    ...elevation.brandSmall,
  },
  shellCompact: { paddingVertical: 7, paddingHorizontal: 11 },
  dot: {
    width: 11,
    height: 11,
    backgroundColor: b.primary,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: 3,
  },
  dotCompact: { width: 9, height: 9 },
  text: {
    fontFamily: fontFamily.headingExtraBold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: b.foreground,
  },
  textCompact: { fontSize: 14 },
});
