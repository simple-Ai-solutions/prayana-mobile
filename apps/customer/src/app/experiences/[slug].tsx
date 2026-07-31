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
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { resolveExperienceSlug, GroupCategory } from '../../lib/experienceCategoryGroups';
import { GlobalActivityCard } from '../../components/experiences/GlobalActivityCard';

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
    [resolved, categoryFilter],
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      >
        {/* Themed hero */}
        <View style={styles.hero}>
          <Image source={{ uri: resolved.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(3,45,54,0.35)', 'rgba(3,45,54,0.55)', 'rgba(3,45,54,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTop}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/activities'))}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backBtn}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>THINGS TO DO</Text>
            <Text style={styles.heroTitle}>{resolved.title}</Text>
            <Text style={styles.heroSub}>{resolved.subtitle}</Text>
          </View>
        </View>

        {/* Sub-category chips (groups only) */}
        {resolved.kind === 'group' && resolved.subCategories && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subRow}
          >
            <SubChip label="All" active={activeSub === ''} onPress={() => setActiveSub('')} />
            {resolved.subCategories.map((c: GroupCategory) => (
              <SubChip
                key={c.value}
                label={c.label}
                active={activeSub === c.value}
                onPress={() => setActiveSub(activeSub === c.value ? '' : c.value)}
              />
            ))}
          </ScrollView>
        )}

        {/* Count */}
        {!loading && (
          <Text style={[styles.count, { color: themeColors.textSecondary }]}>
            {total > 0 ? `${total.toLocaleString('en-IN')} experience${total === 1 ? '' : 's'}` : ''}
          </Text>
        )}

        {/* Results */}
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="search-outline" size={40} color={themeColors.textTertiary} />
            <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
              No {resolved.title.toLowerCase()} found yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {items.map((a, i) => (
                <GlobalActivityCard key={a._id || i} activity={a} />
              ))}
            </View>
            {hasMore && (
              <TouchableOpacity
                onPress={() => !loadingMore && fetchPage(skip, true)}
                disabled={loadingMore}
                style={[styles.loadMore, { borderColor: themeColors.border }]}
                accessibilityRole="button"
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={ORANGE} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: themeColors.text }]}>Show more</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: spacing['2xl'] }} />
      </ScrollView>
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
