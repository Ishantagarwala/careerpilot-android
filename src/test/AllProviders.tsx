import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

/**
 * Test wrapper.
 *
 * Every screen in this app assumes three providers above it. Missing one does
 * not degrade gracefully — `useTheme`, `useAuth` and `useSafeAreaInsets` all
 * throw — so a screen cannot be rendered in isolation.
 *
 * `initialMetrics` matters: without it SafeAreaProvider measures asynchronously
 * and every screen throws "No safe area value available" on first render, which
 * is a harness artefact rather than an app bug. These are Pixel-ish insets so
 * layout assertions stay stable.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 915 },
  insets: { top: 44, left: 0, right: 0, bottom: 24 },
};

export function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
