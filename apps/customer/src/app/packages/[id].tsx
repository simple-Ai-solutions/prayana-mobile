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
import { holidayPackagesAPI } from '@prayana/shared-services';
import { useRequireAuth } from '../../lib/useRequireAuth';

const { width: SCREEN_W } = Dimensions.get('window');

type ItineraryDay = {
  day: number;
  title?: string;
  description?: string;
  meals?: string[];
  activities?: string[];
};

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
  category?: string;
  rating?: { average?: number; count?: number };
  images?: { url: string; alt?: string }[];
  inclusions?: string[];
  exclusions?: string[];
  itinerary?: ItineraryDay[];
  highlights?: string[];
  isFeatured?: boolean;
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

  const fetchPackage = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await holidayPackagesAPI.getById(id);
      setPkg(res?.data || res?.package || null);
    } catch (err: any) {
      console.warn('[PackageDetail] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPackage();
  }, [fetchPackage]);

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

  const images = pkg.images?.length ? pkg.images : [{ url: '' }];
  const dest = [pkg.destination?.city, pkg.destination?.state, pkg.destination?.country]
    .filter(Boolean)
    .join(', ');
  const days = pkg.duration?.days || 0;
  const nights = pkg.duration?.nights || Math.max(0, days - 1);
  const price = pkg.pricing?.startingFrom || 0;
  const mrp = pkg.pricing?.mrp;
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Floating back button */}
      <TouchableOpacity
        onPress={() => router.back()}
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
          {pkg.category ? (
            <Badge label={pkg.category.toUpperCase()} variant="primary" size="sm" />
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
            {pkg.itinerary.map((d) => (
              <View key={d.day} style={[styles.dayBlock, { borderTopColor: themeColors.border }]}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>D{d.day}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dayTitle, { color: themeColors.text }]}>
                    {d.title || `Day ${d.day}`}
                  </Text>
                  {d.description ? (
                    <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>{d.description}</Text>
                  ) : null}
                  {d.activities && d.activities.length > 0 ? (
                    <Text style={[styles.dayMeta, { color: themeColors.textTertiary }]}>
                      Activities: {d.activities.join(', ')}
                    </Text>
                  ) : null}
                  {d.meals && d.meals.length > 0 ? (
                    <Text style={[styles.dayMeta, { color: themeColors.textTertiary }]}>
                      Meals: {d.meals.join(', ')}
                    </Text>
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

      {/* Sticky CTA */}
      <View style={[styles.cta, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <View style={{ flex: 1 }}>
          {off > 0 && mrp ? (
            <Text style={[styles.mrpStrike, { color: themeColors.textTertiary }]}>
              ₹{mrp.toLocaleString('en-IN')}
            </Text>
          ) : null}
          <Text style={styles.priceValue}>
            ₹{price.toLocaleString('en-IN')}
            <Text style={[styles.priceMeta, { color: themeColors.textSecondary }]}>
              {pkg.pricing?.perPerson === false ? ' total' : ' / person'}
            </Text>
          </Text>
        </View>
        <Button
          title="Book package"
          onPress={() => {
            const path = `/packages/checkout/${encodeURIComponent(pkg.slug || pkg._id)}`;
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
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
    marginTop: 4,
  },

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
