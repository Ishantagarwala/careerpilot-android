import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Keyboard, Platform } from 'react-native';
import { Tabs } from 'expo-router';

export type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuildGlyph, CareerGlyph, HubGlyph, MeGlyph } from './TabGlyphs';
import { useTheme } from '../../theme/ThemeContext';
import { DesignLanguage, radii, spacing, targetSizes, typography } from '../../theme/tokens';
import { usePrimitiveSkin } from '../primitives/skin';

/**
 * Bottom navigation — exactly four tabs: Hub · Career · Build · Me
 * (design/DESIGN_SPEC.md §5). Material's maximum is five; four is the spec.
 *
 * Icon plus label, never icon-only. The active state is the lime pill BEHIND
 * THE ICON ONLY plus a heavier label weight — the pill must never reach or
 * overlap the label, because an indicator sitting on its own text reads as a
 * rendering bug rather than a selected state. The 8dp gap in `tab` keeps the
 * pill clear of the label at every font scale.
 *
 * TWO LANGUAGES (DESIGN_SPEC.md §1, §4 "never mix the two on one screen").
 * android-shared.css draws both:
 *
 *   .navbar        :401-418  hub.surface #ffffff, 1.5px hub.line top border
 *   .navbar.brand  :419-420  --background #f4f6e8, 2px solid #000 top border
 *
 * screens.py uses `navbar(..., brand=True)` for 04-career only, so the Career
 * tab asks for `language="brand"`. Before this prop existed the bar was
 * hardwired to Language B and painted a white hub bar under the cream Career
 * screen — two languages blended on one screen, which §9 fails.
 *
 * The pill is lime in both languages (css:415 and css:420).
 */
const TAB_CONFIG = [
  {
    name: 'hub',
    label: 'Hub',
    icon: HubGlyph,
  },
  {
    name: 'career',
    label: 'Career',
    icon: CareerGlyph,
  },
  {
    name: 'build',
    label: 'Build',
    icon: BuildGlyph,
  },
  {
    name: 'me',
    label: 'Me',
    icon: MeGlyph,
  },
];

export const BottomTabBar: React.FC<BottomTabBarProps & { language?: DesignLanguage }> = ({
  state,
  navigation,
  language = 'hub',
}) => {
  const { colors, hub } = useTheme();
  const skin = usePrimitiveSkin(language);
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Hide tab bar when keyboard is up to follow companion focus-mode rule
  if (isKeyboardVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: skin.screen, // hub.surface, or cream for brand
          borderTopColor: skin.line, // hub.line, or #000
          // .navbar :401 = 1.5px; .navbar.brand :419 = 2px solid #000
          borderTopWidth: language === 'brand' ? 2 : 1.5,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
      accessibilityRole="tablist"
    >
      {TAB_CONFIG.map((config) => {
        const route = state.routes.find((r) => r.name === config.name);
        if (!route) return null;

        const isFocused = state.routes[state.index]?.key === route.key;
        const IconComponent = config.icon;
        const labelColor = isFocused ? skin.text : skin.muted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={`${config.label} tab`}
            style={({ pressed }) => [
              styles.tab,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={styles.iconBox}>
              {isFocused && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    // .navbar .tab.on .pill :415-416 — radius 14, not a full
                    // stadium: the pill is 48x28 and the mockup squares it off.
                    { backgroundColor: colors.lime, borderRadius: 14, zIndex: 0 },
                  ]}
                />
              )}
              {/*
                * The glyph MUST sit above the pill (css:411-417 gives the pill
                * z-index 0 and lifts the glyph to 1).
                *
                * Without an explicit zIndex the glyph rendered in document
                * order but the absolutely-positioned pill still painted over
                * it — `document.elementFromPoint` at the icon's centre returned
                * the pill view, not the SVG — so the active tab showed a blank
                * lime lozenge with no icon. Every active tab was affected.
                */}
              <View style={styles.glyphLayer} pointerEvents="none">
                <IconComponent
                  size={targetSizes.iconSize}
                  // css:410 — the focused tab inherits --hub-text on the lime
                  // pill, not --primary-foreground.
                  color={isFocused ? skin.text : labelColor}
                />
              </View>
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: labelColor,
                  // .navbar .tab span :408 — Space Grotesk, 600 off / 700 on.
                  fontWeight: isFocused ? '700' : '600',
                },
              ]}
            >
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    // Material minimum touch target.
    minHeight: 56,
    paddingTop: 7, // css:405 — .navbar .tab padding: 7px 0 2px
    paddingBottom: spacing.xxs,
    // Keeps the lime pill clear of the label — css:404 .tab { gap: 8px }
    gap: spacing.sm,
  },
  /**
   * 26x18 in the mockup (css:406), grown to 48x28 so the pill — which is
   * `inset: -5px -11px` of this box (css:415) — is a comfortable target and
   * still never reaches the label below it.
   */
  iconBox: {
    width: 48,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** z-index 1 so the glyph is never covered by the pill beneath it. */
  glyphLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabLabel: {
    // No fixed lineHeight: the label must not clip at 200% font scale.
    // css:408 — Space Grotesk 10.5px. Left at the 11px floor of §3: "never
    // below 11px" outranks the mockup's 10.5 here.
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.33, // css:409 letter-spacing: .03em at 11px
  },
});
