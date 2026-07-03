// Global Experiences — worldwide tours & attractions (Headout + Viator).
// Mirrors the PWA /global-experiences: search + per-city rails (Explore view),
// switching to an infinite-scroll filtered grid when searching/filtering.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Globe, X } from 'lucide-react-native';
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

const PAGE = 24;

export default function GlobalExperiencesScreen() {
  const { themeColors } = useTheme();

  // Explore (rails) mode vs. search/grid mode
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // City rails
  const [cityRails, setCityRails] = useState<any[]>([]);
  const [loadingRails, setLoadingRails] = useState(true);

  // Filtered grid
  const [gridItems, setGridItems] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridSkip, setGridSkip] = useState(0);
  const [gridHasMore, setGridHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load city rails on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res: any = await activityMarketplaceAPI.getGlobalByCity({ cities: 12, perCity: 10 });
        const rails = res?.data || res?.cities || res || [];
        if (active) setCityRails(Array.isArray(rails) ? rails : []);
      } catch (e: any) {
        console.warn('[GlobalExperiences] rails failed:', e?.message);
        if (active) setCityRails([]);
      } finally {
        if (active) setLoadingRails(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const fetchGrid = useCallback(async (q: string, skip: number, append: boolean) => {
    setGridLoading(true);
    try {
      const res: any = await activityMarketplaceAPI.getGlobalActivities({
        q: q.trim(),
        limit: PAGE,
        skip,
      });
      const data = res?.data || res?.activities || [];
      setGridItems((prev) => (append ? [...prev, ...data] : data));
      setGridHasMore(data.length >= PAGE);
      setGridSkip(skip + data.length);
    } catch (e: any) {
      console.warn('[GlobalExperiences] grid failed:', e?.message);
      if (!append) setGridItems([]);
    } finally {
      setGridLoading(false);
    }
  }, []);

  const onSearchChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setSearching(false);
        setGridItems([]);
        return;
      }
      setSearching(true);
      debounceRef.current = setTimeout(() => {
        setGridSkip(0);
        fetchGrid(text, 0, false);
      }, 350);
    },
    [fetchGrid]
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setSearching(false);
    setGridItems([]);
  }, []);

  const loadMore = useCallback(() => {
    if (gridLoading || !gridHasMore) return;
    fetchGrid(query, gridSkip, true);
  }, [gridLoading, gridHasMore, query, gridSkip, fetchGrid]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Global Experiences</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Search size={18} color={themeColors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={onSearchChange}
          placeholder="Search cities, attractions, tours…"
          placeholderTextColor={themeColors.textTertiary}
          style={[styles.searchInput, { color: themeColors.text }]}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <X size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {searching ? (
        /* ---- SEARCH / GRID MODE ---- */
        <FlatList
          data={gridItems}
          numColumns={2}
          keyExtractor={(item, i) => item._id || String(i)}
          columnWrapperStyle={{ paddingHorizontal: spacing.lg, justifyContent: 'space-between' }}
          renderItem={({ item }) => <GlobalActivityCard activity={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            gridLoading ? (
              <ActivityIndicator color={colors.primary[500]} style={{ marginTop: spacing['2xl'] }} />
            ) : (
              <Text style={[styles.empty, { color: themeColors.textTertiary }]}>
                No experiences found for “{query}”.
              </Text>
            )
          }
          ListFooterComponent={
            gridLoading && gridItems.length > 0 ? (
              <ActivityIndicator color={colors.primary[500]} style={{ marginVertical: spacing.lg }} />
            ) : null
          }
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['3xl'] }}
        />
      ) : (
        /* ---- EXPLORE / RAILS MODE ---- */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        >
          <LinearGradient colors={[colors.primary[500], colors.primary[700]]} style={styles.hero}>
            <Globe size={28} color="#fff" />
            <Text style={styles.heroTitle}>Explore the world</Text>
            <Text style={styles.heroSub}>10,000+ tours & attractions across 90+ countries</Text>
          </LinearGradient>

          {loadingRails ? (
            <ActivityIndicator color={colors.primary[500]} size="large" style={{ marginTop: spacing['2xl'] }} />
          ) : cityRails.length === 0 ? (
            <Text style={[styles.empty, { color: themeColors.textTertiary }]}>
              Couldn’t load experiences right now.
            </Text>
          ) : (
            cityRails.map((rail: any, idx: number) => {
              const items = rail.items || rail.activities || [];
              if (!items.length) return null;
              return (
                <View key={rail.city || rail.cityCode || idx} style={{ marginTop: spacing.xl }}>
                  <View style={styles.railHeader}>
                    <Text style={[styles.railTitle, { color: themeColors.text }]}>
                      {rail.city}{rail.country ? `, ${rail.country}` : ''}
                    </Text>
                    {!!rail.total && (
                      <Text style={[styles.railCount, { color: colors.primary[600] }]}>
                        {rail.total}+ things to do
                      </Text>
                    )}
                  </View>
                  <FlatList
                    horizontal
                    data={items}
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(it, i) => it._id || String(i)}
                    contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                    renderItem={({ item }) => (
                      <View style={{ width: 180 }}>
                        <GlobalActivityCard activity={item} width={180} />
                      </View>
                    )}
                  />
                </View>
              );
            })
          )}
        </ScrollView>
      )}
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
  hero: {
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  railTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  railCount: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  empty: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing['2xl'], paddingHorizontal: spacing.xl },
});
