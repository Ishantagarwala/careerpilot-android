import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Entry gate.
 *
 * Routing is credential-driven, not path-driven: every launch resolves the
 * stored session first, so a signed-in user never sees the sign-in screen flash.
 */
export default function Index() {
  const { status, hasOnboarded } = useAuth();
  const hub = useTheme('hub');

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: hub.bg }}>
        <ActivityIndicator color={hub.strong} />
      </View>
    );
  }

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (!hasOnboarded) return <Redirect href="/first-run" />;
  return <Redirect href="/(tabs)/hub" />;
}
