import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token storage.
 *
 * Android: `expo-secure-store` is backed by the Android Keystore. Tokens must
 * NEVER go to AsyncStorage and never be logged.
 *
 * Web has no `expo-secure-store` implementation. The fallbacks exist only so
 * `expo start --web` does not crash during development; web is not a supported
 * target and nothing is actually persisted there.
 */

const ACCESS_TOKEN_KEY = 'careerpilot.accessToken';
const REFRESH_TOKEN_KEY = 'careerpilot.refreshToken';
const SESSION_COOKIE_KEY = 'careerpilot.sessionCookie';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string | null): Promise<void> {
  if (isWeb) return;
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return null;
  return SecureStore.getItemAsync(key);
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
    setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function saveSessionCookie(cookie: string | null): Promise<void> {
  await setItem(SESSION_COOKIE_KEY, cookie);
}

export async function loadSessionCookie(): Promise<string | null> {
  return getItem(SESSION_COOKIE_KEY);
}

/** Wipe every credential. Used by sign-out and by failed refresh. */
export async function clearAllCredentials(): Promise<void> {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, null),
    setItem(REFRESH_TOKEN_KEY, null),
    setItem(SESSION_COOKIE_KEY, null),
  ]);
}
