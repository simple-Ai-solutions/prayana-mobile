// TripEssentials — the full Essentials tab content shared by both the
// Plan-a-Trip (trip/itinerary) and Quick Itinerary (quick-itinerary/result)
// screens. Composes: Weather, Bookings, Documents checklist, Packing List,
// Emergency Contacts + SOS. One import keeps both screens in sync.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { TripBookings } from './TripBookings';
import { PackingList } from './PackingList';
import { EmergencyContacts } from './EmergencyContacts';
import WeatherBadge from './WeatherBadge';
import SOSButton from './SOSButton';

interface Props {
  destination: string;
}

// Travel-documents checklist — distinct from PackingList's packables;
// these are the paperwork items travelers most often forget.
const DOC_ITEMS = [
  'Passport (6+ months validity)',
  'Visa / e-Visa printout',
  'Flight / train tickets',
  'Hotel booking confirmations',
  'Travel insurance policy',
  'ID card (Aadhaar / DL)',
  'Passport-size photos',
  'Emergency contact list',
  'Vaccination certificate',
  'Forex / cards activated',
];

export const TripEssentials: React.FC<Props> = ({ destination }) => {
  const { themeColors } = useTheme();
  const docKey = `docs:${(destination || 'trip').toLowerCase()}`;
  const [docsChecked, setDocsChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(docKey);
        if (saved) setDocsChecked(JSON.parse(saved));
      } catch {}
    })();
  }, [docKey]);

  const toggleDoc = useCallback((item: string) => {
    setDocsChecked((prev) => {
      const next = { ...prev, [item]: !prev[item] };
      AsyncStorage.setItem(docKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [docKey]);

  const docsDone = DOC_ITEMS.filter((i) => docsChecked[i]).length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Weather card */}
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="partly-sunny" size={16} color="#0284C7" />
          </View>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Weather in {destination}</Text>
          <View style={{ flex: 1 }} />
          <WeatherBadge destinationName={destination} />
        </View>
        <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
          Tap the badge for feels-like, humidity & wind. Pack accordingly.
        </Text>
      </View>

      {/* Bookings (Stay · Things to Do · Transport · eSIM) */}
      <TripBookings destination={destination} />

      {/* Travel Documents checklist */}
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="document-text" size={16} color="#7C3AED" />
          </View>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Travel Documents</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.docProgress}>{docsDone}/{DOC_ITEMS.length}</Text>
        </View>
        {DOC_ITEMS.map((item) => {
          const done = !!docsChecked[item];
          return (
            <TouchableOpacity
              key={item}
              style={styles.docRow}
              onPress={() => toggleDoc(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, done && styles.checkboxDone]}>
                {done && <Ionicons name="checkmark" size={12} color="#ffffff" />}
              </View>
              <Text style={[styles.docText, { color: themeColors.text }, done && styles.docTextDone]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Packing List */}
      <PackingList destination={destination} />

      {/* Emergency Contacts + SOS */}
      <EmergencyContacts destination={destination} />
      <View style={styles.sosWrap}>
        <SOSButton destinationName={destination} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cardSub: { fontSize: fontSize.xs, lineHeight: 18 },
  docProgress: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#7C3AED' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#C4B5FD',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  docText: { fontSize: fontSize.sm, flex: 1 },
  docTextDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  sosWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
});

export default TripEssentials;
