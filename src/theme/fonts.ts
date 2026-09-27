import {
  Anybody_700Bold,
  Anybody_800ExtraBold,
} from '@expo-google-fonts/anybody';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/**
 * The three brand faces, loaded via `useFonts`.
 *
 * The key names here MUST match `fontFamily` in ./tokens.ts — that map is what
 * every style references, so a typo shows up as a silent fallback to the
 * system font rather than an error.
 */
export const fontAssets = {
  Anybody_700Bold,
  Anybody_800ExtraBold,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} as const;
