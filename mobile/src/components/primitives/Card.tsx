import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { spacing } from '../../theme/tokens';
import { usePrimitiveSkin } from './skin';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const Card: React.FC<CardProps> = ({ children, style, language = 'hub' }) => {
  const skin = usePrimitiveSkin(language);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: skin.surface,
          borderColor: skin.line,
          borderWidth: skin.borderWidth,
          borderRadius: skin.cardRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
    marginVertical: spacing.sm,
  },
});
