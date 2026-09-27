import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, touch } from '@/theme/tokens';

/** Circular icon button — always >=44dp, with an accessibility label. */
export function IconButton({
  onPress,
  label,
  children,
  bordered = false,
  style,
}: {
  onPress?: () => void;
  label: string;
  children: React.ReactNode;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const hub = useTheme('hub');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={touch.gap}
      style={({ pressed }) => [
        styles.iconButton,
        bordered ? { borderWidth: 1.5, borderColor: hub.line } : null,
        pressed ? { opacity: 0.55 } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Composer shell — the Hub's primary input.
 *
 * Matches design/png/02-hub-chat.png: 22px radius, hairline border, soft
 * shadow. The send button is `--hub-strong` (near-black) and deliberately NOT
 * lime; the web app keeps lime out of the hub's primary action and the app
 * matches it (DESIGN_SPEC.md §1).
 */
export function ComposerShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const hub = useTheme('hub');

  return (
    <View
      style={[
        styles.composerShell,
        { backgroundColor: hub.surface, borderColor: hub.composerLine },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Small mono pill used for context chips and the model picker. */
export function Chip({
  label,
  leading,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  leading?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const hub = useTheme('hub');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: hub.line },
        pressed && onPress ? { opacity: 0.6 } : null,
      ]}
    >
      {leading}
      <Text style={[styles.chipText, { color: hub.muted }]}>{label}</Text>
    </Pressable>
  );
}

/** Circular send action. Disabled state is muted, never hidden. */
export function SendButton({
  onPress,
  disabled = false,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const hub = useTheme('hub');

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.send,
        {
          backgroundColor: disabled ? hub.soft : hub.strong,
        },
        pressed && !disabled ? { opacity: 0.8 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: touch.iconButton,
    height: touch.iconButton,
    borderRadius: touch.iconButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerShell: {
    borderWidth: 1.5,
    borderRadius: radius.composer,
    paddingLeft: space.s4,
    paddingRight: space.s3,
    paddingVertical: space.s3,
  },
  chip: {
    height: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chipText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
