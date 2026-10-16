// /esim/[country] — one destination's eSIM plans on a page of its own.
//
// Mobile port of web app/esim/[country]/page.jsx. Same data and rules:
// GET /esim/catalogue?country=XX (esimAPI.getCatalogue), country-only and
// regional/global plans kept as separate lists (country first; falls back to
// regional when a destination has no local plans), Standard / Unlimited,
// Duration and Data filters, the web's sort options and "popular" heuristic,
// then Product details, Compatible devices, Install guide, FAQ and the refund
// note. Each plan opens the existing /esim/checkout/[bundle] route.
//
// The browse screen (esim/index.tsx) shows these plans in a sheet; this route
// serves deep links (/esim/JP) and anything that wants a full page.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';
import {
  CoverageScope, EsimBundle, ExchangeRates, SORT_LABELS, SortKey, bundleKey, popularPlanNames, sortBundles, splitByScope,
} from '../../lib/esim';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { goBack } from '../../lib/goBack';
import { CountryFlag } from '../../components/esim/CountryFlag';
import { EsimDestinationHero } from '../../components/esim/EsimDestinationHero';
import { EsimPlanCard } from '../../components/esim/EsimPlanCard';
import { EsimProductDetails } from '../../components/esim/EsimProductDetails';
import { EsimCompatibleDevices } from '../../components/esim/EsimCompatibleDevices';
import { EsimInstallGuide } from '../../components/esim/EsimInstallGuide';
import { EsimFAQ } from '../../components/esim/EsimFAQ';
import { ESIM_RED, dataLabel as formatData } from '../../components/esim/EsimPass';

const SORTS: SortKey[] = ['value', 'price-low', 'price-high', 'data', 'duration'];

export default function EsimCountryScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const requireAuth = useRequireAuth();
  const params = useLocalSearchParams<{ country?: string }>();
  const countryCode = String(params.country ?? '').toUpperCase();

  const [plans, setPlans] = useState<EsimBundle[]>([]);
  const [rates, setRates] = useState<ExchangeRates>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  const [scope, setScope] = useState<CoverageScope>('country');
  const [type, setType] = useState<'data' | 'unlimited'>('data');
  const [days, setDays] = useState<number | null>(null);
  const [dataPick, setDataPick] = useState<number | 'unlimited' | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('value');

  const load = useCallback(async () => {
    if (!countryCode) return;
    setError('');
    setLoadFailed(false);
    try {
      const res: any = await esimAPI.getCatalogue({ country: countryCode });
      if (res?.success === false) {
        setError('Failed to load plans');
        setLoadFailed(true);
        return;
      }
      const list = res?.data?.bundles || res?.data?.bundlesByCountry?.[countryCode] || [];
      setPlans(Array.isArray(list) ? list : []);
      if (res?.data?.exchangeRates) setRates(res.data.exchangeRates);
    } catch {
      // A network error is different from "no plans here" — offer Retry.
      setError("Couldn't reach the eSIM service. Please try again.");
      setLoadFailed(true);
    }
  }, [countryCode]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const countryName = plans[0]?.countryName || countryCode;

  // Country-only vs regional/global — separate products, never one list.
  const scoped = useMemo(() => splitByScope(plans), [plans]);
  const effScope: CoverageScope = scope === 'country' && scoped.country.length === 0 ? 'global' : scope;
  const inScope = scoped[effScope];
  const byType = useMemo(() => ({
    data: inScope.filter((b) => !b.isUnlimited),
    unlimited: inScope.filter((b) => !!b.isUnlimited),
  }), [inScope]);
  const effType = byType[type].length === 0 ? (type === 'data' ? 'unlimited' : 'data') : type;
  const typed = byType[effType];

  const dayOptions = useMemo(
    () => [...new Set(typed.map((b) => b.durationDays).filter((d): d is number => !!d))].sort((a, b) => a - b),
    [typed],
  );
  const effDays = days != null && dayOptions.includes(days) ? days : null;
  const byDays = useMemo(() => (effDays == null ? typed : typed.filter((b) => b.durationDays === effDays)), [typed, effDays]);

  const dataOptions = useMemo(() => {
    const seen = new Map<number | 'unlimited', string>();
    for (const b of byDays) {
      if (b.isUnlimited) seen.set('unlimited', 'Unlimited');
      else if (b.dataAmountMB) seen.set(b.dataAmountMB, formatData(b.dataAmountMB) ?? '');
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
      .sort((a, b) => (a.value === 'unlimited' ? 1 : b.value === 'unlimited' ? -1 : (a.value as number) - (b.value as number)));
  }, [byDays]);
  const effData = dataPick != null && dataOptions.some((o) => o.value === dataPick) ? dataPick : null;

  const { list, popular } = useMemo(() => {
    const pool = effData == null ? byDays : byDays.filter((b) => (effData === 'unlimited' ? !!b.isUnlimited : b.dataAmountMB === effData));
    const pop = popularPlanNames(pool);
    const sorted = sortBundles(pool, sortBy);
    // Popular plans lead, keeping their relative order (as on the web).
    return { list: [...sorted.filter((b) => pop.has(b.name)), ...sorted.filter((b) => !pop.has(b.name))], popular: pop };
  }, [byDays, effData, sortBy]);

  const activeFilters = (effDays != null ? 1 : 0) + (effData != null ? 1 : 0);

  const goToCheckout = useCallback((plan: EsimBundle) => {
    if (!requireAuth({ reason: 'Sign in to buy an eSIM — your order and QR code are tied to your account.' })) return;
    router.push({
      pathname: '/esim/checkout/[bundle]',
      params: {
        bundle: plan.name,
        provider: plan.provider ?? '',
        bundleId: plan.providerBundleId ?? '',
        country: countryCode || plan.country || '',
      },
    });
  }, [router, requireAuth, countryCode]);

  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';

  const topBar = (
    <View style={s.top}>
      <TouchableOpacity onPress={() => goBack('/esim')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={21} color={themeColors.text} />
      </TouchableOpacity>
      {countryCode ? <CountryFlag countryCode={countryCode} size={26} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: themeColors.text }]} numberOfLines={1}>{countryName || 'eSIM'}</Text>
        <Text style={[s.kicker, { color: themeColors.textSecondary }]} numberOfLines={1}>Travel eSIM · instant QR</Text>
      </View>
    </View>
  );

  if (loading || error || plans.length === 0) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        {topBar}
        <View style={s.state}>
          {loading ? (
            <ActivityIndicator color={ESIM_RED} size="large" />
          ) : (
            <>
              <Ionicons name={loadFailed ? 'cloud-offline-outline' : 'alert-circle-outline'} size={36} color={themeColors.textTertiary} />
              <Text style={[s.stateText, { color: themeColors.textSecondary }]}>
                {error || 'No plans available for this destination yet.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {loadFailed ? (
                  <TouchableOpacity onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }} style={s.retry}>
                    <Text style={s.retryText}>Retry</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => router.replace('/esim')}
                  style={[s.retry, loadFailed && { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]}
                >
                  <Text style={[s.retryText, loadFailed && { color: themeColors.text }]}>Browse other countries</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {topBar}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ESIM_RED} />}
      >
        <View style={s.pad}>
          <EsimDestinationHero countryName={countryName} countryCode={countryCode} bundles={plans} />
        </View>

        {/* Plans header */}
        <View style={[s.pad, { marginTop: 24, gap: 12 }]}>
          <View>
            <Text style={s.eyebrow}>
              {countryName} · {effScope === 'global' ? 'Regional / Global plan' : 'Country plan'}
            </Text>
            <Text style={[s.heading, { color: themeColors.text }]}>Pick a {countryName} eSIM plan</Text>
            <Text style={[s.sub, { color: themeColors.textSecondary }]}>
              {effScope === 'global'
                ? 'Covers many countries · includes a non-local number · calls are outbound only'
                : 'Local data eSIM · 4G LTE · Activates the moment you land'}
            </Text>
          </View>

          {effScope === 'global' ? (
            <View style={s.warn}>
              <Ionicons name="alert-circle" size={16} color={ESIM_RED} />
              <Text style={[s.warnText, { color: themeColors.textSecondary }]}>
                Regional/Global plans work across many countries but come with a foreign number and cost more.
                For a trip only to {countryName}, a “{countryName} only” plan is usually cheaper. To receive
                calls, use WhatsApp/data calling.
              </Text>
            </View>
          ) : null}

          {scoped.country.length > 0 && scoped.global.length > 0 ? (
            <Seg
              value={effScope}
              onChange={setScope}
              items={[
                { key: 'country', label: `${countryName} only` },
                { key: 'global', label: 'Regional / Global' },
              ]}
            />
          ) : null}
          {byType.data.length > 0 && byType.unlimited.length > 0 ? (
            <Seg
              value={effType}
              onChange={setType}
              items={[{ key: 'data', label: 'Standard' }, { key: 'unlimited', label: 'Unlimited', badge: 'NEW' }]}
            />
          ) : null}

          {dayOptions.length > 1 ? (
            <Chips label="DURATION" icon="time-outline" value={effDays} onChange={setDays}
              options={dayOptions.map((d) => ({ value: d, label: `${d}d` }))} />
          ) : null}
          {dataOptions.length > 1 ? (
            <Chips label="DATA" icon="cellular-outline" value={effData} onChange={setDataPick} options={dataOptions} />
          ) : null}
          {activeFilters > 0 ? (
            <Pressable onPress={() => { setDays(null); setDataPick(null); }} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
              <Text style={[s.clear, { color: themeColors.textSecondary }]}>Clear filters</Text>
            </Pressable>
          ) : null}

          <View style={{ gap: 7 }}>
            <Text style={[s.chipLabel, { color: themeColors.textSecondary }]}>SORT BY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 20 }}>
              {SORTS.map((k) => {
                const on = sortBy === k;
                return (
                  <Pressable key={k} onPress={() => setSortBy(k)} style={[s.sort, { borderColor: on ? themeColors.text : line, backgroundColor: on ? themeColors.text : 'transparent' }]}>
                    <Text style={[s.sortText, { color: on ? themeColors.background : themeColors.textSecondary }]}>{SORT_LABELS[k]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Plan cards */}
        <View style={[s.pad, { marginTop: 8 }]}>
          {list.length === 0 ? (
            <Text style={[s.stateText, { color: themeColors.textSecondary, marginTop: 20 }]}>No plans match these filters.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              {list.map((p) => (
                <EsimPlanCard
                  key={bundleKey(p)}
                  plan={p}
                  exchangeRates={rates}
                  isPopular={popular.has(p.name)}
                  onPress={goToCheckout}
                />
              ))}
            </View>
          )}
        </View>

        {/* Details */}
        <View style={[s.pad, s.divider]}>
          <View style={[s.dividerLine, { backgroundColor: line }]} />
          <Text style={[s.dividerText, { color: themeColors.textTertiary }]}>DETAILS</Text>
          <View style={[s.dividerLine, { backgroundColor: line }]} />
        </View>
        <EsimProductDetails plans={inScope} scope={effScope} countryName={countryName} countryCode={countryCode} />
        <EsimCompatibleDevices />
        <View style={[s.pad, { marginTop: 24 }]}>
          <EsimInstallGuide />
        </View>
        <EsimFAQ />

        {/* Refund policy */}
        <View style={s.pad}>
          <Pressable
            onPress={() => router.push('/esim/refund-policy')}
            style={[s.refund, {
              backgroundColor: isDarkMode ? 'rgba(230,20,23,0.05)' : 'rgba(230,20,23,0.04)',
              borderColor: isDarkMode ? 'rgba(230,20,23,0.12)' : 'rgba(230,20,23,0.1)',
            }]}
            accessibilityRole="link"
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={ESIM_RED} />
            <View style={{ flex: 1 }}>
              <Text style={[s.refundTitle, { color: themeColors.text }]}>Cancellation & Refund Policy</Text>
              <Text style={[s.refundText, { color: themeColors.textSecondary }]}>
                eSIMs are non-refundable once activated. Unactivated eSIMs may be refunded within 7 days of purchase.
              </Text>
              <Text style={[s.refundLink, { color: ESIM_RED }]}>Read the full policy ›</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Seg({ items, value, onChange }: { items: { key: string; label: string; badge?: string }[]; value: string; onChange: (k: any) => void }) {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <View style={[s.seg, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={[s.segItem, on && [s.segOn, { backgroundColor: themeColors.surface }]]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[s.segText, { color: on ? themeColors.text : themeColors.textSecondary }]} numberOfLines={1}>{it.label}</Text>
            {it.badge ? <View style={s.newBadge}><Text style={s.newBadgeText}>{it.badge}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Chips({ label, icon, options, value, onChange }: {
  label: string; icon: keyof typeof Ionicons.glyphMap;
  options: { value: number | 'unlimited'; label: string }[]; value: number | 'unlimited' | null; onChange: (v: any) => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)';
  return (
    <View style={{ gap: 7 }}>
      <View style={s.chipLabelRow}>
        <Ionicons name={icon} size={12} color={ESIM_RED} />
        <Text style={[s.chipLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
        {[{ value: null as any, label: 'All' }, ...options].map((o) => {
          const on = value === o.value;
          return (
            <Pressable key={String(o.value)} onPress={() => onChange(on && o.value != null ? null : o.value)}
              style={[s.chip, { borderColor: on ? ESIM_RED : line, backgroundColor: on ? ESIM_RED : themeColors.surface }]}>
              <Text style={[s.chipText, { color: on ? '#fff' : themeColors.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingHorizontal: 16 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  kicker: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retry: { backgroundColor: ESIM_RED, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '800' },

  eyebrow: { color: '#16A34A', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  warn: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(230,20,23,0.06)', borderRadius: 12, padding: 10 },
  warnText: { flex: 1, fontSize: 12.5, lineHeight: 17 },

  seg: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11 },
  segOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 13, fontWeight: '700' },
  newBadge: { backgroundColor: '#FACC15', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1 },
  newBadgeText: { color: '#7C2D12', fontSize: 8.5, fontWeight: '900' },

  chipLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  clear: { fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  sort: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  sortText: { fontSize: 12.5, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  refund: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 24 },
  refundTitle: { fontSize: 14, fontWeight: '800' },
  refundText: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  refundLink: { fontSize: 12.5, fontWeight: '700', marginTop: 6 },
});
