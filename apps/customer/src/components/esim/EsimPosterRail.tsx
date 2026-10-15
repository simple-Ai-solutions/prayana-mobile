// The eSIM page's lead: one wide poster per popular destination, swiped
// sideways a poster at a time. Each is a full-bleed photo with a dark fall-off,
// a tag earned from the live data (#1 trending, % off, 5G ready), the gold SIM
// chip, the flag and name in large type, the live "from" price, and a "See
// plans" button. It never moves by itself: the page only moves when you do.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CountryFlag } from './CountryFlag';
import { EsimPill, SimChip, ESIM_RED, inr } from './EsimPass';
import { countryImage } from '../../lib/countryAssets';
import { FULL_W, RAIL_GAP, RAIL_PAD, usePairSnap } from '../../lib/railLayout';

export type PosterDeal = { fromINR?: number; dataLabel?: string; planCount?: number; discountPercent?: number; has5G?: boolean };

const POSTER_H = 210;
const STEP = FULL_W + RAIL_GAP;

function tagFor(i: number, d?: PosterDeal): { text: string; icon: keyof typeof Ionicons.glyphMap; colors: [string, string] } {
  if (d?.discountPercent && d.discountPercent > 0) return { text: `${Math.round(d.discountPercent)}% OFF`, icon: 'pricetag', colors: [ESIM_RED, '#B91C1C'] };
  if (i === 0) return { text: '#1 TRENDING', icon: 'flame', colors: ['#F97316', ESIM_RED] };
  if (d?.has5G) return { text: '5G READY', icon: 'flash', colors: ['#10B981', '#047857'] };
  return { text: 'TRAVELLER FAVOURITE', icon: 'heart', colors: ['#F5B400', '#D97706'] };
}

export function EsimPosterRail({ countries, deals, onPick }: {
  countries: { iso: string; name: string }[];
  deals: Record<string, PosterDeal | undefined>;
  onPick: (iso: string) => void;
}) {
  const snap = usePairSnap(STEP);
  const [at, setAt] = useState(0);
  const list = countries.filter((c) => countryImage(c.iso));
  if (!list.length) return <View style={{ height: POSTER_H }} />;

  return (
    <View>
      <ScrollView
        ref={snap.setRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: RAIL_PAD, gap: RAIL_GAP }}
        {...snap.props}
        onMomentumScrollEnd={(e) => { snap.props.onMomentumScrollEnd(e); setAt(Math.round(e.nativeEvent.contentOffset.x / STEP)); }}
        onScrollEndDrag={(e) => { snap.props.onScrollEndDrag(e); setAt(Math.round(e.nativeEvent.contentOffset.x / STEP)); }}
      >
        {list.map((c, i) => {
          const d = deals[c.iso];
          const tag = tagFor(i, d);
          return (
            <Pressable
              key={c.iso}
              onPress={() => onPick(c.iso)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} eSIM${d?.fromINR ? `, from ${inr(d.fromINR)}` : ''}`}
              style={({ pressed }) => [s.poster, pressed && { transform: [{ scale: 0.985 }] }]}
            >
              <LinearGradient colors={['#1f2937', '#0b0b0b']} style={StyleSheet.absoluteFill} />
              <Image source={{ uri: countryImage(c.iso, 900)! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
              <LinearGradient
                colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />

              <View style={s.topRow}>
                <EsimPill />
                <LinearGradient colors={tag.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tag}>
                  <Ionicons name={tag.icon} size={10} color="#fff" />
                  <Text style={s.tagText}>{tag.text}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }} />
                <SimChip scale={1.1} />
              </View>

              <View style={s.foot}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.nameRow}>
                    <CountryFlag countryCode={c.iso} size={26} />
                    <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                  </View>
                  <Text style={s.price} numberOfLines={1}>
                    {d?.fromINR ? (
                      <>
                        <Text style={s.from}>from </Text>
                        {inr(d.fromINR)}
                        {d.dataLabel ? <Text style={s.from}> / {d.dataLabel}</Text> : null}
                      </>
                    ) : (
                      <Text style={s.from}>Data from the moment you land</Text>
                    )}
                  </Text>
                  {d?.planCount ? <Text style={s.meta}>{d.planCount} plans · instant QR · keep your number</Text> : null}
                </View>
                <View style={s.cta}>
                  <Text style={s.ctaText}>See plans</Text>
                  <Ionicons name="arrow-forward" size={14} color="#111827" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {list.length > 1 ? (
        <View style={s.dots}>
          {list.map((c, i) => <View key={c.iso} style={[s.dot, i === at && s.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  poster: {
    width: FULL_W, height: POSTER_H, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  topRow: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  foot: { position: 'absolute', left: 16, right: 14, bottom: 15, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flexShrink: 1, color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.9,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  price: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  from: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  ctaText: { color: '#111827', fontSize: 13, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.5)' },
  dotOn: { width: 18, backgroundColor: ESIM_RED },
});
