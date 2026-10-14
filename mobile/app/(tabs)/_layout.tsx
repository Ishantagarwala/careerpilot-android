import React from 'react';
import { Tabs } from 'expo-router';
import { BottomTabBar } from '../../src/components/navigation/BottomTabBar';
import { usePalette } from '../../src/theme/ThemeContext';
import { DesignLanguage } from '../../src/theme/tokens';

/**
 * Bottom navigation — exactly four visible tabs: Hub · Career · Build · Me
 * (design/DESIGN_SPEC.md §5).
 *
 * Roadmap is reached from Career and stays hidden from the bar. The legacy
 * home/learn/study paths are kept as redirects so links written before the
 * restructure keep working — none of them renders a second copy of a screen.
 *
 * The bar follows the ACTIVE ROUTE's design language, because screens.py gives
 * 04-career the brand navbar and every other tab the hub navbar. Passing a
 * single global language here is what painted a white hub bar under the cream
 * Career screen (DESIGN_SPEC.md §4: never mix the two on one screen).
 */
export default function TabsLayout() {
  const brand = usePalette('brand');
  const hub = usePalette('hub');

  return (
    <Tabs
      tabBar={(props) => {
        const active = props.state.routes[props.state.index]?.name;
        const language: DesignLanguage = active === 'career' ? 'brand' : 'hub';
        return <BottomTabBar {...props} language={language} />;
      }}
      screenOptions={{
        headerShown: false,
        /*
         * The scene behind each tab. Career is the one brand-language product
         * screen, so it gets the cream; everything else is the hub surface.
         * Reading `colors.bg` here painted a cream scene behind all four tabs.
         * Set per screen rather than here: BottomTabView reads sceneStyle from
         * the matched descriptor (`descriptor.options`), not from the config.
         */
      }}
    >
      <Tabs.Screen
        name="hub"
        options={{ title: 'Hub', sceneStyle: { backgroundColor: hub.bg } }}
      />
      <Tabs.Screen
        name="career"
        options={{ title: 'Career', sceneStyle: { backgroundColor: brand.background } }}
      />
      <Tabs.Screen
        name="build"
        options={{ title: 'Build', sceneStyle: { backgroundColor: hub.bg } }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: 'Me', sceneStyle: { backgroundColor: hub.bg } }}
      />

      {/* Hidden from the bar — the visible tab count stays at four. */}
      <Tabs.Screen name="roadmap" options={{ href: null, title: 'Roadmap' }} />
      <Tabs.Screen name="home" options={{ href: null, title: 'Me' }} />
      <Tabs.Screen name="learn" options={{ href: null, title: 'Roadmap' }} />
      <Tabs.Screen name="study" options={{ href: null, title: 'Hub' }} />
    </Tabs>
  );
}
