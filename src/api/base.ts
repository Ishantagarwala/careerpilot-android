import Constants from 'expo-constants';

/**
 * The one place the API origin is defined.
 *
 * Split into its own module so `credentials.ts` can build auth URLs without
 * importing `client.ts`, which imports `credentials.ts` — a cycle that would
 * otherwise exist purely for one string.
 */
export const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'https://careerpilot.cc';
