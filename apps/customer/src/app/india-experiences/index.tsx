// India Experiences — India-only marketplace with region tabs + category filter.
// Mirrors the PWA /india-experiences: /activities/global?country=India with
// client-side region bucketing by location.state.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { GlobalActivityCard } from '../../components/experiences/GlobalActivityCard';

const REGIONS = [
  { id: 'all', label: 'All India', states: [] as string[] },
  { id: 'north', label: 'North', states: ['delhi', 'punjab', 'rajasthan', 'uttar pradesh', 'himachal', 'uttarakhand', 'haryana', 'jammu', 'kashmir', 'ladakh'] },
  { id: 'south', label: 'South', states: ['kerala', 'karnataka', 'tamil nadu', 'andhra', 'telangana', 'puducherry'] },
  { id: 'east', label: 'East', states: ['west bengal', 'odisha', 'bihar', 'jharkhand', 'assam', 'sikkim', 'meghalaya'] },
  { id: 'west', label: 'West', states: ['maharashtra', 'goa', 'gujarat'] },
];

const CATEGORIES = ['All', 'Tours', 'Heritage', 'Adventure', 'Food', 'Water', 'Wellness', 'Nightlife'];

export default function IndiaExperiencesScreen() {
  const { themeColors } = useTheme();
  const [region, setRegion] = useState('all');
  const [category, setCategory] = useState('All');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchItems = useCallback(
    async (cat: string, skipN: number, append: boolean) => {
      setLoading(true);
      try {
        const res: any = await activityMarketplaceAPI.getGlobalActivities({
          country: 'India',
          category: cat === 'All' ? undefined : cat,
          limit: 24,
          skip: skipN,
        });
        const data = res?.data || res?.activities || [];
        setItems((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length >= 24);
        setSkip(skipN + data.length);
      } catch (e: any) {
        console.warn('[IndiaExperiences] failed:', e?.message);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setSkip(0);
    fetchItems(category, 0, false);
  }, [category, fetchItems]);

  // Client-side region filtering (matches PWA bucketing by state).
  const filtered = useMemo(() => {
    if (region === 'all') return items;
    const r = REGIONS.find((x) => x.id === region);
    if (!r) return items;
    return items.filter((a: any) => {
      const st = (a.location?.state || '').toLowerCase();
      return r.states.some((s) => st.includes(s));
    });
  }, [items, region]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>India Experiences</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={loading && items.length === 0 ? [] : filtered}
        numColumns={2}
        keyExtractor={(item, i) => item._id || String(i)}
        columnWrapperStyle={{ paddingHorizontal: spacing.lg, justifyContent: 'space-between' }}
        renderItem={({ item }) => <GlobalActivityCard activity={item} />}
        onEndReached={() => {
          if (!loading && hasMore && region === 'all') fetchItems(category, skip, true);
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <LinearGradient colors={['#FF9933', '#138808']} style={styles.hero}>
              <Text style={styles.heroTitle}>Discover India</Text>
              <Text style={styles.heroSub}>Hand-picked experiences across the country</Text>
            </LinearGradient>

            {/* Region tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {REGIONS.map((r) => {
                const active = region === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setRegion(r.id)}
                    style={[styles.chip, {
                      backgroundColor: active ? colors.primary[500] : themeColors.surface,
                      borderColor: active ? colors.primary[500] : themeColors.border,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginTop: spacing.sm }]}>
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.catChip, {
                      backgroundColor: active ? colors.primary[50] : 'transparent',
                      borderColor: active ? colors.primary[400] : themeColors.border,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.primary[700] : themeColors.textTertiary }]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ height: spacing.lg }} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary[500]} style={{ marginTop: spacing['2xl'] }} />
          ) : (
            <View style={styles.emptyBox}>
              <MapPin size={36} color={themeColors.textTertiary} />
              <Text style={[styles.empty, { color: themeColors.textTertiary }]}>
                No experiences found for this region/category.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && items.length > 0 ? (
            <ActivityIndicator color={colors.primary[500]} style={{ marginVertical: spacing.lg }} />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      />
    </SafeAreaView>
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
  hero: {
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, marginTop: spacing.xs },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  emptyBox: { alignItems: 'center', gap: spacing.md, marginTop: spacing['2xl'] },
  empty: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.xl },
});
