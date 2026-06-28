// Captain Tours — peer-to-peer marketplace of verified guides running their
// own trips. Mirrors the PWA /captain-tours: grid of tour cards + city filter.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Star, MapPin, Clock, Compass } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { captainAPI } from '@prayana/shared-services';

export default function CaptainToursScreen() {
  const { themeColors } = useTheme();
  const [city, setCity] = useState('');
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTours = useCallback(async (cityFilter: string) => {
    setLoading(true);
    try {
      const res: any = await captainAPI.getPublicTours({ city: cityFilter || undefined, limit: 100 });
      setTours(res?.data || []);
    } catch (e: any) {
      console.warn('[CaptainTours] failed:', e?.message);
      setTours([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTours('');
  }, [fetchTours]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Captain Tours</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Search size={18} color={themeColors.textTertiary} />
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="Filter by city…"
          placeholderTextColor={themeColors.textTertiary}
          style={[styles.searchInput, { color: themeColors.text }]}
          returnKeyType="search"
          onSubmitEditing={() => fetchTours(city)}
        />
      </View>

      <FlatList
        data={loading ? [] : tours}
        numColumns={2}
        keyExtractor={(item, i) => item._id || item.slug || String(i)}
        columnWrapperStyle={{ paddingHorizontal: spacing.lg, justifyContent: 'space-between' }}
        renderItem={({ item }) => <TourCard tour={item} themeColors={themeColors} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary[500]} size="large" style={{ marginTop: spacing['2xl'] }} />
          ) : (
            <View style={styles.center}>
              <Compass size={40} color={themeColors.textTertiary} />
              <Text style={[styles.empty, { color: themeColors.textTertiary }]}>
                No captain tours available{city ? ` in ${city}` : ''} yet. Check back soon!
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['3xl'] }}
      />
    </SafeAreaView>
  );
}

function TourCard({ tour, themeColors }: { tour: any; themeColors: any }) {
  const img = tour.heroImage || tour.images?.[0]?.url || null;
  const city = tour.destinations?.[0]?.city || '';
  const rating = tour.stats?.averageRating ?? 0;
  const price = tour.pricing?.pricePerPerson ?? null;
  const days = tour.durationDays;
  const nights = tour.durationNights;

  return (
    <TouchableOpacity
      style={[styles.card, shadow.sm, { backgroundColor: themeColors.surface }]}
      activeOpacity={0.85}
      onPress={() => tour.slug && router.push(`/captain-tours/${tour.slug}` as any)}
    >
      {img ? (
        <Image source={{ uri: img }} style={styles.cardImg} />
      ) : (
        <View style={[styles.cardImg, { backgroundColor: colors.primary[100] }]}>
          <Compass size={24} color={colors.primary[400]} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>{tour.title}</Text>
        {!!city && (
          <View style={styles.row}>
            <MapPin size={11} color={themeColors.textTertiary} />
            <Text style={[styles.subText, { color: themeColors.textTertiary }]} numberOfLines={1}>{city}</Text>
          </View>
        )}
        {(days || nights) && (
          <View style={styles.row}>
            <Clock size={11} color={themeColors.textTertiary} />
            <Text style={[styles.subText, { color: themeColors.textTertiary }]}>
              {days ? `${days}D` : ''}{nights ? `/${nights}N` : ''}
            </Text>
          </View>
        )}
        <View style={styles.cardMeta}>
          {rating > 0 && (
            <View style={styles.row}>
              <Star size={12} color="#fbbf24" fill="#fbbf24" />
              <Text style={[styles.subText, { color: themeColors.textSecondary }]}>{Number(rating).toFixed(1)}</Text>
            </View>
          )}
          {price != null && (
            <Text style={styles.price}>₹{Number(price).toLocaleString()}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: fontSize.md },
  card: { width: '48%', borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md },
  cardImg: { width: '100%', height: 110, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subText: { fontSize: fontSize.xs },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  price: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary[600] },
  center: { alignItems: 'center', gap: spacing.md, marginTop: spacing['2xl'], paddingHorizontal: spacing.xl },
  empty: { fontSize: fontSize.sm, textAlign: 'center' },
});
