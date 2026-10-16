// DeparturePicker — the batch picker for fixed-date treks, ported from the
// web's components/activities/DeparturePicker.jsx: month tabs, then a pill per
// departure (day, date, seats left), coloured available / selling fast / sold
// out, and under it the chosen batch's "Departs Fri · Trek Sat" pairing with a
// seats bar. Replaces the plain calendar for multi-day trips.
//
// Fed by GET /activities/:id/departures. Renders nothing when the activity has
// no fixed departures (onHasDepartures(false)), and the caller keeps its
// normal date picker.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeAPICall } from '@prayana/shared-services';
import { useTheme } from '@prayana/shared-ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORANGE = '#F97316';

type Departure = {
  _id: string;
  date: string;
  trekDate?: string;
  capacity: number;
  booked: number;
  available: number;
  soldOut: boolean;
};

/** "YYYY-MM-DD" in local time — the key the booking screen works in. */
export const departureKey = (d: string | Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const monthKey = (d: string) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
const shortDate = (d: string) => {
  const x = new Date(d);
  return `${DAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`;
};

export function DeparturePicker({ activityId, value, onChange, onHasDepartures }: {
  activityId: string;
  /** Selected departure as "YYYY-MM-DD". */
  value: string;
  onChange: (key: string) => void;
  onHasDepartures?: (has: boolean) => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [departures, setDepartures] = useState<Departure[] | null>(null); // null = loading
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res: any = await makeAPICall(`/activities/${activityId}/departures`);
      const list: Departure[] = res?.success ? (res.data || []) : [];
      setDepartures(list);
      onHasDepartures?.(list.length > 0);
      if (list.length) setActiveMonth((m) => m ?? monthKey(list[0].date));
    } catch {
      setDepartures([]);
      onHasDepartures?.(false);
    }
  };

  useEffect(() => {
    if (activityId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  // Pre-pick the soonest open batch so a single-batch trek needs no tap; only
  // when the current value isn't already a bookable departure.
  useEffect(() => {
    if (!departures || departures.length === 0) return;
    const valueIsValid = value && departures.some((d) => departureKey(d.date) === value && !d.soldOut);
    if (valueIsValid) return;
    const firstOpen = departures.find((d) => !d.soldOut && (d.available ?? 0) > 0);
    if (firstOpen) {
      onChange(departureKey(firstOpen.date));
      setActiveMonth(monthKey(firstOpen.date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departures]);

  const months = useMemo(() => {
    if (!departures) return [];
    const map = new Map<string, { key: string; short: string; items: Departure[] }>();
    for (const d of departures) {
      const mk = monthKey(d.date);
      if (!map.has(mk)) map.set(mk, { key: mk, short: MONTHS[new Date(d.date).getMonth()], items: [] });
      map.get(mk)!.items.push(d);
    }
    return [...map.values()];
  }, [departures]);

  const activeItems = useMemo(
    () => months.find((m) => m.key === activeMonth)?.items || [],
    [months, activeMonth],
  );
  const selected = useMemo(
    () => (departures || []).find((d) => departureKey(d.date) === value) || null,
    [departures, value],
  );

  if (departures === null) {
    return (
      <View style={[styles.loading, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }
  if (departures.length === 0) return null; // caller falls back to the calendar

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 400);
  };

  const muted = themeColors.textSecondary;
  const border = isDarkMode ? '#374151' : '#E5E7EB';

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.headTitle, { color: themeColors.text }]}>Batches available</Text>
        <Pressable onPress={refresh} hitSlop={8} style={styles.refresh} accessibilityLabel="Refresh availability">
          {refreshing
            ? <ActivityIndicator size="small" color={muted} />
            : <Ionicons name="refresh" size={14} color={muted} />}
          <Text style={[styles.refreshText, { color: muted }]}>Refresh</Text>
        </Pressable>
      </View>

      {months.length > 1 && (
        <View style={[styles.tabs, { borderBottomColor: border }]}>
          {months.map((m) => {
            const on = activeMonth === m.key;
            return (
              <Pressable key={m.key} onPress={() => setActiveMonth(m.key)} style={styles.tab}>
                <Text style={[styles.tabText, { color: on ? ORANGE : muted }]}>{m.short}</Text>
                {on && <View style={styles.tabLine} />}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.pills}>
        {activeItems.map((d) => {
          const key = departureKey(d.date);
          const dt = new Date(d.date);
          const isSelected = value === key;
          const low = !d.soldOut && d.available <= 5;
          const pillStyle = d.soldOut
            ? { borderColor: isDarkMode ? 'rgba(127,29,29,0.4)' : '#FECACA', backgroundColor: isDarkMode ? 'rgba(127,29,29,0.1)' : 'rgba(254,242,242,0.6)' }
            : isSelected
              ? { borderColor: ORANGE, backgroundColor: ORANGE }
              : low
                ? { borderColor: isDarkMode ? '#9A3412' : '#FDBA74', backgroundColor: isDarkMode ? 'rgba(124,45,18,0.2)' : '#FFF7ED' }
                : { borderColor: border, backgroundColor: 'transparent' };
          const textColor = d.soldOut ? '#F87171' : isSelected ? '#fff' : low ? (isDarkMode ? '#FDBA74' : '#C2410C') : themeColors.text;
          return (
            <Pressable
              key={d._id}
              disabled={d.soldOut}
              onPress={() => onChange(key)}
              style={[styles.pill, pillStyle, isSelected && styles.pillSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: d.soldOut }}
              accessibilityLabel={`${shortDate(d.date)}, ${d.soldOut ? 'sold out' : `${d.available} seats left`}`}
            >
              <Text style={[styles.pillDay, { color: textColor }]}>{DAYS[dt.getDay()].toUpperCase()}</Text>
              <Text style={[styles.pillDate, { color: textColor }, d.soldOut && styles.strike]}>{dt.getDate()}</Text>
              <Text style={[styles.pillLeft, { color: textColor }]}>
                {d.soldOut ? 'Sold out' : `${d.available} left`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected && !selected.soldOut && (
        <View style={[styles.detail, { borderColor: border, backgroundColor: isDarkMode ? 'rgba(31,41,55,0.5)' : '#F9FAFB' }]}>
          <Text style={[styles.detailTitle, { color: themeColors.text }]}>
            Departs {shortDate(selected.date)}
            {selected.trekDate && departureKey(selected.trekDate) !== departureKey(selected.date) && (
              <Text style={[styles.detailTrek, { color: muted }]}>  ·  Trek {shortDate(selected.trekDate)}</Text>
            )}
          </Text>
          <View style={styles.detailRow}>
            <View style={styles.seats}>
              <Ionicons name="people-outline" size={16} color={muted} />
              <Text style={{ color: muted, fontSize: 13 }}>
                <Text style={{ fontWeight: '800', color: selected.available <= 5 ? '#EA580C' : '#059669' }}>
                  {selected.available}
                </Text>
                {' '}of {selected.capacity} left
              </Text>
            </View>
            {selected.available <= 5 && (
              <View style={styles.fast}>
                <Ionicons name="warning-outline" size={13} color="#EA580C" />
                <Text style={styles.fastText}>SELLING FAST</Text>
              </View>
            )}
          </View>
          <View style={[styles.bar, { backgroundColor: border }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${selected.capacity ? Math.min(100, (selected.booked / selected.capacity) * 100) : 0}%`,
                  backgroundColor: selected.available <= 5 ? '#EF4444' : '#10B981',
                },
              ]}
            />
          </View>
          {selected.booked > 0 && (
            <Text style={[styles.booked, { color: muted }]}>{selected.booked} already booked</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { height: 96, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wrap: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontSize: 14, fontWeight: '700' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshText: { fontSize: 12, fontWeight: '500' },
  tabs: { flexDirection: 'row', gap: 4, borderBottomWidth: 1 },
  tab: { paddingHorizontal: 12, paddingVertical: 8 },
  tabText: { fontSize: 14, fontWeight: '700' },
  tabLine: { position: 'absolute', left: 12, right: 12, bottom: -1, height: 2, borderRadius: 1, backgroundColor: ORANGE },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minWidth: 64, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1,
  },
  pillSelected: {
    shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  pillDay: { fontSize: 10, letterSpacing: 0.6, opacity: 0.75 },
  pillDate: { fontSize: 17, fontWeight: '800', lineHeight: 21 },
  pillLeft: { fontSize: 10, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  detail: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  detailTitle: { fontSize: 14, fontWeight: '700' },
  detailTrek: { fontWeight: '500' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fast: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fastText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: '#EA580C' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  booked: { fontSize: 11 },
});
