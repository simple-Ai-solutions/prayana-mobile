// Travel eSIM — designed for the phone first.
//
// The web's landing page (app/esim/page.jsx) is one long scroll of sections.
// On a phone people search or tap a destination, so this screen leads with a
// short title bar and swipeable destination posters, then pins the search box
// and a Countries / Regions / Global switch to the top while you scroll. The
// Countries view is rails of two whole cards (Trending, Best value, Asia,
// Europe) and an A–Z list; a destination's plans slide up in a sheet as
// compact rows to compare, with what you are buying always in the bar at the
// bottom. The explainers live behind one "New to eSIM?" card.
//
// Every price is the live catalogue's (`sellingPrice`, INR, from the server).
// If the catalogue can't be reached we say so with a retry — never a made-up
// price.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { EsimAllCountriesSheet } from '../../components/esim/EsimAllCountriesSheet';
// Nested inside a gesture-handler ScrollView, plain RN Touchables drop taps.
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';
import { EsimBundle, EsimCountry, bundleKey, coverageCountFor, orderCountries, splitByScope } from '../../lib/esim';
import { ESIM_REGIONS } from '../../lib/esimRegions';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { goBack } from '../../lib/goBack';
import { EsimPosterRail } from '../../components/esim/EsimPosterRail';
import { EsimRegionPass } from '../../components/esim/EsimRegionPass';
import { EsimOfferTicker } from '../../components/esim/EsimLandingExtras';
import { EsimCountryRail, EsimCountryListRow, EsimGuideCard, EsimGuideSheet, BrowseDeal } from '../../components/esim/EsimBrowse';
import { EsimPlansSheet } from '../../components/esim/EsimPlansSheet';
import { EsimPlanRow } from '../../components/esim/EsimPlanRow';
import { ESIM_RED, dataLabel as formatData } from '../../components/esim/EsimPass';

// The posters lead with the web hero's popular destinations, in its order.
const SPOTLIGHT = ['TR', 'TH', 'JP', 'AE', 'FR', 'IT', 'SG', 'GB', 'ES', 'KR'];
const TRENDING = 12;
const A_Z_PREVIEW = 5;
// Global plans are sold with every country's catalogue; the US one carries the
// full set. "Global" = covering 50+ countries.
const GLOBAL_SOURCE = 'US';
const GLOBAL_MIN_COUNTRIES = 50;

type Tab = 'countries' | 'regions' | 'global';
type Deal = BrowseDeal & { fromINR: number; planCount: number };

const is5G = (b: EsimBundle) => /5g/i.test(Array.isArray(b.speed) ? b.speed.join(' ') : String(b.speed ?? ''));

/** The cheapest bundle, reduced to what a card shows. */
function summarise(list: EsimBundle[]): Deal {
  const cheapest = list.reduce((m, b) => ((b.sellingPrice ?? Infinity) < (m.sellingPrice ?? Infinity) ? b : m));
  const price = cheapest.sellingPrice ?? 0;
  const mrp = cheapest.originalPrice && cheapest.originalPrice > price ? cheapest.originalPrice : undefined;
  return {
    fromINR: price,
    planCount: list.length,
    mrpINR: mrp,
    discountPercent: cheapest.discountPercent || (mrp ? Math.round((1 - price / mrp) * 100) : 0),
    dataLabel: formatData(cheapest.dataAmountMB, cheapest.isUnlimited),
    has5G: list.some(is5G),
  };
}

export default function EsimScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const requireAuth = useRequireAuth();
  // /esim?country=JP opens straight into a destination's plans.
  const params = useLocalSearchParams<{ country?: string; debugCountry?: string }>();
  const linkedCountry = (params.country || params.debugCountry || null) as string | null;

  const [countries, setCountries] = useState<EsimCountry[]>([]);
  const [deals, setDeals] = useState<Record<string, Deal>>({});
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<Tab>('countries');
  const [search, setSearch] = useState('');
  const [allOpen, setAllOpen] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // The destination whose plans are open in the sheet.
  const [country, setCountry] = useState<string | null>(linkedCountry);
  const [bundles, setBundles] = useState<EsimBundle[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  useEffect(() => { if (linkedCountry) setCountry(linkedCountry); }, [linkedCountry]);

  // Global plans for the Global tab, fetched the first time it is opened.
  const [globalPlans, setGlobalPlans] = useState<EsimBundle[] | null>(null);
  const [globalError, setGlobalError] = useState('');
  const [globalPick, setGlobalPick] = useState<string | null>(null);

  const scrollRef = useRef<any>(null);
  // Bundles already fetched while pricing the cards, so opening one of those
  // destinations shows its plans at once instead of asking again.
  const bundleCache = useRef<Record<string, EsimBundle[]>>({});

  /** The countries the catalogue sells (no country param = the list, no bundles). */
  const loadCountries = useCallback(async () => {
    setListError('');
    try {
      const res: any = await esimAPI.getCatalogue({});
      const list = res?.data?.countries;
      // 33 entries come back with no ISO code. They can't be priced or opened
      // (the catalogue returns no bundles for them) and would all share one
      // key, so they are left out.
      const sellable = Array.isArray(list) ? list.filter((c: EsimCountry) => !!c.iso) : [];
      if (sellable.length) setCountries(orderCountries(sellable));
      else setListError('No destinations available right now.');
    } catch {
      setListError("Couldn't reach the eSIM service. Please try again.");
    }
  }, []);

  useEffect(() => {
    setListLoading(true);
    loadCountries().finally(() => setListLoading(false));
  }, [loadCountries]);

  /**
   * Live "from" prices for the cards. The catalogue only prices a country when
   * asked for that country, so price the ones on screen, four at a time; a
   * card whose fetch fails just shows no price.
   */
  useEffect(() => {
    if (!countries.length) return;
    let alive = true;
    (async () => {
      const wanted = new Set<string>([
        ...SPOTLIGHT,
        ...countries.slice(0, TRENDING).map((c) => c.iso),
        ...ESIM_REGIONS.flatMap((r) => r.sampleCodes),
      ]);
      const targets = countries.filter((c) => wanted.has(c.iso));
      for (let i = 0; i < targets.length; i += 4) {
        if (!alive) return;
        const found = await Promise.all(
          targets.slice(i, i + 4).map(async (c) => {
            try {
              const res: any = await esimAPI.getCatalogue({ country: c.iso });
              const list: EsimBundle[] = res?.data?.bundles ?? [];
              if (list.length) bundleCache.current[c.iso] = list;
              return list.length ? ([c.iso, summarise(list)] as const) : null;
            } catch {
              return null;
            }
          }),
        );
        if (!alive) return;
        const ok = found.filter(Boolean) as Array<readonly [string, Deal]>;
        if (ok.length) setDeals((prev) => ({ ...prev, ...Object.fromEntries(ok) }));
      }
    })();
    return () => { alive = false; };
  }, [countries]);

  /** A destination's bundles for the sheet. */
  const loadPlans = useCallback(async (iso: string, fresh = false) => {
    setPlansError('');
    const cached = !fresh && bundleCache.current[iso];
    if (cached) {
      setBundles(cached);
      setPlansLoading(false);
      return;
    }
    setPlansLoading(true);
    setBundles([]);
    try {
      const res: any = await esimAPI.getCatalogue({ country: iso });
      const list: EsimBundle[] = Array.isArray(res?.data?.bundles) ? res.data.bundles : [];
      setBundles(list);
      if (list.length) bundleCache.current[iso] = list;
      if (!list.length) setPlansError('No plans available for this destination yet.');
      // Keep the card's price in step with what the sheet shows.
      else setDeals((prev) => ({ ...prev, [iso]: summarise(list) }));
    } catch {
      setPlansError("Couldn't load plans. Please try again.");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => { if (country) loadPlans(country); }, [country, loadPlans]);

  useEffect(() => {
    if (tab !== 'global' || globalPlans) return;
    let alive = true;
    (async () => {
      try {
        const res: any = await esimAPI.getCatalogue({ country: GLOBAL_SOURCE });
        const list: EsimBundle[] = res?.data?.bundles ?? [];
        const global = splitByScope(list).global
          .filter((b) => (coverageCountFor(b) ?? 0) >= GLOBAL_MIN_COUNTRIES)
          .sort((a, b) => (a.sellingPrice ?? 0) - (b.sellingPrice ?? 0));
        if (alive) setGlobalPlans(global);
      } catch {
        if (alive) setGlobalError("Couldn't load global plans. Please try again.");
      }
    })();
    return () => { alive = false; };
  }, [tab, globalPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    bundleCache.current = {};
    await loadCountries();
    setRefreshing(false);
  }, [loadCountries]);

  const goToCheckout = useCallback((plan: EsimBundle, shoppedFrom?: string | null) => {
    // An eSIM is tied to an account (the order needs an auth token), so ask
    // for sign-in before the form, not after it.
    if (!requireAuth({ reason: 'Sign in to buy an eSIM — your order and QR code are tied to your account.' })) return;
    setCountry(null);
    router.push({
      pathname: '/esim/checkout/[bundle]',
      params: {
        bundle: plan.name,
        provider: plan.provider ?? '',
        bundleId: plan.providerBundleId ?? '',
        country: shoppedFrom ?? plan.country ?? '',
      },
    });
  }, [router, requireAuth]);

  const byIso = useMemo(() => new Map(countries.map((c) => [c.iso, c])), [countries]);
  const pick = useCallback((codes: string[]) => codes.map((c) => byIso.get(c)).filter(Boolean) as EsimCountry[], [byIso]);

  const spotlight = useMemo(() => pick(SPOTLIGHT), [pick]);
  const trending = useMemo(() => countries.slice(0, TRENDING), [countries]);
  const bestValue = useMemo(() => {
    // Many destinations share the same entry price, so lead with ones the
    // Trending row doesn't already open with.
    const lead = new Set(countries.slice(0, 4).map((c) => c.iso));
    return countries
      .filter((c) => deals[c.iso]?.fromINR && !lead.has(c.iso))
      .sort((a, b) =>
        (deals[b.iso].discountPercent ?? 0) - (deals[a.iso].discountPercent ?? 0) || deals[a.iso].fromINR - deals[b.iso].fromINR)
      .slice(0, 10);
  }, [countries, deals]);
  const asia = useMemo(() => pick(ESIM_REGIONS.find((r) => r.name === 'Asia Pacific')?.sampleCodes ?? []), [pick]);
  const europe = useMemo(() => pick(ESIM_REGIONS.find((r) => r.name === 'Europe')?.sampleCodes ?? []), [pick]);
  const aToZ = useMemo(() => [...countries].sort((a, b) => a.name.localeCompare(b.name)), [countries]);

  const query = search.trim().toLowerCase();
  const results = useMemo(
    () => (query ? countries.filter((c) => c.name.toLowerCase().includes(query) || c.iso.toLowerCase() === query) : []),
    [countries, query],
  );

  // Each region quotes the cheapest of its sampled countries.
  const regionFrom = useMemo(() => {
    const out: Record<string, { fromINR?: number; planCount?: number; dataLabel?: string; destinations?: number }> = {};
    for (const r of ESIM_REGIONS) {
      const sampled = r.sampleCodes.map((iso) => deals[iso]).filter(Boolean) as Deal[];
      if (!sampled.length) continue;
      const cheapest = sampled.reduce((m, d) => (d.fromINR < m.fromINR ? d : m));
      out[r.name] = {
        fromINR: cheapest.fromINR,
        dataLabel: cheapest.dataLabel,
        destinations: sampled.length,
        // Bundles the catalogue returns for these countries — NOT the table's
        // plansCount, which counts countries.
        planCount: sampled.reduce((n, d) => n + d.planCount, 0),
      };
    }
    return out;
  }, [deals]);

  const regionCountries = useMemo(() => {
    const r = ESIM_REGIONS.find((x) => x.name === region);
    if (!r) return [];
    const codes = new Set(r.sampleCodes);
    return countries.filter((c) => codes.has(c.iso) || (c.region ?? '').toLowerCase().includes(r.filterKey.toLowerCase()));
  }, [countries, region]);

  const openCountry = useCallback((iso: string) => { setCountry(iso); setSearch(''); }, []);
  const selectedName = country ? byIso.get(country)?.name ?? country : null;

  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'countries', label: 'Countries', icon: 'flag-outline' },
    { key: 'regions', label: 'Regions', icon: 'map-outline' },
    { key: 'global', label: 'Global', icon: 'globe-outline' },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[2]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ESIM_RED} />}
      >
        {/* [0] Title bar */}
        <View style={s.top}>
          <TouchableOpacity onPress={() => goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={21} color={themeColors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: themeColors.text }]} numberOfLines={1}>Travel <Text style={{ color: ESIM_RED }}>eSIM</Text></Text>
            <Text style={[s.kicker, { color: themeColors.textSecondary }]} numberOfLines={1}>Data in 120+ countries · instant QR</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/esim/my-orders')} style={[s.mine, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityRole="button">
            <Ionicons name="qr-code-outline" size={14} color={themeColors.text} />
            <Text style={[s.mineText, { color: themeColors.text }]}>My eSIMs</Text>
          </TouchableOpacity>
        </View>

        {/* [1] Destination posters */}
        <View style={{ paddingTop: 6, paddingBottom: 4 }}>
          <EsimPosterRail countries={spotlight} deals={deals} onPick={openCountry} />
        </View>

        {/* [2] Pinned: search + Countries / Regions / Global */}
        <View style={[s.sticky, { backgroundColor: themeColors.background, borderBottomColor: line }]}>
          <View style={[s.search, { backgroundColor: themeColors.surface, borderColor: line }]}>
            <Ionicons name="search" size={18} color={themeColors.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Where are you travelling?"
              placeholderTextColor={themeColors.textTertiary}
              style={[s.searchInput, { color: themeColors.text }]}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => results[0] && openCountry(results[0].iso)}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={[s.tabs, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f2f4' }]}>
            {TABS.map((t) => {
              const on = tab === t.key && !query;
              return (
                // Pressable, not the gesture-handler Touchable: that one puts
                // `style` on an inner view, so flex: 1 never reached the row.
                <Pressable key={t.key} onPress={() => { setTab(t.key); setSearch(''); }} style={[s.tab, on && [s.tabOn, { backgroundColor: themeColors.surface }]]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <Ionicons name={t.icon} size={14} color={on ? ESIM_RED : themeColors.textSecondary} />
                  <Text style={[s.tabText, { color: on ? themeColors.text : themeColors.textSecondary }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* [3] Content */}
        <View>
          {listLoading ? (
            <View style={s.state}><ActivityIndicator color={ESIM_RED} size="large" /></View>
          ) : listError ? (
            <View style={s.state}>
              <Ionicons name="cloud-offline-outline" size={36} color={themeColors.textTertiary} />
              <Text style={[s.stateText, { color: themeColors.textSecondary }]}>{listError}</Text>
              <TouchableOpacity onPress={() => { setListLoading(true); loadCountries().finally(() => setListLoading(false)); }} style={s.retry}>
                <Text style={s.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : query ? (
            /* Search results */
            <View style={s.pad}>
              <Text style={[s.sectionTitle, { color: themeColors.text }]}>
                {results.length ? `${results.length} destination${results.length === 1 ? '' : 's'}` : `No destination matches "${search.trim()}"`}
              </Text>
              <View style={s.list}>
                {results.slice(0, 40).map((c) => (
                  <EsimCountryListRow key={c.iso} iso={c.iso} name={c.name} deal={deals[c.iso]} onPress={() => openCountry(c.iso)} />
                ))}
              </View>
            </View>
          ) : tab === 'countries' ? (
            <>
              <View style={[s.pad, { marginTop: 14 }]}>
                <EsimOfferTicker onBuy={() => spotlight[0] && openCountry(spotlight[0].iso)} />
              </View>

              <EsimCountryRail title="Trending now" subtitle="Where travellers are heading this month" icon="flame" iconColors={['#F97316', ESIM_RED]} countries={trending} deals={deals} onPick={openCountry} />
              <EsimCountryRail title="Best value this week" subtitle="Lowest prices and biggest discounts today" icon="pricetag" iconColors={['#10B981', '#047857']} countries={bestValue} deals={deals} onPick={openCountry} />

              <View style={[s.pad, { marginTop: 26 }]}>
                <EsimGuideCard onPress={() => setGuideOpen(true)} />
              </View>

              <EsimCountryRail title="Asia Pacific" subtitle="Temples, islands and city lights" icon="sunny" iconColors={['#F43F5E', '#BE123C']} countries={asia} deals={deals} onPick={openCountry} />
              <EsimCountryRail title="Europe" subtitle="One trip, many borders" icon="train" iconColors={['#3B82F6', '#1D4ED8']} countries={europe} deals={deals} onPick={openCountry} />

              <View style={[s.pad, { marginTop: 28 }]}>
                <View style={s.azHead}>
                  <Text style={[s.sectionTitle, { color: themeColors.text }]}>All destinations</Text>
                  <Text style={[s.azCount, { color: themeColors.textSecondary }]}>{countries.length} countries</Text>
                </View>
                <View style={s.list}>
                  {aToZ.slice(0, A_Z_PREVIEW).map((c) => (
                    <EsimCountryListRow key={c.iso} iso={c.iso} name={c.name} deal={deals[c.iso]} onPress={() => openCountry(c.iso)} />
                  ))}
                </View>
                {aToZ.length > A_Z_PREVIEW ? (
                  // The full list opens on its own screen, so this page stays short.
                  <Pressable onPress={() => setAllOpen(true)} style={({ pressed }) => [s.more, { borderColor: ESIM_RED, backgroundColor: themeColors.surface }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                    <Ionicons name="earth" size={17} color={ESIM_RED} />
                    <Text style={[s.moreText, { color: ESIM_RED }]}>View all {aToZ.length} countries</Text>
                    <Ionicons name="arrow-forward" size={16} color={ESIM_RED} />
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : tab === 'regions' ? (
            <View style={[s.pad, { marginTop: 16, gap: 16 }]}>
              <Text style={[s.lead, { color: themeColors.textSecondary }]}>
                One eSIM for a multi-country trip — or tap a region to see its countries.
              </Text>
              {ESIM_REGIONS.map((r) => (
                <View key={r.name} style={{ gap: 12 }}>
                  <EsimRegionPass
                    region={r}
                    fromINR={regionFrom[r.name]?.fromINR}
                    planCount={regionFrom[r.name]?.planCount}
                    dataLabel={regionFrom[r.name]?.dataLabel}
                    destinations={regionFrom[r.name]?.destinations}
                    selected={region === r.name}
                    onPress={() => setRegion((cur) => (cur === r.name ? null : r.name))}
                  />
                  {region === r.name ? (
                    <View style={s.list}>
                      {regionCountries.map((c) => (
                        <EsimCountryListRow key={c.iso} iso={c.iso} name={c.name} deal={deals[c.iso]} onPress={() => openCountry(c.iso)} />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            /* Global */
            <View style={[s.pad, { marginTop: 16 }]}>
              <LinearGradient colors={['#0f172a', '#1e293b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.globalHero}>
                <LinearGradient colors={['rgba(56,189,248,0.45)', 'rgba(56,189,248,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
                <Ionicons name="globe" size={30} color="#7dd3fc" />
                <Text style={s.globalTitle}>One eSIM, 60+ countries</Text>
                <Text style={s.globalSub}>For round-the-world trips and frequent flyers. A foreign number; data works the moment you land.</Text>
              </LinearGradient>
              {globalError ? (
                <Text style={[s.stateText, { color: themeColors.textSecondary, marginTop: 16 }]}>{globalError}</Text>
              ) : !globalPlans ? (
                <View style={s.state}><ActivityIndicator color={ESIM_RED} /></View>
              ) : (
                <View style={{ gap: 14, marginTop: 18 }}>
                  {globalPlans.map((p) => {
                    const on = globalPick === bundleKey(p);
                    return (
                      <View key={bundleKey(p)} style={{ gap: 8 }}>
                        <EsimPlanRow plan={p} selected={on} showCoverage onPress={() => setGlobalPick(on ? null : bundleKey(p))} />
                        {on ? (
                          <TouchableOpacity onPress={() => goToCheckout(p, GLOBAL_SOURCE)} accessibilityRole="button">
                            <LinearGradient colors={['#FF3344', ESIM_RED, '#C30E11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.globalBuy}>
                              <Text style={s.globalBuyText}>Buy this plan</Text>
                              <Ionicons name="arrow-forward" size={16} color="#fff" />
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Always: the trust line. */}
          <View style={[s.pad, { marginTop: 28 }]}>
            <View style={[s.trust, { borderColor: line }]}>
              {([
                { icon: 'flash-outline', text: 'Instant QR' },
                { icon: 'shield-checkmark-outline', text: 'Secure pay' },
                { icon: 'refresh-outline', text: 'Easy top-ups' },
                { icon: 'chatbubbles-outline', text: '24/7 help' },
              ] as const).map((t) => (
                <View key={t.text} style={s.trustItem}>
                  <Ionicons name={t.icon} size={18} color={ESIM_RED} />
                  <Text style={[s.trustText, { color: themeColors.textSecondary }]}>{t.text}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.note, { color: themeColors.textTertiary }]}>
              eSIMs are non-refundable once activated. Unactivated eSIMs can be refunded within 7 days of purchase.
            </Text>
          </View>
        </View>
      </ScrollView>

      <EsimPlansSheet
        visible={!!country}
        countryCode={country}
        countryName={selectedName}
        bundles={bundles}
        loading={plansLoading}
        error={plansError}
        onRetry={() => country && loadPlans(country, true)}
        onClose={() => setCountry(null)}
        onBuy={(plan) => goToCheckout(plan, country)}
      />
      <EsimAllCountriesSheet
        visible={allOpen}
        countries={aToZ}
        deals={deals}
        onClose={() => setAllOpen(false)}
        onPick={(iso) => { setAllOpen(false); openCountry(iso); }}
      />
      <EsimGuideSheet
        visible={guideOpen}
        onClose={() => setGuideOpen(false)}
        onBrowse={() => { setTab('countries'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingHorizontal: 16 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  mineText: { fontSize: 12.5, fontWeight: '700' },

  sticky: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 50,
    shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15.5, fontWeight: '500' },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11 },
  tabOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13.5, fontWeight: '700' },

  state: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 50 },
  stateText: { fontSize: 14, textAlign: 'center' },
  retry: { backgroundColor: ESIM_RED, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '800' },

  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginTop: 16 },
  lead: { fontSize: 13.5, lineHeight: 19 },
  list: { gap: 10, marginTop: 12 },
  azHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  azCount: { fontSize: 12.5, fontWeight: '600' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 13, marginTop: 12 },
  moreText: { fontSize: 14, fontWeight: '700' },

  globalHero: { borderRadius: 22, padding: 20, gap: 6, overflow: 'hidden' },
  globalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  globalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },
  globalBuy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  globalBuyText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  trust: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 8 },
  trustItem: { flex: 1, alignItems: 'center', gap: 5 },
  trustText: { fontSize: 11.5, fontWeight: '600' },
  note: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 12 },
});
