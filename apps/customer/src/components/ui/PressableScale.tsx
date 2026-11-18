// A Pressable that gives way under the finger: it springs down a touch while
// held, springs back on release, and taps a light haptic when the press lands.
// Drop-in for Pressable on cards and buttons, so every tappable surface on the
// app answers the same way on iOS and Android.
import React, { useRef } from 'react';
import { Animated, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = PressableProps & {
  /** How far it shrinks while held. Cards 0.97, small buttons 0.94. */
  scaleTo?: number;
  /** Light haptic on press (on by default). */
  haptic?: boolean;
  /** Style for the outer animated wrapper (margins, flex), not the card. */
  wrapperStyle?: StyleProp<ViewStyle>;
};

export function PressableScale({
  scaleTo = 0.97, haptic = true, wrapperStyle, onPressIn, onPressOut, onPress, children, ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue === 1 ? 6 : 0 }).start();

  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        onPressIn={(e) => { springTo(scaleTo); onPressIn?.(e); }}
        onPressOut={(e) => { springTo(1); onPressOut?.(e); }}
        onPress={(e) => {
          if (haptic && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
          onPress?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default PressableScale;
