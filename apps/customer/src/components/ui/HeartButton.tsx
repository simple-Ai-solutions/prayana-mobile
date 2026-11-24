// The save-to-wishlist heart, everywhere it appears. Saving makes it pop: the
// heart swells and settles with a spring, a ring of small dots bursts out of
// it and fades, and the phone gives a light tap. Unsaving just shrinks back.
// It saves to the same on-device wishlist as the trek page.
import React, { useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { toggleSaved, useIsSaved } from '../../lib/savedActivities';

const SAVED = '#F43F5E';
const DOTS = 8;

export function HeartButton({
  id, size = 18, style, plain = false,
}: {
  id: string;
  size?: number;
  /** Position and size of the round button (absolute placement goes here). */
  style?: StyleProp<ViewStyle>;
  /** No dark disc behind the heart, for a page's own header button. */
  plain?: boolean;
}) {
  const saved = useIsSaved(id);
  const pop = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const press = () => {
    const now = toggleSaved(id);
    if (now) {
      pop.setValue(0.6);
      burst.setValue(0);
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }),
        Animated.timing(burst, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Animated.sequence([
        Animated.timing(pop, { toValue: 0.8, duration: 90, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
      ]).start();
    }
    Toast.show({
      type: now ? 'success' : 'info',
      text1: now ? 'Saved to Wishlist' : 'Removed',
      text2: now ? 'Find it under My Wishlist.' : undefined,
      visibilityTime: 1800,
      onPress: now ? () => { Toast.hide(); router.push('/wishlist' as any); } : undefined,
    });
  };

  const reach = size * 1.15;
  return (
    <Pressable
      onPress={press}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from Wishlist' : 'Save to Wishlist'}
      accessibilityState={{ selected: saved }}
      style={[plain ? styles.plain : styles.disc, style]}
    >
      {/* The burst: dots fly out from the centre and fade. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: DOTS }).map((_, i) => {
          const a = (i / DOTS) * Math.PI * 2;
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i % 2 ? '#FB923C' : SAVED,
                  opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * reach] }) },
                    { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * reach] }) },
                    { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size} color={saved ? SAVED : '#fff'} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  plain: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 5,
    height: 5,
    marginLeft: -2.5,
    marginTop: -2.5,
    borderRadius: 3,
  },
});

export default HeartButton;
