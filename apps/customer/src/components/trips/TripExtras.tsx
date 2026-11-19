// Under an upcoming trip's pass: the forecast for the day you leave (from
// Open-Meteo, as the trip screens use) and how much of the packing list is
// ticked, which opens the list in a sheet. Only for trips leaving within
// the forecast window (16 days) or under way.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@prayana/shared-ui';
import { geocodePlace } from '../../lib/geocode';
import { PackingList, packingKey, PACKING_TOTAL } from '../trip/PackingList';

const ICON: [number[], any][] = [
  [[0], 'sunny'], [[1, 2], 'partly-sunny'], [[3, 45, 48], 'cloudy'],
  [[51, 53, 55, 61, 63, 65, 80, 81], 'rainy'], [[71, 73, 75], 'snow'], [[82, 95, 96, 99], 'thunderstorm'],
];
const iconFor = (c: number): any => ICON.find(([cs]) => cs.includes(c))?.[1] || 'partly-sunny';

const forecasts = new Map<string, Promise<{ hi: number; lo: number; icon: any } | null>>();
function forecast(place: string, ymd: string) {
  const key = `${place}|${ymd}`;
  if (!forecasts.has(key)) {
    forecasts.set(key, (async () => {
      try {
        const g = await geocodePlace(place);
        if (!g) return null;
        const d = (await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&start_date=${ymd}&end_date=${ymd}`,
        ).then((r) => r.json()))?.daily;
        if (!d?.temperature_2m_max?.length) return null;
        return { hi: Math.round(d.temperature_2m_max[0]), lo: Math.round(d.temperature_2m_min[0]), icon: iconFor(d.weather_code[0]) };
      } catch {
        forecasts.delete(key);
        return null;
      }
    })());
  }
  return forecasts.get(key)!;
}

export function TripExtras({ place, start }: { place: string; start: Date }) {
  const { themeColors, isDarkMode } = useTheme();
  const [wx, setWx] = useState<{ hi: number; lo: number; icon: any } | null>(null);
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(false);

  // The forecast for the start day, or today's while the trip is on.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = start > today ? start : today;
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const label = day.getTime() === today.getTime() ? 'Today' : day.toLocaleDateString('en-IN', { weekday: 'short' });

  useEffect(() => {
    let alive = true;
    forecast(place, ymd).then((f) => alive && setWx(f));
    return () => { alive = false; };
  }, [place, ymd]);

  const readPacking = useCallback(() => {
    AsyncStorage.getItem(packingKey(place))
      .then((v) => setDone(v ? Object.values(JSON.parse(v)).filter(Boolean).length : 0))
      .catch(() => {});
  }, [place]);
  useEffect(readPacking, [readPacking]);

  const chipBg = isDarkMode ? '#1F2937' : '#F8FAFC';
  const allPacked = done >= PACKING_TOTAL;

  return (
    <View style={styles.row}>
      {wx && (
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Ionicons name={wx.icon} size={15} color="#F59E0B" />
          <Text style={[styles.chipText, { color: themeColors.text }]}>{wx.hi}° / {wx.lo}°</Text>
          <Text style={[styles.chipSub, { color: themeColors.textSecondary }]}>{label} in {place}</Text>
        </View>
      )}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.chip, styles.pack, { backgroundColor: allPacked ? '#DCFCE7' : isDarkMode ? 'rgba(249,115,22,0.15)' : '#FFF7ED' }, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={`Packing list, ${done} of ${PACKING_TOTAL} packed`}
      >
        <Ionicons name={allPacked ? 'checkmark-circle' : 'bag-handle-outline'} size={15} color={allPacked ? '#16A34A' : '#EA580C'} />
        <Text style={[styles.chipText, { color: allPacked ? '#166534' : isDarkMode ? '#FDBA74' : '#9A3412' }]}>
          {allPacked ? 'All packed' : `Packing ${done}/${PACKING_TOTAL}`}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setOpen(false); readPacking(); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'bottom']}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Pack for {place}</Text>
            <Pressable onPress={() => { setOpen(false); readPacking(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={themeColors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            <PackingList destination={place} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  pack: {},
  chipText: { fontSize: 13, fontWeight: '800' },
  chipSub: { fontSize: 12, fontWeight: '500' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
});

export default TripExtras;
