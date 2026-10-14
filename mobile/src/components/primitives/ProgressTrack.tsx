import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { radii } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

/**
 * The progress track — android-shared.css `.track` (:377-378):
 *
 *   .track   { height: 7px; background: var(--hub-soft); border-radius: 4px }
 *   .track i { background: var(--primary); border-radius: 4px }
 *
 * This was height 4 with a 0 radius on both the track and the fill, so every
 * progress bar in the app read as a hairline rather than the mockup's bar.
 * The track is `--hub-soft` in EVERY language — Language A's screens override
 * it inline (screens.py:251 uses `--muted` plus a 2px keyline), they do not
 * repaint it black, which is what `skin.line` did here.
 */
interface ProgressTrackProps {
  progressPercent?: number; // 0 to 100
  progress?: number; // 0 to 1
  style?: ViewStyle;
  height?: number;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const ProgressTrack: React.FC<ProgressTrackProps> = ({
  progressPercent,
  progress,
  style,
  height = 7,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);
  const rawPercent =
    progress !== undefined
      ? progress * 100
      : progressPercent !== undefined
      ? progressPercent
      : 0;
  const clamped = Math.max(0, Math.min(100, rawPercent));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[
        styles.track,
        {
          height,
          // The accent is a fill here — the one place Language B allows it.
          backgroundColor: skin.soft,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            backgroundColor: skin.accent,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    // css:377 — border-radius: 4px
    borderRadius: radii.xs,
    overflow: 'hidden',
    marginVertical: 8,
  },
  fill: {
    height: '100%',
    // css:378 — border-radius: 4px on the fill too
    borderRadius: radii.xs,
  },
});
