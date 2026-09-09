// CompleteYourTrip — post-booking cross-sell rail shown on the bookings screen.
// After someone has booked one thing, nudge the complementary Prayana inventory
// they can add to the same trip (activities, packages, outstation cabs, eSIM,
// monument tickets). Static category cards → deep links; no API calls, so it's
// always available and never blocks the list. `exclude` hides the category the
// current tab is about (don't cross-sell packages on the Packages tab).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

type Item = {
  key: string;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const ITEMS: Item[] = [
  { key: 'activity', label: 'Things to do', sub: 'Tours & experiences', icon: 'balloon', color: '#0D9488', route: '/activities' },
  { key: 'package', label: 'Holiday packages', sub: 'Ready-made trips', icon: 'airplane', color: '#7C3AED', route: '/packages' },
  { key: 'cab', label: 'Outstation cabs', sub: 'Intercity rides', icon: 'car-sport', color: '#F59E0B', route: '/outstation-cabs' },
  { key: 'esim', label: 'Travel eSIM', sub: 'Stay connected', icon: 'wifi', color: '#E11D48', route: '/esim' },
  { key: 'monument', label: 'Monument tickets', sub: 'Skip the queue', icon: 'business', color: '#E38B29', route: '/monuments' },
];

export function CompleteYourTrip({
  exclude,
  title = 'Complete your trip',
  subtitle = 'Everything else you can book on Prayana',
}: {
  exclude?: string;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { themeColors } = useTheme();
  const items = ITEMS.filter((i) => i.key !== exclude);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>{subtitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((it) => (
          <TouchableOpacity
            key={it.key}
            style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            activeOpacity={0.85}
            onPress={() => router.push(it.route as any)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${it.color}1A` }]}>
              <Ionicons name={it.icon} size={20} color={it.color} />
            </View>
            <Text style={[styles.label, { color: themeColors.text }]} numberOfLines={1}>{it.label}</Text>
            <Text style={[styles.cardSub, { color: themeColors.textSecondary }]} numberOfLines={1}>{it.sub}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, paddingHorizontal: spacing.lg },
  sub: { fontSize: fontSize.sm, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: spacing.md },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg },
  card: { width: 130, borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md, gap: 6 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  cardSub: { fontSize: fontSize.xs },
});

export default CompleteYourTrip;
