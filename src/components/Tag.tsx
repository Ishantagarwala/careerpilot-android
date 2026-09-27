import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamily, radius, space, type } from '@/theme/tokens';

/**
 * Tag / status chip.
 *
 * `tone` maps to the design spec's tag vocabulary:
 *   outline — default, hairline border, muted text
 *   lime    — completion / match, the ONE filled accent
 *   dark    — emphatic neutral (near-black)
 *   danger  — withheld / failing state
 *
 * Colour is never the only signal — callers pass text that carries the meaning
 * too (DESIGN_SPEC.md §7).
 */
export type TagTone = 'outline' | 'lime' | 'dark' | 'danger';

export function Tag({
  children,
  tone = 'outline',
  style,
}: {
  children: React.ReactNode;
  tone?: TagTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.base, toneStyles[tone].container, style]}>
      <Text style={[styles.text, toneStyles[tone].text]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 25,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    ...type.label,
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
});

const toneStyles = {
  outline: StyleSheet.create({
    container: { borderColor: '#e6e8ee', backgroundColor: 'transparent' },
    text: { color: '#6b7280' },
  }),
  lime: StyleSheet.create({
    container: { borderColor: '#baf600', backgroundColor: '#baf600' },
    text: { color: '#151f00' },
  }),
  dark: StyleSheet.create({
    container: { borderColor: '#050505', backgroundColor: '#050505' },
    text: { color: '#ffffff' },
  }),
  danger: StyleSheet.create({
    container: { borderColor: '#f6c9c9', backgroundColor: '#fdecec' },
    text: { color: '#b91c1c' },
  }),
} as const;

/** Section eyebrow — mono, uppercase, always tracked. */
export function SectionLabel({
  children,
  style,
  color,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  return (
    <Text style={[labelStyles.label, color ? { color } : null, style as object]}>
      {children}
    </Text>
  );
}

const labelStyles = StyleSheet.create({
  label: {
    ...type.label,
    fontFamily: fontFamily.monoMedium,
    color: '#6b7280',
    marginBottom: space.s2,
  },
});

/** Horizontal progress track. Lime fill is one of the few allowed fills. */
export function ProgressTrack({
  value,
  height = 7,
  trackColor = '#eceef2',
  fillColor = '#baf600',
  style,
}: {
  /** 0..1 */
  value: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[{ height, backgroundColor: trackColor, borderRadius: height / 2, overflow: 'hidden' }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: fillColor,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export { radius };
