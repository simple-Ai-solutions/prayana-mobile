// Explore World — tours, tickets & experiences from Viator and Headout.
//
// Ported from the PWA's /global-experiences: a hero, a country filter rail, and
// "Top experiences by country" — each country a photo card wrapping a rail of
// experiences. Typing switches to a flat search grid, as on the web.
//
// Theme: this is the app's standard surface, so it uses the shared ORANGE
// primary (colors.primary[500]) for CTAs and the logo TEAL (#4AC0CC) for the
// provider chip and "View more" — matching the web's ActivityCard. It is not a
// brand-red surface like eSIM.
//
// Everything shown is real: the counts, prices and ratings come from
// GET /activities/global/by-city. The API sends no `isFeatured`, so — unlike the
// PWA — there is no "Bestseller" ribbon here. A badge the data cannot support
// would be a fabrication.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
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
import { ExperienceCard } from '../../components/experiences/ExperienceCard';
import { CountryExperiences } from '../../components/experiences/CountryExperiences';

const TEAL = '#4AC0CC';
const PAGE = 24;

export default function GlobalExperiencesScreen() {
  const { themeColors, isDarkMode } = useTheme();

  const [cities, setCities] = useState<CityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [country, setCountry] = useState<string | null>(null);
  // Accordion: one country's rail open at a time, the first by default — the
  // PWA's mobile behaviour. Showing every rail at once buries the page.
  const [openCountry, setOpenCountry] = useState<string | null>(null);

  /**
   * Drill-down: the FULL activity list for the selected place, paginated.
   *
   * The browse rails only carry the sample the by-city call returns (20 per
   * city), so filtering to a country cannot just re-slice those — Vietnam has
   * 8,801 experiences, not the 20 we happen to hold. We fetch the real list.
   *
   * That fetch goes by CITY, not country: `?country=Vietnam` reports a total of
   * 13 (the server matches a sparsely-set location.country), while `?city=Hanoi`
   * correctly reports 8,801. City is the field that is actually populated.
   */
  const [placeItems, setPlaceItems] = useState<Experience[]>([]);
  const [placeTotal, setPlaceTotal] = useState(0);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeSkip, setPlaceSkip] = useState(0);

  // Search switches the page from browse-by-country to a flat grid.
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gridItems, setGridItems] = useState<Experience[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridSkip, setGridSkip] = useState(0);
  const [gridHasMore, setGridHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchGrid = useCallback(async (q: string, skip: number, append: boolean) => {
    setGridLoading(true);
    try {
      const res: any = await activityMarketplaceAPI.getGlobalActivities({
        q: q.trim(),
        limit: PAGE,
        skip,
      });
      const data: Experience[] = res?.data || res?.activities || [];
      setGridItems((prev) => (append ? [...prev, ...data] : data));
      setGridHasMore(data.length >= PAGE);
      setGridSkip(skip + data.length);
    } catch {
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
    [fetchGrid],
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setSearching(false);
    setGridItems([]);
  }, []);

  const countryGroups = useMemo(() => groupByCountry(cities), [cities]);


  // First country open by default, as the PWA does on mobile.
  useEffect(() => {
    setOpenCountry((cur) => cur ?? countryGroups[0]?.country ?? null);
  }, [countryGroups]);

  const toggleCountry = useCallback((c: string) => {
    setOpenCountry((cur) => (cur === c ? null : c));
  }, []);

  /**
   * Load the selected place's real activities. A country may span several
   * cities (India has 12), so fan out across its cities and interleave, rather
   * than showing only the first city's tours.
   */
  const loadPlace = useCallback(
    async (group: CountryGroup, skip: number, append: boolean) => {
      setPlaceLoading(true);
      try {
        const perCity = Math.max(4, Math.ceil(PAGE / group.cities.length));
        const pages = await Promise.all(
          group.cities.map(async (city) => {
            try {
              const res: any = await activityMarketplaceAPI.getGlobalActivities({
                city,
                limit: perCity,
                skip,
              });
              return {
                items: (res?.data ?? []) as Experience[],
                total: Number(res?.total ?? 0),
              };
            } catch {
              return { items: [] as Experience[], total: 0 };
            }
          }),
        );

        const items = pages.flatMap((p) => p.items);
        const total = pages.reduce((n, p) => n + p.total, 0);

        setPlaceItems((prev) => {
          const merged = append ? [...prev, ...items] : items;
          // The same tour can surface under more than one city query.
          const seen = new Set<string>();
          return merged.filter((e) => !seen.has(e._id) && seen.add(e._id));
        });
        setPlaceTotal(total);
        setPlaceSkip(skip + perCity);
      } finally {
        setPlaceLoading(false);
      }
    },
    [],
  );

  /** Show only this place's activities — the country chips and "View more". */
  const selectPlace = useCallback(
    (g: CountryGroup | null) => {
      setQuery('');
      setSearching(false);
      setPlaceItems([]);
      setPlaceTotal(0);
      setPlaceSkip(0);

      if (!g) {
        setCountry(null);
        return;
      }
      setCountry(g.country);
      loadPlace(g, 0, false);
    },
    [loadPlace],
  );

  const openExperience = useCallback((e: Experience) => {
    // Viator/Headout listings open at their affiliate booking URL (our tracking
    // is baked into it); only our own inventory routes to the in-app detail
    // page. The web makes exactly this split — mobile was sending everything to
    // /activity/{id}, so third-party tours hit a half-empty detail screen and
    // any affiliate commission was lost.
    const url = affiliateUrl(e);
    if (url) {
      Linking.openURL(url).catch(() => {
        Toast.show({ type: 'error', text1: "Couldn't open the booking page" });
      });
      return;
    }
    router.push(`/activity/${e._id}`);
  }, []);


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
        {/* ─── HERO ─── the PWA's is a soft blush wash with DARK type, not a
             saturated gradient with white type. "experiences" is the one word
             carrying the orange. */}
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
            <Ionicons name="globe-outline" size={13} color={colors.primary[500]} />
            <Text style={[styles.eyebrowText, { color: colors.primary[500] }]}>
              Worldwide tours · Viator &amp; Headout
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: themeColors.text }]}>
            Tours, tickets &amp;{'\n'}
            <Text style={{ color: colors.primary[500] }}>experiences</Text>
          </Text>
          <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
            Skip-the-line tickets, expert-led tours and bucket-list moments — hand-picked around the
            world.
          </Text>

          {/* Trust row. Only claims the catalogue backs: instant confirmation and
              mobile tickets are real product properties. No invented "2M+
              travellers" or a made-up aggregate rating. */}
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
        </LinearGradient>

        {/* ─── SEARCH (floats over the hero edge) ─── */}
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
              placeholder="Search cities, attractions, tours…"
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.searchInput, { color: themeColors.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

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
                load().finally(() => setLoading(false));
              }}
              style={styles.retry}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : searching ? (
          /* ─── SEARCH RESULTS ─── */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              {gridLoading && !gridItems.length
                ? 'Searching…'
                : `${gridItems.length} result${gridItems.length === 1 ? '' : 's'}`}
            </Text>

            {gridLoading && !gridItems.length ? (
              <View style={styles.state}>
                <ActivityIndicator color={colors.primary[500]} />
              </View>
            ) : gridItems.length === 0 ? (
              <View style={styles.state}>
                <Ionicons name="search-outline" size={40} color={themeColors.textTertiary} />
                <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
                  Nothing matches “{query.trim()}”.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.grid}>
                  {gridItems.map((e) => (
                    <View key={e._id} style={styles.gridCell}>
                      <ExperienceCard experience={e} onPress={openExperience} />
                    </View>
                  ))}
                </View>

                {gridHasMore && (
                  <TouchableOpacity
                    onPress={() => !gridLoading && fetchGrid(query, gridSkip, true)}
                    disabled={gridLoading}
                    style={[styles.loadMore, { borderColor: themeColors.border }]}
                    accessibilityRole="button"
                  >
                    {gridLoading ? (
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
        ) : (
          /* ─── BROWSE BY COUNTRY ─── */
          <>
            {/* Country filter rail */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRail}
            >
              <Chip
                label="All places"
                icon="earth"
                active={!country}
                onPress={() => selectPlace(null)}
              />
              {countryGroups.map((g) => (
                <Chip
                  key={g.country}
                  label={g.country}
                  active={country === g.country}
                  onPress={() => selectPlace(country === g.country ? null : g)}
                />
              ))}
            </ScrollView>

            {country ? (
              /* ─── ONE PLACE — its own activities, the full paginated list ─── */
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{country}</Text>
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  {placeTotal > 0
                    ? `${placeTotal.toLocaleString('en-IN')} experience${placeTotal === 1 ? '' : 's'}`
                    : placeLoading
                      ? 'Loading experiences…'
                      : 'No experiences here yet.'}
                </Text>

                {placeLoading && !placeItems.length ? (
                  <View style={styles.state}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                  </View>
                ) : (
                  <>
                    <View style={styles.grid}>
                      {placeItems.map((e) => (
                        <View key={e._id} style={styles.gridCell}>
                          <ExperienceCard experience={e} onPress={openExperience} />
                        </View>
                      ))}
                    </View>

                    {placeItems.length > 0 && placeItems.length < placeTotal && (
                      <TouchableOpacity
                        onPress={() => {
                          const g = countryGroups.find((x) => x.country === country);
                          if (g && !placeLoading) loadPlace(g, placeSkip, true);
                        }}
                        disabled={placeLoading}
                        style={[styles.loadMore, { borderColor: themeColors.border }]}
                        accessibilityRole="button"
                      >
                        {placeLoading ? (
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
            ) : (
              /* ─── ALL PLACES — the country accordion ─── */
              <>
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Top experiences by country
                  </Text>
                  <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                    Handpicked tours and tickets, booked through Viator and Headout.
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
                      onViewMore={selectPlace}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Chip: React.FC<{
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}> = ({ label, icon, active, onPress }) => {
  const { themeColors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary[500] : themeColors.surface,
          borderColor: active ? colors.primary[500] : themeColors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {!!icon && (
        <Ionicons name={icon} size={14} color={active ? '#FFFFFF' : themeColors.textSecondary} />
      )}
      <Text
        style={[styles.chipText, { color: active ? '#FFFFFF' : themeColors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

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

  // Sizes come from the shared theme (fontSize['3xl'] = 30). The theme sets no
  // fontFamily on purpose — the design system's typeface IS the native system
  // stack, and no webfont is bundled.
  heroTitle: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.75,
    lineHeight: 36,
  },
  heroSub: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
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

  chipRail: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sectionSub: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 19 },

  countries: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.lg },

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
