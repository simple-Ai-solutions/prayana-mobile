// Nightlife, District-style: always dark (it's a night-out page, whatever the
// app theme), neon pink/violet glow, a big shouty headline, vibe chips, a
// spotlight of event posters and the rest as a poster grid.
//
// Listings here are mostly partner shows (Viator/Headout) priced in the local
// currency — prices keep their own symbol (€119, ฿800), never a forced ₹.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SpotlightCarousel } from '../home/SpotlightCarousel';

const BG = '#07060C';
const PINK = '#FF2E88';
const VIOLET = '#8B5CF6';
const W = Dimensions.get('window').width;
const SPOT_W = Math.round(W * 0.72);
const GRID_W = Math.floor((W - 16 * 2 - 12) / 2);

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿',
  AUD: 'A$', JPY: '¥', MYR: 'RM ', IDR: 'Rp ', CHF: 'CHF ', CAD: 'C$',
};

// Words in a title/category that say what kind of night it is.
const VIBES: { key: string; label: string; match: RegExp }[] = [
  { key: 'all', label: 'All', match: /./ },
  { key: 'shows', label: 'Shows & cabaret', match: /show|cabaret|moulin|burlesque|theatre|theater|ladyboy/i },
  { key: 'crawls', label: 'Pub crawls', match: /crawl|pub|bar hop|bars/i },
  { key: 'clubs', label: 'Clubs & parties', match: /club|party|parties|dj|rave/i },
  { key: 'cruise', label: 'Night cruises', match: /cruise|boat|dinner/i },
  { key: 'live', label: 'Live music', match: /live music|jazz|concert|band/i },
];

const priceText = (a: any): string | null => {
  const p = a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? null;
  if (p == null || !(Number(p) > 0)) return null;
  const code = String(a.pricing?.currency || a.currency || 'INR').toUpperCase();
  const sym = SYMBOLS[code] ?? `${code} `;
  return `${sym}${Math.round(Number(p)).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US')}`;
};
const imgOf = (a: any): string | null => a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
const cityOf = (a: any): string => a.location?.city || a.externalData?.city?.name || '';
const ratingOf = (a: any): number => Number(a.rating?.average ?? a.rating ?? 0) || 0;
const open = (a: any) => a?._id && router.push(`/activity/${a._id}` as any);

function NightPoster({ a, width, big }: { a: any; width: number; big?: boolean }) {
  const img = imgOf(a);
  const price = priceText(a);
  const rating = ratingOf(a);
  const city = cityOf(a);
  const dur = a.duration?.label;
  return (
    <Pressable
      onPress={() => open(a)}
      accessibilityRole="button"
      accessibilityLabel={[a.title, city, price && `from ${price}`].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.poster, { width, aspectRatio: big ? 0.74 : 0.68 }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <LinearGradient
        colors={['rgba(7,6,12,0.35)', 'rgba(7,6,12,0)', 'rgba(7,6,12,0.2)', 'rgba(7,6,12,0.95)']}
        locations={[0, 0.25, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.posterTop}>
        {rating > 0 ? (
          <View style={styles.glass}>
            <Ionicons name="star" size={11} color="#FACC15" />
            <Text style={styles.glassText}>{rating.toFixed(1)}</Text>
          </View>
        ) : <View />}
        {!!dur && (
          <View style={styles.glass}>
            <Ionicons name="time-outline" size={11} color="#fff" />
            <Text style={styles.glassText}>{dur}</Text>
          </View>
        )}
      </View>
      <View style={styles.posterBottom}>
        {!!city && <Text style={styles.city} numberOfLines={1}>{city.toUpperCase()}</Text>}
        <Text style={[styles.title, big && styles.titleBig]} numberOfLines={2}>{a.title}</Text>
        <View style={styles.priceRow}>
          {price ? (
            <Text style={styles.price}>{price}<Text style={styles.onwards}>  onwards</Text></Text>
          ) : <View />}
          {big && (
            <View style={styles.bookPill}>
              <Text style={styles.bookText}>Book</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </View>
          )}
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

export function NightlifeView({
  items, total, loading, hasMore, loadingMore, onLoadMore, image, refreshControl,
}: {
  items: any[]; total: number; loading: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; image: string; refreshControl?: React.ReactElement<any>;
}) {
  const [vibe, setVibe] = useState('all');
  const shown = useMemo(() => {
    const v = VIBES.find((x) => x.key === vibe)!;
    return vibe === 'all' ? items : items.filter((a) => v.match.test(`${a.title} ${(a.category || []).join(' ')}`));
  }, [items, vibe]);
  // Best-rated first for the spotlight; everything else in the grid.
  const spotlight = useMemo(
    () => [...shown].filter(imgOf).sort((x, y) => ratingOf(y) - ratingOf(x)).slice(0, 8),
    [shown],
  );
  const spotIds = new Set(spotlight.map((a) => a._id));
  const rest = shown.filter((a) => !spotIds.has(a._id));

  // The page scrolls here (not in the route) so the vibe chips can pin to the
  // top: child 1 of the ScrollView is the chip bar, made sticky.
  return (
    <ScrollView
      style={{ backgroundColor: BG }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      refreshControl={refreshControl}
    >
      {/* Neon header over a dimmed photo */}
      <View style={styles.hero}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={['rgba(7,6,12,0.55)', 'rgba(7,6,12,0.7)', BG]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,46,136,0.45)', 'rgba(139,92,246,0.25)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Plain View owns the position: gesture-handler's TouchableOpacity puts
            `style` on an inner view, so absolute positioning on it is ignored. */}
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
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>AFTER DARK</Text>
          </View>
          <Text style={styles.headline}>Make it a{'\n'}<Text style={{ color: PINK }}>night</Text> to remember.</Text>
          <Text style={styles.heroSub}>
            Cabarets, pub crawls, rooftop parties & night cruises{total ? ` · ${total} picks` : ''}
          </Text>
        </View>
      </View>

      {/* Vibe chips — sticky, on a solid backing so cards slide under them */}
      <View style={styles.chipBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {VIBES.map((v) => {
          const on = v.key === vibe;
          return (
            <TouchableOpacity
              key={v.key}
              onPress={() => setVibe(v.key)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </View>

      <View>
      {loading ? (
        <View style={styles.state}><ActivityIndicator size="large" color={PINK} /></View>
      ) : shown.length === 0 ? (
        <View style={styles.state}>
          <Ionicons name="moon-outline" size={40} color="rgba(255,255,255,0.4)" />
          <Text style={styles.stateText}>Nothing in this vibe yet — try another.</Text>
        </View>
      ) : (
        <>
          {spotlight.length > 0 && (
            <View style={styles.block}>
              <Label text="Tonight's headliners" />
              <SpotlightCarousel
                data={spotlight}
                keyExtractor={(a) => String(a._id)}
                itemWidth={SPOT_W}
                accent={PINK}
                renderItem={(a, _i, width) => <NightPoster a={a} width={width} big />}
              />
            </View>
          )}

          {rest.length > 0 && (
            <View style={styles.block}>
              <Label text="More after dark" />
              <View style={styles.grid}>
                {rest.map((a, i) => <NightPoster key={a._id || i} a={a} width={GRID_W} />)}
              </View>
            </View>
          )}

          {hasMore && vibe === 'all' && (
            <TouchableOpacity onPress={onLoadMore} disabled={loadingMore} style={styles.more} accessibilityRole="button">
              {loadingMore ? <ActivityIndicator size="small" color={PINK} /> : <Text style={styles.moreText}>Show more</Text>}
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
  hero: { minHeight: 330, justifyContent: 'flex-end', paddingTop: 68 },
  backWrap: { position: 'absolute', top: 12, left: 16, zIndex: 2 },
  back: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroBody: { paddingHorizontal: 16, paddingBottom: 18 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: PINK,
    shadowColor: PINK, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  liveText: { color: '#FFB3D4', fontSize: 11, fontWeight: '800', letterSpacing: 2.5 },
  headline: { marginTop: 8, color: '#fff', fontSize: 36, lineHeight: 39, fontWeight: '900', letterSpacing: -1.4 },
  heroSub: { marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 },

  chipBar: {
    backgroundColor: BG, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipOn: { backgroundColor: PINK, borderColor: PINK },
  chipText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },

  block: { marginTop: 28 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, paddingHorizontal: 16 },
  labelLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.16)' },
  labelText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', letterSpacing: 2.4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  poster: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#15121F', justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
  },
  posterTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  glass: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  glassText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  posterBottom: { padding: 12, paddingTop: 0 },
  city: { color: '#FFB3D4', fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 3 },
  title: { color: '#fff', fontSize: 14.5, fontWeight: '800', lineHeight: 18 },
  titleBig: { fontSize: 21, lineHeight: 25, letterSpacing: -0.4 },
  priceRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: '#fff', fontSize: 15, fontWeight: '800' },
  onwards: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  bookPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7, backgroundColor: PINK,
  },
  bookText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  more: {
    marginHorizontal: 16, marginTop: 20, paddingVertical: 13, borderRadius: 999, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,46,136,0.5)',
  },
  moreText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  state: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  stateText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
