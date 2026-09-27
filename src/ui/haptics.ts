import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

/**
 * Haptics.
 *
 * PRODUCT.md principle 5 — "calm over clever" — means these are confirmations,
 * not decoration. Three intents, no more:
 *
 *   tap()       a light tick for a selection change
 *   confirm()   a success notification for a completed action
 *   warn()      a notification for a failure the user should notice
 *
 * Reduced motion is honoured. Android's "Remove animations" setting is the
 * user saying they want less sensory feedback, and vibration is part of that,
 * so this checks the same flag the animations do rather than inventing a
 * separate preference.
 *
 * Every call is fire-and-forget and swallows its own errors: a device without a
 * vibrator must not break a milestone toggle.
 */

let reduceMotion = false;

// Tracked once rather than queried per call — this fires on every tap and an
// async bridge round trip per interaction would be wasteful.
void AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    reduceMotion = enabled;
  })
  .catch(() => undefined);

AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  reduceMotion = enabled;
});

export const haptics = {
  /** Selection change: tab, segment, filter. */
  tap(): void {
    if (reduceMotion) return;
    void Haptics.selectionAsync().catch(() => undefined);
  },

  /** A completed action the user meant to take. */
  confirm(): void {
    if (reduceMotion) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
  },

  /** Something failed, or a destructive action is about to happen. */
  warn(): void {
    if (reduceMotion) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined,
    );
  },
};
