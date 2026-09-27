import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, space } from '@/theme/tokens';

/**
 * Shared product-surface scaffold — Language B (hub).
 *
 * Owns the safe-area top inset and the standard 16dp gutter so no screen has to
 * reason about insets itself. The bottom inset is intentionally NOT applied:
 * the tab bar owns it, and doubling it would float content above the bar.
 */
export function Screen({
  children,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const hub = useTheme('hub');
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: hub.bg, paddingTop: insets.top },
        padded ? styles.padded : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** App bar: title plus optional subtitle, with an optional leading/trailing slot. */
export function AppBar({
  title,
  subtitle,
  titleSize = 'screen',
  leading,
  trailing,
}: {
  title: string;
  subtitle?: string;
  titleSize?: 'screen' | 'appbar';
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const hub = useTheme('hub');

  return (
    <View style={styles.appBar}>
      {leading}
      <View style={styles.appBarText}>
        <Text
          style={[titleSize === 'screen' ? styles.screenTitle : styles.appBarTitle, { color: hub.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: hub.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

/** Section eyebrow — mono, uppercase, always tracked. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const hub = useTheme('hub');
  return <Text style={[styles.sectionLabel, { color: hub.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { paddingHorizontal: space.s4 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingTop: space.s2,
    paddingBottom: space.s3,
  },
  appBarText: { flex: 1, minWidth: 0 },
  screenTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  appBarTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  sectionLabel: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: space.s6,
    marginBottom: space.s2,
  },
});
