// The eSIM landing hero, ported from the web's components/esim/
// EsimSpotlightHero.jsx: a poster card for one popular destination (photo,
// eSIM pill, gold SIM chip, flag, name) that moves on every four seconds over
// a soft, blurred wash of the same photo; the headline, three trust chips, and
// a "{Country} plans" button that opens that country. Swipe the poster to move
// on sooner; the dots jump straight to one.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { CountryFlag } from './CountryFlag';
import { EsimPill, SimChip, ESIM_RED } from './EsimPass';
import { countryImage } from '../../lib/countryAssets';

const INTERVAL = 4000;

export type SpotlightCountry = { iso: string; name: string };

export function EsimSpotlightHero({ countries, onPick, topBar }: {
  /** Destinations to cycle through (each needs a photo). */
  countries: SpotlightCountry[];
  onPick: (iso: string) => void;
  /** Back button and "My eSIMs", drawn over the hero. */
  topBar?: React.ReactNode;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const list = useMemo(() => countries.filter((c) => countryImage(c.iso)), [countries]);
  const [at, setAt] = useState(0);
  const atRef = useRef(0);
  const fade = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lenRef = useRef(list.length);
  lenRef.current = list.length;

  // Fade out, swap the destination, fade back in.
  const go = (next: number) => {
    const len = lenRef.current;
    if (!len) return;
    const n = (next + len) % len;
    Animated.timing(fade, { toValue: 0.25, duration: 160, useNativeDriver: true }).start(() => {
      atRef.current = n;
      setAt(n);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };
  const goRef = useRef(go);
  goRef.current = go;
  const restart = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => goRef.current(atRef.current + 1), INTERVAL);
  };
  // Fetch every poster up front, so a step never lands on an empty card while
  // its photo downloads.
  useEffect(() => {
    const urls = list.flatMap((c) => [countryImage(c.iso, 700), countryImage(c.iso, 400)]).filter(Boolean) as string[];
    if (urls.length) Image.prefetch(urls, 'memory-disk').catch(() => {});
  }, [list]);

  useEffect(() => {
    if (list.length < 2) return;
    restart();
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  // A horizontal swipe on the poster steps it; a vertical one is left to the page.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 40) return;
        goRef.current(atRef.current + (g.dx < 0 ? 1 : -1));
        restart();
      },
    }),
  ).current;

  const cur = list[at] ?? list[0];
  const posterW = Math.min(250, Math.round(width * 0.62));
  const ink = isDarkMode ? '#fff' : '#111827';
  const soft = isDarkMode ? 'rgba(255,255,255,0.75)' : '#4b5563';

  return (
    <View style={s.wrap}>
      {/* The blurred wash behind everything. */}
      {cur ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Image source={{ uri: countryImage(cur.iso, 400)! }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} cachePolicy="memory-disk" />
        </Animated.View>
      ) : null}
      <LinearGradient
        colors={isDarkMode
          ? ['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.82)', themeColors.background]
          : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.82)', themeColors.background]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {topBar}

      {cur ? (
        <Animated.View style={{ opacity: fade, alignItems: 'center' }} {...pan.panHandlers}>
          <Pressable
            onPress={() => onPick(cur.iso)}
            accessibilityRole="button"
            accessibilityLabel={`${cur.name} eSIM plans`}
            style={[s.poster, { width: posterW, height: Math.round(posterW * 4 / 3) }]}
          >
            <Image source={{ uri: countryImage(cur.iso, 700)! }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.posterPill}><EsimPill /></View>
            <View style={s.posterChip}><SimChip scale={1.2} /></View>
            <View style={s.posterFoot}>
              <CountryFlag countryCode={cur.iso} size={34} />
              <Text style={s.posterName} numberOfLines={1}>{cur.name}</Text>
              <View style={s.posterSubRow}>
                <View style={s.posterBar} />
                <Text style={s.posterSub}>Data from the moment you land</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <View style={s.copy}>
        <View style={s.eyebrow}>
          <Ionicons name="phone-portrait-outline" size={11} color={ESIM_RED} />
          <Text style={s.eyebrowText}>TRAVEL ESIM</Text>
        </View>
        <Text style={[s.title, { color: ink }]}>Stay connected</Text>
        <Text style={[s.title, { color: ink }]}>
          <Text style={{ color: ESIM_RED }}>everywhere</Text> you go
        </Text>
        <Text style={[s.sub, { color: soft }]}>Data plans for 190+ countries. Instant activation, no SIM swap.</Text>

        <View style={s.chips}>
          {([
            { icon: 'flash', color: '#f59e0b', label: 'Activate in minutes' },
            { icon: 'cellular', color: '#10b981', label: '4G / 5G networks' },
            { icon: 'shield-checkmark', color: '#0ea5e9', label: 'Keep your number' },
          ] as const).map((c) => (
            <View key={c.label} style={[s.chip, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)', borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)' }]}>
              <Ionicons name={c.icon} size={12} color={c.color} />
              <Text style={[s.chipText, { color: ink }]}>{c.label}</Text>
            </View>
          ))}
        </View>

        {cur ? (
          <Pressable onPress={() => onPick(cur.iso)} style={[s.cta, { backgroundColor: isDarkMode ? '#fff' : '#111827' }]} accessibilityRole="button">
            <CountryFlag countryCode={cur.iso} size={18} />
            <Text style={[s.ctaText, { color: isDarkMode ? '#111827' : '#fff' }]} numberOfLines={1}>{cur.name} plans</Text>
            <Ionicons name="arrow-forward" size={15} color={isDarkMode ? '#111827' : '#fff'} />
          </Pressable>
        ) : null}

        {list.length > 1 ? (
          <View style={s.dots}>
            {list.map((c, i) => (
              <Pressable key={c.iso} onPress={() => { go(i); restart(); }} hitSlop={6} accessibilityLabel={`Show ${c.name}`}>
                <View style={[s.dot, i === at && s.dotOn]} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingBottom: 44, overflow: 'hidden' },
  poster: {
    borderRadius: 26, overflow: 'hidden', backgroundColor: '#1f2937', marginTop: 4,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0f172a', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  posterPill: { position: 'absolute', top: 14, left: 14 },
  posterChip: { position: 'absolute', top: 14, right: 14 },
  posterFoot: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 6 },
  posterName: {
    color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  posterSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  posterBar: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#f59e0b' },
  posterSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' },

  copy: { alignItems: 'center', paddingHorizontal: 20, marginTop: 22 },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(230,20,23,0.25)',
    backgroundColor: 'rgba(230,20,23,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12,
  },
  eyebrowText: { color: ESIM_RED, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center', lineHeight: 36 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13,
    shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  ctaText: { fontSize: 15, fontWeight: '800', maxWidth: 220 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.55)' },
  dotOn: { width: 18, backgroundColor: ESIM_RED },
});
