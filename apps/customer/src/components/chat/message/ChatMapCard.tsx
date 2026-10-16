import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useIsha } from '../ishaTheme';
import type { ChatMap, LocalPlace } from '../types';

/**
 * Real places from search_local, ranked, with a map. The map holds still (no
 * dragging or zooming, so it can't take over the chat's scroll); tapping it
 * opens Google Maps, which is where directions belong anyway.
 */
export default function ChatMapCard({ map, places }: { map?: ChatMap | null; places: LocalPlace[] }) {
  const t = useIsha();
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  if (!places?.length) return null;

  const pins = (map?.pins || []).filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number').slice(0, 10);
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const region = pins.length
    ? {
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats), 0.02) * 1.6,
        longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs), 0.02) * 1.6,
      }
    : null;
  const allUrl = map?.center
    ? `https://www.google.com/maps/search/?api=1&query=${map.center.lat},${map.center.lng}`
    : null;

  return (
    <View style={[styles.card, { borderColor: t.border, backgroundColor: t.surface }]}>
      {region && (
        <Pressable onPress={() => allUrl && Linking.openURL(allUrl).catch(() => {})} accessibilityRole="button" accessibilityLabel="Open in Google Maps">
          <View pointerEvents="none">
            <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={region} liteMode scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}>
              {pins.map((p) => (
                <Marker key={`${p.index}-${p.lat}`} coordinate={{ latitude: p.lat, longitude: p.lng }} title={String(p.index)} />
              ))}
            </MapView>
          </View>
          <View style={styles.openMaps}>
            <Text style={styles.openMapsText}>Open in Maps</Text>
          </View>
        </Pressable>
      )}
      {places.slice(0, 6).map((p, i) => (
        <Pressable
          key={p.placeId || `${p.name}-${i}`}
          onPress={() => p.mapsUrl && Linking.openURL(p.mapsUrl).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`${i + 1}. ${p.name}`}
          style={({ pressed }) => [
            styles.row,
            { borderTopColor: t.divider, borderTopWidth: i === 0 && !region ? 0 : StyleSheet.hairlineWidth },
            pressed && { backgroundColor: t.pressed },
          ]}
        >
          <View>
            {p.photoUrl && !failed[i] ? (
              <Image source={{ uri: p.photoUrl }} onError={() => setFailed((f) => ({ ...f, [i]: true }))} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, { backgroundColor: t.sunken, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="location-outline" size={22} color={t.faint} />
              </View>
            )}
            <View style={[styles.rank, { backgroundColor: t.ink }]}>
              <Text style={[styles.rankText, { color: t.onInk }]}>{i + 1}</Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
              {p.name}
            </Text>
            <View style={styles.meta}>
              {p.rating != null && (
                <View style={styles.inline}>
                  <Ionicons name="star" size={11} color={t.star} />
                  <Text style={[styles.metaText, { color: t.body }]}>
                    {p.rating}
                    {p.reviews != null && (
                      <Text style={{ color: t.muted }}> ({p.reviews > 999 ? `${(p.reviews / 1000).toFixed(1)}k` : p.reviews})</Text>
                    )}
                  </Text>
                </View>
              )}
              {/* Unknown isn't "Closed" */}
              {p.openNow === true && <Text style={[styles.metaText, { color: t.success }]}>Open now</Text>}
              {p.openNow === false && <Text style={[styles.metaText, { color: t.danger }]}>Closed</Text>}
            </View>
            {!!p.address && (
              <Text style={[styles.address, { color: t.muted }]} numberOfLines={2}>
                {p.address}
              </Text>
            )}
          </View>
          <Ionicons name="open-outline" size={14} color={t.faint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  map: { width: '100%', height: 176 },
  openMaps: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  openMapsText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  photo: { width: 72, height: 72, borderRadius: 12 },
  rank: { position: 'absolute', top: -4, left: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 11, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, fontWeight: '500' },
  address: { fontSize: 12, lineHeight: 16, marginTop: 4 },
});
