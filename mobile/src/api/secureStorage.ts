import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Token storage that works on both native and web.
 *
 * `expo-secure-store` is native-only — every method throws on web, which would
 * make sign-in impossible in a browser. On web we fall back to AsyncStorage,
 * which is localStorage-backed there.
 *
 * This is a deliberate, documented downgrade rather than an oversight: a browser
 * has no OS keychain, so there is no encrypted store available to us. Tokens
 * kept this way are readable by any script on the origin, which is why native
 * builds still take the encrypted path and this file is the only place that
 * decides between them.
 */
const isWeb = Platform.OS === 'web';

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return isWeb ? await AsyncStorage.getItem(key) : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Already gone — nothing to clean up.
  }
}
