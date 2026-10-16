// /experiences/[slug] — category & group results, the mobile equivalent of the
// web app/experiences/[category] route (CategoryExperiencesView / GroupExperiencesView).
//
// The Things-to-Do landing links here from collection "See all" (group slugs like
// adventure-outdoors) and popular-experience chips (single-category slugs like
// heritage-culture) — but the route DIDN'T EXIST on mobile, so those taps were
// dead. This screen resolves the slug (group first, then category), fetches the
// matching activities from /activities/global, and renders a themed hero +
// sub-category chips (groups) + a results grid with load-more.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { resolveExperienceSlug, GroupCategory } from '../../lib/experienceCategoryGroups';
import { GlobalActivityCard } from '../../components/experiences/GlobalActivityCard';
import { NightlifeView } from '../../components/experiences/NightlifeView';
import { MarketsView } from '../../components/experiences/MarketsView';
import { FoodView } from '../../components/experiences/FoodView';
import { PhotoView } from '../../components/experiences/PhotoView';
import { ToursView } from '../../components/experiences/ToursView';
import { CategorySearchBar, SEARCH_TONES, SearchTone } from '../../components/experiences/CategorySearchBar';
import { ThemedCategoryView, THEMES, themeFor } from '../../components/experiences/ThemedCategoryView';

const ORANGE = '#F97316';
const PAGE = 24;

export default function ExperienceCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { themeColors } = useTheme();

  const resolved = useMemo(() => (slug ? resolveExperienceSlug(String(slug)) : null), [slug]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Groups can narrow to one sub-category in place; '' = all in the group.
  const [activeSub, setActiveSub] = useState<string>('');
  // One search box on every category page; searched on the server after a
  // short pause in typing.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const categoryFilter = useMemo(() => {
    if (!resolved) return undefined;
    return activeSub || resolved.categoryFilter;
  }, [resolved, activeSub]);

  const fetchPage = useCallback(
    async (nextSkip: number, append: boolean) => {
      if (!resolved) return;
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res: any = await activityMarketplaceAPI.getGlobalActivities({
          category: categoryFilter,
          q: query || undefined,
          limit: PAGE,
          skip: nextSkip,
        });
        const data: any[] = res?.data || res?.activities || [];
        setItems((prev) => (append ? [...prev, ...data] : data));
        setTotal(Number(res?.total ?? data.length));
        setHasMore(data.length >= PAGE);
        setSkip(nextSkip + data.length);
      } catch {
        if (!append) setItems([]);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [resolved, categoryFilter, query],
  );

  useEffect(() => {
    setSkip(0);
    fetchPage(0, false);
  }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(0, false);
    setRefreshing(false);
  }, [fetchPage]);

  if (!resolved) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Ionicons name="compass-outline" size={44} color={themeColors.textTertiary} />
          <Text style={[styles.notFoundText, { color: themeColors.textSecondary }]}>
            That category isn&apos;t available.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/activities')} style={styles.retry}>
            <Text style={styles.retryText}>Browse Things to Do</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const placeholder = `Search ${resolved.title.toLowerCase()} — city, place or name`;

  // Nightlife gets its own after-dark layout (District-style), always dark.
  if (resolved.categoryFilter === 'Nightlife' && resolved.kind !== 'group') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#07060C' }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <CategorySearchBar value={search} onChange={setSearch} placeholder={placeholder} tone={SEARCH_TONES.dark} busy={loading && !!query} />
        <NightlifeView
          items={items}
          total={total}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => !loadingMore && fetchPage(skip, true)}
          image={resolved.image}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2E88" />}
        />
      </SafeAreaView>
    );
  }

  // Tours gets a guided-tour marketplace layout.
  if (resolved.categoryFilter === 'City Tours' && resolved.kind !== 'group') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <CategorySearchBar value={search} onChange={setSearch} placeholder={placeholder} tone={SEARCH_TONES.tours} busy={loading && !!query} />
        <ToursView
          items={items}
          total={total}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => !loadingMore && fetchPage(skip, true)}
          image={resolved.image}
          title={resolved.title}
          subtitle={resolved.subtitle}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/activities'))}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f766e" />}
        />
      </SafeAreaView>
    );
  }

  // Photo Tours gets a photographer's-gallery layout.
  if (resolved.categoryFilter === 'Photography' && resolved.kind !== 'group') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#FAFAF7' }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <CategorySearchBar value={search} onChange={setSearch} placeholder={placeholder} tone={SEARCH_TONES.photo} busy={loading && !!query} />
        <PhotoView
          items={items}
          total={total}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => !loadingMore && fetchPage(skip, true)}
          image={resolved.image}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111111" />}
        />
      </SafeAreaView>
    );
  }

  // Food & Dining gets its own menu-style layout.
  if (resolved.categoryFilter === 'Food & Dining' && resolved.kind !== 'group') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#FFFAF3' }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <CategorySearchBar value={search} onChange={setSearch} placeholder={placeholder} tone={SEARCH_TONES.food} busy={loading && !!query} />
        <FoodView
          items={items}
          total={total}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => !loadingMore && fetchPage(skip, true)}
          image={resolved.image}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EF3B2D" />}
        />
      </SafeAreaView>
    );
  }

  // Markets & Shopping gets its own bazaar layout.
  if (resolved.categoryFilter === 'Shopping' && resolved.kind !== 'group') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8EE' }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <CategorySearchBar value={search} onChange={setSearch} placeholder={placeholder} tone={SEARCH_TONES.markets} busy={loading && !!query} />
        <MarketsView
          items={items}
          total={total}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => !loadingMore && fetchPage(skip, true)}
          image={resolved.image}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E2462B" />}
        />
      </SafeAreaView>
    );
  }

  // Every other category and group page: a themed layout of its own.
  const themeKey = themeFor(resolved.categoryFilter, resolved.kind);
  const th = THEMES[themeKey];
  const tone: SearchTone = th.dark
    ? SEARCH_TONES.dark
    : { bg: th.bg, field: th.surface, text: th.ink, muted: th.muted, tint: th.accent, border: th.line };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: th.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {th.dark ? <StatusBar style="light" /> : <StatusBar style="dark" />}
      <CategorySearchBar value={search} onChange={setSearch} placeholder={placeholder} tone={tone} busy={loading && !!query} />
      <ThemedCategoryView
        theme={themeKey}
        items={items}
        total={total}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => !loadingMore && fetchPage(skip, true)}
        image={resolved.image}
        title={resolved.title}
        subtitle={resolved.subtitle}
        query={query}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/activities'))}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={th.accent} />}
        subChips={
          resolved.kind === 'group' && resolved.subCategories
            ? [
                { label: 'All', value: '', active: activeSub === '', onPress: () => setActiveSub('') },
                ...resolved.subCategories.map((c: GroupCategory) => ({
                  label: c.label,
                  value: c.value,
                  active: activeSub === c.value,
                  onPress: () => setActiveSub(activeSub === c.value ? '' : c.value),
                })),
              ]
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const SubChip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => {
  const { themeColors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.subChip,
        active
          ? { backgroundColor: ORANGE, borderColor: ORANGE }
          : { backgroundColor: themeColors.surface, borderColor: themeColors.border },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.subChipText, { color: active ? '#FFFFFF' : themeColors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },

  hero: { height: 220, justifyContent: 'flex-end', backgroundColor: '#1f2937' },
  heroTop: { position: 'absolute', top: spacing.md, left: spacing.lg },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroBody: { padding: spacing.lg },
  heroEyebrow: { color: '#FDBA74', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: '#FFFFFF', fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, letterSpacing: -0.6, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: fontSize.sm, marginTop: 4, lineHeight: 19 },

  subRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, alignItems: 'center' },
  subChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  subChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  count: { fontSize: fontSize.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },

  loadMore: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadMoreText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  state: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.md },
  stateText: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  notFoundText: { fontSize: fontSize.md, textAlign: 'center' },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999, backgroundColor: ORANGE },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
