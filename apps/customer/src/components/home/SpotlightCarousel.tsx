// A "spotlight" carousel: one card large in the middle, its neighbours peeking
// in at either edge, smaller and dimmed. A swipe settles the next card into the
// centre; dots underneath show where you are and jump to a card on tap.
//
// It used to loop by laying the cards out three times over and jumping between
// copies. With a dozen poster cards that was 36 heavy cards on screen, all
// re-rendered whenever the active dot changed mid-swipe, and the hidden jumps
// fought the finger: on mid-range Android phones the rail hung and stopped
// scrolling. Now each card is rendered once, the cards never re-render while
// swiping (only the dots do), and scale/fade run on the native driver.
//
// Snapping is done by hand (usePairSnap) rather than with snapToInterval,
// which on Android makes the vertical page jump while a rail loads.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@prayana/shared-ui';
import { usePairSnap } from '../../lib/railLayout';

const SIDE_SCALE = 0.86;
const SIDE_OPACITY = 0.55;
const MAX_DOTS = 12; // beyond this the dots stop being readable
// How long the rail must sit still before a swipe that stopped between two
// cards is settled. Android sometimes ends a swipe without the momentum event.
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
  const n = data.length;
  const step = itemWidth + gap;
  const sidePad = Math.max(0, (screenW - itemWidth) / 2);

  const scrollX = useRef(new Animated.Value(0)).current;
  const snap = usePairSnap(step);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(0);
  const setDot = useRef<((i: number) => void) | null>(null);

  // The parent passes renderItem/keyExtractor as inline arrows; read them from
  // refs so the cards below only rebuild when the data or size changes.
  const renderRef = useRef(renderItem);
  renderRef.current = renderItem;
  const keyRef = useRef(keyExtractor);
  keyRef.current = keyExtractor;

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e: any) => {
          const i = Math.min(n - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step)));
          if (i !== activeRef.current) {
            activeRef.current = i;
            setDot.current?.(i);
          }
        },
      }),
    [scrollX, n, step],
  );

  const cards = useMemo(
    () =>
      data.map((item, i) => {
        const range = [(i - 1) * step, i * step, (i + 1) * step];
        const scale = scrollX.interpolate({ inputRange: range, outputRange: [SIDE_SCALE, 1, SIDE_SCALE], extrapolate: 'clamp' });
        const opacity = scrollX.interpolate({ inputRange: range, outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={keyRef.current(item, i)}
            style={{ width: itemWidth, marginRight: i < n - 1 ? gap : 0, opacity, transform: [{ scale }] }}
          >
            {renderRef.current(item, i, itemWidth)}
          </Animated.View>
        );
      }),
    [data, itemWidth, gap, step, n, scrollX],
  );

  const goTo = (i: number) => snap.ref.current?.scrollTo({ x: i * step, animated: true });

  return (
    <View>
      <Animated.ScrollView
        ref={snap.setRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        {...snap.props}
        onScrollEndDrag={(e: any) => {
          snap.props.onScrollEndDrag(e);
          const x = e.nativeEvent.contentOffset.x;
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const target = Math.round(x / step) * step;
            if (Math.abs(target - x) > 1) snap.ref.current?.scrollTo({ x: target, animated: true });
          }, SETTLE_MS);
        }}
        onMomentumScrollBegin={() => { if (settleTimer.current) clearTimeout(settleTimer.current); }}
        contentContainerStyle={{ paddingHorizontal: sidePad, alignItems: 'center' }}
      >
        {cards}
      </Animated.ScrollView>

      {n > 1 && n <= MAX_DOTS && (
        <Dots data={data} keyExtractor={keyExtractor} accent={accent} onPress={goTo} setterRef={setDot} />
      )}
    </View>
  );
}

// The dots hold the active index themselves, so a swipe re-renders them alone.
function Dots<T>({ data, keyExtractor, accent, onPress, setterRef }: {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  accent: string;
  onPress: (i: number) => void;
  setterRef: React.MutableRefObject<((i: number) => void) | null>;
}) {
  const { isDarkMode } = useTheme();
  const [active, setActive] = useState(0);
  useEffect(() => {
    setterRef.current = setActive;
    return () => { setterRef.current = null; };
  }, [setterRef]);
  const n = data.length;
  return (
    <View style={styles.dots}>
      {data.map((item, i) => (
        <Pressable
          key={keyExtractor(item, i)}
          hitSlop={8}
          onPress={() => onPress(i)}
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
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 20 },
});
