// Explore Nearby — geolocation-based POI discovery.
// Mirrors the PWA /explore-nearby: gets the user's location, queries
// /destinations/nearby, lets them filter by category + radius.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Star, Navigation, Compass } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import * as Location from 'expo-location';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
  Button,
} from '@prayana/shared-ui';
import { destinationAPI } from '@prayana/shared-services';

const RADII = [5, 10, 20, 50];
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'attraction', label: 'Attractions' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'historical', label: 'Historical' },
  { id: 'religious', label: 'Religious' },
  { id: 'dining', label: 'Dining' },
];

export default function ExploreNearbyScreen() {
  const { themeColors } = useTheme();
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(10);
  const [category, setCategory] = useState('all');

  const requestAndLocate = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        setLoading(false);
        return;
      }
      setPermission('granted');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: any) {
      console.warn('[ExploreNearby] location failed:', e?.message);
      setPermission('denied');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestAndLocate();
  }, [requestAndLocate]);

  const fetchNearby = useCallback(
    async (c: { lat: number; lng: number }, r: number) => {
      setLoading(true);
      try {
        const res: any = await destinationAPI.getNearbyByCoords({
          location: c,
          radius: r,
          limit: 40,
        });
        const data = res?.data || [];
        setPlaces(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.warn('[ExploreNearby] nearby failed:', e?.message);
        setPlaces([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (coords) fetchNearby(coords, radius);
  }, [coords, radius, fetchNearby]);

  const filtered = useMemo(() => {
    if (category === 'all') return places;
    return places.filter((p: any) => (p.category || '').toLowerCase().includes(category));
  }, [places, category]);

  const openDirections = useCallback((p: any) => {
    const c = p.coordinates || p.location?.coordinates;
    if (c?.lat && c?.lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`).catch(() => {});
    }
  }, []);

  // Permission denied state
  if (permission === 'denied') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header themeColors={themeColors} />
        <View style={styles.center}>
          <Compass size={56} color={themeColors.textTertiary} />
          <Text style={[styles.centerTitle, { color: themeColors.text }]}>Location needed</Text>
          <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
            Enable location access to discover attractions, eateries and hidden spots around you.
          </Text>
          <Button title="Enable Location" onPress={requestAndLocate} variant="primary" style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header themeColors={themeColors} />

      <FlatList
        data={loading && places.length === 0 ? [] : filtered}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={({ item }) => (
          <PlaceCard place={item} themeColors={themeColors} onDirections={() => openDirections(item)} />
        )}
        ListHeaderComponent={
          <View>
            {/* Radius selector */}
            <Text style={[styles.sectionLabel, { color: themeColors.text }]}>Search radius</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {RADII.map((r) => {
                const active = radius === r;
                return (
                  <TouchableOpacity key={r} onPress={() => setRadius(r)} style={[styles.chip, {
                    backgroundColor: active ? colors.primary[500] : themeColors.surface,
                    borderColor: active ? colors.primary[500] : themeColors.border,
                  }]}>
                    <Text style={[styles.chipText, { color: active ? '#fff' : themeColors.textSecondary }]}>{r} km</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginTop: spacing.sm }]}>
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <TouchableOpacity key={c.id} onPress={() => setCategory(c.id)} style={[styles.catChip, {
                    backgroundColor: active ? colors.primary[50] : 'transparent',
                    borderColor: active ? colors.primary[400] : themeColors.border,
                  }]}>
                    <Text style={[styles.chipText, { color: active ? colors.primary[700] : themeColors.textTertiary }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ height: spacing.lg }} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary[500]} size="large" />
              <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>Finding places near you…</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <MapPin size={36} color={themeColors.textTertiary} />
              <Text style={[styles.centerText, { color: themeColors.textTertiary }]}>
                No places found within {radius} km. Try a larger radius.
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] }}
      />
    </SafeAreaView>
  );
}

function Header({ themeColors }: { themeColors: any }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
        <ChevronLeft size={26} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: themeColors.text }]}>Explore Nearby</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function PlaceCard({ place, themeColors, onDirections }: { place: any; themeColors: any; onDirections: () => void }) {
  const img = place.image || place.images?.[0]?.url || null;
  const rating = place.rating ?? 0;
  return (
    <View style={[styles.card, shadow.sm, { backgroundColor: themeColors.surface }]}>
      {img ? (
        <Image source={{ uri: img }} style={styles.cardImg} />
      ) : (
        <View style={[styles.cardImg, { backgroundColor: colors.primary[100] }]} />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>{place.name}</Text>
          {!!place.distance && (
            <Text style={[styles.distance, { color: colors.primary[600] }]}>{place.distance}</Text>
          )}
        </View>
        {!!place.description && (
          <Text style={[styles.cardDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>{place.description}</Text>
        )}
        <View style={styles.cardMeta}>
          <View style={styles.metaLeft}>
            {rating > 0 && (
              <View style={styles.ratingRow}>
                <Star size={12} color="#fbbf24" fill="#fbbf24" />
                <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>{Number(rating).toFixed(1)}</Text>
              </View>
            )}
            {!!place.category && (
              <View style={[styles.catBadge, { backgroundColor: colors.primary[50] }]}>
                <Text style={[styles.catBadgeText, { color: colors.primary[700] }]}>{place.category}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onDirections} style={styles.dirBtn}>
            <Navigation size={14} color={colors.primary[600]} />
            <Text style={[styles.dirText, { color: colors.primary[600] }]}>Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sectionLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: spacing.sm, marginTop: spacing.sm },
  chipRow: { gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1 },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1 },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.md },
  centerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  centerText: { fontSize: fontSize.sm, textAlign: 'center' },
  card: { flexDirection: 'row', borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md },
  cardImg: { width: 96, height: 'auto', minHeight: 96, backgroundColor: colors.gray[200] },
  cardBody: { flex: 1, padding: spacing.md, gap: spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  distance: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardDesc: { fontSize: fontSize.xs, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  catBadgeText: { fontSize: 10, fontWeight: fontWeight.semibold },
  dirBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dirText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
