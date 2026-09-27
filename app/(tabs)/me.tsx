import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import {
  biometricCapability,
  capabilityLabel,
  disableBiometric,
  isBiometricEnabled,
  type BiometricCapability,
} from '@/auth/biometrics';
import { AppBar, Screen, SectionLabel } from '@/components/Screen';
import { ChevronGlyph } from '@/components/glyphs/TabGlyphs';
import { Tag } from '@/components/Tag';
import { haptics } from '@/ui/haptics';
import { useTheme, useThemeController, type ThemeMode } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Me — profile, study stats, preferences, account.
 *
 * Matches design/png/08-me.png.
 *
 * The residential-IP notice is not decoration: the server refuses sign-in from
 * VPN and datacenter addresses (SYSTEM_WORKFLOW.md §3 step 3), and a user who
 * does not know that will read the rejection as a broken app.
 */
const MODES: ThemeMode[] = ['light', 'dark', 'system'];

export default function MeScreen() {
  const hub = useTheme('hub');
  const { signOut, user, busy } = useAuth();
  const { mode, setMode } = useThemeController();
  const [voiceReplies, setVoiceReplies] = useState(true);

  /*
   * The sign-in card used to read "Biometric unlock is on" unconditionally,
   * which was simply untrue: there is no way to know without asking the device.
   * Capability and enrolment are separate answers, and a device with no enrolled
   * fingerprint must not be told the feature is on.
   */
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cap, enabled] = await Promise.all([biometricCapability(), isBiometricEnabled()]);
      if (cancelled) return;
      setCapability(cap);
      setBiometricOn(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = (user?.name?.trim()?.[0] ?? user?.email?.trim()?.[0] ?? 'C').toUpperCase();

  return (
    <Screen padded={false}>
      <View style={styles.gutter}>
        <AppBar title="Me" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: hub.strong }]}>
            <Text style={[styles.avatarText, { color: hub.bg }]}>{initial}</Text>
          </View>
          <View style={styles.flexChild}>
            <Text style={[styles.name, { color: hub.text }]} numberOfLines={1}>
              {user?.name ?? 'Signed in'}
            </Text>
            <Text style={[styles.email, { color: hub.muted }]} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          {[
            { v: '—', l: 'DAY STREAK' },
            { v: '—', l: 'THREADS' },
            { v: '—', l: 'DOCS' },
          ].map((s) => (
            <View
              key={s.l}
              style={[styles.statCard, { borderColor: hub.line, backgroundColor: hub.surface }]}
            >
              <Text style={[styles.statValue, { color: hub.text }]}>{s.v}</Text>
              <Text style={[styles.statLabel, { color: hub.muted }]}>{s.l}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.statNote, { color: hub.muted }]}>
          Stats read from profile and progress once those are wired.
        </Text>

        <SectionLabel>Appearance</SectionLabel>
        <View style={[styles.group, { borderColor: hub.line, backgroundColor: hub.surface }]}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { color: hub.text }]}>Theme</Text>
            <View style={styles.flexChild} />
            <View
              style={[styles.segmented, { backgroundColor: hub.soft }]}
              accessibilityRole="tablist"
              accessibilityLabel="Theme"
            >
              {MODES.map((m) => {
                const active = m === mode;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${m} theme`}
                    style={[
                      styles.segment,
                      active ? { backgroundColor: hub.surface } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: active ? hub.text : hub.muted,
                          fontFamily: active ? fontFamily.monoBold : fontFamily.monoMedium,
                        },
                      ]}
                    >
                      {m === 'system' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.row, styles.divider, { borderTopColor: hub.line }]}>
            <View style={styles.flexChild}>
              <Text style={[styles.rowTitle, { color: hub.text }]}>Voice replies</Text>
              <Text style={[styles.rowMeta, { color: hub.muted }]}>Sarvam TTS</Text>
            </View>
            <Pressable
              onPress={() => setVoiceReplies((v) => !v)}
              accessibilityRole="switch"
              accessibilityLabel="Voice replies"
              accessibilityState={{ checked: voiceReplies }}
            >
              <Tag tone={voiceReplies ? 'lime' : 'outline'}>
                {voiceReplies ? 'On' : 'Off'}
              </Tag>
            </Pressable>
          </View>
        </View>

        <SectionLabel>Account</SectionLabel>
        <View style={[styles.group, { borderColor: hub.line, backgroundColor: hub.surface }]}>
          <SettingRow label="Edit profile" />
          <SettingRow
            label="Remembered sign-in"
            meta={biometricMeta(capability, biometricOn)}
            trailing={
              capability?.available && biometricOn ? (
                <Tag tone="lime">{capabilityLabel(capability.kind)}</Tag>
              ) : (
                <Tag>Off</Tag>
              )
            }
            onPress={
              capability?.available && biometricOn
                ? async () => {
                    await disableBiometric();
                    setBiometricOn(false);
                    haptics.tap();
                  }
                : undefined
            }
            divider
          />
          <SettingRow label="Offline downloads" meta="Manage cached threads" divider />
        </View>

        <View style={[styles.notice, { borderColor: '#e6d9a8', backgroundColor: '#fff8e6' }]}>
          <View style={styles.noticeDot} />
          <Text style={styles.noticeText}>
            Sign-in is restricted to residential IPs. Turn off VPN if login fails.
          </Text>
        </View>

        <Pressable
          onPress={signOut}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [
            styles.signOut,
            pressed ? { opacity: 0.6 } : null,
            busy ? { opacity: 0.5 } : null,
          ]}
        >
          <Text style={[styles.signOutText, { color: hub.danger }]}>Sign out</Text>
        </Pressable>

        <Text style={[styles.version, { color: hub.muted }]}>
          CareerPilot for Android · 1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SettingRow({
  label,
  meta,
  trailing,
  divider = false,
  onPress,
}: {
  label: string;
  meta?: string;
  trailing?: React.ReactNode;
  divider?: boolean;
  onPress?: () => void;
}) {
  const hub = useTheme('hub');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      style={[styles.row, divider ? styles.divider : null, { borderTopColor: hub.line }]}
    >
      <View style={styles.flexChild}>
        <Text style={[styles.rowTitle, { color: hub.text }]}>{label}</Text>
        {meta ? <Text style={[styles.rowMeta, { color: hub.muted }]}>{meta}</Text> : null}
      </View>
      {trailing ?? <ChevronGlyph color={hub.muted} />}
    </Pressable>
  );
}

/** Truthful subtitle for the remembered-sign-in row. */
function biometricMeta(
  capability: BiometricCapability | null,
  enabled: boolean,
): string {
  if (!capability) return 'Checking this device…';
  if (!capability.available) return capability.reason ?? 'Not available on this device';
  if (!enabled) return `Available — turn on at sign-in with ${capabilityLabel(capability.kind)}`;
  return `${capabilityLabel(capability.kind)} unlock is on — tap to turn off`;
}

const styles = StyleSheet.create({
  flexChild: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: space.s4 },
  scrollBody: { paddingHorizontal: space.s4, paddingBottom: space.s8 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: space.s2 },
  avatar: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.headingExtraBold, fontSize: 24 },
  name: { fontFamily: fontFamily.heading, fontSize: 20, letterSpacing: -0.5 },
  email: { fontFamily: fontFamily.sans, fontSize: 13, marginTop: 3 },

  stats: { flexDirection: 'row', gap: 10, marginTop: space.s6 },
  statCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.card,
    paddingVertical: space.s3,
    alignItems: 'center',
  },
  statValue: { fontFamily: fontFamily.headingExtraBold, fontSize: 24, letterSpacing: -0.8 },
  statLabel: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 3,
  },
  statNote: { fontFamily: fontFamily.sans, fontSize: 11.5, marginTop: space.s2 },

  group: { borderWidth: 1.5, borderRadius: radius.card, paddingHorizontal: space.s4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 14,
    minHeight: 56,
  },
  divider: { borderTopWidth: 1.5 },
  rowTitle: { fontFamily: fontFamily.sansSemiBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fontFamily.sans, fontSize: 12.5, marginTop: 2 },

  segmented: { flexDirection: 'row', gap: 3, borderRadius: 11, padding: 3 },
  segment: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  segmentText: { fontSize: 11.5 },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderWidth: 1.5,
    borderRadius: radius.chip,
    padding: 11,
    marginTop: space.s6,
  },
  noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d99a00' },
  noticeText: { flex: 1, fontFamily: fontFamily.sansMedium, fontSize: 13, lineHeight: 19 },

  signOut: {
    marginTop: space.s4,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#f0c9c9',
    backgroundColor: '#fffafa',
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontFamily: fontFamily.sansSemiBold, fontSize: 15 },

  version: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    textAlign: 'center',
    marginTop: space.s6,
  },
});
