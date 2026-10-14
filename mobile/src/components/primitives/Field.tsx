import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { radii, spacing, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  rightAction?: React.ReactNode;
  containerStyle?: ViewStyle;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const Field: React.FC<FieldProps> = ({
  label,
  error,
  helperText,
  rightAction,
  containerStyle,
  style,
  language = 'hub',
  ...props
}) => {
  const skin = usePrimitiveSkin(language);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        style={[
          styles.label,
          {
            color: skin.language === 'brand' ? skin.text : skin.muted,
            fontFamily:
              skin.language === 'brand' ? typography.fontMonoMedium : typography.fontBodyMedium,
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: skin.surface,
            borderColor: error ? skin.danger : skin.line,
            borderWidth: skin.borderWidth,
            borderRadius: skin.language === 'brand' ? radii.sm : radii.input,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={skin.muted}
          style={[
            styles.input,
            {
              color: skin.text,
            },
            style,
          ]}
          {...props}
        />
        {rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: skin.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: skin.muted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.body,
    fontWeight: '500',
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  inputContainer: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.body,
    fontFamily: typography.fontBody,
    paddingVertical: spacing.sm,
  },

  actionContainer: {
    marginLeft: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes.fine,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: typography.sizes.fine,
    marginTop: spacing.xs,
  },
});
