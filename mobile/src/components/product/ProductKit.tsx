import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radii, spacing, targetSizes, typography } from '../../theme/tokens';

/**
 * The product-tab kit — Language B (hub) on the Build and Me tabs.
 *
 * design/android-shared.css draws every product mockup with a 1.5px --hub-line
 * hairline around a --hub-surface fill, a 14px radius, a mono uppercase eyebrow,
 * and no shadow at all: in this language elevation is carried by the hairline,
 * never by a keyline. The rendered phone mockups confirm it — 05-roadmap.png,
 * 06-build-resume.png and 08-me.png are white cards on #f7f8fa separated by a
 * single hairline, with lime kept for the ATS ring, a match tag and the ON pill
 * (DESIGN_SPEC.md §2).
 *
 * ../primitives is Language B too and ../brand is the auth-only,
 * theme-independent cream kit, so the product tabs get this small kit instead.
 * Every colour and radius comes from src/theme/tokens.ts through useTheme();
 * strong pills paint their label in hub.surface, which flips with the theme
 * (hub.strong is near-white in dark mode, so a hard #fff label would vanish).
 */

/* ------------------------------------------------------------------ card -- */

interface ProductCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** White fill, 1.5px hub hairline, 14px radius, no shadow. */
export const ProductCard: React.FC<ProductCardProps> = ({
  children,
  style,
  onPress,
  accessibilityLabel,
}) => {
  const { hub } = useTheme();
  const shell: ViewStyle = {
    backgroundColor: hub.surface,
    borderColor: hub.line,
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.base,
  };

  if (!onPress) {
    return <View style={[styles.card, shell, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, shell, pressed ? styles.pressed : null, style]}
    >
      {children}
    </Pressable>
  );
};

/* --------------------------------------------------------------- eyebrow -- */

/** Section label: mono, uppercase, 11px, 1.1 tracking, muted. */
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => {
  const { hub } = useTheme();

  return <Text style={[styles.eyebrow, { color: hub.muted }, style]}>{children}</Text>;
};

/* ------------------------------------------------------------------ pill -- */

export type PillTone = 'outline' | 'lime' | 'strong' | 'quiet' | 'danger' | 'dashed';

interface PillProps {
  label: string;
  tone?: PillTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

/*
 * The severity red used for a rank-1 "HIGH" fix tag. screens.py:393-394 sets it
 * explicitly, and it is not the same value as --hub-danger — see the note on
 * `labelColor` below. Defined once so both the tag label and its fill stay in
 * step.
 */
const DANGER_TEXT = '#b91c1c';
const DANGER_FILL = '#fdecec';
const DANGER_BORDER = '#f6c9c9';

/**
 * Small uppercase mono pill (.tag in android-shared.css). 'outline' is the
 * default hairline pill, 'strong' is the near-black chip the mockups use for a
 * filter that is on, and 'lime' is reserved for scores and states that are
 * genuinely good news — a 92% match, an interview, an ON switch.
 */
export const Pill: React.FC<PillProps> = ({
  label,
  tone = 'outline',
  onPress,
  accessibilityLabel,
  style,
  labelStyle,
}) => {
  const { hub } = useTheme();

  const shell: ViewStyle =
    tone === 'lime'
      ? { backgroundColor: hub.primary, borderColor: hub.primary, borderStyle: 'solid' }
      : tone === 'strong'
      ? { backgroundColor: hub.strong, borderColor: hub.strong, borderStyle: 'solid' }
      : tone === 'quiet'
      ? { backgroundColor: hub.soft, borderColor: hub.line, borderStyle: 'solid' }
      : tone === 'danger'
      ? { backgroundColor: DANGER_FILL, borderColor: DANGER_BORDER, borderStyle: 'solid' }
      : tone === 'dashed'
      ? { backgroundColor: 'transparent', borderColor: hub.line, borderStyle: 'dashed' }
      : { backgroundColor: hub.surface, borderColor: hub.line, borderStyle: 'solid' };

  const labelColor =
    tone === 'lime'
      ? hub.primaryForeground
      : tone === 'strong'
      ? hub.surface
      : tone === 'danger'
      ? /*
         * #b91c1c, not --hub-danger (#dc2626). screens.py:393-394 draws the
         * "HIGH" fix tag on `#fdecec` with `#b91c1c` text, and that darker red
         * is required: #dc2626 on white is 4.16:1, under the 4.5:1 floor for
         * body text in DESIGN_SPEC.md §7. #b91c1c is 5.94:1 on white.
         */
        DANGER_TEXT
      : tone === 'outline' || tone === 'dashed'
      ? hub.muted
      : hub.text;

  const text = (
    <Text style={[styles.pillLabel, { color: labelColor }, labelStyle]}>{label}</Text>
  );

  if (!onPress) {
    return <View style={[styles.pill, shell, style]}>{text}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // The visible pill stays mockup-small; the touch target does not.
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={({ pressed }) => [styles.pill, shell, pressed ? { opacity: 0.75 } : null, style]}
    >
      {text}
    </Pressable>
  );
};

/* ------------------------------------------------------------- segmented -- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Material segmented control, hub-skinned: soft track, surface active tab. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedProps<T>) {
  const { hub } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmentedTrack, { backgroundColor: hub.soft }, style]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.segment,
              {
                // css:395-396 — .segmented div.on { background: hub-surface;
                // box-shadow: 0 1px 3px #15171b14 }
                backgroundColor: active ? hub.surface : 'transparent',
                boxShadow: active ? '0px 1px 3px 0px rgba(21, 23, 27, 0.08)' : undefined,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? hub.text : hub.muted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------ metric ring -- */

interface MetricRingProps {
  /** Rendered value (a score, a percent — whatever max is the ceiling of). */
  value: number;
  max?: number;
  /** Diameter at font scale 1. */
  size?: number;
  stroke?: number;
  caption: string;
  accessibilityLabel?: string;
}

/**
 * The mockups' big score ring (android-shared.css .ring): a thick track with a
 * lime arc, the value centred in Anybody 800 and a mono uppercase caption
 * underneath. The ring grows with the font scale so a 200% value can never
 * spill out of its own track.
 */
export const MetricRing: React.FC<MetricRingProps> = ({
  value,
  max = 100,
  size = 132,
  stroke = 12,
  caption,
  accessibilityLabel,
}) => {
  const { hub } = useTheme();
  const { fontScale } = useWindowDimensions();

  const scale = Math.max(1, Math.min(fontScale, 1.35));
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(safeMax, value));
  const ringSize = Math.round(size * scale);
  const ringStroke = Math.round(stroke * scale);
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / safeMax) * circumference;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? caption}
      accessibilityValue={{ min: 0, max: safeMax, now: Math.round(clamped) }}
      style={{ width: ringSize, height: ringSize }}
    >
      <Svg width={ringSize} height={ringSize}>
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={hub.soft}
          strokeWidth={ringStroke}
          fill="none"
        />
        {filled > 0 ? (
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={hub.primary}
            strokeWidth={ringStroke}
            strokeLinecap="round"
            strokeDasharray={filled + ' ' + Math.max(circumference - filled, 0)}
            fill="none"
            transform={'rotate(-90 ' + ringSize / 2 + ' ' + ringSize / 2 + ')'}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCentre]} pointerEvents="none">
        <Text
          style={[
            styles.ringValue,
            {
              color: hub.text,
              fontFamily: typography.fontHeadingExtraBold,
              fontSize: 40 * scale,
              // §3 metric: 40 / 1.0 / 800. Was 44 (= 1.1), which pushed the
              // numeral off the ring's optical centre.
              lineHeight: 40 * scale,
            },
          ]}
        >
          {Math.round(clamped)}
        </Text>
        <Text
          style={[
            styles.ringCaption,
            // css:386 — .ring .val small is Space Grotesk 600.
            { color: hub.muted, fontFamily: typography.fontMonoBold },
          ]}
        >
          {caption}
        </Text>
      </View>
    </View>
  );
};

/* ------------------------------------------------------------------- row -- */

interface ActionRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A card row: 48dp tall, bold title, muted meta, optional trailing slot. */
export const ActionRow: React.FC<ActionRowProps> = ({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  showChevron = false,
  style,
}) => {
  const { hub } = useTheme();

  const body = (
    <>
      {leading ? <View style={styles.rowLeading}>{leading}</View> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: hub.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: hub.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <ChevronRight size={targetSizes.iconSize} color={hub.muted} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.actionRow, style]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ')}
      style={({ pressed }) => [styles.actionRow, pressed ? { opacity: 0.7 } : null, style]}
    >
      {body}
    </Pressable>
  );
};

/** The in-card row separator: one 1.5px --hub-line hairline (.rowline). */
export const RowDivider: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { hub } = useTheme();

  return <View style={[styles.divider, { backgroundColor: hub.line }, style]} />;
};

/* ---------------------------------------------------------------- toggle -- */

interface TogglePillProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  onLabel?: string;
  offLabel?: string;
  accessibilityLabel?: string;
}

/** Lime ON / outline OFF switch, as the mockups draw the voice-replies row. */
export const TogglePill: React.FC<TogglePillProps> = ({
  value,
  onChange,
  label,
  onLabel = 'ON',
  offLabel = 'OFF',
  accessibilityLabel,
}) => {
  const { hub } = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.toggle,
        {
          backgroundColor: value ? hub.primary : 'transparent',
          borderColor: value ? hub.primary : hub.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.toggleLabel,
          {
            color: value ? hub.primaryForeground : hub.muted,
            fontFamily: typography.fontMonoMedium,
          },
        ]}
      >
        {value ? onLabel : offLabel}
      </Text>
    </Pressable>
  );
};

/* --------------------------------------------------------------- notice -- */

/**
 * The muted footnote banner (.banner in android-shared.css): amber dot, warm
 * surface, one small paragraph. The light values are the stylesheet's own
 * (#fff8e6 / #e6d9a8 / #d99a00); the dark surface and text are sampled from
 * design/png/10-dark-offline.png so the note stays legible in dark mode.
 */
export const NoticeBanner: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const { hub, isDark } = useTheme();

  const palette = isDark
    ? { surface: '#2b2514', line: 'rgba(230, 217, 168, 0.4)', dot: '#d99a00', text: '#e6d9aa' }
    : { surface: '#fff8e6', line: '#e6d9a8', dot: '#d99a00', text: hub.text };

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: palette.surface, borderColor: palette.line },
        style,
      ]}
    >
      <View style={[styles.noticeDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.noticeText, { color: palette.text }]}>{children}</Text>
    </View>
  );
};

/* ------------------------------------------------------------ stat tile -- */

export const StatTile: React.FC<{
  value: string;
  label: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ value, label, accessibilityLabel, style }) => {
  const { hub } = useTheme();

  return (
    <ProductCard style={[styles.statTile, style]}>
      <View accessible accessibilityLabel={accessibilityLabel ?? value + ' ' + label}>
        <Text
          style={[
            styles.statValue,
            { color: hub.text, fontFamily: typography.fontHeadingExtraBold },
          ]}
        >
          {value}
        </Text>
        <Text
          style={[
            styles.statLabel,
            { color: hub.muted, fontFamily: typography.fontMonoMedium },
          ]}
        >
          {label}
        </Text>
      </View>
    </ProductCard>
  );
};

/* --------------------------------------------------------- icon button ---- */

/** The mockups' circular app-bar action: 44dp, thin keyline, glyph centred. */
export const CircleIconButton: React.FC<{
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ onPress, accessibilityLabel, children, style }) => {
  const { hub } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: hub.line, opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

/** 40dp soft square holding a company or resume initial (.rowline .av). */
export const InitialSquare: React.FC<{ label: string; style?: StyleProp<ViewStyle> }> = ({
  label,
  style,
}) => {
  const { hub } = useTheme();

  return (
    <View
      style={[styles.initialSquare, { backgroundColor: hub.soft }, style]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.initialText,
          { color: hub.text, fontFamily: typography.fontHeadingExtraBold },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.base,
  },
  pressed: {
    opacity: 0.85,
  },
  eyebrow: {
    // §3 label/eyebrow: 11 / 1.0 / 600 · .1em · uppercase. css:175-176.
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    lineHeight: typography.sizes.fine * typography.lineHeights.label,
    letterSpacing: 1.1, // .1em at 11px
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  pill: {
    // css:490-496 — .tag { height: 25px; padding: 0 10px; border-radius: 7px }
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    height: 25,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  pillLabel: {
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.44, // .04em at 11px (mockup: 10.5px, held at the §3 floor)
    textTransform: 'uppercase',
  },
  segmentedTrack: {
    // css:390-391 — border-radius: 11px; padding: 3px
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
    padding: 3,
    borderRadius: 11,
  },
  segment: {
    flex: 1,
    // Material's 48dp minimum touch target.
    minHeight: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    // css:392 — padding: 9px 0
    paddingVertical: 9,
    borderRadius: radii.sm,
    // css:392-396 — the active segment is a surface fill plus a soft shadow,
    // NOT a bordered box. The border here used to outline every segment.
    borderWidth: 0,
  },
  segmentLabel: {
    // css:392-394 — Space Grotesk 600
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.22, // .02em at 11px
    textAlign: 'center',
  },
  ringCentre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    letterSpacing: -1.6,
    textAlign: 'center',
  },
  ringCaption: {
    /*
     * css:386 asks for 10px. DESIGN_SPEC.md §3 sets an 11px floor, so this is
     * the one place the two documents disagree and §3 was chosen to win —
     * at 11px the caption is still a fixed two-word label ("ATS SCORE") that
     * cannot truncate, so the floor's intent (never unreadable, never clipped
     * at 200% font scale) holds. Reported rather than silently deviated from.
     */
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 1.1, // .1em at 11px
    textTransform: 'uppercase',
    marginTop: 5,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // At large font scales a wide trailing pill drops to its own line rather
    // than squeezing the title into an unreadable column.
    flexWrap: 'wrap',
    gap: spacing.md,
    minHeight: targetSizes.minTouch,
    paddingVertical: spacing.md,
  },
  rowLeading: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 140,
  },
  rowTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: typography.sizes.md,
    lineHeight: 21,
  },
  rowSubtitle: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    marginTop: 3,
  },
  divider: {
    height: 1.5,
  },
  toggle: {
    minWidth: 56,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  noticeDot: {
    width: 9,
    height: 9,
    borderRadius: radii.full,
    marginTop: 5,
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
    fontFamily: typography.fontBodyMedium,
    fontSize: typography.sizes.sm,
    lineHeight: 19,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // screens.py:529 — the stat tiles are `.card.tight` (12px), not `.card`.
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: 0,
  },
  statValue: {
    // screens.py:530-538 — Anybody 800 24 / -.03em
    fontFamily: typography.fontHeadingExtraBold,
    fontSize: 24,
    lineHeight: 24, // 1.0
    letterSpacing: -0.72, // -.03em at 24px
    textAlign: 'center',
  },
  statLabel: {
    // screens.py:532 — Space Grotesk 10 / .08em. Held at the §3 11px floor.
    fontFamily: typography.fontMonoBold,
    fontSize: typography.sizes.fine,
    letterSpacing: 0.88, // .08em at 11px
    textTransform: 'uppercase',
    marginTop: 3,
    textAlign: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * screens.py:447 uses 42x42 / radius 12 for a job card and :485 uses
   * 34x34 / radius 9 for an application row; 40x40 / radius 11 (css .rowline
   * .av :367) is the middle case and the default here. Sizes are overridable
   * per call so Build can hit both.
   */
  initialSquare: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontFamily: typography.fontHeadingExtraBold,
    fontSize: 15,
  },
});
