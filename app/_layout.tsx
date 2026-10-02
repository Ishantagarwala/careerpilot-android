import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthProvider';
import { ChatProvider } from '@/chat/ChatProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { fontAssets } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden */
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    // Hide on error too — a font failure must not strand the splash screen.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            {/*
             * Chat state lives above the root Stack, NOT inside the tabs layout.
             * /threads is a sibling of (tabs) and calls useChat(); a provider
             * mounted by the tabs layout left that screen throwing
             * "useChat must be used inside <ChatProvider>" on mount, which made
             * the whole threads feature unreachable. Sitting here also means a
             * streamed reply survives any navigation.
             */}
            <ChatProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                <Stack.Screen name="first-run" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                <Stack.Screen name="threads" options={{ animation: 'slide_from_left' }} />
                <Stack.Screen
                  name="assessment"
                  options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
                />
              </Stack>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
