import { Link } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import {
  authenticateForSignIn,
  biometricCapability,
  capabilityLabel,
  disableBiometric,
  enableBiometric,
  isBiometricEnabled,
  type BiometricCapability,
} from '@/auth/biometrics';
import {
  BrandButton,
  BrandField,
  BrandTextButton,
} from '@/components/brand/BrandControls';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { integrityStatus } from '@/auth/playIntegrity';
import { brandLight, space } from '@/theme/tokens';

/**
 * Sign in — Language A (brand).
 *
 * Matches design/png/01-sign-in.png.
 *
 * NOTE ON BOT VERIFICATION: the mockup shows an hCaptcha widget, but hCaptcha
 * is a web widget and does not render in React Native. The mobile path uses Play
 * Integrity instead (src/auth/playIntegrity.ts). Until that module is wired up,
 * the notice below states the real reason rather than showing a checkbox that
 * does nothing.
 */
export default function SignInScreen() {
  const { signIn, busy, error } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricNote, setBiometricNote] = useState<string | null>(null);

  /*
   * Whitespace is trimmed from BOTH fields.
   *
   * The server lowercases and trims the email but compares the password byte
   * for byte against a bcrypt hash, so a single trailing space — which mobile
   * keyboards add routinely through autocomplete and swipe — produces a flat
   * "Email or password is incorrect." with nothing to suggest the cause.
   * Verified against production: "demo1234 " is a 401, "demo1234" is a 200.
   *
   * Trimming here rather than server-side is deliberate: a password that
   * genuinely begins or ends with a space is far rarer than the accidental one,
   * and changing the server would alter behaviour for the web app too.
   */
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();

  /*
   * The button is NOT gated on completeness any more.
   *
   * It used to be `disabled` until both fields had content, which meant tapping
   * it did nothing at all — the only signal was a 50% opacity change, which is
   * not a signal. Users read that as a broken app, and they were right to.
   *
   * Now it always submits and an incomplete form says exactly which field is
   * missing. A control that explains itself beats one that refuses silently.
   */
  function missingField(): string | null {
    if (!trimmedEmail) return 'Enter your email address.';
    if (!trimmedPassword) return 'Enter your password.';
    return null;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cap, enabled] = await Promise.all([biometricCapability(), isBiometricEnabled()]);
      if (cancelled) return;
      setCapability(cap);
      setBiometricReady(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit() {
    if (busy) return;
    const missing = missingField();
    if (missing) {
      setLocalError(missing);
      return;
    }
    setLocalError(null);
    await signIn(trimmedEmail, trimmedPassword);
  }

  /**
   * Sign in using the stored credential.
   *
   * A deliberate cancel keeps the stored credential — the user changed their
   * mind, not their device. A genuine failure wipes it, because a credential
   * that no longer authenticates is worse than none: it makes the button look
   * broken on every launch.
   */
  const onBiometricSignIn = useCallback(async () => {
    setBiometricBusy(true);
    setBiometricNote(null);
    try {
      const auth = await authenticateForSignIn();
      if (!auth.ok) {
        if (auth.reason === 'failed') {
          await disableBiometric();
          setBiometricReady(false);
          setBiometricNote('Biometric sign-in was turned off. Sign in with your password.');
        }
        return;
      }
      const result = await signIn(auth.email, auth.password);
      if (!result.ok) {
        // The stored password is stale — most likely changed elsewhere.
        await disableBiometric();
        setBiometricReady(false);
        setBiometricNote('Your saved sign-in no longer works. Enter your password.');
      }
    } finally {
      setBiometricBusy(false);
    }
  }, [signIn]);

  /** Remember the credentials once a sign-in has actually succeeded. */
  const onRemember = useCallback(async () => {
    if (biometricBusy) return;
    const missing = !trimmedEmail
      ? 'Enter your email address to save this sign-in.'
      : !trimmedPassword
        ? 'Enter your password to save this sign-in.'
        : null;
    if (missing) {
      setLocalError(missing);
      return;
    }
    setBiometricBusy(true);
    setBiometricNote(null);
    const result = await signIn(trimmedEmail, trimmedPassword);
    if (result.ok) {
      // Store the trimmed values, so a remembered sign-in cannot fail later on
      // whitespace the user never intended to type.
      await enableBiometric(trimmedEmail, trimmedPassword);
      setBiometricReady(true);
    }
    setBiometricBusy(false);
  }, [biometricBusy, trimmedEmail, trimmedPassword, signIn]);

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

        {biometricReady && capability?.available ? (
          <View style={styles.biometric}>
            <Pressable
              onPress={onBiometricSignIn}
              disabled={biometricBusy}
              accessibilityRole="button"
              accessibilityLabel={`Sign in with ${capabilityLabel(capability.kind)}`}
              accessibilityState={{ busy: biometricBusy, disabled: biometricBusy }}
              style={[styles.biometricButton, biometricBusy ? styles.dim : null]}
            >
              {biometricBusy ? (
                <ActivityIndicator color={brandLight.primaryForeground} />
              ) : (
                <Text style={styles.biometricText}>
                  Sign in with {capabilityLabel(capability.kind)}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={async () => {
                await disableBiometric();
                setBiometricReady(false);
                setBiometricNote('Saved sign-in removed.');
              }}
              accessibilityRole="button"
              accessibilityLabel="Forget saved sign-in"
              hitSlop={10}
            >
              <Text style={styles.biometricForget}>Use my password instead</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.form}>
          <BrandField
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (localError) setLocalError(null);
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <BrandField
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (localError) setLocalError(null);
            }}
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
          <Text style={styles.noticeTitle}>Device check pending</Text>
          <Text style={styles.noticeBody}>
            {integrityStatus().reason ??
              'CareerPilot verifies this device before signing in.'}
          </Text>
        </View>

        <View style={styles.legal}>
          <LockGlyph />
          <Text style={styles.legalText}>
            Sign-in is restricted to residential connections. VPNs are refused by
            the server.
          </Text>
        </View>

        {biometricNote ? (
          <Text style={styles.biometricNote} accessibilityLiveRegion="polite">
            {biometricNote}
          </Text>
        ) : null}

        {localError || error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{localError ?? error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <BrandButton label="Sign in" onPress={onSubmit} loading={busy} />
          {capability?.available && !biometricReady ? (
            <>
              <View style={{ height: space.s3 }} />
              <BrandButton
                label={`Remember with ${capabilityLabel(capability.kind)}`}
                variant="ghost"
                onPress={onRemember}
                disabled={biometricBusy || Boolean(missingField())}
              />
            </>
          ) : null}
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

  biometric: { marginTop: space.s6, alignItems: 'center', gap: 10 },
  biometricButton: {
    width: '100%',
    height: 54,
    borderWidth: 2,
    borderColor: b.border,
    borderRadius: 8,
    backgroundColor: b.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricText: {
    fontFamily: 'Anybody_700Bold',
    fontSize: 16,
    color: b.primaryForeground,
    letterSpacing: -0.2,
  },
  biometricForget: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 13,
    color: b.mutedForeground,
  },
  biometricNote: {
    marginTop: space.s4,
    fontSize: 13,
    lineHeight: 19,
    color: b.mutedForeground,
  },
  dim: { opacity: 0.5 },
});
