import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, spacing, shadow, useTheme } from '@prayana/shared-ui';
import { destinationAPI, makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl, getPlaceImageUrl } from '@prayana/shared-utils';

interface NearbyTabProps {
  placeName: string;
  location: string;
}

// Self-loading image component for nearby places
const NearbyPlaceImage: React.FC<{
  place: any;
  location: string;
  style: any;
}> = ({ place, location, style }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Try extracting image from place data first
    const existingUrl = getPlaceImageUrl(place)
      || resolveImageUrl(place.image)
      || resolveImageUrl(place.imageUrls?.[0])
      || resolveImageUrl(place.images?.[0])
      || null;

    if (existingUrl) {
      setImageUrl(existingUrl);
      setLoading(false);
      return;
    }

    // Fallback: fetch from place-images API
    let cancelled = false;
    const fetchImage = async () => {
      try {
        const res = await makeAPICall('/destinations/place-images', {
          method: 'POST',
          body: JSON.stringify({
            placeName: place.name,
            location: location,
            count: 1,
          }),
          timeout: 15000,
        });
        if (cancelled) return;

        const data = res?.data || res;
        const imgArr = Array.isArray(data) ? data : [];
        if (imgArr.length > 0) {
          const imgData = imgArr[0];
          const rawUrl = typeof imgData === 'string'
            ? imgData
            : imgData?.url || imgData?.mediumUrl || imgData?.smallUrl || imgData?.s3Url || imgData?.originalUrl || null;
          if (rawUrl) {
            setImageUrl(resolveImageUrl(rawUrl) || rawUrl);
          }
        }
      } catch (err: any) {
        console.warn('[Nearby] Image fetch error for', place.name, err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchImage();
    return () => { cancelled = true; };
  }, [place.name, location]);

  if (loading) {
    return (
      <View style={[style, styles.imgPlaceholder]}>
        <ActivityIndicator size="small" color={colors.gray[400]} />
      </View>
    );
  }

  if (imageUrl && !error) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={style}
        contentFit="cover" transition={200} cachePolicy="memory-disk"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <LinearGradient
      colors={[colors.primary[400], colors.primary[600]]}
      style={[style, styles.imgPlaceholder]}
    >
      <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.5)" />
    </LinearGradient>
  );
};

export const NearbyTab: React.FC<NearbyTabProps> = ({ placeName, location }) => {
  const { themeColors, isDarkMode } = useTheme();
  const router = useRouter();
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNearby = async () => {
      try {
        setLoading(true);
        const res = await destinationAPI.getNearbyPlaces(placeName, location);
        const places = res?.data || res?.places || res?.nearby || (Array.isArray(res) ? res : []);
        setNearbyPlaces(Array.isArray(places) ? places : []);
      } catch (err: any) {
        console.warn('[Nearby] Error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNearby();
  }, [placeName, location]);

  const handlePlacePress = (place: any) => {
    const preview = JSON.stringify({
      name: place.name,
      category: place.category || '',
      rating: place.rating || null,
      shortDescription: place.shortDescription || '',
      image: getPlaceImageUrl(place) || '',
    });
    router.push({
      pathname: '/destination/[location]/[place]',
      params: { location, place: place.name, preview },
    } as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Finding nearby places...
        </Text>
      </View>
    );
  }

  if (nearbyPlaces.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="location-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          No nearby places found
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="location" size={20} color={colors.primary[500]} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          Nearby Places
        </Text>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{nearbyPlaces.length}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {nearbyPlaces.map((place, idx) => (
          <Pressable
            key={place.name || idx}
            style={({ pressed }) => [
              styles.card,
              shadow.sm,
              { backgroundColor: themeColors.card },
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
            onPress={() => handlePlacePress(place)}
          >
            <NearbyPlaceImage
              place={place}
              location={location}
              style={styles.cardImage}
            />
            <View style={styles.cardContent}>
              <Text style={[styles.cardName, { color: themeColors.text }]} numberOfLines={1}>
                {place.name}
              </Text>
              <View style={styles.cardMeta}>
                {place.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{place.category}</Text>
                  </View>
                )}
                {place.rating && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={11} color="#FBBF24" />
                    <Text style={[styles.ratingText, { color: themeColors.text }]}>
                      {Number(place.rating).toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
              {place.shortDescription && (
                <Text
                  style={[styles.cardDesc, { color: themeColors.textTertiary }]}
                  numberOfLines={2}
                >
                  {place.shortDescription}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gray[300]} style={styles.cardChevron} />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loadingContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.md },
  emptyContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: fontSize.md },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1 },
  countChip: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countChipText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },

  list: {
    gap: 10,
    paddingBottom: spacing['2xl'],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardImage: {
    width: 90,
    height: 80,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  imgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
    marginBottom: 3,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#6B7280' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontWeight: fontWeight.semibold },
  cardDesc: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  cardChevron: {
    marginRight: spacing.md,
  },
});

export default NearbyTab;
