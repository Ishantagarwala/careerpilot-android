import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { loadAppFonts } from '../src/theme/fonts';
import { brandLight } from '../src/theme/tokens';
import { LoadingStateView } from '../src/components/primitives/StateView';

import { FocusProvider } from '../src/context/FocusContext';

function RootNavigator() {
  const { isDark, hub } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: hub.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        {/*
          * The (auth) group is the one place Language A is used, and Language A
          * is cream in BOTH themes. Without pinning it here the root Stack's hub
          * contentStyle shows through behind the auth stack during transitions.
          */}
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: brandLight.background },
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadAppFonts()
      .then(() => setFontsLoaded(true))
      .catch(() => setFontsLoaded(true)); // deterministic fallback to system fonts
  }, []);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <LoadingStateView message="Initializing Career Pilot..." />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FocusProvider>
            <RootNavigator />
          </FocusProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
