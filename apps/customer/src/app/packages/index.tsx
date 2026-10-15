import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import {
  Card,
  Badge,
  EmptyState,
  StarRating,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { PackageFilterSheet, PackageFilters } from '../../components/packages/PackageFilterSheet';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { GroupDeparturesTab } from '../../components/packages/GroupDeparturesTab';
import { HolidayCard, DealPoster, DealTile, ThemeTiles, THEMES } from '../../components/packages/HolidayCards';
import { FULL_W, RAIL_GAP, RAIL_PAD, TWO_UP_SNAP, usePairSnap } from '../../lib/railLayout';

// Packages use the theme's blue accent rather than the app-wide orange, so the
// holiday-package flow reads as its own product. Aliased once here: every
// `packageColors.primary[n]` below resolves to accent[n] via this object, which keeps
// the shade ramp (50..900) and the rest of the palette untouched.
const packageColors = { ...colors, primary: colors.accent };


// The `category` param is CASE-SENSITIVE server-side: category=honeymoon returns
// 0, category=Honeymoon returns 9. The chips previously sent lowercase keys, so
// every category chip filtered to nothing. `key` is now the exact server value
// (matches /packages/facets category keys), 'all' meaning no filter.
type PackageCategory = string;

const CATEGORIES: { key: PackageCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'Holiday Package', label: 'Holiday', icon: 'airplane-outline' },
  { key: 'Honeymoon', label: 'Honeymoon', icon: 'heart-outline' },
  { key: 'Family', label: 'Family', icon: 'people-outline' },
  { key: 'Cultural Heritage', label: 'Heritage', icon: 'business-outline' },
  { key: 'Beach', label: 'Beach', icon: 'sunny-outline' },
  { key: 'Hill Station', label: 'Hill Station', icon: 'triangle-outline' },
  { key: 'Adventure Trek', label: 'Adventure', icon: 'trail-sign-outline' },
  { key: 'Pilgrimage', label: 'Pilgrimage', icon: 'flower-outline' },
  { key: 'Group Tour', label: 'Group Tour', icon: 'bus-outline' },
  { key: 'Weekend Getaway', label: 'Weekend', icon: 'calendar-outline' },
];

// India / International scope — the /packages/search `scope` param filters
// server-side (domestic=129, international=37). Mirrors the PWA's 3-pill toggle.
type Scope = 'all' | 'domestic' | 'international';
const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'domestic', label: 'In India' },
  { key: 'international', label: 'International' },
];

// Full-bleed hero photo — the same Himalayan landscape the PWA uses.
const HERO_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80';
const BLUE = '#008cff';
const PAGE_SIZE = 30;

// Sort options (server keys — see /packages/search sort mapping).
const SORTS: { key: string; label: string }[] = [
  { key: 'rating', label: 'Top rated' },
  { key: 'price_low', label: 'Price: low to high' },
  { key: 'price_high', label: 'Price: high to low' },
  { key: 'popular', label: 'Most booked' },
  { key: 'newest', label: 'Newest' },
];

type HolidayPackage = {
  _id: string;
  slug?: string;
  title: string;
  shortDescription?: string;
  destination?: { city?: string; state?: string; country?: string };
  duration?: { days: number; nights: number };
  pricing?: { startingFrom: number; currency?: string; mrp?: number };
  category?: PackageCategory | string;
  rating?: { average?: number; count?: number };
  images?: { url: string; alt?: string; isPrimary?: boolean }[];
  inclusions?: string[];
  isFeatured?: boolean;
};

// The API marks one image `isPrimary`, but it isn't always index 0 (the primary
// can sit later in the array). Blindly taking images[0] sometimes yields an
// entry with no `url`, so the card fell back to the gradient and looked "blank".
// Pick the primary, else the first entry that actually has a url.
function pkgImage(pkg: HolidayPackage): string | undefined {
  const imgs = pkg.images || [];
  const primary = imgs.find((i) => i?.isPrimary && i.url);
  const url = (primary || imgs.find((i) => i?.url))?.url;
  // Resolve relative/legacy-S3/corrupted urls exactly like the PWA grids do.
  return url ? normalizeImageUrl(url) : undefined;
}

export default function PackagesScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [search, setSearch] = useState('');
  // The PWA splits this page into hero tabs (Packages | Group Tours |
  // Last-minute deals), rendering ONE body at a time. Group Tours was missing
  // from the app entirely — it is fed by ?hasDepartures=true, a server filter,
  // which no other mobile screen was calling.
  const [browseTab, setBrowseTab] = useState<'packages' | 'departures'>('packages');
  const [activeCategory, setActiveCategory] = useState<PackageCategory>('all');
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<string>('rating');
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [featured, setFeatured] = useState<HolidayPackage[]>([]);
  const [deals, setDeals] = useState<HolidayPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // The catalogue is paged (30 at a time, 180+ in all): the rest load as you
  // scroll, and the header quotes the server's total, not the page size.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Facet filters (Duration / Budget / City) — mirrors the web filter accordions.
  const [facets, setFacets] = useState<any>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<PackageFilters>({});
  const activeFilterCount =
    (filters.minBudget != null || filters.maxBudget != null ? 1 : 0) +
    (filters.minNights != null || filters.maxNights != null ? 1 : 0) +
    (filters.cities ? 1 : 0) +
    (filters.category ? 1 : 0);

  const load = useCallback(async () => {
    try {
      const initial = !search.trim() && activeCategory === 'all' && scope === 'all' && activeFilterCount === 0;
      const [searchRes, featuredRes, dealsRes, facetsRes] = await Promise.all([
        holidayPackagesAPI.search({
          q: search.trim() || undefined,
          // The filter sheet's Theme (category) wins over the chip row when set.
          category: filters.category || (activeCategory !== 'all' ? activeCategory : undefined),
          // India / International — server-side scope filter (domestic|international).
          scope: scope !== 'all' ? scope : undefined,
          sort,
          minBudget: filters.minBudget,
          maxBudget: filters.maxBudget,
          minNights: filters.minNights,
          maxNights: filters.maxNights,
          cities: filters.cities || undefined,
          limit: PAGE_SIZE,
          page: 1,
        }),
        // Only fetch featured + deals on the unfiltered initial view.
        initial ? holidayPackagesAPI.getFeatured() : Promise.resolve(null),
        initial ? holidayPackagesAPI.getValueDeals({ limit: 10 }).catch(() => null) : Promise.resolve(null),
        // Facets once (for the filter sheet bounds/cities).
        !facets ? holidayPackagesAPI.getFacets().catch(() => null) : Promise.resolve(null),
      ]);
      setPackages(searchRes?.data || searchRes?.packages || []);
      setPage(1);
      setTotal(searchRes?.pagination?.total ?? (searchRes?.data || []).length);
      if (featuredRes) setFeatured(featuredRes?.data || featuredRes?.packages || []);
      if (dealsRes) setDeals(dealsRes?.data || dealsRes?.packages || []);
      if (facetsRes?.data) setFacets(facetsRes.data);
    } catch (err: any) {
      console.warn('[Packages] load failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeCategory, scope, sort, filters, activeFilterCount, facets]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || packages.length >= total) return;
    setLoadingMore(true);
    try {
      const res: any = await holidayPackagesAPI.search({
        q: search.trim() || undefined,
        category: filters.category || (activeCategory !== 'all' ? activeCategory : undefined),
        scope: scope !== 'all' ? scope : undefined,
        sort,
        minBudget: filters.minBudget,
        maxBudget: filters.maxBudget,
        minNights: filters.minNights,
        maxNights: filters.maxNights,
        cities: filters.cities || undefined,
        limit: PAGE_SIZE,
        page: page + 1,
      });
      const more: HolidayPackage[] = res?.data || res?.packages || [];
      setPackages((prev) => {
        const seen = new Set(prev.map((x) => x._id));
        return [...prev, ...more.filter((x) => !seen.has(x._id))];
      });
      setPage((n) => n + 1);
      if (!more.length) setTotal((t) => Math.min(t, packages.length));
    } catch (err: any) {
      console.warn('[Packages] load more failed:', err?.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, packages.length, total, page, search, filters, activeCategory, scope, sort]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // De-duplicated so a package never appears twice in one rail.
  const heroFeatured = useMemo(() => {
    const seen = new Set<string>();
    // Until packages are marked featured on the server, lead with the
    // top-rated ones that have a photo.
    const source = featured.length ? featured : packages.filter((p) => pkgImage(p));
    return source.filter((p) => (seen.has(p._id) ? false : (seen.add(p._id), true))).slice(0, 5);
  }, [featured, packages]);
  const dealList = useMemo(() => {
    const seen = new Set<string>();
    return deals.filter((p) => (seen.has(p._id) ? false : (seen.add(p._id), true)));
  }, [deals]);
  const browsing = !search.trim() && activeCategory === 'all' && scope === 'all' && activeFilterCount === 0 && sort === 'rating';
  const open = (pkg: HolidayPackage) => router.push(`/packages/${encodeURIComponent(pkg._id)}` as any);
  const featSnap = usePairSnap(FULL_W + RAIL_GAP);
  const dealSnap = usePairSnap(TWO_UP_SNAP);
  const [featAt, setFeatAt] = useState(0);
  const onFeatEnd = (e: any) => setFeatAt(Math.round(e.nativeEvent.contentOffset.x / (FULL_W + RAIL_GAP)));

  const top = (
    <View>
      {/* Hero — photo, title, search; scrolls away with the page. */}
      <View style={styles.hero}>
        <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        <LinearGradient colors={['rgba(5,20,40,0.45)', 'rgba(5,20,40,0.2)', 'rgba(5,20,40,0.75)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.heroBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroBadge}>
            <Ionicons name="pricetags" size={11} color="#FBBF24" />
            <Text style={styles.heroBadgeText}>HOLIDAY DEALS</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle}>Holidays that{'\n'}feel <Text style={{ color: '#FBBF24' }}>effortless</Text></Text>
          <Text style={styles.heroSub}>Stays, transfers & sightseeing — one price, one booking</Text>
        </View>
        <View style={styles.heroSearch}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <RNTextInput
            style={styles.heroSearchInput}
            placeholder="Where do you want to go?"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Packages | Group Tours */}
      <View style={[styles.tabStrip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        {([['packages', 'Packages', 'briefcase'], ['departures', 'Group Tours', 'people']] as const).map(([key, label, icon]) => {
          const active = browseTab === key;
          return (
            <TouchableOpacity key={key} onPress={() => setBrowseTab(key)} style={[styles.tabBtn, active && styles.tabBtnOn]} activeOpacity={0.85}>
              <Ionicons name={icon} size={15} color={active ? '#fff' : themeColors.textSecondary} />
              <Text style={[styles.tabText, { color: active ? '#fff' : themeColors.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const browseHeader = (
    <View>
      {top}

      {/* India / International */}
      <View style={[styles.scopeRow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        {SCOPES.map((sc) => {
          const active = scope === sc.key;
          return (
            <TouchableOpacity key={sc.key} onPress={() => setScope(sc.key)} style={[styles.scopePill, active && styles.scopePillOn]} activeOpacity={0.8}>
              <Text style={[styles.scopePillText, { color: active ? BLUE : themeColors.textSecondary }]}>{sc.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Holidays by theme */}
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Holidays by theme</Text>
      <ThemeTiles active={activeCategory} onPick={setActiveCategory} />

      {browsing && heroFeatured.length > 0 ? (
        <View>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitleInline, { color: themeColors.text }]}>Handpicked for you</Text>
          </View>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: RAIL_PAD, gap: RAIL_GAP, paddingBottom: 6 }}
            ref={featSnap.setRef}
            {...featSnap.props}
            onScrollEndDrag={(e) => { featSnap.props.onScrollEndDrag(e); onFeatEnd(e); }}
            onMomentumScrollEnd={(e) => { featSnap.props.onMomentumScrollEnd(e); onFeatEnd(e); }}
          >
            {heroFeatured.map((pkg) => <DealPoster key={`f-${pkg._id}`} pkg={pkg} onPress={() => open(pkg)} />)}
          </ScrollView>
          <View style={styles.dots}>
            {heroFeatured.map((p, i) => <View key={p._id} style={[styles.dot, i === featAt && styles.dotOn]} />)}
          </View>
        </View>
      ) : null}

      {browsing && dealList.length > 0 ? (
        <View>
          <View style={styles.sectionHead}>
            <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.sectionIcon}><Ionicons name="flame" size={14} color="#fff" /></LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitleInline, { color: themeColors.text }]}>Last-minute deals</Text>
              <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>Lowest prices for trips leaving soon</Text>
            </View>
          </View>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: RAIL_PAD, gap: RAIL_GAP, paddingBottom: 6 }}
            ref={dealSnap.setRef}
            {...dealSnap.props}
          >
            {dealList.map((pkg) => <DealTile key={`d-${pkg._id}`} pkg={pkg} onPress={() => open(pkg)} />)}
          </ScrollView>
        </View>
      ) : null}

      {/* All packages: count, Filters and sort */}
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitleInline, { color: themeColors.text }]}>
            {search.trim() ? 'Results' : activeCategory !== 'all' ? (THEMES.find((t) => t.key === activeCategory)?.label || CATEGORIES.find((c) => c.key === activeCategory)?.label) + ' holidays' : 'All holidays'}
          </Text>
          <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>{loading ? 'Finding the best prices…' : `${total || packages.length} packages`}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.sortRow}>
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={[styles.sortChip, styles.filterChip, { borderColor: activeFilterCount ? BLUE : themeColors.border, backgroundColor: activeFilterCount ? BLUE + '18' : themeColors.surface }]}
        >
          <Ionicons name="options-outline" size={14} color={activeFilterCount ? BLUE : themeColors.text} />
          <Text style={[styles.sortChipText, { color: activeFilterCount ? BLUE : themeColors.text }]}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}</Text>
        </TouchableOpacity>
        {SORTS.map((so) => {
          const active = sort === so.key;
          return (
            <TouchableOpacity key={so.key} onPress={() => setSort(so.key)} style={[styles.sortChip, { borderColor: active ? BLUE : themeColors.border, backgroundColor: active ? BLUE : themeColors.surface }]}>
              <Text style={[styles.sortChipText, { color: active ? '#fff' : themeColors.textSecondary }]}>{so.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {loading ? <View style={styles.loadingBox}><ActivityIndicator size="large" color={BLUE} /></View> : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {browseTab === 'departures' ? (
        <>
          {top}
          <GroupDeparturesTab
            onOpenPackage={(pkg, dateISO) =>
              router.push({
                pathname: `/packages/${encodeURIComponent(pkg._id)}`,
                params: dateISO ? { date: dateISO } : {},
              } as any)
            }
          />
        </>
      ) : (
        <FlashList
          data={loading ? [] : packages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {/* Open by _id, not slug: some slugs collide with empty duplicates. */}
              <HolidayCard pkg={item} onPress={() => open(item)} />
            </View>
          )}
          ListHeaderComponent={browseHeader}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingBox}><ActivityIndicator color={BLUE} /></View>
            ) : !loading && packages.length > 0 && packages.length >= total ? (
              <Text style={[styles.sectionSub, { color: themeColors.textTertiary, textAlign: 'center', paddingVertical: 12 }]}>
                You've seen all {packages.length} packages
              </Text>
            ) : null
          }
          ListEmptyComponent={
            loading ? null : (
              <EmptyState
                icon={<Ionicons name="airplane-outline" size={56} color={colors.gray[300]} />}
                title="No packages found"
                description={search.trim() ? `No packages match "${search}"` : 'Try a different theme or filter.'}
                actionLabel="Clear filters"
                onAction={() => { setSearch(''); setActiveCategory('all'); setScope('all'); setFilters({}); }}
              />
            )
          }
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
        />
      )}

      <PackageFilterSheet
        open={filterOpen}
        facets={facets}
        value={filters}
        resultCount={total || packages.length}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => setFilters(f)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },

  // Hero
  hero: { paddingBottom: 18, backgroundColor: '#0b2a4a', overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  heroBack: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
  heroBadgeText: { color: '#FBBF24', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.4 },
  heroBody: { paddingHorizontal: 18, paddingTop: 26 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 37 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13.5, marginTop: 8 },
  heroSearch: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: spacing.md,
    height: 52, marginTop: 18, marginHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  heroSearchInput: { flex: 1, fontSize: fontSize.md, color: '#111827' },

  // India / International scope
  tabStrip: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: -22, borderRadius: 18, borderWidth: 1, padding: 5, gap: 5,
    shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14 },
  tabBtnOn: { backgroundColor: BLUE },
  tabText: { fontSize: 14, fontWeight: '800' },
  scopeRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  scopePill: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  scopePillOn: { backgroundColor: 'rgba(0,140,255,0.1)' },
  scopePillText: { fontSize: 13, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  sectionIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitleInline: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sectionSub: { fontSize: 12.5, marginTop: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.5)' },
  dotOn: { width: 18, backgroundColor: BLUE },
  loadingBox: { paddingVertical: 40, alignItems: 'center' },

  categoryRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: 'center', // keep chips content-height (else they stretch to tall ovals)
  },
  sortRow: { paddingHorizontal: 16, paddingBottom: 16, gap: 8, alignItems: 'center' },
  sortChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  dealsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xl, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  // A horizontal chip rail must not grow to fill vertical space, or its chips
  // stretch into tall ovals. flexGrow:0 keeps it at content height.
  chipRail: { flexGrow: 0, flexShrink: 0 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: packageColors.primary[500],
    borderColor: packageColors.primary[500],
  },
  catChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  catChipTextActive: { color: '#fff' },

  featuredSection: { paddingTop: spacing.md },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: colors.text,
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 14,
  },

  // Featured horizontal card
  featCardWrap: { width: 280 },
  featCard: {
    height: 180,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.gray[200],
  },
  featImage: { ...StyleSheet.absoluteFillObject },
  featOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  featContent: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.xs,
  },
  featTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#fff',
    marginTop: spacing.xs,
  },
  featPrice: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#fff' },
  featPriceMeta: { fontSize: fontSize.xs, fontWeight: fontWeight.normal, color: 'rgba(255,255,255,0.8)' },

  // Vertical list card
  cardWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  card: { padding: 0, overflow: 'hidden', ...shadow.sm },
  cardImageWrap: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: colors.gray[200],
  },
  cardImage: { width: '100%', height: '100%' },
  offBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  offText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  featuredBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: packageColors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  featuredText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardBody: { padding: spacing.lg, gap: 6 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  priceValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: packageColors.primary[600] },
  mrpText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.normal,
    textDecorationLine: 'line-through',
  },
  priceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: packageColors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  priceCtaText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
