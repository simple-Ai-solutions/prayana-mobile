// TripBookings — quick links to book the trip essentials (stays, transport,
// activities, eSIM) from the itinerary. Mirrors the PWA "add to trip" panels;
// routes into the app's existing booking features, scoped to the destination.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bed, Car, Ticket, Wifi, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';

const TEAL = '#2EC4B6';

interface Props {
  destination: string;
}

export const TripBookings: React.FC<Props> = ({ destination }) => {
  const { themeColors } = useTheme();
  const city = encodeURIComponent(destination || '');

  const rows = [
    { id: 'stay', icon: Bed, color: '#3B82F6', title: 'Book a Stay', sub: `Hotels & homestays in ${destination}`, go: () => router.push(`/hotels?city=${city}` as any) },
    { id: 'activities', icon: Ticket, color: '#F97316', title: 'Things to Do', sub: 'Tours, tickets & experiences', go: () => router.push(`/global-experiences?city=${city}` as any) },
    { id: 'transport', icon: Car, color: '#10B981', title: 'Rent a Vehicle', sub: 'Cars, bikes & self-drive', go: () => router.push('/transport' as any) },
    { id: 'esim', icon: Wifi, color: '#6366F1', title: 'Travel eSIM', sub: 'Stay connected on your trip', go: () => router.push('/esim' as any) },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.text }]}>Book your trip essentials</Text>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>Everything you need for {destination}</Text>

      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <TouchableOpacity
            key={r.id}
            style={[styles.row, shadow.sm, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            activeOpacity={0.85}
            onPress={r.go}
          >
            <View style={[styles.iconWrap, { backgroundColor: r.color + '22' }]}>
              <Icon size={20} color={r.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: themeColors.text }]}>{r.title}</Text>
              <Text style={[styles.rowSub, { color: themeColors.textTertiary }]} numberOfLines={1}>{r.sub}</Text>
            </View>
            <ChevronRight size={20} color={themeColors.textTertiary} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, marginTop: 2, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  rowSub: { fontSize: fontSize.xs, marginTop: 2 },
});
