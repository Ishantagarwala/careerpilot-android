import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { usePalette } from '../../theme/ThemeContext';
import { radii, spacing, typography } from '../../theme/tokens';
import { brandElevation } from './brandElevation';

/**
 * Language A (brand) controls — cream, lime, 2px black borders and HARD offset
 * shadows. Used by the auth screens only (design/DESIGN_SPEC.md §1).
 *
 * These deliberately do not read the hub palette: mixing the two elevation
 * languages on one screen is the one thing the spec forbids.
 */

interface BrandButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * The one place lime is allowed to be a fill: Language A's primary action
 * (DESIGN_SPEC.md §2). Secondary actions are ghost buttons with a dashed
 * border, which is Language A's other signature move.
 */
export const BrandButton: React.FC<BrandButtonProps> = ({
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
}) => {
  const brand = usePalette('brand');
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: brand.border,
          backgroundColor: primary ? brand.primary : 'transparent',
        },
        primary ? brandElevation.brand : styles.ghost,
        // Pressing shifts the control INTO its shadow instead of changing
        // layout, so nothing around it jitters.
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? brand.primaryForeground : brand.foreground} />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View>{icon}</View>}
          <Text
            style={[
              styles.buttonText,
              {
                color: primary ? brand.primaryForeground : brand.foreground,
                fontFamily: typography.fontHeading,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && <View>{icon}</View>}
        </>
      )}
    </Pressable>
  );
};

interface BrandFieldProps extends TextInputProps {
  label: string;
  error?: string;
  rightAction?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Language A input: white card, 2px black border, 8px radius, tracked label. */
export const BrandField: React.FC<BrandFieldProps> = ({
  label,
  error,
  rightAction,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const brand = usePalette('brand');
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <Text
        style={[
          styles.fieldLabel,
          { color: brand.foreground, fontFamily: typography.fontMonoMedium },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: brand.card,
            borderColor: error ? brand.destructive : focused ? brand.ring : brand.border,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={brand.mutedForeground}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: brand.foreground, fontFamily: typography.fontBody }, style]}
          {...props}
        />
        {rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.errorText, { color: brand.destructive, fontFamily: typography.fontBody }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderWidth: 2,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ghost: { borderStyle: 'dashed' },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  disabled: { opacity: 0.5 },
  buttonText: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  field: { marginVertical: spacing.sm },
  fieldLabel: {
    fontSize: typography.sizes.fine,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  inputShell: {
    minHeight: 54,
    borderWidth: 2,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    paddingVertical: spacing.md,
  },
  actionContainer: {
    marginLeft: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.sm,
  },
});
