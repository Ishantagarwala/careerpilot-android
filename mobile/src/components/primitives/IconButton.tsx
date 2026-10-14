import React from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { targetSizes } from '../../theme/tokens';

interface IconButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * A bare 44dp hit target around a caller-supplied glyph. It paints nothing of
 * its own, so it has no design language — the icon's colour is the caller's.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  onPress,
  icon,
  accessibilityLabel,
  disabled = false,
  style,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        {
          width: targetSizes.iconTouch,
          height: targetSizes.iconTouch,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
};
