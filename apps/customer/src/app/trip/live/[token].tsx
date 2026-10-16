// A traveller's live trip, opened from a https://prayanaai.com/trip/<token>
// link — the phone version of the web's app/trip/[token]/page.js.
//
// Public by design (a parent should not have to sign up to see that their
// child landed): GET /api/trip-share/:token, polled every 30s. Shows the last
// known position and the trail so far. A failed refresh keeps the map that is
// already on screen.
//
// Lives at /trip/live/<token> rather than /trip/<token>: several screens push
// /trip/<tripId> for saved trips, and the static trip/*.tsx screens (plan,
// setup, …) share that segment. lib/deepLinks.ts maps the public URL here.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, useTheme } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { useGoBack } from '../../../lib/goBack';

const REFRESH_MS = 30000;
const ACCENT = '#2563eb';

type Point = { lat: number; lng: number; at?: string };
type ShareData = {
  travellerName?: string;
  packageTitle?: string;
  lastPosition?: Point | null;
  trail?: Point[];
};

function updatedLabel(at?: string) {
  if (!at) return 'Location shared';
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (!Number.isFinite(mins)) return 'Location shared';
  if (mins < 2) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} minutes ago`;
  return `Updated ${Math.round(mins / 60)} hour${mins >= 120 ? 's' : ''} ago`;
}

export default function LiveTripScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const goBack = useGoBack('/(tabs)');
  const { themeColors } = useTheme();
  const [data, setData] = useState<ShareData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'error'>('loading');
  const mapRef = useRef<MapView>(null);

  const load = useCallback(async () => {
    if (!token) { setState('gone'); return; }
    try {
      const json: any = await makeAPICall(`/trip-share/${encodeURIComponent(String(token))}`);
      if (json?.success) { setData(json.data); setState('ok'); }
      else setState('gone');
    } catch (err: any) {
      if (err?.status === 404) { setState('gone'); return; }
      setState((s) => (s === 'ok' ? 'ok' : 'error'));
    }
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const pos = data?.lastPosition;
  const trail = (data?.trail || [])
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    .map((p) => ({ latitude: p.lat, longitude: p.lng }));

  // Follow the traveller as new positions arrive.
  useEffect(() => {
    if (pos && mapRef.current) {
      mapRef.current.animateCamera({ center: { latitude: pos.lat, longitude: pos.lng } }, { duration: 600 });
    }
  }, [pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <View style={[styles.topBar, { borderBottomColor: themeColors.border, backgroundColor: themeColors.surface }]}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={themeColors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>LIVE TRIP</Text>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          {data?.travellerName ? `${data.travellerName}'s trip` : 'Shared trip'}
        </Text>
        {data?.packageTitle ? (
          <View style={styles.subRow}>
            <Ionicons name="airplane" size={12} color={themeColors.textSecondary} />
            <Text style={[styles.sub, { color: themeColors.textSecondary }]} numberOfLines={1}>{data.packageTitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (state === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        {header}
        <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  if (state === 'gone' || state === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        {header}
        <View style={styles.center}>
          <View style={[styles.goneIcon, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="shield-outline" size={26} color={colors.gray[400]} />
          </View>
          <Text style={[styles.goneTitle, { color: themeColors.text }]}>This trip link is no longer active</Text>
          <Text style={[styles.goneBody, { color: themeColors.textSecondary }]}>
            The traveller may have stopped sharing, or the trip has ended. Ask them for a new link.
          </Text>
          {state === 'error' ? (
            <TouchableOpacity onPress={() => { setState('loading'); load(); }} style={[styles.retry, { backgroundColor: ACCENT }]}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {header}
      <ScrollView contentContainerStyle={styles.body}>
        {pos ? (
          <>
            <View style={[styles.mapWrap, { borderColor: themeColors.border }]}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={{ latitude: pos.lat, longitude: pos.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              >
                {trail.length > 1 ? (
                  <>
                    <Polyline coordinates={trail} strokeColor="rgba(255,255,255,0.9)" strokeWidth={8} zIndex={1} />
                    <Polyline coordinates={trail} strokeColor={ACCENT} strokeWidth={4} zIndex={2} />
                  </>
                ) : null}
                <Marker coordinate={{ latitude: pos.lat, longitude: pos.lng }} anchor={{ x: 0.5, y: 0.5 }} zIndex={3}>
                  <View style={styles.dotHalo}><View style={styles.dot} /></View>
                </Marker>
              </MapView>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={12} color={themeColors.textSecondary} />
              <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{updatedLabel(pos.at)}</Text>
              <Text style={[styles.meta, { color: themeColors.textTertiary }]}>·</Text>
              <Ionicons name="location-outline" size={12} color={themeColors.textSecondary} />
              <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</Text>
            </View>
          </>
        ) : (
          // Sharing is on but no position has arrived yet.
          <View style={[styles.waiting, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
            <Ionicons name="location-outline" size={26} color={colors.gray[300]} />
            <Text style={[styles.waitingTitle, { color: themeColors.text }]}>Waiting for the first location</Text>
            <Text style={[styles.waitingBody, { color: themeColors.textSecondary }]}>
              This page updates on its own once they share their position.
            </Text>
          </View>
        )}
        <Text style={[styles.footnote, { color: themeColors.textTertiary }]}>
          Shared by the traveller through Prayana. They can stop sharing at any time.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: ACCENT },
  title: { fontSize: 17, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  sub: { fontSize: 13, flexShrink: 1 },
  body: { padding: 16, gap: 12 },
  mapWrap: { height: 380, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  dotHalo: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(37,99,235,0.22)', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: ACCENT, borderWidth: 2.5, borderColor: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  meta: { fontSize: 12 },
  waiting: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center' },
  waitingTitle: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  waitingBody: { fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  footnote: { fontSize: 11, textAlign: 'center', paddingTop: 6 },
  goneIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  goneTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  goneBody: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  retry: { marginTop: 18, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  retryText: { color: '#fff', fontWeight: '700' },
});
