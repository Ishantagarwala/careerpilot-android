import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePalette } from '../../src/theme/ThemeContext';

/** Auth group — Language A throughout, so background and chrome are pinned. */
export default function AuthLayout() {
  const brand = usePalette('brand');

  return (
    <>
      {/* Language A is cream in both themes, so the status bar is always dark. */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: brand.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        {/* First run — design/png/09-first-run.png, reached after sign-up. */}
        <Stack.Screen name="first-run" />
      </Stack>
    </>
  );
}
