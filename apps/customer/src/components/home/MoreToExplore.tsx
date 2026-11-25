// "More to explore": the collections that used to sit on home as full photo
// carousels (pilgrimages, regions, interests, abroad, things to do), as
// gradient tiles — colourful, but no photos to download, so home stays light.
// One wide feature tile, then a 2×2 grid.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SectionHeader, SECTION_PAD } from './SectionHeader';

type Tile = { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; colors: [string, string]; route: string };

const FEATURE: Tile = { label: 'Pilgrimage Sites', sub: 'Char Dham, Tirumala, Vaishno Devi & more', icon: 'flame', colors: ['#B45309', '#7C2D12'], route: '/divya-darshana' };
const TILES: Tile[] = [
  { label: 'India by Region', sub: 'North to South', icon: 'map', colors: ['#2563EB', '#1E3A8A'], route: '/india-experiences' },
  { label: 'Trips by Interest', sub: 'Hills, beaches…', icon: 'compass', colors: ['#0D9488', '#115E59'], route: '/theme-itineraries' },
  { label: 'Go Abroad', sub: 'Visa-free & more', icon: 'airplane', colors: ['#7C3AED', '#4C1D95'], route: '/global-experiences' },
  { label: 'Things to Do', sub: 'Tours, food, wildlife', icon: 'ticket', colors: ['#E11D48', '#881337'], route: '/activities' },
];

function TileView({ t, wide }: { t: Tile; wide?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(t.route as any)}
      style={({ pressed }) => [wide ? s.wide : s.tile, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${t.label}: ${t.sub}`}
    >
      <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* A large faint icon as the tile's "picture". */}
      <Ionicons name={t.icon} size={wide ? 120 : 86} color="rgba(255,255,255,0.13)" style={wide ? s.bgIconWide : s.bgIcon} />
      <View style={s.iconChip}>
        <Ionicons name={t.icon} size={18} color="#fff" />
      </View>
      <View style={{ marginTop: 'auto' }}>
        <Text style={[s.label, wide && { fontSize: 20 }]} numberOfLines={1}>{t.label}</Text>
        <View style={s.subRow}>
          <Text style={s.sub} numberOfLines={1}>{t.sub}</Text>
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.9)" />
        </View>
      </View>
    </Pressable>
  );
}

export function MoreToExplore() {
  return (
    <View style={s.section}>
      <SectionHeader title="More to explore" />
      <View style={s.grid}>
        <TileView t={FEATURE} wide />
        <View style={s.row}>
          <TileView t={TILES[0]} />
          <TileView t={TILES[1]} />
        </View>
        <View style={s.row}>
          <TileView t={TILES[2]} />
          <TileView t={TILES[3]} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingTop: 32 },
  grid: { paddingHorizontal: SECTION_PAD, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  wide: { height: 130, borderRadius: 20, overflow: 'hidden', padding: 16 },
  tile: { flex: 1, height: 128, borderRadius: 20, overflow: 'hidden', padding: 14 },
  bgIcon: { position: 'absolute', right: -14, bottom: -14 },
  bgIconWide: { position: 'absolute', right: -10, top: -10 },
  iconChip: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  sub: { flexShrink: 1, color: 'rgba(255,255,255,0.88)', fontSize: 12.5, fontWeight: '600' },
});
