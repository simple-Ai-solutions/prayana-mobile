// "More to explore": icon tiles linking to the collections that used to sit on
// home as full photo carousels (pilgrimages, regions, interests, abroad, things
// to do). Home showed ten carousels and swiping got heavy on mid-range phones;
// these keep each collection one tap away without drawing any photos.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { SectionHeader, SECTION_PAD } from './SectionHeader';

const TILES = [
  { label: 'Pilgrimage Sites', sub: 'Temples & yatras', icon: 'flame', tint: '#E38B29', route: '/divya-darshana' },
  { label: 'India by Region', sub: 'North, South, East, West', icon: 'map', tint: '#2563EB', route: '/india-experiences' },
  { label: 'Trips by Interest', sub: 'Hills, beaches, romance…', icon: 'compass', tint: '#0D9488', route: '/theme-itineraries' },
  { label: 'Go Abroad', sub: 'Visa-free & worldwide', icon: 'airplane', tint: '#7C3AED', route: '/global-experiences' },
  { label: 'Things to Do', sub: 'Tours, wildlife, food', icon: 'ticket', tint: '#E11D48', route: '/activities' },
] as const;

export function MoreToExplore() {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <View style={styles.section}>
      <SectionHeader title="More to explore" />
      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable
            key={t.route}
            onPress={() => router.push(t.route as any)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${t.label}: ${t.sub}`}
          >
            <View style={[styles.icon, { backgroundColor: isDarkMode ? `${t.tint}33` : `${t.tint}1A` }]}>
              <Ionicons name={t.icon} size={20} color={t.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: themeColors.text }]} numberOfLines={1}>{t.label}</Text>
              <Text style={[styles.sub, { color: themeColors.textSecondary }]} numberOfLines={1}>{t.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32 },
  grid: { paddingHorizontal: SECTION_PAD, gap: 10 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12.5, marginTop: 2 },
});
