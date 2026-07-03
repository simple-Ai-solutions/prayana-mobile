// "Activities" tab for the destination search-results page.
// Loads global (Headout + Viator) experiences for the location via
// /activities/global and renders them as tappable cards. Mirrors the PWA.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Star, Sparkles, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';

interface Props {
  locationName: string;
}

export const DestinationActivities: React.FC<Props> = ({ locationName }) => {
  const { themeColors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res: any = await activityMarketplaceAPI.getGlobalActivities({
          city: locationName,
          limit: 20,
        });
        const data = res?.data || res?.activities || [];
        if (active) setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.warn('[DestinationActivities] failed:', e?.message);
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [locationName]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary[500]} size="large" />
        <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
          Finding things to do in {locationName}…
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Sparkles size={40} color={themeColors.textTertiary} />
        <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
          No bookable activities found for {locationName} yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((a: any, idx: number) => {
        const img = a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
        const rating = a.rating?.average ?? a.rating ?? 0;
        const price = a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? null;
        const currency = a.pricing?.currency || a.currency || '₹';
        return (
          <TouchableOpacity
            key={a._id || idx}
            style={[styles.card, shadow.sm, { backgroundColor: themeColors.surface }]}
            activeOpacity={0.85}
            onPress={() => a._id && router.push(`/activity/${a._id}` as any)}
          >
            {img ? (
              <Image source={{ uri: img }} style={styles.cardImg} />
            ) : (
              <View style={[styles.cardImg, { backgroundColor: colors.primary[100] }]}>
                <Sparkles size={24} color={colors.primary[400]} />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
                {a.name || a.title}
              </Text>
              <View style={styles.cardMeta}>
                {rating > 0 && (
                  <View style={styles.ratingRow}>
                    <Star size={12} color="#fbbf24" fill="#fbbf24" />
                    <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
                      {Number(rating).toFixed(1)}
                    </Text>
                  </View>
                )}
                {price != null && (
                  <Text style={styles.priceText}>
                    {currency}
                    {Number(price).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.cta, { borderColor: colors.primary[300] }]}
        activeOpacity={0.85}
        onPress={() =>
          router.push(`/global-experiences?city=${encodeURIComponent(locationName)}` as any)
        }
      >
        <Text style={[styles.ctaText, { color: colors.primary[600] }]}>
          Explore every experience
        </Text>
        <ArrowRight size={16} color={colors.primary[600]} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md },
  centerText: { fontSize: fontSize.sm, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: '48%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardImg: { width: '100%', height: 120, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  priceText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[600] },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  ctaText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
