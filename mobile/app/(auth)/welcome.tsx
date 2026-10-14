import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Map, Sparkles, ArrowRight } from 'lucide-react-native';
import { usePalette } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { BrandButton } from '../../src/components/brand/BrandControls';
import { BrandWordmark } from '../../src/components/brand/BrandWordmark';
import { radii, spacing, typography } from '../../src/theme/tokens';
import { useBrandElevation } from '../../src/components/brand/brandElevation';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const brand = usePalette('brand');
  const shadow = useBrandElevation();
  const { loginAsDemo } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoLogin = async () => {
    if (demoLoading) return;
    try {
      setDemoLoading(true);
      await loginAsDemo();
      router.replace('/(tabs)/home' as any);
    } catch (err) {
      console.warn('Failed to launch demo account session:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: brand.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.xxl,
            paddingBottom: Math.max(insets.bottom + spacing.base, spacing.xl),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand wordmark — the brand introduces itself here, so this screen
            carries Language A's chip rather than the hub app bar. */}
        <BrandWordmark />

        {/* Heading */}
        <Text
          style={[
            styles.heading,
            { color: brand.foreground, fontFamily: typography.fontHeadingExtraBold },
          ]}
        >
          Your next step{'\n'}starts here.
        </Text>

        {/* Description */}
        <Text
          style={[
            styles.description,
            { color: brand.mutedForeground, fontFamily: typography.fontBody },
          ]}
        >
          Find your direction. Build your skills.{'\n'}Move toward the career you want.
        </Text>

        {/* 3 Benefit Rows — a bordered Language A card, not a hub surface */}
        <View
          style={[
            styles.benefitsContainer,
            { borderColor: brand.border, backgroundColor: brand.card },
            shadow.brandSmall,
          ]}
        >
          <View style={styles.benefitRow}>
            <Compass size={20} color={brand.foreground} strokeWidth={1.8} />
            <Text
              style={[
                styles.benefitText,
                { color: brand.foreground, fontFamily: typography.fontBodyMedium },
              ]}
            >
              A path shaped around you
            </Text>
          </View>

          <View style={styles.benefitRow}>
            <Map size={20} color={brand.foreground} strokeWidth={1.8} />
            <Text
              style={[
                styles.benefitText,
                { color: brand.foreground, fontFamily: typography.fontBodyMedium },
              ]}
            >
              Clear learning milestones
            </Text>
          </View>

          <View style={styles.benefitRow}>
            <Sparkles size={20} color={brand.foreground} strokeWidth={1.8} />
            <Text
              style={[
                styles.benefitText,
                { color: brand.foreground, fontFamily: typography.fontBodyMedium },
              ]}
            >
              Help when you need it
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <BrandButton
            label="Create account"
            onPress={() => router.push('/(auth)/register' as any)}
            icon={<ArrowRight size={18} color={brand.primaryForeground} />}
            iconPosition="right"
          />
          <BrandButton
            label="Log in"
            onPress={() => router.push('/(auth)/login' as any)}
            variant="ghost"
          />
          <BrandButton
            label="Explore demo account"
            onPress={handleDemoLogin}
            variant="ghost"
            loading={demoLoading}
            icon={<Sparkles size={18} color={brand.foreground} />}
            iconPosition="left"
            accessibilityLabel="Explore demo account without login"
          />
        </View>
      </ScrollView>
    </View>
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
  heading: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.3,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.sizes.body,
    lineHeight: 23,
    marginBottom: spacing.xl,
  },
  benefitsContainer: {
    gap: spacing.base,
    borderWidth: 2,
    borderRadius: radii.sm,
    padding: spacing.base,
    marginBottom: spacing.xxl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitText: {
    fontSize: typography.sizes.body,
    fontWeight: '500',
    flex: 1,
  },
  actionsContainer: {
    gap: spacing.md,
  },
});
