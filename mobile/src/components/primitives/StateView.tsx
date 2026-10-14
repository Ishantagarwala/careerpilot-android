import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { spacing, typography } from '../../theme/tokens';
import { Button } from './Button';
import { usePrimitiveSkin } from './skin';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react-native';

/**
 * The shared loading / empty / error / offline surfaces.
 *
 * Every one of them takes the design language of the screen it is dropped onto
 * and defaults to 'hub' — the majority of surfaces. On a brand screen (sign-in,
 * career) pass language="brand" so the skeletons stay pure-black keylines on
 * cream instead of hairlines on near-white.
 */

interface LanguageProp {
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const OfflineBanner: React.FC<
  { onRetry?: () => void; style?: ViewStyle } & LanguageProp
> = ({ onRetry, style, language = 'hub' }) => {
  const skin = usePrimitiveSkin(language);

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: skin.surface,
          borderColor: skin.line,
          borderWidth: skin.borderWidth,
          borderRadius: skin.controlRadius,
        },
        style,
      ]}
    >
      <View style={styles.bannerRow}>
        <WifiOff size={16} color={skin.muted} />
        <Text style={[styles.bannerText, { color: skin.muted }]}>
          Offline · showing saved data
        </Text>
      </View>
      {onRetry && (
        <Button
          label="Retry"
          variant="text"
          language={language}
          onPress={onRetry}
          style={styles.bannerButton}
          textStyle={{ fontSize: typography.sizes.xs }}
        />
      )}
    </View>
  );
};

export const ErrorStateView: React.FC<
  {
    eyebrow?: string;
    title?: string;
    message?: string;
    onRetry?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    style?: ViewStyle;
  } & LanguageProp
> = ({
  eyebrow = 'COULD NOT LOAD YOUR DATA',
  title = "Let's try that again.",
  message = 'Your saved progress has not been changed. Try again when the connection is ready.',
  onRetry,
  secondaryLabel,
  onSecondary,
  style,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  return (
    <View style={[styles.stateContainer, style]}>
      <AlertCircle size={44} color={skin.danger} style={{ marginBottom: spacing.md }} />
      <Text style={[styles.eyebrow, { color: skin.muted }]}>{eyebrow}</Text>
      <Text style={[styles.heading, { color: skin.text }]}>{title}</Text>
      <Text style={[styles.message, { color: skin.muted }]}>{message}</Text>
      <View style={styles.actionRow}>
        {onRetry && (
          <Button
            label="Retry"
            variant="primary"
            language={language}
            icon={<RefreshCw size={16} color={skin.onStrong} />}
            onPress={onRetry}
            style={{ minWidth: 140 }}
          />
        )}
        {secondaryLabel && onSecondary && (
          <Button
            label={secondaryLabel}
            variant="secondary"
            language={language}
            onPress={onSecondary}
            style={{ minWidth: 140 }}
          />
        )}
      </View>
    </View>
  );
};

export const LoadingStateView: React.FC<{ message?: string; style?: ViewStyle } & LanguageProp> = ({
  message = 'Loading your saved progress…',
  style,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  return (
    <View style={[styles.stateContainer, style]}>
      <Text style={[styles.eyebrow, { color: skin.muted, alignSelf: 'flex-start' }]}>
        YOUR LEARNING JOURNEY
      </Text>
      {/* Skeleton bars are a quiet fill, never a keyline. */}
      <View
        style={[
          styles.skeleton,
          styles.skelTitle,
          { backgroundColor: skin.soft, borderRadius: skin.controlRadius },
        ]}
      />
      <View
        style={[
          styles.skeleton,
          styles.skelText,
          { backgroundColor: skin.soft, borderRadius: skin.controlRadius },
        ]}
      />
      <View
        style={[
          styles.skeleton,
          styles.skelCard,
          {
            backgroundColor: skin.surface,
            borderColor: skin.line,
            borderWidth: skin.borderWidth,
            borderRadius: skin.cardRadius,
          },
        ]}
      />
      <View
        style={[
          styles.skeleton,
          styles.skelCard,
          {
            backgroundColor: skin.surface,
            borderColor: skin.line,
            borderWidth: skin.borderWidth,
            borderRadius: skin.cardRadius,
          },
        ]}
      />
      <Text style={[styles.fineMessage, { color: skin.muted }]}>{message}</Text>
    </View>
  );
};

export const EmptyStateView: React.FC<
  {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
  } & LanguageProp
> = ({ icon, title, description, message, actionLabel, onAction, style, language = 'hub' }) => {
  const skin = usePrimitiveSkin(language);
  const descText = description || message || '';

  return (
    <View
      style={[
        styles.emptyContainer,
        {
          backgroundColor: skin.surface,
          borderColor: skin.line,
          borderWidth: skin.borderWidth,
          borderRadius: skin.cardRadius,
        },
        style,
      ]}
    >
      {icon && <View style={{ marginBottom: spacing.md }}>{icon}</View>}
      <Text style={[styles.emptyTitle, { color: skin.text }]}>{title}</Text>
      {descText ? <Text style={[styles.emptyDesc, { color: skin.muted }]}>{descText}</Text> : null}
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          language={language}
          onPress={onAction}
          style={{ marginTop: spacing.md }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fontBodyMedium,
    fontWeight: '500',
  },
  bannerButton: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  eyebrow: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fontMonoMedium,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: typography.sizes.title,
    fontFamily: typography.fontHeading,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.sizes.body,
    fontFamily: typography.fontBody,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  actionRow: {
    flexDirection: 'column',
    gap: spacing.sm,
    width: '100%',
    alignItems: 'stretch',
  },
  skeleton: {
    width: '100%',
    marginVertical: spacing.xs,
  },
  skelTitle: {
    height: 32,
    width: '70%',
    alignSelf: 'flex-start',
  },
  skelText: {
    height: 18,
    width: '50%',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  skelCard: {
    height: 140,
  },
  fineMessage: {
    fontSize: typography.sizes.fine,
    fontFamily: typography.fontBody,
    marginTop: spacing.md,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.subheading,
    fontFamily: typography.fontHeadingMedium,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: typography.sizes.body,
    fontFamily: typography.fontBody,
    textAlign: 'center',
  },
});