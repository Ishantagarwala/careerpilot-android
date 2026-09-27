/**
 * CareerPilot design tokens.
 *
 * These values are copied from the web app's `app/globals.css`
 * (Ishantagarwala/CareerPliot) and are the canonical brand definition.
 * See design/DESIGN_SPEC.md §1 for the full contract.
 *
 * The product runs TWO design languages and they must not be blended:
 *
 *   brand — cream / lime / 2px black borders / hard offset shadows.
 *           Auth and first-run only, where the brand introduces itself.
 *
 *   hub   — near-white / near-black, quiet, lime as a small accent only.
 *           Every product surface: chat, career, roadmap, resume, jobs, profile.
 *
 * When the web repo's globals.css changes, these must be updated by hand until
 * a generated tokens.json export replaces this file (design/API_CONTRACT.md §4).
 */

/* ---------------------------------------------------------------------------
 * Language A — Brand (globals.css `:root`)
 * ------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
 * Language B — Hub (globals.css `.aihub`)
 * ------------------------------------------------------------------------- */
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
  /**
   * Lime, admitted into the hub language as a SMALL ACCENT only: the active tab
   * indicator, progress fills, completion state, the reply identity mark and
   * bullet dots, and match tags. Never a surface, never body text.
   * See design/DESIGN_SPEC.md §2.
   */
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

/**
 * Palette shape, widened to `string`.
 *
 * `hubLight` and `hubDark` are `as const`, so their literal hex types would
 * otherwise be mutually incompatible and hubs could not be swapped by theme.
 */
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

export type BrandPalette = typeof brandLight;

/* ---------------------------------------------------------------------------
 * Geometry — 4/8dp rhythm (DESIGN_SPEC.md §4)
 * ------------------------------------------------------------------------- */
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
} as const;

export const radius = {
  /** language A controls are hard-edged and consistent with the border */
  brand: 8,
  card: 14,
  chip: 12,
  input: 12,
  composer: 22,
  /** leading corner only, for drawers */
  sheet: 26,
  pill: 999,
} as const;

/** Material minimum is 48dp; 8dp minimum separation between targets. */
export const touch = {
  min: 48,
  iconButton: 44,
  gap: 8,
} as const;

/* ---------------------------------------------------------------------------
 * Type — Hanken Grotesk (body) · Space Grotesk (labels) · Anybody (headings)
 * ------------------------------------------------------------------------- */
export const fontFamily = {
  sans: 'HankenGrotesk_400Regular',
  sansMedium: 'HankenGrotesk_500Medium',
  sansSemiBold: 'HankenGrotesk_600SemiBold',
  sansBold: 'HankenGrotesk_700Bold',
  mono: 'SpaceGrotesk_400Regular',
  monoMedium: 'SpaceGrotesk_500Medium',
  monoBold: 'SpaceGrotesk_700Bold',
  heading: 'Anybody_700Bold',
  headingExtraBold: 'Anybody_800ExtraBold',
} as const;

/**
 * Type scale (DESIGN_SPEC.md §3). Nothing below 11px; body never below 14px.
 * Sizes are logical pixels — React Native's default font scaling stays enabled
 * so Dynamic Type works.
 */
export const type = {
  screenTitle: { fontFamily: fontFamily.heading, fontSize: 25, lineHeight: 28, letterSpacing: -0.5 },
  appBarTitle: { fontFamily: fontFamily.heading, fontSize: 19, lineHeight: 22, letterSpacing: -0.3 },
  brandDisplay: { fontFamily: fontFamily.headingExtraBold, fontSize: 40, lineHeight: 43, letterSpacing: -1.3 },
  sectionHeading: { fontFamily: fontFamily.heading, fontSize: 17, lineHeight: 21, letterSpacing: -0.2 },
  bodyChat: { fontFamily: fontFamily.sans, fontSize: 15.5, lineHeight: 26 },
  bodyUi: { fontFamily: fontFamily.sans, fontSize: 14.5, lineHeight: 22 },
  bodyUiSmall: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 19 },
  /** uppercase labels are always tracked +.1em */
  label: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  meta: { fontFamily: fontFamily.sans, fontSize: 12, lineHeight: 17 },
  metric: { fontFamily: fontFamily.headingExtraBold, fontSize: 40, lineHeight: 40, letterSpacing: -1.6 },
} as const;

/* ---------------------------------------------------------------------------
 * Elevation
 *
 * Language A uses HARD OFFSET shadows, not blur. Language B uses soft, low
 * shadows and leans on the `line` border for separation instead. Never mix two
 * elevation languages on one screen.
 * ------------------------------------------------------------------------- */
export const elevation = {
  brand: {
    shadowColor: brandLight.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  brandSmall: {
    shadowColor: brandLight.border,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
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

/* ---------------------------------------------------------------------------
 * Motion (DESIGN_SPEC.md §6) — 150-300ms micro, <=400ms transitions.
 * Exit runs at ~65% of enter so it feels responsive.
 * ------------------------------------------------------------------------- */
export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
  exitRatio: 0.65,
} as const;
