// ExperienceCard — the Viator/Headout card from the PWA's Explore World.
//
// Theme note: this is the app's standard surface, so it uses the shared orange
// primary (colors.primary[500] = #f97316) for the Instant badge, and the logo
// teal (#4AC0CC) for the provider chip, as the web's
// ActivityCard does. It is NOT the brand-red of the eSIM screens.
//
// Nothing here is invented: the API sends no `isFeatured` and no `alsoOn`, so
// there is no "Bestseller" ribbon and no multi-provider badge. A badge the data
// cannot support is a lie, however good it looks.
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { useTheme, colors, spacing, fontWeight } from '@prayana/shared-ui';
import {
  Experience,
  formatPrice,
  imageOf,
  isInstant,
  priceOf,
  providerLabel,
  ratingOf,
} from '../../lib/experiences';
import { fallbackPhoto } from '../../lib/fallbackPhoto';
import { PressableScale } from '../ui/PressableScale';
import { toggleSaved, useIsSaved } from '../../lib/savedActivities';

const TEAL = '#4AC0CC'; // logo primary — see PRAYANA_DESIGN_SYSTEM.pdf

interface Props {
  experience: Experience;
  /** Fixed width for the horizontal rails; omit to fill the parent (grid). */
  width?: number;
  onPress: (e: Experience) => void;
}

/** Save-to-wishlist heart, for Prayana's own listings (the wishlist holds those). */
function Heart({ id }: { id: string }) {
  const saved = useIsSaved(id);
  return (
    <PressableScale
      scaleTo={0.85}
      wrapperStyle={styles.heartWrap}
      style={styles.heart}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from Wishlist' : 'Save to Wishlist'}
      onPress={() => {
        const now = toggleSaved(id);
        Toast.show({
          type: now ? 'success' : 'info',
          text1: now ? 'Saved to Wishlist' : 'Removed',
          text2: now ? 'Find it under My Wishlist.' : undefined,
          visibilityTime: 1800,
          onPress: now ? () => { Toast.hide(); router.push('/wishlist' as any); } : undefined,
        });
      }}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={17} color={saved ? '#F43F5E' : '#fff'} />
    </PressableScale>
  );
}

// Photo first: a big rounded picture carrying the badge, rating and heart,
// then the title, where and how long, and the price. No box, no divider and
// no arrow button; the whole card is the button.
export const ExperienceCard: React.FC<Props> = ({ experience, width, onPress }) => {
  const { themeColors } = useTheme();

  const img = imageOf(experience) || fallbackPhoto(experience);
  const price = priceOf(experience);
  const rating = ratingOf(experience);
  const provider = providerLabel(experience);
  const city = experience.location?.city;
  const duration = experience.duration?.label;
  const meta = [duration, city].filter(Boolean).join(' · ');

  return (
    <PressableScale
      onPress={() => onPress(experience)}
      accessibilityRole="button"
      accessibilityLabel={experience.title}
      wrapperStyle={width ? { width } : styles.fill}
    >
      <View style={[styles.imgWrap, { backgroundColor: themeColors.backgroundSecondary }]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={styles.img}>
            <Ionicons name="image-outline" size={26} color={themeColors.textTertiary} />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
          locations={[0, 0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {provider ? (
          <View style={styles.providerChip}>
            <Text style={styles.chipText}>{provider}</Text>
          </View>
        ) : (
          // Prayana's own listings carry no third-party badge. Where the host
          // confirms instantly, say so — that IS the useful fact here.
          isInstant(experience) && (
            <View style={styles.instantChip}>
              <Ionicons name="flash" size={10} color="#FFFFFF" />
              <Text style={styles.chipText}>Instant</Text>
            </View>
          )
        )}

        {!provider && !!experience._id && <Heart id={String(experience._id)} />}

        {!!rating && (
          <View style={styles.rating}>
            <Ionicons name="star" size={11} color="#FBBF24" />
            <Text style={styles.ratingText}>
              {rating.average.toFixed(1)}
              {rating.count > 0 && (
                <Text style={styles.ratingCount}> ({rating.count.toLocaleString('en-IN')})</Text>
              )}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
          {experience.title}
        </Text>
        {!!meta && (
          <Text style={[styles.meta, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {price ? (
          <Text style={[styles.price, { color: themeColors.text }]}>
            {formatPrice(price)}
            {experience.pricing?.priceType === 'per_person' && (
              <Text style={[styles.per, { color: themeColors.textSecondary }]}> / person</Text>
            )}
          </Text>
        ) : (
          // No price on the wire — say so rather than printing ₹0.
          <Text style={[styles.per, { color: themeColors.textSecondary }]}>Price on request</Text>
        )}
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },

  imgWrap: { borderRadius: 18, overflow: 'hidden' },
  // Square: big enough to sell the moment, and two fit side by side.
  img: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  providerChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: TEAL,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  instantChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: fontWeight.bold, letterSpacing: 0.3 },

  heartWrap: { position: 'absolute', top: 8, right: 8 },
  heart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  rating: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold },
  ratingCount: { fontWeight: fontWeight.medium, color: 'rgba(255,255,255,0.85)' },

  body: { paddingTop: 10, paddingHorizontal: 2, gap: 3 },
  title: { fontSize: 14, fontWeight: fontWeight.bold, lineHeight: 19, letterSpacing: -0.2 },
  meta: { fontSize: 12 },
  price: { marginTop: 3, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  per: { fontSize: 12, fontWeight: '500' },
});

export default ExperienceCard;
