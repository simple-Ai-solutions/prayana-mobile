// Divya Darshana — all-yatras listing, mobile port of the web
// app/divya-darshana/packages/page.js. Loads every Pilgrimage package once
// (holidayPackagesAPI.search({ category: 'Pilgrimage', limit: 100 })) then
// filters CLIENT-SIDE by circuit (regex over title+destinations) and duration
// (nights), sorted by starting price — exactly like the web. Cards route to the
// existing /packages/[id]. Zero new backend.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../lib/imageUrl';

// Devotional palette (matches the DD landing).
const MAROON = '#7A1F0A';
const DEEP = '#B8410E';
const SAFFRON = '#FF6F00';
const GOLD = '#D4AF37';
const CREAM = '#FFF8E7';

type Pkg = {
  _id: string;
  slug?: string;
  title: string;
  primaryDestination?: string;
  destination?: { city?: string; state?: string };
  destinations?: { name?: string; city?: string }[];
  duration?: { days: number; nights: number };
  pricing?: { startingFrom?: number };
  images?: { url: string; isPrimary?: boolean }[];
  tags?: string[] | string;
};

// Circuit filters — regex over title + destination names (web parity).
const CIRCUITS: { key: string; label: string; re?: RegExp }[] = [
  { key: 'all', label: 'All' },
  { key: 'helicopter', label: 'Helicopter' }, // matched via tags, handled separately
  { key: 'chardham', label: 'Char Dham', re: /char dham|do dham|kedarnath|badrinath|gangotri|yamunotri/i },
  { key: 'kashi', label: 'Kashi & Ayodhya', re: /varanasi|kashi|ayodhya|prayagraj|sarnath/i },
  { key: 'jyotirlinga', label: 'Jyotirlinga', re: /ujjain|omkareshwar|mahakal|baidyanath|deoghar|somnath/i },
  { key: 'buddhist', label: 'Buddhist', re: /bodhgaya|bodh gaya|sarnath|gaya/i },
];

const DURATIONS: { key: string; label: string; test: (n: number) => boolean }[] = [
  { key: 'any', label: 'Any length', test: () => true },
  { key: 'short', label: '≤ 3 nights', test: (n) => n <= 3 },
  { key: 'mid', label: '4–6 nights', test: (n) => n >= 4 && n <= 6 },
  { key: 'long', label: '7+ nights', test: (n) => n >= 7 },
];

const hay = (p: Pkg) =>
  `${p.title} ${p.primaryDestination || ''} ${(p.destinations || []).map((d) => d.name || d.city).join(' ')}`;
const tagsOf = (p: Pkg) => (Array.isArray(p.tags) ? p.tags.join(',') : String(p.tags || '')).toLowerCase();
const pkgImage = (p: Pkg) => {
  const url = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url;
  return url ? normalizeImageUrl(url) : null;
};
const pkgPlace = (p: Pkg) =>
  p.primaryDestination || p.destination?.city || p.destinations?.[0]?.name || p.destinations?.[0]?.city || '';

export default function DivyaDarshanaPackagesScreen() {
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{ filter?: string }>();

  const [all, setAll] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [circuit, setCircuit] = useState<string>(params.filter === 'helicopter' ? 'helicopter' : 'all');
  const [duration, setDuration] = useState<string>('any');

  const load = useCallback(async () => {
    try {
      const res: any = await holidayPackagesAPI.search({ category: 'Pilgrimage', limit: 100 });
      const list: Pkg[] =
        Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.packages) ? res.data.packages : Array.isArray(res?.packages) ? res.packages : [];
      setAll(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const durTest = DURATIONS.find((d) => d.key === duration)?.test || (() => true);
    let list = all.filter((p) => durTest(p.duration?.nights ?? 0));
    if (circuit === 'helicopter') {
      list = list.filter((p) => tagsOf(p).includes('helicopter'));
    } else if (circuit !== 'all') {
      const re = CIRCUITS.find((c) => c.key === circuit)?.re;
      if (re) list = list.filter((p) => re.test(hay(p)));
    }
    return list.slice().sort((a, b) => (a.pricing?.startingFrom || 0) - (b.pricing?.startingFrom || 0));
  }, [all, circuit, duration]);

  // Hide circuit chips that have zero matching stock (web behaviour).
  const availableCircuits = useMemo(
    () =>
      CIRCUITS.filter((c) => {
        if (c.key === 'all') return true;
        if (c.key === 'helicopter') return all.some((p) => tagsOf(p).includes('helicopter'));
        return c.re ? all.some((p) => c.re!.test(hay(p))) : true;
      }),
    [all]
  );

  // Open by _id, not slug — some slugs resolve to empty duplicate documents.
  const openPkg = (p: Pkg) => router.push(`/packages/${encodeURIComponent(p._id)}` as any);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: CREAM }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/divya-darshana'))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: MAROON }]}>All Yatras</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Circuit chips */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
          {availableCircuits.map((c) => {
            const active = circuit === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCircuit(c.key)}
                style={[styles.chip, { borderColor: active ? SAFFRON : themeColors.border, backgroundColor: active ? SAFFRON + '22' : 'transparent' }]}
              >
                {c.key === 'helicopter' && <Ionicons name="airplane" size={13} color={active ? SAFFRON : themeColors.textSecondary} />}
                <Text style={[styles.chipText, { color: active ? SAFFRON : themeColors.textSecondary }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Duration chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
          {DURATIONS.map((d) => {
            const active = duration === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                onPress={() => setDuration(d.key)}
                style={[styles.chipSm, { borderColor: active ? DEEP : themeColors.border, backgroundColor: active ? DEEP + '18' : 'transparent' }]}
              >
                <Text style={[styles.chipText, { color: active ? DEEP : themeColors.textSecondary }]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={SAFFRON} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Text style={[styles.count, { color: themeColors.textSecondary }]}>
            {filtered.length} yatra{filtered.length === 1 ? '' : 's'}
          </Text>
          {filtered.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="flower-outline" size={40} color={themeColors.textTertiary} />
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                No yatras match these filters. Try “All”.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filtered.map((p) => {
                const img = pkgImage(p);
                const place = pkgPlace(p);
                const price = p.pricing?.startingFrom || 0;
                const nights = p.duration?.nights ?? (p.duration?.days ? p.duration.days - 1 : 0);
                return (
                  <TouchableOpacity
                    key={p._id}
                    style={styles.card}
                    activeOpacity={0.9}
                    onPress={() => openPkg(p)}
                  >
                    <View style={styles.cardImgWrap}>
                      {img ? (
                        <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FCE7C8', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="flower" size={24} color={SAFFRON} />
                        </View>
                      )}
                      {p.duration?.days ? (
                        <View style={styles.cardDuration}>
                          <Text style={styles.cardDurationText}>{p.duration.days}D / {nights}N</Text>
                        </View>
                      ) : null}
                      {tagsOf(p).includes('helicopter') && (
                        <View style={styles.heliBadge}>
                          <Ionicons name="airplane" size={11} color="#fff" />
                        </View>
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={[styles.cardTitle, { color: MAROON }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{p.title}</Text>
                      {!!place && (
                        <Text style={[styles.cardPlace, { color: '#71717a' }]} numberOfLines={1}>{place}</Text>
                      )}
                      {price > 0 && (
                        <Text style={[styles.cardPrice, { color: DEEP }]}>
                          <Text style={[styles.cardPriceFrom, { color: '#71717a' }]}>from </Text>
                          ₹{price.toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  chipsWrap: { flexGrow: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7 },
  chipSm: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: spacing.md, flex: 1 },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center' },

  body: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 },
  count: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  // Two-up: 47.5% + 47.5% + space-between leaves the gutter between columns.
  // A `gap` here on top of two 47.5% cards overflows 100% and drops the second
  // card to the next row, leaving one narrow card per row (the "shrunk" look).
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },

  // No borderWidth — a 1px border + overflow:hidden let the full-bleed image
  // paint over the side border while the body respected it, so the image read
  // as wider than the card body. Define the card with its shadow instead.
  card: { width: '47.5%', backgroundColor: '#fff', borderTopLeftRadius: 60, borderTopRightRadius: 60, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden', shadowColor: MAROON, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  cardImgWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#FCE7C8' },
  cardDuration: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  cardDurationText: { fontSize: 10, fontWeight: '800', color: DEEP },
  heliBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: SAFFRON, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: spacing.md, gap: 4, alignItems: 'center' },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, lineHeight: 18, textAlign: 'center' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardPlace: { fontSize: fontSize.xs, flexShrink: 1 },
  cardPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 2 },
  cardPriceFrom: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },
});
