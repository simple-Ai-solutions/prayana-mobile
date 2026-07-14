// ExperienceCard — the Viator/Headout card from the PWA's Explore World.
//
// Theme note: this is the app's standard surface, so it uses the shared orange
// primary (colors.primary[500] = #f97316) for the price CTA and the location
// pin, and the logo teal (#4AC0CC) for the provider chip — exactly as the web's
// ActivityCard does. It is NOT the brand-red of the eSIM screens.
//
// Nothing here is invented: the API sends no `isFeatured` and no `alsoOn`, so
// there is no "Bestseller" ribbon and no multi-provider badge. A badge the data
// cannot support is a lie, however good it looks.
import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import {
  Experience,
  formatPrice,
  imageOf,
  priceOf,
  providerLabel,
  ratingOf,
} from '../../lib/experiences';

const TEAL = '#4AC0CC'; // logo primary — see PRAYANA_DESIGN_SYSTEM.pdf

interface Props {
  experience: Experience;
  /** Fixed width for the horizontal rails; omit to fill the parent (grid). */
  width?: number;
  onPress: (e: Experience) => void;
}

export const ExperienceCard: React.FC<Props> = ({ experience, width, onPress }) => {
  const { themeColors } = useTheme();

  const img = imageOf(experience);
  const price = priceOf(experience);
  const rating = ratingOf(experience);
  const provider = providerLabel(experience);
  const city = experience.location?.city;
  const duration = experience.duration?.label;

  return (
    <Pressable
      onPress={() => onPress(experience)}
      accessibilityRole="button"
      accessibilityLabel={experience.title}
      style={({ pressed }) => [
        styles.card,
        width ? { width } : styles.fill,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={[styles.img, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="image-outline" size={26} color={themeColors.textTertiary} />
          </View>
        )}

        {!!provider && (
          <View style={styles.providerChip}>
            <Text style={styles.providerText}>{provider}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {/* Meta line: city · duration */}
        <View style={styles.meta}>
          {!!city && (
            <>
              <Ionicons name="location" size={12} color={colors.primary[500]} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {city}
              </Text>
            </>
          )}
          {!!city && !!duration && (
            <Text style={[styles.dot, { color: themeColors.textTertiary }]}>·</Text>
          )}
          {!!duration && (
            <>
              <Ionicons name="time-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {duration}
              </Text>
            </>
          )}
        </View>

        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
          {experience.title}
        </Text>

        {!!rating && (
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color="#15803D" />
            <Text style={styles.ratingText}>
              {rating.average.toFixed(1)}
              {rating.count > 0 && (
                <Text style={styles.ratingCount}> ({rating.count.toLocaleString('en-IN')})</Text>
              )}
            </Text>
          </View>
        )}

        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          {price ? (
            <View>
              <Text style={[styles.price, { color: themeColors.text }]}>{formatPrice(price)}</Text>
              {experience.pricing?.priceType === 'per_person' && (
                <Text style={[styles.per, { color: themeColors.textTertiary }]}>per person</Text>
              )}
            </View>
          ) : (
            // No price on the wire — say so rather than printing ₹0.
            <Text style={[styles.per, { color: themeColors.textTertiary }]}>Price on request</Text>
          )}

          <View style={styles.cta}>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  fill: { flex: 1 },

  imgWrap: { position: 'relative' },
  // 3:2, matching the source images (Viator/TripAdvisor serve 720x480). Some of
  // those photos are marketing composites with a thumbnail strip in them — that
  // is the supplier's artwork, not a crop bug, and the PWA shows it too.
  img: {
    width: '100%',
    aspectRatio: 3 / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  providerChip: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: TEAL,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  providerText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },

  body: { padding: spacing.md, gap: 6 },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: fontSize.xs, flexShrink: 1 },
  dot: { fontSize: fontSize.xs, marginHorizontal: 2 },

  title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: 19 },

  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: 'rgba(22,163,74,0.10)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  ratingText: { color: '#15803D', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  ratingCount: { fontWeight: fontWeight.medium },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.4 },
  per: { fontSize: 10 },

  cta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
  },
});

export default ExperienceCard;
