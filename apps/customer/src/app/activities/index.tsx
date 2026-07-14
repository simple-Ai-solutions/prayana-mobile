// Things to Do — Prayana's own hosted activities across India.
//
// This screen used to be a STATIC MARKETING PAGE: emoji category tiles and
// feature blurbs, with no API call anywhere in it. It listed no activities at
// all. It is now the real product, matching the PWA's /activities:
//
//   hero -> photo category tiles -> sort -> Top picks -> All experiences
//
// Two data facts worth stating, because they shape what is rendered:
//
//   * These are Prayana's OWN listings (source: "internal"), not Viator or
//     Headout. They carry no provider chip — an "Instant" badge takes its place
//     where the host confirms immediately, which is the fact that matters.
//   * rating.average is 0 on every listing today: these are new and unreviewed.
//     So no stars are drawn. A 5-star card with no reviews behind it is a lie.
//
// Theme: sizes come from the shared tokens (fontSize/fontWeight); no fontFamily
// is set, because the design system's typeface IS the native system stack.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { Experience } from '../../lib/experiences';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_SORTS,
  ActivitySort,
} from '../../lib/activityCategories';
import { ExperienceCard } from '../../components/experiences/ExperienceCard';

const PAGE = 12;

export default function ActivitiesScreen() {
  const { themeColors, isDarkMode } = useTheme();

  const [featured, setFeatured] = useState<Experience[]>([]);
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<ActivitySort>('recommended');
  const [sortOpen, setSortOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The searchable list — category, sort and query all feed this one call. */
  const search = useCallback(
    async (opts: { q: string; cat: string; sortBy: ActivitySort; skip: number; append: boolean }) => {
      setListLoading(true);
      try {
        const res: any = await activityMarketplaceAPI.searchActivities({
          q: opts.q.trim() || undefined,
          category: opts.cat !== 'All' ? opts.cat : undefined,
          sort: opts.sortBy,
          limit: PAGE,
          skip: opts.skip,
        });
        const data: Experience[] = res?.data ?? res?.activities ?? [];
        setItems((prev) => (opts.append ? [...prev, ...data] : data));
        setHasMore(data.length >= PAGE);
        setSkip(opts.skip + data.length);
      } catch {
        if (!opts.append) setItems([]);
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [feat] = await Promise.all([
        activityMarketplaceAPI.getFeaturedActivities(8).catch(() => null),
        search({ q: '', cat: 'All', sortBy: 'recommended', skip: 0, append: false }),
      ]);
      const list: Experience[] = (feat as any)?.data ?? [];
      setFeatured(list);
    } catch {
      setError("Couldn't load activities. Please try again.");
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // Re-run the search whenever the category or sort changes.
  const applyFilters = useCallback(
    (cat: string, sortBy: ActivitySort, q: string) => {
      setCategory(cat);
      setSort(sortBy);
      setSkip(0);
      search({ q, cat, sortBy, skip: 0, append: false });
    },
    [search],
  );

  const onSearchChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSkip(0);
        search({ q: text, cat: category, sortBy: sort, skip: 0, append: false });
      }, 350);
    },
    [search, category, sort],
  );

  const open = useCallback((a: Experience) => {
    router.push(`/activity/${a._id}`);
  }, []);

  const sortLabel = useMemo(
    () => ACTIVITY_SORTS.find((s) => s.value === sort)?.label ?? 'Recommended',
    [sort],
  );

  const filtering = category !== 'All' || !!query.trim();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        {/* ─── HERO ─── */}
        <LinearGradient
          colors={
            isDarkMode
              ? ['#1F1512', themeColors.background]
              : ['#FFF1E7', '#FDE8EF', themeColors.background]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.backBtn, { backgroundColor: themeColors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.eyebrow, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="shield-checkmark" size={13} color={colors.primary[500]} />
            <Text style={[styles.eyebrowText, { color: colors.primary[500] }]}>
              Vetted hosts · Book direct with Prayana
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: themeColors.text }]}>
            Find your next{'\n'}
            <Text style={{ color: colors.primary[500] }}>unforgettable adventure</Text>
          </Text>

          <View style={styles.trust}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#16A34A" />
              <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
                Free cancellation
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="flash-outline" size={13} color="#16A34A" />
              <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
                Instant confirmation
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ─── SEARCH ─── */}
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
          >
            <Ionicons name="search" size={18} color={themeColors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={onSearchChange}
              placeholder="Search a destination or experience"
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.searchInput, { color: themeColors.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── CATEGORY TILES — photos, as on the web. Emoji render as "?" on
             iOS and the design system forbids bundling a font to fix it. ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRail}
        >
          {ACTIVITY_CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => applyFilters(active ? 'All' : c.value, sort, query)}
                style={styles.cat}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={c.label}
              >
                <View
                  style={[
                    styles.catImgWrap,
                    active && { borderColor: colors.primary[500], borderWidth: 2 },
                  ]}
                >
                  <Image source={{ uri: c.img }} style={styles.catImg} resizeMode="cover" />
                </View>
                <Text
                  style={[
                    styles.catLabel,
                    {
                      color: active ? colors.primary[500] : themeColors.textSecondary,
                      fontWeight: active ? fontWeight.bold : fontWeight.medium,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : error ? (
          <View style={styles.state}>
            <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
            <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true);
                loadAll().finally(() => setLoading(false));
              }}
              style={styles.retry}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── TOP PICKS — only when not filtering, as on the web ─── */}
            {!filtering && featured.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Top picks for you
                </Text>
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  Loved by travellers, hand-curated by our team.
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                >
                  {featured.map((a) => (
                    <ExperienceCard key={a._id} experience={a} width={250} onPress={open} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── ALL EXPERIENCES ─── */}
            <View style={styles.section}>
              <View style={styles.listHead}>
                <View style={styles.listHeadText}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    {filtering ? (category !== 'All' ? category : 'Results') : 'All experiences'}
                  </Text>
                  <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                    {listLoading && !items.length
                      ? 'Loading…'
                      : `${items.length} experience${items.length === 1 ? '' : 's'}`}
                  </Text>
                </View>

                <View>
                  <TouchableOpacity
                    onPress={() => setSortOpen((v) => !v)}
                    style={[styles.sortBtn, { borderColor: themeColors.border }]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="swap-vertical" size={14} color={themeColors.textSecondary} />
                    <Text style={[styles.sortBtnText, { color: themeColors.textSecondary }]}>
                      {sortLabel}
                    </Text>
                  </TouchableOpacity>

                  {sortOpen && (
                    <View
                      style={[
                        styles.sortMenu,
                        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                      ]}
                    >
                      {ACTIVITY_SORTS.map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          onPress={() => {
                            setSortOpen(false);
                            applyFilters(category, s.value, query);
                          }}
                          style={styles.sortItem}
                        >
                          <Text
                            style={[
                              styles.sortItemText,
                              {
                                color:
                                  s.value === sort ? colors.primary[500] : themeColors.text,
                              },
                            ]}
                          >
                            {s.label}
                          </Text>
                          {s.value === sort && (
                            <Ionicons name="checkmark" size={15} color={colors.primary[500]} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {listLoading && !items.length ? (
                <View style={styles.state}>
                  <ActivityIndicator color={colors.primary[500]} />
                </View>
              ) : items.length === 0 ? (
                <View style={styles.state}>
                  <Ionicons name="compass-outline" size={40} color={themeColors.textTertiary} />
                  <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
                    {query.trim()
                      ? `Nothing matches “${query.trim()}”.`
                      : `No ${category === 'All' ? '' : `${category} `}experiences yet.`}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.grid}>
                    {items.map((a) => (
                      <View key={a._id} style={styles.gridCell}>
                        <ExperienceCard experience={a} onPress={open} />
                      </View>
                    ))}
                  </View>

                  {hasMore && (
                    <TouchableOpacity
                      onPress={() =>
                        !listLoading &&
                        search({ q: query, cat: category, sortBy: sort, skip, append: true })
                      }
                      disabled={listLoading}
                      style={[styles.loadMore, { borderColor: themeColors.border }]}
                      accessibilityRole="button"
                    >
                      {listLoading ? (
                        <ActivityIndicator size="small" color={colors.primary[500]} />
                      ) : (
                        <Text style={[styles.loadMoreText, { color: themeColors.text }]}>
                          Load more
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Cross-sell to the worldwide catalogue, as the web does. */}
            <TouchableOpacity
              onPress={() => router.push('/global-experiences')}
              style={[
                styles.crossSell,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="earth" size={20} color={colors.primary[500]} />
              <View style={styles.crossSellText}>
                <Text style={[styles.crossSellTitle, { color: themeColors.text }]}>
                  Travelling abroad?
                </Text>
                <Text style={[styles.crossSellSub, { color: themeColors.textSecondary }]}>
                  Browse tours and tickets worldwide, via Viator and Headout.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingBottom: spacing['2xl'] },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'] + spacing.lg,
  },
  heroTop: { flexDirection: 'row', marginBottom: spacing.lg },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: spacing.md,
  },
  eyebrowText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  heroTitle: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.75,
    lineHeight: 36,
  },
  trust: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { fontSize: fontSize.xs },

  searchWrap: { paddingHorizontal: spacing.lg, marginTop: -26 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md + 2, fontSize: fontSize.md },

  catRail: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  cat: { alignItems: 'center', width: 68, gap: 5 },
  catImgWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
  },
  catImg: { width: '100%', height: '100%' },
  catLabel: { fontSize: fontSize.xs, textAlign: 'center' },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sectionSub: { fontSize: fontSize.sm, marginTop: 2 },

  rail: { gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.lg },

  listHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    zIndex: 20,
  },
  listHeadText: { flex: 1 },

  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  sortMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 190,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: 4,
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sortItemText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  gridCell: { width: '47.5%', flexGrow: 1 },

  loadMore: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadMoreText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  crossSell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  crossSellText: { flex: 1 },
  crossSellTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  crossSellSub: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 17 },

  state: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.md },
  stateText: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  retry: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.primary[500],
  },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
