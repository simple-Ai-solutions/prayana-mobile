import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { favoritesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../../lib/imageUrl';
import DestinationOverviewCard from '../DestinationOverviewCard';
import { useIsha } from '../ishaTheme';
import { goToLogin } from '../links';
import { SectionLabel } from '../ui';
import type { Place } from '../types';

// The best image a place record carries, normalised for S3/CDN
export function placeImageUrl(place?: Place | null): string | null {
  if (!place) return null;
  let url: string | null | undefined = null;
  if (Array.isArray(place.images) && place.images.length > 0) {
    const img = place.images[0];
    url = typeof img === 'object' ? img?.url : img;
  }
  url = url || place.image || place.s3Key || place.imageUrl;
  return url ? normalizeImageUrl(url) : null;
}

const keyOf = (p: Place) => p.placeId || p.id || p._id || p.name;

function PlaceCard({
  place,
  onOpen,
  onSave,
  saved,
  isAuthenticated,
}: {
  place: Place;
  onOpen: (p: Place) => void;
  onSave: (p: Place) => void;
  saved: boolean;
  isAuthenticated: boolean;
}) {
  const t = useIsha();
  const [failed, setFailed] = useState(false);
  const src = placeImageUrl(place);
  return (
    <View style={styles.card}>
      <Pressable onPress={() => onOpen(place)} accessibilityRole="button" accessibilityLabel={place.name} style={({ pressed }) => [{ gap: 6 }, pressed && { opacity: 0.8 }]}>
        {src && !failed ? (
          <Image
            source={{ uri: src }}
            onError={() => setFailed(true)}
            style={[styles.photo, { backgroundColor: t.sunken }]}
            contentFit="cover"
            transition={150}
            recyclingKey={src}
          />
        ) : (
          <View style={[styles.photo, styles.empty, { backgroundColor: t.sunken }]}>
            <Ionicons name="location-outline" size={22} color={t.faint} />
          </View>
        )}
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {place.name}
        </Text>
        {(!!place.rating || !!place.category) && (
          <View style={styles.meta}>
            {!!place.rating && (
              <>
                <Ionicons name="star" size={11} color={t.star} />
                <Text style={[styles.metaText, { color: t.muted }]}>{Number(place.rating).toFixed(1)}</Text>
              </>
            )}
            {!!place.rating && !!place.category && <Text style={[styles.metaText, { color: t.muted }]}>·</Text>}
            {!!place.category && (
              <Text style={[styles.metaText, { color: t.muted, flexShrink: 1 }]} numberOfLines={1}>
                {place.category}
              </Text>
            )}
          </View>
        )}
      </Pressable>
      <Pressable
        onPress={() => onSave(place)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={saved ? `Saved ${place.name}` : isAuthenticated ? `Save ${place.name}` : `Sign in to save ${place.name}`}
        accessibilityState={{ selected: saved }}
        style={[styles.heart, { backgroundColor: t.isDark ? 'rgba(28,25,23,0.92)' : 'rgba(255,255,255,0.95)' }]}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? '#ef4444' : t.body} />
      </Pressable>
    </View>
  );
}

/**
 * Places worth seeing for this reply, as a row of small cards, then the
 * destination's overview row. Tapping a place opens its page; the chat stays
 * behind it.
 */
export default function PlaceCards({
  topPlaces,
  destinationData,
  detectedDestination,
  isAuthenticated,
}: {
  topPlaces: Place[];
  destinationData?: any;
  detectedDestination?: string | null;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const places = (topPlaces || [])
    .filter((place, index, self) => {
      const name = place?.name?.toLowerCase().trim();
      return name && index === self.findIndex((p) => p?.name?.toLowerCase().trim() === name);
    })
    .slice(0, 6);
  if (!places.length) return null;

  // The place the user asked about (from the agent), not a landmark's city
  const destinationName =
    detectedDestination || destinationData?.name || places[0]?.city || places[0]?.state || 'Destination';

  const open = (place: Place) => {
    const location = place.city || destinationName;
    router.push(`/place-detail?location=${encodeURIComponent(location)}&place=${encodeURIComponent(place.name)}` as never);
  };

  const save = async (place: Place) => {
    if (!isAuthenticated) {
      goToLogin(router);
      return;
    }
    const key = keyOf(place);
    if (saved[key]) return;
    setSaved((s) => ({ ...s, [key]: true }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const result = await favoritesAPI.addFavorite({
        placeId: place.placeId || place.id || place._id,
        placeName: place.name,
        placeImage: place.image,
        placeLocation: place.city || place.location,
        placeData: {
          description: place.description,
          rating: place.rating,
          category: place.category,
          reviews: place.reviews || place.reviewCount || 0,
        },
      });
      if (!result?.success && result?.error !== 'Already in favorites') throw new Error('save failed');
    } catch {
      setSaved((s) => ({ ...s, [key]: false }));
      Toast.show({ type: 'error', text1: "Couldn't save that. Try again." });
    }
  };

  return (
    <View style={{ gap: 10 }} accessibilityLabel="Places worth your time">
      <SectionLabel>Places worth your time</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        style={styles.railOuter}
        decelerationRate="fast"
        snapToInterval={154}
        snapToAlignment="start"
      >
        {places.map((place, idx) => (
          <PlaceCard
            key={`${keyOf(place)}-${idx}`}
            place={place}
            onOpen={open}
            onSave={save}
            saved={!!saved[keyOf(place)]}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </ScrollView>
      <DestinationOverviewCard
        destination={{
          name: destinationName,
          city: destinationData?.city || places[0]?.city,
          image: destinationData?.image || placeImageUrl(places[0]),
          images: destinationData?.images || places.slice(0, 3).map((p) => ({ url: placeImageUrl(p) })),
        }}
        onOpen={() => router.push(`/destination/${encodeURIComponent(destinationName)}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  railOuter: { marginHorizontal: -16 },
  rail: { gap: 10, paddingHorizontal: 16, paddingBottom: 2 },
  card: { width: 144 },
  photo: { width: 144, height: 96, borderRadius: 12 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
