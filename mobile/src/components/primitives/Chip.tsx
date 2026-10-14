import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { spacing, targetSizes, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  style,
  textStyle,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: skin.controlRadius,
          backgroundColor: selected ? skin.soft : skin.surface,
          borderColor: selected ? skin.strong : skin.line,
          borderWidth: selected ? skin.borderWidth : 1,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? skin.text : skin.muted,
            fontWeight: selected ? '600' : '400',
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    minHeight: targetSizes.minTouch,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.xs,
  },
  text: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
  },
});
