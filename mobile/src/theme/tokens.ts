export type ThemeMode = 'dark' | 'light' | 'system';

/** Which of the two design languages a surface belongs to. */
export type DesignLanguage = 'brand' | 'hub';

/* ===========================================================================
 * Language A — Brand  (web: app/globals.css `:root`)
 *
 * Cream, lime, hard black borders, hard offset shadows. Auth and first-run
 * only — where the brand introduces itself. Reproduced from
 * careerpilot-android/src/theme/tokens.ts and design/DESIGN_SPEC.md §1.
 * ========================================================================= */
export const brandLight = {
  background: '#f4f6e8',
  foreground: '#151f00',
  card: '#ffffff',
  cardForeground: '#151f00',
  primary: '#baf600', // lime — an action, never a surface
  primaryForeground: '#151f00',
  secondary: '#0043eb', // electric
  secondaryForeground: '#dde1ff',
  muted: '#e8ecd6',
  mutedForeground: '#434933',
  accent: '#00f0ff', // cyan
  accentForeground: '#000000',
  destructive: '#ba1a1a',
  border: '#000000',
  ring: '#4c6700',
  limeDim: '#a3d800',
} as const;

/* ===========================================================================
 * Language A, dark.
 *
 * DESIGN_SPEC.md §1 only documents a dark variant for the hub, because the
 * mockups only draw one (10-dark-offline). But the app ships a Light/Dark/Auto
 * control on Me, and Language A is a real product surface — the Career tab —
 * so leaving it cream made "Dark" look broken on that tab.
 *
 * This keeps Language A'S OWN signature rather than borrowing the hub's: the
 * dark olive-black surface, the lime action, the hard keyline and the hard
 * offset shadow all survive. Only the surface/text polarity flips, which is
 * what dark mode means here.
 *
 * `border` is the one value that cannot stay #000 — a black keyline is
 * invisible on a #12150a surface, and the keyline is the whole point of the
 * language. It becomes a warm olive-grey that reads as the same drawn edge.
 * `card` sits ABOVE the background (#1b1f12 vs #12150a) so cards still lift,
 * and the hard shadow becomes a true black, which reads on a dark ground.
 * ========================================================================= */
export const brandDark = {
  background: '#12150a',
  foreground: '#f0f4e0',
  card: '#1b1f12',
  cardForeground: '#f0f4e0',
  primary: '#baf600',
  primaryForeground: '#151f00',
  secondary: '#6b8cff',
  secondaryForeground: '#0a0f24',
  muted: '#262b18',
  mutedForeground: '#b6bfa0',
  accent: '#00f0ff',
  accentForeground: '#000000',
  destructive: '#ff6b6b',
  border: '#5c6448',
  ring: '#a3d800',
  limeDim: '#8fbf00',
} as const;

/* ===========================================================================
 * Language B — Hub  (web: app/globals.css `.aihub`)
 *
 * Near-white, near-black, quiet. Every product surface: chat, career, roadmap,
 * resume, jobs, profile. Lime appears ONLY as a small accent — the active tab
 * indicator, progress fills, completion state, the reply identity mark, match
 * tags. Never a surface, never body text.
 * ========================================================================= */
export const hubLight = {
  bg: '#f7f8fa',
  surface: '#ffffff',
  raised: '#fbfbfc',
  text: '#15171b',
  /** 4.8:1 on white — chosen for 11-13px labels, must clear WCAG AA */
  muted: '#6b7280',
  line: '#e6e8ee',
  soft: '#eceef2',
  softHover: '#e4e6ec',
  strong: '#050505', // primary action — deliberately NOT lime
  strongHover: '#1a1a1a',
  composerLine: '#e6e8ee',
  composerHover: '#d8dae2',
  danger: '#dc2626',
  primary: '#baf600',
  primaryForeground: '#151f00',
} as const;

export const hubDark = {
  bg: '#0f1115',
  surface: '#16181d',
  raised: '#1a1d23',
  text: '#e1e5cf',
  muted: '#9198a4',
  line: '#262a32',
  soft: '#1e2128',
  softHover: '#252932',
  strong: '#f2f3f5',
  strongHover: '#ffffff',
  composerLine: '#262a32',
  composerHover: '#333846',
  danger: '#ffb4ab',
  /** Lime is unchanged in dark — it reads as an accent on both surfaces. */
  primary: '#baf600',
  primaryForeground: '#151f00',
} as const;

/** Widened to `string` so the two palettes are interchangeable by theme. */
export interface HubPalette {
  bg: string;
  surface: string;
  raised: string;
  text: string;
  muted: string;
  line: string;
  soft: string;
  softHover: string;
  strong: string;
  strongHover: string;
  composerLine: string;
  composerHover: string;
  danger: string;
  primary: string;
  primaryForeground: string;
}

/** Widened to `string` so the light and dark brand palettes interchange. */
export interface BrandPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  ring: string;
  limeDim: string;
}

/* ===========================================================================
 * Legacy token names — an alias for Language B, kept so the screens that
 * already read `useTheme().colors` keep working.
 *
 *   bg/fg/card/muted/border  -> the hub neutrals
 *   primary/onPrimary        -> hub.strong — the hub's primary action is
 *                               near-black, NOT lime (DESIGN_SPEC.md §1)
 *   accent                   -> hub.soft, because Chip/tag styles paint it
 *                               BEHIND text drawn in `fg`; the brand's cyan
 *                               would make that text unreadable
 *   lime/limeFg              -> the one accent this language allows
 *
 * Language A screens must NOT read this alias — it is Language B in both
 * themes by construction. Use `usePalette('brand')` instead, which is cream in
 * both (see the note above `darkTokens`).
 * ========================================================================= */
export interface ColorTokens {
  bg: string;
  fg: string;
  card: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  muted: string;
  border: string;
  accent: string;
  error: string;
  drawer: string;
  scrim: string;
  surfaceMuted: string;
  /** Language B's single permitted accent — active tab pill, progress, match tags. */
  lime: string;
  limeFg: string;
}

/*
 * The two design languages are NOT two theme modes.
 *
 * design/screens.py assigns a language per SCREEN, not per theme:
 *
 *   brand  (cream #f4f6e8)  01-sign-in · 04-career · 09-first-run
 *   hub    (near-white)     every other screen
 *   dark   (hub only)       10-dark-offline — screens.py:748 "only the hub
 *                           language has a dark theme (--hub tokens)"
 *
 * Language A has no dark variant, so `lightTokens`/`darkTokens` are Language B
 * in both modes — that is what `colors` has always meant to its consumers.
 * Language A is reached explicitly with `usePalette('brand')` (or
 * `usePrimitiveSkin('brand')`), and stays cream in both modes.
 *
 * This matters for contrast, not just tidiness. The previous version of
 * `darkTokens` paired Language B's dark surface with Language A's foreground:
 *
 *   fg #151f00 on bg #111508 = 1.08:1     fg #151f00 on card #16181d = 1.04:1
 *
 * Both are far below the 4.5:1 floor in DESIGN_SPEC.md §7, and `colors.fg` is
 * read on 41 sites — dark mode rendered near-black text on a near-black page.
 * Language B's own pairing is correct by construction, so the safest way to
 * keep it correct is to stop maintaining a second copy of it.
 */
export const darkTokens: ColorTokens = {
  bg: hubDark.bg, // #0f1115
  fg: hubDark.text, // #e1e5cf — 14.68:1 on bg, 13.79:1 on card
  card: hubDark.surface, // #16181d
  primary: hubDark.strong, // near-white: Language B's action is never lime
  onPrimary: hubDark.bg,
  secondary: hubDark.softHover,
  muted: hubDark.muted, // #9198a4 — 6.51:1 on bg, 6.12:1 on card
  border: hubDark.line, // #262a32
  accent: hubDark.soft, // sits BEHIND text drawn in `fg`
  error: hubDark.danger,
  drawer: hubDark.surface,
  scrim: 'rgba(9, 11, 6, 0.5)', // android-shared.css .scrim
  surfaceMuted: hubDark.raised,
  lime: hubDark.primary,
  limeFg: hubDark.primaryForeground,
};

export const lightTokens: ColorTokens = {
  bg: hubLight.bg, // #f7f8fa — the product surface
  fg: hubLight.text, // #15171b
  card: hubLight.surface, // #ffffff
  primary: hubLight.strong, // #050505 — never lime (DESIGN_SPEC.md §1 note)
  onPrimary: hubLight.surface,
  secondary: hubLight.softHover,
  muted: hubLight.muted, // #6b7280 — 4.83:1 on white
  border: hubLight.line, // #e6e8ee — the hairline, 1.5px
  accent: hubLight.soft, // sits BEHIND text drawn in `fg`
  error: hubLight.danger,
  drawer: hubLight.surface,
  scrim: 'rgba(9, 11, 6, 0.5)',
  surfaceMuted: hubLight.soft,
  lime: hubLight.primary,
  limeFg: hubLight.primaryForeground,
};

/* ===========================================================================
 * Geometry — strict 4/8dp rhythm (DESIGN_SPEC.md §4)
 * ========================================================================= */
export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  card: 14,
  chip: 12,
  input: 12,
  composer: 22,
  sheet: 26,
  full: 9999,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

/* ===========================================================================
 * Type — Hanken Grotesk (body) · Space Grotesk (labels) · Anybody (headings)
 * Nothing below 11px; body never below 14px (DESIGN_SPEC.md §3).
 * ========================================================================= */
export const typography = {
  fontHeading: 'Anybody_700Bold',
  fontHeadingExtraBold: 'Anybody_800ExtraBold',
  fontHeadingMedium: 'Anybody_700Bold',
  fontBody: 'HankenGrotesk_400Regular',
  fontBodyMedium: 'HankenGrotesk_500Medium',
  fontBodyBold: 'HankenGrotesk_600SemiBold',
  fontMono: 'SpaceGrotesk_400Regular',
  fontMonoMedium: 'SpaceGrotesk_500Medium',
  /**
   * Labels, tags and eyebrows are Space Grotesk **600** per DESIGN_SPEC.md §3
   * and android-shared.css (`.label` :175, `.tag` :490, `.reply .who .nm` :303,
   * `.chipbtn` :270, `.segmented div` :392, `.modelpill` :286).
   *
   * Only 400 and 500 used to be bundled, so every mono label in the app
   * rendered one or two weights light.
   */
  fontMonoBold: 'SpaceGrotesk_600SemiBold',

  sizes: {
    fine: 11,
    xs: 12,
    sm: 13,
    body: 14.5,
    /** Body (chat) — DESIGN_SPEC.md §3: 15.5 / 1.68. */
    bodyChat: 15.5,
    md: 16,
    subheading: 17,
    /** App-bar title, DESIGN_SPEC.md §3: 19–20 / 1.15. */
    appbar: 19,
    heading: 22,
    title: 25,
    display: 40,
    largeDisplay: 40,
  },

  lineHeights: {
    /** Display — §3: 1.04 (brand display) and 1.1 (screen title). */
    display: 1.04,
    title: 1.1,
    appbar: 1.15,
    tight: 1.15,
    /** Section heading — §3: 1.25. */
    section: 1.25,
    /** Metadata — §3: 1.4. */
    meta: 1.4,
    normal: 1.5,
    relaxed: 1.68,
    /** Label / eyebrow — §3: 1.0. */
    label: 1.0,
  },
};

export const targetSizes = {
  minTouch: 48,
  iconTouch: 44,
  iconSize: 20,
  iconSizeLarge: 24,
};

/* ===========================================================================
 * Elevation — the two languages never mix (DESIGN_SPEC.md §4).
 * A uses hard offset shadows with no blur; B uses soft low shadows and leans
 * on the `line` hairline for separation.
 * ========================================================================= */
export const elevation = {
  brand: {
    shadowColor: brandLight.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    /**
     * React Native 0.86 on Android maps only `shadowColor` and `boxShadow`
     * onto a view (ReactAndroid's BaseViewManager); shadowOffset/shadowRadius/
     * shadowOpacity are parsed by Fabric but never applied. Without this mirror
     * the hard offset shadow — the signature of Language A — is invisible on
     * Android. `boxShadow` is derived from the same numbers so the geometry
     * cannot drift. iOS and web honour both and render identically, not twice.
     */
    boxShadow: `4px 4px 0px 0px ${brandLight.border}`,
  },
  brandSmall: {
    shadowColor: brandLight.border,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    boxShadow: `3px 3px 0px 0px ${brandLight.border}`,
  },
  /*
   * The same two shapes on the dark brand ground. The shadow goes to true black
   * rather than brandDark.border: an olive-grey offset under a dark card reads
   * as a double border, while black reads as the cast shadow the language
   * intends. Geometry is identical, so the two themes cannot drift.
   */
  brandDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    boxShadow: '4px 4px 0px 0px #000000',
  },
  brandDarkSmall: {
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    boxShadow: '3px 3px 0px 0px #000000',
  },
  hubComposer: {
    shadowColor: '#15171b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  hubFab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 8,
  },
} as const;

/** 150-300ms micro; exits run at ~65% of enter (DESIGN_SPEC.md §6). */
export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
  exitRatio: 0.65,
} as const;

export const animation = {
  pressDuration: motion.fast,
  transitionDuration: motion.base,
  progressDuration: motion.slow,
};
