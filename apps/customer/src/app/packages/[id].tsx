import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  Card,
  Badge,
  StarRating,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { holidayPackagesAPI, destinationAPI } from '@prayana/shared-services';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { normalizeImageUrl } from '../../lib/imageUrl';

const { width: SCREEN_W } = Dimensions.get('window');

type ItineraryDay = {
  day?: number;
  dayNumber?: number;
  title?: string;
  description?: string;
  // Server shapes vary: activities are objects ({title,...}); meals is an object
  // ({ breakfast:{included}, lunch:{included}, dinner:{included} }) OR a string[].
  meals?: any;
  activities?: (
    | string
    | {
        name?: string;
        activity?: string;
        title?: string;
        description?: string;
        // Per-activity notes the PWA shows under each activity (ActivityCard).
        whyIncluded?: string;
        goodToKnow?: string;
        imageUrl?: string;
      }
  )[];
  imageUrl?: string;
  accommodation?: { hotelName?: string; hotelCategory?: string; roomType?: string; imageUrl?: string };
};

// A normalised activity for the itinerary list: a title, the two optional notes
// the web renders ("Why we include it" / "Good to know"), its photo, and the
// placeDetails needed to open the place-detail screen on tap.
type DayActivity = {
  title: string;
  whyIncluded?: string;
  goodToKnow?: string;
  imageUrl?: string;
  placeName?: string;
  city?: string;
  destinationSlug?: string;
};
const toActivity = (x: any): DayActivity => {
  const pd = (typeof x === 'object' ? x?.placeDetails : undefined) || {};
  return {
    title: itemLabel(x),
    whyIncluded: typeof x === 'object' ? x?.whyIncluded : undefined,
    goodToKnow: typeof x === 'object' ? x?.goodToKnow : undefined,
    imageUrl: typeof x === 'object' ? x?.imageUrl : undefined,
    placeName: pd.placeName || itemLabel(x) || undefined,
    city: pd.city || undefined,
    destinationSlug: pd.destinationSlug || undefined,
  };
};

type PkgHotel = { name: string; city?: string; imageUrl?: string; rating?: number; reviewCount?: number; address?: string };

// Coerce an activity entry (string or object) to a display string.
const itemLabel = (x: any): string =>
  typeof x === 'string' ? x : (x?.title || x?.name || x?.activity || x?.type || '');

// Meals may be a string[] or an object of {breakfast,lunch,dinner}.{included}.
function mealLabels(meals: any): string[] {
  if (Array.isArray(meals)) return meals.map(itemLabel).filter(Boolean);
  if (meals && typeof meals === 'object') {
    return ['breakfast', 'lunch', 'dinner']
      .filter((m) => meals[m]?.included)
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  }
  return [];
}

type PkgVariant = {
  _id?: string;
  name: string;
  displayName?: string;
  hotelCategory?: string;
  roomType?: string;
  mealPlan?: string;
  isDefault?: boolean;
  pricing?: { basePrice?: number; isOnRequest?: boolean; display?: { amount?: number } };
  // The real source of "Where you'll stay" — one entry per property per night.
  hotels?: PkgHotel[];
};

const HOTEL_LABEL: Record<string, string> = {
  budget: '3-Star', standard: '3-Star Deluxe', premium: '4-Star', luxury: '4/5-Star',
};
const MEAL_LABEL: Record<string, string> = {
  EP: 'Room only', CP: 'Breakfast', MAP: 'Breakfast + Dinner', AP: 'All meals',
};
const variantPrice = (v: PkgVariant) => v.pricing?.display?.amount ?? v.pricing?.basePrice ?? 0;

type HolidayPackage = {
  _id: string;
  slug?: string;
  title: string;
  shortDescription?: string;
  description?: string;
  destination?: { city?: string; state?: string; country?: string };
  duration?: { days: number; nights: number };
  pricing?: {
    startingFrom: number;
    currency?: string;
    mrp?: number;
    perPerson?: boolean;
  };
  category?: string | string[];
  variants?: PkgVariant[];
  rating?: { average?: number; count?: number };
  images?: { url: string; alt?: string; isPrimary?: boolean; caption?: string }[];
  inclusions?: string[];
  exclusions?: string[];
  itinerary?: ItineraryDay[];
  highlights?: string[];
  isFeatured?: boolean;
  hotels?: PkgHotel[];
  cancellationPolicy?: { description?: string };
};

export default function PackageDetailScreen() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pkg, setPkg] = useState<HolidayPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  // Backfilled gallery for packages with an empty images[] — fetched from the
  // itinerary's place names via /destinations/place-images, exactly like the
  // web PackageImageGrid. Only used when the package ships no images.
  const [backfillImages, setBackfillImages] = useState<string[]>([]);
  // Collapsible itinerary days — first day open, rest collapsed. Keyed by index.
  const [openDays, setOpenDays] = useState<Record<number, boolean>>({ 0: true });
  const toggleDay = (i: number) => setOpenDays((s) => ({ ...s, [i]: !s[i] }));

  // Open the place-detail screen for a tapped itinerary place. Mirrors the web
  // ActivityCard link — but the mobile screen resolves by NAME + location, so
  // pass the human place name and its city.
  const openPlace = (a: DayActivity) => {
    if (!a.placeName) return;
    router.push({
      pathname: '/destination/[location]/[place]',
      params: { location: a.city || a.placeName, place: a.placeName },
    } as any);
  };
  const [variantName, setVariantName] = useState<string | null>(null);
  const [live, setLive] = useState<any>(null); // calculate-price result
  const [pricing, setPricing] = useState(false);

  const fetchPackage = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await holidayPackagesAPI.getById(id);
      const p = res?.data || res?.package || null;
      setPkg(p);
      // Default to the "Most Popular" (isDefault) variant, else the first.
      const vs: PkgVariant[] = p?.variants || [];
      const def = vs.find((v) => v.isDefault) || vs[0];
      if (def) setVariantName(def.name);
    } catch (err: any) {
      console.warn('[PackageDetail] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPackage();
  }, [fetchPackage]);

  // Live server price for the chosen variant (2 adults, undated quote).
  useEffect(() => {
    if (!pkg || !variantName) return;
    let alive = true;
    setPricing(true);
    (async () => {
      try {
        const res: any = await holidayPackagesAPI.calculatePrice({
          packageId: pkg._id, variantName, adults: 2, children: 0, infants: 0,
        });
        if (alive) setLive(res?.data || null);
      } catch {
        if (alive) setLive(null);
      } finally {
        if (alive) setPricing(false);
      }
    })();
    return () => { alive = false; };
  }, [pkg, variantName]);

  // Backfill the gallery when the package has no stored images — mirror the web
  // PackageImageGrid: derive place names from the itinerary (activity title +
  // destination, day destination, hotel name), fetch the first ~8 via
  // /destinations/place-images (S3 → Google Places), dedupe.
  useEffect(() => {
    if (!pkg) return;
    const hasStored = (pkg.images || []).some((i) => i?.url);
    if (hasStored) return;

    const destName =
      pkg.destination?.city || pkg.destination?.state || pkg.destination?.country || '';
    const names: string[] = [];
    for (const d of pkg.itinerary || []) {
      for (const a of d.activities || []) {
        const t = typeof a === 'string' ? a : a?.title || a?.name;
        if (t) names.push(destName ? `${t} ${destName}` : String(t));
      }
      if ((d as any).destination) names.push(`${(d as any).destination} scenic view`);
      const hotel = d.accommodation?.hotelName;
      if (hotel && hotel !== 'Overnight Bus') names.push(hotel);
    }
    const wanted = Array.from(new Set(names)).slice(0, 8);
    if (!wanted.length || !destName) return;

    let alive = true;
    (async () => {
      const urls: string[] = [];
      // Batches of 4 with a short gap, like the web enrichment.
      for (let i = 0; i < wanted.length && alive; i += 4) {
        const batch = wanted.slice(i, i + 4);
        await Promise.allSettled(
          batch.map((placeName) =>
            destinationAPI.getPlaceImages(placeName, destName, 1).then((res: any) => {
              const first = (res?.data || res?.images || [])[0];
              const url = first?.url || first?.imageUrl || (typeof first === 'string' ? first : null);
              if (url) urls.push(normalizeImageUrl(url));
            }).catch(() => {}),
          ),
        );
        if (alive && urls.length) setBackfillImages(Array.from(new Set(urls)));
        if (i + 4 < wanted.length) await new Promise((r) => setTimeout(r, 200));
      }
    })();
    return () => { alive = false; };
  }, [pkg]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!pkg) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: themeColors.text }]}>Package not found</Text>
          <Button title="Browse packages" onPress={() => router.replace('/packages')} variant="primary" size="md" />
        </View>
      </SafeAreaView>
    );
  }

  // category can be a String[] (server model) or a plain string — never call
  // .toUpperCase() on it directly or the whole screen crashes to a blank page.
  const categoryLabel = Array.isArray(pkg.category) ? pkg.category[0] : pkg.category;
  // Keep only images that actually carry a url, primary first — an entry with
  // no url renders as a blank gradient slide otherwise. If none qualify, show a
  // single gradient placeholder slide.
  const withUrl = (pkg.images || [])
    .filter((i) => i?.url)
    .map((i) => ({ ...i, url: normalizeImageUrl(i.url) }));
  const orderedImages = [
    ...withUrl.filter((i) => i.isPrimary),
    ...withUrl.filter((i) => !i.isPrimary),
  ];
  // Prefer stored images; else the itinerary-derived backfill; else a single
  // gradient placeholder slide.
  const images = orderedImages.length
    ? orderedImages
    : backfillImages.length
      ? backfillImages.map((url) => ({ url }))
      : [{ url: '' }];
  const dest = [pkg.destination?.city, pkg.destination?.state, pkg.destination?.country]
    .filter(Boolean)
    .join(', ');
  const days = pkg.duration?.days || 0;
  const nights = pkg.duration?.nights || Math.max(0, days - 1);
  const price = pkg.pricing?.startingFrom || 0;
  const selectedVariant = (pkg.variants || []).find((v) => v.name === variantName) || null;
  // Hotels live on the VARIANT (variants[].hotels), not at the package root —
  // reading pkg.hotels meant "Where you'll stay" never rendered. Prefer the
  // chosen variant's list, fall back to the first variant that has one, then
  // the (rare) package-level array. Dedupe by name+city: the same property
  // repeats across nights.
  // NOTE: a plain computation, not useMemo — this runs below the loading/error
  // early returns, so a hook here would change the hook count between renders
  // ("Rendered more hooks than during the previous render"). It is cheap.
  const stayHotels: PkgHotel[] = (() => {
    const fromVariant =
      (selectedVariant as any)?.hotels ||
      (pkg.variants || []).find((v: any) => (v?.hotels || []).length)?.hotels ||
      pkg.hotels ||
      [];
    const seen = new Set<string>();
    return (fromVariant as PkgHotel[]).filter((h) => {
      if (!h?.name) return false;
      const key = `${h.name}|${h.city || ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  // Show the chosen variant's per-person price (else the "from" price).
  const ctaPrice = selectedVariant && !selectedVariant.pricing?.isOnRequest
    ? (variantPrice(selectedVariant) || price)
    : price;
  const mrp = pkg.pricing?.mrp;
  const off = mrp && mrp > ctaPrice ? Math.round(((mrp - ctaPrice) / mrp) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Floating back button — fall back to the listing when there's no history
          (e.g. deep-linked straight into detail), so it never dead-ends. */}
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/packages'))}
        style={styles.fab}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Image carousel */}
        <View style={styles.carousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setActiveImageIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
            }}
          >
            {images.map((img, idx) =>
              img.url ? (
                <Image
                  key={idx}
                  source={{ uri: img.url }}
                  style={styles.carouselImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <LinearGradient
                  key={idx}
                  colors={[colors.primary[300], colors.primary[700]]}
                  style={styles.carouselImage}
                />
              ),
            )}
          </ScrollView>
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeImageIdx && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Header info */}
        <View style={[styles.headerSection, { backgroundColor: themeColors.surface }]}>
          {categoryLabel ? (
            <Badge label={categoryLabel.toUpperCase()} variant="primary" size="sm" />
          ) : null}
          <Text style={[styles.title, { color: themeColors.text }]}>{pkg.title}</Text>
          {dest ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{dest}</Text>
            </View>
          ) : null}
          {days > 0 ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={15} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {days} day{days === 1 ? '' : 's'} · {nights} night{nights === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
          {pkg.rating?.average ? (
            <View style={styles.metaRow}>
              <StarRating rating={pkg.rating.average} size={14} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {pkg.rating.average.toFixed(1)} ({pkg.rating.count || 0})
              </Text>
            </View>
          ) : null}
        </View>

        {/* Choose your package — variant selector + live price (web parity) */}
        {pkg.variants && pkg.variants.length > 0 ? (
          <Card style={styles.section}>
            <View style={styles.sectionAccentRow}>
              <View style={styles.sectionAccent} />
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Choose your package</Text>
            </View>
            <Text style={[styles.variantHint, { color: themeColors.textSecondary }]}>
              Hotels, meals & rooms differ by option.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
              {pkg.variants.map((v) => {
                const active = variantName === v.name;
                const onReq = v.pricing?.isOnRequest;
                const vp = variantPrice(v);
                return (
                  <TouchableOpacity
                    key={v._id || v.name}
                    style={[
                      styles.variantCard,
                      { borderColor: active ? '#3b82f6' : themeColors.border, backgroundColor: active ? '#3b82f620' : themeColors.surface },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setVariantName(v.name)}
                  >
                    {v.isDefault ? (
                      <View style={styles.popularBadge}><Ionicons name="star" size={9} color="#fff" /><Text style={styles.popularText}>POPULAR</Text></View>
                    ) : null}
                    <Text style={[styles.variantName, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {(v.displayName || v.name).toUpperCase()}
                    </Text>
                    {onReq ? (
                      <Text style={styles.variantOnReq}>On request</Text>
                    ) : (
                      <Text style={[styles.variantPrice, { color: themeColors.text }]}>
                        ₹{Number(vp).toLocaleString('en-IN')}<Text style={styles.variantPer}> /person</Text>
                      </Text>
                    )}
                    {v.hotelCategory ? (
                      <Text style={[styles.variantFeat, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        {HOTEL_LABEL[v.hotelCategory] || v.hotelCategory}{v.mealPlan ? ` · ${MEAL_LABEL[v.mealPlan] || v.mealPlan}` : ''}
                      </Text>
                    ) : null}
                    <View style={[styles.variantSelect, active && { backgroundColor: '#2563eb' }]}>
                      <Text style={[styles.variantSelectText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                        {active ? 'Selected' : 'Select'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Live price breakdown for the chosen variant */}
            {pricing ? (
              <View style={styles.livePriceRow}><ActivityIndicator size="small" color={colors.primary[500]} /><Text style={[styles.variantHint, { color: themeColors.textSecondary, marginLeft: 8 }]}>Getting your best price…</Text></View>
            ) : live ? (
              <View style={[styles.breakdown, { borderTopColor: themeColors.border }]}>
                {live.earlyBirdDiscount?.applied ? (
                  <View style={styles.bdRow}><Text style={[styles.bdK, { color: themeColors.textSecondary }]}>Early-bird −{live.earlyBirdDiscount.discountPercent}%</Text><Text style={[styles.bdV, { color: '#16a34a' }]}>−₹{Number(live.earlyBirdDiscount.discountAmount).toLocaleString('en-IN')}</Text></View>
                ) : null}
                {live.taxes?.total ? (
                  <View style={styles.bdRow}><Text style={[styles.bdK, { color: themeColors.textSecondary }]}>Taxes (GST{live.taxes?.tcs ? ' + TCS' : ''})</Text><Text style={[styles.bdV, { color: themeColors.text }]}>₹{Number(live.taxes.total).toLocaleString('en-IN')}</Text></View>
                ) : null}
                <View style={styles.bdRow}>
                  <Text style={[styles.bdK, { color: themeColors.text, fontWeight: fontWeight.bold }]}>Total (2 travellers)</Text>
                  <Text style={[styles.bdTotal]}>₹{Number(live.display?.finalPrice ?? live.finalPrice ?? 0).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Highlights */}
        {pkg.highlights && pkg.highlights.length > 0 ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Highlights</Text>
            {pkg.highlights.slice(0, 6).map((h, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={[styles.bulletText, { color: themeColors.text }]}>{h}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Description */}
        {pkg.description || pkg.shortDescription ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>About this package</Text>
            <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>
              {pkg.description || pkg.shortDescription}
            </Text>
          </Card>
        ) : null}

        {/* Itinerary */}
        {pkg.itinerary && pkg.itinerary.length > 0 ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Day-by-day itinerary</Text>
            {pkg.itinerary.map((d, di) => {
              const dayNo = d.dayNumber ?? d.day ?? di + 1;
              const acts = (d.activities || []).map(toActivity).filter((a) => a.title);
              const meals = mealLabels(d.meals);
              const open = !!openDays[di];
              return (
                <View key={di} style={[styles.dayBlock, { borderTopColor: themeColors.border }]}>
                  {/* Collapsible day header — tap to expand/collapse. */}
                  <TouchableOpacity style={styles.dayHead} activeOpacity={0.7} onPress={() => toggleDay(di)}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>D{dayNo}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dayTitle, { color: themeColors.text }]} numberOfLines={open ? undefined : 1}>
                        {d.title || `Day ${dayNo}`}
                      </Text>
                      {!open && acts.length > 0 ? (
                        <Text style={[styles.dayMeta, { color: themeColors.textTertiary }]} numberOfLines={1}>
                          {acts.length} stop{acts.length === 1 ? '' : 's'}{d.accommodation?.hotelName ? ` · ${d.accommodation.hotelName}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={themeColors.textTertiary} />
                  </TouchableOpacity>

                  {open ? (
                    <View style={styles.dayBody}>
                      {d.description ? (
                        <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>{d.description}</Text>
                      ) : null}
                      {d.accommodation?.hotelName ? (
                        <View style={styles.stayRow}>
                          {d.accommodation.imageUrl ? (
                            <Image
                              source={{ uri: normalizeImageUrl(d.accommodation.imageUrl) }}
                              style={styles.stayImg}
                              contentFit="cover"
                              transition={200}
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <View style={[styles.stayImg, styles.stayImgPh]}>
                              <Ionicons name="bed" size={16} color={colors.primary[400]} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.stayLabel, { color: themeColors.textTertiary }]}>TONIGHT&apos;S STAY</Text>
                            <Text style={[styles.stayName, { color: themeColors.text }]} numberOfLines={2}>
                              {d.accommodation.hotelName}
                            </Text>
                            {d.accommodation.roomType || d.accommodation.hotelCategory ? (
                              <Text style={[styles.dayMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                {[d.accommodation.hotelCategory, d.accommodation.roomType].filter(Boolean).join(' · ')}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                      {acts.length > 0 ? (
                        <View style={{ marginTop: 8, gap: 12 }}>
                          {acts.map((a, ai) => (
                            <View key={ai} style={styles.actRow}>
                              {a.imageUrl ? (
                                <Image
                                  source={{ uri: normalizeImageUrl(a.imageUrl) }}
                                  style={styles.actThumb}
                                  contentFit="cover"
                                  transition={200}
                                  cachePolicy="memory-disk"
                                />
                              ) : (
                                <View style={[styles.actThumb, styles.actThumbPh]}>
                                  <Ionicons name="image-outline" size={16} color={themeColors.textTertiary} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                {/* Tappable place name → place-detail screen (like the
                                    PWA ActivityCard link). Plain text when unresolved. */}
                                {a.placeName ? (
                                  <TouchableOpacity onPress={() => openPlace(a)} activeOpacity={0.6} style={styles.actTitleRow}>
                                    <Text style={[styles.actTitle, styles.actTitleLink]}>{a.title}</Text>
                                    <Ionicons name="arrow-forward" size={13} color="#2563eb" />
                                  </TouchableOpacity>
                                ) : (
                                  <Text style={[styles.actTitle, { color: themeColors.text }]}>{a.title}</Text>
                                )}
                                {a.whyIncluded ? (
                                  <View style={styles.whyBlock}>
                                    <Text style={[styles.whyText, { color: themeColors.textSecondary }]}>
                                      <Text style={styles.whyLabel}>Why we include it · </Text>
                                      {a.whyIncluded}
                                    </Text>
                                  </View>
                                ) : null}
                                {a.goodToKnow ? (
                                  <Text style={[styles.gtkText, { color: themeColors.textTertiary }]}>
                                    <Text style={styles.gtkLabel}>Good to know · </Text>
                                    {a.goodToKnow}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {meals.length > 0 ? (
                        <View style={styles.dayLine}>
                          <Ionicons name="restaurant-outline" size={13} color={themeColors.textTertiary} />
                          <Text style={[styles.dayMeta, { color: themeColors.textSecondary }]}>{meals.join(', ')}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* Where you'll stay — hotels */}
        {stayHotels.length > 0 ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Where you&apos;ll stay</Text>
            {selectedVariant?.name ? (
              <Text style={[styles.hotelCity, { color: themeColors.textSecondary, marginBottom: spacing.sm }]}>
                Hotels for the {selectedVariant.name} option
              </Text>
            ) : null}
            {stayHotels.map((h, i) => (
              <View key={`${h.name}-${i}`} style={[styles.hotelRow, i > 0 && { borderTopColor: themeColors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md }]}>
                {h.imageUrl ? (
                  <Image source={{ uri: normalizeImageUrl(h.imageUrl) }} style={styles.hotelImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.hotelImg, { backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="bed" size={18} color={colors.primary[400]} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hotelName, { color: themeColors.text }]} numberOfLines={1}>{h.name}</Text>
                  {!!(h.city || h.address) && (
                    <Text style={[styles.hotelCity, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {h.city || h.address}
                    </Text>
                  )}
                  {h.rating ? (
                    <View style={styles.hotelRating}>
                      <Ionicons name="star" size={12} color="#fbbf24" />
                      <Text style={[styles.hotelCity, { color: themeColors.textSecondary }]}>
                        {Number(h.rating).toFixed(1)}{h.reviewCount ? ` (${h.reviewCount})` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Inclusions / Exclusions */}
        {pkg.inclusions && pkg.inclusions.length > 0 ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Inclusions</Text>
            {pkg.inclusions.map((inc, i) => (
              <View key={i} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[styles.checkText, { color: themeColors.text }]}>{inc}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {pkg.exclusions && pkg.exclusions.length > 0 ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Not included</Text>
            {pkg.exclusions.map((ex, i) => (
              <View key={i} style={styles.checkRow}>
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={[styles.checkText, { color: themeColors.text }]}>{ex}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Cancellation */}
        {pkg.cancellationPolicy?.description ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Cancellation policy</Text>
            <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>{pkg.cancellationPolicy.description}</Text>
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky CTA — reflects the chosen variant + discount (green) */}
      <View style={[styles.cta, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <View style={{ flex: 1 }}>
          {off > 0 && mrp ? (
            <Text style={[styles.mrpStrike, { color: themeColors.textTertiary }]}>
              ₹{mrp.toLocaleString('en-IN')}
            </Text>
          ) : null}
          <Text style={[styles.priceValue, { color: off > 0 ? '#16a34a' : themeColors.text }]}>
            ₹{ctaPrice.toLocaleString('en-IN')}
            <Text style={[styles.priceMeta, { color: themeColors.textSecondary }]}>
              {pkg.pricing?.perPerson === false ? ' total' : ' / person'}
            </Text>
          </Text>
        </View>
        <Button
          title="Book Now"
          onPress={() => {
            const q = variantName ? `?variant=${encodeURIComponent(variantName)}` : '';
            const path = `/packages/checkout/${encodeURIComponent(pkg.slug || pkg._id)}${q}`;
            if (!requireAuth({ reason: 'Sign in to book this package. Travelers, dates, and payment will be saved to your account.', redirectAfter: path })) return;
            router.push(path);
          }}
          variant="primary"
          size="lg"
          icon={<Ionicons name="calendar" size={18} color="#fff" />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  errorTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  fab: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 50,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  carousel: { width: SCREEN_W, height: 280, backgroundColor: colors.gray[200] },
  carouselImage: { width: SCREEN_W, height: 280 },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },

  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary },

  section: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // Section accent pill (web parity: 4×20 blue→indigo bar before the title)
  sectionAccentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  sectionAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: '#3b82f6' },
  variantHint: { fontSize: fontSize.xs, marginBottom: 2 },
  variantCard: { width: 168, borderWidth: 2, borderRadius: 12, padding: spacing.md, gap: 4 },
  popularBadge: { position: 'absolute', top: -9, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  popularText: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  variantName: { fontSize: 11, fontWeight: fontWeight.semibold, letterSpacing: 0.5, marginTop: 4 },
  variantPrice: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  variantPer: { fontSize: 11, fontWeight: fontWeight.normal, color: '#9ca3af' },
  variantOnReq: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#2563eb' },
  variantFeat: { fontSize: 11 },
  variantSelect: { marginTop: 6, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(148,163,184,0.18)', alignItems: 'center' },
  variantSelectText: { fontSize: 12, fontWeight: fontWeight.bold },
  livePriceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  breakdown: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm, paddingTop: spacing.sm, gap: 6 },
  bdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bdK: { fontSize: fontSize.sm },
  bdV: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  bdTotal: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: '#16a34a' },
  bodyText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.xs },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary[500],
    marginTop: 8,
  },
  bulletText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },

  dayBlock: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  dayBody: { paddingLeft: 40, paddingTop: 6 },
  dayBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: colors.primary[700],
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xs,
  },
  dayTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  dayMeta: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    flex: 1,
  },
  dayLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  actRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.gray[100] },
  actThumbPh: { alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  actTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  actTitleLink: { color: '#2563eb' },
  whyBlock: { borderLeftWidth: 2, borderLeftColor: '#60a5fa', paddingLeft: 8, marginTop: 4 },
  whyText: { fontSize: 13, lineHeight: 18 },
  whyLabel: { fontWeight: fontWeight.bold, color: '#2563eb' },
  gtkText: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  gtkLabel: { fontWeight: fontWeight.bold },
  hotelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  hotelImg: { width: 52, height: 52, borderRadius: 10 },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stayImg: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.gray[100] },
  stayImgPh: { alignItems: 'center', justifyContent: 'center' },
  stayLabel: { fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.6 },
  stayName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 1 },
  hotelName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  hotelCity: { fontSize: fontSize.xs },
  hotelRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  checkText: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mrpStrike: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  priceValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[600] },
  priceMeta: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    color: colors.textSecondary,
  },
});
