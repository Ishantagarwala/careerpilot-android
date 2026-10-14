import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { spacing, targetSizes, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

interface ChoiceButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const ChoiceButton: React.FC<ChoiceButtonProps> = ({
  label,
  selected,
  onPress,
  style,
  textStyle,
  disabled = false,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        {
          borderRadius: skin.controlRadius,
          backgroundColor: selected ? skin.strong : skin.surface,
          borderColor: selected ? skin.strong : skin.line,
          borderWidth: skin.borderWidth,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? skin.onStrong : skin.text,
            fontFamily: selected ? typography.fontBodyBold : typography.fontBody,
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
  choice: {
    width: '100%',
    minHeight: targetSizes.minTouch,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    textAlign: 'left',
  },
});
