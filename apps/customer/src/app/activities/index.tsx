// Things to Do — Prayana's activity marketplace, redesigned to match the web/PWA
// /activities page (app/activities/page.js + ActivitiesMarketplaceHero).
//
// Web composition, top to bottom:
//   Teal "Tours & experiences" hero (ocean photo) + "Where to?" search + city rail
//   → Top picks (spotlight) → Trending now (dark band) → All experiences
//   → Pick up where you left off (recently viewed)
//   → Explore more (numbered browse chips) → worldwide cross-sell.
//
// The category tiles + sortable "All experiences" list from the previous mobile
// build are kept — they are the real browse/filter product and have no direct web
// equivalent on this page, so they sit between the hero and Top picks.
//
// Data facts that shape the UI:
//   * Listings are Prayana's OWN (source: "internal") — no provider chip; an
//     "Instant" badge stands in where the host confirms immediately.
//   * rating.average is 0 on new/unreviewed listings, so no stars are drawn there.
// Theme: sizes from shared tokens; no fontFamily (the design system's face is the
// native system stack). Teal #4AC0CC is primary; red #E61417 is the search action.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { goBack } from '../../lib/goBack';
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
import {
  POPULAR_EXPERIENCES,
  TRENDING_DESTINATIONS,
  HERO_DESTINATIONS,
} from '../../lib/experienceCategoryGroups';
import {
  getRecentlyViewed,
  clearRecentlyViewed,
  timeAgo,
  RecentActivity,
} from '../../lib/recentlyViewedActivities';
import { ExperienceCard } from '../../components/experiences/ExperienceCard';
import { FeaturedRailCard } from '../../components/experiences/FeaturedRailCard';
import { SpotlightCarousel } from '../../components/home/SpotlightCarousel';
import {
  ACCENT, PlaceCard, PosterCard, SectionLabel, VibeTile,
} from '../../components/experiences/ThingsToDoUI';

const PAGE = 12;
// Top picks spotlight: one card large in the centre, neighbours peeking.
const SCREEN_W = Dimensions.get('window').width;
const SPOT_W = Math.round(SCREEN_W * 0.74);
const TREND_W = Math.round(SCREEN_W * 0.46);
const PLACE_W = Math.round(SCREEN_W * 0.34);
// One row of photo tiles: three across with the fourth peeking.
const VIBE_W = Math.floor((SCREEN_W - 16 - 10 * 3) / 3.35);
const TEAL = '#4AC0CC';

const readList = (res: any): Experience[] =>
  Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.activities) ? res.data.activities : [];

export default function ActivitiesScreen() {
  const { themeColors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [featured, setFeatured] = useState<Experience[]>([]);
  const [trending, setTrending] = useState<Experience[]>([]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);

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
  // The "All experiences" chip bar pins to the top once the grid is reached.
  const [gridTop, setGridTop] = useState<number | null>(null);
  const [pinChips, setPinChips] = useState(false);
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
        // Same envelope the featured/trending/collection calls use — the API
        // may return either `{data:[…]}` or `{data:{activities:[…]}}`. Reading
        // `res.data` blindly would hand the list an object (not an array) and
        // silently blank the grid, so normalise through readList.
        const data: Experience[] = readList(res).length
          ? readList(res)
          : Array.isArray(res?.activities)
            ? res.activities
            : [];
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
      const [feat, trend, recents] = await Promise.all([
        activityMarketplaceAPI.getFeaturedActivities(10).catch(() => null),
        // No dedicated trending endpoint on mobile — mirror the web's search
        // fallback: placement=trending, rating-sorted.
        activityMarketplaceAPI
          .searchActivities({ placement: 'trending', sort: 'rating', limit: 10 })
          .catch(() => null),
        getRecentlyViewed(),
        search({ q: '', cat: 'All', sortBy: 'recommended', skip: 0, append: false }),
      ]);
      // De-dupe featured across Prayana rows (same title+city or external id).
      const featList = readList(feat);
      const seen = new Set<string>();
      const dedupedFeatured = featList.filter((a) => {
        const key =
          (a as any).externalId ||
          `${(a.title || '').trim().toLowerCase()}|${(a.location?.city || '').trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setFeatured(dedupedFeatured.slice(0, 10));
      setTrending(readList(trend).slice(0, 10));
      setRecent(recents);
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
    // Diagnostic: reports whether the tap reaches here and what id it carries.
    console.log('[ThingsToDo] card tapped ->', a?._id, a?.title);
    if (!a?._id) return;
    router.push(`/activity/${a._id}`);
  }, []);

  const openRecent = useCallback((id: string) => {
    router.push(`/activity/${id}`);
  }, []);

  // Deep-link a curated hero destination / trending city into global-experiences.
  const openDestination = useCallback((param: 'country' | 'city' | 'q', value: string) => {
    router.push(`/global-experiences?${param}=${encodeURIComponent(value)}` as any);
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
        scrollEventThrottle={32}
        onScroll={(e: any) => {
          const y = e.nativeEvent.contentOffset.y;
          const pin = gridTop != null && y > gridTop;
          if (pin !== pinChips) setPinChips(pin);
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
      >
        {/* ─── GLOW HEADER (District-style) ─── */}
        <LinearGradient
          colors={isDarkMode
            ? ['rgba(255,90,95,0.38)', 'rgba(168,85,247,0.16)', 'rgba(11,11,16,0)']
            : ['rgba(255,90,95,0.22)', 'rgba(168,85,247,0.08)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          style={styles.glow}
          pointerEvents="none"
        />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.roundBtn, { borderColor: themeColors.border, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)' }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={themeColors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Things to do</Text>
            <Text style={[styles.headerSub, { color: themeColors.textSecondary }]}>Tours, treks &amp; experiences</Text>
          </View>
        </View>

        <Text style={[styles.bigLine, { color: themeColors.text }]}>
          Plans worth{'\n'}<Text style={{ color: ACCENT }}>leaving the house</Text> for.
        </Text>

        <View style={[styles.searchPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : '#FFFFFF', borderColor: themeColors.border }]}>
          <Ionicons name="search" size={18} color={themeColors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={onSearchChange}
            placeholder="Search treks, tours, cities…"
            placeholderTextColor={themeColors.textTertiary}
            style={[styles.searchInput, { color: themeColors.text }]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => onSearchChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── WHAT'S THE VIBE? (category tiles, two rows) ─── */}
        <View style={styles.block}>
          <SectionLabel label="What's the vibe?" style={styles.padded} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeRail}>
            {ACTIVITY_CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <VibeTile
                  key={c.value}
                  label={c.label === 'All' ? 'Everything' : c.label}
                  image={c.img}
                  active={active}
                  width={VIBE_W}
                  onPress={() => applyFilters(active ? 'All' : c.value, sort, query)}
                />
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={ACCENT} />
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
            {/* ─── IN THE LIMELIGHT (spotlight of big posters) ─── */}
            {!filtering && featured.length > 0 && (
              <View style={styles.block}>
                <SectionLabel label="In the limelight" style={styles.padded} />
                <SpotlightCarousel
                  data={featured}
                  keyExtractor={(a) => String(a._id)}
                  itemWidth={SPOT_W}
                  accent={ACCENT}
                  renderItem={(a, _i, width) => (
                    <PosterCard experience={a} width={width} size="lg" onPress={open} />
                  )}
                />
              </View>
            )}

            {/* ─── TRENDING THIS WEEK (numbered chart) ─── */}
            {!filtering && trending.length > 0 && (
              <View style={styles.block}>
                <SectionLabel label="Trending this week" style={styles.padded} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railPad}>
                  {trending.map((a) => (
                    <PosterCard key={a._id} experience={a} width={TREND_W} onPress={open} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── WHERE TO NEXT (destinations) ─── */}
            {!filtering && (
              <View style={styles.block}>
                <SectionLabel label="Where to next" style={styles.padded} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railPad}>
                  {HERO_DESTINATIONS.map((d) => (
                    <PlaceCard
                      key={d.label}
                      label={d.label}
                      image={d.image}
                      width={PLACE_W}
                      onPress={() => openDestination(d.param, d.value)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── ALL EXPERIENCES (filterable/sortable list) ─── */}
            <View
              style={[styles.section, { zIndex: 20 }]}
              onLayout={(e) => setGridTop(e.nativeEvent.layout.y + 60)}
            >
              <SectionLabel label={filtering ? (category !== 'All' ? category : 'Results') : 'All experiences'} />
              <View style={styles.listHead}>
                <View style={styles.listHeadText}>
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
                              { color: s.value === sort ? ACCENT : themeColors.text },
                            ]}
                          >
                            {s.label}
                          </Text>
                          {s.value === sort && <Ionicons name="checkmark" size={15} color={ACCENT} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {listLoading && !items.length ? (
                <View style={styles.state}>
                  <ActivityIndicator color={ACCENT} />
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
                        <PosterCard experience={a} onPress={open} />
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
                        <ActivityIndicator size="small" color={ACCENT} />
                      ) : (
                        <Text style={[styles.loadMoreText, { color: themeColors.text }]}>Load more</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* ─── PICK UP WHERE YOU LEFT OFF (recently viewed) ─── */}
            {!filtering && recent.length >= 2 && (
              <View style={styles.section}>
                <View style={styles.listHead}>
                  <View style={styles.listHeadText}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                      Pick up where you left off
                    </Text>
                    <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                      Activities you recently viewed — jump right back in.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      await clearRecentlyViewed();
                      setRecent([]);
                    }}
                    style={styles.clearBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Clear history"
                  >
                    <Ionicons name="trash-outline" size={14} color="#E11D48" />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                >
                  {recent.map((r) => {
                    const price = r.sellingPrice || r.price || 0;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.recentCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                        activeOpacity={0.9}
                        onPress={() => openRecent(r.id)}
                      >
                        <View style={styles.recentImgWrap}>
                          {r.image ? (
                            <Image source={{ uri: r.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FED7AA', alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="map-outline" size={26} color="#EA580C" />
                            </View>
                          )}
                          {!!r.duration && (
                            <View style={styles.recentDuration}>
                              <Ionicons name="time-outline" size={10} color="#111827" />
                              <Text style={styles.recentDurationText}>{r.duration}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.recentBody}>
                          <Text style={[styles.recentTitle, { color: themeColors.text }]} numberOfLines={1}>
                            {r.title}
                          </Text>
                          {!!r.city && (
                            <View style={styles.recentMeta}>
                              <Ionicons name="location" size={11} color={TEAL} />
                              <Text style={[styles.recentMetaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                {r.city}
                                {r.country && r.country !== r.city ? `, ${r.country}` : ''}
                              </Text>
                            </View>
                          )}
                          {price > 0 && (
                            <Text style={[styles.recentPrice, { color: themeColors.text }]}>
                              ₹{price.toLocaleString('en-IN')}
                            </Text>
                          )}
                          <Text style={styles.recentViewed}>Viewed {timeAgo(r.viewedAt)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ─── EXPLORE MORE (numbered browse chips) ─── */}
            {!filtering && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Explore more</Text>

                <Text style={[styles.chipGroupTitle, { color: themeColors.text }]}>Popular experiences</Text>
                <View style={styles.chipWrap}>
                  {POPULAR_EXPERIENCES.map((e, i) => (
                    <TouchableOpacity
                      key={e.slug}
                      style={[styles.chip, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                      onPress={() => router.push(`/experiences/${e.slug}` as any)}
                      accessibilityRole="button"
                    >
                      <View style={styles.chipNum}>
                        <Text style={styles.chipNumText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.chipLabel, { color: themeColors.text }]} numberOfLines={1}>
                        {e.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.chipGroupTitle, { color: themeColors.text }]}>Trending destinations</Text>
                <View style={styles.chipWrap}>
                  {TRENDING_DESTINATIONS.map((d, i) => (
                    <TouchableOpacity
                      key={d.city}
                      style={[styles.chip, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                      onPress={() => openDestination(d.param, d.city)}
                      accessibilityRole="button"
                    >
                      <View style={styles.chipNum}>
                        <Text style={styles.chipNumText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.chipLabel, { color: themeColors.text }]} numberOfLines={1}>
                        {d.city} Activities
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Cross-sell to the worldwide catalogue, as the web does. */}
            <TouchableOpacity
              onPress={() => router.push('/global-experiences')}
              style={[styles.crossSell, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              accessibilityRole="button"
            >
              <Ionicons name="earth" size={20} color={TEAL} />
              <View style={styles.crossSellText}>
                <Text style={[styles.crossSellTitle, { color: themeColors.text }]}>Travelling abroad?</Text>
                <Text style={[styles.crossSellSub, { color: themeColors.textSecondary }]}>
                  Browse tours and tickets worldwide, via Viator and Headout.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      {/* Pinned filter chips: appear once the user scrolls into the grid, so
          the category can change without scrolling back up (Myntra/Swiggy). */}
      {pinChips && !loading && (
        <View
          style={[
            styles.pinBar,
            {
              // Absolute children ignore the SafeAreaView's padding — sit below
              // the status bar ourselves.
              paddingTop: insets.top + 8,
              backgroundColor: themeColors.background,
              borderBottomColor: themeColors.border,
            },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinRail}>
            {ACTIVITY_CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => applyFilters(active ? 'All' : c.value, sort, query)}
                  style={[
                    styles.pinChip,
                    active
                      ? { backgroundColor: ACCENT, borderColor: ACCENT }
                      : { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.pinChipText, { color: active ? '#FFFFFF' : themeColors.text }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // District-style header: a soft coral→violet glow behind the top of the page.
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 420 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  bigLine: {
    paddingHorizontal: spacing.lg, marginTop: 22, fontSize: 32, lineHeight: 36,
    fontWeight: '900', letterSpacing: -1.2,
  },
  block: { marginTop: 30 },
  padded: { paddingHorizontal: spacing.lg },
  railPad: { gap: 12, paddingHorizontal: spacing.lg },
  vibeRail: { gap: 10, paddingHorizontal: spacing.lg },
  safe: { flex: 1 },
  body: { paddingBottom: spacing['2xl'] },

  // Hero

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: fontSize.md, color: '#111827', paddingVertical: 8 },


  // Category tiles

  // Sections
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sectionSub: { fontSize: fontSize.sm, marginTop: 2 },
  rail: { gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.lg },

  // Trending: full-bleed dark band (Netflix/Spotify feel) to break the page.

  // All experiences: chips pinned under the status bar while in the grid.
  pinBar: {
    position: 'absolute', left: 0, right: 0, top: 0,
    borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  pinRail: { gap: 8, paddingHorizontal: spacing.lg },
  pinChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pinChipText: { fontSize: 13, fontWeight: '600' },



  // List head + sort
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

  // Recently viewed
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(225,29,72,0.08)',
  },
  clearBtnText: { color: '#E11D48', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  recentCard: { width: 220, borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  recentImgWrap: { width: '100%', aspectRatio: 5 / 4, backgroundColor: '#F3F4F6' },
  recentDuration: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  recentDurationText: { fontSize: 10, fontWeight: '700', color: '#111827' },
  recentBody: { padding: spacing.md, gap: 3 },
  recentTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recentMetaText: { fontSize: fontSize.xs, flexShrink: 1 },
  recentPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 2 },
  recentViewed: { fontSize: 11, color: '#E11D48', marginTop: 2, fontWeight: fontWeight.medium },

  // Explore-more chips
  chipGroupTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  chipNum: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,192,204,0.12)',
  },
  chipNumText: { fontSize: 12, fontWeight: '800', color: '#2AA7B4' },
  chipLabel: { fontSize: 13.5, fontWeight: fontWeight.medium },

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
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999, backgroundColor: ACCENT },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
