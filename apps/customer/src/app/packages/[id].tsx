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
  day?: number;
  dayNumber?: number;
  title?: string;
  description?: string;
  // Server shapes vary: activities are objects ({title,...}); meals is an object
  // ({ breakfast:{included}, lunch:{included}, dinner:{included} }) OR a string[].
  meals?: any;
  activities?: (string | { name?: string; activity?: string; title?: string })[];
};

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
  const images = pkg.images?.length ? pkg.images : [{ url: '' }];
  const dest = [pkg.destination?.city, pkg.destination?.state, pkg.destination?.country]
    .filter(Boolean)
    .join(', ');
  const days = pkg.duration?.days || 0;
  const nights = pkg.duration?.nights || Math.max(0, days - 1);
  const price = pkg.pricing?.startingFrom || 0;
  const selectedVariant = (pkg.variants || []).find((v) => v.name === variantName) || null;
  // Show the chosen variant's per-person price (else the "from" price).
  const ctaPrice = selectedVariant && !selectedVariant.pricing?.isOnRequest
    ? (variantPrice(selectedVariant) || price)
    : price;
  const mrp = pkg.pricing?.mrp;
  const off = mrp && mrp > ctaPrice ? Math.round(((mrp - ctaPrice) / mrp) * 100) : 0;

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
              const acts = (d.activities || []).map(itemLabel).filter(Boolean);
              const meals = mealLabels(d.meals);
              return (
                <View key={di} style={[styles.dayBlock, { borderTopColor: themeColors.border }]}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>D{dayNo}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, { color: themeColors.text }]}>
                      {d.title || `Day ${dayNo}`}
                    </Text>
                    {d.description ? (
                      <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>{d.description}</Text>
                    ) : null}
                    {acts.length > 0 ? (
                      <Text style={[styles.dayMeta, { color: themeColors.textTertiary }]}>
                        Activities: {acts.join(', ')}
                      </Text>
                    ) : null}
                    {meals.length > 0 ? (
                      <Text style={[styles.dayMeta, { color: themeColors.textTertiary }]}>
                        Meals: {meals.join(', ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
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
