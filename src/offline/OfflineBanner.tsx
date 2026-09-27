import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Offline notice.
 *
 * Matches design/png/10-dark-offline.png: amber bar, dot, plain sentence.
 * Wording is factual and says what still works — PRODUCT.md's voice is a calm
 * co-pilot, and "no internet connection" alone leaves the user guessing whether
 * their thread just disappeared.
 */
export function OfflineBanner({
  message = "You're offline. Showing what's saved on this device.",
  cachedAt,
}: {
  message?: string;
  cachedAt?: string;
}) {
  const hub = useTheme('hub');
  const dark = hub.bg === '#0f1115';

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: dark ? '#2a2413' : '#fff8e6',
          borderColor: dark ? '#4d4322' : '#e6d9a8',
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.dot} />
      <Text style={[styles.text, { color: dark ? '#e6d9a8' : '#5c4a10' }]}>
        {message}
        {cachedAt ? <Text style={styles.dim}>{`  Saved ${cachedAt}.`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginHorizontal: space.s4,
    marginBottom: space.s2,
    borderWidth: 1.5,
    borderRadius: radius.chip,
    paddingHorizontal: space.s3,
    paddingVertical: 11,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d99a00' },
  text: { flex: 1, fontFamily: fontFamily.sansMedium, fontSize: 13, lineHeight: 19 },
  dim: { fontFamily: fontFamily.sans, opacity: 0.75 },
});
