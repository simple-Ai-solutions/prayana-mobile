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
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header in NORMAL layout flow, NOT overlaid. A Google MapView is a
          native view that hit-tests before RN siblings, so anything floating on
          top of it (even with zIndex) swallows its own taps — that is why the
          back button did nothing. Keeping the header out of the map's rectangle
          is the only reliable fix. */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>{name}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setMapType((t) => (t === 'standard' ? 'hybrid' : 'standard'))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={mapType === 'standard' ? 'earth' : 'map'} size={21} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      {/* The map owns the rest of the screen. */}
      <View style={styles.mapWrap}>
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
            <Text style={styles.noCoordsText}>Map location isn&apos;t available for this place.</Text>
          </View>
        )}

        {/* Recentre still floats, but it is a deliberate map control — the map
            swallowing a stray tap here is harmless, unlike navigation. */}
        {hasCoords ? (
          <TouchableOpacity style={styles.recenter} onPress={recenter} activeOpacity={0.85}>
            <Ionicons name="locate" size={20} color="#111827" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom info card — also in normal flow, below the map. */}
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
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

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.md, fontWeight: fontWeight.bold },

  mapWrap: { flex: 1 },

  recenter: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.98)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    zIndex: 100, elevation: 30,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth,
  },
  cardName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cardAddress: { fontSize: fontSize.xs, marginTop: 3, lineHeight: 17 },
  dirBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 11,
  },
  dirBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
