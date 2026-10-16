import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight } from '@prayana/shared-ui';
import { inkColors } from './ishaInk';

// "Plan a trip" in the chat: just where to. Picking a place asks Isha ("I
// want to plan a trip to Goa"), which brings the place's photos, a short
// overview with the best months and the trip options already filled in.
// (This used to be a form of its own that built a plan straight away,
// without any of that.) `onPick(null)` asks her to help choose.

const IN_SEASON = [
  { months: [9, 10, 11, 0, 1], places: ['Goa', 'Rajasthan', 'Kerala', 'Andaman', 'Dubai', 'Thailand', 'Bali', 'Vietnam'] },
  { months: [2, 3, 4, 5], places: ['Manali', 'Kashmir', 'Darjeeling', 'Ladakh', 'Bali', 'Singapore', 'Switzerland', 'Paris'] },
  { months: [6, 7, 8], places: ['Ladakh', 'Coorg', 'Munnar', 'Meghalaya', 'Spiti Valley', 'Bali', 'Switzerland', 'Maldives'] },
];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function TripDestinationPicker({ isDark, onPick }: {
  isDark: boolean;
  onPick: (destination: string | null) => void;
}) {
  const c = inkColors(isDark);
  const [place, setPlace] = useState('');
  const month = new Date().getMonth();
  const suggestions = (IN_SEASON.find((s) => s.months.includes(month)) || IN_SEASON[0]).places;
  const go = (destination: string) => {
    const d = destination.trim();
    if (d) onPick(d);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Where do you want to go?</Text>
      <Text style={[styles.sub, { color: c.muted }]}>
        A city, a state or a country. I'll show you the place, the best time to go, and plan it with you.
      </Text>

      <View style={styles.searchRow}>
        <View style={[styles.inputWrap, { backgroundColor: c.input, borderColor: c.inputBorder }]}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={place}
            onChangeText={setPlace}
            placeholder="Goa, Kerala, Bali, Paris…"
            placeholderTextColor={c.muted}
            returnKeyType="go"
            onSubmitEditing={() => go(place)}
            autoCorrect={false}
            accessibilityLabel="Where do you want to go?"
            style={[styles.input, { color: c.text }]}
          />
        </View>
        <TouchableOpacity
          onPress={() => go(place)}
          disabled={!place.trim()}
          accessibilityRole="button"
          accessibilityLabel="Plan this trip"
          style={[styles.goBtn, { backgroundColor: place.trim() ? c.ink : c.track }]}
        >
          <Ionicons name="arrow-forward" size={20} color={place.trim() ? c.onInk : c.muted} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: c.label }]}>Good in {MONTH[month]}</Text>
      <View style={styles.chips}>
        {suggestions.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => go(s)}
            accessibilityRole="button"
            style={[styles.chip, { borderColor: c.optionBorder, backgroundColor: c.surface }]}
          >
            <Ionicons name="location-outline" size={13} color={c.muted} />
            <Text style={[styles.chipText, { color: c.text }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={() => onPick(null)} accessibilityRole="button" style={styles.helpRow}>
        <Ionicons name="sparkles-outline" size={14} color={c.label} />
        <Text style={[styles.helpText, { color: c.label }]}>Not sure yet? Help me choose</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 12 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  sub: { fontSize: fontSize.sm, lineHeight: 19, marginTop: -6 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  goBtn: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12.5, fontWeight: fontWeight.semibold, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13 },
  chipText: { fontSize: fontSize.sm },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  helpText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
