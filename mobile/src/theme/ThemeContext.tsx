import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  brandDark,
  BrandPalette,
  brandLight,
  ColorTokens,
  darkTokens,
  DesignLanguage,
  hubDark,
  hubLight,
  HubPalette,
  lightTokens,
  ThemeMode,
} from './tokens';

interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeMode;
  isDark: boolean;
  /** Language B (hub) under the legacy names — see tokens.ts. */
  colors: ColorTokens;
  /** The active hub palette, under its own token names. */
  hub: HubPalette;
  /** Language A — cream on light, olive-black on dark. */
  brand: BrandPalette;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const THEME_STORAGE_KEY = '@careerpilot_theme_mode';

/*
 * Light is the default, matching the main website (app/layout.tsx sets
 * defaultTheme="light" on next-themes).
 *
 * The product surfaces speak Language B, so that is what `colors` carries. The
 * brand palette is exposed separately for the auth, first-run and Career
 * screens, which are the only places Language A belongs (DESIGN_SPEC.md §1).
 */
const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  theme: 'light',
  isDark: false,
  colors: lightTokens,
  hub: hubLight,
  brand: brandLight,
  setThemeMode: async () => {},
  setTheme: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'dark' || saved === 'light' || saved === 'system')) {
          setMode(saved as ThemeMode);
        }
      } catch (err) {
        console.error('Failed to load theme preference:', err);
      }
    })();
  }, []);

  const setThemeMode = async (newMode: ThemeMode) => {
    setMode(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (err) {
      console.error('Failed to persist theme mode:', err);
    }
  };

  const isDark = mode === 'system' ? systemColorScheme !== 'light' : mode === 'dark';
  const colors = isDark ? darkTokens : lightTokens;
  const hub = isDark ? hubDark : hubLight;
  // Language A now has its own dark ground, so the Career tab follows Dark/Auto
  // like every other surface instead of staying cream.
  const brand = isDark ? brandDark : brandLight;

  return (
    <ThemeContext.Provider
      value={{
        mode,
        theme: mode,
        isDark,
        colors,
        hub,
        brand,
        setThemeMode,
        setTheme: setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

/** The legacy accessor: Language B under the names the existing screens use. */
export const useTheme = () => useContext(ThemeContext);

/**
 * Selects a design language explicitly, for surfaces that need to declare
 * which one they speak.
 *
 *   const brand = usePalette('brand');   // sign-in, first-run, career
 *   const hub   = usePalette('hub');     // every other product surface
 *
 * Both languages follow the Light/Dark/Auto setting. DESIGN_SPEC.md §1 only
 * documents a dark variant for the hub (the mockups only draw one), but
 * Language A is a real product surface — the Career tab — so leaving it cream
 * made "Dark" look broken there. `brandDark` keeps Language A's signature
 * (lime action, hard keyline, hard offset shadow) and only flips the
 * surface/text polarity.
 */
export function usePalette(language: 'brand'): BrandPalette;
export function usePalette(language: 'hub'): HubPalette;
export function usePalette(language: DesignLanguage): BrandPalette | HubPalette {
  const ctx = useContext(ThemeContext);
  return language === 'brand' ? ctx.brand : ctx.hub;
}
