// Reusable card for a global (Headout/Viator) experience.
// Shared by Global Experiences, India Experiences, and the destination
// Activities tab. Mirrors the PWA ActivityCard.
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Star, MapPin, Zap } from 'lucide-react-native';
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

interface Props {
  activity: any;
  width?: number | string;
}

export const GlobalActivityCard: React.FC<Props> = ({ activity: a, width = '48%' }) => {
  const { themeColors } = useTheme();
  const img = a.images?.[0]?.url || a.images?.[0] || a.heroImage || null;
  const rating = a.rating?.average ?? a.rating ?? 0;
  const reviews = a.rating?.count ?? a.reviewCount ?? 0;
  const price =
    a.platformSellingPrice ?? a.pricing?.basePrice ?? a.price ?? a.platformMRP ?? null;
  const currency = a.pricing?.currency || a.currency || '₹';
  const city = a.location?.city || a.externalData?.city?.code || '';
  const instant = a.instantBooking;

  return (
    <TouchableOpacity
      style={[styles.card, shadow.sm, { width: width as any, backgroundColor: themeColors.surface }]}
      activeOpacity={0.85}
      onPress={() => a._id && router.push(`/activity/${a._id}` as any)}
    >
      <View>
        {img ? (
          <Image source={{ uri: img }} style={styles.img} />
        ) : (
          <View style={[styles.img, { backgroundColor: colors.primary[100] }]} />
        )}
        {instant && (
          <View style={styles.instantBadge}>
            <Zap size={10} color="#fff" fill="#fff" />
            <Text style={styles.instantText}>Instant</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
          {a.name || a.title}
        </Text>
        {!!city && (
          <View style={styles.cityRow}>
            <MapPin size={11} color={themeColors.textTertiary} />
            <Text style={[styles.city, { color: themeColors.textTertiary }]} numberOfLines={1}>
              {city}
            </Text>
          </View>
        )}
        <View style={styles.metaRow}>
          {rating > 0 && (
            <View style={styles.ratingRow}>
              <Star size={12} color="#fbbf24" fill="#fbbf24" />
              <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
                {Number(rating).toFixed(1)}
                {reviews > 0 ? ` (${reviews})` : ''}
              </Text>
            </View>
          )}
          {price != null && (
            <Text style={styles.price}>
              {currency}
              {Number(price).toLocaleString()}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md },
  img: { width: '100%', height: 120, backgroundColor: colors.gray[200] },
  instantBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  instantText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.semibold },
  body: { padding: spacing.md, gap: spacing.xs },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 18 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  city: { fontSize: fontSize.xs },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  price: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[600] },
});
