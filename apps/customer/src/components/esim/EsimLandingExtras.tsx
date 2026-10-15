// Landing-page sections ported from the web's app/esim/page.jsx:
//   - EsimOfferTicker: the compact EsimOfferBanner, a red-edged ticket whose
//     perks scroll past, with "Buy now" pinned on the right;
//   - EsimWhyCard: "Why Prayana eSIM — Global coverage, seamless experience";
//   - EsimAllDestinations: "All other destinations", round photo pills.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { CountryFlag } from './CountryFlag';
import { ESIM_RED } from './EsimPass';
import { countryImage } from '../../lib/countryAssets';

/* ─── Offer ticker ─── */

const PERKS: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string; strong?: string; pill?: string }[] = [
  { icon: 'ribbon', color: '#F5B400', text: 'Every eSIM = 1 month VIP ', strong: 'free', pill: '₹999 VALUE' },
  { icon: 'sparkles', color: ESIM_RED, text: '+50 Planner Credits' },
  { icon: 'infinite', color: '#F5B400', text: 'Unlimited itineraries' },
  { icon: 'shield-checkmark', color: '#10b981', text: 'SOS + Trip Planner' },
];

export function EsimOfferTicker({ onBuy }: { onBuy: () => void }) {
  const { themeColors } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -w, duration: w * 28, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [w, x]);

  const row = (key: string, measure?: boolean) => (
    <View key={key} style={s.tickRow} onLayout={measure ? (e) => setW(e.nativeEvent.layout.width) : undefined}>
      {PERKS.map((p) => (
        <View key={p.text} style={s.perk}>
          <Ionicons name={p.icon} size={13} color={p.color} />
          <Text style={[s.perkText, { color: themeColors.text }]}>
            {p.text}
            {p.strong ? <Text style={{ color: '#d97706', fontWeight: '800' }}>{p.strong}</Text> : null}
          </Text>
          {p.pill ? <View style={s.valuePill}><Text style={s.valuePillText}>{p.pill}</Text></View> : null}
          <View style={s.sep} />
        </View>
      ))}
    </View>
  );

  return (
    <Pressable onPress={onBuy} style={[s.ticket, { backgroundColor: themeColors.surface }]} accessibilityRole="button"
      accessibilityLabel="Every eSIM comes with one month of VIP free, worth ₹999. Buy now">
      <View style={s.tickClip}>
        <Animated.View style={[s.tickTrack, { transform: [{ translateX: x }] }]}>
          {row('a', true)}
          {row('b')}
        </Animated.View>
        <LinearGradient colors={[themeColors.surface, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.fadeL} pointerEvents="none" />
      </View>
      <View style={s.buy}>
        <Text style={s.buyText}>Buy now</Text>
        <Ionicons name="arrow-forward" size={12} color="#fff" />
      </View>
    </Pressable>
  );
}

/* ─── Why Prayana eSIM ─── */

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; colors: [string, string]; title: string; body: string }[] = [
  { icon: 'flash', colors: ['#f97316', ESIM_RED], title: 'Instant activation', body: 'QR delivered in 30s. Activates the moment you land.' },
  { icon: 'stats-chart', colors: ['#10b981', '#059669'], title: 'True 5G across 80+ countries', body: 'Falls back to 4G LTE — never to 3G or worse.' },
  { icon: 'globe-outline', colors: ['#38bdf8', '#2563eb'], title: '200+ destinations covered', body: 'Single eSIM works in every country we support.' },
  { icon: 'card-outline', colors: ['#a78bfa', '#7c3aed'], title: 'Top-ups from inside the app', body: 'Run out of data? Add more. Same eSIM, no new QR.' },
];

export function EsimWhyCard({ onBrowse, onHowItWorks }: { onBrowse: () => void; onHowItWorks?: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <View style={[s.why, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}>
      <LinearGradient colors={[ESIM_RED, '#f97316', '#fbbf24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.whyStripe} />
      <View style={s.whyEyebrow}>
        <View style={s.whyEyebrowDot}><Ionicons name="wifi" size={9} color="#fff" /></View>
        <Text style={s.whyEyebrowText}>WHY PRAYANA ESIM</Text>
      </View>
      <Text style={[s.whyTitle, { color: themeColors.text }]}>Global coverage,</Text>
      <Text style={[s.whyTitle, { color: ESIM_RED }]}>seamless experience.</Text>
      <Text style={[s.whyBody, { color: themeColors.textSecondary }]}>
        Whether you're hopping between temples in Thailand, closing a deal in Singapore, or unwinding on a Bali
        beach — Prayana keeps you connected without ever touching a physical SIM.
      </Text>
      <View style={{ gap: 10, marginTop: 16 }}>
        {FEATURES.map((f) => (
          <View key={f.title} style={[s.feat, { borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }]}>
            <LinearGradient colors={f.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.featIcon}>
              <Ionicons name={f.icon} size={18} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.featTitle, { color: themeColors.text }]}>{f.title}</Text>
              <Text style={[s.featBody, { color: themeColors.textSecondary }]}>{f.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={onBrowse} accessibilityRole="button" style={{ marginTop: 18 }}>
        <LinearGradient colors={['#FF3344', ESIM_RED, '#C30E11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.whyCta}>
          <Text style={s.whyCtaText}>Browse all destinations</Text>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
        </LinearGradient>
      </Pressable>
      {onHowItWorks ? (
      <Pressable onPress={onHowItWorks} style={[s.howBtn, { borderColor: themeColors.border }]} accessibilityRole="button">
          <Ionicons name="play" size={12} color={themeColors.text} />
          <Text style={[s.howText, { color: themeColors.text }]}>How it works · 30s</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ─── All other destinations ─── */

export function EsimAllDestinations({ countries, onPick, onSearch }: {
  countries: { iso: string; name: string }[];
  onPick: (iso: string) => void;
  onSearch: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  if (!countries.length) return null;
  return (
    <View>
      <View style={s.allHead}>
        <LinearGradient colors={['#38bdf8', '#2563eb']} style={s.allIcon}>
          <Ionicons name="globe-outline" size={20} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.allTitle, { color: themeColors.text }]}>
            All other <Text style={{ color: ESIM_RED }}>destinations</Text>
          </Text>
          <Text style={[s.allSub, { color: themeColors.textSecondary }]}>{countries.length} countries · instant eSIM delivery</Text>
        </View>
      </View>
      <Pressable onPress={onSearch} style={[s.searchAny, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]} accessibilityRole="button">
        <Ionicons name="search" size={14} color={themeColors.text} />
        <Text style={[s.searchAnyText, { color: themeColors.text }]}>Search any country</Text>
      </Pressable>
      <View style={s.allGrid}>
        {countries.map((c) => {
          const img = countryImage(c.iso, 160);
          return (
            <Pressable
              key={c.iso}
              onPress={() => onPick(c.iso)}
              style={({ pressed }) => [s.allPill, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} eSIM plans`}
            >
              <View style={s.allThumb}>
                {img ? (
                  <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, s.allThumbFlag]}><CountryFlag countryCode={c.iso} size={26} /></View>
                )}
              </View>
              {img ? <View style={s.allFlag}><CountryFlag countryCode={c.iso} size={16} /></View> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.allName, { color: themeColors.text }]} numberOfLines={1}>{c.name}</Text>
                <Text style={[s.allLink, { color: themeColors.textSecondary }]}>View plans →</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ticket: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: ESIM_RED, borderRadius: 14,
    paddingLeft: 10, paddingRight: 5, paddingVertical: 5, overflow: 'hidden',
  },
  tickClip: { flex: 1, overflow: 'hidden', height: 26, justifyContent: 'center' },
  tickTrack: { flexDirection: 'row', position: 'absolute', left: 0 },
  tickRow: { flexDirection: 'row', alignItems: 'center' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perkText: { fontSize: 12.5, fontWeight: '600' },
  valuePill: { backgroundColor: ESIM_RED, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  valuePillText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  sep: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(230,20,23,0.45)', marginHorizontal: 12 },
  fadeL: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 12 },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ESIM_RED, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, marginLeft: 6 },
  buyText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },

  why: { borderRadius: 24, borderWidth: 1, padding: 20, paddingTop: 24, overflow: 'hidden' },
  whyStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  whyEyebrow: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(230,20,23,0.25)',
    backgroundColor: 'rgba(230,20,23,0.07)', borderRadius: 999, paddingLeft: 3, paddingRight: 10, paddingVertical: 3, marginBottom: 12,
  },
  whyEyebrowDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: ESIM_RED, alignItems: 'center', justifyContent: 'center' },
  whyEyebrowText: { color: ESIM_RED, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  whyTitle: { fontSize: 27, fontWeight: '800', letterSpacing: -0.7, lineHeight: 32 },
  whyBody: { fontSize: 14, lineHeight: 21, marginTop: 12 },
  feat: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  featIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 14.5, fontWeight: '700' },
  featBody: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  whyCta: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13 },
  whyCtaText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  howBtn: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12 },
  howText: { fontSize: 13, fontWeight: '700' },

  allHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  allIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  allTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  allSub: { fontSize: 12.5, marginTop: 2 },
  searchAny: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  searchAnyText: { fontSize: 13, fontWeight: '700' },
  allGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 14 },
  allPill: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 8 },
  allThumb: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  allThumbFlag: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  allFlag: { position: 'absolute', left: 36, top: 36 },
  allName: { fontSize: 13.5, fontWeight: '700' },
  allLink: { fontSize: 11, marginTop: 1 },
});
