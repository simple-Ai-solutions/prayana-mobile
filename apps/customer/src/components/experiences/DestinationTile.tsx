// DestinationTile — a 4:5 destination card from the web /global-experiences
// "Every wonder. One booking." rail (web DestinationTile). Hero photo, black
// bottom gradient, a glass caption with city + country + "{total} experiences",
// and an "Editor's pick · Vol 01" badge on the featured (first) tile.
import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CityGroup } from '../../lib/experiences';

const ORANGE = '#F97316';

interface Props {
  group: CityGroup;
  featured?: boolean;
  width?: number;
  onPress: (group: CityGroup) => void;
}

export const DestinationTile: React.FC<Props> = ({ group, featured, width = 210, onPress }) => (
  <Pressable
    onPress={() => onPress(group)}
    accessibilityRole="button"
    accessibilityLabel={`${group.city}, ${group.total} experiences`}
    style={({ pressed }) => [styles.tile, { width }, pressed && { opacity: 0.92 }]}
  >
    <View style={styles.imgWrap}>
      {group.heroImage ? (
        <Image source={{ uri: group.heroImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#FB923C', '#E11D48']} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {featured && (
        <LinearGradient
          colors={[ORANGE, '#D946EF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badge}
        >
          <Ionicons name="star" size={9} color="#FFFFFF" />
          <Text style={styles.badgeText}>EDITOR&apos;S PICK · VOL 01</Text>
        </LinearGradient>
      )}

      <View style={styles.caption}>
        <Text style={styles.city} numberOfLines={1}>
          {group.city}
        </Text>
        {!!group.country && (
          <Text style={styles.country} numberOfLines={1}>
            {group.country}
          </Text>
        )}
        <View style={styles.countRow}>
          <Text style={styles.count}>
            {group.total.toLocaleString('en-IN')} experience{group.total === 1 ? '' : 's'}
          </Text>
          <View style={styles.arrow}>
            <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </View>
  </Pressable>
);

export default DestinationTile;

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  imgWrap: { aspectRatio: 4 / 5, backgroundColor: '#E5E7EB' },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12 },
  city: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  country: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  count: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
