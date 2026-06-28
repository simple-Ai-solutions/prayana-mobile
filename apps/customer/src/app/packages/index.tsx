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

type PackageCategory =
  | 'all'
  | 'honeymoon'
  | 'family'
  | 'adventure'
  | 'pilgrimage'
  | 'beach'
  | 'wildlife'
  | 'luxury';

const CATEGORIES: { key: PackageCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'honeymoon', label: 'Honeymoon', icon: 'heart-outline' },
  { key: 'family', label: 'Family', icon: 'people-outline' },
  { key: 'adventure', label: 'Adventure', icon: 'trail-sign-outline' },
  { key: 'beach', label: 'Beach', icon: 'sunny-outline' },
  { key: 'wildlife', label: 'Wildlife', icon: 'paw-outline' },
  { key: 'pilgrimage', label: 'Pilgrimage', icon: 'flower-outline' },
  { key: 'luxury', label: 'Luxury', icon: 'diamond-outline' },
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
  images?: { url: string; alt?: string }[];
  inclusions?: string[];
  isFeatured?: boolean;
};

export default function PackagesScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<PackageCategory>('all');
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [featured, setFeatured] = useState<HolidayPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [searchRes, featuredRes] = await Promise.all([
        holidayPackagesAPI.search({
          query: search.trim() || undefined,
          category: activeCategory !== 'all' ? activeCategory : undefined,
          limit: 30,
        }),
        // Only fetch featured on initial load (no filters)
        !search.trim() && activeCategory === 'all'
          ? holidayPackagesAPI.getFeatured()
          : Promise.resolve(null),
      ]);
      setPackages(searchRes?.data || searchRes?.packages || []);
      if (featuredRes) setFeatured(featuredRes?.data || featuredRes?.packages || []);
    } catch (err: any) {
      console.warn('[Packages] load failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeCategory]);

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
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Holiday Packages</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
        <Ionicons name="search-outline" size={18} color={themeColors.textTertiary} />
        <RNTextInput
          style={[styles.searchInput, { color: themeColors.text }]}
          placeholder="Goa, Bali, Manali..."
          placeholderTextColor={themeColors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
                router.push(`/packages/${encodeURIComponent(item.slug || item._id)}`)
              }
            />
          )}
          ListHeaderComponent={
            heroFeatured.length > 0 && !search.trim() && activeCategory === 'all' ? (
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
                        router.push(`/packages/${encodeURIComponent(pkg.slug || pkg._id)}`)
                      }
                    />
                  ))}
                </ScrollView>
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
    </SafeAreaView>
  );
}

function PackageCard({ pkg, onPress }: { pkg: HolidayPackage; onPress: () => void }) {
  const { themeColors } = useTheme();
  const img = pkg.images?.[0]?.url;
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
            <Image source={{ uri: img }} style={styles.cardImage} contentFit="cover" />
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
  const img = pkg.images?.[0]?.url;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.featCardWrap}>
      <View style={styles.featCard}>
        {img ? (
          <Image source={{ uri: img }} style={styles.featImage} contentFit="cover" />
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

  categoryRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
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
