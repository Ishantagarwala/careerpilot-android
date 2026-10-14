import { DesignLanguage, radii } from '../../theme/tokens';
import { usePalette } from '../../theme/ThemeContext';

/**
 * The paint a shared primitive needs, resolved for the design language of the
 * surface it sits on (design/DESIGN_SPEC.md §1).
 *
 *   const skin = usePrimitiveSkin();                 // hub — every product surface
 *   const skin = usePrimitiveSkin('brand');          // sign-in / career (Language A)
 *
 * Language A is cream, lime and 2px pure-black keylines; Language B is
 * near-white, near-black, hairline separations, and lime only as an accent.
 * Defaulting to 'hub' is deliberate: the overwhelming majority of screens are
 * Language B, so hub surfaces get the right paint without opting in, and the
 * two brand surfaces (auth, career) opt out explicitly.
 */
export interface PrimitiveSkin {
  language: DesignLanguage;
  /** The page background behind the content. */
  screen: string;
  /** Panel / card fill. */
  surface: string;
  /** Quieter fill behind text: chips, inline notices, inset rows. */
  soft: string;
  text: string;
  muted: string;
  /** Hairline (hub) or keyline (brand) colour for borders and separators. */
  line: string;
  /** The primary ACTION fill — near-black in hub, lime in brand. */
  strong: string;
  /** Label / icon colour on `strong`. */
  onStrong: string;
  danger: string;
  onDanger: string;
  /** The one permitted accent (lime) — progress fills, completion, match tags. */
  accent: string;
  accentForeground: string;
  scrim: string;
  borderWidth: number;
  cardRadius: number;
  controlRadius: number;
  sheetRadius: number;
}

export function usePrimitiveSkin(language: DesignLanguage = 'hub'): PrimitiveSkin {
  const hub = usePalette('hub');
  const brand = usePalette('brand');

  if (language === 'brand') {
    return {
      language,
      screen: brand.background,
      surface: brand.card,
      soft: brand.muted,
      text: brand.foreground,
      muted: brand.mutedForeground,
      line: brand.border,
      strong: brand.primary, // Language A's primary action IS the lime fill
      onStrong: brand.primaryForeground,
      danger: brand.destructive,
      onDanger: brand.card,
      accent: brand.primary,
      accentForeground: brand.primaryForeground,
      scrim: 'rgba(0, 0, 0, 0.35)',
      borderWidth: 2,
      cardRadius: radii.sm,
      controlRadius: radii.sm,
      sheetRadius: radii.sm,
    };
  }

  return {
    language,
    screen: hub.bg,
    surface: hub.surface,
    soft: hub.soft,
    text: hub.text,
    muted: hub.muted,
    line: hub.line,
    strong: hub.strong,
    onStrong: hub.bg,
    danger: hub.danger,
    onDanger: hub.bg,
    accent: hub.primary,
    accentForeground: hub.primaryForeground,
    scrim: 'rgba(9, 11, 6, 0.5)', // android-shared.css .scrim
    /*
     * DESIGN_SPEC.md §4: "when a divider is needed it is 1.5px --hub-line".
     * android-shared.css agrees — .card :358, .rowline :364, .navbar :401,
     * .sheet :454 and .tag :492 are all 1.5px. At 1 this primitive family drew
     * a lighter line than ProductKit.tsx (which hardcodes 1.5), so the same
     * visual element changed weight depending on which kit a screen imported.
     */
    borderWidth: 1.5,
    cardRadius: radii.card,
    controlRadius: radii.chip,
    sheetRadius: radii.sheet,
  };
}
