import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { useIsha } from './ishaTheme';
import type { ChatImage, Place } from './types';

// "car_bus" is also what a plan gets when no one chose: "By road" for Paris
// was wrong, so only a real choice shows
const TRANSPORT: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = {
  bike: { icon: 'bicycle-outline', label: 'By bike' },
  flight: { icon: 'airplane-outline', label: 'By flight' },
};

/**
 * The plan's cover: the place's photos with "6 days in Paris" on them, what
 * the plan covers, and one button to open it day by day (it opens here in
 * the chat).
 */
export default function ItineraryPreviewCard({
  itineraryData,
  fallbackImages,
  fallbackPlaces,
  requestData,
  onViewFull,
  opening = false,
  open = false,
}: {
  itineraryData?: { structured?: any } | null;
  fallbackImages?: ChatImage[] | string[];
  fallbackPlaces?: Place[];
  requestData?: { destination?: string | null; duration?: number | string | null; transportMode?: string | null } | null;
  onViewFull: () => void;
  opening?: boolean;
  open?: boolean;
}) {
  const t = useIsha();
  const structured = itineraryData?.structured;
  const destination = requestData?.destination || structured?.destination || 'your trip';
  const duration = requestData?.duration || structured?.duration || 3;
  const transport = TRANSPORT[String(requestData?.transportMode || structured?.transportMode || '')];

  // Photos and the main stops: from the plan's days when it has them, else
  // from the destination's places sent with the message
  const { images, stops } = useMemo(() => {
    const imgs: string[] = [];
    const names: string[] = [];
    const data = structured?.itinerary || structured?.data?.itinerary || structured;
    for (const day of data?.days || []) {
      for (const p of day?.mainPlaces || []) {
        const url = p?.images?.[0]?.url || p?.images?.[0]?.mediumUrl || p?.images?.[0]?.smallUrl;
        if (url && imgs.length < 3) imgs.push(url);
        if (p?.name && names.length < 3) names.push(p.name);
      }
    }
    if (!imgs.length) {
      for (const im of (fallbackImages || []) as ChatImage[]) {
        const url = typeof im === 'string' ? im : im?.url;
        if (url) imgs.push(url);
        if (imgs.length >= 3) break;
      }
    }
    if (!names.length) {
      for (const p of fallbackPlaces || []) {
        if (p?.name) names.push(p.name);
        if (names.length >= 3) break;
      }
    }
    return { images: imgs.map((u) => normalizeImageUrl(u)), stops: names };
  }, [structured, fallbackImages, fallbackPlaces]);

  const title = `${duration} days in ${destination}`;

  return (
    <Pressable
      onPress={onViewFull}
      accessibilityRole="button"
      accessibilityLabel={`${open ? 'Hide' : 'Open'} your plan: ${title}`}
      style={({ pressed }) => [styles.card, { borderColor: t.border, backgroundColor: t.surface, shadowColor: t.shadow }, pressed && { opacity: 0.94 }]}
    >
      <View style={[styles.cover, { backgroundColor: t.sunken }]}>
        {images.length >= 3 ? (
          <View style={styles.mosaic}>
            <Image source={{ uri: images[0] }} style={{ flex: 2 }} contentFit="cover" transition={200} />
            <View style={{ flex: 1, gap: 2 }}>
              <Image source={{ uri: images[1] }} style={{ flex: 1 }} contentFit="cover" transition={200} />
              <Image source={{ uri: images[2] }} style={{ flex: 1 }} contentFit="cover" transition={200} />
            </View>
          </View>
        ) : images.length ? (
          <Image source={{ uri: images[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={['#57534e', '#1c1917']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.coverText}>
          <Text style={styles.kicker}>Your trip plan</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: t.sunken }]}>
            <Ionicons name="calendar-outline" size={13} color={t.body} />
            <Text style={[styles.chipText, { color: t.body }]}>Day by day</Text>
          </View>
          {transport && (
            <View style={[styles.chip, { backgroundColor: t.sunken }]}>
              <Ionicons name={transport.icon} size={13} color={t.body} />
              <Text style={[styles.chipText, { color: t.body }]}>{transport.label}</Text>
            </View>
          )}
        </View>
        {stops.length > 0 && (
          <View style={styles.stops}>
            <Ionicons name="location-outline" size={14} color={t.muted} style={{ marginTop: 3 }} />
            <Text style={[styles.stopsText, { color: t.muted }]}>Includes {stops.join(', ')}</Text>
          </View>
        )}
        <View style={[styles.cta, { backgroundColor: t.ink }]}>
          <Text style={[styles.ctaText, { color: t.onInk }]}>
            {opening ? 'Opening your plan…' : open ? 'Hide day-by-day plan' : 'View day-by-day plan'}
          </Text>
          <Ionicons name={open ? 'chevron-up' : 'arrow-forward'} size={16} color={t.onInk} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 1,
  },
  cover: { height: 168, overflow: 'hidden' },
  mosaic: { flex: 1, flexDirection: 'row', gap: 2 },
  coverText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16 },
  kicker: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '500' },
  title: { color: '#fff', fontSize: 21, fontWeight: '600', letterSpacing: -0.2, marginTop: 2, lineHeight: 26 },
  body: { padding: 16, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '500' },
  stops: { flexDirection: 'row', gap: 6 },
  stopsText: { flex: 1, fontSize: 13, lineHeight: 20 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14 },
  ctaText: { fontSize: 14, fontWeight: '600' },
});
