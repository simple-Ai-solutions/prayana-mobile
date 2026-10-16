// The phone version of the web's holiday-package landing pages
// (components/packages/landing/PackageLandingPage.jsx + lib/packageLanding.js):
//
//   /packages/in/<place>              "Himachal Pradesh Tour Packages"
//   /packages/in/<place>/<facet>      "… from Delhi", "… Honeymoon Packages",
//                                     "… 4 Days 3 Nights Packages"
//   /packages/from/<city>             "Tour Packages from Delhi"
//   /packages/type/<type>             "Honeymoon Packages"
//
// Same data, same rules for what a page lists and the same heading copy, so a
// link shared from the site opens the same list here. The web builds these on
// the server from the whole catalogue; the phone asks the same endpoints:
//   - a place:  GET /packages/search?destination=<query>&view=card&limit=200
//               (cities resolved from GET /packages/facets, regions are fixed)
//   - a type:   GET /packages/search?category=<category>&view=card&limit=200
//   - a city:   the catalogue (GET /packages/search?view=card&limit=200&page=n),
//               filtered on departureCities — the search has no origin filter.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { EmptyState, colors, spacing, useTheme } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { HolidayCard, BLUE } from './HolidayCards';
import { useGoBack } from '../../lib/goBack';

// ---------------------------------------------------------------------------
// Rules and vocabulary, as lib/packageLanding.js and lib/packageDestinations.js
// define them.

const MIN_FACET_PACKAGES = 2;
const MIN_CITY_PACKAGES = 2;

const TRIP_TYPES = [
  { slug: 'honeymoon', category: 'Honeymoon', label: 'Honeymoon' },
  { slug: 'family', category: 'Family', label: 'Family' },
  { slug: 'adventure', category: 'Adventure Trek', label: 'Adventure' },
  { slug: 'pilgrimage', category: 'Pilgrimage', label: 'Pilgrimage' },
  { slug: 'weekend-getaway', category: 'Weekend Getaway', label: 'Weekend Getaway' },
  { slug: 'beach', category: 'Beach', label: 'Beach' },
  { slug: 'hill-station', category: 'Hill Station', label: 'Hill Station' },
  { slug: 'wildlife', category: 'Wildlife Safari', label: 'Wildlife Safari' },
  { slug: 'heritage', category: 'Cultural Heritage', label: 'Heritage' },
  { slug: 'luxury', category: 'Luxury Escape', label: 'Luxury' },
  { slug: 'budget', category: 'Budget Travel', label: 'Budget' },
  { slug: 'solo', category: 'Solo Travel', label: 'Solo' },
  { slug: 'group-tour', category: 'Group Tour', label: 'Group Tour' },
];
type TripType = (typeof TRIP_TYPES)[number];

const REGION_PAGES = [
  { slug: 'rajasthan', name: 'Rajasthan', query: 'Rajasthan' },
  { slug: 'himachal-pradesh', name: 'Himachal Pradesh', query: 'Himachal Pradesh' },
  { slug: 'andaman', name: 'Andaman', query: 'andaman' },
  { slug: 'uttarakhand', name: 'Uttarakhand', query: 'Uttarakhand' },
  { slug: 'uttar-pradesh', name: 'Uttar Pradesh', query: 'Uttar Pradesh' },
  { slug: 'madhya-pradesh', name: 'Madhya Pradesh', query: 'Madhya Pradesh' },
  { slug: 'odisha', name: 'Odisha', query: 'Odisha' },
  { slug: 'kerala', name: 'Kerala', query: 'Kerala' },
  { slug: 'goa', name: 'Goa', query: 'Goa' },
  { slug: 'bhutan', name: 'Bhutan', query: 'Bhutan' },
  { slug: 'thailand', name: 'Thailand', query: 'Thailand' },
  { slug: 'singapore', name: 'Singapore', query: 'Singapore' },
  { slug: 'vietnam', name: 'Vietnam', query: 'Vietnam' },
  { slug: 'bali', name: 'Bali', query: 'Indonesia' },
];

type Place = { slug: string; name: string; query: string };
type Facet =
  | { kind: 'type'; slug: string; type: TripType }
  | { kind: 'origin'; slug: string; citySlug: string; city?: string | null }
  | { kind: 'duration'; slug: string; nights: number };
type Scope = { place?: Place; facet?: Facet; origin?: { slug: string; name: string }; type?: TripType };

export function slugifyPlace(name: string) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFacet(segment: string): Facet | null {
  const s = String(segment || '');
  const type = TRIP_TYPES.find((t) => t.slug === s);
  if (type) return { kind: 'type', slug: s, type };
  const origin = s.match(/^from-([a-z0-9-]+)$/);
  if (origin) return { kind: 'origin', slug: s, citySlug: origin[1] };
  const dur = s.match(/^(\d{1,2})-days-(\d{1,2})-nights$/);
  if (dur && Number(dur[1]) === Number(dur[2]) + 1) return { kind: 'duration', slug: s, nights: Number(dur[2]) };
  return null;
}

const categories = (p: any): string[] => (Array.isArray(p?.category) ? p.category : p?.category ? [p.category] : []);

function matches(facet: Facet, pkg: any) {
  if (facet.kind === 'type') return categories(pkg).includes(facet.type.category);
  if (facet.kind === 'origin') return (pkg.departureCities || []).some((c: string) => slugifyPlace(c) === facet.citySlug);
  if (facet.kind === 'duration') return pkg.duration?.nights === facet.nights;
  return false;
}

function cityName(pkgs: any[], citySlug: string): string | null {
  for (const p of pkgs) {
    const hit = (p.departureCities || []).find((c: string) => slugifyPlace(c) === citySlug);
    if (hit) return hit;
  }
  return null;
}

type Words = { h1: string; one: string; many: string };

function describe({ place, facet, origin, type }: Scope): Words {
  const P = place?.name;
  if (place && facet?.kind === 'type') {
    const l = facet.type.label;
    return { h1: `${P} ${l} Packages`, one: `${P} ${l.toLowerCase()} package`, many: `${P} ${l.toLowerCase()} packages` };
  }
  if (place && facet?.kind === 'origin') {
    return { h1: `${P} Tour Packages from ${facet.city}`, one: `${P} tour package from ${facet.city}`, many: `${P} packages from ${facet.city}` };
  }
  if (place && facet?.kind === 'duration') {
    const d = `${facet.nights + 1} Days ${facet.nights} Nights`;
    return { h1: `${P} ${d} Packages`, one: `${P} ${d.toLowerCase()} package`, many: `${P} ${d.toLowerCase()} packages` };
  }
  if (place) return { h1: `${P} Tour Packages`, one: `${P} tour package`, many: `${P} packages` };
  if (origin) {
    return { h1: `Tour Packages from ${origin.name}`, one: `tour package from ${origin.name}`, many: `holiday packages from ${origin.name}` };
  }
  const l = type?.label || 'Holiday';
  return { h1: `${l} Packages`, one: `${l.toLowerCase()} package`, many: `${l.toLowerCase()} packages` };
}

const displayPrice = (pkg: any) => pkg?.platformSellingPrice || pkg?.pricing?.startingFrom || 0;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Summary = {
  count: number; minPrice: number; maxPrice: number; minNights: number; maxNights: number;
  commonNights: number; alsoVisits: string[]; withOrigin: number;
  origins: { name: string; count: number }[]; cheapest: any;
};

function summarise(scope: Scope, pkgs: any[]): Summary {
  const prices = pkgs.map(displayPrice).filter((p) => p > 0);
  const nights = pkgs.map((p) => p.duration?.nights).filter((n) => n > 0);
  const nightCounts: Record<number, number> = {};
  nights.forEach((n) => { nightCounts[n] = (nightCounts[n] || 0) + 1; });
  const commonNights = Object.entries(nightCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const self = scope.place?.name.toLowerCase();
  const alsoVisits: Record<string, number> = {};
  pkgs.forEach((p) => {
    new Set<string>((p.destinations || []).map((d: any) => d.city || d.name).filter(Boolean)).forEach((c) => {
      if (c.toLowerCase() !== self) alsoVisits[c] = (alsoVisits[c] || 0) + 1;
    });
  });
  const origins: Record<string, number> = {};
  pkgs.forEach((p) => new Set<string>(p.departureCities || []).forEach((c) => { origins[c] = (origins[c] || 0) + 1; }));
  const cheapest = pkgs.filter((p) => displayPrice(p) > 0).sort((a, b) => displayPrice(a) - displayPrice(b))[0];
  return {
    count: pkgs.length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    minNights: nights.length ? Math.min(...nights) : 0,
    maxNights: nights.length ? Math.max(...nights) : 0,
    commonNights: commonNights ? Number(commonNights) : 0,
    alsoVisits: Object.entries(alsoVisits).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c),
    withOrigin: pkgs.filter((p) => p.departureCities?.length).length,
    origins: Object.entries(origins).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    cheapest,
  };
}

const nightsRange = (s: Summary) =>
  !s.minNights ? '' : s.minNights === s.maxNights ? `${s.minNights} nights` : `${s.minNights} to ${s.maxNights} nights`;

function buildFaq(scope: Scope, w: Words, s: Summary) {
  const faq: { q: string; a: string }[] = [];
  if (s.minPrice) {
    faq.push({
      q: `How much does a ${w.one} cost?`,
      a: s.minPrice === s.maxPrice
        ? `${cap(w.many)} on Prayana AI cost ${inr(s.minPrice)} per person.`
        : `${cap(w.many)} on Prayana AI range from ${inr(s.minPrice)} to ${inr(s.maxPrice)} per person, depending on the length of the trip and the hotels.`
          + (s.cheapest ? ` The most affordable right now is ${s.cheapest.title} at ${inr(displayPrice(s.cheapest))}.` : ''),
    });
  }
  if (s.minNights && scope.facet?.kind !== 'duration') {
    faq.push({
      q: scope.place && !scope.facet ? `How many days are enough for a ${scope.place.name} trip?` : `How long are ${w.many}?`,
      a: `Our ${w.many} run for ${nightsRange(s)}.`
        + (s.commonNights && s.minNights !== s.maxNights ? ` The most common length is ${s.commonNights} nights (${s.commonNights + 1} days).` : ''),
    });
  }
  if (s.alsoVisits.length) {
    faq.push({
      q: `Which places do ${w.many} cover?`,
      a: scope.place
        ? `Besides ${scope.place.name}, these trips most often include ${s.alsoVisits.slice(0, 6).join(', ')}.`
        : `These trips most often visit ${s.alsoVisits.slice(0, 6).join(', ')}.`,
    });
  }
  if (s.origins.length && !scope.origin && scope.facet?.kind !== 'origin') {
    const listed = s.origins.slice(0, 5).map((o) => `${o.count} from ${o.name}`).join(', ');
    faq.push({
      q: `Which cities do ${w.many} start from?`,
      a: `${cap(listed)}.` + (s.withOrigin < s.count ? ' The rest do not name a departure city; each itinerary shows where Day 1 begins.' : ''),
    });
  }
  faq.push({
    q: `How many ${w.many} are available?`,
    a: `There ${s.count === 1 ? 'is' : 'are'} ${s.count} ${s.count === 1 ? w.one : w.many} from verified local operators, each with a day-by-day itinerary, hotel options and online booking.`,
  });
  return faq;
}

// ---------------------------------------------------------------------------
// Data.

const listOf = (res: any): any[] => (Array.isArray(res?.data) ? res.data : Array.isArray(res?.packages) ? res.packages : []);

async function fetchCatalogue() {
  const all: any[] = [];
  for (let page = 1; page <= 25; page++) {
    const batch = listOf(await holidayPackagesAPI.search({ view: 'card', limit: 200, page }));
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return all;
}

// slug -> place, as resolvePlace in lib/packageDestinations.js.
async function resolvePlace(slug: string): Promise<Place | null> {
  const region = REGION_PAGES.find((r) => r.slug === slug);
  if (region) return region;
  const res: any = await holidayPackagesAPI.getFacets();
  const counts: Record<string, number> = res?.data?.city || {};
  const names = Object.keys(counts);
  let best: (Place & { count: number }) | null = null;
  for (const [name, count] of Object.entries(counts)) {
    if (count < MIN_CITY_PACKAGES || slugifyPlace(name) !== slug) continue;
    // "Neil" and "Neil Island": keep the full name, search by the short one.
    if (names.some((other) => other.toLowerCase().startsWith(`${name.toLowerCase()} `))) continue;
    const short = names.find((other) => name.toLowerCase().startsWith(`${other.toLowerCase()} `));
    if (!best || count > best.count) best = { slug, name, query: short || name, count };
  }
  return best ? { slug: best.slug, name: best.name, query: best.query } : null;
}

type Landing = { scope: Scope; pkgs: any[]; words: Words; summary: Summary; faq: { q: string; a: string }[] };

function build(scope: Scope, pkgs: any[]): Landing {
  const summary = summarise(scope, pkgs);
  let words = describe(scope);
  // Every package in this place leaves from the same city: say so.
  if (scope.place && !scope.facet && summary.origins.length === 1 && summary.origins[0].count === pkgs.length) {
    words = describe({ place: scope.place, facet: { kind: 'origin', slug: '', citySlug: '', city: summary.origins[0].name } });
  }
  return { scope, pkgs, words, summary, faq: buildFaq(scope, words, summary) };
}

// null = no such page (the web 404s).
async function loadLanding(p: { place?: string; facet?: string; origin?: string; type?: string }): Promise<Landing | null> {
  if (p.place) {
    const place = await resolvePlace(p.place);
    if (!place) return null;
    const all = listOf(await holidayPackagesAPI.search({ destination: place.query, view: 'card', limit: 200 }));
    if (!all.length) return null;
    if (!p.facet) return build({ place }, all);
    const facet = parseFacet(p.facet);
    if (!facet) return null;
    const pkgs = all.filter((x) => matches(facet, x));
    if (!pkgs.length) return null;
    if (facet.kind === 'origin') facet.city = cityName(pkgs, facet.citySlug);
    return build({ place, facet }, pkgs);
  }
  if (p.origin) {
    const slug = p.origin;
    const pkgs = (await fetchCatalogue()).filter((x) => matches({ kind: 'origin', slug: `from-${slug}`, citySlug: slug }, x));
    if (pkgs.length < MIN_FACET_PACKAGES) return null;
    return build({ origin: { slug, name: cityName(pkgs, slug) || slug } }, pkgs);
  }
  const type = TRIP_TYPES.find((t) => t.slug === p.type);
  if (!type) return null;
  const pkgs = listOf(await holidayPackagesAPI.search({ category: type.category, view: 'card', limit: 200 }))
    .filter((x) => categories(x).includes(type.category));
  if (pkgs.length < MIN_FACET_PACKAGES) return null;
  return build({ type }, pkgs);
}

// ---------------------------------------------------------------------------
// Screen.

export type PackageLandingProps = { place?: string; facet?: string; origin?: string; type?: string };

export function PackageLanding({ place, facet, origin, type }: PackageLandingProps) {
  const router = useRouter();
  const goBack = useGoBack('/packages');
  const { themeColors } = useTheme();
  const [data, setData] = useState<Landing | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await loadLanding({ place, facet, origin, type });
      setData(d);
      setState(d ? 'ok' : 'missing');
    } catch (err: any) {
      console.warn('[PackageLanding] load failed:', err?.message);
      // A failed refresh keeps what is already on screen.
      setState((s) => (s === 'ok' ? 'ok' : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, [place, facet, origin, type]);

  useEffect(() => {
    setState('loading');
    load();
  }, [load]);

  const open = (pkg: any) => router.push(`/packages/${encodeURIComponent(pkg._id)}` as any);
  const title = data?.words.h1 || 'Holiday Packages';

  const header = useMemo(() => {
    if (!data) return null;
    const { summary: s, words: w } = data;
    return (
      <View style={styles.intro}>
        <Text style={[styles.h1, { color: themeColors.text }]}>{w.h1}</Text>
        <Text style={[styles.lead, { color: themeColors.textSecondary }]}>
          {s.count} {s.count === 1 ? w.one : w.many}
          {s.minNights ? ` of ${nightsRange(s)}` : ''}
          {s.minPrice ? `, starting at ${inr(s.minPrice)} per person` : ''}.
          {' '}Compare day-by-day itineraries, hotels and prices from verified local operators, then book online.
        </Text>
        {s.alsoVisits.length > 0 ? (
          <Text style={[styles.also, { color: themeColors.textTertiary }]}>Also covers: {s.alsoVisits.join(' · ')}</Text>
        ) : null}
      </View>
    );
  }, [data, themeColors]);

  const footer = useMemo(() => {
    if (!data) return null;
    return (
      <View style={styles.faq}>
        <Text style={[styles.faqTitle, { color: themeColors.text }]}>{data.words.h1}: common questions</Text>
        {data.faq.map((f) => (
          <View key={f.q} style={[styles.faqItem, { borderColor: themeColors.border }]}>
            <Text style={[styles.faqQ, { color: themeColors.text }]}>{f.q}</Text>
            <Text style={[styles.faqA, { color: themeColors.textSecondary }]}>{f.a}</Text>
          </View>
        ))}
      </View>
    );
  }, [data, themeColors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: themeColors.border, backgroundColor: themeColors.surface }]}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: themeColors.text }]} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={() => router.push('/packages' as any)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.backBtn}>
          <Ionicons name="grid-outline" size={19} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      {state === 'loading' ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BLUE} /></View>
      ) : state === 'ok' && data ? (
        <FlashList
          data={data.pkgs}
          keyExtractor={(item: any) => String(item._id)}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <HolidayCard pkg={item} onPress={() => open(item)} />
            </View>
          )}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />}
        />
      ) : (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name={state === 'error' ? 'cloud-offline-outline' : 'airplane-outline'} size={56} color={colors.gray[300]} />}
            title={state === 'error' ? 'Could not load packages' : 'No packages here yet'}
            description={state === 'error' ? 'Check your connection and try again.' : 'There are not enough packages for this page right now. Browse every holiday instead.'}
            actionLabel={state === 'error' ? 'Try again' : 'Browse all packages'}
            onAction={() => {
              if (state === 'error') { setState('loading'); load(); } else router.replace('/packages' as any);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  intro: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18 },
  h1: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, lineHeight: 31 },
  lead: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  also: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  faq: { paddingHorizontal: 16, paddingTop: 18 },
  faqTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3, marginBottom: 6 },
  faqItem: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  faqQ: { fontSize: 14.5, fontWeight: '700' },
  faqA: { fontSize: 13, lineHeight: 19, marginTop: 6 },
});
