import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../../theme/ThemeContext';
import { spacing, targetSizes, typography } from '../../theme/tokens';

/**
 * Language A app bar: cream, a 2px pure-black keyline, and an Anybody title.
 * The auth screens use this instead of the hub AppHeader so no hub hairline or
 * hub surface colour leaks into a brand screen.
 */
export const BrandHeader: React.FC<{ title: string; onBackPress?: () => void }> = ({
  title,
  onBackPress,
}) => {
  const brand = usePalette('brand');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, spacing.sm),
          backgroundColor: brand.background,
          borderBottomColor: brand.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Pressable
          onPress={onBackPress ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ArrowLeft size={targetSizes.iconSizeLarge} color={brand.foreground} />
        </Pressable>

        <View style={styles.titleContainer}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: brand.foreground, fontFamily: typography.fontHeading },
            ]}
          >
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 2,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.base,
  },
  backButton: {
    width: targetSizes.minTouch,
    height: targetSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
