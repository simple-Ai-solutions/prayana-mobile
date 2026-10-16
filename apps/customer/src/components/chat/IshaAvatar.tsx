import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FLAME, useIsha } from './ishaTheme';

// Served from the website, the same files its chat uses, and cached on the
// phone after the first load. The bundled copies drew as blank boxes in the
// Android release build.
export const ISHA_AVATAR = { uri: 'https://prayanaai.com/mascot/isha-avatar.png' };
export const ISHA_WAVE = { uri: 'https://prayanaai.com/mascot/isha-wave.png' };

/**
 * Isha's face in the logo's flame. The ring turns while she works.
 * `dot` adds the online dot (green when reachable).
 */
export default function IshaAvatar({
  size = 40,
  ring = 2,
  working = false,
  dot,
}: {
  size?: number;
  ring?: number;
  working?: boolean;
  dot?: 'online' | 'offline';
}) {
  const t = useIsha();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!working) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [working, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const inner = size - ring * 2;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <LinearGradient
          colors={FLAME as unknown as string[] as [string, string, ...string[]]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </Animated.View>
      <Image
        source={ISHA_AVATAR}
        style={{
          position: 'absolute',
          top: ring,
          left: ring,
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: t.isDark ? '#1c1917' : '#ffffff',
        }}
        contentFit="cover"
        cachePolicy="disk"
      />
      {dot && (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: Math.max(10, size * 0.3),
            height: Math.max(10, size * 0.3),
            borderRadius: 99,
            borderWidth: 2,
            borderColor: t.bg,
            backgroundColor: dot === 'online' ? t.online : t.offline,
          }}
        />
      )}
    </View>
  );
}
