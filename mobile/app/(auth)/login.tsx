import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import { usePalette } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { BrandHeader } from '../../src/components/brand/BrandHeader';
import { BrandButton, BrandField } from '../../src/components/brand/BrandControls';
import { radii, spacing, typography } from '../../src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string; prefillEmail?: string }>();
  const insets = useSafeAreaInsets();
  const brand = usePalette('brand');
  const { login, loginAsDemo, redirectPath } = useAuth();

  const [email, setEmail] = useState(params.prefillEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(undefined);
    setPasswordError(undefined);
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Email is required');
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setEmailError('Please enter a valid email address');
        isValid = false;
      }
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (loading) return; // Prevent duplicate submissions

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await login(email.trim(), password);

      // Navigate to intended destination or home
      const destination = params.redirect || redirectPath || '/(tabs)/home';
      router.replace(destination as any);
    } catch (err: any) {
      // Clear password on failed auth for security, retain email
      setPassword('');

      if (err.status === 401) {
        setErrorMessage('Invalid email or password. Please try again.');
      } else if (err.status === 429) {
        setErrorMessage('Too many attempts. Please try again in a few moments.');
      } else if (err.status === 0 || err.status === 408) {
        setErrorMessage('Cannot connect to server. Please check your internet connection.');
      } else {
        setErrorMessage(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    if (demoLoading) return;
    try {
      setDemoLoading(true);
      setErrorMessage(null);
      await loginAsDemo();

      const destination = params.redirect || redirectPath || '/(tabs)/home';
      router.replace(destination as any);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start demo session.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: brand.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BrandHeader title="Log in" onBackPress={() => router.back()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: spacing.lg,
            paddingBottom: Math.max(insets.bottom + spacing.base, spacing.xl),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.eyebrow,
            { color: brand.mutedForeground, fontFamily: typography.fontMonoMedium },
          ]}
        >
          WELCOME BACK
        </Text>

        <Text
          style={[
            styles.heading,
            { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
          ]}
        >
          Keep moving{'\n'}forward.
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: brand.mutedForeground, fontFamily: typography.fontBody },
          ]}
        >
          Your learning journey is waiting.
        </Text>

        {errorMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.errorBox,
              {
                backgroundColor: brand.card,
                borderColor: brand.destructive,
              },
            ]}
          >
            <Text
              style={[
                styles.errorText,
                { color: brand.destructive, fontFamily: typography.fontBody },
              ]}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <BrandField
            label="Email"
            placeholder="name@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(undefined);
              if (errorMessage) setErrorMessage(null);
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
          />

          <BrandField
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(undefined);
              if (errorMessage) setErrorMessage(null);
            }}
            error={passwordError}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            rightAction={
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={4}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={18} color={brand.mutedForeground} />
                ) : (
                  <Eye size={18} color={brand.mutedForeground} />
                )}
              </Pressable>
            }
          />

          <BrandButton
            label="Log in"
            onPress={handleLogin}
            loading={loading}
            icon={<ArrowRight size={18} color={brand.primaryForeground} />}
            iconPosition="right"
            style={styles.loginButton}
          />

          <BrandButton
            label="Try demo account"
            onPress={handleDemoLogin}
            variant="ghost"
            loading={demoLoading}
            icon={<Sparkles size={18} color={brand.foreground} />}
            iconPosition="left"
            accessibilityLabel="Try demo account without login"
            style={styles.demoButton}
          />
        </View>

        <View style={styles.footerRow}>
          <Text
            style={[
              styles.footerText,
              { color: brand.mutedForeground, fontFamily: typography.fontBody },
            ]}
          >
            New to Career Pilot?{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/register' as any)}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.footerLink,
                { color: brand.foreground, fontFamily: typography.fontBodyBold },
              ]}
            >
              Create account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    fontWeight: '500',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 2,
    marginBottom: spacing.base,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    lineHeight: 19,
  },
  form: {
    marginBottom: spacing.xl,
  },
  eyeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    marginTop: spacing.md,
  },
  demoButton: {
    marginTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: typography.sizes.body,
  },
  footerLink: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
});
