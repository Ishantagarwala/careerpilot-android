import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemeController } from '@/theme/ThemeProvider';
import { brandLight, elevation, fontFamily, radius } from '@/theme/tokens';

/**
 * Language A (brand) controls — cream, lime, 2px black borders and HARD offset
 * shadows. Used by auth and first-run only (design/DESIGN_SPEC.md §1).
 *
 * These deliberately do not read the hub palette: blending the two elevation
 * languages on one screen is what the spec forbids.
 */

const b = brandLight;

export function BrandButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.ghost,
        primary ? elevation.brand : null,
        // Pressed state shifts INTO the shadow instead of changing layout, so
        // surrounding content never jitters.
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? b.primaryForeground : b.foreground} />
      ) : (
        <Text style={[styles.buttonText, !primary && styles.ghostText]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function BrandField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoComplete,
  textContentType,
  editable = true,
  trailing,
  onSubmitEditing,
  returnKeyType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoComplete?: 'email' | 'password' | 'off';
  textContentType?: 'emailAddress' | 'password';
  editable?: boolean;
  trailing?: React.ReactNode;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'go';
}) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          focused ? styles.inputFocused : null,
          !editable ? styles.inputDisabled : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8b9179"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          accessibilityLabel={label}
          style={styles.input}
        />
        {trailing}
      </View>
    </View>
  );
}

/** Small mono text button, e.g. the password show/hide toggle. */
export function BrandTextButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // Keeps the tap target >=48dp even though the text is small.
      hitSlop={12}
      style={({ pressed }) => [pressed ? { opacity: 0.6 } : null]}
    >
      <Text style={styles.textButton}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: radius.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: { backgroundColor: b.primary },
  ghost: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  disabled: { opacity: 0.5 },
  buttonText: {
    fontFamily: fontFamily.heading,
    fontSize: 16.5,
    color: b.primaryForeground,
    letterSpacing: -0.2,
  },
  ghostText: { color: b.foreground },

  field: { marginTop: 16 },
  fieldLabel: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: b.foreground,
    marginBottom: 7,
  },
  inputShell: {
    minHeight: 54,
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.card,
    borderRadius: radius.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  inputFocused: { borderColor: b.ring },
  inputDisabled: { opacity: 0.6 },
  input: {
    flex: 1,
    fontFamily: fontFamily.sansMedium,
    fontSize: 16,
    color: b.foreground,
    paddingVertical: 12,
  },
  textButton: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: b.mutedForeground,
  },
});
