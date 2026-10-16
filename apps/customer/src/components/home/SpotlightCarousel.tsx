// A "spotlight" carousel: one card large in the middle, its neighbours peeking
// in at either edge, smaller and dimmed. A swipe settles the next card into the
// centre; dots underneath show where you are and jump to a card on tap.
//
// It loops both ways. The cards are laid out three times over and the
// carousel opens on the middle copy, so there's a card on each side from the
// first frame. Once a swipe settles outside the middle copy it jumps, without
// animating, to the same card in the middle copy — the cards are identical, so
// the jump can't be seen, and the user can keep swiping either way for ever.
//
// Scale and fade run on the native driver, so they track the finger without
// touching JS. Snapping is done by hand (usePairSnap) rather than with
// snapToInterval, which on Android makes the vertical page jump while a rail
// loads.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@prayana/shared-ui';
import { usePairSnap } from '../../lib/railLayout';

const SIDE_SCALE = 0.86;
const SIDE_OPACITY = 0.55;
const MAX_DOTS = 12; // beyond this the dots stop being readable
const COPIES = 3;
// How long the rail must sit still before we recentre on the middle copy.
// Long enough that a snap animation has finished, short enough that the user
// can't swipe again first.
const SETTLE_MS = 160;

export function SpotlightCarousel<T>({
  data, keyExtractor, renderItem, itemWidth, gap = 12, accent = '#EA580C',
}: {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  /** Render the card at the given width; the carousel handles scale and fade. */
  renderItem: (item: T, index: number, width: number) => React.ReactElement;
  itemWidth: number;
  gap?: number;
  /** Colour of the active dot. */
  accent?: string;
}) {
  const { width: screenW } = useWindowDimensions();
  const { isDarkMode } = useTheme();
  const n = data.length;
  const step = itemWidth + gap;
  const sidePad = Math.max(0, (screenW - itemWidth) / 2);
  // A single card has nothing to loop through.
  const copies = n > 1 ? COPIES : 1;
  const startX = n > 1 ? n * step : 0; // first card of the middle copy

  const scrollX = useRef(new Animated.Value(startX)).current;
  const snap = usePairSnap(step);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placed = useRef(false);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  // Open on the middle copy. contentOffset covers the first frame; the
  // scrollTo is the fallback for platforms that ignore it.
  const placeAtStart = () => {
    if (placed.current || n < 2) return;
    placed.current = true;
    snap.ref.current?.scrollTo({ x: startX, animated: false });
  };

  const recentre = (x: number) => {
    const slot = Math.round(x / step);
    if (Math.abs(slot * step - x) > 1) return; // not resting on a card yet
    if (slot >= n && slot < 2 * n) return; // already in the middle copy
    const target = (((slot % n) + n) % n) + n;
    snap.ref.current?.scrollTo({ x: target * step, animated: false });
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const i = ((Math.round(x / step) % n) + n) % n;
        if (i !== activeRef.current) {
          activeRef.current = i;
          setActive(i);
        }
        if (n < 2) return;
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => recentre(x), SETTLE_MS);
      },
    },
  );

  // Dots jump within the middle copy, the way that's always in reach.
  const goTo = (i: number) => snap.ref.current?.scrollTo({ x: (i + (n > 1 ? n : 0)) * step, animated: true });

  const slots = Array.from({ length: n * copies }, (_, s) => s);

  return (
    <View>
      <Animated.ScrollView
        ref={snap.setRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentOffset={{ x: startX, y: 0 }}
        onContentSizeChange={placeAtStart}
        {...snap.props}
        contentContainerStyle={{ paddingHorizontal: sidePad, alignItems: 'center' }}
      >
        {slots.map((s) => {
          const i = s % n;
          const item = data[i];
          const range = [(s - 1) * step, s * step, (s + 1) * step];
          const scale = scrollX.interpolate({
            inputRange: range, outputRange: [SIDE_SCALE, 1, SIDE_SCALE], extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange: range, outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY], extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={`${keyExtractor(item, i)}:${Math.floor(s / n)}`}
              style={{
                width: itemWidth,
                marginRight: s < slots.length - 1 ? gap : 0,
                opacity,
                transform: [{ scale }],
              }}
            >
              {renderItem(item, i, itemWidth)}
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {n > 1 && n <= MAX_DOTS && (
        <View style={styles.dots}>
          {data.map((item, i) => (
            <Pressable
              key={keyExtractor(item, i)}
              hitSlop={8}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Show card ${i + 1} of ${n}`}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(17,24,39,0.18)' },
                  i === active && [styles.dotOn, { backgroundColor: accent }],
                ]}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 20 },
});
