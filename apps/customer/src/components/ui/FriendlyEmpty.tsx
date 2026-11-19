// Friendly empty and error states: a small drawn illustration that floats
// gently, a short title, one helpful line and (optionally) one action.
// Drawn in code (react-native-svg) in the brand colours, so there are no
// image files and they look right in light and dark mode.
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, G, Ellipse } from 'react-native-svg';
import { useTheme } from '@prayana/shared-ui';

const ORANGE = '#F97316';
const TEAL = '#4AC0CC';
const RED = '#E61417';

export type EmptyKind = 'trips' | 'search' | 'tickets' | 'offline';

function Art({ kind, dark }: { kind: EmptyKind; dark: boolean }) {
  const soft = dark ? '#1F2937' : '#FFF1E6';
  const line = dark ? '#4B5563' : '#FDBA74';
  switch (kind) {
    case 'trips':
      return (
        <Svg width={150} height={120} viewBox="0 0 150 120">
          <Ellipse cx="75" cy="108" rx="44" ry="6" fill={dark ? '#111827' : '#F3F4F6'} />
          <Path d="M20 70 C 45 20, 105 20, 130 50" stroke={line} strokeWidth="2.5" strokeDasharray="5 6" fill="none" />
          <G transform="translate(118 36) rotate(30)">
            <Path d="M0 6 L18 0 L14 6 L18 12 Z" fill={TEAL} />
          </G>
          <Rect x="45" y="58" width="60" height="44" rx="9" fill={ORANGE} />
          <Rect x="45" y="58" width="60" height="12" rx="6" fill="#EA580C" />
          <Rect x="63" y="48" width="24" height="12" rx="5" fill="none" stroke="#EA580C" strokeWidth="4" />
          <Rect x="58" y="76" width="34" height="5" rx="2.5" fill="#FFE4CC" />
          <Circle cx="28" cy="70" r="5" fill={RED} />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={150} height={120} viewBox="0 0 150 120">
          <Rect x="22" y="22" width="106" height="76" rx="12" fill={soft} />
          <Path d="M22 70 L55 50 L80 66 L128 38" stroke={line} strokeWidth="2.5" fill="none" />
          <Circle cx="55" cy="50" r="5" fill={TEAL} />
          <Circle cx="80" cy="66" r="5" fill={ORANGE} />
          <Circle cx="92" cy="58" r="22" fill={dark ? '#0B1220' : '#FFFFFF'} stroke={ORANGE} strokeWidth="6" />
          <Path d="M108 74 L124 90" stroke={ORANGE} strokeWidth="9" strokeLinecap="round" />
          <Path d="M84 52 Q 92 44 100 52" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'tickets':
      return (
        <Svg width={150} height={120} viewBox="0 0 150 120">
          <G transform="rotate(-8 75 60)">
            <Rect x="28" y="34" width="94" height="52" rx="10" fill={soft} />
          </G>
          <Rect x="30" y="38" width="94" height="52" rx="10" fill={ORANGE} />
          <Circle cx="30" cy="64" r="8" fill={dark ? '#0B1220' : '#FFFFFF'} />
          <Circle cx="124" cy="64" r="8" fill={dark ? '#0B1220' : '#FFFFFF'} />
          <Path d="M96 44 L96 84" stroke="#FFE4CC" strokeWidth="2.5" strokeDasharray="4 4" />
          <Rect x="44" y="52" width="38" height="6" rx="3" fill="#FFE4CC" />
          <Rect x="44" y="64" width="26" height="6" rx="3" fill="#FFD1A8" />
          <Path d="M104 58 l5 5 l9 -11" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'offline':
      return (
        <Svg width={150} height={120} viewBox="0 0 150 120">
          <Path
            d="M44 86 h62 a20 20 0 0 0 0 -40 a28 28 0 0 0 -52 -6 a18 18 0 0 0 -10 46 z"
            fill={soft}
            stroke={line}
            strokeWidth="2.5"
          />
          <Path d="M58 64 q17 -14 34 0" stroke={TEAL} strokeWidth="5" fill="none" strokeLinecap="round" />
          <Circle cx="75" cy="74" r="4.5" fill={TEAL} />
          <Path d="M40 30 L110 96" stroke={RED} strokeWidth="6" strokeLinecap="round" />
        </Svg>
      );
  }
}

export function FriendlyEmpty({
  kind, title, text, actionLabel, onAction, compact = false,
}: {
  kind: EmptyKind;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Less padding, for use inside a section. */
  compact?: boolean;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [float]);

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
        <Art kind={kind} dark={isDarkMode} />
      </Animated.View>
      <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      {!!text && <Text style={[styles.text, { color: themeColors.textSecondary }]}>{text}</Text>}
      {!!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.97 }] }]}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 36 },
  compact: { paddingVertical: 20 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 14, textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 18, backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default FriendlyEmpty;
