// FeaturedRailCard — the tall editorial overlay card in the web Things-to-Do
// "Top picks" rail (app/activities/page.js FeaturedRailCard). 4:5 photo with a
// dark bottom scrim, an Editor's-pick / Traveler-favorite flag, city/duration
// chips, title and a "From ₹…" price with a Book-Now pill.
import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Experience, imageOf, priceOf, formatPrice, ratingOf } from '../../lib/experiences';

interface Props {
  experience: Experience;
  width?: number;
  onPress: (e: Experience) => void;
}

export const FeaturedRailCard: React.FC<Props> = ({ experience, width = 280, onPress }) => {
  const img = imageOf(experience);
  const price = priceOf(experience);
  const rating = ratingOf(experience);
  const city = experience.location?.city;
  const duration = experience.duration?.label;
  const isFeatured = (experience as any).isFeatured;
  const perLabel = experience.pricing?.priceType === 'per_person' ? 'person' : 'group';

  return (
    <Pressable
      onPress={() => onPress(experience)}
      accessibilityRole="button"
      accessibilityLabel={experience.title}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imgFallback]} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.28, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Top row — flag + rating */}
        <View style={styles.topRow}>
          {isFeatured ? (
            <LinearGradient
              colors={['#F97316', '#F43F5E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.flag}
            >
              <Ionicons name="flame" size={10} color="#FFFFFF" />
              <Text style={styles.flagText}>EDITOR&apos;S PICK</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.flag, styles.flagLight]}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={[styles.flagText, { color: '#111827' }]}>TRAVELER FAVORITE</Text>
            </View>
          )}
          {!!rating && rating.count > 0 && (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating.average.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Bottom content */}
        <View style={styles.bottom}>
          <View style={styles.metaRow}>
            {!!city && (
              <View style={styles.metaChip}>
                <Ionicons name="location" size={10} color="#FFFFFF" />
                <Text style={styles.metaChipText}>{city}</Text>
              </View>
            )}
            {!!duration && (
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                <Text style={styles.metaChipText}>{duration}</Text>
              </View>
            )}
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {experience.title}
          </Text>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.fromLabel}>FROM</Text>
              {price ? (
                <Text style={styles.price}>
                  {formatPrice(price)}
                  <Text style={styles.per}> /{perLabel}</Text>
                </Text>
              ) : (
                <Text style={styles.price}>On request</Text>
              )}
            </View>
            <View style={styles.bookNow}>
              <Text style={styles.bookNowText}>Book Now</Text>
              <Ionicons name="arrow-forward" size={12} color="#111827" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default FeaturedRailCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  imgWrap: { aspectRatio: 4 / 5, backgroundColor: '#E5E7EB' },
  imgFallback: { backgroundColor: '#D1D5DB' },

  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  flagLight: { backgroundColor: 'rgba(255,255,255,0.92)' },
  flagText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingText: { fontSize: 10, fontWeight: '800', color: '#111827' },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metaChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500', textTransform: 'capitalize' },

  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 12,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  fromLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  price: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  per: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  bookNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  bookNowText: { color: '#111827', fontSize: 12, fontWeight: '800' },
});
