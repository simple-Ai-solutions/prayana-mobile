import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import IshaAvatar from './IshaAvatar';
import { useIsha } from './ishaTheme';

const STEPS = ['Mapping your route', 'Finding hidden gems', 'Building day-by-day plan', 'Adding local picks', 'Polishing your guide'];

/** A plan-shaped placeholder while the itinerary is written, with what's happening. */
export default function ItineraryLoading({ destination, duration }: { destination?: string; duration?: number | string }) {
  const t = useIsha();
  const [at, setAt] = useState(0);
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const id = setInterval(() => setAt((i) => (i + 1) % STEPS.length), 1900);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      clearInterval(id);
      loop.stop();
    };
  }, [pulse]);

  const meta = [duration ? `${duration}-day plan` : null, destination].filter(Boolean).join(' · ');
  const bar = (w: string | number, h = 10) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: 999, backgroundColor: t.sunken, opacity: pulse }} />
  );

  return (
    <View accessibilityLabel="Creating your itinerary" accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      <View style={styles.head}>
        <IshaAvatar size={36} working />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>Crafting your itinerary</Text>
          {!!meta && (
            <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.card, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Animated.View style={[styles.cover, { backgroundColor: t.sunken, opacity: pulse }]} />
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {bar(64, 22)}
            {bar(84, 22)}
          </View>
          {bar('70%')}
          {bar('55%')}
          {bar('100%', 40)}
        </View>
      </View>
      <View style={styles.progress}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                height: 6,
                width: i === at ? 20 : 6,
                borderRadius: 3,
                backgroundColor: i === at ? t.ink : i < at ? t.faint : t.border,
              }}
            />
          ))}
        </View>
        <Text style={[styles.step, { color: t.muted }]}>{STEPS[at]}…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  cover: { height: 140 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4 },
  step: { fontSize: 12, fontWeight: '500' },
});
