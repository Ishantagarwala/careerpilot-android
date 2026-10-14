import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { DesignLanguage, spacing, targetSizes, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  /**
   * Which design language this button is painted in. Defaults to 'hub' — every
   * product surface. Language A (cream, lime, 2px black keyline) is opt-in and
   * only belongs on the sign-in and career surfaces.
   */
  language?: DesignLanguage;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'right',
  style,
  textStyle,
  accessibilityLabel,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    const base: ViewStyle = {
      minHeight: targetSizes.minTouch,
      borderRadius: skin.controlRadius,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
    };

    if (variant === 'primary') {
      base.backgroundColor = skin.strong;
      /*
       * Language A's primary action carries the 2px keyline; Language B's is a
       * flat near-black fill with no border.
       */
      if (skin.language === 'brand') {
        base.borderWidth = skin.borderWidth;
        base.borderColor = skin.line;
      }
    } else if (variant === 'secondary') {
      base.backgroundColor = skin.soft;
      base.borderWidth = skin.borderWidth;
      base.borderColor = skin.line;
    } else if (variant === 'danger') {
      base.backgroundColor = skin.danger;
    } else {
      /*
       * text — a bare label. It used to set minHeight 36 with no hitSlop, which
       * is below the 48x48dp minimum in DESIGN_SPEC.md §4 and is what the
       * offline banner's Retry used. The visual height stays small; the
       * TOUCH target is grown to 48 with hitSlop.
       */
      base.backgroundColor = 'transparent';
      base.paddingHorizontal = spacing.xs;
      base.minHeight = 36;
    }

    return base;
  };

  const getLabelColor = (): string => {
    if (variant === 'primary') return skin.onStrong;
    if (variant === 'danger') return skin.onDanger;
    return skin.text;
  };

  const getLabelStyle = (): TextStyle => ({
    // §3 — a control's label is Anybody 700 (css:212). This used to set no
    // family at all, so hub buttons rendered in the system face while the
    // brand ones rendered in Anybody.
    fontFamily: typography.fontHeading,
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: getLabelColor(),
    textAlign: 'center',
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      // §4 — every target reaches 48x48dp even when the visual is smaller.
      hitSlop={variant === 'text' ? { top: 6, bottom: 6, left: 8, right: 8 } : undefined}
      style={({ pressed }) => [getContainerStyle(pressed), style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? getLabelColor() : skin.text}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View>{icon}</View>}
          <Text style={[getLabelStyle(), textStyle]}>{label}</Text>
          {icon && iconPosition === 'right' && <View>{icon}</View>}
        </>
      )}
    </Pressable>
  );
};
