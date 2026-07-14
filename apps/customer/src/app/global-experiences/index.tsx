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
import {
  CityGroup,
  CountryGroup,
  Experience,
  groupByCountry,
} from '../../lib/experiences';
import { ExperienceCard } from '../../components/experiences/ExperienceCard';
import { CountryExperiences } from '../../components/experiences/CountryExperiences';

const TEAL = '#4AC0CC';
const PAGE = 24;

export default function GlobalExperiencesScreen() {
  const { themeColors } = useTheme();

  const [cities, setCities] = useState<CityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [country, setCountry] = useState<string | null>(null);

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

  const visibleGroups = useMemo(
    () => (country ? countryGroups.filter((g) => g.country === country) : countryGroups),
    [countryGroups, country],
  );

  const openExperience = useCallback((e: Experience) => {
    router.push(`/activity/${e._id}`);
  }, []);

  const viewMore = useCallback((g: CountryGroup) => {
    // Drilling into a country is just the country filter applied — the API
    // groups by city, so there is no separate per-country endpoint to call.
    setCountry(g.country);
    setQuery('');
    setSearching(false);
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
        {/* ─── HERO ─── */}
        <LinearGradient
          colors={[colors.primary[500], '#FB923C', TEAL]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
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

          <Text style={styles.heroTitle}>Tours, tickets &amp; experiences</Text>
          <Text style={styles.heroSub}>
            Skip the queues, book real experiences — handpicked across the world.
          </Text>
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
                onPress={() => setCountry(null)}
              />
              {countryGroups.map((g) => (
                <Chip
                  key={g.country}
                  label={g.country}
                  active={country === g.country}
                  onPress={() => setCountry(country === g.country ? null : g.country)}
                />
              ))}
            </ScrollView>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                {country ? country : 'Top experiences by country'}
              </Text>
              <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                {country
                  ? `${visibleGroups[0]?.total.toLocaleString('en-IN') ?? 0} experiences`
                  : 'Handpicked tours and tickets, booked through Viator and Headout.'}
              </Text>
            </View>

            <View style={styles.countries}>
              {visibleGroups.map((g) => (
                <CountryExperiences
                  key={g.country}
                  group={g}
                  onPressExperience={openExperience}
                  onViewMore={viewMore}
                />
              ))}
            </View>
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

  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['2xl'] + spacing.lg },
  heroTop: { flexDirection: 'row', marginBottom: spacing.lg },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.75,
    lineHeight: 33,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },

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
