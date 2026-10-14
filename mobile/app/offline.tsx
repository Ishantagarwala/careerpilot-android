import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, WifiOff, Map } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Card } from '../src/components/primitives/Card';
import { Button } from '../src/components/primitives/Button';
import { ProgressTrack } from '../src/components/primitives/ProgressTrack';
import {
  RoadmapData,
  computeRoadmapStats,
  getCachedRoadmap,
} from '../src/api/roadmap';
import { radii, spacing, typography } from '../src/theme/tokens';

export default function OfflineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || 'guest_user';

  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);

  useEffect(() => {
    getCachedRoadmap(userId).then((cached) => {
      if (cached) setRoadmap(cached);
    });
  }, [userId]);

  const { total, completed, percent } = computeRoadmapStats(roadmap);
  const careerPath = roadmap?.careerPath || 'Software Engineer';

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Offline roadmap" isRoot={false} />

      <View style={[styles.inlineStatus, { backgroundColor: hub.soft }]}>
        <WifiOff size={16} color={hub.text} />
        <Text
          style={[
            styles.statusText,
            { color: hub.text, fontFamily: typography.fontBodyMedium },
          ]}
        >
          Offline · showing saved data
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
      >
        <Text
          style={[
            styles.eyebrow,
            { color: hub.muted, fontFamily: typography.fontMonoMedium },
          ]}
        >
          YOUR LEARNING ROADMAP
        </Text>

        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          You can still{'\n'}review your path.
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: hub.muted, fontFamily: typography.fontBody },
          ]}
        >
          Your last saved roadmap is available. Connect to sync changes or ask your
          AI tutor.
        </Text>

        <Card style={styles.card}>
          <Text
            style={[
              styles.cardTitle,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            {careerPath}
          </Text>
          <Text
            style={[
              styles.cardSubtitle,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            {completed > 0 ? `${completed} of ${total} milestones complete` : 'Saved roadmap milestone tracking'}
          </Text>

          <ProgressTrack progressPercent={percent || 42} />

          <Text
            style={[
              styles.cardFine,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            Last refreshed · earlier today
          </Text>

          <Button
            label="View saved roadmap"
            onPress={() => router.push('/(tabs)/learn' as any)}
            variant="secondary"
            icon={<Map size={16} color={hub.text} />}
            iconPosition="right"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <Button
          label="Try connection again"
          onPress={() => router.push('/(tabs)/home' as any)}
          variant="primary"
          icon={<RefreshCw size={16} color={hub.bg} />}
          iconPosition="left"
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  statusText: {
    fontSize: typography.sizes.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
    marginBottom: spacing.xxs,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  cardSubtitle: {
    fontSize: typography.sizes.body,
    marginVertical: spacing.xs,
  },
  cardFine: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
  },
});
