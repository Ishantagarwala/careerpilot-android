import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import {
  BrandButton,
  BrandField,
  BrandTextButton,
} from '@/components/brand/BrandControls';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { brandLight, space } from '@/theme/tokens';

/**
 * Sign in — Language A (brand).
 *
 * Matches design/png/01-sign-in.png.
 *
 * NOTE ON BOT VERIFICATION: the mockup shows an hCaptcha widget, but hCaptcha
 * is a web widget and does not render in React Native. The server's login chain
 * hard-fails without a valid token, so nobody can sign in until Phase 0 resolves
 * this (design/API_CONTRACT.md §1.2 — Play Integrity is the recommended route).
 * What is rendered below is an honest notice, not a fake checkbox: a control
 * that looks interactive but does nothing is worse than no control.
 */
export default function SignInScreen() {
  const { signIn, busy, error } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    await signIn(email.trim(), password);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.s6, paddingBottom: insets.bottom + space.s6 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BrandWordmark />

        <Text style={styles.title}>
          Get to your{'\n'}
          <Text style={styles.highlight}>career goal</Text>
          {'\n'}faster.
        </Text>

        <Text style={styles.lede}>
          Your study hub, roadmap and resume — one calm place to work from.
        </Text>

        <View style={styles.form}>
          <BrandField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <BrandField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            trailing={
              <BrandTextButton
                label={showPassword ? 'Hide' : 'Show'}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
          />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Bot verification pending</Text>
          <Text style={styles.noticeBody}>
            CareerPilot requires bot verification on sign-in. hCaptcha cannot run
            in a native app, so signing in stays disabled until Play Integrity
            attestation is wired up on the server.
          </Text>
        </View>

        <View style={styles.legal}>
          <LockGlyph />
          <Text style={styles.legalText}>
            Sign-in is restricted to residential connections. VPNs are refused by
            the server.
          </Text>
        </View>

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <BrandButton
            label="Sign in"
            onPress={onSubmit}
            loading={busy}
            disabled={!canSubmit}
          />
          <View style={{ height: space.s3 }} />
          <Link href="/(auth)/register" asChild>
            <BrandButton label="Create an account" variant="ghost" />
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    fontSize: 42,
    lineHeight: 45,
    letterSpacing: -1.4,
    color: b.foreground,
    marginTop: space.s8,
  },
  highlight: {
    color: b.foreground,
    // Lime is a highlighter here, matching the mockup's marker treatment.
    backgroundColor: b.primary,
  },
  lede: {
    fontSize: 15,
    lineHeight: 23,
    color: b.mutedForeground,
    marginTop: space.s4,
    maxWidth: 300,
  },
  form: { marginTop: space.s2 },

  notice: {
    marginTop: space.s4,
    borderWidth: 1.5,
    borderColor: '#b9bfa4',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: space.s4,
    backgroundColor: '#fbfcf4',
  },
  noticeTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: b.foreground,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    color: b.mutedForeground,
    marginTop: 6,
  },

  legal: { flexDirection: 'row', gap: 8, marginTop: space.s4, alignItems: 'flex-start' },
  lock: {
    width: 13,
    height: 10,
    borderWidth: 1.5,
    borderColor: b.mutedForeground,
    borderRadius: 2,
    marginTop: 4,
  },
  lockShackle: {
    position: 'absolute',
    left: 2.5,
    top: -6,
    width: 5,
    height: 6,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: b.mutedForeground,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  legalText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: b.mutedForeground },

  error: {
    marginTop: space.s4,
    borderWidth: 2,
    borderColor: b.destructive,
    borderRadius: 8,
    padding: space.s3,
    backgroundColor: '#fdf3f3',
  },
  errorText: { fontSize: 13.5, lineHeight: 19, color: b.destructive },

  actions: { marginTop: space.s6, paddingBottom: space.s2 },
});
