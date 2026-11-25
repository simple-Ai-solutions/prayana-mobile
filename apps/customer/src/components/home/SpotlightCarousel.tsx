// A "spotlight" carousel: one card large in the middle, its neighbours peeking
// in at either edge, smaller and dimmed. A swipe settles the next card into the
// centre; dots underneath show where you are and jump to a card on tap.
//
// It loops both ways without ever jumping. The old loop laid the cards out
// three times and, after a swipe, jumped invisibly back to the middle copy;
// on Android that jump could land mid-snap and leave the rail stuck and deaf
// to swipes. Now the cards repeat LOOPS times in a virtualised list that opens
// in the middle: only the few cards near the screen are ever drawn, and with
// hundreds of cards each way no one reaches an end, so no jump is needed.
//
// Only the dots re-render as the active card changes; scale and fade run on
// the native driver. Snapping is done by hand rather than with
// snapToInterval, which on Android makes the vertical page jump while a rail
// loads.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@prayana/shared-ui';

const SIDE_SCALE = 0.86;
const SIDE_OPACITY = 0.55;
const MAX_DOTS = 12; // beyond this the dots stop being readable
const LOOPS = 200; // copies of the card list; the rail opens on the middle one
// A swipe that ends without a fling and without the momentum event (Android
// sometimes skips it) is settled after the rail has been still this long.
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
  const loops = n > 1 ? LOOPS : 1;
  const step = itemWidth + gap;
  const sidePad = Math.max(0, (screenW - itemWidth) / 2);
  const startIndex = n > 1 ? n * Math.floor(LOOPS / 2) : 0;

  const listRef = useRef<FlatList<number> | null>(null);
  const scrollX = useRef(new Animated.Value(startIndex * step)).current;
  const xRef = useRef(startIndex * step);
  const activeRef = useRef(0);
  const setDot = useRef<((i: number) => void) | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The parent passes renderItem/keyExtractor as inline arrows; read them from
  // refs so cards don't rebuild on every parent render.
  const renderRef = useRef(renderItem);
  renderRef.current = renderItem;
  const keyRef = useRef(keyExtractor);
  keyRef.current = keyExtractor;

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const slots = useMemo(() => Array.from({ length: n * loops }, (_, s) => s), [n, loops]);

  const settle = useCallback((x: number) => {
    const target = Math.round(x / step) * step;
    if (Math.abs(target - x) > 1) listRef.current?.scrollToOffset({ offset: target, animated: true });
  }, [step]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e: any) => {
          const x = e.nativeEvent.contentOffset.x;
          xRef.current = x;
          const i = ((Math.round(x / step) % n) + n) % n;
          if (i !== activeRef.current) {
            activeRef.current = i;
            setDot.current?.(i);
          }
        },
      }),
    [scrollX, step, n],
  );

  const renderSlot = useCallback(
    ({ item: s }: { item: number }) => {
      const i = s % n;
      const range = [(s - 1) * step, s * step, (s + 1) * step];
      const scale = scrollX.interpolate({ inputRange: range, outputRange: [SIDE_SCALE, 1, SIDE_SCALE], extrapolate: 'clamp' });
      const opacity = scrollX.interpolate({ inputRange: range, outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY], extrapolate: 'clamp' });
      return (
        <View style={{ width: step }}>
          <Animated.View style={{ width: itemWidth, opacity, transform: [{ scale }] }}>
            {renderRef.current(data[i], i, itemWidth)}
          </Animated.View>
        </View>
      );
    },
    [data, n, step, itemWidth, scrollX],
  );

  // Offsets leave out the side-padding header on purpose: initialScrollIndex
  // scrolls to this offset, and card s is centred at exactly s * step. The
  // render window is then off by under a card, which windowSize covers.
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: step, offset: index * step, index }),
    [step],
  );

  // A dot moves to that card within the loop the user is in now.
  const goTo = (i: number) => {
    const cur = Math.round(xRef.current / step);
    const base = cur - (((cur % n) + n) % n);
    listRef.current?.scrollToOffset({ offset: (base + i) * step, animated: true });
  };

  if (n === 0) return null;

  return (
    <View>
      <Animated.FlatList
        ref={listRef as any}
        data={slots}
        keyExtractor={(s: number) => `${keyRef.current(data[s % n], s % n)}:${Math.floor(s / n)}`}
        renderItem={renderSlot}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={startIndex}
        ListHeaderComponent={<View style={{ width: sidePad }} />}
        ListFooterComponent={<View style={{ width: Math.max(0, sidePad - gap) }} />}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={3}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => { if (settleTimer.current) clearTimeout(settleTimer.current); }}
        onScrollEndDrag={(e: any) => {
          const x = e.nativeEvent.contentOffset.x;
          const v = e.nativeEvent.velocity?.x ?? 0;
          if (Math.abs(v) < 0.1) settle(x);
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => settle(xRef.current), SETTLE_MS);
        }}
        onMomentumScrollBegin={() => { if (settleTimer.current) clearTimeout(settleTimer.current); }}
        onMomentumScrollEnd={(e: any) => settle(e.nativeEvent.contentOffset.x)}
        contentContainerStyle={{ alignItems: 'center' }}
      />

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
