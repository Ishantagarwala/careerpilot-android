import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { spacing, targetSizes, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  style,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  const content = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: skin.surface,
          borderColor: skin.line,
          borderWidth: skin.borderWidth,
          borderRadius: skin.cardRadius,
        },
        style,
      ]}
    >
      {leading && <View style={styles.leading}>{leading}</View>}
      <View style={styles.center}>
        <Text style={[styles.title, { color: skin.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: skin.muted }]}>{subtitle}</Text>}
      </View>
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  row: {
    minHeight: targetSizes.minTouch,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  leading: {
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xxs,
  },
  trailing: {
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
