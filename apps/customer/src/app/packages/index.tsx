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
  const [activeCategory, setActiveCategory] = useState<PackageCategory>('all');
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<string>('rating');
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [featured, setFeatured] = useState<HolidayPackage[]>([]);
  const [deals, setDeals] = useState<HolidayPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          limit: 30,
        }),
        // Only fetch featured + deals on the unfiltered initial view.
        initial ? holidayPackagesAPI.getFeatured() : Promise.resolve(null),
        initial ? holidayPackagesAPI.getValueDeals({ limit: 10 }).catch(() => null) : Promise.resolve(null),
        // Facets once (for the filter sheet bounds/cities).
        !facets ? holidayPackagesAPI.getFacets().catch(() => null) : Promise.resolve(null),
      ]);
      setPackages(searchRes?.data || searchRes?.packages || []);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const heroFeatured = useMemo(() => featured.slice(0, 5), [featured]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Hero — full-bleed photo, gradient, title + search (PWA parity) */}
      <View style={styles.hero}>
        <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => router.back()} style={styles.heroBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle}>Holiday Packages<Text style={{ color: '#FBBF24' }}>.</Text></Text>
          <Text style={styles.heroSub}>Discover handpicked escapes across India & beyond</Text>
          <View style={styles.heroSearch}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <RNTextInput
              style={styles.heroSearchInput}
              placeholder="Search destination, package, category..."
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
      </View>

      {/* India / International scope */}
      <View style={styles.scopeRow}>
        {SCOPES.map((s) => {
          const active = scope === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setScope(s.key)}
              style={[styles.scopePill, active && { backgroundColor: '#fff', ...shadow.sm }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.scopePillText, { color: active ? BLUE : themeColors.textSecondary }]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRail}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.catChip,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                active && styles.catChipActive,
              ]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={active ? '#fff' : themeColors.textSecondary}
              />
              <Text style={[styles.catChipText, { color: themeColors.textSecondary }, active && styles.catChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort pills + Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRail} contentContainerStyle={styles.sortRow}>
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={[styles.sortChip, styles.filterChip, { borderColor: activeFilterCount ? colors.primary[500] : themeColors.border, backgroundColor: activeFilterCount ? colors.primary[500] + '18' : 'transparent' }]}
        >
          <Ionicons name="options-outline" size={14} color={activeFilterCount ? colors.primary[600] : themeColors.textSecondary} />
          <Text style={[styles.sortChipText, { color: activeFilterCount ? colors.primary[600] : themeColors.textSecondary }]}>
            Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
          </Text>
        </TouchableOpacity>
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSort(s.key)}
              style={[styles.sortChip, { borderColor: active ? colors.primary[500] : themeColors.border, backgroundColor: active ? colors.primary[500] + '18' : 'transparent' }]}
            >
              <Text style={[styles.sortChipText, { color: active ? colors.primary[600] : themeColors.textSecondary }]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : packages.length === 0 && heroFeatured.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="airplane-outline" size={56} color={colors.gray[300]} />}
          title="No packages found"
          description={
            search.trim()
              ? `No packages match "${search}"`
              : 'Try a different category or check back later.'
          }
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('');
            setActiveCategory('all');
            setScope('all');
            setFilters({});
          }}
        />
      ) : (
        <FlashList
          data={packages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <PackageCard
              pkg={item}
              onPress={() =>
                // Navigate by _id, not slug: some slugs collide with empty
                // duplicate documents (images/variants/itinerary all blank),
                // whereas the _id always resolves the full package.
                router.push(`/packages/${encodeURIComponent(item._id)}`)
              }
            />
          )}
          ListHeaderComponent={
            heroFeatured.length > 0 && !search.trim() && activeCategory === 'all' && scope === 'all' && activeFilterCount === 0 ? (
              <View style={styles.featuredSection}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Featured for you</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                >
                  {heroFeatured.map((pkg) => (
                    <FeaturedCard
                      key={pkg._id}
                      pkg={pkg}
                      onPress={() =>
                        router.push(`/packages/${encodeURIComponent(pkg._id)}`)
                      }
                    />
                  ))}
                </ScrollView>
                {deals.length > 0 && (
                  <>
                    <View style={styles.dealsHead}>
                      <Ionicons name="flame" size={16} color="#F97316" />
                      <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: 0 }]}>Last-minute deals</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                    >
                      {deals.map((pkg) => (
                        <FeaturedCard
                          key={`deal-${pkg._id}`}
                          pkg={pkg}
                          onPress={() => router.push(`/packages/${encodeURIComponent(pkg._id)}`)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}
                <Text style={[styles.sectionTitle, { marginTop: spacing.xl, color: themeColors.text }]}>
                  All packages
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <PackageFilterSheet
        open={filterOpen}
        facets={facets}
        value={filters}
        resultCount={packages.length}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => setFilters(f)}
      />
    </SafeAreaView>
  );
}

function PackageCard({ pkg, onPress }: { pkg: HolidayPackage; onPress: () => void }) {
  const { themeColors } = useTheme();
  const img = pkgImage(pkg);
  const days = pkg.duration?.days || 0;
  const nights = pkg.duration?.nights || Math.max(0, days - 1);
  const price = pkg.pricing?.startingFrom || 0;
  const mrp = pkg.pricing?.mrp;
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const dest = [pkg.destination?.city, pkg.destination?.state].filter(Boolean).join(', ');

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.cardWrap}>
      <Card style={styles.card}>
        <View style={styles.cardImageWrap}>
          {img ? (
            <Image source={{ uri: img }} style={styles.cardImage} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <LinearGradient
              colors={[colors.primary[300], colors.primary[600]]}
              style={styles.cardImage}
            />
          )}
          {off > 0 ? (
            <View style={styles.offBadge}>
              <Text style={styles.offText}>{off}% OFF</Text>
            </View>
          ) : null}
          {pkg.isFeatured ? (
            <View style={styles.featuredBadge}>
              <Ionicons name="flame" size={12} color="#fff" />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
            {pkg.title}
          </Text>
          {dest ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{dest}</Text>
            </View>
          ) : null}
          {days > 0 ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {days} day{days === 1 ? '' : 's'}
                {nights > 0 ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}
              </Text>
            </View>
          ) : null}
          {pkg.rating?.average ? (
            <View style={styles.metaRow}>
              <StarRating rating={pkg.rating.average} size={12} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {pkg.rating.average.toFixed(1)}
                {pkg.rating.count ? ` (${pkg.rating.count})` : ''}
              </Text>
            </View>
          ) : null}

          <View style={[styles.priceRow, { borderTopColor: themeColors.border }]}>
            <View>
              <Text style={[styles.priceLabel, { color: themeColors.textTertiary }]}>Starting from</Text>
              <Text style={styles.priceValue}>
                ₹{price.toLocaleString('en-IN')}
                {mrp && mrp > price ? (
                  <Text style={[styles.mrpText, { color: themeColors.textTertiary }]}> ₹{mrp.toLocaleString('en-IN')}</Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.priceCta}>
              <Text style={styles.priceCtaText}>View</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function FeaturedCard({ pkg, onPress }: { pkg: HolidayPackage; onPress: () => void }) {
  const img = pkgImage(pkg);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.featCardWrap}>
      <View style={styles.featCard}>
        {img ? (
          <Image source={{ uri: img }} style={styles.featImage} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <LinearGradient
            colors={[colors.primary[400], colors.primary[700]]}
            style={styles.featImage}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.featOverlay}
        />
        <View style={styles.featContent}>
          {pkg.duration?.days ? (
            <Badge label={`${pkg.duration.days}D / ${pkg.duration.nights || pkg.duration.days - 1}N`} variant="primary" size="sm" />
          ) : null}
          <Text style={styles.featTitle} numberOfLines={2}>
            {pkg.title}
          </Text>
          {pkg.pricing?.startingFrom ? (
            <Text style={styles.featPrice}>
              ₹{pkg.pricing.startingFrom.toLocaleString('en-IN')}
              <Text style={styles.featPriceMeta}> / person</Text>
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
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
  hero: { height: 210, justifyContent: 'flex-end', backgroundColor: '#1f2937' },
  heroBack: {
    position: 'absolute', top: spacing.sm, left: spacing.lg,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBody: { padding: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: fontWeight.bold, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' },
  heroSearch: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: spacing.md,
    height: 48, marginTop: spacing.md, width: '100%',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  heroSearchInput: { flex: 1, fontSize: fontSize.md, color: '#111827' },

  // India / International scope
  scopeRow: {
    flexDirection: 'row', alignSelf: 'center', marginTop: spacing.md,
    backgroundColor: '#F3F4F6', borderRadius: 999, padding: 4, gap: 4,
  },
  scopePill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  scopePillText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  categoryRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: 'center', // keep chips content-height (else they stretch to tall ovals)
  },
  sortRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  sortChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, alignSelf: 'center' },
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
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  catChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  catChipTextActive: { color: '#fff' },

  featuredSection: { paddingTop: spacing.md },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
    backgroundColor: colors.primary[500],
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
  priceValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[600] },
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
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  priceCtaText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
