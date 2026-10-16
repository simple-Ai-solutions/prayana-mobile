// Markets & Shopping — a bazaar-themed page: warm spice palette (saffron,
// turmeric, chilli), a sticky row
// of city chips built from the results themselves, a spotlight of the best-
// rated market tours and the rest as a poster grid. Light surface on purpose:
// this is a daytime, colourful page (Nightlife is the dark one).
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SpotlightCarousel } from '../home/SpotlightCarousel';

const CREAM = '#FFF8EE';
const INK = '#2B1A10';
const SAFFRON = '#F59E0B';
const CHILLI = '#E2462B';
const TEAL = '#0F766E';
const W = Dimensions.get('window').width;
const SPOT_W = Math.round(W * 0.72);
const GRID_W = Math.floor((W - 16 * 2 - 12) / 2);

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿',
  AUD: 'A$', JPY: '¥', MYR: 'RM ', IDR: 'Rp ', CHF: 'CHF ', CAD: 'C$',
};
const priceText = (a: any): string | null => {
  const p = a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? null;
  if (p == null || !(Number(p) > 0)) return null;
  const code = String(a.pricing?.currency || a.currency || 'INR').toUpperCase();
  return `${SYMBOLS[code] ?? `${code} `}${Math.round(Number(p)).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US')}`;
};
const imgOf = (a: any): string | null => a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
const cityOf = (a: any): string => a.location?.city || a.externalData?.city?.name || '';
const ratingOf = (a: any): number => Number(a.rating?.average ?? a.rating ?? 0) || 0;
const reviewsOf = (a: any): number => Number(a.rating?.count ?? a.reviewCount ?? 0) || 0;
const open = (a: any) => a?._id && router.push(`/activity/${a._id}` as any);
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

function MarketPoster({ a, width, big }: { a: any; width: number; big?: boolean }) {
  const img = imgOf(a);
  const price = priceText(a);
  const rating = ratingOf(a);
  const reviews = reviewsOf(a);
  const city = cityOf(a);
  const dur = a.duration?.label;
  return (
    <Pressable
      onPress={() => open(a)}
      accessibilityRole="button"
      accessibilityLabel={[a.title, city, price && `from ${price}`].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.card, { width }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.photo, { aspectRatio: big ? 1.05 : 0.95 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)']} locations={[0, 0.4]} style={StyleSheet.absoluteFill} />
        {!!city && (
          <View style={styles.cityTag}>
            <Ionicons name="location" size={11} color="#fff" />
            <Text style={styles.cityTagText} numberOfLines={1}>{city}</Text>
          </View>
        )}
        {!!dur && (
          <View style={styles.durTag}>
            <Ionicons name="time-outline" size={11} color={INK} />
            <Text style={styles.durText}>{dur}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, big && styles.titleBig]} numberOfLines={2}>{a.title}</Text>
        {rating > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={SAFFRON} />
            <Text style={styles.ratingText}>
              {rating.toFixed(1)}{reviews > 0 ? <Text style={styles.reviews}>  ({compact(reviews)})</Text> : null}
            </Text>
          </View>
        )}
        <View style={styles.priceRow}>
          {price ? (
            <View>
              <Text style={styles.from}>from</Text>
              <Text style={styles.price}>{price}</Text>
            </View>
          ) : <View />}
          <View style={styles.cta}>
            <Ionicons name="bag-handle" size={14} color="#fff" />
            {big && <Text style={styles.ctaText}>Book</Text>}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Label({ text }: { text: string }) {
  return (
    <View style={styles.labelRow}>
      <View style={styles.labelLine} />
      <Text style={styles.labelText}>{text.toUpperCase()}</Text>
      <View style={styles.labelLine} />
    </View>
  );
}

export function MarketsView({
  items, total, loading, hasMore, loadingMore, onLoadMore, image, refreshControl,
}: {
  items: any[]; total: number; loading: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; image: string; refreshControl?: React.ReactElement<any>;
}) {
  const [city, setCity] = useState('All');
  // City chips come from the results, busiest cities first.
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((a) => { const c = cityOf(a); if (c) counts.set(c, (counts.get(c) || 0) + 1); });
    return ['All', ...[...counts.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c).slice(0, 10)];
  }, [items]);
  const shown = useMemo(() => (city === 'All' ? items : items.filter((a) => cityOf(a) === city)), [items, city]);
  const spotlight = useMemo(
    () => [...shown].filter(imgOf).sort((x, y) => reviewsOf(y) * ratingOf(y) - reviewsOf(x) * ratingOf(x)).slice(0, 6),
    [shown],
  );
  const spotIds = new Set(spotlight.map((a) => a._id));
  const rest = shown.filter((a) => !spotIds.has(a._id));

  return (
    <ScrollView
      style={{ backgroundColor: CREAM }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      refreshControl={refreshControl}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={['rgba(43,26,16,0.25)', 'rgba(43,26,16,0.55)', 'rgba(43,26,16,0.92)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.backWrap}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/activities'))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.back}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.eyebrowPill}>
            <Ionicons name="bag-handle" size={12} color={INK} />
            <Text style={styles.eyebrowText}>BAZAAR TRAILS</Text>
          </View>
          <Text style={styles.headline}>
            Haggle, taste,{'\n'}<Text style={{ color: SAFFRON }}>shop like a local.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Souks, spice markets, handicraft lanes & night bazaars{total ? ` · ${total} tours` : ''}
          </Text>
        </View>
      </View>

      {/* Sticky city chips */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {cities.map((c) => {
            const on = c === city;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCity(c)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                {c !== 'All' && <Ionicons name="location-outline" size={13} color={on ? '#fff' : TEAL} />}
                <Text style={[styles.chipText, on && { color: '#fff' }]}>{c === 'All' ? 'All markets' : c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View>
        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color={CHILLI} /></View>
        ) : shown.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="bag-outline" size={40} color="rgba(43,26,16,0.35)" />
            <Text style={styles.stateText}>No market tours here yet.</Text>
          </View>
        ) : (
          <>
            {spotlight.length > 0 && (
              <View style={styles.block}>
                <Label text="Most-loved bazaar walks" />
                <SpotlightCarousel
                  data={spotlight}
                  keyExtractor={(a) => String(a._id)}
                  itemWidth={SPOT_W}
                  accent={CHILLI}
                  renderItem={(a, _i, width) => <MarketPoster a={a} width={width} big />}
                />
              </View>
            )}
            {rest.length > 0 && (
              <View style={styles.block}>
                <Label text="Browse every stall" />
                <View style={styles.grid}>
                  {rest.map((a, i) => <MarketPoster key={a._id || i} a={a} width={GRID_W} />)}
                </View>
              </View>
            )}
            {hasMore && city === 'All' && (
              <TouchableOpacity onPress={onLoadMore} disabled={loadingMore} style={styles.more} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator size="small" color={CHILLI} /> : <Text style={styles.moreText}>Show more</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 320, justifyContent: 'flex-end', paddingTop: 68 },
  backWrap: { position: 'absolute', top: 12, left: 16, zIndex: 2 },
  back: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  heroBody: { paddingHorizontal: 16, paddingBottom: 22 },
  eyebrowPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SAFFRON, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  eyebrowText: { color: INK, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  headline: { marginTop: 10, color: '#fff', fontSize: 34, lineHeight: 37, fontWeight: '900', letterSpacing: -1.2 },
  heroSub: { marginTop: 8, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },


  chipBar: { backgroundColor: CREAM, paddingVertical: 10 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(15,118,110,0.25)',
  },
  chipOn: { backgroundColor: TEAL, borderColor: TEAL },
  chipText: { color: INK, fontSize: 13, fontWeight: '700' },

  block: { marginTop: 22 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, paddingHorizontal: 16 },
  labelLine: { flex: 1, height: 1, backgroundColor: 'rgba(43,26,16,0.12)' },
  labelText: { color: 'rgba(43,26,16,0.65)', fontSize: 12, fontWeight: '700', letterSpacing: 2.2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  card: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    shadowColor: '#7C2D12', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  photo: { width: '100%', backgroundColor: '#F3E8D7' },
  cityTag: {
    position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '75%',
    backgroundColor: CHILLI, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  cityTagText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  durTag: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,248,238,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  durText: { color: INK, fontSize: 11, fontWeight: '700' },
  body: { padding: 12 },
  title: { color: INK, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  titleBig: { fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  ratingRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: INK, fontSize: 12, fontWeight: '700' },
  reviews: { color: 'rgba(43,26,16,0.55)', fontWeight: '500' },
  priceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  from: { color: 'rgba(43,26,16,0.55)', fontSize: 10, fontWeight: '600' },
  price: { color: CHILLI, fontSize: 16, fontWeight: '900' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: TEAL,
    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7,
  },
  ctaText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  more: {
    marginHorizontal: 16, marginTop: 20, paddingVertical: 13, borderRadius: 999, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(226,70,43,0.4)', backgroundColor: '#fff',
  },
  moreText: { color: INK, fontSize: 14, fontWeight: '800' },
  state: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  stateText: { color: 'rgba(43,26,16,0.6)', fontSize: 14 },
});
