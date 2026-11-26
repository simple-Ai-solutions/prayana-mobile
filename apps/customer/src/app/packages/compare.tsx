// Compare 2–3 holiday packages side by side: price, price per day, length,
// rating, places, hotel, meals, what's included, dates and refunds. The best
// price and rating are marked green so the choice is quick. Every cell comes
// from the package itself; a dash means the package doesn't say.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import {
  nextDeparture, nightsDays, pkgImage, pkgPerkChecks, pkgPlaces, pkgPrice, shortTitle,
} from '../../components/packages/HolidayCards';
import { fallbackPhoto } from '../../lib/fallbackPhoto';
import { toggleCompare } from '../../lib/comparePackages';

const ORANGE = '#f97316';
const GREEN = '#16a34a';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const HOTEL_LABEL: Record<string, string> = {
  budget: '3-Star', standard: '3-Star Deluxe', premium: '4-Star', luxury: '4/5-Star',
};
const MEAL_LABEL: Record<string, string> = {
  EP: 'Room only', CP: 'Breakfast', MAP: 'Breakfast + Dinner', AP: 'All meals',
};

const defaultVariant = (p: any) => (p?.variants || []).find((v: any) => v?.isDefault) || p?.variants?.[0];

function refundLine(p: any): string {
  const rules: { daysBeforeTravel: number; refundPercent: number }[] = p?.cancellationPolicy?.rules || [];
  const full = rules.filter((r) => r.refundPercent >= 100).sort((a, b) => a.daysBeforeTravel - b.daysBeforeTravel)[0];
  if (full) return `Full refund till ${full.daysBeforeTravel} days before`;
  const part = rules.filter((r) => r.refundPercent > 0).sort((a, b) => b.refundPercent - a.refundPercent)[0];
  if (part) return `${part.refundPercent}% back till ${part.daysBeforeTravel} days before`;
  if (p?.cancellationPolicy?.type === 'non_refundable' || p?.cancellationPolicy?.type === 'non-refundable') return 'No refund';
  return '—';
}

export default function ComparePackagesScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const [pkgs, setPkgs] = useState<any[] | null>(null);

  useEffect(() => {
    const list = String(ids || '').split(',').filter(Boolean).slice(0, 3);
    let alive = true;
    Promise.all(list.map((id) => holidayPackagesAPI.getById(id).then((r: any) => r?.data || r?.package || null).catch(() => null)))
      .then((res) => { if (alive) setPkgs(res.filter(Boolean)); });
    return () => { alive = false; };
  }, [ids]);

  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const n = pkgs?.length || 1;
  const colW = (width - 32 - (n - 1) * 10) / n;

  const prices = (pkgs || []).map((p) => pkgPrice(p).price || Infinity);
  const perDay = (pkgs || []).map((p, i) => (Number(p?.duration?.days) > 0 && isFinite(prices[i]) ? prices[i] / Number(p.duration.days) : Infinity));
  const ratings = (pkgs || []).map((p) => Number(p?.rating?.average) || 0);
  const best = (arr: number[], low: boolean) => {
    const vals = arr.filter((x) => isFinite(x) && x > 0);
    if (vals.length < 2) return -1;
    const target = low ? Math.min(...vals) : Math.max(...vals);
    return vals.filter((v) => v === target).length === 1 ? arr.indexOf(target) : -1;
  };
  const cheapest = best(prices, true);
  const cheapestDay = best(perDay, true);
  const topRated = best(ratings, false);

  const Row = ({ label, cells }: { label: string; cells: React.ReactNode[] }) => (
    <View style={[st.row, { borderTopColor: line }]}>
      <Text style={[st.rowLabel, { color: themeColors.textTertiary }]}>{label}</Text>
      <View style={st.cells}>
        {cells.map((c, i) => (
          <View key={i} style={{ width: colW }}>{c}</View>
        ))}
      </View>
    </View>
  );
  const T = ({ children, good, bold }: { children: React.ReactNode; good?: boolean; bold?: boolean }) => (
    <Text style={[st.cell, { color: good ? GREEN : themeColors.text }, (bold || good) && { fontWeight: '800' }]}>{children}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top']}>
      <View style={[st.head, { borderBottomColor: line }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </Pressable>
        <Text style={[st.title, { color: themeColors.text }]}>Compare packages</Text>
      </View>

      {!pkgs ? (
        <View style={st.center}><ActivityIndicator color={ORANGE} /></View>
      ) : pkgs.length < 2 ? (
        <View style={st.center}>
          <Text style={{ color: themeColors.textSecondary }}>Pick at least 2 packages to compare.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Photo + name, tap to open; × removes from compare. */}
          <View style={st.cells}>
            {pkgs.map((p) => (
              <Pressable key={p._id} style={{ width: colW }} onPress={() => router.push(`/packages/${encodeURIComponent(p._id)}` as any)}>
                <View style={[st.photo, { height: n === 3 ? 90 : 120 }]}>
                  <Image source={{ uri: pkgImage(p) || fallbackPhoto(p) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                  <Pressable
                    onPress={() => {
                      toggleCompare(p._id);
                      const rest = pkgs.filter((x) => x._id !== p._id);
                      if (rest.length < 2) router.back();
                      else setPkgs(rest);
                    }}
                    hitSlop={8}
                    style={st.remove}
                    accessibilityLabel="Remove from compare"
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
                <Text style={[st.name, { color: themeColors.text }]} numberOfLines={3}>{shortTitle(p.title)}</Text>
              </Pressable>
            ))}
          </View>

          <Row label="PRICE PER PERSON" cells={pkgs.map((p, i) => (
            <T good={i === cheapest} bold>{isFinite(prices[i]) ? inr(prices[i]) : 'On request'}{i === cheapest ? '\nLowest' : ''}</T>
          ))} />
          <Row label="PER DAY" cells={pkgs.map((_, i) => (
            <T good={i === cheapestDay}>{isFinite(perDay[i]) ? inr(perDay[i]) : '—'}</T>
          ))} />
          <Row label="LENGTH" cells={pkgs.map((p) => <T>{nightsDays(p) || '—'}</T>)} />
          <Row label="RATING" cells={pkgs.map((p, i) => (
            <T good={i === topRated}>{ratings[i] ? `★ ${ratings[i].toFixed(1)}${p?.rating?.count ? ` (${p.rating.count})` : ''}` : 'New'}</T>
          ))} />
          <Row label="PLACES" cells={pkgs.map((p) => <T>{pkgPlaces(p) || '—'}</T>)} />
          <Row label="HOTEL" cells={pkgs.map((p) => {
            const c = defaultVariant(p)?.hotelCategory;
            return <T>{c ? HOTEL_LABEL[c] || c : '—'}</T>;
          })} />
          <Row label="MEALS" cells={pkgs.map((p) => {
            const m = defaultVariant(p)?.mealPlan;
            return <T>{m ? MEAL_LABEL[m] || m : '—'}</T>;
          })} />
          <Row label="INCLUDED" cells={pkgs.map((p) => (
            <View style={{ gap: 4 }}>
              {pkgPerkChecks(p).map((k) => (
                <View key={k.label} style={st.perk}>
                  <Ionicons name={k.has ? 'checkmark-circle' : 'close-circle-outline'} size={14} color={k.has ? GREEN : '#9ca3af'} />
                  <Text style={[st.perkText, { color: k.has ? themeColors.text : themeColors.textTertiary }]}>{k.label}</Text>
                </View>
              ))}
            </View>
          ))} />
          <Row label="DATES" cells={pkgs.map((p) => {
            const next = nextDeparture(p);
            return (
              <T>
                {p.packageType === 'fixed' ? 'Fixed dates' : 'Any date'}
                {next ? `\nNext: ${next.label}` : ''}
              </T>
            );
          })} />
          <Row label="CANCELLATION" cells={pkgs.map((p) => <T>{refundLine(p)}</T>)} />

          <View style={[st.cells, { marginTop: 18 }]}>
            {pkgs.map((p) => (
              <Pressable
                key={p._id}
                style={({ pressed }) => [st.cta, { width: colW }, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/packages/${encodeURIComponent(p._id)}` as any)}
                accessibilityRole="button"
              >
                <Text style={st.ctaText}>View deal</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cells: { flexDirection: 'row', gap: 10 },
  photo: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#fed7aa' },
  remove: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 4 },
  name: { fontSize: 13.5, fontWeight: '800', marginTop: 8, lineHeight: 18 },
  row: { borderTopWidth: 1, paddingVertical: 12, marginTop: 4 },
  rowLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  cell: { fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perkText: { fontSize: 12.5, fontWeight: '600' },
  cta: { backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
