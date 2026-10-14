import React, { useEffect } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { DesignLanguage } from '../../theme/tokens';
import { spacing, typography } from '../../theme/tokens';
import { IconButton } from './IconButton';
import { usePrimitiveSkin } from './skin';
import { X } from 'lucide-react-native';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** 'hub' (default, every product surface) or 'brand' (sign-in, career). */
  language?: DesignLanguage;
}

export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  title,
  children,
  style,
  language = 'hub',
}) => {
  const skin = usePrimitiveSkin(language);

  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backHandler.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable
          style={[styles.scrim, { backgroundColor: skin.scrim }]}
          onPress={onClose}
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: skin.surface,
              borderTopColor: skin.line,
              borderTopWidth: skin.borderWidth,
              borderTopLeftRadius: skin.sheetRadius,
              borderTopRightRadius: skin.sheetRadius,
            },
            style,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: skin.line }]}>
            <Text style={[styles.title, { color: skin.text }]}>{title}</Text>
            <IconButton
              onPress={onClose}
              accessibilityLabel="Close"
              icon={<X size={20} color={skin.text} />}
            />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.sizes.subheading,
    fontWeight: '700',
  },
  content: {
    padding: spacing.base,
  },
});
