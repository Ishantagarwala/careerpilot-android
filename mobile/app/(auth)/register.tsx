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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { usePalette } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/api/client';
import { BrandHeader } from '../../src/components/brand/BrandHeader';
import { BrandButton, BrandField } from '../../src/components/brand/BrandControls';
import { radii, spacing, typography } from '../../src/theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const brand = usePalette('brand');
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>(undefined);

  const validate = (): boolean => {
    let isValid = true;
    setNameError(undefined);
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmPasswordError(undefined);
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setNameError('Full name is required');
      isValid = false;
    }

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
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (loading) return; // Prevent duplicate submissions

    if (!validate()) {
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      setLoading(true);
      setErrorMessage(null);

      // Step 1: Create account on server
      await apiClient.post('/api/auth/register', {
        name: cleanName,
        email: cleanEmail,
        password,
      });

      // Step 2: Establish native session
      try {
        await login(cleanEmail, password);
        /*
         * First run (design/png/09-first-run.png) sits between sign-up and the
         * product: two optional permissions explained in context, both
         * refusable. Sign-up is the only path into it — a returning user has
         * already answered these.
         */
        router.replace('/(auth)/first-run' as any);
      } catch (loginErr: any) {
        // Registration succeeded, but auto-login encountered an error
        // Redirect to login screen with email prefilled
        router.replace({
          pathname: '/(auth)/login',
          params: { prefillEmail: cleanEmail },
        } as any);
      }
    } catch (err: any) {
      if (err.status === 400) {
        const msg = err.message || '';
        if (msg.toLowerCase().includes('already exists')) {
          setEmailError('An account with this email already exists.');
        } else {
          setErrorMessage(msg || 'Invalid registration details.');
        }
      } else if (err.status === 0 || err.status === 408) {
        setErrorMessage('Cannot connect to server. Please check your internet connection.');
      } else {
        setErrorMessage(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: brand.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BrandHeader title="Create account" onBackPress={() => router.back()} />

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
          START YOUR JOURNEY
        </Text>

        <Text
          style={[
            styles.heading,
            { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
          ]}
        >
          A future that{'\n'}fits you.
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
            label="Full name"
            placeholder="Your name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError(undefined);
              if (errorMessage) setErrorMessage(null);
            }}
            error={nameError}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />

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
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <BrandField
            label="Password"
            placeholder="Create a password"
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
            textContentType="newPassword"
            returnKeyType="next"
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

          <BrandField
            label="Confirm password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmPasswordError) setConfirmPasswordError(undefined);
              if (errorMessage) setErrorMessage(null);
            }}
            error={confirmPasswordError}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            rightAction={
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                hitSlop={4}
                style={styles.eyeButton}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} color={brand.mutedForeground} />
                ) : (
                  <Eye size={18} color={brand.mutedForeground} />
                )}
              </Pressable>
            }
          />

          <BrandButton
            label="Create account"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
          />
        </View>

        <View style={styles.footerRow}>
          <Text
            style={[
              styles.footerText,
              { color: brand.mutedForeground, fontFamily: typography.fontBody },
            ]}
          >
            Already have an account?{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/login' as any)}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.footerLink,
                { color: brand.foreground, fontFamily: typography.fontBodyBold },
              ]}
            >
              Log in
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
    marginBottom: spacing.base,
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
  registerButton: {
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
