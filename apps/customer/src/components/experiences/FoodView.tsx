// Food & Dining — a menu-style page: warm off-white, heavy black type and a
// tomato-red accent (food-app energy), a sticky row of "cravings" chips, a
// spotlight of the most-loved food tours and the rest as menu cards. Each card
// pulls its hook out of the title — "15+ tastings", "Michelin", "Cooking
// class" — and wears it as a yellow sticker on the photo.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SpotlightCarousel } from '../home/SpotlightCarousel';

const PAGE = '#FFFAF3';
const INK = '#1A1410';
const TOMATO = '#EF3B2D';
const MUSTARD = '#FFC93C';
const W = Dimensions.get('window').width;
const SPOT_W = Math.round(W * 0.72);
const GRID_W = Math.floor((W - 16 * 2 - 12) / 2);

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', THB: '฿',
  AUD: 'A$', JPY: '¥', MYR: 'RM ', IDR: 'Rp ', CHF: 'CHF ', CAD: 'C$',
};

const CRAVINGS: { key: string; label: string; icon: any; match: RegExp }[] = [
  { key: 'all', label: 'Everything', icon: 'restaurant', match: /./ },
  { key: 'walks', label: 'Food walks', icon: 'walk', match: /food tour|food walk|walking|tastings?|backstreet|eat like/i },
  { key: 'cook', label: 'Cooking classes', icon: 'flame', match: /cook|class|chef|kitchen/i },
  { key: 'street', label: 'Street food', icon: 'fast-food', match: /street|hawker|night market|stall/i },
  { key: 'drinks', label: 'Wine & drinks', icon: 'wine', match: /wine|champagne|beer|brew|cocktail|sake|whisk/i },
  { key: 'fine', label: 'Fine dining', icon: 'sparkles', match: /michelin|gourmet|dinner|fine dining|cruise/i },
];

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

/** The card's sticker: the most appetising fact the title gives away. */
function hookOf(title = ''): string | null {
  const t = title.match(/(\d+)\+?\s*(tastings?|dishes|bites|stops|samples)/i);
  if (t) return `${t[1]}+ ${t[2].toLowerCase().replace(/s?$/, 's')}`;
  if (/michelin/i.test(title)) return 'Michelin picks';
  if (/cook|class/i.test(title)) return 'Cook it yourself';
  if (/wine|champagne/i.test(title)) return 'Wine tasting';
  if (/street|hawker/i.test(title)) return 'Street eats';
  return null;
}

function MenuCard({ a, width, big }: { a: any; width: number; big?: boolean }) {
  const img = imgOf(a);
  const price = priceText(a);
  const rating = ratingOf(a);
  const reviews = reviewsOf(a);
  const city = cityOf(a);
  const dur = a.duration?.label;
  const hook = hookOf(a.title);
  return (
    <Pressable
      onPress={() => open(a)}
      accessibilityRole="button"
      accessibilityLabel={[a.title, city, price && `from ${price}`].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.card, { width }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.photo, { aspectRatio: big ? 1.1 : 1 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
        {!!hook && (
          <View style={styles.sticker}>
            <Text style={styles.stickerText}>{hook}</Text>
          </View>
        )}
        {rating > 0 && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{rating.toFixed(1)}</Text>
            <Ionicons name="star" size={10} color="#fff" />
          </View>
        )}
        {!!city && (
          <Text style={styles.cityOnPhoto} numberOfLines={1}>{city}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, big && styles.titleBig]} numberOfLines={2}>{a.title}</Text>
        <View style={styles.metaRow}>
          {!!dur && (
            <>
              <Ionicons name="time-outline" size={12} color="#7A6E66" />
              <Text style={styles.meta}>{dur}</Text>
            </>
          )}
          {reviews > 0 && (
            <>
              {!!dur && <Text style={styles.dot}>•</Text>}
              <Text style={styles.meta}>{compact(reviews)} foodies loved it</Text>
            </>
          )}
        </View>
        <View style={styles.dash} />
        <View style={styles.priceRow}>
          {price ? (
            <Text style={styles.price}>{price}<Text style={styles.per}> /person</Text></Text>
          ) : <View />}
          <View style={styles.add}>
            <Text style={styles.addText}>{big ? 'Book a seat' : 'Book'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Label({ text, emoji }: { text: string; emoji?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelText}>{text}</Text>
      {!!emoji && <Ionicons name={emoji as any} size={18} color={TOMATO} />}
    </View>
  );
}

export function FoodView({
  items, total, loading, hasMore, loadingMore, onLoadMore, image, refreshControl,
}: {
  items: any[]; total: number; loading: boolean; hasMore: boolean; loadingMore: boolean;
  onLoadMore: () => void; image: string; refreshControl?: React.ReactElement<any>;
}) {
  const [craving, setCraving] = useState('all');
  const shown = useMemo(() => {
    const c = CRAVINGS.find((x) => x.key === craving)!;
    return craving === 'all' ? items : items.filter((a) => c.match.test(a.title || ''));
  }, [items, craving]);
  const spotlight = useMemo(
    () => [...shown].filter(imgOf).sort((x, y) => reviewsOf(y) * ratingOf(y) - reviewsOf(x) * ratingOf(x)).slice(0, 6),
    [shown],
  );
  const spotIds = new Set(spotlight.map((a) => a._id));
  const rest = shown.filter((a) => !spotIds.has(a._id));

  return (
    <ScrollView
      style={{ backgroundColor: PAGE }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      refreshControl={refreshControl}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={['rgba(26,20,16,0.2)', 'rgba(26,20,16,0.55)', 'rgba(26,20,16,0.94)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
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
          <View style={styles.eyebrow}>
            <Ionicons name="restaurant" size={12} color={INK} />
            <Text style={styles.eyebrowText}>FOOD & DINING</Text>
          </View>
          <Text style={styles.headline}>
            Eat your way{'\n'}through the <Text style={{ color: MUSTARD }}>city.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Food walks, cooking classes, street eats & tastings{total ? ` · ${total} experiences` : ''}
          </Text>
        </View>
      </View>

      {/* Sticky cravings */}
      <View style={styles.chipBar}>
        <Text style={styles.chipPrompt}>What are you craving?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CRAVINGS.map((c) => {
            const on = c.key === craving;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCraving(c.key)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={c.icon} size={14} color={on ? '#fff' : TOMATO} />
                <Text style={[styles.chipText, on && { color: '#fff' }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View>
        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color={TOMATO} /></View>
        ) : shown.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="restaurant-outline" size={40} color="rgba(26,20,16,0.3)" />
            <Text style={styles.stateText}>Nothing on this menu yet — try another craving.</Text>
          </View>
        ) : (
          <>
            {spotlight.length > 0 && (
              <View style={styles.block}>
                <Label text="Chef's specials" emoji="flame" />
                <SpotlightCarousel
                  data={spotlight}
                  keyExtractor={(a) => String(a._id)}
                  itemWidth={SPOT_W}
                  accent={TOMATO}
                  renderItem={(a, _i, width) => <MenuCard a={a} width={width} big />}
                />
              </View>
            )}
            {rest.length > 0 && (
              <View style={styles.block}>
                <Label text="On the menu" emoji="restaurant" />
                <View style={styles.grid}>
                  {rest.map((a, i) => <MenuCard key={a._id || i} a={a} width={GRID_W} />)}
                </View>
              </View>
            )}
            {hasMore && craving === 'all' && (
              <TouchableOpacity onPress={onLoadMore} disabled={loadingMore} style={styles.more} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator size="small" color={TOMATO} /> : <Text style={styles.moreText}>See more dishes</Text>}
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
  eyebrow: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: MUSTARD, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5,
    transform: [{ rotate: '-2deg' }],
  },
  eyebrowText: { color: INK, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  headline: { marginTop: 12, color: '#fff', fontSize: 35, lineHeight: 38, fontWeight: '900', letterSpacing: -1.3 },
  heroSub: { marginTop: 8, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },

  chipBar: {
    backgroundColor: PAGE, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(26,20,16,0.1)',
  },
  chipPrompt: { paddingHorizontal: 16, marginBottom: 8, color: INK, fontSize: 15, fontWeight: '800' },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(239,59,45,0.25)',
  },
  chipOn: { backgroundColor: TOMATO, borderColor: TOMATO },
  chipText: { color: INK, fontSize: 13, fontWeight: '700' },

  block: { marginTop: 22 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 16 },
  labelText: { color: INK, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  card: {
    borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#7A2E12', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  photo: { width: '100%', backgroundColor: '#F3E6D6' },
  sticker: {
    position: 'absolute', left: 10, top: 10, backgroundColor: MUSTARD, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, transform: [{ rotate: '-3deg' }],
  },
  stickerText: { color: INK, fontSize: 11, fontWeight: '900' },
  ratingBadge: {
    position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#16A34A', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3,
  },
  ratingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cityOnPhoto: {
    position: 'absolute', left: 12, bottom: 10, right: 12,
    color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6,
  },
  body: { padding: 12 },
  title: { color: INK, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  titleBig: { fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  meta: { color: '#7A6E66', fontSize: 11.5, fontWeight: '600' },
  dot: { color: '#B8ADA5', fontSize: 11 },
  dash: {
    marginTop: 10, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(26,20,16,0.15)', borderRadius: 1,
  },
  priceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: INK, fontSize: 16, fontWeight: '900' },
  per: { color: '#7A6E66', fontSize: 11, fontWeight: '600' },
  add: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1.5, borderColor: TOMATO, backgroundColor: '#FFF1EF',
  },
  addText: { color: TOMATO, fontSize: 12.5, fontWeight: '900' },

  more: {
    marginHorizontal: 16, marginTop: 20, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
    backgroundColor: INK,
  },
  moreText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  state: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  stateText: { color: 'rgba(26,20,16,0.6)', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
