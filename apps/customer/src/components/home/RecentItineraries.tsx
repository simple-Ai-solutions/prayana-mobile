// RecentItineraries — home-screen section showing the most recently generated
// AI itineraries (Plan-a-Trip + Quick Itinerary). Reads local history and
// reopens the itinerary screen on tap. Renders nothing when there's no history.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl } from '@prayana/shared-utils';
import { getRecentItineraries, RecentItinerary } from '../../utils/recentItineraries';

// In-memory cache: destination -> resolved image url (avoids refetching on every
// home-screen focus). Lives for the app session.
const imageCache = new Map<string, string>();

// Self-loading thumbnail: shows the gradient until a destination image resolves.
const CardThumb: React.FC<{ destination: string; gradient: [string, string] }> = React.memo(
  ({ destination, gradient }) => {
    const [url, setUrl] = useState<string | null>(imageCache.get(destination) || null);

    useEffect(() => {
      if (url) return;
      let cancelled = false;
      (async () => {
        try {
          const res: any = await makeAPICall('/destinations/place-images', {
            method: 'POST',
            body: JSON.stringify({ placeName: destination, location: destination, count: 1 }),
            timeout: 15000,
          });
          const data = res?.data || res;
          const arr = Array.isArray(data) ? data : [];
          const raw = arr.length
            ? (typeof arr[0] === 'string'
                ? arr[0]
                : arr[0]?.url || arr[0]?.imageUrl || arr[0]?.s3Url || arr[0]?.originalUrl)
            : null;
          const resolved = raw ? (resolveImageUrl(raw) || raw) : null;
          if (resolved && !cancelled) {
            imageCache.set(destination, resolved);
            setUrl(resolved);
          }
        } catch {
          // keep gradient fallback
        }
      })();
      return () => { cancelled = true; };
    }, [destination, url]);

    if (url) {
      return <Image source={{ uri: url }} style={styles.cardImage} resizeMode="cover" />;
    }
    return (
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardImage}>
        <Ionicons name="map" size={20} color="rgba(255,255,255,0.9)" />
      </LinearGradient>
    );
  }
);

const CARD_GRADIENTS: [string, string][] = [
  ['#06B6D4', '#0EA5E9'],
  ['#3B82F6', '#06B6D4'],
  ['#10B981', '#059669'],
  ['#8B5CF6', '#6366F1'],
  ['#F59E0B', '#F97316'],
];

function timeAgo(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const RecentItineraries: React.FC = () => {
  const { themeColors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<RecentItinerary[]>([]);

  // Refresh whenever the home screen regains focus (e.g. after generating one).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecentItineraries().then((list) => {
        if (active) setItems(list.slice(0, 10));
      });
      return () => { active = false; };
    }, [])
  );

  const open = useCallback((it: RecentItinerary) => {
    router.push({
      pathname: '/trip/itinerary',
      params: {
        markdown: it.markdown,
        title: it.title,
        destination: it.destination,
        duration: it.duration,
        transportMode: it.transportMode || 'car_bus',
        markdownItineraryId: it.markdownItineraryId || '',
      },
    });
  }, [router]);

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="time" size={18} color={themeColors.text} />
          <Text style={[styles.title, { color: themeColors.text }]}>Recent Itineraries</Text>
        </View>
        <Text style={[styles.sub, { color: themeColors.textSecondary }]}>Pick up where you left off</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((it, idx) => {
          const grad = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
          return (
            <TouchableOpacity
              key={it.id}
              style={[styles.card, shadow.sm]}
              activeOpacity={0.85}
              onPress={() => open(it)}
            >
              <View style={styles.thumbWrap}>
                <CardThumb destination={it.destination} gradient={grad} />
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{it.duration}D</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>
                  {it.title || it.destination}
                </Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="location-outline" size={10} color={themeColors.textSecondary} />
                  <Text style={[styles.cardDest, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {it.destination}
                  </Text>
                </View>
                <Text style={[styles.cardTime, { color: themeColors.textTertiary }]}>{timeAgo(it.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.xs, marginTop: 2 },
  row: { paddingHorizontal: spacing.lg, gap: 10, paddingBottom: 4 },
  card: { width: 124, borderRadius: borderRadius.md, backgroundColor: '#fff', overflow: 'hidden' },
  thumbWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 76, alignItems: 'center', justifyContent: 'center' },
  durationBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
  },
  durationText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold },
  cardBody: { paddingHorizontal: 8, paddingVertical: 7 },
  cardTitle: { fontSize: 12, fontWeight: fontWeight.bold, lineHeight: 15 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  cardDest: { fontSize: 10, flex: 1 },
  cardTime: { fontSize: 9, marginTop: 3 },
});

export default RecentItineraries;
