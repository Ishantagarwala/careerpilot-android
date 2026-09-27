import { router } from 'expo-router';
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

import { API_BASE_URL, ApiError } from '@/api/client';
import { BrandButton, BrandField } from '@/components/brand/BrandControls';
import { BrandWordmark } from '@/components/brand/BrandWordmark';
import { brandLight, space } from '@/theme/tokens';

/**
 * Register.
 *
 * The server route is `POST /api/auth/register` (app/api/auth/register/route.ts)
 * and runs the same fail-closed chain as sign-in: email-domain allowlist,
 * residential-IP assertion, rate limit, captcha, then bcrypt. Because there is
 * no session yet this posts anonymously.
 *
 * Same bot-verification caveat as sign-in — see design/API_CONTRACT.md §1.2.
 */
export default function RegisterScreen() {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 8 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new ApiError(data.error ?? `Registration failed (${res.status})`, res.status);
      }
      // Account created — send them to sign in rather than assuming a session.
      router.replace('/(auth)/sign-in');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
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
          Start your{'\n'}
          <Text style={styles.highlight}>study archive.</Text>
        </Text>
        <Text style={styles.lede}>
          Threads accumulate into a personal record of everything you have worked
          through.
        </Text>

        <View style={styles.form}>
          <BrandField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <BrandField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <BrandField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
        </View>

        {password.length > 0 && password.length < 8 ? (
          <Text style={styles.hint}>Use at least 8 characters.</Text>
        ) : null}

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <BrandButton
            label="Create account"
            onPress={onSubmit}
            loading={busy}
            disabled={!canSubmit}
          />
          <View style={{ height: space.s3 }} />
          <BrandButton label="Back to sign in" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const b = brandLight;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: b.background },
  content: { paddingHorizontal: space.s6, flexGrow: 1 },
  title: {
    fontFamily: 'Anybody_800ExtraBold',
    fontSize: 38,
    lineHeight: 41,
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
    maxWidth: 300,
  },
  form: { marginTop: space.s2 },
  hint: { marginTop: space.s2, fontSize: 12.5, color: b.mutedForeground },
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
