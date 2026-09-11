import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
import { holidayPackagesAPI, destinationAPI, makeAPICall, videosAPI } from '@prayana/shared-services';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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
  description?: string;
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  transportType?: string;
  minGroupSize?: number;
  maxGroupSize?: number;
};

// One cell of the Quick Facts grid: pastel icon tile + label above value.
function QuickFact({
  icon, tint, fg, label, value, c,
}: { icon: any; tint: string; fg: string; label: string; value: string; c: any }) {
  return (
    <View style={styles.qfCell}>
      <View style={[styles.qfIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={15} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.qfLabel, { color: c.textSecondary }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.qfValue, { color: c.text }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// The trip's city route, deduped and with the origin removed — the web derives
// the Q&A destination this way rather than trusting primaryDestination, which
// on some imports holds the departure city. The server matches these names
// exactly (case-insensitively) against tripContext.destination, so pass plain
// city names — "Thimphu", never "Thimphu, Bhutan" or a slug.
function routeCities(pkg: HolidayPackage): string[] {
  const seen = new Set<string>();
  const route = (pkg.destinations || [])
    .map((d) => d.city || d.name)
    .filter((c): c is string => !!c)
    .filter((c) => {
      const k = c.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const firstLeg = String(pkg.itinerary?.[0]?.title || '');
  const arrow = firstLeg.split(/→|->|\sto\s/i);
  const origin = arrow.length > 1 ? arrow[0].trim() : null;
  const cities = route.filter(
    (c) => route.length < 2 || !origin || c.toLowerCase() !== origin.toLowerCase(),
  );
  return cities.length ? cities : route;
}

// Serve the YouTube iframe as HTML with a real baseUrl rather than navigating
// straight to youtube.com/embed — a bare WebView navigation sends no origin and
// YouTube refuses to embed, returning "Error 153".
function youtubeEmbedHtml(videoId: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
      iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe
      src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>
  </body>
</html>`;
}

// Numbered route-pill colours, cycling like the web's city strip.
const CITY_COLORS = ['#2563eb', '#059669', '#ea580c', '#dc2626', '#7e22ce'];

// Prayana Assured promises — the web's 2x2 white-on-gradient feature grid.
const ASSURED = [
  { label: 'Verified stays & vetted partners', icon: 'checkmark-circle' },
  { label: '24/7 support on the road', icon: 'headset' },
  { label: 'No hidden costs', icon: 'wallet' },
  { label: 'Easy rescheduling', icon: 'repeat' },
];

// Trust badges — the web TrustStrip's four pastel pills, same colour pairs.
const TRUST_BADGES = [
  { label: 'Verified Vendor', icon: 'shield-checkmark', bg: '#f0fdf4', fg: '#15803d' },
  { label: 'Free Cancellation', icon: 'calendar-outline', bg: '#eff6ff', fg: '#1d4ed8' },
  { label: 'Pay in Parts', icon: 'card-outline', bg: '#faf5ff', fg: '#7e22ce' },
  { label: 'Local Expert Guide', icon: 'person-outline', bg: '#fffbeb', fg: '#b45309' },
];

// Group a variant's hotels by city, keeping the first hotel's image for the row
// and joining every hotel name in that city — exactly what the web's
// VariantComparisonTable renders (one 28px thumb per city, max 3 cities).
function hotelsByCity(hotels?: PkgHotel[]) {
  const groups = new Map<string, PkgHotel[]>();
  for (const h of hotels || []) {
    const city = h.city || 'Stay';
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city)!.push(h);
  }
  return Array.from(groups.entries()).slice(0, 3);
}

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
  cancellationPolicy?: {
    description?: string;
    type?: string;
    rules?: { daysBeforeTravel: number; refundPercent: number }[];
  };
  stats?: { viewCount?: number; totalBookings?: number };
  difficulty?: string;
  packageType?: string;
  primaryDestination?: string;
  destinations?: {
    name?: string; city?: string; country?: string;
    nightsHere?: number; coordinates?: { lat?: number; lng?: number };
  }[];
  // Cost-to-reach from the user's origin city, computed server-side.
  reachability?: {
    origin?: { code?: string; city?: string };
    gateway?: string;
    direct?: boolean;
    via?: string | null;
    flightEstimate?: number;
    landPrice?: number;
    allInFrom?: number;
    estimated?: boolean;
  };
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
  const [similar, setSimilar] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [playingShort, setPlayingShort] = useState<any | null>(null);
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

  // Community Q&A. Two things matter here:
  //  * the route is /questions/by-destination — the plain /questions route
  //    silently drops a `destination` param and returns an unfiltered list.
  //  * do NOT use primaryDestination: on some imports it holds the DEPARTURE
  //    city (Delhi for a Manali package). Derive the route from destinations[],
  //    strip the origin, and send the whole route as `destinations` so the
  //    server can widen its match beyond the first city.
  useEffect(() => {
    if (!pkg) return;
    const cities = routeCities(pkg);
    if (!cities.length) return;
    let alive = true;
    const qs = `destination=${encodeURIComponent(cities[0])}` +
      `&destinations=${encodeURIComponent(cities.join(','))}&limit=4`;
    makeAPICall(`/questions/by-destination?${qs}`)
      .then((res: any) => {
        if (alive) setQuestions(res?.data || []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pkg]);

  // "In-depth experience" — traveller Shorts for the destination. Same call the
  // destination Videos tab uses: /youtube/search with shorts=1, keyed on the
  // city NAME (this is a search endpoint, unrelated to /destinations/videos,
  // which wants a destination id).
  useEffect(() => {
    if (!pkg) return;
    const cities = routeCities(pkg);
    if (!cities.length) return;
    let alive = true;
    videosAPI
      .search({ q: `${cities[0]} ${pkg.destinations?.[0]?.country || ''} travel`.trim(), max: 10, shorts: 1 })
      .then((res: any) => {
        if (!alive) return;
        const list = res?.results || res?.data || [];
        setShorts(Array.isArray(list) ? list.filter((v: any) => v?.id) : []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pkg]);

  // "You may also like" — packages sharing this one's primary destination.
  useEffect(() => {
    if (!pkg) return;
    const q = pkg.destination?.country || pkg.destination?.city || pkg.destinations?.[0]?.country;
    if (!q) return;
    let alive = true;
    holidayPackagesAPI
      .search({ q, limit: 6 })
      .then((res: any) => {
        if (!alive) return;
        const list = (res?.data || res?.packages || []).filter((s: any) => s._id !== pkg._id);
        setSimilar(list.slice(0, 5));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pkg]);

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
  const reach = pkg.reachability;
  const qaDestination = routeCities(pkg)[0] || '';


  // Every itinerary stop that carries coordinates, in trip order — drives the
  // route map. Falls back to the package destinations when activities have none.
  const routeStops: { title: string; lat: number; lng: number; city?: string }[] = (() => {
    const stops: { title: string; lat: number; lng: number; city?: string }[] = [];
    for (const d of pkg.itinerary || []) {
      for (const a of d.activities || []) {
        const pd: any = typeof a === 'object' ? (a as any)?.placeDetails : null;
        if (pd?.lat != null && pd?.lng != null) {
          stops.push({ title: itemLabel(a), lat: Number(pd.lat), lng: Number(pd.lng), city: pd.city });
        }
      }
    }
    if (stops.length) return stops;
    return (pkg.destinations || [])
      .filter((d) => d.coordinates?.lat != null && d.coordinates?.lng != null)
      .map((d) => ({
        title: d.name || d.city || 'Stop',
        lat: Number(d.coordinates!.lat),
        lng: Number(d.coordinates!.lng),
        city: d.city,
      }));
  })();

  // Fit the map to every stop with a little padding.
  const routeRegion = (() => {
    if (!routeStops.length) return undefined;
    const lats = routeStops.map((s) => s.lat);
    const lngs = routeStops.map((s) => s.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.5),
    };
  })();

  // Social-proof line from stats, like the web TrustStrip.
  const socialProof = (() => {
    const parts: string[] = [];
    const views = pkg.stats?.viewCount || 0;
    const booked = pkg.stats?.totalBookings || 0;
    if (views > 0) parts.push(`${views.toLocaleString('en-IN')} people viewed this`);
    if (booked > 0) parts.push(`${booked.toLocaleString('en-IN')} booked`);
    return parts.join(' · ');
  })();

  // Cheapest / dearest across bookable variants — drives the "Best value" badge,
  // the "+₹N" delta and the price-spread bar, like the web comparison table.
  const bookablePrices = (pkg.variants || [])
    .filter((v) => !v.pricing?.isOnRequest)
    .map((v) => variantPrice(v))
    .filter((n) => n > 0);
  const cheapestPrice = bookablePrices.length ? Math.min(...bookablePrices) : 0;
  const dearestPrice = bookablePrices.length ? Math.max(...bookablePrices) : 0;
  const spread = dearestPrice - cheapestPrice;

  // Show the chosen variant's per-person price (else the "from" price).
  const ctaPrice = selectedVariant && !selectedVariant.pricing?.isOnRequest
    ? (variantPrice(selectedVariant) || price)
    : price;
  const mrp = pkg.pricing?.mrp;
  const off = mrp && mrp > ctaPrice ? Math.round(((mrp - ctaPrice) / mrp) * 100) : 0;

  // Indicative cost of arranging the same trip yourself, derived from the
  // package price so it always reads sensibly. Labelled as indicative in the UI.
  const diy = ctaPrice > 0 && nights > 0
    ? (() => {
        const hotels = Math.round((ctaPrice * 0.5) / 100) * 100;
        const transport = Math.round((ctaPrice * 0.3) / 100) * 100;
        const extras = Math.round((ctaPrice * 0.35) / 100) * 100;
        return { hotels, transport, extras, total: hotels + transport + extras };
      })()
    : null;

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
          {/* Photo counter — the web's "View Photos" pill is hover-only, so it
              never appears on touch. Show the count instead. */}
          {images.length > 1 && images[0].url ? (
            <View style={styles.photoCount}>
              <Ionicons name="images-outline" size={12} color="#374151" />
              <Text style={styles.photoCountText}>{activeImageIdx + 1}/{images.length}</Text>
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

          {/* Social proof — views / bookings, like the web TrustStrip header. */}
          {socialProof ? (
            <Text style={[styles.socialProof, { color: themeColors.textSecondary }]}>{socialProof}</Text>
          ) : null}

          {/* Trust badges — four pastel pills, web parity. */}
          <View style={[styles.trustStrip, { borderTopColor: themeColors.border }]}>
            {TRUST_BADGES.map((b) => (
              <View key={b.label} style={[styles.trustPill, { backgroundColor: b.bg }]}>
                <Ionicons name={b.icon as any} size={13} color={b.fg} />
                <Text style={[styles.trustText, { color: b.fg }]}>{b.label}</Text>
              </View>
            ))}
          </View>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}
            >
              {pkg.variants.map((v) => {
                const active = variantName === v.name;
                const onReq = v.pricing?.isOnRequest;
                const vp = variantPrice(v);
                const isCheapest = !onReq && vp === cheapestPrice && pkg.variants!.length > 1;
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
                    {/* One badge only: Best value (cheapest) wins over Most Popular. */}
                    {isCheapest || v.isDefault ? (
                      <View style={[styles.popularBadge, { backgroundColor: isCheapest ? '#059669' : '#2563eb' }]}>
                        <Ionicons name={isCheapest ? 'trending-up' : 'ribbon'} size={9} color="#fff" />
                        <Text style={styles.popularText}>{isCheapest ? 'BEST VALUE' : 'MOST POPULAR'}</Text>
                      </View>
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

                    {/* Price delta vs the cheapest option. */}
                    {!onReq ? (
                      <Text style={[styles.variantDelta, { color: isCheapest ? '#059669' : themeColors.textTertiary }]}>
                        {isCheapest ? 'Lowest price' : `+₹${Number(vp - cheapestPrice).toLocaleString('en-IN')}`}
                      </Text>
                    ) : null}

                    {/* Price-spread bar — how this option sits between cheapest and dearest. */}
                    {spread > 0 && !onReq ? (
                      <View style={styles.spreadTrack}>
                        <View
                          style={[
                            styles.spreadFill,
                            {
                              width: `${Math.max(4, ((vp - cheapestPrice) / spread) * 100)}%`,
                              backgroundColor: active ? '#3b82f6' : '#d1d5db',
                            },
                          ]}
                        />
                      </View>
                    ) : null}

                    {/* Hotels — one thumbnail per city, names joined (web parity). */}
                    {hotelsByCity(v.hotels).length > 0 ? (
                      <View style={[styles.vHotels, { borderTopColor: themeColors.border }]}>
                        {hotelsByCity(v.hotels).map(([city, hs]) => (
                          <View key={city} style={styles.vHotelRow}>
                            {hs[0].imageUrl ? (
                              <Image
                                source={{ uri: normalizeImageUrl(hs[0].imageUrl) }}
                                style={styles.vHotelImg}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                              />
                            ) : (
                              <View style={[styles.vHotelImg, styles.vHotelPh]}>
                                <Ionicons name="bed" size={11} color="#9ca3af" />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.vHotelText} numberOfLines={2}>
                                <Text style={{ color: themeColors.textTertiary }}>{city}: </Text>
                                <Text style={[styles.vHotelName, { color: themeColors.text }]}>
                                  {hs.map((h) => h.name).join(' / ')}
                                </Text>
                              </Text>
                              {hs[0].rating ? (
                                <View style={styles.vHotelRating}>
                                  <Ionicons name="star" size={9} color="#d97706" />
                                  <Text style={styles.vHotelRatingText}>
                                    {hs[0].rating}
                                    {hs[0].reviewCount ? ` (${Number(hs[0].reviewCount).toLocaleString('en-IN')})` : ''}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Differing features */}
                    <View style={[styles.vFeatures, { borderTopColor: themeColors.border }]}>
                      {v.hotelCategory ? (
                        <View style={styles.vFeatRow}>
                          <Ionicons name="business-outline" size={11} color="#9ca3af" />
                          <Text style={[styles.vFeatText, { color: themeColors.text }]} numberOfLines={1}>
                            {HOTEL_LABEL[v.hotelCategory] || v.hotelCategory}
                          </Text>
                        </View>
                      ) : null}
                      {v.mealPlan ? (
                        <View style={styles.vFeatRow}>
                          <Ionicons name="restaurant-outline" size={11} color="#9ca3af" />
                          <Text style={[styles.vFeatText, { color: themeColors.text }]} numberOfLines={1}>
                            {MEAL_LABEL[v.mealPlan] || v.mealPlan}
                          </Text>
                        </View>
                      ) : null}
                      {v.roomType ? (
                        <View style={styles.vFeatRow}>
                          <Ionicons name="bed-outline" size={11} color="#9ca3af" />
                          <Text style={[styles.vFeatText, { color: themeColors.text }]} numberOfLines={1}>{v.roomType}</Text>
                        </View>
                      ) : null}
                      {v.transportType ? (
                        <View style={styles.vFeatRow}>
                          <Ionicons name="car-outline" size={11} color="#9ca3af" />
                          <Text style={[styles.vFeatText, { color: themeColors.text }]} numberOfLines={1}>{v.transportType}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Highlights — up to 4, emerald checks */}
                    {v.highlights && v.highlights.length > 0 ? (
                      <View style={styles.vHighlights}>
                        {v.highlights.slice(0, 4).map((h, hi) => (
                          <View key={hi} style={styles.vHiRow}>
                            <Ionicons name="checkmark" size={10} color="#10b981" />
                            <Text style={[styles.vHiText, { color: themeColors.textSecondary }]} numberOfLines={1}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={[styles.variantSelect, active && { backgroundColor: '#2563eb' }]}>
                      <Text style={[styles.variantSelectText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                        {onReq ? (active ? 'Selected — ask for a quote' : 'Get a quote') : active ? 'Selected' : 'Select'}
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

        {/* Quick facts — 2×2 pastel icon grid, web parity */}
        <Card style={styles.section}>
          <View style={styles.qfHead}>
            <View style={[styles.qfHeadIcon, { backgroundColor: '#fffbeb' }]}>
              <Ionicons name="sparkles" size={14} color="#d97706" />
            </View>
            <Text style={[styles.qfHeadText, { color: themeColors.textSecondary }]}>QUICK FACTS</Text>
          </View>
          <View style={styles.qfGrid}>
            {days > 0 ? (
              <QuickFact icon="calendar-outline" tint="#eff6ff" fg="#2563eb" label="Duration" value={`${days}D / ${nights}N`} c={themeColors} />
            ) : null}
            {(pkg.destinations || []).length > 0 ? (
              <QuickFact icon="location-outline" tint="#ecfdf5" fg="#059669" label="Destinations" value={`${pkg.destinations!.length} Place${pkg.destinations!.length === 1 ? '' : 's'}`} c={themeColors} />
            ) : null}
            {pkg.difficulty ? (
              <QuickFact icon="navigate-outline" tint="#faf5ff" fg="#7e22ce" label="Difficulty" value={pkg.difficulty.charAt(0).toUpperCase() + pkg.difficulty.slice(1)} c={themeColors} />
            ) : null}
            {pkg.packageType ? (
              <QuickFact icon="triangle-outline" tint="#fffbeb" fg="#d97706" label="Type" value={pkg.packageType.charAt(0).toUpperCase() + pkg.packageType.slice(1)} c={themeColors} />
            ) : null}
          </View>
        </Card>

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

        {/* About — gradient icon tile + subtitle, matching the web card */}
        {pkg.description || pkg.shortDescription ? (
          <Card style={[styles.section, styles.aboutCard]}>
            <View style={styles.aboutHead}>
              <LinearGradient
                colors={['#3b82f6', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.aboutIcon}
              >
                <Ionicons name="sparkles" size={17} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aboutTitle, { color: themeColors.text }]}>About this package</Text>
                <Text style={[styles.aboutSub, { color: themeColors.textSecondary }]}>
                  A quick overview of what&apos;s in store
                </Text>
              </View>
            </View>
            <Text style={[styles.aboutBody, { color: themeColors.textSecondary }]}>
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
                    {/* "DAY 1" pill — the web uses a full label, not a "D1" chip.
                        Filled blue when open, outlined when collapsed. */}
                    <View style={[styles.dayBadge, open ? styles.dayBadgeOpen : styles.dayBadgeClosed]}>
                      <Text style={[styles.dayBadgeText, { color: open ? '#fff' : '#2563eb' }]}>DAY {dayNo}</Text>
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

        {/* Route map — every stop on the trip, plotted */}
        {routeStops.length > 0 ? (
          <Card style={[styles.section, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.mapHead}>
              <View style={styles.sectionAccentRow}>
                <Ionicons name="map" size={16} color="#2563eb" />
                <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Your route</Text>
              </View>
              <Text style={[styles.aboutSub, { color: themeColors.textSecondary }]}>
                {routeStops.length} stops across {(pkg.destinations || []).length || 1} destination
                {((pkg.destinations || []).length || 1) === 1 ? '' : 's'}
              </Text>
            </View>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.routeMap}
              initialRegion={routeRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              toolbarEnabled={false}
            >
              <Polyline
                coordinates={routeStops.map((s) => ({ latitude: s.lat, longitude: s.lng }))}
                strokeColor="#2563eb"
                strokeWidth={3}
              />
              {routeStops.map((s, i) => (
                <Marker
                  key={`${s.title}-${i}`}
                  coordinate={{ latitude: s.lat, longitude: s.lng }}
                  title={s.title}
                  description={s.city}
                  pinColor={i === 0 ? '#059669' : i === routeStops.length - 1 ? '#dc2626' : '#2563eb'}
                />
              ))}
            </MapView>
            {/* Numbered city pills under the map, like the web route strip. */}
            {(pkg.destinations || []).length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityStrip}
              >
                {(pkg.destinations || []).map((d, i) => (
                  <View key={`${d.name}-${i}`} style={styles.cityPillRow}>
                    <View style={[styles.cityNum, { backgroundColor: CITY_COLORS[i % CITY_COLORS.length] }]}>
                      <Text style={styles.cityNumText}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.cityName, { color: themeColors.text }]} numberOfLines={1}>
                      {d.name || d.city}
                    </Text>
                    {i < (pkg.destinations || []).length - 1 ? (
                      <Ionicons name="arrow-forward" size={12} color={themeColors.textTertiary} style={{ marginHorizontal: 6 }} />
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.mapExpand}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: '/place-map',
                  params: {
                    lat: String(routeStops[0].lat),
                    lng: String(routeStops[0].lng),
                    name: routeStops[0].title,
                    address: routeStops[0].city || '',
                  },
                } as any)
              }
            >
              <Ionicons name="expand-outline" size={14} color="#2563eb" />
              <Text style={styles.mapExpandText}>Open map</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* In-depth experience — traveller Shorts */}
        {shorts.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionAccentRow}>
              <Ionicons name="sparkles" size={16} color="#0ea5e9" />
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>In-depth experience</Text>
            </View>
            <Text style={[styles.aboutSub, { color: themeColors.textSecondary, marginBottom: spacing.md }]}>
              Quick Shorts from fellow travellers — a glimpse of what to expect.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {shorts.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.shortCard}
                  activeOpacity={0.9}
                  onPress={() => setPlayingShort(v)}
                >
                  <Image
                    source={{ uri: v.thumbnail }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.shortPlay}>
                    <Ionicons name="play" size={16} color="#111827" />
                  </View>
                  <View style={styles.shortMeta}>
                    <Text style={styles.shortTitle} numberOfLines={2}>{v.title}</Text>
                    <Text style={styles.shortChannel} numberOfLines={1}>
                      {v.channel}{v.views ? ` · ${v.views}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Travellers asked about {destination} — community Q&A */}
        {questions.length > 0 ? (
          <Card style={styles.section}>
            <View style={styles.qaHead}>
              <View style={styles.qaHeadIcon}>
                <Ionicons name="chatbubble-ellipses" size={15} color="#ea580c" />
              </View>
              <Text style={[styles.qaTitle, { color: themeColors.text }]} numberOfLines={1}>
                Travelers asked about <Text style={{ color: '#ea580c' }}>{qaDestination}</Text>
              </Text>
            </View>
            <View style={[styles.qaList, { borderTopColor: themeColors.border }]}>
              {questions.map((q) => (
                <TouchableOpacity
                  key={q._id}
                  style={styles.qaItem}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/community/${q._id}` as any)}
                >
                  <Text style={[styles.qaQ, { color: themeColors.text }]} numberOfLines={2}>{q.title}</Text>
                  <View style={styles.qaMeta}>
                    <Ionicons name="chatbubble-outline" size={12} color={themeColors.textTertiary} />
                    <Text style={[styles.qaMetaText, { color: themeColors.textTertiary }]}>{q.answerCount || 0}</Text>
                    <Ionicons name="thumbs-up-outline" size={12} color={themeColors.textTertiary} style={{ marginLeft: 8 }} />
                    <Text style={[styles.qaMetaText, { color: themeColors.textTertiary }]}>{q.upvotes || 0}</Text>
                    {q.isResolved ? (
                      <View style={styles.qaResolved}>
                        <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        <Text style={styles.qaResolvedText}>Resolved</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.qaAsk}
              activeOpacity={0.85}
              onPress={() => router.push(`/community/ask?destination=${encodeURIComponent(qaDestination)}` as any)}
            >
              <Text style={styles.qaAskText}>Ask your own question</Text>
              <Ionicons name="arrow-forward" size={14} color="#ea580c" />
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Destination highlights — the places this trip covers */}
        {(pkg.destinations || []).length > 0 ? (
          <Card style={styles.section}>
            <View style={styles.sectionAccentRow}>
              <Ionicons name="location" size={16} color="#059669" />
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Destination highlights</Text>
            </View>
            <View style={styles.destGrid}>
              {(pkg.destinations || []).map((d, i) => (
                <View key={`${d.name}-${i}`} style={[styles.destChip, { borderColor: themeColors.border }]}>
                  <View style={styles.destDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.destName, { color: themeColors.text }]} numberOfLines={1}>
                      {d.name || d.city}
                    </Text>
                    {(d as any).nightsHere ? (
                      <Text style={[styles.destNights, { color: themeColors.textSecondary }]}>
                        {(d as any).nightsHere} night{(d as any).nightsHere === 1 ? '' : 's'}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
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

        {/* Getting there — cost-to-reach from the traveller's origin city.
            The web keeps this in a desktop-only sidebar, so mobile never saw
            it even though the server computes it. */}
        {reach && (reach.allInFrom || reach.flightEstimate) ? (
          <Card style={[styles.section, styles.reachCard]}>
            <View style={styles.sectionAccentRow}>
              <Ionicons name="airplane" size={16} color="#b45309" />
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Getting there</Text>
            </View>
            {reach.origin?.city ? (
              <Text style={[styles.reachRoute, { color: themeColors.text }]}>
                {reach.origin.city}
                {reach.origin.code ? ` (${reach.origin.code})` : ''} → {reach.gateway || 'gateway'}
                <Text style={{ color: themeColors.textSecondary, fontWeight: fontWeight.normal }}>
                  {reach.direct ? '  ·  Direct flight' : reach.via ? `  ·  via ${reach.via}` : ''}
                </Text>
              </Text>
            ) : null}
            <View style={[styles.reachRows, { borderTopColor: themeColors.border }]}>
              {reach.landPrice ? (
                <View style={styles.reachRow}>
                  <Text style={[styles.reachK, { color: themeColors.textSecondary }]}>Package (land only)</Text>
                  <Text style={[styles.reachV, { color: themeColors.text }]}>₹{Number(reach.landPrice).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
              {reach.flightEstimate ? (
                <View style={styles.reachRow}>
                  <Text style={[styles.reachK, { color: themeColors.textSecondary }]}>
                    Flights (est.){reach.estimated ? '' : ''}
                  </Text>
                  <Text style={[styles.reachV, { color: themeColors.text }]}>₹{Number(reach.flightEstimate).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
              {reach.allInFrom ? (
                <View style={[styles.reachRow, styles.reachTotalRow, { borderTopColor: themeColors.border }]}>
                  <Text style={[styles.reachK, { color: themeColors.text, fontWeight: fontWeight.bold }]}>All-in from</Text>
                  <Text style={styles.reachTotal}>₹{Number(reach.allInFrom).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.reachNote, { color: themeColors.textTertiary }]}>
              Flights are booked separately — this is an estimate to help you compare.
            </Text>
          </Card>
        ) : null}

        {/* Cancellation — refund ladder, not just the blurb */}
        {pkg.cancellationPolicy?.description || (pkg.cancellationPolicy?.rules || []).length > 0 ? (
          <Card style={styles.section}>
            <View style={styles.sectionAccentRow}>
              <Ionicons name="shield-checkmark" size={16} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Cancellation policy</Text>
            </View>
            {(pkg.cancellationPolicy?.rules || []).length > 0 ? (
              <View style={styles.refundLadder}>
                {(pkg.cancellationPolicy!.rules || []).map((r, i) => (
                  <View key={i} style={styles.refundRow}>
                    <View style={[styles.refundDot, { backgroundColor: r.refundPercent >= 100 ? '#10b981' : r.refundPercent > 0 ? '#f59e0b' : '#ef4444' }]} />
                    <Text style={[styles.refundText, { color: themeColors.textSecondary }]}>
                      {r.daysBeforeTravel > 0
                        ? `Cancel ${r.daysBeforeTravel}+ days before travel`
                        : 'Cancel within 24 hours of travel'}
                    </Text>
                    <Text
                      style={[
                        styles.refundPct,
                        { color: r.refundPercent >= 100 ? '#059669' : r.refundPercent > 0 ? '#d97706' : '#dc2626' },
                      ]}
                    >
                      {r.refundPercent}% refund
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {pkg.cancellationPolicy?.description ? (
              <Text style={[styles.bodyText, { color: themeColors.textSecondary, marginTop: spacing.sm }]}>
                {pkg.cancellationPolicy.description}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* Prayana Assured — emerald→teal→cyan gradient, white text (web parity) */}
        <LinearGradient
          colors={['#059669', '#0d9488', '#0891b2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.section, styles.assuredCard]}
        >
          <View style={styles.assuredHead}>
            <View style={styles.assuredIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assuredTitle}>Prayana Assured</Text>
              <Text style={styles.assuredSub}>Every booking is backed by us</Text>
            </View>
          </View>
          <View style={styles.assuredGrid}>
            {ASSURED.map((a) => (
              <View key={a.label} style={styles.assuredCell}>
                <Ionicons name={a.icon as any} size={14} color="#fff" />
                <Text style={styles.assuredText}>{a.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* DIY vs package — what booking it yourself would cost */}
        {diy ? (
          <Card style={styles.section}>
            <View style={styles.sectionAccentRow}>
              <Ionicons name="calculator-outline" size={16} color="#7e22ce" />
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Book it yourself vs this package</Text>
            </View>
            <View style={[styles.diyRows, { borderTopColor: themeColors.border }]}>
              <View style={styles.diyRow}>
                <Text style={[styles.diyK, { color: themeColors.textSecondary }]}>Hotels ({nights} nights)</Text>
                <Text style={[styles.diyV, { color: themeColors.text }]}>₹{diy.hotels.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.diyRow}>
                <Text style={[styles.diyK, { color: themeColors.textSecondary }]}>Transport &amp; transfers</Text>
                <Text style={[styles.diyV, { color: themeColors.text }]}>₹{diy.transport.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.diyRow}>
                <Text style={[styles.diyK, { color: themeColors.textSecondary }]}>Meals &amp; entry fees</Text>
                <Text style={[styles.diyV, { color: themeColors.text }]}>₹{diy.extras.toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.diyRow, styles.diyTotalRow, { borderTopColor: themeColors.border }]}>
                <Text style={[styles.diyK, { color: themeColors.text, fontWeight: fontWeight.bold }]}>Doing it yourself</Text>
                <Text style={[styles.diyV, { color: themeColors.text, fontWeight: fontWeight.bold }]}>
                  ₹{diy.total.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.diyRow}>
                <Text style={[styles.diyK, { color: '#059669', fontWeight: fontWeight.bold }]}>This package</Text>
                <Text style={styles.diySave}>₹{ctaPrice.toLocaleString('en-IN')}</Text>
              </View>
            </View>
            {diy.total > ctaPrice ? (
              <View style={styles.diyBanner}>
                <Ionicons name="sparkles" size={13} color="#059669" />
                <Text style={styles.diyBannerText}>
                  You save about ₹{(diy.total - ctaPrice).toLocaleString('en-IN')} per person
                </Text>
              </View>
            ) : null}
            <Text style={[styles.reachNote, { color: themeColors.textTertiary }]}>
              Indicative market rates for the same standard of stay and transport.
            </Text>
          </Card>
        ) : null}

        {/* Traveller reviews */}
        <Card style={styles.section}>
          <View style={styles.sectionAccentRow}>
            <Ionicons name="star" size={16} color="#f59e0b" />
            <Text style={[styles.sectionTitle, { color: themeColors.text, marginBottom: 0 }]}>Traveller reviews</Text>
          </View>
          {pkg.rating?.count ? (
            <View style={styles.reviewSummary}>
              <Text style={[styles.reviewAvg, { color: themeColors.text }]}>{pkg.rating.average?.toFixed(1)}</Text>
              <View style={{ flex: 1 }}>
                <StarRating rating={pkg.rating.average || 0} size={14} />
                <Text style={[styles.aboutSub, { color: themeColors.textSecondary }]}>
                  {pkg.rating.count} review{pkg.rating.count === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyReviews}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={themeColors.textTertiary} />
              <Text style={[styles.aboutSub, { color: themeColors.textSecondary, textAlign: 'center' }]}>
                No reviews yet — be the first to travel and tell us how it went.
              </Text>
            </View>
          )}
        </Card>

        {/* Been on this trip? — share memories */}
        <Card style={[styles.section, styles.shareCard]}>
          <View style={styles.shareRow}>
            <View style={styles.shareIcon}>
              <Ionicons name="camera" size={18} color="#7e22ce" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aboutTitle, { color: themeColors.text }]}>Been on this trip?</Text>
              <Text style={[styles.aboutSub, { color: themeColors.textSecondary }]}>
                Share your photos and help future travellers.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.shareBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/community' as any)}
          >
            <Ionicons name="images-outline" size={15} color="#fff" />
            <Text style={styles.shareBtnText}>Share your memories</Text>
          </TouchableOpacity>
        </Card>

        {/* You may also like */}
        {similar.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>You may also like</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {similar.map((s) => {
                const simg = (s.images || []).find((i: any) => i?.url)?.url;
                return (
                  <TouchableOpacity
                    key={s._id}
                    style={[styles.simCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                    activeOpacity={0.9}
                    onPress={() => router.replace(`/packages/${encodeURIComponent(s._id)}` as any)}
                  >
                    {simg ? (
                      <Image source={{ uri: normalizeImageUrl(simg) }} style={styles.simImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.simImg, { backgroundColor: colors.gray[100] }]} />
                    )}
                    <View style={{ padding: spacing.sm }}>
                      <Text style={[styles.simTitle, { color: themeColors.text }]} numberOfLines={2}>{s.title}</Text>
                      {s.pricing?.startingFrom ? (
                        <Text style={[styles.simPrice, { color: themeColors.text }]}>
                          ₹{Number(s.pricing.startingFrom).toLocaleString('en-IN')}
                          <Text style={styles.variantPer}> /person</Text>
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky CTA — reflects the chosen variant + discount (green) */}
      <View style={[styles.cta, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <View style={{ flex: 1 }}>
          {/* Variant label above the price, like the web sticky bar. */}
          {selectedVariant ? (
            <Text style={[styles.ctaVariant, { color: themeColors.textTertiary }]} numberOfLines={1}>
              {selectedVariant.displayName || selectedVariant.name}
            </Text>
          ) : null}
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
        {/* blue-600 to match the web CTA — the shared Button's primary is the
            orange brand colour, which this page never uses. */}
        <TouchableOpacity
          style={styles.bookBtn}
          activeOpacity={0.9}
          onPress={() => {
            const q = variantName ? `?variant=${encodeURIComponent(variantName)}` : '';
            // _id, not slug: some slugs resolve to empty duplicate documents.
            const path = `/packages/checkout/${encodeURIComponent(pkg._id)}${q}`;
            if (!requireAuth({ reason: 'Sign in to book this package. Travelers, dates, and payment will be saved to your account.', redirectAfter: path })) return;
            router.push(path);
          }}
        >
          <Text style={styles.bookBtnText}>
            {selectedVariant?.pricing?.isOnRequest ? 'Get a quote' : 'Book Now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Shorts player — plays inside the app rather than kicking out to
          YouTube. The close bar sits OUTSIDE the WebView's rectangle, because a
          native web layer hit-tests before RN siblings and would swallow the
          tap if the button were laid over it. */}
      <Modal
        visible={!!playingShort}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPlayingShort(null)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <SafeAreaView style={styles.playerSafe} edges={['top', 'bottom']}>
          <View style={styles.playerBar}>
            <TouchableOpacity
              onPress={() => setPlayingShort(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.playerClose}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.playerTitle} numberOfLines={1}>{playingShort?.channel || 'Short'}</Text>
            <TouchableOpacity
              onPress={() => setPlayingShort(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.playerDone}
            >
              <Text style={styles.playerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          {playingShort ? (
            <WebView
              source={{ html: youtubeEmbedHtml(playingShort.id), baseUrl: 'https://prayanaai.com' }}
              originWhitelist={['*']}
              style={styles.playerWeb}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
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
  // 78% of the viewport, matching the web carousel — the card carries hotel
  // rows, feature rows and highlights, so a 168px chip could never hold it.
  variantCard: { width: Math.round(SCREEN_W * 0.78), borderWidth: 2, borderRadius: 12, padding: spacing.md, gap: 4 },
  variantDelta: { fontSize: 11, fontWeight: fontWeight.semibold },
  ctaVariant: { fontSize: 11, fontWeight: fontWeight.medium, marginBottom: 1 },
  photoCount: {
    position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  photoCountText: { fontSize: 11, fontWeight: fontWeight.bold, color: '#374151' },
  socialProof: { fontSize: 12, marginTop: 6 },
  qfHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  qfHeadIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qfHeadText: { fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
  qfGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  qfCell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  qfIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qfLabel: { fontSize: 11 },
  qfValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 1 },
  aboutCard: { backgroundColor: '#f8fbff' },
  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  aboutIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aboutTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  aboutSub: { fontSize: 12, marginTop: 1 },
  aboutBody: { fontSize: fontSize.sm, lineHeight: 22 },
  // Shorts rail — portrait 9:16 cards, like the web
  shortCard: { width: 150, height: 267, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.gray[200] },
  shortPlay: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  shortMeta: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  shortTitle: { color: '#fff', fontSize: 12, fontWeight: fontWeight.bold, lineHeight: 16 },
  shortChannel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 3 },
  playerSafe: { flex: 1, backgroundColor: '#000' },
  playerBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  playerClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  playerTitle: { flex: 1, color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  playerDone: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  playerDoneText: { color: '#fff', fontSize: 13, fontWeight: fontWeight.bold },
  playerWeb: { flex: 1, backgroundColor: '#000' },
  qaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qaHeadIcon: { width: 30, height: 30, borderRadius: 999, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  qaTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  qaList: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  qaItem: { paddingVertical: 12 },
  qaQ: { fontSize: fontSize.sm, lineHeight: 20 },
  qaMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  qaMetaText: { fontSize: 12 },
  qaResolved: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 10 },
  qaResolvedText: { fontSize: 12, color: '#059669', fontWeight: fontWeight.medium },
  qaAsk: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff7ed', borderRadius: 10, paddingVertical: 12, marginTop: spacing.sm },
  qaAskText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#ea580c' },
  mapHead: { padding: spacing.lg, paddingBottom: spacing.sm },
  routeMap: { width: '100%', height: 220 },
  cityStrip: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  cityPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cityNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cityNumText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold },
  cityName: { fontSize: 13, fontWeight: fontWeight.medium },
  mapExpand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  mapExpandText: { fontSize: 13, fontWeight: fontWeight.bold, color: '#2563eb' },
  destGrid: { marginTop: spacing.md, gap: 8 },
  destChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: spacing.md },
  destDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  destName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  destNights: { fontSize: 11, marginTop: 1 },
  assuredCard: { borderRadius: 16, padding: spacing.lg },
  assuredHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assuredIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  assuredTitle: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  assuredSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },
  assuredGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md, rowGap: 10 },
  assuredCell: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingRight: 8 },
  assuredText: { flex: 1, color: '#fff', fontSize: 11, lineHeight: 15 },
  diyRows: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  diyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diyTotalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  diyK: { fontSize: 13 },
  diyV: { fontSize: 13, fontWeight: fontWeight.semibold },
  diySave: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#059669' },
  diyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ecfdf5', borderRadius: 10, paddingVertical: 9, marginTop: spacing.md },
  diyBannerText: { fontSize: 13, fontWeight: fontWeight.bold, color: '#059669' },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  reviewAvg: { fontSize: 34, fontWeight: fontWeight.bold },
  emptyReviews: { alignItems: 'center', gap: 8, paddingVertical: spacing.lg },
  shareCard: { backgroundColor: '#faf5ff' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7e22ce', borderRadius: 12, paddingVertical: 12, marginTop: spacing.md },
  shareBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  simCard: { width: 190, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  simImg: { width: '100%', height: 110 },
  simTitle: { fontSize: 13, fontWeight: fontWeight.semibold, lineHeight: 17 },
  simPrice: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 4 },
  trustStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  trustText: { fontSize: 11, fontWeight: fontWeight.medium },
  reachCard: { backgroundColor: '#fffbeb' },
  reachRoute: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 6 },
  reachRows: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  reachRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reachTotalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 2 },
  reachK: { fontSize: 13 },
  reachV: { fontSize: 13, fontWeight: fontWeight.semibold },
  reachTotal: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#b45309' },
  reachNote: { fontSize: 11, lineHeight: 15, marginTop: 8 },
  refundLadder: { marginTop: spacing.sm, gap: 8 },
  refundRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refundDot: { width: 8, height: 8, borderRadius: 4 },
  refundText: { flex: 1, fontSize: 13 },
  refundPct: { fontSize: 13, fontWeight: fontWeight.bold },
  bookBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  bookBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  spreadTrack: { height: 4, borderRadius: 2, backgroundColor: '#f3f4f6', marginTop: 6, overflow: 'hidden' },
  spreadFill: { height: 4, borderRadius: 2 },
  vHotels: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8, gap: 6 },
  vHotelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  vHotelImg: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#f3f4f6', marginTop: 1 },
  vHotelPh: { alignItems: 'center', justifyContent: 'center' },
  vHotelText: { fontSize: 11, lineHeight: 15 },
  vHotelName: { fontWeight: fontWeight.semibold },
  vHotelRating: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  vHotelRatingText: { fontSize: 10, color: '#d97706', fontWeight: fontWeight.semibold },
  vFeatures: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8, gap: 5 },
  vFeatRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vFeatText: { flex: 1, fontSize: 11, fontWeight: fontWeight.medium },
  vHighlights: { marginTop: 8, gap: 4 },
  vHiRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vHiText: { flex: 1, fontSize: 11 },
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
  // "DAY n" pill, blue — the page's accent is Tailwind blue, not the orange
  // brand colour the shared palette defaults to.
  dayBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeOpen: { backgroundColor: '#2563eb' },
  dayBadgeClosed: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  dayBadgeText: {
    fontWeight: fontWeight.bold,
    fontSize: 11,
    letterSpacing: 0.4,
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
