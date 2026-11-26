// "Near you" on Things to Do: experiences around the customer, nearest first,
// each card showing how far it is. Location is asked only when they tap
// "Use my location" (never on open); if they allowed it before, it just loads.
// The point is rounded to ~1 km before it leaves the phone.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { Experience } from '../../lib/experiences';
import { ACCENT, PosterCard, SectionLabel } from './ThingsToDoUI';

const RADIUS_KM = 300;
type State = 'idle' | 'locating' | 'loading' | 'done' | 'denied' | 'error';

export function NearYou({ cardWidth, onPress }: { cardWidth: number; onPress: (e: Experience) => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const [state, setState] = useState<State>('idle');
  const [items, setItems] = useState<Experience[]>([]);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async (ask: boolean) => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (ask) setState('denied');
        return;
      }
      setState('locating');
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const lat = pos.coords.latitude.toFixed(2);
      const lng = pos.coords.longitude.toFixed(2);
      setState('loading');
      const res: any = await activityMarketplaceAPI.searchActivities({
        near: `${lat},${lng}`, radiusKm: RADIUS_KM, sort: 'distance', limit: 12,
      });
      const list: Experience[] = res?.data || [];
      // A server without "near" sends a normal list with no distances: don't
      // pretend those are near.
      if (list.length && !list.some((a: any) => typeof a.distanceKm === 'number')) {
        setHidden(true);
        return;
      }
      setItems(list);
      setState('done');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Does the server know "near" yet? Nothing is near 0,0 (open sea), so a
      // server that understands it sends none; an older one sends its usual
      // list. No location of the customer's is used for this check.
      try {
        const probe: any = await activityMarketplaceAPI.searchActivities({ near: '0,0', radiusKm: 5, limit: 1 });
        if ((probe?.data || []).length > 0) { if (alive) setHidden(true); return; }
      } catch {
        if (alive) setHidden(true);
        return;
      }
      if (alive) load(false);
    })();
    return () => { alive = false; };
  }, [load]);

  if (hidden) return null;

  const card = { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fff', borderColor: themeColors.border };

  return (
    <View style={s.block}>
      <SectionLabel label="Near you" style={s.padded} />
      {state === 'done' && items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
          {items.map((a) => (
            <PosterCard key={a._id} experience={a} width={cardWidth} onPress={onPress} />
          ))}
        </ScrollView>
      ) : (
        <View style={[s.ask, card]}>
          <View style={s.pin}>
            <Ionicons name="navigate" size={20} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.askTitle, { color: themeColors.text }]}>
              {state === 'done' ? `Nothing within ${RADIUS_KM} km yet` :
                state === 'denied' ? 'Location is off' :
                state === 'error' ? "Couldn't find your location" :
                'See what you can do nearby'}
            </Text>
            <Text style={[s.askSub, { color: themeColors.textSecondary }]}>
              {state === 'done' ? 'Browse everything below, or search a city.' :
                state === 'denied' ? 'Turn it on in Settings to see distances.' :
                'Nearest first, with how far each one is.'}
            </Text>
          </View>
          {state === 'locating' || state === 'loading' ? (
            <ActivityIndicator color={ACCENT} />
          ) : state === 'done' ? null : (
            <Pressable
              onPress={() => (state === 'denied' ? Linking.openSettings() : load(true))}
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={s.btnText}>{state === 'denied' ? 'Settings' : state === 'error' ? 'Try again' : 'Use my location'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { marginTop: 28 },
  padded: { paddingHorizontal: 16 },
  rail: { gap: 12, paddingHorizontal: 16 },
  ask: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  pin: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,90,95,0.12)', alignItems: 'center', justifyContent: 'center' },
  askTitle: { fontSize: 15, fontWeight: '800' },
  askSub: { fontSize: 12.5, marginTop: 2 },
  btn: { backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  btnText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
});
