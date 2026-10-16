// One size for every horizontal card rail: two whole cards and a slice of the
// third peeking in at the right edge. With exactly two whole cards a rail
// looked complete, and first-time users never found that it scrolls; the
// peeking card (Swiggy, Zomato, Airbnb, Netflix do the same) says "there's
// more". The rail snaps two cards at a time (TWO_UP_SNAP) so it always rests
// on a full pair with the next one peeking.
// Rails whose card cannot work at half width (the group-departure pass with
// its date chips) use FULL_W, one whole card.
import { useRef } from 'react';
import { Dimensions, ScrollView } from 'react-native';

export const RAIL_PAD = 16;
export const RAIL_GAP = 16;

const SCREEN_W = Dimensions.get('window').width;

/** How many cards a two-up rail shows: two whole, a quarter of the third. */
const TWO_UP_VISIBLE = 2.25;

/** Width of a card in a two-up rail. */
export const TWO_UP_W = Math.floor((SCREEN_W - RAIL_PAD - RAIL_GAP * 2) / TWO_UP_VISIBLE);

/** Scroll distance that moves a two-up rail on by one full pair. */
export const TWO_UP_SNAP = 2 * (TWO_UP_W + RAIL_GAP);

/** Width of the centre card in a spotlight carousel; neighbours peek either side. */
export const SPOTLIGHT_W = Math.round(SCREEN_W * 0.62);

/** Width of a card in a one-up rail. */
export const FULL_W = Math.floor(SCREEN_W - RAIL_PAD * 2);

/**
 * Snaps a horizontal rail to whole steps of `step` points once a swipe ends.
 *
 * Done by hand rather than with snapToInterval: on Android a horizontal
 * ScrollView with snapToInterval makes the vertical page around it jump down
 * on its own while content loads. Spread the returned props on the rail, and
 * pass `ref` to it (or call `setRef` from your own ref callback).
 */
export function usePairSnap(step: number) {
  const ref = useRef<ScrollView | null>(null);
  const settle = (x: number) => {
    const target = Math.round(x / step) * step;
    if (Math.abs(target - x) > 1) ref.current?.scrollTo({ x: target, animated: true });
  };
  const props = {
    // A drag with no fling ends here; a fling ends in onMomentumScrollEnd.
    onScrollEndDrag: (e: any) => {
      const v = e.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(v) < 0.1) settle(e.nativeEvent.contentOffset.x);
    },
    onMomentumScrollEnd: (e: any) => settle(e.nativeEvent.contentOffset.x),
  };
  return { ref, props, setRef: (n: ScrollView | null) => { ref.current = n; } };
}
