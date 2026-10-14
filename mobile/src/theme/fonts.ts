import * as Font from 'expo-font';
import {
  Anybody_700Bold,
  Anybody_800ExtraBold,
} from '@expo-google-fonts/anybody';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import { Platform } from 'react-native';

/**
 * The three brand faces, matching the main website (app/layout.tsx): Anybody
 * for display/headings, Hanken Grotesk for body copy, Space Grotesk for labels
 * and mono.
 *
 * THE KEYS HERE MUST MATCH `fontFamily` IN ./tokens.ts EXACTLY.
 *
 * expo-font registers one family per key, so a mismatch does not throw — it
 * silently falls back to the system font, on every screen at once. An earlier
 * revision of this file used hyphenated keys ('Anybody-Bold') while tokens.ts
 * referenced the underscored module names ('Anybody_700Bold'), which meant no
 * screen rendered in the brand faces at all. The shorthand below keeps the two
 * in step by construction: the key IS the imported binding.
 *
 * Anybody 800 is the spec's brand-display face (DESIGN_SPEC.md §3).
 *
 * Space Grotesk 600 is not optional: §3 gives the label/eyebrow role weight
 * 600, and `.label`, `.tag`, `.eyebrow`, `.chipbtn`, `.segmented` and
 * `.modelpill` all ask for it in android-shared.css. Without it every mono
 * label falls back a weight.
 */
export const fontMap = {
  Anybody_700Bold,
  Anybody_800ExtraBold,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
};

export const fallbackFonts = {
  heading: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'sans-serif',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
  mono: Platform.select({
    ios: 'Courier New',
    android: 'monospace',
    default: 'monospace',
  }),
};

export async function loadAppFonts(): Promise<boolean> {
  try {
    await Font.loadAsync(fontMap);
    return true;
  } catch (error) {
    console.warn('[fonts] Custom font loading failed, falling back to deterministic system fonts:', error);
    return false;
  }
}
