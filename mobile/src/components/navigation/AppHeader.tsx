import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { DesignLanguage, spacing, targetSizes, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from '../primitives/skin';

interface AppHeaderProps {
  title?: string;
  /**
   * Optional context line under the title — android-shared.css `.appbar .sub`
   * (:143): 12-13px / 500 / --hub-muted, margin-top 3px. Three mockups use it
   * (02-hub-chat "DBMS · Unit 3", 05-roadmap "Full Stack Developer",
   * 10-dark-offline). Before this prop existed, Roadmap re-built the whole app
   * bar by hand just to get a subtitle.
   */
  subtitle?: string;
  isRoot?: boolean;
  hideLeading?: boolean;
  hideProfile?: boolean;
  /**
   * A leading control, used instead of the back arrow. The Hub's app bar wants
   * a hamburger that opens the threads drawer (screens.py:111, :167, :674).
   * Mutually exclusive with `isRoot`'s "no leading button" rule: pass one or
   * the other.
   */
  leading?: React.ReactNode;
  /**
   * A trailing action, replacing the profile avatar. The mockups carry at most
   * one — 04-career a mic, 06-build-resume a plus, 07-build-jobs a search,
   * 08-me a circle — drawn as `.iconbtn.ghost-line` (css:144-148): 44dp,
   * fully round, 1.5px --hub-line.
   */
  trailing?: React.ReactNode;
  trailingLabel?: string;
  onTrailingPress?: () => void;
  /**
   * Trailing content rendered AS-IS, with no 44dp circle wrapper. `trailing`
   * is for an icon that the bar should ring; this is for a control that brings
   * its own shape and size — the Hub's 34px model pill (css:283-288), which a
   * 44dp circular wrapper clips.
   */
  trailingSlot?: React.ReactNode;
  onBackPress?: () => void;
  /**
   * Draw a hairline under the bar. Off by default: android-shared.css `.appbar`
   * (:137-140) has no border, and the rendered mockups confirm it — sampling
   * 02-hub-chat and 04-career between the bar and the first content row finds
   * no rule, only the page colour. The bar separates by spacing instead.
   */
  divider?: boolean;
  /**
   * Which design language the header is painted in. Defaults to 'hub' — the
   * near-white product surface every drill-down screen speaks. `'brand'` is
   * for the one cream product screen (04-career).
   */
  language?: DesignLanguage;
}

/**
 * The app bar — android-shared.css `.appbar` (:137-148).
 *
 *   .appbar      padding: 8px 16px 12px; gap: 12px
 *   .appbar h1   25px / 700 / 1.1 / -.02em        (screen title)
 *                `style="font-size:19px"` inline  (drill-down, screens.py:113)
 *   .appbar .sub 12-13px / 500 / --hub-muted / margin-top 3px
 *   .iconbtn     44x44, border-radius: 50%
 *
 * The title used to be hardcoded at 18px with no line-height, which is below
 * both the 19–20 app-bar band and the 25px screen-title token in
 * DESIGN_SPEC.md §3. The screens that rolled their own bar (build, me, career,
 * roadmap) were closer to the contract than this shared component.
 *
 * The auth screens use BrandHeader instead, so no hub hairline ever lands on
 * the cream brand surface.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'Career Pilot',
  subtitle,
  isRoot = false,
  hideLeading = false,
  hideProfile = false,
  leading,
  trailing,
  trailingLabel,
  onTrailingPress,
  trailingSlot,
  onBackPress,
  divider = false,
  language = 'hub',
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const skin = usePrimitiveSkin(language);
  const { user, isAuthenticated } = useAuth();

  /*
   * Root screens show NO leading button. There is no drawer any more — the four
   * bottom tabs are the navigation — so a hamburger would open nothing. Only
   * drill-down screens carry the back arrow (DESIGN_SPEC.md §5).
   */
  const showBack = !isRoot && !hideLeading;

  const handleLeadingPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleProfilePress = () => {
    router.push('/profile' as any);
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  // A drill-down bar drops to 19-20px to make room for the subtitle
  // (screens.py:113, :168, :302, :675).
  const isDrillDown = showBack || !!subtitle;
  const showLeading = !!leading || showBack;
  const showTrailingAvatar = !hideProfile && isAuthenticated && !trailing;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, spacing.sm),
          backgroundColor: skin.screen,
          borderBottomColor: skin.line,
          borderBottomWidth: divider ? skin.borderWidth : 0,
        },
      ]}
    >
      <View
        style={[
          styles.content,
          {
            // css:139 — .appbar padding: 8px 16px 12px. The leading control is
            // 44dp with its own visual inset, so the gutter still reads as 16.
            paddingLeft: showLeading ? spacing.sm : spacing.base,
            paddingRight: spacing.base,
          },
        ]}
      >
        {/* Leading control — an explicit one wins, else the back arrow on
            drill-down screens. */}
        {leading ? (
          leading
        ) : showBack ? (
          <Pressable
            onPress={handleLeadingPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            // 44dp glyph button + 8dp hitSlop = 60dp target (DESIGN_SPEC.md §4).
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ArrowLeft size={targetSizes.iconSizeLarge} color={skin.text} />
          </Pressable>
        ) : null}

        {/* Title, with the optional context subtitle */}
        <View style={styles.titleContainer}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              isDrillDown && styles.titleDrillDown,
              { color: skin.text, fontFamily: typography.fontHeading },
            ]}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text
              numberOfLines={1}
              style={[
                styles.subtitle,
                { color: skin.muted, fontFamily: typography.fontBodyMedium },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* At most one trailing action (DESIGN_SPEC.md §5). */}
        {trailingSlot ? (
          <View style={styles.trailingSlot}>{trailingSlot}</View>
        ) : trailing ? (
          <Pressable
            onPress={onTrailingPress}
            accessibilityRole="button"
            accessibilityLabel={trailingLabel ?? 'Action'}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              styles.trailingRing,
              {
                borderColor: skin.line,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {trailing}
          </Pressable>
        ) : showTrailingAvatar ? (
          <Pressable
            onPress={handleProfilePress}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            // §4: minimum 48x48dp. A 36dp avatar needs 6dp of slop all round.
            hitSlop={6}
            style={({ pressed }) => [
              styles.avatarButton,
              {
                backgroundColor: skin.soft,
                borderColor: skin.line,
                borderWidth: skin.borderWidth,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: skin.text, fontFamily: typography.fontMonoBold },
              ]}
            >
              {userInitial}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // The hairline is applied inline from the skin (1.5px hub / 2px brand).
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    // css:139 — .appbar padding: 8px 16px 12px
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
    minHeight: 44 + spacing.sm + spacing.md,
  },
  iconButton: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** css:144-148 — .iconbtn.ghost-line: 44dp circle on a 1.5px hub.line ring. */
  trailingRing: {
    borderRadius: targetSizes.iconTouch / 2,
    borderWidth: 1.5,
  },
  /** A self-sized trailing control (the Hub's model pill). */
  trailingSlot: {
    flexShrink: 0,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    // §3 screen title: 25 / 1.1 / 700
    fontSize: typography.sizes.title,
    lineHeight: typography.sizes.title * typography.lineHeights.title,
    letterSpacing: -0.5, // -.02em at 25px
  },
  titleDrillDown: {
    // §3 app-bar title: 19-20 / 1.15 / 700
    fontSize: typography.sizes.appbar,
    lineHeight: typography.sizes.appbar * typography.lineHeights.appbar,
    letterSpacing: -0.32,
  },
  subtitle: {
    // css:143 — .appbar .sub
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.meta,
    marginTop: 3,
  },
  avatarButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  avatarText: {
    fontSize: typography.sizes.body,
  },
});
