// Tours — a guided-tour marketplace page (in the spirit of GetYourGuide /
// Klook / Headout): a photo hero with the live count, city chips built from
// the tours actually loaded, a "Most loved" rail of wide posters ranked by
// rating × reviews, then full-width tour cards — photo with Instant and the
// rating, the city and duration, the title, and "From €28 per person".
// Every figure is the partner's own (rating, review count, duration, price).
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@prayana/shared-ui';
import { FULL_W, RAIL_GAP, RAIL_PAD, usePairSnap } from '../../lib/railLayout';
import { fallbackPhoto } from '../../lib/fallbackPhoto';

const TEAL = '#0f766e';
const TEAL_DEEP = '#053b37';
const CORAL = '#ff5a3c';

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿',
  AUD: 'A$', JPY: '¥', MYR: 'RM ', IDR: 'Rp ', CHF: 'CHF ', CAD: 'C$',
};

const cleanTitle = (t = '') => t.replace(/^[^\p{L}\p{N}]+/u, '').trim();
const imgOf = (a: any): string | null => a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
const cityOf = (a: any): string => {
  const c = a.location?.city || a.externalData?.city?.name || '';
  return /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(c) ? '' : c;
};
const ratingOf = (a: any) => Number(a.rating?.average ?? a.rating ?? 0) || 0;
const reviewsOf = (a: any) => Number(a.rating?.count ?? a.reviewCount ?? 0) || 0;
const durationOf = (a: any): string | null => {
  const d = a.duration?.label || a.duration?.display || (a.duration?.value ? `${a.duration.value} ${a.duration.unit || 'hours'}` : null);
  // Partners send "1 hours" / "1 days".
  return d ? String(d).replace(/^1 (hour|day|minute)s\b/i, '1 $1') : null;
};
const instantOf = (a: any) => (typeof a.instantBooking === 'boolean' ? a.instantBooking : !!a.instantBooking?.enabled);
const priceOf = (a: any): string | null => {
  const p = a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? null;
  if (p == null || !(Number(p) > 0)) return null;
  const code = String(a.pricing?.currency || a.currency || 'INR').toUpperCase();
  return `${SYMBOLS[code] ?? `${code} `}${Math.round(Number(p)).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US')}`;
};
const kOf = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);
const open = (a: any) => a?._id && router.push(`/activity/${a._id}` as any);

function Stars({ a, light }: { a: any; light?: boolean }) {
  const r = ratingOf(a);
  const n = reviewsOf(a);
  if (!r) return null;
  return (
    <View style={[s.stars, light && s.starsLight]}>
      <Ionicons name="star" size={11} color="#f59e0b" />
      <Text style={[s.starsText, light && { color: '#fff' }]}>{r.toFixed(1)}</Text>
      {n ? <Text style={[s.starsCount, light && { color: 'rgba(255,255,255,0.8)' }]}>({kOf(n)})</Text> : null}
    </View>
  );
}

function LovedPoster({ a }: { a: any }) {
  const img = imgOf(a);
  const price = priceOf(a);
  const city = cityOf(a);
  return (
    <Pressable onPress={() => open(a)} style={({ pressed }) => [s.loved, pressed && { transform: [{ scale: 0.985 }] }]} accessibilityRole="button" accessibilityLabel={cleanTitle(a.name || a.title)}>
      <LinearGradient colors={[TEAL, TEAL_DEEP]} style={StyleSheet.absoluteFill} />
      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" /> : null}
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(3,30,28,0.92)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.lovedTop}>
        <View style={s.lovedBadge}><Ionicons name="heart" size={10} color="#fff" /><Text style={s.lovedBadgeText}>MOST LOVED</Text></View>
        <Stars a={a} light />
      </View>
      <View style={s.lovedFoot}>
        {city ? <Text style={s.lovedCity}>{city.toUpperCase()}</Text> : null}
        <Text style={s.lovedTitle} numberOfLines={2}>{cleanTitle(a.name || a.title)}</Text>
        <View style={s.lovedRow}>
          {durationOf(a) ? <View style={s.glass}><Ionicons name="time-outline" size={12} color="#fff" /><Text style={s.glassText}>{durationOf(a)}</Text></View> : null}
          <View style={{ flex: 1 }} />
          {price ? <Text style={s.lovedPrice}><Text style={s.lovedFrom}>from </Text>{price}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function TourCard({ a }: { a: any }) {
  const { themeColors, isDarkMode } = useTheme();
  const own = imgOf(a);
  const [failed, setFailed] = useState<string | null>(null);
  const img = own && own !== failed ? own : fallbackPhoto(a);
  const price = priceOf(a);
  const city = cityOf(a);
  const dur = durationOf(a);
  return (
    <Pressable
      onPress={() => open(a)}
      accessibilityRole="button"
      accessibilityLabel={cleanTitle(a.name || a.title)}
      style={({ pressed }) => [s.card, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={s.cardImg}>
        <LinearGradient colors={['#99f6e4', TEAL]} style={StyleSheet.absoluteFill} />
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" onError={() => own && setFailed(own)} /> : null}
        <View style={s.cardTop}>
          {instantOf(a) ? <View style={s.instant}><Ionicons name="flash" size={10} color="#fff" /><Text style={s.instantText}>Instant confirmation</Text></View> : <View />}
        </View>
      </View>
      <View style={s.cardBody}>
        <View style={s.metaRow}>
          {city ? (
            <View style={s.meta}><Ionicons name="location" size={12} color={TEAL} /><Text style={[s.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>{city}</Text></View>
          ) : null}
          {dur ? (
            <View style={s.meta}><Ionicons name="time-outline" size={12} color={TEAL} /><Text style={[s.metaText, { color: themeColors.textSecondary }]}>{dur}</Text></View>
          ) : null}
        </View>
        <Text style={[s.cardTitle, { color: themeColors.text }]} numberOfLines={2}>{cleanTitle(a.name || a.title)}</Text>
        <View style={[s.cardFoot, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.07)' : '#eef2f1' }]}>
          <Stars a={a} />
          <View style={{ flex: 1 }} />
          {price ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.from, { color: themeColors.textTertiary }]}>From</Text>
              <Text style={[s.price, { color: themeColors.text }]}>{price}<Text style={[s.per, { color: themeColors.textTertiary }]}> / person</Text></Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ToursView({ items, total, loading, hasMore, loadingMore, onLoadMore, image, title, subtitle, refreshControl, onBack }: {
  items: any[]; total: number; loading: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; image: string; title: string; subtitle: string; refreshControl?: any; onBack: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [city, setCity] = useState('');
  const snap = usePairSnap(FULL_W + RAIL_GAP);

  // City chips from the tours on screen, busiest first.
  const cities = useMemo(() => {
    const n = new Map<string, number>();
    items.forEach((a) => { const c = cityOf(a); if (c) n.set(c, (n.get(c) || 0) + 1); });
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c]) => c);
  }, [items]);

  const shown = useMemo(() => (city ? items.filter((a) => cityOf(a) === city) : items), [items, city]);
  // Most loved: rating weighted by how many people rated it.
  const loved = useMemo(
    () => [...shown].filter((a) => ratingOf(a) >= 4 && reviewsOf(a) > 0 && imgOf(a))
      .sort((x, y) => ratingOf(y) * Math.log10(reviewsOf(y) + 10) - ratingOf(x) * Math.log10(reviewsOf(x) + 10))
      .slice(0, 5),
    [shown],
  );
  const lovedIds = new Set(loved.map((a) => a._id));
  const rest = shown.filter((a) => !lovedIds.has(a._id));
  const line = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';

  return (
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={refreshControl} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.hero}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        <LinearGradient colors={['rgba(3,30,28,0.45)', 'rgba(3,30,28,0.25)', 'rgba(3,30,28,0.9)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <Pressable onPress={onBack} hitSlop={12} style={s.back} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={s.heroBody}>
          <View style={s.heroPill}><Ionicons name="flag" size={11} color="#5eead4" /><Text style={s.heroPillText}>GUIDED TOURS</Text></View>
          <Text style={s.heroTitle}>{title}</Text>
          <Text style={s.heroSub}>{subtitle}</Text>
          {total > 0 ? (
            <View style={s.heroStats}>
              <View style={s.glass}><Ionicons name="compass" size={13} color="#fff" /><Text style={s.glassText}>{total.toLocaleString('en-IN')} tours</Text></View>
              {cities.length ? <View style={s.glass}><Ionicons name="earth" size={13} color="#fff" /><Text style={s.glassText}>{cities.length === 1 ? '1 city' : `${cities.length}+ cities`}</Text></View> : null}
            </View>
          ) : null}
        </View>
      </View>

      {cities.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {['', ...cities].map((c) => {
            const on = city === c;
            return (
              <Pressable key={c || 'all'} onPress={() => setCity(on && c ? '' : c)} style={[s.chip, on ? { backgroundColor: TEAL, borderColor: TEAL } : { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Ionicons name={c ? 'location-outline' : 'apps'} size={13} color={on ? '#fff' : TEAL} />
                <Text style={[s.chipText, { color: on ? '#fff' : themeColors.text }]}>{c || 'All cities'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={s.state}><ActivityIndicator size="large" color={TEAL} /></View>
      ) : (
        <>
          {loved.length ? (
            <View>
              <View style={s.secHead}>
                <LinearGradient colors={[CORAL, '#e11d48']} style={s.secIcon}><Ionicons name="heart" size={14} color="#fff" /></LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[s.secTitle, { color: themeColors.text }]}>Most loved tours</Text>
                  <Text style={[s.secSub, { color: themeColors.textSecondary }]}>Highest rated by travellers</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: RAIL_PAD, gap: RAIL_GAP, paddingBottom: 6 }} ref={snap.setRef} {...snap.props}>
                {loved.map((a) => <LovedPoster key={`l-${a._id}`} a={a} />)}
              </ScrollView>
            </View>
          ) : null}

          <View style={s.secHead}>
            <LinearGradient colors={['#14b8a6', TEAL]} style={s.secIcon}><Ionicons name="map" size={14} color="#fff" /></LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.secTitle, { color: themeColors.text }]}>{city ? `Tours in ${city}` : 'All tours'}</Text>
              <Text style={[s.secSub, { color: themeColors.textSecondary }]}>Walks, day trips and sightseeing with a guide</Text>
            </View>
          </View>
          {rest.length === 0 && !loved.length ? (
            <Text style={[s.secSub, { color: themeColors.textSecondary, textAlign: 'center', paddingVertical: 30 }]}>No tours found yet.</Text>
          ) : (
            <View style={s.list}>{rest.map((a, i) => <TourCard key={a._id || i} a={a} />)}</View>
          )}

          {hasMore && !city ? (
            <Pressable onPress={onLoadMore} disabled={loadingMore} style={[s.more, { borderColor: TEAL }]} accessibilityRole="button">
              {loadingMore ? <ActivityIndicator color={TEAL} /> : <Text style={s.moreText}>Show more tours</Text>}
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { height: 300, justifyContent: 'flex-end', backgroundColor: TEAL_DEEP },
  back: { position: 'absolute', top: 12, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroBody: { padding: 18 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(94,234,212,0.4)' },
  heroPillText: { color: '#5eead4', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1.2, marginTop: 8 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  glass: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  glassText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },

  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 18, marginBottom: 12 },
  secIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  secSub: { fontSize: 12.5, marginTop: 1 },

  loved: {
    width: FULL_W, height: 280, borderRadius: 26, overflow: 'hidden', justifyContent: 'space-between',
    shadowColor: TEAL_DEEP, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  lovedTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  lovedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: CORAL, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  lovedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  lovedFoot: { padding: 16 },
  lovedCity: { color: '#5eead4', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  lovedTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 26, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 },
  lovedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  lovedPrice: { color: '#fff', fontSize: 20, fontWeight: '900' },
  lovedFrom: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  stars: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  starsLight: { backgroundColor: 'rgba(0,0,0,0.5)' },
  starsText: { color: '#111827', fontSize: 12, fontWeight: '800' },
  starsCount: { color: '#6b7280', fontSize: 11, fontWeight: '600' },

  list: { paddingHorizontal: 16, gap: 16 },
  card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.09, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  cardImg: { aspectRatio: 16 / 9 },
  cardTop: { flexDirection: 'row', padding: 12 },
  instant: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  instantText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  cardBody: { padding: 14, gap: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '65%' },
  metaText: { fontSize: 12.5, fontWeight: '600' },
  cardTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22, letterSpacing: -0.2 },
  cardFoot: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  from: { fontSize: 10.5, fontWeight: '700' },
  price: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  per: { fontSize: 12, fontWeight: '600' },

  more: { marginHorizontal: 16, marginTop: 18, borderWidth: 1.5, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  moreText: { color: TEAL, fontSize: 14, fontWeight: '800' },
  state: { paddingVertical: 60, alignItems: 'center' },
});
