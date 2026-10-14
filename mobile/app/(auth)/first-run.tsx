import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, Fingerprint, Lock } from 'lucide-react-native';
import { usePalette } from '../../src/theme/ThemeContext';
import { BrandButton } from '../../src/components/brand/BrandControls';
import { BrandWordmark } from '../../src/components/brand/BrandWordmark';
import { spacing, typography } from '../../src/theme/tokens';
import { useBrandElevation } from '../../src/components/brand/brandElevation';

/**
 * First run — design/png/09-first-run.png, Language A.
 *
 *   screens.py:588-592  "permission explained in the app's own voice, and the
 *                        offline/refresh state that streaming apps must design
 *                        for… Both are optional."
 *
 * The contract, from screens.py:592-665:
 *
 *   wordmark          Language A chip, 34px from the top of the content
 *   title             Anybody 800 37 / 1.04 / -.035em, with a lime highlight
 *                     band on the final word — the brand's one expressive move
 *   lede              15 / 1.6 --muted-foreground, max ~31ch
 *   two permission cards  2px black keyline, radius 8, 44x44 icon tile,
 *                         `3px 3px 0 #000`, gap 14
 *   a dashed card     "Works offline" — dashed #b9bfa4, NOT a solid keyline, so
 *                     it reads as information rather than a request
 *   actions           lime "Continue" + a centred "Not now" text button
 *
 * DESIGN_SPEC.md §8 governs the copy: explain the permission in the app's own
 * voice, and make both refusable. Nothing here is asked for up front and
 * nothing is requested at OS level from this screen — "Continue" simply moves
 * into the app, where each permission is requested in context, which is what
 * §5 and ANDROID_APP_PLAN.md §4 mean by "permissions in context".
 */
export default function FirstRunScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const brand = usePalette('brand');
  const shadow = useBrandElevation();
  const [busy, setBusy] = useState(false);

  const handleContinue = () => {
    if (busy) return;
    setBusy(true);
    router.replace('/(tabs)/home' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: brand.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: Math.max(insets.bottom + spacing.base, spacing.lg),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BrandWordmark />

        {/* Title, with the lime band on the last word (screens.py:598-602) */}
        <Text
          style={[
            styles.title,
            { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
          ]}
        >
          Two things{'\n'}before we{'\n'}
          <Text style={[styles.titleMark, { backgroundColor: brand.primary }]}>start.</Text>
        </Text>

        <Text
          style={[
            styles.lede,
            { color: brand.mutedForeground, fontFamily: typography.fontBody },
          ]}
        >
          Both are optional. The hub works without them — these just make it feel
          native.
        </Text>

        {/* Two permission cards — each refusable, each explained in context */}
        <View style={styles.cards}>
          <View
            style={[
              styles.permCard,
              { borderColor: brand.border, backgroundColor: brand.card },
              shadow.brandSmall,
            ]}
          >
            <View style={[styles.permIcon, { borderColor: brand.border, backgroundColor: brand.card }]}>
              <Mic size={22} color={brand.foreground} strokeWidth={2} />
            </View>
            <View style={styles.permBody}>
              <Text
                style={[
                  styles.permTitle,
                  { color: brand.foreground, fontFamily: typography.fontHeading },
                ]}
              >
                Microphone
              </Text>
              <Text style={[styles.permDesc, { color: brand.mutedForeground }]}>
                Ask questions by voice and answer career assessment out loud.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.permCard,
              { borderColor: brand.border, backgroundColor: brand.card },
              shadow.brandSmall,
            ]}
          >
            <View style={[styles.permIcon, { borderColor: brand.border, backgroundColor: brand.card }]}>
              <Fingerprint size={22} color={brand.foreground} strokeWidth={2} />
            </View>
            <View style={styles.permBody}>
              <Text
                style={[
                  styles.permTitle,
                  { color: brand.foreground, fontFamily: typography.fontHeading },
                ]}
              >
                Biometric unlock
              </Text>
              <Text style={[styles.permDesc, { color: brand.mutedForeground }]}>
                Stay signed in without retyping your password each session.
              </Text>
            </View>
          </View>
        </View>

        {/* The offline promise — dashed, because it is information, not a
            request (screens.py:639). */}
        <View style={[styles.offlineCard, { borderColor: '#b9bfa4' }]}>
          <View style={[styles.offlineIcon, { backgroundColor: brand.muted }]}>
            <Lock size={17} color={brand.foreground} strokeWidth={2} />
          </View>
          <View style={styles.offlineBody}>
            <Text
              style={[
                styles.offlineTitle,
                { color: brand.foreground, fontFamily: typography.fontHeading },
              ]}
            >
              Works offline
            </Text>
            <Text style={[styles.offlineDesc, { color: brand.mutedForeground }]}>
              Threads and documents you open are cached on the device, so revision
              doesn&apos;t stop when the signal does.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <BrandButton label="Continue" onPress={handleContinue} loading={busy} />
          <Pressable
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Skip this and continue"
            hitSlop={12}
            style={({ pressed }) => [styles.notNow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.notNowText, { color: brand.mutedForeground }]}>Not now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  title: {
    // screens.py:598-599 — 37 / 1.04 / -.035em
    fontSize: 37,
    lineHeight: 38.5,
    letterSpacing: -1.3,
    marginTop: spacing.xxl,
  },
  titleMark: {
    // The lime band, via a zero-radius padding box (css:190-191 uses a 0 0 0 3px
    // spread shadow; RN needs the padding to carry it instead).
    paddingHorizontal: 3,
  },
  lede: {
    // screens.py:603-604 — 15 / 1.6, max ~31ch
    fontSize: 15,
    lineHeight: 24,
    marginTop: spacing.base,
    maxWidth: 300,
  },
  cards: {
    marginTop: 30,
    gap: 14,
  },
  permCard: {
    flexDirection: 'row',
    gap: 14,
    borderWidth: 2,
    borderRadius: 8,
    padding: spacing.base,
  },
  permIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBody: { flex: 1, minWidth: 0 },
  permTitle: {
    fontSize: 16,
    lineHeight: 16 * typography.lineHeights.section,
  },
  permDesc: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * 1.5,
    marginTop: 4,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    marginTop: spacing.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: 15,
  },
  offlineIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBody: { flex: 1, minWidth: 0 },
  offlineTitle: {
    fontSize: 14.5,
    lineHeight: 14.5 * typography.lineHeights.section,
  },
  offlineDesc: {
    fontFamily: typography.fontBody,
    fontSize: 12.5,
    lineHeight: 12.5 * 1.5,
    marginTop: 3,
  },
  actions: {
    // marginTop auto pushes the actions to the foot of the screen when there is
    // room (screens.py:658) and lets them follow the content when there is not.
    marginTop: 'auto',
    paddingTop: spacing.xl,
    gap: 14,
  },
  notNow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  notNowText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13.5,
  },
});
