// "Booked trips": the treks, activities and holiday packages the traveller has
// paid for (or is paying for) and hasn't done yet, at the top of My Trips.
// They used to live only under Profile → Bookings, so people opened My Trips,
// saw their itineraries, and couldn't find the trek they had booked.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { bookingAPI, holidayPackagesAPI } from '@prayana/shared-services';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { SECTION_TITLE } from '../../lib/typeScale';

const MAX_SHOWN = 3;
const ACTIVITY_LIVE = new Set(['pending', 'pending_capture', 'payment_pending', 'confirmed']);
const PACKAGE_LIVE = new Set(['pending', 'pending_payment', 'partially_paid', 'confirmed', 'modifications_requested', 'in_progress']);

type Item = { id: string; kind: 'activity' | 'package'; title: string; image?: string; date: Date; status: string; ref?: string };

function dayDiff(d: Date) {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function whenText(d: Date) {
  const n = dayDiff(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

export function UpcomingBookings({ refreshKey = 0 }: { refreshKey?: number }) {
  const { themeColors, isDarkMode } = useTheme();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [acts, pkgs] = await Promise.all([
        bookingAPI.getMyBookings().catch(() => null),
        holidayPackagesAPI.getMyBookings().catch(() => null),
      ]);
      const out: Item[] = [];
      for (const b of (acts as any)?.data || []) {
        const date = new Date(b.bookingDate);
        if (!ACTIVITY_LIVE.has(b.status) || Number.isNaN(+date) || dayDiff(date) < 0) continue;
        out.push({
          id: b._id, kind: 'activity', title: b.activity?.title || 'Your booking',
          image: b.activity?.images?.[0], date, status: b.status, ref: b.bookingReference,
        });
      }
      for (const b of (pkgs as any)?.data || []) {
        const date = new Date(b.travelStartDate || b.travelDate);
        if (!PACKAGE_LIVE.has(b.status) || Number.isNaN(+date) || dayDiff(date) < 0) continue;
        out.push({
          id: b._id, kind: 'package', title: b.packageSnapshot?.title || b.package?.title || 'Holiday package',
          image: b.packageSnapshot?.coverImage || b.package?.images?.[0], date, status: b.status, ref: b.bookingReference,
        });
      }
      out.sort((a, b) => +a.date - +b.date);
      if (alive) setItems(out);
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  if (!items.length) return null;

  const open = (it: Item) =>
    router.push((it.kind === 'activity' ? `/bookings/${it.id}` : '/bookings?category=packages&tab=upcoming') as any);

  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={[s.label, { color: themeColors.text }]}>Booked trips</Text>
        <Pressable onPress={() => router.push('/bookings?tab=upcoming' as any)} hitSlop={10}>
          <Text style={s.seeAll}>See all</Text>
        </Pressable>
      </View>
      {items.slice(0, MAX_SHOWN).map((it) => {
        const confirmed = it.status === 'confirmed' || it.status === 'in_progress';
        const img = it.image ? normalizeImageUrl(it.image) : '';
        return (
          <Pressable
            key={`${it.kind}:${it.id}`}
            onPress={() => open(it)}
            style={({ pressed }) => [
              s.row,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${it.title}, ${whenText(it.date)}`}
          >
            {img ? (
              <Image source={{ uri: img }} style={s.thumb} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[s.thumb, s.noThumb]}><Ionicons name="ticket" size={22} color="#f97316" /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: themeColors.text }]} numberOfLines={1}>{it.title}</Text>
              <Text style={[s.date, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {it.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                {it.ref ? ` · ${it.ref}` : ''}
              </Text>
              <View style={s.badges}>
                <View style={[s.badge, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.18)' : '#FFF1E7' }]}>
                  <Ionicons name="airplane" size={11} color="#f97316" />
                  <Text style={[s.badgeText, { color: '#EA580C' }]}>{whenText(it.date)}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: confirmed ? (isDarkMode ? 'rgba(22,163,74,0.2)' : '#DCFCE7') : (isDarkMode ? 'rgba(234,179,8,0.2)' : '#FEF9C3') }]}>
                  <Text style={[s.badgeText, { color: confirmed ? '#16A34A' : '#A16207' }]}>
                    {confirmed ? 'Confirmed' : 'Payment pending'}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 18, paddingHorizontal: 16, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...SECTION_TITLE },
  seeAll: { color: '#EA580C', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 1 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  noThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E7' },
  title: { fontSize: 15, fontWeight: '800' },
  date: { fontSize: 12.5, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
