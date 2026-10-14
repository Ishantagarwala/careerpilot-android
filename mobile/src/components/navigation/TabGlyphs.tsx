import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * The four bottom-navigation glyphs, drawn to match the mockups.
 *
 * android-shared.css :423-441 draws these as CSS boxes rather than shipping an
 * icon font:
 *
 *   .n-hub     19x17  border 2, radius 6  + a 4px-tall handle on top
 *   .n-career  19x14  border 2, radius 3  + a 6x4 notch inside the top edge
 *   .n-build   19x17  border 2, radius 3  + two horizontal rules
 *   .n-me      17x17  border 2, radius 50% + a shoulder arc below
 *
 * All four are 2px-stroke outlines on a 24-unit grid, which is why they read as
 * one family. Lucide's Sparkles / Briefcase / Hammer / User were the wrong
 * silhouette for every one of them (Sparkles in particular is a filled star
 * burst, nothing like the mockup's plain squircle), so the nav now draws its
 * own glyphs on the same grid as the rest of the app.
 *
 * Stroke is `currentColor`-equivalent: the parent passes `color`, so the icon
 * cannot drift from the tab's active/inactive palette.
 */
interface GlyphProps {
  color: string;
  size?: number;
}

const GRID = 24;
const STROKE = 2;

/** 19x17 rounded box (radius 6) with a short handle on the top edge. */
export const HubGlyph: React.FC<GlyphProps> = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} fill="none">
    <Rect x={2.5} y={6.5} width={19} height={15} rx={5} stroke={color} strokeWidth={STROKE} />
    <Path
      d="M8.5 6.5V5.5A2 2 0 0 1 10.5 3.5h3A2 2 0 0 1 15.5 5.5v1"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
    />
  </Svg>
);

/** 19x14 rect (radius 3) with a 6x4 notch hanging from its top edge. */
export const CareerGlyph: React.FC<GlyphProps> = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} fill="none">
    <Rect x={2.5} y={7.5} width={19} height={14} rx={2.5} stroke={color} strokeWidth={STROKE} />
    <Path d="M9 7.5v3.5h6V7.5" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
  </Svg>
);

/** 19x17 rect (radius 3) with two rules across it. */
export const BuildGlyph: React.FC<GlyphProps> = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} fill="none">
    <Rect x={2.5} y={4.5} width={19} height={17} rx={2.5} stroke={color} strokeWidth={STROKE} />
    <Path d="M6 11h12M6 15.5h12" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
  </Svg>
);

/** 17x17 circle with a shoulder arc below it (radius-50% avatar). */
export const MeGlyph: React.FC<GlyphProps> = ({ color, size = 20 }) => (
  <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} fill="none">
    <Path
      d="M8 12.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
      stroke={color}
      strokeWidth={STROKE}
    />
    <Path
      d="M5.5 22c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
    />
  </Svg>
);
