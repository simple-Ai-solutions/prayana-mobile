// Things to Do — Prayana's activity marketplace, redesigned to match the web/PWA
// /activities page (app/activities/page.js + ActivitiesMarketplaceHero).
//
// Web composition, top to bottom:
//   Teal "Tours & experiences" hero (ocean photo) + "Where to?" search + city rail
//   → Top picks (editorial rail) → Trending now → Unmissable experiences
//   (category collections) → Pick up where you left off (recently viewed)
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
import { Experience, isInternal } from '../../lib/experiences';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_SORTS,
  ActivitySort,
} from '../../lib/activityCategories';
import {
  EXPERIENCE_GROUPS,
  CATEGORY_TO_GROUP,
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

const PAGE = 12;
const TEAL = '#4AC0CC';
const RED = '#E61417';
// Vivid turquoise ocean-wave hero photo — same asset the web uses, so the hero's
// teal comes from the water itself.
const HERO_BG = 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80';

const readList = (res: any): Experience[] =>
  Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.activities) ? res.data.activities : [];

export default function ActivitiesScreen() {
  const { themeColors, isDarkMode } = useTheme();

  const [featured, setFeatured] = useState<Experience[]>([]);
  const [trending, setTrending] = useState<Experience[]>([]);
  const [collections, setCollections] = useState<{ group: (typeof EXPERIENCE_GROUPS)[number]; items: Experience[] }[]>([]);
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

  // Build the "Unmissable experiences" collections client-side, exactly as the
  // web does: one wide, rating-sorted page → keep internal listings → bucket each
  // into ONE group by its primary category → groups with ≥2 items, ≤10 each.
  const buildCollections = useCallback((pool: Experience[]) => {
    const internal = pool.filter((a) => isInternal(a) || !(a as any).source);
    const buckets: Experience[][] = EXPERIENCE_GROUPS.map(() => []);
    for (const a of internal) {
      const raw = Array.isArray((a as any).category) ? (a as any).category[0] : (a as any).category;
      const primary = String(raw || '').split(',')[0].trim().toLowerCase();
      const gi = CATEGORY_TO_GROUP[primary];
      if (gi !== undefined && buckets[gi].length < 10) buckets[gi].push(a);
    }
    return EXPERIENCE_GROUPS.map((group, i) => ({ group, items: buckets[i] })).filter(
      (c) => c.items.length >= 2,
    );
  }, []);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [feat, trend, pool, recents] = await Promise.all([
        activityMarketplaceAPI.getFeaturedActivities(10).catch(() => null),
        // No dedicated trending endpoint on mobile — mirror the web's search
        // fallback: placement=trending, rating-sorted.
        activityMarketplaceAPI
          .searchActivities({ placement: 'trending', sort: 'rating', limit: 10 })
          .catch(() => null),
        activityMarketplaceAPI.searchActivities({ limit: 60, sort: 'rating' }).catch(() => null),
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
      setCollections(buildCollections(readList(pool)));
      setRecent(recents);
    } catch {
      setError("Couldn't load activities. Please try again.");
    }
  }, [search, buildCollections]);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
      >
        {/* ─── TEAL OCEAN HERO — "Tours & experiences" (web parity) ─── */}
        <View style={styles.hero}>
          <Image source={{ uri: HERO_BG }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Teal fallback/base + left→right legibility wash + gentle brand unifier */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: TEAL, opacity: 0.0 }]} />
          <LinearGradient
            colors={['rgba(3,45,54,0.62)', 'rgba(3,45,54,0.30)', 'rgba(3,45,54,0.05)', 'transparent']}
            locations={[0, 0.4, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.4 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(28,120,132,0.25)', 'rgba(74,192,204,0.05)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Back button */}
          <View style={styles.heroTop}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>Tours &amp; experiences</Text>
          <Text style={styles.heroSub}>Explore experiences, spas, tours and more</Text>

          {/* "Where to?" search pill — white with a red search button */}
          <View style={styles.searchPill}>
            <Ionicons name="location" size={18} color={TEAL} style={{ marginLeft: 6 }} />
            <TextInput
              value={query}
              onChangeText={onSearchChange}
              placeholder="Where to?"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            <View style={styles.searchBtn}>
              <Ionicons name="search" size={18} color="#FFFFFF" />
            </View>
          </View>

          {/* Curated destination rail */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityRail}
          >
            {HERO_DESTINATIONS.map((d) => (
              <TouchableOpacity
                key={d.label}
                style={styles.cityCard}
                activeOpacity={0.85}
                onPress={() => openDestination(d.param, d.value)}
              >
                <Image source={{ uri: d.image }} style={styles.cityImg} resizeMode="cover" />
                <Text style={styles.cityLabel} numberOfLines={1}>
                  {d.label}
                </Text>
                <Text style={styles.citySub} numberOfLines={1}>
                  Explore experiences
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── CATEGORY TILES (photo tiles; emoji render as "?" on iOS) ─── */}
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
                <View style={[styles.catImgWrap, active && { borderColor: TEAL, borderWidth: 2 }]}>
                  <Image source={{ uri: c.img }} style={styles.catImg} resizeMode="cover" />
                </View>
                <Text
                  style={[
                    styles.catLabel,
                    {
                      color: active ? TEAL : themeColors.textSecondary,
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
            <ActivityIndicator size="large" color={TEAL} />
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
            {/* ─── TOP PICKS (editorial rail) — only when not filtering ─── */}
            {!filtering && featured.length > 0 && (
              <View style={styles.section}>
                <View style={styles.editorPill}>
                  <Ionicons name="flame" size={12} color="#C2410C" />
                  <Text style={styles.editorPillText}>EDITOR&apos;S PICK</Text>
                </View>
                <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: 8 }]}>
                  Top picks for you
                </Text>
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  Hand-picked favourites &amp; traveller-loved experiences, refreshed weekly.
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                >
                  {featured.map((a) => (
                    <FeaturedRailCard key={a._id} experience={a} width={260} onPress={open} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── TRENDING NOW ─── */}
            {!filtering && trending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.trendingHead}>
                  <LinearGradient
                    colors={['#F97316', '#F43F5E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.trendingBadge}
                  >
                    <Ionicons name="flame" size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                      Trending right now
                    </Text>
                    <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                      The experiences travellers can&apos;t stop booking this week.
                    </Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                >
                  {trending.map((a) => (
                    <ExperienceCard key={a._id} experience={a} width={250} onPress={open} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ─── UNMISSABLE EXPERIENCES (category collections) ─── */}
            {!filtering && collections.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Unmissable experiences
                </Text>
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  Hand-picked collections for every kind of trip.
                </Text>

                {collections.map(({ group, items: gItems }) => (
                  <LinearGradient
                    key={group.key}
                    colors={
                      isDarkMode
                        ? [`${group.accent}1F`, `${group.accent}0A`]
                        : [`${group.accent}14`, `${group.accent}05`]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.collectionCard, { borderColor: `${group.accent}2E` }]}
                  >
                    <View style={styles.collectionHead}>
                      <LinearGradient
                        colors={[group.accent, `${group.accent}C0`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.collectionIcon}
                      >
                        <Ionicons name={group.icon as any} size={20} color="#FFFFFF" />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.collectionTitle, { color: themeColors.text }]} numberOfLines={1}>
                          {group.title}
                        </Text>
                        <Text style={[styles.collectionSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                          {group.categories.map((c) => c.label).join(' · ')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.seeAll, { backgroundColor: `${group.accent}26` }]}
                        onPress={() => router.push(`/experiences/${group.slug}` as any)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.seeAllText, { color: group.accent }]}>See all</Text>
                        <Ionicons name="arrow-forward" size={13} color={group.accent} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.collectionRail}
                    >
                      {gItems.map((a) => (
                        <ExperienceCard key={a._id} experience={a} width={230} onPress={open} />
                      ))}
                    </ScrollView>
                  </LinearGradient>
                ))}
              </View>
            )}

            {/* ─── ALL EXPERIENCES (filterable/sortable list) ─── */}
            <View style={[styles.section, { zIndex: 20 }]}>
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
                              { color: s.value === sort ? TEAL : themeColors.text },
                            ]}
                          >
                            {s.label}
                          </Text>
                          {s.value === sort && <Ionicons name="checkmark" size={15} color={TEAL} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {listLoading && !items.length ? (
                <View style={styles.state}>
                  <ActivityIndicator color={TEAL} />
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
                        <ActivityIndicator size="small" color={TEAL} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingBottom: spacing['2xl'] },

  // Hero
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', marginBottom: spacing.lg },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroTitle: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: -0.75,
  },
  heroSub: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: fontWeight.medium },

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    padding: 6,
    marginTop: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: fontSize.md, color: '#111827', paddingVertical: 8 },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED,
    shadowColor: RED,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  cityRail: { gap: spacing.md, paddingTop: spacing.lg, paddingRight: spacing.lg },
  cityCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cityImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F3F4F6' },
  cityLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 8, paddingHorizontal: 2 },
  citySub: { fontSize: 11.5, color: '#6B7280', marginTop: 1, paddingHorizontal: 2 },

  // Category tiles
  catRail: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  cat: { alignItems: 'center', width: 68, gap: 5 },
  catImgWrap: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#e5e5e5' },
  catImg: { width: '100%', height: '100%' },
  catLabel: { fontSize: fontSize.xs, textAlign: 'center' },

  // Sections
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sectionSub: { fontSize: fontSize.sm, marginTop: 2 },
  rail: { gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.lg },

  editorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  editorPillText: { color: '#C2410C', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  trendingHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trendingBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Collections
  collectionCard: {
    marginTop: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },
  collectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingRight: spacing.md },
  collectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  collectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  collectionSub: { fontSize: fontSize.xs, marginTop: 1 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  seeAllText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  collectionRail: { gap: spacing.md, paddingTop: spacing.md, paddingRight: spacing.md },

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
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999, backgroundColor: TEAL },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
