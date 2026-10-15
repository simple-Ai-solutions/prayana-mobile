// A destination's plans, in a sheet that slides up over the eSIM page: the
// country photo and name, the Country / Regional choice, Standard / Unlimited,
// Duration and Data chips, then the plans as compact rows to compare. The
// cheapest popular plan starts selected; the bar at the bottom always says
// what you are about to buy and for how much.
//
// Same rules as the web's country page (app/esim/[country]/page.jsx): country
// and regional plans are separate products and never one list; a scope or type
// with no plans falls back to the other rather than showing nothing.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prayana/shared-ui';
import {
  CoverageScope, EsimBundle, SORT_LABELS, SortKey, bundleKey, dataLabelFor, popularPlanNames, sortBundles, splitByScope,
} from '../../lib/esim';
import { countryImage } from '../../lib/countryAssets';
import { CountryFlag } from './CountryFlag';
import { EsimPlanRow } from './EsimPlanRow';
import { EsimProductDetails } from './EsimProductDetails';
import { EsimPill, ESIM_RED, dataLabel as formatData, inr } from './EsimPass';

const SORTS: SortKey[] = ['value', 'price-low', 'data', 'duration'];

export function EsimPlansSheet({ visible, countryCode, countryName, bundles, loading, error, onRetry, onClose, onBuy }: {
  visible: boolean;
  countryCode: string | null;
  countryName: string | null;
  bundles: EsimBundle[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
  onBuy: (plan: EsimBundle) => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [scope, setScope] = useState<CoverageScope>('country');
  const [type, setType] = useState<'data' | 'unlimited'>('data');
  const [days, setDays] = useState<number | null>(null);
  const [dataPick, setDataPick] = useState<number | 'unlimited' | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('value');
  const [picked, setPicked] = useState<string | null>(null);
  const [details, setDetails] = useState(false);

  // Each destination starts from the same defaults.
  useEffect(() => {
    setScope('country'); setType('data'); setDays(null); setDataPick(null); setSortBy('value'); setPicked(null); setDetails(false);
  }, [countryCode]);

  const scoped = useMemo(() => splitByScope(bundles), [bundles]);
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
    const sorted = sortBundles(pool, sortBy);
    const pop = popularPlanNames(sorted);
    return { list: [...sorted.filter((b) => pop.has(b.name)), ...sorted.filter((b) => !pop.has(b.name))], popular: pop };
  }, [byDays, effData, sortBy]);

  // Keep a plan selected: the one tapped if it is still listed, else the first.
  const selected = list.find((b) => bundleKey(b) === picked) ?? list[0] ?? null;

  const img = countryImage(countryCode ?? undefined, 900);
  const sheetH = Math.round(height * 0.92);
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close plans" />
      <View style={[s.sheet, { height: sheetH, backgroundColor: themeColors.background }]}>
        {/* Header: the destination's photo, flag and name. */}
        <View style={s.head}>
          <LinearGradient colors={[ESIM_RED, '#7F1D1D']} style={StyleSheet.absoluteFill} />
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.8)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          <View style={s.grabber} />
          <Pressable onPress={onClose} style={s.close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          <View style={s.headPill}><EsimPill /></View>
          <View style={s.headFoot}>
            {countryCode ? <CountryFlag countryCode={countryCode} size={30} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.headName} numberOfLines={1}>{countryName ?? countryCode}</Text>
              <Text style={s.headSub}>
                {loading ? 'Finding plans…' : `${inScope.length} ${effScope === 'global' ? 'regional / global' : 'local'} plans · instant QR`}
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={s.state}><ActivityIndicator color={ESIM_RED} size="large" /><Text style={[s.stateText, { color: themeColors.textSecondary }]}>Loading plans…</Text></View>
        ) : error ? (
          <View style={s.state}>
            <Ionicons name="cloud-offline-outline" size={36} color={themeColors.textTertiary} />
            <Text style={[s.stateText, { color: themeColors.textSecondary }]}>{error}</Text>
            <Pressable onPress={onRetry} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={[s.body, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
              {scoped.country.length > 0 && scoped.global.length > 0 ? (
                <Seg
                  value={effScope}
                  onChange={setScope}
                  items={[
                    { key: 'country', label: `${countryName ?? 'Country'} only · ${scoped.country.length}` },
                    { key: 'global', label: `Regional · ${scoped.global.length}` },
                  ]}
                />
              ) : null}
              {byType.data.length > 0 && byType.unlimited.length > 0 ? (
                <Seg value={effType} onChange={setType} items={[{ key: 'data', label: 'Standard' }, { key: 'unlimited', label: 'Unlimited', badge: 'NEW' }]} />
              ) : null}
              {effScope === 'global' ? (
                <View style={s.warn}>
                  <Ionicons name="information-circle" size={16} color={ESIM_RED} />
                  <Text style={[s.warnText, { color: themeColors.textSecondary }]}>
                    Regional plans cover many countries but give you a foreign number and usually cost more.
                    {scoped.country.length ? ` For a trip only to ${countryName}, a local plan is cheaper.` : ''}
                  </Text>
                </View>
              ) : null}
              {dayOptions.length > 1 ? (
                <Chips label="DURATION" icon="time-outline" value={effDays} onChange={setDays}
                  options={dayOptions.map((d) => ({ value: d, label: `${d} day${d === 1 ? '' : 's'}` }))} />
              ) : null}
              {dataOptions.length > 1 ? <Chips label="DATA" icon="cellular-outline" value={effData} onChange={setDataPick} options={dataOptions} /> : null}

              <View style={s.listHead}>
                <Text style={[s.listTitle, { color: themeColors.text }]}>{list.length} plan{list.length === 1 ? '' : 's'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
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

              {list.length === 0 ? (
                <Text style={[s.stateText, { color: themeColors.textSecondary, textAlign: 'center', marginTop: 20 }]}>No plans match these filters.</Text>
              ) : (
                <View style={{ gap: 14, marginTop: 4 }}>
                  {list.map((b) => (
                    <EsimPlanRow
                      key={bundleKey(b)}
                      plan={b}
                      popular={popular.has(b.name)}
                      selected={selected ? bundleKey(selected) === bundleKey(b) : false}
                      showCoverage={effScope === 'global'}
                      onPress={() => setPicked(bundleKey(b))}
                    />
                  ))}
                </View>
              )}

              {list.length > 0 ? (
                <Pressable onPress={() => setDetails((v) => !v)} style={[s.detailsBtn, { borderColor: line }]}>
                  <Ionicons name="list-outline" size={16} color={themeColors.text} />
                  <Text style={[s.detailsText, { color: themeColors.text }]}>Product details & why eSIM</Text>
                  <Ionicons name={details ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textTertiary} />
                </Pressable>
              ) : null}
              {details && list.length > 0 ? (
                <View style={{ marginHorizontal: -16 }}>
                  <EsimProductDetails plans={list} scope={effScope} countryName={countryName ?? countryCode ?? ''} countryCode={countryCode ?? ''} />
                </View>
              ) : null}
            </ScrollView>

            {/* What you are buying, always in reach. */}
            {selected ? (
              <View style={[s.bar, { paddingBottom: 12 + insets.bottom, backgroundColor: themeColors.surface, borderTopColor: line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.barPlan, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {dataLabelFor(selected)} · {selected.durationDays} days
                  </Text>
                  <Text style={[s.barPrice, { color: themeColors.text }]}>{inr(selected.sellingPrice ?? 0)}</Text>
                </View>
                <Pressable onPress={() => onBuy(selected)} accessibilityRole="button">
                  <LinearGradient colors={['#FF3344', ESIM_RED, '#C30E11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.buy}>
                    <Text style={s.buyText}>Buy now</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Modal>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  head: { height: 170, overflow: 'hidden' },
  grabber: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  close: { position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  headPill: { position: 'absolute', top: 20, left: 16 },
  headFoot: { position: 'absolute', left: 18, right: 18, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headName: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  headSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, fontWeight: '600', marginTop: 1 },

  body: { padding: 16, gap: 14 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11 },
  segOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 13, fontWeight: '700' },
  newBadge: { backgroundColor: ESIM_RED, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1 },
  newBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: '900' },
  warn: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(230,20,23,0.06)', borderRadius: 12, padding: 10 },
  warnText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  chipLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  listHead: { gap: 8, marginTop: 4 },
  listTitle: { fontSize: 17, fontWeight: '800' },
  sort: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  sortText: { fontSize: 12, fontWeight: '700' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 6 },
  detailsText: { flex: 1, fontSize: 14, fontWeight: '700' },

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { fontSize: 14 },
  retry: { backgroundColor: ESIM_RED, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '800' },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  barPlan: { fontSize: 12.5, fontWeight: '600' },
  barPrice: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  buyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
