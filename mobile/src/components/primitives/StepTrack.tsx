import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { radii, spacing } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

interface StepTrackProps {
  currentStep: number; // 1-indexed (e.g. 1 to 4)
  totalSteps?: number;
  style?: ViewStyle;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const StepTrack: React.FC<StepTrackProps> = ({
  currentStep,
  totalSteps = 4,
  style,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  return (
    <View
      style={[styles.container, style]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentStep} of ${totalSteps}`}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
    >
      {Array.from({ length: totalSteps }, (_, idx) => {
        const stepNum = idx + 1;
        const isFilled = stepNum <= currentStep;
        return (
          <View
            key={idx}
            style={[
              styles.segment,
              {
                backgroundColor: isFilled ? skin.accent : skin.soft,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: spacing.md,
    height: 3,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: radii.none,
  },
});
