// AnimatedSplash — the cinematic launch animation, the mobile counterpart of the
// web/PWA components/common/SplashScreen.jsx. The mobile app previously just
// showed a static Expo splash image; this brings the branded animation: a dark
// teal field, orbiting rings around a glowing glass logo, a floating Prayana
// mark, gradient "Prayana AI" wordmark, tagline, and an animated progress bar.
//
// Shown as a full-screen overlay AFTER the native splash hides, then fades out.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PrayanaLogo } from '@prayana/shared-ui';

const { width: W, height: H } = Dimensions.get('window');

const TEAL = '#4AC0CC';
const FLAME = '#FB923C';
const RED = '#E61417';

interface Props {
  /** Fired when the splash has fully faded out and should unmount. */
  onDone: () => void;
  /** Total on-screen time before it starts fading (ms). */
  duration?: number;
}

export const AnimatedSplash: React.FC<Props> = ({ onDone, duration = 2600 }) => {
  // Entrance (logo scale/opacity), continuous loops (orbits, float, glow,
  // shimmer), and the outro fade.
  const enter = useRef(new Animated.Value(0)).current;
  const orbit1 = useRef(new Animated.Value(0)).current;
  const orbit2 = useRef(new Animated.Value(0)).current;
  const orbit3 = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Entrance
    Animated.timing(enter, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();

    // Looping ambience
    const spin = (v: Animated.Value, ms: number, reverse = false) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: reverse ? -1 : 1,
          duration: ms,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
    const pulse = (v: Animated.Value, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    const loops = [
      spin(orbit1, 10000),
      spin(orbit2, 14000, true),
      spin(orbit3, 18000),
      pulse(floatY, 2000),
      pulse(glow, 1600),
    ];
    loops.forEach((l) => l.start());

    // Eased progress bar (fast start, slow finish) — cosmetic, matches the web.
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + Math.max(0.5, (100 - p) * 0.08));
      setProgress(p);
      if (p >= 100) clearInterval(iv);
    }, duration / 60);

    // Outro fade → unmount
    const outro = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDone());
    }, duration);

    return () => {
      loops.forEach((l) => l.stop());
      clearInterval(iv);
      clearTimeout(outro);
    };
  }, []);

  const rot = (v: Animated.Value) =>
    v.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const logoScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const floatTranslate = floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      {/* Dark teal radial-ish field (RN has no radial gradient — layered vertical). */}
      <LinearGradient colors={['#0F2D30', '#091A1C', '#050D0F', '#020808']} style={StyleSheet.absoluteFill} />

      {/* Logo cluster */}
      <Animated.View style={[styles.cluster, { opacity: enter, transform: [{ scale: logoScale }] }]}>
        {/* Orbit rings */}
        <Animated.View style={[styles.ring, styles.ring1, { transform: [{ rotate: rot(orbit1) }] }]}>
          <View style={[styles.orbDot, { backgroundColor: TEAL, top: -3 }]} />
        </Animated.View>
        <Animated.View style={[styles.ring, styles.ring2, { transform: [{ rotate: rot(orbit2) }] }]}>
          <View style={[styles.orbDot, { backgroundColor: FLAME, bottom: -2, width: 4, height: 4 }]} />
        </Animated.View>
        <Animated.View style={[styles.ring, styles.ring3, { transform: [{ rotate: rot(orbit3) }] }]}>
          <View style={[styles.orbDot, { backgroundColor: RED, top: -1.5, width: 3, height: 3 }]} />
        </Animated.View>

        {/* Glow behind the logo */}
        <Animated.View
          style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />

        {/* Glass logo container with the floating Prayana mark */}
        <View style={styles.glass}>
          <Animated.View style={{ transform: [{ translateY: floatTranslate }] }}>
            <PrayanaLogo size={62} />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Wordmark */}
      <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        <Text style={styles.brand}>
          <Text style={styles.brandPrayana}>Prayana</Text>
          <Text style={styles.brandAI}> AI</Text>
        </Text>
        <View style={styles.divider} />
        <Text style={styles.tagline}>YOUR INTELLIGENT JOURNEY COMPANION</Text>
      </Animated.View>

      {/* Progress bar */}
      <Animated.View style={[styles.progressWrap, { opacity: enter }]}>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[TEAL, '#5ED8E4', FLAME, RED]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {progress < 25 ? 'INITIALIZING' : progress < 50 ? 'LOADING ROUTES' : progress < 75 ? 'PREPARING AI' : progress < 100 ? 'ALMOST THERE' : 'READY'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

export default AnimatedSplash;

const RING1 = 190;
const RING2 = 168;
const RING3 = 148;
const GLASS = 128;

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  cluster: { width: RING1, height: RING1, alignItems: 'center', justifyContent: 'center', marginBottom: 48 },

  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  ring1: { width: RING1, height: RING1, borderColor: 'rgba(74,192,204,0.16)' },
  ring2: { width: RING2, height: RING2, borderColor: 'rgba(251,146,60,0.12)', justifyContent: 'flex-end' },
  ring3: { width: RING3, height: RING3, borderColor: 'rgba(230,20,23,0.10)' },
  orbDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: TEAL,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(74,192,204,0.10)',
  },
  glass: {
    width: GLASS,
    height: GLASS,
    borderRadius: GLASS / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,20,22,0.96)',
    borderWidth: 1.5,
    borderColor: 'rgba(74,192,204,0.22)',
    shadowColor: TEAL,
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },

  brand: { textAlign: 'center', fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  brandPrayana: { color: TEAL },
  brandAI: { color: 'rgba(255,255,255,0.95)' },
  divider: {
    alignSelf: 'center',
    width: 110,
    height: 1,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: 'rgba(74,192,204,0.35)',
  },
  tagline: {
    textAlign: 'center',
    color: 'rgba(74,192,204,0.5)',
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '300',
  },

  progressWrap: { position: 'absolute', bottom: H * 0.14, width: 240, alignItems: 'center' },
  progressTrack: {
    width: '100%',
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(74,192,204,0.10)',
    overflow: 'hidden',
  },
  progressFill: { height: 2, borderRadius: 2 },
  progressLabel: {
    marginTop: 10,
    color: 'rgba(74,192,204,0.4)',
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '500',
  },
});
