import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../../theme/ThemeContext';
import { radii, spacing, typography } from '../../theme/tokens';
import { useBrandElevation } from './brandElevation';

/**
 * The brand wordmark: a bordered chip with a lime square, lifted by a hard
 * offset shadow. Language A only — the wordmark is one of the few places
 * DESIGN_SPEC.md §2 allows lime outside a primary button.
 *
 * `compact` is the drawer variant: screens.py:179-181 draws it at
 * `padding: 7px 11px` with a `2px 2px 0` shadow, a 9px dot and 14px text, so it
 * sits inside the 316px threads sheet without crowding the search field below.
 */
export const BrandWordmark: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const brand = usePalette('brand');
  const shadow = useBrandElevation();

  return (
    <View
      style={[
        styles.shell,
        compact && styles.shellCompact,
        { borderColor: brand.border, backgroundColor: brand.card },
        shadow.brandSmall,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Career Pilot"
    >
      <View
        style={[
          styles.dot,
          compact && styles.dotCompact,
          { backgroundColor: brand.primary, borderColor: brand.border },
        ]}
      />
      <Text
        style={[
          styles.text,
          compact && styles.textCompact,
          { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
        ]}
      >
        Career Pilot
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    alignSelf: 'flex-start',
    // Never let a flex parent squash the wordmark — it is the brand's mark and
    // must keep its intrinsic size at any font scale or sheet width.
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: radii.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  shellCompact: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    gap: 7,
  },
  dot: {
    width: 11,
    height: 11,
    borderWidth: 2,
    borderRadius: 3,
  },
  dotCompact: {
    width: 9,
    height: 9,
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  textCompact: {
    fontSize: 14,
  },
});
