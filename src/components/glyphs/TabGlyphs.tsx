import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Bottom-navigation glyphs.
 *
 * Drawn as SVG paths rather than emoji or a raster icon font: emoji are
 * font-dependent and cannot be themed, and DESIGN_SPEC.md §8 rules them out
 * entirely. One 2px stroke language across all four keeps them a family.
 *
 * The tab bar renders these on a lime pill when active, so they must read at
 * 24dp against both near-white and lime.
 */

export interface GlyphProps {
  color: string;
  size?: number;
}

const STROKE = 2;

export function HubGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* speech bubble — the chat surface */}
      <Path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.4A.6.6 0 0 1 5 18.9V16h-.5A.5.5 0 0 1 4 15.5z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CareerGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* briefcase — the career surface */}
      <Rect
        x="3"
        y="7.5"
        width="18"
        height="12.5"
        rx="2.5"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Path
        d="M9 7.5V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5v1"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path d="M3 12.5h18" stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

export function BuildGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* document with text lines — resume / portfolio / jobs */}
      <Rect
        x="4"
        y="3.5"
        width="16"
        height="17"
        rx="2.5"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Path
        d="M8 9h8M8 13h8M8 17h4"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MeGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* person — positioned so the shoulder arc stays inside the viewBox */}
      <Circle cx="12" cy="8.5" r="3.75" stroke={color} strokeWidth={STROKE} />
      <Path
        d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------------- */
/* Secondary glyphs, same language                                            */
/* ------------------------------------------------------------------------- */

export function SendGlyph({ color, size = 20 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.4 11.3 19 4.6a.6.6 0 0 1 .8.8l-6.7 14.6a.6.6 0 0 1-1.1-.1l-1.6-5.1a1 1 0 0 0-.7-.7l-5.1-1.6a.6.6 0 0 1-.2-1.2z"
        fill={color}
      />
    </Svg>
  );
}

export function PlusGlyph({ color, size = 20 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function MenuGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function MicGlyph({ color, size = 22 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth={STROKE} />
      <Path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChevronGlyph({ color, size = 18 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 5l7 7-7 7"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PaperclipGlyph({ color, size = 18 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 11.5 12.6 19a4.6 4.6 0 0 1-6.5-6.5l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.6 7.6a1.4 1.4 0 0 1-2-2l7-7"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
