// Travel eSIM — the mobile port of the web's app/esim/page.jsx.
//
// WHAT CHANGED, AND WHY IT MATTERED
// This screen used to ship 13 hardcoded "plans" with invented USD prices
// ($8.99 USA, $12.50 Japan...). It fetched the live catalogue, but the adapter
// tested `Array.isArray(res.data)` while the API actually returns
// `{ success, data: { countries, bundles, exchangeRates } }` — an OBJECT. The
// check never passed, so the live data was silently discarded and EVERY user
// saw fabricated prices in the wrong currency. All of it is gone.
//
// Real bundles are priced in INR by the server (sellingPrice / originalPrice /
// discountPercent). If the catalogue can't be reached we show an error with a
// retry — never a made-up price.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
} from 'react-native';
// Nested inside a gesture-handler ScrollView, plain RN Touchables drop taps.
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';
import {
  CoverageScope,
  EsimBundle,
  EsimCountry,
  ExchangeRates,
  SORT_LABELS,
  SortKey,
  bundleKey,
  orderCountries,
  popularPlanNames,
  sortBundles,
  splitByScope,
} from '../../lib/esim';
import { CountryFlag } from '../../components/esim/CountryFlag';
import { EsimPlanCard, ACCENT_RED } from '../../components/esim/EsimPlanCard';
import { EsimHowItWorks } from '../../components/esim/EsimHowItWorks';
import { EsimFAQ } from '../../components/esim/EsimFAQ';
import { EsimCompatibleDevices } from '../../components/esim/EsimCompatibleDevices';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1600&q=80';

const SORT_KEYS: SortKey[] = ['value', 'price-low', 'price-high', 'data', 'duration'];

// How many destinations to show before "See all" (the catalogue sells ~157).
const FEATURED_COUNT = 12;

export default function EsimScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  // Lets other screens open straight into a destination's plans, e.g.
  // /esim?country=JP.
  const params = useLocalSearchParams<{ country?: string; debugCountry?: string }>();
  const initialCountry = (params.country || params.debugCountry || null) as string | null;

  const [countries, setCountries] = useState<EsimCountry[]>([]);
  const [bundles, setBundles] = useState<EsimBundle[]>([]);
  const [rates, setRates] = useState<ExchangeRates>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [sortBy, setSortBy] = useState<SortKey>('value');
  const [sortOpen, setSortOpen] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [scope, setScope] = useState<CoverageScope>('country');

  /**
   * The catalogue is country-scoped: called WITHOUT a country it returns the
   * 157 countries it can sell (and zero bundles); called WITH one it returns
   * that country's bundles. So we browse countries first and fetch plans on
   * selection — the same shape the web's flow has.
   */
  const load = useCallback(async (countryCode: string | null) => {
    setError('');
    try {
      const res: any = await esimAPI.getCatalogue(countryCode ? { country: countryCode } : {});
      const data = res?.data ?? {};

      if (Array.isArray(data.countries) && data.countries.length) {
        setCountries(orderCountries(data.countries));
      }
      if (data.exchangeRates) setRates(data.exchangeRates);

      if (!countryCode) {
        setBundles([]);
        return;
      }

      const list: EsimBundle[] = Array.isArray(data.bundles) ? data.bundles : [];
      setBundles(list);
      if (!list.length) setError('No plans available for this destination yet.');
    } catch {
      setBundles([]);
      // No silent fallback to fabricated plans — say what actually happened.
      setError("Couldn't reach the eSIM service. Please try again.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load(country).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [country, load]);

  /**
   * A country-scoped catalogue call returns that country's bundles but NOT the
   * country list, so opening straight into a destination (deep link, or
   * /esim?country=JP) would leave the picker empty and the heading showing the
   * raw ISO code. Fetch the list once, unscoped, to back both.
   */
  useEffect(() => {
    if (!country || countries.length) return;
    let alive = true;
    (async () => {
      try {
        const res: any = await esimAPI.getCatalogue({});
        const list = res?.data?.countries;
        if (alive && Array.isArray(list) && list.length) setCountries(orderCountries(list));
      } catch {
        // Non-fatal: the plans still render, the picker just stays empty.
      }
    })();
    return () => {
      alive = false;
    };
  }, [country, countries.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(country);
    setRefreshing(false);
  }, [country, load]);

  /**
   * Country plans and Regional/Global plans are separate products (local number
   * vs foreign number), so they get separate tabs — never one merged, price-sorted
   * list. Some destinations only exist inside global bundles, so if there are no
   * country plans we fall back to global rather than showing an empty tab.
   */
  const scoped = useMemo(() => splitByScope(bundles), [bundles]);
  const effectiveScope: CoverageScope =
    scope === 'country' && scoped.country.length === 0 ? 'global' : scope;

  const visible = useMemo(() => {
    // The search box picks a DESTINATION, so it must not also filter the plan
    // list. It used to: searching "Thailand" and then selecting it left the
    // query filtering plans, and since Thai plans are named "Thailand eSIM ..."
    // while the global bundles are not, the Regional/Global tab silently
    // rendered zero plans.
    const inScope = scoped[effectiveScope];
    const sorted = sortBundles(inScope, sortBy);
    const popular = popularPlanNames(sorted);
    // Hoist popular plans, as the web does.
    const hoisted = [
      ...sorted.filter((b) => popular.has(b.name)),
      ...sorted.filter((b) => !popular.has(b.name)),
    ];
    return { list: hoisted, popular };
  }, [scoped, effectiveScope, sortBy]);

  const goToCheckout = useCallback(
    (plan: EsimBundle) => {
      router.push({
        pathname: '/esim/checkout/[bundle]',
        params: {
          bundle: plan.name,
          provider: plan.provider ?? '',
          bundleId: plan.providerBundleId ?? '',
          country: plan.country ?? '',
        },
      });
    },
    [router],
  );

  const selectedCountryName = countries.find((c) => c.iso === country)?.name ?? country ?? null;

  // With no country picked, the search box filters the country rail instead of
  // plans — that's the only thing on screen to filter.
  /**
   * The picker shows, in order of preference:
   *   - the search matches, while the customer is searching;
   *   - the featured shortlist otherwise (expandable to all 157 via "See all").
   *
   * The selected country is always kept in the list even if it falls outside the
   * shortlist, so picking, say, Peru doesn't make the highlighted chip vanish.
   */
  const searchQuery = search.trim().toLowerCase();
  const isSearching = searchQuery.length > 0 && !country;

  const visibleCountries = useMemo(() => {
    const matches = isSearching
      ? countries.filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery) ||
            c.iso.toLowerCase().includes(searchQuery),
        )
      : countries;

    if (isSearching || showAllCountries) return matches;

    // Collapsed shortlist — plus the selection, wherever it ranks.
    const shortlist = matches.slice(0, FEATURED_COUNT);
    const picked = country ? matches.find((c) => c.iso === country) : undefined;
    return picked && !shortlist.some((c) => c.iso === country)
      ? [picked, ...shortlist.slice(0, FEATURED_COUNT - 1)]
      : shortlist;
  }, [countries, searchQuery, isSearching, country, showAllCountries]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_RED} />
        }
      >
        {/* ─── HERO ─── */}
        <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.hero} imageStyle={styles.heroImg}>
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.72)']}
            style={StyleSheet.absoluteFill}
          />

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

            <TouchableOpacity
              onPress={() => router.push('/esim/my-orders')}
              style={styles.ordersBtn}
              accessibilityRole="button"
            >
              <Ionicons name="receipt-outline" size={14} color="#FFFFFF" />
              <Text style={styles.ordersBtnText}>My eSIMs</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.eyebrow}>
              <Ionicons name="phone-portrait-outline" size={11} color="#FFFFFF" />
              <Text style={styles.eyebrowText}>TRAVEL eSIM</Text>
            </View>
            <Text style={styles.heroTitle}>Stay connected</Text>
            <Text style={styles.heroTitleAccent}>everywhere you go</Text>
            <Text style={styles.heroSub}>
              eSIM data plans for 190+ countries. Instant activation, no SIM swap.
            </Text>
          </View>
        </ImageBackground>

        {/* ─── FLOATING SEARCH (overlaps the hero edge, like the web) ─── */}
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
          >
            <Ionicons name="search" size={18} color={themeColors.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search a country or plan..."
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.searchInput, { color: themeColors.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── DESTINATIONS — every country the catalogue actually sells ─── */}
        <View style={styles.section}>
          <View style={styles.plansHeader}>
            <View style={styles.plansHeaderText}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Where are you going?
              </Text>
              <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                {countries.length
                  ? `${countries.length} destinations · tap one to see its plans`
                  : 'Tap a country to see its plans'}
              </Text>
            </View>

            {countries.length > FEATURED_COUNT && !isSearching && (
              <TouchableOpacity
                onPress={() => setShowAllCountries((v) => !v)}
                style={[styles.sortBtn, { borderColor: themeColors.border }]}
                accessibilityRole="button"
              >
                <Text style={[styles.sortBtnText, { color: themeColors.textSecondary }]}>
                  {showAllCountries ? 'Show less' : 'See all'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.countryGrid}>
            {visibleCountries
              .map((c) => {
                const active = country === c.iso;
                return (
                  <TouchableOpacity
                    key={c.iso}
                    onPress={() => {
                      // Clear the query on selection: it has done its job, and
                      // leaving "Thailand" in the box makes the picker look like
                      // it is still filtering when it no longer is. Reset the
                      // scope too — each destination has its own country/global
                      // split, and a tab that is empty here may not be there.
                      setCountry(active ? null : c.iso);
                      setSearch('');
                      setShowAllCountries(false);
                      setScope('country');
                    }}
                    style={[
                      styles.countryChip,
                      {
                        backgroundColor: active ? ACCENT_RED : themeColors.surface,
                        borderColor: active ? ACCENT_RED : themeColors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={c.name}
                  >
                    <CountryFlag countryCode={c.iso} size={22} />
                    <Text
                      style={[
                        styles.countryChipText,
                        { color: active ? '#FFFFFF' : themeColors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>

          {isSearching && visibleCountries.length === 0 && (
            <Text style={[styles.sectionSub, { color: themeColors.textSecondary, marginTop: spacing.md }]}>
              No destination matches "{search.trim()}".
            </Text>
          )}
        </View>

        {/* ─── PLANS — only once a destination is chosen, since the catalogue is
             country-scoped and returns no bundles without one. ─── */}
        {country && (
        <View style={styles.section}>
          <View style={styles.plansHeader}>
            <View style={styles.plansHeaderText}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                {selectedCountryName ? `${selectedCountryName} plans` : 'Available plans'}
              </Text>
              {!loading && !error && (
                <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
                  {effectiveScope === 'global'
                    ? 'Covers many countries · foreign number · outbound calls only'
                    : 'Local data eSIM · activates the moment you land'}
                </Text>
              )}
            </View>

            {!loading && !error && visible.list.length > 1 && (
              <View>
                <TouchableOpacity
                  onPress={() => setSortOpen((v) => !v)}
                  style={[styles.sortBtn, { borderColor: themeColors.border }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="swap-vertical" size={14} color={themeColors.textSecondary} />
                  <Text style={[styles.sortBtnText, { color: themeColors.textSecondary }]}>
                    {SORT_LABELS[sortBy]}
                  </Text>
                </TouchableOpacity>

                {sortOpen && (
                  <View
                    style={[
                      styles.sortMenu,
                      { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                    ]}
                  >
                    {SORT_KEYS.map((k) => (
                      <TouchableOpacity
                        key={k}
                        onPress={() => {
                          setSortBy(k);
                          setSortOpen(false);
                        }}
                        style={styles.sortItem}
                      >
                        <Text
                          style={[
                            styles.sortItemText,
                            { color: k === sortBy ? ACCENT_RED : themeColors.text },
                          ]}
                        >
                          {SORT_LABELS[k]}
                        </Text>
                        {k === sortBy && <Ionicons name="checkmark" size={15} color={ACCENT_RED} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Coverage scope — a country eSIM and a global eSIM are different
              products, so make the customer choose rather than merging them.
              Only offered when the destination actually sells both. */}
          {!loading && !error && scoped.country.length > 0 && scoped.global.length > 0 && (
            <View style={[styles.scopeTabs, { borderColor: themeColors.border }]}>
              {([
                { key: 'country' as const, label: `${selectedCountryName ?? 'Country'} only`, count: scoped.country.length },
                { key: 'global' as const, label: 'Regional / Global', count: scoped.global.length },
              ]).map((t) => {
                const active = effectiveScope === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setScope(t.key)}
                    style={[styles.scopeTab, active && { backgroundColor: ACCENT_RED }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.scopeTabText,
                        { color: active ? '#FFFFFF' : themeColors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {t.label} ({t.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Global plans cost more and hand the customer a foreign number —
              say so plainly, since the cheapest plan on the list is often one. */}
          {!loading && !error && effectiveScope === 'global' && (
            <View style={styles.scopeWarning}>
              <Ionicons name="alert-circle" size={16} color={ACCENT_RED} />
              <Text style={[styles.scopeWarningText, { color: themeColors.textSecondary }]}>
                Regional/Global plans work across many countries but come with a foreign number and
                usually cost more.
                {scoped.country.length > 0 && selectedCountryName
                  ? ` For a trip only to ${selectedCountryName}, a "${selectedCountryName} only" plan is usually cheaper.`
                  : ''}{' '}
                To receive calls, use WhatsApp or data calling.
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={ACCENT_RED} />
              <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
                Loading plans...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
              <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>{error}</Text>
              <TouchableOpacity
                onPress={() => {
                  setLoading(true);
                  load(country).finally(() => setLoading(false));
                }}
                style={styles.retryBtn}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : visible.list.length === 0 ? (
            <View style={styles.stateBox}>
              <Ionicons name="cellular-outline" size={40} color={themeColors.textTertiary} />
              <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
                {effectiveScope === 'global'
                  ? `No regional or global plans cover ${selectedCountryName ?? 'this destination'} yet.`
                  : `No ${selectedCountryName ?? 'local'}-only plans yet — try Regional / Global.`}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {visible.list.map((plan) => (
                <View key={bundleKey(plan)} style={styles.gridCell}>
                  <EsimPlanCard
                    plan={plan}
                    exchangeRates={rates}
                    isPopular={visible.popular.has(plan.name)}
                    onPress={goToCheckout}
                  />
                </View>
              ))}
            </View>
          )}
          </View>
        )}

        <EsimHowItWorks />
        <EsimCompatibleDevices />
        <EsimFAQ />

        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={ACCENT_RED} />
          <Text style={[styles.footerNoteText, { color: themeColors.textSecondary }]}>
            eSIMs are non-refundable once activated. Unactivated eSIMs may be refunded within 7 days
            of purchase.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingBottom: spacing['2xl'] },

  // Hero
  hero: { minHeight: 250, justifyContent: 'space-between' },
  heroImg: {},
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  ordersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  ordersBtnText: { color: '#FFFFFF', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  heroContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['2xl'] + spacing.md },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing.sm,
  },
  eyebrowText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.75,
    lineHeight: 34,
  },
  // The web renders this line in the red brand gradient; RN has no gradient text
  // without extra deps, so the brand red is applied flat.
  heroTitleAccent: {
    color: '#FF6B72',
    fontSize: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.75,
    lineHeight: 34,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 300,
  },

  // Search — pulled up over the hero boundary
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

  // Sections
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  sectionSub: { fontSize: fontSize.sm, marginTop: 2 },

  // A wrapping grid, not a rail: the catalogue sells ~157 countries and a
  // horizontal strip can't browse that.
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  countryChipClear: { backgroundColor: 'transparent' },
  countryChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  plansHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    zIndex: 20,
  },
  plansHeaderText: { flex: 1 },

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

  // Coverage scope tabs
  scopeTabs: {
    flexDirection: 'row',
    marginTop: spacing.md,
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    gap: 3,
  },
  scopeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  scopeTabText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  scopeWarning: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(230,20,23,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(230,20,23,0.12)',
  },
  scopeWarningText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },

  // Plan grid — 2-up, like the web's grid-cols-2 on small screens.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  // The flex must live on this wrapper: a gesture-handler Touchable ignores flex.
  gridCell: { width: '47.5%', flexGrow: 1 },

  // States
  stateBox: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.md },
  stateText: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: ACCENT_RED,
  },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  footerNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(230,20,23,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(230,20,23,0.10)',
  },
  footerNoteText: { flex: 1, fontSize: fontSize.xs, lineHeight: 17 },
});
