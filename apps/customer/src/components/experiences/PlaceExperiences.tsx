// City & country pages for the worldwide catalogue (web
// /global-experiences/[country] and /global-experiences/[country]/[city]).
//
// One virtualised list: photo hero → (country only) its top cities → sticky
// category chips → sort chips → two-up grid → "Load more". Categories filter on
// the server (`category`); sorting reorders what is loaded. The API widens
// city → state → country when a place has nothing listed, and says so in
// `resolvedScope` — we show that as a small note rather than pretend.
//
// The catalogue hook, chips and helpers are shared with the destination
// editions (/experiences-in/[slug]).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { GlobalActivityCard } from './GlobalActivityCard';
import { countryImageForText } from '../../lib/countryAssets';
import { RAIL_PAD } from '../../lib/railLayout';
import { goBack } from '../../lib/goBack';
import { getEditionByCountry } from '../../lib/destinationEditions';

type Icon = keyof typeof Ionicons.glyphMap;

export const ORANGE = '#F97316';
export const ROSE = '#E11D48';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = 12;
export const GRID_CARD_W = Math.floor((SCREEN_W - RAIL_PAD * 2 - GRID_GAP) / 2);

/* ─── data ─── */

export const PLACE_CATEGORIES: { value: string; label: string; icon: Icon }[] = [
  { value: '', label: 'All', icon: 'apps-outline' },
  { value: 'City Tours', label: 'City Tours', icon: 'compass-outline' },
  { value: 'Cultural', label: 'Cultural', icon: 'business-outline' },
  { value: 'Adventure', label: 'Adventure', icon: 'trail-sign-outline' },
  { value: 'Food & Dining', label: 'Food & Dining', icon: 'restaurant-outline' },
  { value: 'Water Sports', label: 'Water Sports', icon: 'boat-outline' },
  { value: 'Wellness', label: 'Wellness', icon: 'leaf-outline' },
  { value: 'Nightlife', label: 'Nightlife', icon: 'moon-outline' },
];

export type PlaceSort = 'recommended' | 'price_asc' | 'rating' | 'popular';
export const PLACE_SORTS: { value: PlaceSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popular', label: 'Most booked' },
];

export const imgOf = (a: any): string | null => {
  const first = a?.images?.find?.((i: any) => i?.isPrimary) ?? a?.images?.[0];
  return (typeof first === 'string' ? first : first?.url) || a?.heroImage || null;
};
const priceNum = (a: any): number | null => {
  const p = Number(a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? NaN);
  return p > 0 ? p : null;
};
const ratingNum = (a: any) => Number(a.rating?.average ?? a.rating ?? 0) || 0;
const reviewsNum = (a: any) => Number(a.rating?.count ?? a.reviewCount ?? 0) || 0;
// No partner sends a booking count on every listing; reviews are the closest
// real signal of how often something is booked.
const bookedNum = (a: any) =>
  Number(a.bookingCount ?? a.stats?.totalBookings ?? a.totalBookings ?? 0) || reviewsNum(a);

export function sortItems(items: any[], sort: PlaceSort): any[] {
  if (sort === 'recommended') return items;
  const out = [...items];
  if (sort === 'price_asc') {
    out.sort((a, b) => (priceNum(a) ?? Infinity) - (priceNum(b) ?? Infinity));
  } else if (sort === 'rating') {
    out.sort((a, b) => ratingNum(b) - ratingNum(a) || reviewsNum(b) - reviewsNum(a));
  } else {
    out.sort((a, b) => bookedNum(b) - bookedNum(a));
  }
  return out;
}

export interface CityEntry {
  city: string;
  count: number;
  image: string | null;
}

/** The cities a list of listings covers, most listings first, each with a photo. */
export function topCitiesOf(items: any[], limit = 10): CityEntry[] {
  const map = new Map<string, CityEntry>();
  for (const it of items) {
    const city = String(it?.location?.city || '').trim();
    if (!city || /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(city)) continue;
    const key = city.toLowerCase();
    const entry = map.get(key) ?? { city, count: 0, image: null };
    entry.count += 1;
    if (!entry.image) entry.image = imgOf(it);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** "united arab emirates" → "United Arab Emirates"; already-cased names pass through. */
export function placeName(raw?: string | string[]): string {
  let s = String(Array.isArray(raw) ? raw[0] : raw || '').trim();
  try {
    if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s);
  } catch {
    // keep it as given
  }
  s = s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return s === s.toLowerCase() ? s.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s;
}

export function cityHref(country: string, city: string) {
  return {
    pathname: '/global-experiences/[country]/[city]',
    params: { country, city },
  } as any;
}

export function countryHref(country: string) {
  return { pathname: '/global-experiences/[country]', params: { country } } as any;
}

/* ─── catalogue hook ─── */

export interface CatalogueQuery {
  city?: string;
  state?: string;
  country?: string;
  category?: string;
  pageSize?: number;
}

/**
 * One page-at-a-time read of GET /activities/global. A filter change starts
 * over; a reply that lands after a newer request is dropped.
 */
export function useGlobalCatalogue({ city, state, country, category, pageSize = 24 }: CatalogueQuery) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [lastFull, setLastFull] = useState(false);
  const reqRef = useRef(0);
  const countRef = useRef(0);

  const fetchPage = useCallback(
    async (append: boolean) => {
      const id = ++reqRef.current;
      const skip = append ? countRef.current : 0;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(false);
      }
      try {
        const res: any = await activityMarketplaceAPI.getGlobalActivities({
          city: city || undefined,
          state: state || undefined,
          country: country || undefined,
          category: category || undefined,
          limit: pageSize,
          skip,
        });
        if (id !== reqRef.current) return;
        const data: any[] = Array.isArray(res?.data) ? res.data : [];
        setItems((prev) => {
          if (!append) return data;
          const seen = new Set(prev.map((p) => p._id));
          return [...prev, ...data.filter((d) => !seen.has(d._id))];
        });
        countRef.current = skip + data.length;
        setTotal(Number(res?.total ?? skip + data.length));
        setScope(typeof res?.resolvedScope === 'string' ? res.resolvedScope : null);
        setLastFull(data.length >= pageSize);
      } catch {
        if (id !== reqRef.current) return;
        if (append) Toast.show({ type: 'error', text1: "Couldn't load more experiences" });
        else {
          setItems([]);
          setTotal(0);
          setError(true);
        }
      } finally {
        if (id === reqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [city, state, country, category, pageSize],
  );

  useEffect(() => {
    countRef.current = 0;
    fetchPage(false);
  }, [fetchPage]);

  const hasMore = lastFull && items.length < total;
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) fetchPage(true);
  }, [loading, loadingMore, hasMore, fetchPage]);
  const reload = useCallback(() => fetchPage(false), [fetchPage]);

  const requested = city ? 'city' : state ? 'state' : country ? 'country' : 'global';
  return { items, total, scope, requested, loading, loadingMore, error, hasMore, loadMore, reload };
}

/** A small one-off sample of a place's catalogue, for its city rail and cover. */
export function usePlaceSample(country?: string, size = 48) {
  const [sample, setSample] = useState<any[]>([]);
  useEffect(() => {
    if (!country) return;
    let alive = true;
    activityMarketplaceAPI
      .getGlobalActivities({ country, limit: size, skip: 0 })
      .then((res: any) => alive && setSample(Array.isArray(res?.data) ? res.data : []))
      .catch(() => alive && setSample([]));
    return () => {
      alive = false;
    };
  }, [country, size]);
  return sample;
}

/* ─── shared pieces ─── */

export function CategoryChips({
  value,
  onChange,
  accent = ORANGE,
}: {
  value: string;
  onChange: (v: string) => void;
  accent?: string;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chips}
      keyboardShouldPersistTaps="handled"
    >
      {PLACE_CATEGORIES.map((c) => {
        const active = value === c.value;
        return (
          <Pressable
            key={c.value || 'all'}
            onPress={() => onChange(c.value)}
            style={[
              s.chip,
              active
                ? { backgroundColor: accent, borderColor: accent }
                : { backgroundColor: themeColors.surface, borderColor: line },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={c.icon} size={14} color={active ? '#FFFFFF' : themeColors.textSecondary} />
            <Text style={[s.chipText, { color: active ? '#FFFFFF' : themeColors.text }]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SortChips({
  value,
  onChange,
  accent = ORANGE,
}: {
  value: PlaceSort;
  onChange: (v: PlaceSort) => void;
  accent?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sorts}>
      <Ionicons name="swap-vertical" size={14} color={themeColors.textTertiary} />
      {PLACE_SORTS.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.sort, active && { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.sortText, { color: active ? accent : themeColors.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Two cards side by side; the second slot stays empty on an odd count. */
export function CardPair({ pair }: { pair: any[] }) {
  return (
    <View style={s.pair}>
      {pair.map((a) => (
        <GlobalActivityCard key={a._id} activity={a} width={GRID_CARD_W} />
      ))}
    </View>
  );
}

export function SkeletonPairs({ count = 3 }: { count?: number }) {
  const { isDarkMode } = useTheme();
  const bg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.pair}>
          {[0, 1].map((j) => (
            <View key={j} style={{ width: GRID_CARD_W, marginBottom: 12 }}>
              <View style={[s.skImg, { backgroundColor: bg }]} />
              <View style={[s.skLine, { backgroundColor: bg, width: '85%' }]} />
              <View style={[s.skLine, { backgroundColor: bg, width: '55%' }]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function LoadMoreButton({
  onPress,
  busy,
  accent = ORANGE,
  label = 'Load more',
}: {
  onPress: () => void;
  busy?: boolean;
  accent?: string;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [s.more, { borderColor: accent }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <>
          <Text style={[s.moreText, { color: accent }]}>{label}</Text>
          <Ionicons name="chevron-down" size={16} color={accent} />
        </>
      )}
    </Pressable>
  );
}

export function StateBlock({
  icon,
  title,
  body,
  action,
  onAction,
  accent = ORANGE,
}: {
  icon: Icon;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  accent?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={s.state}>
      <View style={[s.stateIcon, { backgroundColor: `${accent}1A` }]}>
        <Ionicons name={icon} size={28} color={accent} />
      </View>
      <Text style={[s.stateTitle, { color: themeColors.text }]}>{title}</Text>
      {!!body && <Text style={[s.stateBody, { color: themeColors.textSecondary }]}>{body}</Text>}
      {!!action && onAction && (
        <Pressable onPress={onAction} style={[s.stateBtn, { backgroundColor: accent }]} accessibilityRole="button">
          <Text style={s.stateBtnText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** "Showing the best of Japan" — when the API widened the place we asked for. */
export function ScopeNote({
  scope,
  requested,
  city,
  state,
  country,
  categoryLabel,
}: {
  scope: string | null;
  requested: string;
  city?: string;
  state?: string;
  country?: string;
  categoryLabel?: string;
}) {
  const { themeColors, isDarkMode } = useTheme();
  if (!scope || scope === 'none' || scope === requested) return null;
  const asked = requested === 'city' ? city : requested === 'state' ? state : country;
  const shown = scope === 'state' ? state : scope === 'country' ? country : 'around the world';
  const what = categoryLabel ? `${categoryLabel} experiences` : 'experiences';
  const text = `Not many ${what} listed in ${asked} yet — showing the best of ${shown || 'nearby'}.`;
  return (
    <View
      style={[
        s.note,
        { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.12)' : '#FFF4EC', borderColor: 'rgba(249,115,22,0.25)' },
      ]}
    >
      <Ionicons name="information-circle" size={16} color={ORANGE} />
      <Text style={[s.noteText, { color: themeColors.text }]}>{text}</Text>
    </View>
  );
}

export function chunkPairs<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

/* ─── the page ─── */

type Row =
  | { key: string; kind: 'hero' }
  | { key: string; kind: 'cities' }
  | { key: string; kind: 'bar' }
  | { key: string; kind: 'head' }
  | { key: string; kind: 'pair'; pair: any[] }
  | { key: string; kind: 'skeleton' }
  | { key: string; kind: 'state' }
  | { key: string; kind: 'footer' };

export function PlaceExperiences({
  country: countryParam,
  city: cityParam,
  state: stateParam,
}: {
  country?: string;
  city?: string;
  state?: string;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const country = placeName(countryParam);
  const city = cityParam ? placeName(cityParam) : '';
  const state = stateParam ? placeName(stateParam) : '';
  const isCity = !!city;
  const place = city || country;

  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<PlaceSort>('recommended');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);

  const cat = useGlobalCatalogue({ city, state, country, category, pageSize: 24 });
  const sample = usePlaceSample(isCity ? undefined : country);
  const cities = useMemo(() => (isCity ? [] : topCitiesOf(sample, 12)), [isCity, sample]);
  const sorted = useMemo(() => sortItems(cat.items, sort), [cat.items, sort]);

  // The page's own photo: the country's, else the first listing's.
  const [heroFallback, setHeroFallback] = useState<string | null>(null);
  useEffect(() => {
    if (!heroFallback) {
      const first = cat.items.find(imgOf) ?? sample.find(imgOf);
      if (first) setHeroFallback(imgOf(first));
    }
  }, [cat.items, sample, heroFallback]);
  // "United States" has no photo of its own under that name; its edition's
  // short name ("USA") does.
  const countryText = `${country} ${getEditionByCountry(country)?.displayName ?? ''}`;
  const heroImg =
    (isCity ? null : countryImageForText(countryText, 1200)) ?? heroFallback ?? countryImageForText(countryText, 1200);

  const categoryLabel = PLACE_CATEGORIES.find((c) => c.value === category)?.label;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [{ key: 'hero', kind: 'hero' }];
    if (cities.length > 1) out.push({ key: 'cities', kind: 'cities' });
    out.push({ key: 'bar', kind: 'bar' });
    out.push({ key: 'head', kind: 'head' });
    if (cat.loading) out.push({ key: 'skeleton', kind: 'skeleton' });
    else if (cat.error || !sorted.length) out.push({ key: 'state', kind: 'state' });
    else {
      chunkPairs(sorted).forEach((pair, i) => out.push({ key: `p${i}`, kind: 'pair', pair }));
      out.push({ key: 'footer', kind: 'footer' });
    }
    return out;
  }, [cities.length, cat.loading, cat.error, sorted]);
  const barIndex = rows.findIndex((r) => r.kind === 'bar');

  // Picking a category from the stuck bar brings the new results to the top;
  // picked before scrolling down, the page stays where it is.
  const scrollY = useRef(0);
  const barTop = 296 + (cities.length > 1 ? 222 : 0);
  const onCategory = useCallback(
    (v: string) => {
      setCategory(v);
      if (scrollY.current > barTop) {
        listRef.current?.scrollToIndex({ index: barIndex, animated: false });
      }
    },
    [barIndex, barTop],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cat.reload();
    setRefreshing(false);
  }, [cat]);

  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'hero':
        return (
          <View style={s.heroWrap}>
            <View style={s.hero}>
              {heroImg ? (
                <Image
                  source={{ uri: heroImg }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory-disk"
                />
              ) : (
                <LinearGradient colors={['#FB923C', ROSE]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient
                colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.82)']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.heroTop}>
                <Pressable
                  onPress={() => goBack('/global-experiences')}
                  hitSlop={10}
                  style={s.glassBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={21} color="#FFFFFF" />
                </Pressable>
                {isCity && (
                  <Pressable
                    onPress={() => router.push(countryHref(country))}
                    style={s.crumb}
                    accessibilityRole="button"
                    accessibilityLabel={`All of ${country}`}
                  >
                    <Ionicons name="globe-outline" size={13} color="#FFFFFF" />
                    <Text style={s.crumbText} numberOfLines={1}>
                      {country}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.8)" />
                  </Pressable>
                )}
              </View>
              <View style={s.heroBody}>
                <Text style={s.heroEyebrow}>{isCity ? `${country} · city guide` : 'Things to do in'}</Text>
                <Text style={s.heroTitle} numberOfLines={2}>
                  {isCity ? `Things to do in ${city}` : country}
                </Text>
                <View style={s.heroStats}>
                  <View style={s.stat}>
                    <Ionicons name="ticket-outline" size={13} color="#FFFFFF" />
                    <Text style={s.statText}>
                      {cat.loading && !cat.items.length
                        ? 'Finding experiences…'
                        : `${cat.total.toLocaleString('en-IN')} experience${cat.total === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  {!isCity && cities.length > 1 && (
                    <View style={s.stat}>
                      <Ionicons name="location-outline" size={13} color="#FFFFFF" />
                      <Text style={s.statText}>{cities.length}+ cities</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        );
      case 'cities':
        return (
          <View style={s.citiesWrap}>
            <Text style={[s.sectionTitle, { color: themeColors.text }]}>
              Top cities in <Text style={{ color: ORANGE }}>{country}</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.cityRail}
              decelerationRate="fast"
            >
              {cities.map((c) => (
                <Pressable
                  key={c.city}
                  onPress={() => router.push(cityHref(country, c.city))}
                  style={({ pressed }) => [s.cityCard, pressed && { opacity: 0.9 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Things to do in ${c.city}`}
                >
                  {c.image ? (
                    <Image
                      source={{ uri: c.image }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <LinearGradient colors={['#FB923C', ROSE]} style={StyleSheet.absoluteFill} />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    locations={[0.35, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.cityCaption}>
                    <Text style={s.cityName} numberOfLines={1}>
                      {c.city}
                    </Text>
                    <Text style={s.cityCount}>
                      {c.count}+ experience{c.count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        );
      case 'bar':
        return (
          <View style={[s.bar, { backgroundColor: themeColors.background, borderBottomColor: line }]}>
            <CategoryChips value={category} onChange={onCategory} />
          </View>
        );
      case 'head':
        return (
          <View>
            <ScopeNote
              scope={cat.scope}
              requested={cat.requested}
              city={city}
              state={state}
              country={country}
              categoryLabel={category ? categoryLabel : undefined}
            />
            <View style={s.head}>
              <Text style={[s.headTitle, { color: themeColors.text }]} numberOfLines={1}>
                {category ? categoryLabel : 'All experiences'}
                {!cat.loading && cat.total > 0 && (
                  <Text style={[s.headCount, { color: themeColors.textTertiary }]}>
                    {'  '}
                    {cat.total.toLocaleString('en-IN')}
                  </Text>
                )}
              </Text>
            </View>
            <SortChips value={sort} onChange={setSort} />
          </View>
        );
      case 'skeleton':
        return <SkeletonPairs />;
      case 'state':
        return cat.error ? (
          <StateBlock
            icon="cloud-offline-outline"
            title="Couldn't load experiences"
            body="Check your connection and try again."
            action="Try again"
            onAction={cat.reload}
          />
        ) : category ? (
          <StateBlock
            icon="search-outline"
            title={`No ${categoryLabel} experiences in ${place} yet`}
            body="Try another category — there's plenty more to do here."
            action="Show everything"
            onAction={() => setCategory('')}
          />
        ) : (
          <StateBlock
            icon="compass-outline"
            title={`Nothing listed in ${place} yet`}
            body="We're adding new tours and tickets every week. Explore other destinations meanwhile."
            action="Browse all destinations"
            onAction={() => router.push('/global-experiences' as any)}
          />
        );
      case 'pair':
        return <CardPair pair={item.pair} />;
      case 'footer':
        return (
          <View style={s.footer}>
            {cat.hasMore ? (
              <LoadMoreButton onPress={cat.loadMore} busy={cat.loadingMore} />
            ) : (
              <Text style={[s.endText, { color: themeColors.textTertiary }]}>
                You&apos;ve seen all {cat.items.length} experiences in {place}
              </Text>
            )}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        stickyHeaderIndices={barIndex >= 0 ? [barIndex] : undefined}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        initialNumToRender={8}
        windowSize={9}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={64}
        onScrollToIndexFailed={() => {}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      />
    </SafeAreaView>
  );
}

export default PlaceExperiences;

const s = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingBottom: 40 },

  heroWrap: { paddingHorizontal: RAIL_PAD, paddingTop: 8 },
  hero: { height: 280, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1F2937' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '60%',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  crumbText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34, marginTop: 4 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  citiesWrap: { marginTop: 22 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, paddingHorizontal: RAIL_PAD },
  cityRail: { gap: 12, paddingHorizontal: RAIL_PAD, paddingTop: 12 },
  cityCard: { width: 132, height: 168, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  cityCaption: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  cityName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  cityCount: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  bar: { paddingVertical: 10, marginTop: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { gap: 8, paddingHorizontal: RAIL_PAD },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  head: { paddingHorizontal: RAIL_PAD, paddingTop: 16 },
  headTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  headCount: { fontSize: 14, fontWeight: '700' },
  sorts: { alignItems: 'center', gap: 6, paddingHorizontal: RAIL_PAD, paddingTop: 10, paddingBottom: 14 },
  sort: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
  sortText: { fontSize: 12, fontWeight: '700' },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: RAIL_PAD,
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '500' },

  pair: { flexDirection: 'row', gap: GRID_GAP, paddingHorizontal: RAIL_PAD },
  skImg: { height: 120, borderRadius: 14 },
  skLine: { height: 10, borderRadius: 5, marginTop: 10 },

  footer: { paddingHorizontal: RAIL_PAD, paddingTop: 8, alignItems: 'center' },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  moreText: { fontSize: 14, fontWeight: '800' },
  endText: { fontSize: 12, fontWeight: '600', paddingVertical: 12 },

  state: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 36, gap: 10 },
  stateIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  stateBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  stateBtn: { marginTop: 6, paddingHorizontal: 20, height: 44, borderRadius: 22, justifyContent: 'center' },
  stateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
