// StaySheet — the bottom sheet the Stays screens use for search, filters,
// sort, guests, arrival time and cancelling.
//
// A plain RN Modal rather than common/BottomModal: that one paints a fixed
// white sheet, which turns dark-mode text invisible. Children scroll; an
// optional footer (the sheet's main button) stays pinned above the home
// indicator.
//
// Anything tappable inside must use React Native's own touchables: a Modal
// mounts outside the GestureHandlerRootView, so gesture-handler touchables
// get no taps here.
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight } from '@prayana/shared-ui';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Right side of the title row, e.g. "Clear all". */
  headerAction?: React.ReactNode;
  /** Fraction of the screen the sheet may take. */
  maxHeight?: number;
  /** Block closing (a request is in flight). */
  locked?: boolean;
}

export function StaySheet({ visible, title, onClose, children, footer, headerAction, maxHeight = 0.88, locked = false }: Props) {
  const { themeColors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const close = () => {
    if (!locked) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()}`}
        />
        {/* Full-screen and bottom-aligned, like common/BottomModal: with
            behavior="height" (Android, edge-to-edge) the container shrinks
            from the bottom, lifting the sheet above the keyboard. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.surface,
                maxHeight: height * maxHeight,
                paddingBottom: footer ? 0 : Math.max(insets.bottom, spacing.lg),
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: themeColors.border }]} />
            </View>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: themeColors.text }]} accessibilityRole="header" numberOfLines={1}>
                {title}
              </Text>
              {headerAction}
              <TouchableOpacity
                onPress={close}
                disabled={locked}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: themeColors.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  keyboard: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  // flexShrink: with the keyboard up the sheet gives way (its list scrolls)
  // instead of running off the top of the screen.
  sheet: { width: '100%', flexShrink: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  closeBtn: { padding: 2 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});

export default StaySheet;
