import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { BrandButton } from '@/components/brand/BrandControls';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { brandLight, elevation, radius, space } from '@/theme/tokens';

/**
 * First run — Language A (brand).
 *
 * Matches design/png/09-first-run.png.
 *
 * Permissions are requested in context and both are refusable. Nothing here
 * triggers a system prompt yet: the screen explains, "Continue" records the
 * choice, and the actual `requestPermission()` calls happen at the moment the
 * user first uses the feature. Asking for the microphone before the user has
 * seen the composer is how you get a permanent denial.
 */
export default function FirstRunScreen() {
  const { completeOnboarding } = useAuth();
  const insets = useSafeAreaInsets();

  function finish() {
    completeOnboarding();
    router.replace('/(tabs)/hub');
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.s8, paddingBottom: insets.bottom + space.s5 },
      ]}
    >
      <BrandWordmark />

      <Text style={styles.title}>
        Two things{'\n'}before we{'\n'}
        <Text style={styles.highlight}>start.</Text>
      </Text>

      <Text style={styles.lede}>
        Both are optional. The hub works without them — these just make it feel
        native.
      </Text>

      <View style={styles.cards}>
        <ExplainerCard
          title="Microphone"
          body="Ask questions by voice and answer career assessments out loud."
          glyph={<MicGlyph />}
        />
        <ExplainerCard
          title="Biometric unlock"
          body="Stay signed in without retyping your password each session."
          glyph={<LockGlyph />}
        />
      </View>

      <View style={styles.offline}>
        <View style={styles.offlineGlyph}>
          <View style={styles.offlineBox}>
            <View style={styles.offlineArrow} />
            <View style={styles.offlineArrowMask} />
          </View>
        </View>
        <View style={styles.offlineBody}>
          <Text style={styles.offlineTitle}>Works offline</Text>
          <Text style={styles.offlineText}>
            Threads and documents you open are cached on the device, so revision
            doesn&apos;t stop when the signal does.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <BrandButton label="Continue" onPress={finish} />
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Skip setup"
          hitSlop={12}
          style={styles.skip}
        >
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ExplainerCard({
  title,
  body,
  glyph,
}: {
  title: string;
  body: string;
  glyph: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardGlyph}>{glyph}</View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardText}>{body}</Text>
      </View>
    </View>
  );
}

/* Drawn shapes rather than an icon font or emoji — DESIGN_SPEC.md §8. */
function MicGlyph() {
  return (
    <View style={styles.mic}>
      <View style={styles.micCapsule} />
      <View style={styles.micStand} />
    </View>
  );
}

function LockGlyph() {
  return (
    <View style={styles.lock}>
      <View style={styles.lockShackle} />
    </View>
  );
}

const b = brandLight;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: b.background },
  content: { paddingHorizontal: space.s6, flexGrow: 1 },

  title: {
    fontFamily: 'Anybody_800ExtraBold',
    fontSize: 37,
    lineHeight: 40,
    letterSpacing: -1.3,
    color: b.foreground,
    marginTop: space.s8,
  },
  highlight: { backgroundColor: b.primary, color: b.foreground },
  lede: {
    fontSize: 15,
    lineHeight: 23,
    color: b.mutedForeground,
    marginTop: space.s4,
    maxWidth: 310,
  },

  cards: { marginTop: space.s8, gap: 14 },
  card: {
    flexDirection: 'row',
    gap: 14,
    borderWidth: 2,
    borderColor: b.border,
    backgroundColor: b.card,
    borderRadius: radius.brand,
    padding: space.s4,
    ...elevation.brandSmall,
  },
  cardGlyph: {
    width: 44,
    height: 44,
    borderRadius: radius.brand,
    borderWidth: 2,
    borderColor: b.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'Anybody_700Bold', fontSize: 16, color: b.foreground },
  cardText: { fontSize: 13, lineHeight: 19, color: b.mutedForeground, marginTop: 4 },

  mic: { alignItems: 'center', justifyContent: 'center' },
  micCapsule: {
    width: 13,
    height: 19,
    borderWidth: 2,
    borderColor: b.foreground,
    borderRadius: 7,
  },
  micStand: {
    position: 'absolute',
    bottom: -4,
    width: 19,
    height: 11,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: b.foreground,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  lock: {
    width: 15,
    height: 12,
    borderWidth: 2,
    borderColor: b.foreground,
    borderRadius: 2,
  },
  lockShackle: {
    position: 'absolute',
    left: 3,
    top: -8,
    width: 5,
    height: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: b.foreground,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },

  offline: {
    marginTop: space.s6,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
    borderWidth: 2,
    borderColor: '#b9bfa4',
    borderStyle: 'dashed',
    borderRadius: radius.brand,
    padding: 15,
  },
  offlineGlyph: {
    width: 36,
    height: 36,
    borderRadius: radius.brand,
    backgroundColor: b.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBox: {
    width: 15,
    height: 12,
    borderWidth: 2,
    borderColor: b.foreground,
    borderRadius: 2,
  },
  offlineArrow: {
    position: 'absolute',
    left: 4,
    top: -7,
    width: 7,
    height: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: b.foreground,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  offlineArrowMask: {
    position: 'absolute',
    left: 5,
    top: -3,
    width: 7,
    height: 2,
    backgroundColor: b.muted,
  },
  offlineBody: { flex: 1 },
  offlineTitle: { fontFamily: 'Anybody_700Bold', fontSize: 14.5, color: b.foreground },
  offlineText: { fontSize: 12.5, lineHeight: 19, color: b.mutedForeground, marginTop: 3 },

  actions: { marginTop: 'auto', paddingTop: space.s8 },
  skip: { alignItems: 'center', marginTop: 14 },
  skipText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 13.5,
    color: b.mutedForeground,
  },
});
