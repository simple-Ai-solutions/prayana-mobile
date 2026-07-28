// Explore World — tours, tickets & experiences from Viator and Headout.
//
// Full parity with the PWA's /global-experiences. Two mutually-exclusive body
// states (web: isFiltered):
//
//   • EXPLORE (default): hero → Top experiences by country (accordion) →
//     "Every wonder. One booking." destination tiles → per-city rails
//     ("What travellers can't stop booking") → India magazine hero.
//   • FILTERED (a place/search/category is active): hero (filtered title) →
//     TypeTabs (All / Tours / Attraction tickets) → results header (count +
//     Sort) → Filters drawer → results grid.
//
// Accent system is the web's orange → rose → fuchsia (this is the worldwide
// Viator/Headout surface, distinct from the teal Things-to-Do marketplace). The
// logo TEAL (#4AC0CC) still marks the Prayana-AI provider chip inside cards.
//
// Everything shown is real: counts, prices and ratings come from
// GET /activities/global(/by-city). No invented "Bestseller" ribbons.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import { ScrollView, TouchableOpacity, Pressable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import {
  useTheme,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import {
  CityGroup,
  CountryGroup,
  Experience,
  affiliateUrl,
  groupByCountry,
} from '../../lib/experiences';
import {
  SEARCH_HINTS,
  POPULAR_ATTRACTIONS,
  TYPE_TABS,
  CATEGORY_FILTERS,
  GLOBAL_SORTS,
} from '../../lib/globalExperiencesData';
import { ExperienceCard } from '../../components/experiences/ExperienceCard';
import { CountryExperiences } from '../../components/experiences/CountryExperiences';
import { DestinationTile } from '../../components/experiences/DestinationTile';
import { CityRail } from '../../components/experiences/CityRail';
import { IndiaMagazineHero } from '../../components/experiences/IndiaMagazineHero';

const ORANGE = '#F97316';
const ROSE = '#E11D48';
const PAGE = 24;

// A "selection" that flips the page into filtered mode.
interface Selection {
  city?: string;
  country?: string;
  label: string; // hero title suffix
}

export default function GlobalExperiencesScreen() {
  const { themeColors, isDarkMode } = useTheme();
  // Inbound cross-links (Things-to-Do city cards, hero rail) deep-link with
  // ?country=/?city=/?q= — the web does the same. These seed the filtered view.
  const params = useLocalSearchParams<{ country?: string; city?: string; q?: string }>();

  const [cities, setCities] = useState<CityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Explore-view accordion (Top experiences by country).
  const [openCountry, setOpenCountry] = useState<string | null>(null);

  // ── Filtered view state ────────────────────────────────────────────────────
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState('');
  const [typeTab, setTypeTab] = useState('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recommended');
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [results, setResults] = useState<Experience[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsSkip, setResultsSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotating search-pill placeholder (web SEARCH_HINTS).
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHintIdx((i) => (i + 1) % SEARCH_HINTS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const isFiltered = Boolean(selection || query.trim() || category);

  const load = useCallback(async () => {
    setError('');
    try {
      const res: any = await activityMarketplaceAPI.getGlobalByCity({ cities: 30, perCity: 20 });
      const list: CityGroup[] = Array.isArray(res?.data) ? res.data : [];
      setCities(list);
      if (!list.length) setError('No experiences available right now.');
    } catch {
      setCities([]);
      setError("Couldn't load experiences. Please try again.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const countryGroups = useMemo(() => groupByCountry(cities), [cities]);

  useEffect(() => {
    setOpenCountry((cur) => cur ?? countryGroups[0]?.country ?? null);
  }, [countryGroups]);

  const toggleCountry = useCallback((c: string) => {
    setOpenCountry((cur) => (cur === c ? null : c));
  }, []);

  // ── Filtered-view fetch ─────────────────────────────────────────────────────
  const fetchResults = useCallback(
    async (opts: { sel: Selection | null; q: string; cat: string; sortBy: string; skip: number; append: boolean }) => {
      setResultsLoading(true);
      try {
        const res: any = await activityMarketplaceAPI.getGlobalActivities({
          city: opts.sel?.city,
          country: opts.sel?.city ? undefined : opts.sel?.country,
          q: opts.q.trim() || undefined,
          category: opts.cat || undefined,
          limit: PAGE,
          skip: opts.skip,
        });
        const data: Experience[] = res?.data || res?.activities || [];
        setResults((prev) => (opts.append ? [...prev, ...data] : data));
        setResultsTotal(Number(res?.total ?? data.length));
        setHasMore(data.length >= PAGE);
        setResultsSkip(opts.skip + data.length);
      } catch {
        if (!opts.append) setResults([]);
      } finally {
        setResultsLoading(false);
      }
    },
    [],
  );

  // Re-run whenever a filter dimension changes while in filtered mode.
  const applyFilter = useCallback(
    (next: { sel?: Selection | null; q?: string; cat?: string; sortBy?: string }) => {
      const sel = next.sel !== undefined ? next.sel : selection;
      const q = next.q !== undefined ? next.q : query;
      const cat = next.cat !== undefined ? next.cat : category;
      const sortBy = next.sortBy !== undefined ? next.sortBy : sort;
      if (next.sel !== undefined) setSelection(next.sel);
      if (next.q !== undefined) setQuery(next.q);
      if (next.cat !== undefined) setCategory(next.cat);
      if (next.sortBy !== undefined) setSort(next.sortBy);
      setResultsSkip(0);
      fetchResults({ sel, q, cat, sortBy, skip: 0, append: false });
    },
    [selection, query, category, sort, fetchResults],
  );

  const onSearchChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim() && !selection && !category) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(() => {
        setResultsSkip(0);
        fetchResults({ sel: selection, q: text, cat: category, sortBy: sort, skip: 0, append: false });
      }, 350);
    },
    [fetchResults, selection, category, sort],
  );

  // A tab maps to the first category in its group (or clears it for "All").
  const onTypeTab = useCallback(
    (key: string) => {
      setTypeTab(key);
      const tab = TYPE_TABS.find((t) => t.key === key);
      const cat = tab?.categories[0] || '';
      applyFilter({ cat });
    },
    [applyFilter],
  );

  const pickCity = useCallback(
    (g: CityGroup) => {
      const sel: Selection = { city: g.city, country: g.country || undefined, label: g.city };
      setTypeTab('all');
      setCategory('');
      applyFilter({ sel, q: '', cat: '' });
    },
    [applyFilter],
  );

  const pickCountry = useCallback(
    (g: CountryGroup) => {
      const sel: Selection = { country: g.country, label: g.country };
      setTypeTab('all');
      setCategory('');
      applyFilter({ sel, q: '', cat: '' });
    },
    [applyFilter],
  );

  const clearFilter = useCallback(() => {
    setSelection(null);
    setQuery('');
    setCategory('');
    setTypeTab('all');
    setResults([]);
    setResultsTotal(0);
  }, []);

  const openExperience = useCallback((e: Experience) => {
    const url = affiliateUrl(e);
    if (url) {
      Linking.openURL(url).catch(() => {
        Toast.show({ type: 'error', text1: "Couldn't open the booking page" });
      });
      return;
    }
    router.push(`/activity/${e._id}`);
  }, []);

  // Apply an inbound deep-link filter exactly once on mount (?country/?city/?q).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const city = typeof params.city === 'string' ? params.city : undefined;
    const cCode = typeof params.country === 'string' ? params.country : undefined;
    const q = typeof params.q === 'string' ? params.q : undefined;
    if (!city && !cCode && !q) return;
    seededRef.current = true;
    if (city || cCode) {
      const sel: Selection = { city, country: cCode, label: city || cCode || '' };
      setSelection(sel);
      fetchResults({ sel, q: q ?? '', cat: '', sortBy: 'recommended', skip: 0, append: false });
    } else if (q) {
      setQuery(q);
      fetchResults({ sel: null, q, cat: '', sortBy: 'recommended', skip: 0, append: false });
    }
  }, [params.city, params.country, params.q, fetchResults]);

  // Destination tiles: web drops India cities from this rail and pins Cape Town
  // last. We keep it simple: all cities, biggest first (by-city order).
  const tileCities = cities;
  // Per-city rails: up to 10 with items.
  const railCities = cities.filter((c) => c.items?.length).slice(0, 10);

  const heroTitle = isFiltered
    ? query.trim()
      ? `Search: “${query.trim()}”`
      : selection
        ? `Things to do in ${selection.label}`
        : 'Search results'
    : 'Tours, tickets & experiences';

  const sortLabel = GLOBAL_SORTS.find((s) => s.value === sort)?.label ?? 'Recommended';
  const activeFilterCount = (category ? 1 : 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
        }
      >
        {/* ─── HERO — blush bloom wash, dark type; "experiences" carries orange ─── */}
        <LinearGradient
          colors={
            isDarkMode
              ? ['#1F1512', themeColors.background]
              : ['#FDF2EC', '#FCE9F0', themeColors.background]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <TouchableOpacity
              onPress={() => (isFiltered ? clearFilter() : router.back())}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.backBtn, { backgroundColor: themeColors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={isFiltered ? 'Back to browse' : 'Go back'}
            >
              <Ionicons name="chevron-back" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {!isFiltered && (
            <View style={[styles.eyebrow, { backgroundColor: themeColors.surface }]}>
              <Ionicons name="globe-outline" size={13} color={ORANGE} />
              <Text style={[styles.eyebrowText, { color: ROSE }]}>
                Worldwide tours · Viator &amp; Headout
              </Text>
            </View>
          )}

          {isFiltered ? (
            <Text style={[styles.heroTitle, { color: themeColors.text }]} numberOfLines={2}>
              {heroTitle}
            </Text>
          ) : (
            <Text style={[styles.heroTitle, { color: themeColors.text }]}>
              Tours, tickets &amp;{'\n'}
              <Text style={{ color: ORANGE }}>experiences</Text>
            </Text>
          )}

          <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
            {isFiltered
              ? 'Skip-the-line entry and guided tours.'
              : 'Skip-the-line tickets, expert-led tours and bucket-list moments — hand-picked across 90+ countries.'}
          </Text>

          {!isFiltered && (
            <View style={styles.trust}>
              <View style={styles.trustItem}>
                <Ionicons name="shield-checkmark-outline" size={13} color="#16A34A" />
                <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
                  Instant confirmation
                </Text>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="phone-portrait-outline" size={13} color="#16A34A" />
                <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
                  Mobile tickets
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* ─── SEARCH (floats over hero edge) — orange search button ─── */}
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
          >
            <Ionicons name="search" size={18} color={themeColors.textTertiary} style={{ marginLeft: 4 }} />
            <TextInput
              value={query}
              onChangeText={onSearchChange}
              placeholder={SEARCH_HINTS[hintIdx]}
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.searchInput, { color: themeColors.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            ) : (
              <LinearGradient colors={[ORANGE, '#E11D48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.searchBtn}>
                <Ionicons name="search" size={16} color="#FFFFFF" />
              </LinearGradient>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        ) : error ? (
          <View style={styles.state}>
            <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
            <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true);
                load().finally(() => setLoading(false));
              }}
              style={styles.retry}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : isFiltered ? (
          /* ════════════════ FILTERED VIEW ════════════════ */
          <>
            {/* TypeTabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeTabs}
            >
              {TYPE_TABS.map((t) => {
                const active = typeTab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => onTypeTab(t.key)}
                    style={[
                      styles.typeTab,
                      active
                        ? { backgroundColor: ORANGE, borderColor: ORANGE }
                        : { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.typeTabText, { color: active ? '#FFFFFF' : themeColors.text }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Results header — count + Filters + Sort */}
            <View style={styles.resultsHead}>
              <Text style={[styles.resultsCount, { color: themeColors.text }]}>
                {resultsLoading && !results.length
                  ? 'Searching…'
                  : `${resultsTotal.toLocaleString('en-IN')} result${resultsTotal === 1 ? '' : 's'} found`}
              </Text>
              <View style={styles.resultsActions}>
                <TouchableOpacity
                  onPress={() => setFiltersOpen(true)}
                  style={[styles.filterBtn, { borderColor: themeColors.border }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="options-outline" size={15} color={themeColors.textSecondary} />
                  <Text style={[styles.filterBtnText, { color: themeColors.textSecondary }]}>Filters</Text>
                  {activeFilterCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View>
                  <TouchableOpacity
                    onPress={() => setSortOpen((v) => !v)}
                    style={[styles.filterBtn, { borderColor: themeColors.border }]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="swap-vertical" size={15} color={themeColors.textSecondary} />
                    <Text style={[styles.filterBtnText, { color: themeColors.textSecondary }]}>{sortLabel}</Text>
                  </TouchableOpacity>
                  {sortOpen && (
                    <View style={[styles.sortMenu, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                      {GLOBAL_SORTS.map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          onPress={() => {
                            setSortOpen(false);
                            applyFilter({ sortBy: s.value });
                          }}
                          style={styles.sortItem}
                        >
                          <Text style={[styles.sortItemText, { color: s.value === sort ? ORANGE : themeColors.text }]}>
                            {s.label}
                          </Text>
                          {s.value === sort && <Ionicons name="checkmark" size={15} color={ORANGE} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Results grid */}
            {resultsLoading && !results.length ? (
              <View style={styles.state}>
                <ActivityIndicator size="large" color={ORANGE} />
              </View>
            ) : results.length === 0 ? (
              <View style={styles.state}>
                <Ionicons name="search-outline" size={40} color={themeColors.textTertiary} />
                <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
                  {query.trim() ? `Nothing matches “${query.trim()}”.` : 'No experiences here yet.'}
                </Text>
                {category !== '' && (
                  <TouchableOpacity onPress={() => applyFilter({ cat: '' })} style={styles.retry}>
                    <Text style={styles.retryText}>Clear category</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.grid}>
                  {results.map((e) => (
                    <View key={e._id} style={styles.gridCell}>
                      <ExperienceCard experience={e} onPress={openExperience} />
                    </View>
                  ))}
                </View>
                {hasMore && (
                  <TouchableOpacity
                    onPress={() =>
                      !resultsLoading &&
                      fetchResults({ sel: selection, q: query, cat: category, sortBy: sort, skip: resultsSkip, append: true })
                    }
                    disabled={resultsLoading}
                    style={styles.viewMore}
                    accessibilityRole="button"
                  >
                    {resultsLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.viewMoreText}>View more</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        ) : (
          /* ════════════════ EXPLORE VIEW ════════════════ */
          <>
            {/* Top experiences by country (accordion) */}
            <View style={styles.section}>
              <View style={styles.topDestPill}>
                <Ionicons name="globe-outline" size={13} color="#0F766E" />
                <Text style={styles.topDestPillText}>TOP DESTINATIONS</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: 8 }]}>
                Top experiences by country
              </Text>
              <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                The most-booked tours, tickets &amp; attractions in each destination.
              </Text>
            </View>
            <View style={styles.countries}>
              {countryGroups.map((g) => (
                <CountryExperiences
                  key={g.country}
                  group={g}
                  open={openCountry === g.country}
                  onToggle={toggleCountry}
                  onPressExperience={openExperience}
                  onViewMore={pickCountry}
                />
              ))}
            </View>

            {/* "Every wonder. One booking." — destination tiles */}
            {tileCities.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Every wonder. <Text style={{ color: ORANGE }}>One booking.</Text>
                </Text>
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  Skip the queues at 100+ icons across 50+ countries. Instant, mobile-ready, refundable.
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tileRail}
                >
                  {tileCities.map((g, i) => (
                    <DestinationTile key={g.city + i} group={g} featured={i === 0} onPress={pickCity} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Per-city rails — "What travellers can't stop booking" */}
            {railCities.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  What travellers can&apos;t <Text style={{ color: ORANGE }}>stop booking</Text>
                </Text>
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  The most-booked tours and tickets — by destination.
                </Text>
              </View>
            )}
            {railCities.map((g) => (
              <CityRail
                key={g.city}
                group={g}
                onPressExperience={openExperience}
                onSeeAll={pickCity}
              />
            ))}

            {/* India magazine hero */}
            <IndiaMagazineHero />
          </>
        )}
      </ScrollView>

      {/* ─── FILTERS DRAWER (bottom sheet) ─── */}
      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setFiltersOpen(false)}
      >
        <Pressable style={styles.drawerBackdrop} onPress={() => setFiltersOpen(false)}>
          <Pressable
            style={[styles.drawer, { backgroundColor: themeColors.surface }]}
            onPress={() => {}}
          >
            <View style={styles.drawerHandle} />
            <Text style={[styles.drawerTitle, { color: themeColors.text }]}>Filter by category</Text>
            <View style={styles.catList}>
              {CATEGORY_FILTERS.map((c) => {
                const active = category === c.value;
                return (
                  <TouchableOpacity
                    key={c.value || 'all'}
                    onPress={() => {
                      applyFilter({ cat: c.value });
                      setFiltersOpen(false);
                    }}
                    style={[
                      styles.catRow,
                      active && { backgroundColor: 'rgba(249,115,22,0.10)' },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={c.icon as any} size={18} color={active ? ORANGE : themeColors.textSecondary} />
                    <Text style={[styles.catRowText, { color: active ? ORANGE : themeColors.text }]}>
                      {c.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
  heroTitle: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, letterSpacing: -0.75, lineHeight: 36 },
  heroSub: { fontSize: fontSize.sm, marginTop: spacing.sm, lineHeight: 20 },
  trust: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { fontSize: fontSize.xs },

  searchWrap: { paddingHorizontal: spacing.lg, marginTop: -26 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: fontSize.md },
  searchBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sectionSub: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 19 },

  topDestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(13,148,136,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  topDestPillText: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  countries: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.lg },

  tileRail: { gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.lg },

  // Filtered view
  typeTabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  typeTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1 },
  typeTabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    zIndex: 20,
  },
  resultsCount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, flexShrink: 1 },
  resultsActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  sortMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 200,
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
  viewMore: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: ORANGE,
  },
  viewMoreText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Filters drawer
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  drawer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing['2xl'],
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  drawerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md },
  catList: { gap: 2 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  catRowText: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.medium },

  state: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.md },
  stateText: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999, backgroundColor: ORANGE },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
