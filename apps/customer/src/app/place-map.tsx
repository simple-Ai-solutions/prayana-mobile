// /place-map — an in-app map for a single place. Opened from a place's "View on
// map" so the user stays inside the app instead of being kicked out to Google
// Maps. Tourist-friendly: a labelled marker, the place name + address card, a
// recentre button, a map/satellite toggle, and an opt-in "Directions" that
// hands off to the native maps app only when the user asks for turn-by-turn.
//
// Params: lat, lng (numbers as strings), name, address? — passed from any place.
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme, spacing, fontSize, fontWeight } from '@prayana/shared-ui';
import { goBack } from '../lib/goBack';

export default function PlaceMapScreen() {
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{ lat: string; lng: string; name: string; address?: string }>();
  const name = (Array.isArray(params.name) ? params.name[0] : params.name) || 'Location';
  const address = Array.isArray(params.address) ? params.address[0] : params.address;
  const lat = Number(Array.isArray(params.lat) ? params.lat[0] : params.lat);
  const lng = Number(Array.isArray(params.lng) ? params.lng[0] : params.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const mapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');

  const region = {
    latitude: hasCoords ? lat : 20.5937,
    longitude: hasCoords ? lng : 78.9629,
    latitudeDelta: hasCoords ? 0.02 : 20,
    longitudeDelta: hasCoords ? 0.02 : 20,
  };

  const recenter = () => {
    if (hasCoords) mapRef.current?.animateToRegion(region, 400);
  };

  // Opt-in handoff for turn-by-turn — the only time we leave the app, and only
  // because the user explicitly asked to navigate.
  const directions = () => {
    const q = hasCoords ? `${lat},${lng}` : encodeURIComponent(name + (address ? ` ${address}` : ''));
    const url = Platform.select({
      ios: `https://maps.apple.com/?daddr=${q}`,
      android: `google.navigation:q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    })!;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`).catch(() => {}),
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {hasCoords ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          mapType={mapType}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          toolbarEnabled={false}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} title={name} description={address} />
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noCoords]}>
          <Ionicons name="map-outline" size={44} color="#9CA3AF" />
          <Text style={styles.noCoordsText}>Map location isn't available for this place.</Text>
        </View>
      )}

      {/* Top bar — back + map/satellite toggle, over the map */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.circleBtn} onPress={() => goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.topTitleWrap} pointerEvents="none">
          <Text style={styles.topTitle} numberOfLines={1}>{name}</Text>
        </View>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => setMapType((t) => (t === 'standard' ? 'hybrid' : 'standard'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={mapType === 'standard' ? 'earth' : 'map'} size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Recenter — floats above the info card */}
      {hasCoords ? (
        <TouchableOpacity style={styles.recenter} onPress={recenter} activeOpacity={0.85}>
          <Ionicons name="locate" size={20} color="#111827" />
        </TouchableOpacity>
      ) : null}

      {/* Bottom info card — name, address, Directions */}
      <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: themeColors.text }]} numberOfLines={1}>{name}</Text>
          {!!address && (
            <Text style={[styles.cardAddress, { color: themeColors.textSecondary }]} numberOfLines={2}>{address}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.dirBtn} onPress={directions} activeOpacity={0.9}>
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={styles.dirBtnText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#e5e7eb' },
  noCoords: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: '#f3f4f6' },
  noCoordsText: { fontSize: fontSize.sm, color: '#6B7280', textAlign: 'center', paddingHorizontal: spacing.xl },

  topBar: {
    position: 'absolute', top: spacing.sm, left: spacing.lg, right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  topTitleWrap: {
    flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20, paddingVertical: 9, paddingHorizontal: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  topTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#111827' },

  recenter: {
    position: 'absolute', right: spacing.lg, bottom: 130,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.98)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },

  card: {
    position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: 18, padding: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  cardName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cardAddress: { fontSize: fontSize.xs, marginTop: 3, lineHeight: 17 },
  dirBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 11,
  },
  dirBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
