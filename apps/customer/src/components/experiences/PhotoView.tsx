// Photo Tours — a photographer's gallery: clean white page, a camera-
// viewfinder hero (corner brackets, REC dot, exposure readout), a sticky row of
// shot types, a spotlight of "frames" and the rest as polaroids in a two-column
// masonry, Pinterest-style. Each polaroid carries a camera-settings strip
// instead of plain meta, so the page reads like a contact sheet.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SpotlightCarousel } from '../home/SpotlightCarousel';

const PAPER = '#FAFAF7';
const INK = '#111111';
const REC = '#FF3B30';
const GOLD = '#F5B841'; // golden hour
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const W = Dimensions.get('window').width;
const SPOT_W = Math.round(W * 0.74);
const COL_W = Math.floor((W - 16 * 2 - 12) / 2);

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿',
  AUD: 'A$', JPY: '¥', MYR: 'RM ', IDR: 'Rp ', CHF: 'CHF ', CAD: 'C$',
};

const SHOTS: { key: string; label: string; icon: any; match: RegExp }[] = [
  { key: 'all', label: 'All shots', icon: 'aperture', match: /./ },
  { key: 'insta', label: 'Instagram spots', icon: 'logo-instagram', match: /instagram|insta|scenic spots|famous spots/i },
  { key: 'shoot', label: 'Photo shoots', icon: 'camera', match: /photo ?shoot|photoshoot|photographer|portrait/i },
  { key: 'nature', label: 'Waterfalls & nature', icon: 'leaf', match: /waterfall|falls|peak|trek|hill|forest|ghat|coffee/i },
  { key: 'coast', label: 'Coast & islands', icon: 'water', match: /beach|island|coast|sea|scuba|gokarna/i },
  { key: 'heritage', label: 'Heritage frames', icon: 'business', match: /temple|cave|fort|palace|tower|heritage|old town/i },
];

// Some partner titles start with a stray emoji variation selector ("️ Bali…").
const cleanTitle = (t = '') => t.replace(/^[^\p{L}\p{N}]+/u, '').trim();
const priceText = (a: any): string | null => {
  const p = a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? null;
  if (p == null || !(Number(p) > 0)) return null;
  const code = String(a.pricing?.currency || a.currency || 'INR').toUpperCase();
  return `${SYMBOLS[code] ?? `${code} `}${Math.round(Number(p)).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US')}`;
};
const imgOf = (a: any): string | null => a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
const cityOf = (a: any): string => {
  const c = a.location?.city || a.externalData?.city?.name || '';
  // Plus-codes ("WMCJ+548") aren't a place name anyone recognises.
  return /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(c) ? '' : c;
};
const ratingOf = (a: any): number => Number(a.rating?.average ?? a.rating ?? 0) || 0;
const open = (a: any) => a?._id && router.push(`/activity/${a._id}` as any);
const shotOf = (title: string): string => {
  const hit = SHOTS.slice(1).find((s) => s.match.test(title));
  return hit ? hit.label.split(' ')[0].toUpperCase() : 'PHOTO WALK';
};

/** Four corner brackets, like a camera viewfinder. */
function Brackets({ color = '#fff', size = 18, inset = 12 }: { color?: string; size?: number; inset?: number }) {
  const b = { position: 'absolute' as const, width: size, height: size, borderColor: color };
  return (
    <>
      <View style={[b, { top: inset, left: inset, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[b, { top: inset, right: inset, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[b, { bottom: inset, left: inset, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[b, { bottom: inset, right: inset, borderBottomWidth: 2, borderRightWidth: 2 }]} />
    </>
  );
}

function FrameCard({ a, width }: { a: any; width: number }) {
  const img = imgOf(a);
  const price = priceText(a);
  const rating = ratingOf(a);
  const city = cityOf(a);
  const title = cleanTitle(a.title);
  return (
    <Pressable
      onPress={() => open(a)}
      accessibilityRole="button"
      accessibilityLabel={[title, city, price && `from ${price}`].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.frame, { width }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={styles.framePhoto}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0, 0.2, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <Brackets />
        <View style={styles.recRow}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC</Text>
        </View>
        {rating > 0 && <Text style={styles.frameRating}>★ {rating.toFixed(1)}</Text>}
        <View style={styles.frameBottom}>
          {!!city && <Text style={styles.frameCity}>{city.toUpperCase()}</Text>}
          <Text style={styles.frameTitle} numberOfLines={2}>{title}</Text>
          <View style={styles.framePriceRow}>
            {price ? <Text style={styles.framePrice}>{price}<Text style={styles.frameOn}>  onwards</Text></Text> : <View />}
            <View style={styles.shutter}>
              <Ionicons name="camera" size={14} color={INK} />
              <Text style={styles.shutterText}>Book</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Polaroid({ a, tall }: { a: any; tall: boolean }) {
  const img = imgOf(a);
  const price = priceText(a);
  const rating = ratingOf(a);
  const city = cityOf(a);
  const dur = a.duration?.label;
  const title = cleanTitle(a.title);
  return (
    <Pressable
      onPress={() => open(a)}
      accessibilityRole="button"
      accessibilityLabel={[title, city, price && `from ${price}`].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.polaroid, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.polaroidPhoto, { aspectRatio: tall ? 0.78 : 1.05 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <Brackets size={12} inset={8} />
        {rating > 0 && (
          <View style={styles.polRating}>
            <Text style={styles.polRatingText}>★ {rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      {/* Camera-settings strip: shot type · duration (the place sits on the
          photo's caption line instead — three items got cut off here). */}
      <Text style={styles.exif} numberOfLines={1}>
        {[shotOf(title), dur].filter(Boolean).join('  ·  ')}
      </Text>
      <Text style={styles.caption} numberOfLines={2}>{title}</Text>
      {!!city && (
        <View style={styles.polCity}>
          <Ionicons name="location-outline" size={11} color="#8A8A85" />
          <Text style={styles.polCityText} numberOfLines={1}>{city}</Text>
        </View>
      )}
      {!!price && <Text style={styles.polPrice}>{price}<Text style={styles.polOn}> onwards</Text></Text>}
    </Pressable>
  );
}

export function PhotoView({
  items, total, loading, hasMore, loadingMore, onLoadMore, image, refreshControl,
}: {
  items: any[]; total: number; loading: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; image: string; refreshControl?: React.ReactElement<any>;
}) {
  const [shot, setShot] = useState('all');
  const shown = useMemo(() => {
    const s = SHOTS.find((x) => x.key === shot)!;
    return shot === 'all' ? items : items.filter((a) => s.match.test(a.title || ''));
  }, [items, shot]);
  const spotlight = useMemo(
    () => [...shown].filter(imgOf).sort((x, y) => ratingOf(y) - ratingOf(x)).slice(0, 6),
    [shown],
  );
  const spotIds = new Set(spotlight.map((a) => a._id));
  const rest = shown.filter((a) => !spotIds.has(a._id));
  // Masonry: alternate tall/short so the two columns stagger.
  const cols: [any[], any[]] = [[], []];
  rest.forEach((a, i) => cols[i % 2].push(a));

  return (
    <ScrollView
      style={{ backgroundColor: PAPER }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      refreshControl={refreshControl}
    >
      {/* Viewfinder hero */}
      <View style={styles.hero}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.88)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <Brackets size={28} inset={18} />
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
        <View style={styles.heroRec}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC  ·  GOLDEN HOUR</Text>
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.headline}>
            Frame the{'\n'}<Text style={{ color: GOLD }}>moment.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Photo walks, shoots & the world's most photogenic spots{total ? ` · ${total} tours` : ''}
          </Text>
          <Text style={styles.readout}>ISO 100   f/1.8   1/250s   ●  AUTO</Text>
        </View>
      </View>

      {/* Sticky shot types */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SHOTS.map((s) => {
            const on = s.key === shot;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => setShot(s.key)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={s.icon} size={14} color={on ? '#fff' : INK} />
                <Text style={[styles.chipText, on && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View>
        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color={INK} /></View>
        ) : shown.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="aperture-outline" size={40} color="rgba(0,0,0,0.3)" />
            <Text style={styles.stateText}>Nothing in frame yet — try another shot type.</Text>
          </View>
        ) : (
          <>
            {spotlight.length > 0 && (
              <View style={styles.block}>
                <View style={styles.head}>
                  <Text style={styles.headNum}>01</Text>
                  <Text style={styles.headText}>Frames of the week</Text>
                </View>
                <SpotlightCarousel
                  data={spotlight}
                  keyExtractor={(a) => String(a._id)}
                  itemWidth={SPOT_W}
                  accent={INK}
                  renderItem={(a, _i, width) => <FrameCard a={a} width={width} />}
                />
              </View>
            )}
            {rest.length > 0 && (
              <View style={styles.block}>
                <View style={styles.head}>
                  <Text style={styles.headNum}>02</Text>
                  <Text style={styles.headText}>The contact sheet</Text>
                </View>
                <View style={styles.masonry}>
                  {cols.map((col, ci) => (
                    <View key={ci} style={{ width: COL_W, gap: 14 }}>
                      {col.map((a, i) => (
                        <Polaroid key={a._id || i} a={a} tall={(i + ci) % 2 === 0} />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            )}
            {hasMore && shot === 'all' && (
              <TouchableOpacity onPress={onLoadMore} disabled={loadingMore} style={styles.more} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.moreText}>Load more frames</Text>}
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
  hero: { minHeight: 340, justifyContent: 'flex-end', paddingTop: 80 },
  backWrap: { position: 'absolute', top: 24, left: 28, zIndex: 2 },
  back: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  heroRec: { position: 'absolute', top: 36, right: 30, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBody: { paddingHorizontal: 28, paddingBottom: 30 },
  headline: { color: '#fff', fontSize: 40, lineHeight: 42, fontWeight: '900', letterSpacing: -1.5 },
  heroSub: { marginTop: 8, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  readout: { marginTop: 12, color: 'rgba(255,255,255,0.75)', fontFamily: MONO, fontSize: 11, letterSpacing: 1 },

  recRow: { position: 'absolute', top: 18, left: 34, flexDirection: 'row', alignItems: 'center', gap: 5 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: REC },
  recText: { color: '#fff', fontFamily: MONO, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.5 },

  chipBar: {
    backgroundColor: PAPER, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.14)',
  },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipText: { color: INK, fontSize: 13, fontWeight: '700' },

  block: { marginTop: 24 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  headNum: { color: REC, fontFamily: MONO, fontSize: 13, fontWeight: '700' },
  headText: { color: INK, fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },

  frame: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  framePhoto: { aspectRatio: 0.8, justifyContent: 'flex-end' },
  frameRating: {
    position: 'absolute', top: 16, right: 34, color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: '700',
  },
  frameBottom: { padding: 18, paddingBottom: 22 },
  frameCity: { color: GOLD, fontFamily: MONO, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: 4 },
  frameTitle: { color: '#fff', fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4 },
  framePriceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  framePrice: { color: '#fff', fontSize: 16, fontWeight: '900' },
  frameOn: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '500' },
  shutter: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GOLD,
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7,
  },
  shutterText: { color: INK, fontSize: 13, fontWeight: '900' },

  masonry: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, alignItems: 'flex-start' },
  polaroid: {
    backgroundColor: '#fff', padding: 8, paddingBottom: 12, borderRadius: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  polaroidPhoto: { width: '100%', backgroundColor: '#EDEDE8', borderRadius: 2, overflow: 'hidden' },
  polRating: {
    position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  polRatingText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  exif: { marginTop: 9, color: '#8A8A85', fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.6 },
  caption: { marginTop: 4, color: INK, fontFamily: SERIF, fontStyle: 'italic', fontSize: 14.5, lineHeight: 18, fontWeight: '600' },
  polCity: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  polCityText: { color: '#8A8A85', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  polPrice: { marginTop: 6, color: INK, fontSize: 14, fontWeight: '900' },
  polOn: { color: '#8A8A85', fontSize: 10.5, fontWeight: '500' },

  more: { marginHorizontal: 16, marginTop: 22, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: INK },
  moreText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  state: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  stateText: { color: 'rgba(0,0,0,0.55)', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
