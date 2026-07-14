// PremiumTravelLoading — RN port of the web's compass loader
// (travel-ai-nextjs/components/common/LoadingSpinner.jsx → PremiumTravelLoading).
//
// The web ships four variants (compass | plane | globe | minimal). We port the
// COMPASS — the web's default and the most on-brand — and do it properly rather
// than half-porting all four.
//
// Three moving parts, matching the web:
//   1. Compass      — outer ring counter-rotates (8s) while the needle sweeps (3s),
//                     over a slow "ping" halo. All transform/opacity → native driver.
//   2. Quote        — the 8 canonical travel quotes, cross-fading every 4s
//                     (500ms fade out → swap → fade in), exactly as the web does.
//   3. Progress bar — driven by the PARENT via `progress` (0–100). The parent
//                     ticks it to a 90% ceiling and only completes on the real
//                     response, so the bar never lies about being done.
//
// Reduced motion: when AccessibilityInfo reports it, we hold every animation at
// rest (static compass, no pulse) and swap the quote without the cross-fade.
// Follows the precedent in app/(tabs)/index.tsx.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

// Canonical quote list — copied verbatim from the web component.
const TRAVEL_QUOTES = [
  'Live your life by a compass, not a clock. – Stephen Covey',
  'The journey of a thousand miles begins with a single step. – Lao Tzu',
  'To travel is to discover that everyone is wrong about other countries. – Aldous Huxley',
  'Adventure is worthwhile in itself. – Amelia Earhart',
  'The goal is to die with memories, not dreams.',
  "Once a year, go someplace you've never been before. – Dalai Lama",
  'Not all those who wander are lost. – J.R.R. Tolkien',
  'Travel makes one modest. You see what a tiny place you occupy in the world. – Gustave Flaubert',
] as const;

// Brand palette (PRAYANA_DESIGN_SYSTEM.pdf — the logo is canonical).
const TEAL = '#4AC0CC';   // primary
const RED = '#E61417';    // secondary — the compass's north needle
const TEAL_DEEP = '#0d9488';

const SIZE = 128;
const QUOTE_INTERVAL = 4000;
const FADE_MS = 500;

type Props = {
  /** Headline under the compass. */
  message?: string;
  /** 0–100. The parent caps this at 90 until the real response lands. */
  progress?: number;
};

export function PremiumTravelLoading({
  message = 'Planning your perfect journey...',
  progress = 0,
}: Props) {
  const { themeColors } = useTheme();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Animated values — all driven natively (transform/opacity only).
  const ringSpin = useRef(new Animated.Value(0)).current;
  const needleSpin = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const quoteOpacity = useRef(new Animated.Value(1)).current;
  // Progress bar animates width -> cannot use the native driver.
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ---- reduced motion (same pattern as the home hero) ----
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (!cancelled) setReduceMotion(!!on); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) =>
      setReduceMotion(!!on)
    );
    return () => { cancelled = true; sub?.remove?.(); };
  }, []);

  // ---- compass animations ----
  useEffect(() => {
    if (reduceMotion) {
      ringSpin.stopAnimation();
      needleSpin.stopAnimation();
      halo.stopAnimation();
      ringSpin.setValue(0);
      needleSpin.setValue(0);
      halo.setValue(0);
      return;
    }

    // Outer ring: slow 8s rotation (web: animationDuration 8s).
    const ring = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Needle: 3s sweep (web: animation spin 3s linear infinite).
    const needle = Animated.loop(
      Animated.timing(needleSpin, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Halo: the web's `animate-ping` — scale out + fade.
    const ping = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    ring.start();
    needle.start();
    ping.start();
    return () => { ring.stop(); needle.stop(); ping.stop(); };
  }, [reduceMotion, ringSpin, needleSpin, halo]);

  // ---- rotating quote (cross-fade) ----
  useEffect(() => {
    const advance = () => setQuoteIndex((i) => (i + 1) % TRAVEL_QUOTES.length);

    if (reduceMotion) {
      // No cross-fade — just swap the text on the same cadence.
      const id = setInterval(advance, QUOTE_INTERVAL);
      return () => clearInterval(id);
    }

    const id = setInterval(() => {
      Animated.timing(quoteOpacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        advance();
        Animated.timing(quoteOpacity, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start();
      });
    }, QUOTE_INTERVAL);

    return () => clearInterval(id);
  }, [reduceMotion, quoteOpacity]);

  // ---- progress bar follows the parent ----
  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, progress));
    Animated.timing(progressAnim, {
      toValue: clamped,
      duration: reduceMotion ? 0 : 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // width interpolation
    }).start();
  }, [progress, progressAnim, reduceMotion]);

  const ringRotate = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const needleRotate = needleSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const barWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={message}>
      {/* Compass */}
      <View style={styles.compass}>
        {/* Pulsing halo */}
        <Animated.View
          style={[
            styles.halo,
            { transform: [{ scale: haloScale }], opacity: haloOpacity },
          ]}
        />

        {/* Outer rotating ring, with the N/S lugs the web draws */}
        <Animated.View style={[styles.ring, { transform: [{ rotate: ringRotate }] }]}>
          <View style={[styles.lug, styles.lugTop]} />
          <View style={[styles.lug, styles.lugBottom]} />
        </Animated.View>

        {/* Compass face */}
        <View style={[styles.face, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.cardinal, styles.cardN, { color: themeColors.textTertiary }]}>N</Text>
          <Text style={[styles.cardinal, styles.cardS, { color: themeColors.textTertiary }]}>S</Text>
          <Text style={[styles.cardinal, styles.cardW, { color: themeColors.textTertiary }]}>W</Text>
          <Text style={[styles.cardinal, styles.cardE, { color: themeColors.textTertiary }]}>E</Text>

          {/* Sweeping needle — red north half, teal south half */}
          <Animated.View
            style={[styles.needleWrap, { transform: [{ rotate: needleRotate }] }]}
          >
            <View style={styles.needleNorth} />
            <View style={styles.needleSouth} />
          </Animated.View>

          <View style={styles.hub} />
        </View>
      </View>

      {/* Message */}
      <Text style={[styles.message, { color: themeColors.text }]}>{message}</Text>

      {/* Progress bar — fills to the parent's ceiling (90%) and only completes
          when generation actually returns. */}
      <View style={[styles.track, { backgroundColor: themeColors.border }]}>
        <Animated.View style={[styles.fill, { width: barWidth }]}>
          <View style={styles.fillInner} />
        </Animated.View>
      </View>

      {/* Rotating quote */}
      <Animated.Text
        style={[styles.quote, { color: themeColors.textSecondary, opacity: quoteOpacity }]}
      >
        "{TRAVEL_QUOTES[quoteIndex]}"
      </Animated.Text>

      <View style={styles.tipRow}>
        <Ionicons name="sparkles-outline" size={12} color={themeColors.textTertiary} />
        <Text style={[styles.tip, { color: themeColors.textTertiary }]}>
          Crafting personalized recommendations just for you...
        </Text>
      </View>
    </View>
  );
}

export default PremiumTravelLoading;

const RING = SIZE;
const FACE = SIZE - 32;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.xl },

  compass: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  halo: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: TEAL,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 4,
    borderColor: `${TEAL}4D`, // 30% — matches the web's border-teal-500/30
  },
  lug: {
    position: 'absolute',
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 24,
    borderRadius: 6,
  },
  lugTop: { top: -8, backgroundColor: TEAL },
  lugBottom: { bottom: -8, backgroundColor: TEAL_DEEP },

  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // shadow + elevation are the deliberate RN port — keep both.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  cardinal: { position: 'absolute', fontSize: 10, fontWeight: fontWeight.bold },
  cardN: { top: 4 },
  cardS: { bottom: 4 },
  cardW: { left: 6 },
  cardE: { right: 6 },

  needleWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 4,
    height: FACE - 24,
  },
  needleNorth: {
    flex: 1,
    width: 4,
    backgroundColor: RED,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  needleSouth: {
    flex: 1,
    width: 4,
    backgroundColor: TEAL,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  hub: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: TEAL_DEEP,
    borderWidth: 2,
    borderColor: '#fff',
  },

  message: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  track: {
    width: 220,
    height: 5,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  fill: { height: '100%', borderRadius: borderRadius.full, overflow: 'hidden' },
  fillInner: { flex: 1, backgroundColor: TEAL },

  quote: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
    minHeight: 60,
    marginBottom: spacing.md,
  },

  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tip: { fontSize: fontSize.xs, textAlign: 'center' },
});
