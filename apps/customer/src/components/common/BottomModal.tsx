/**
 * BottomModal - Drop-in replacement for @gorhom/bottom-sheet
 * Uses RN Modal + Animated to avoid react-native-worklets dependency.
 *
 * API mimics BottomSheet:
 *   ref.current?.expand()   → opens
 *   ref.current?.close()    → closes
 *
 * Children render inside a scrollable area.
 */
import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, borderRadius, shadow } from '@prayana/shared-ui';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface BottomModalRef {
  expand: () => void;
  close: () => void;
  snapToIndex: (index: number) => void;
}

interface BottomModalProps {
  children: React.ReactNode;
  /** Max height as percentage of screen (default 0.85) */
  maxHeightPercent?: number;
  /** If true, the sheet fills to maxHeightPercent instead of shrink-wrapping content */
  fillHeight?: boolean;
  onChange?: (index: number) => void;
}

const BottomModal = forwardRef<BottomModalRef, BottomModalProps>(
  ({ children, maxHeightPercent = 0.85, fillHeight = false, onChange }, ref) => {
    const [visible, setVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const open = useCallback(() => {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start();
      onChange?.(0);
    }, [slideAnim, onChange]);

    const close = useCallback(() => {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        onChange?.(-1);
      });
    }, [slideAnim, onChange]);

    useImperativeHandle(ref, () => ({
      expand: open,
      close,
      snapToIndex: (index: number) => {
        if (index >= 0) open();
        else close();
      },
    }));

    const maxHeight = SCREEN_HEIGHT * maxHeightPercent;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.backdropInner} />
        </Pressable>

        {/* Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              fillHeight
                ? { height: maxHeight, transform: [{ translateY: slideAnim }] }
                : { maxHeight, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Content - flex:1 when fillHeight so children can expand */}
            {fillHeight ? (
              <View style={{ flex: 1 }}>{children}</View>
            ) : (
              children
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

/** Scrollable area inside BottomModal (replaces BottomSheetScrollView) */
export const BottomModalScrollView: React.FC<{
  children: React.ReactNode;
  contentContainerStyle?: any;
  style?: any;
}> = ({ children, contentContainerStyle, style }) => (
  <ScrollView
    style={[{ flex: 1 }, style]}
    contentContainerStyle={contentContainerStyle}
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    nestedScrollEnabled
  >
    {children}
  </ScrollView>
);

BottomModal.displayName = 'BottomModal';

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropInner: {
    flex: 1,
  },
  keyboardView: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...shadow.lg,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
  },
});

export default BottomModal;
