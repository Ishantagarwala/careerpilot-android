import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatProvider } from '@/chat/ChatProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';
import {
  BuildGlyph,
  CareerGlyph,
  HubGlyph,
  MeGlyph,
  type GlyphProps,
} from '@/components/glyphs/TabGlyphs';

/**
 * Bottom navigation — exactly four tabs, Material's maximum is five.
 *
 * Icon plus label, never icon-only (design/DESIGN_SPEC.md §5). The active state
 * is the lime pill BEHIND THE ICON ONLY plus a heavier label — the pill must
 * never reach the label text, because an indicator overlapping its own label
 * reads as a rendering bug rather than a selected state.
 */

const TABS: { name: string; label: string; Glyph: React.ComponentType<GlyphProps> }[] = [
  { name: 'hub', label: 'Hub', Glyph: HubGlyph },
  { name: 'career', label: 'Career', Glyph: CareerGlyph },
  { name: 'build', label: 'Build', Glyph: BuildGlyph },
  { name: 'me', label: 'Me', Glyph: MeGlyph },
];

export default function TabsLayout() {
  return (
    <ChatProvider>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
        tabBar={(props) => <BottomNav {...props} />}
      >
        {TABS.map((t) => (
          <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
        ))}
        {/* Reached from Career, not the bar — the visible tab count stays at 4. */}
        <Tabs.Screen name="roadmap" options={{ href: null, title: 'Roadmap' }} />
      </Tabs>
    </ChatProvider>
  );
}

function BottomNav({ state, navigation }: BottomTabBarProps) {
  const hub = useTheme('hub');
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: hub.surface,
          borderTopColor: hub.line,
          paddingBottom: Math.max(insets.bottom, space.s2),
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;

        const focused = state.index === index;
        const color = focused ? hub.text : hub.muted;

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
          >
            <View style={styles.iconBox}>
              {focused ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: hub.primary ?? '#baf600', borderRadius: radius.card },
                  ]}
                />
              ) : null}
              <tab.Glyph color={focused ? '#15171b' : color} />
            </View>
            <Text
              style={[
                styles.label,
                { color, fontFamily: focused ? fontFamily.monoBold : fontFamily.monoMedium },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1.5,
    paddingHorizontal: space.s2,
    paddingTop: space.s2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingTop: 7,
    paddingBottom: 2,
    // Material minimum touch target.
    minHeight: 56,
  },
  /** 18dp tall so the pill's -5dp inset leaves the 8dp gap clear of the label */
  iconBox: {
    width: 26,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10.5, lineHeight: 11, letterSpacing: 0.3 },
});
