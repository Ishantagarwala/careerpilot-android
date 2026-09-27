import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { brandLight, hubDark, hubLight, type BrandPalette, type HubPalette } from './tokens';

/**
 * Theme runtime.
 *
 * Two palettes coexist rather than one deriving from the other, because the
 * product genuinely runs two design languages (design/DESIGN_SPEC.md §1):
 *
 *   brand — cream/lime, used by auth and first-run
 *   hub   — near-white/near-black, used by every product surface
 *
 * A screen picks its language explicitly via `useTheme('hub')` or
 * `useTheme('brand')`. The two must never be blended.
 *
 * Only the hub language has a dark variant — the web app scopes its `.dark`
 * block to `.aihub`, and brand stays light in both themes so the auth screens
 * keep their hard-edged cream identity.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'brand' | 'hub';

export interface ThemeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** resolved scheme after applying `mode` */
  scheme: 'light' | 'dark';
  brand: BrandPalette;
  hub: HubPalette;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const MODE_STORAGE_KEY = 'careerpilot.themeMode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restore the persisted preference. Kept in SecureStore (the app's only
  // storage dependency) even though a theme choice is not a secret.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const SecureStore = await import('expo-secure-store');
        const stored = (await SecureStore.getItemAsync(MODE_STORAGE_KEY)) as ThemeMode | null;
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setModeState(stored);
        }
      } catch {
        /* keep the default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void (async () => {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(MODE_STORAGE_KEY, next);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      setMode,
      scheme,
      brand: brandLight,
      hub: scheme === 'dark' ? hubDark : hubLight,
    }),
    [mode, setMode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeValue(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Read the palette for one design language.
 *
 *   const t = useTheme('hub');     // product surfaces  -> HubPalette
 *   const t = useTheme('brand');   // auth / first-run  -> BrandPalette
 *   const t = useTheme();          // defaults to hub
 *
 * Overloaded so the caller gets the specific palette rather than a union —
 * otherwise every property access needs narrowing even though the two palettes
 * share almost no key names.
 */
export function useTheme(): HubPalette;
export function useTheme(language: 'hub'): HubPalette;
export function useTheme(language: 'brand'): BrandPalette;
export function useTheme(language: Language = 'hub'): HubPalette | BrandPalette {
  const value = useThemeValue();
  return language === 'brand' ? value.brand : value.hub;
}

/** Full theme context, for settings screens that change the mode. */
export function useThemeController(): ThemeValue {
  return useThemeValue();
}
