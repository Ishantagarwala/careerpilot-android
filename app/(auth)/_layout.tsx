import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { brandLight } from '@/theme/tokens';

/** Auth group — Language A throughout, so header and background are pinned. */
export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: brandLight.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
