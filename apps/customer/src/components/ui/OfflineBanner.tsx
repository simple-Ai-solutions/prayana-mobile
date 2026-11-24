// A slim banner at the top of every screen while the phone is offline, and
// a brief green "Back online" when it reconnects. Unknown connection (as on
// launch) counts as online, so it never cries wolf.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useIsOnline from '../chat/useIsOnline';

export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'hidden' | 'offline' | 'back'>('hidden');
  const slide = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    if (!online) {
      wasOffline.current = true;
      setState('offline');
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setState('back');
      t = setTimeout(() => setState('hidden'), 2200);
    }
    return () => { if (t) clearTimeout(t); };
  }, [online]);

  useEffect(() => {
    Animated.spring(slide, { toValue: state === 'hidden' ? 0 : 1, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
  }, [state, slide]);

  const back = state === 'back';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bar,
        { paddingTop: insets.top + 6, backgroundColor: back ? '#16A34A' : '#111827' },
        { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-(insets.top + 60), 0] }) }] },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={back ? 'wifi' : 'cloud-offline-outline'} size={15} color="#fff" />
      <Text style={styles.text}>{back ? 'Back online' : "You're offline. Some things may not load."}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, elevation: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

export default OfflineBanner;
