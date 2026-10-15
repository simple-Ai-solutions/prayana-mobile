// The package route map, ported from the web's PackageRouteMap (Google
// canvas): numbered pins for each stop with a dark pin for the last, a curved
// line between consecutive stops drawn over a white casing, and a
// "147 km · 2h 54m" badge on each leg long enough to hold one. The map can be
// dragged and pinched on the page; tapping a pin shows the stop's nights and
// the day spent there.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import type { RouteLegs } from './DetailActions';

const ACCENT = '#2563eb';
const END_COLOR = '#0f172a';
const MAP_H = 260;

export type RouteStop = { name: string; lat: number; lng: number; nights?: number; city?: string };

/** The web's curved leg: a quadratic Bézier bowed 15% off the straight line. */
function arc(from: RouteStop, to: RouteStop, steps = 24) {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const c = { lat: from.lat + dLat / 2 - dLng * 0.15, lng: from.lng + dLng / 2 + dLat * 0.15 };
  const pts: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      latitude: u * u * from.lat + 2 * u * t * c.lat + t * t * to.lat,
      longitude: u * u * from.lng + 2 * u * t * c.lng + t * t * to.lng,
    });
  }
  return pts;
}

const formatDrive = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
};

/**
 * A marker with a custom view. Android draws it from a snapshot, so it tracks
 * changes only for its first moment on the map; one added later (a leg badge
 * appearing on zoom) still gets its own window to be drawn, not a blank.
 */
function ViewMarker({ children, ...props }: React.ComponentProps<typeof Marker>) {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTrack(false), 2000);
    return () => clearTimeout(t);
  }, []);
  return <Marker {...props} tracksViewChanges={track}>{children}</Marker>;
}

/** A numbered map pin. */
function Pin({ n, end }: { n: number; end: boolean }) {
  return (
    <View style={[s.pin, { backgroundColor: end ? END_COLOR : ACCENT }]}>
      <Text style={s.pinText}>{n}</Text>
    </View>
  );
}

export function RouteMap({ stops, legs, dayTitleFor, onInteract }: {
  stops: RouteStop[];
  legs: RouteLegs | null;
  /** The itinerary day spent at a stop, for the tapped-pin card. */
  dayTitleFor?: (stop: RouteStop) => string | undefined;
  /** true while a finger is on the map, so the page can stop scrolling. */
  onInteract?: (active: boolean) => void;
}) {
  const { themeColors } = useTheme();
  const ref = useRef<MapView>(null);
  const [width, setWidth] = useState(0);
  const [region, setRegion] = useState<Region | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const paths = useMemo(
    () => stops.slice(0, -1).map((a, i) => {
      const b = stops[i + 1];
      return a.lat === b.lat && a.lng === b.lng ? null : arc(a, b);
    }),
    [stops],
  );
  const coords = useMemo(() => stops.map((p) => ({ latitude: p.lat, longitude: p.lng })), [stops]);

  const fit = () => {
    if (!ref.current || !coords.length) return;
    if (coords.length === 1) {
      ref.current.animateToRegion({ ...coords[0], latitudeDelta: 0.35, longitudeDelta: 0.35 }, 0);
    } else {
      ref.current.fitToCoordinates(coords, { edgePadding: { top: 56, right: 44, bottom: 44, left: 44 }, animated: false });
    }
  };

  // Leg badges are drawn over the map rather than as map markers: Android
  // snapshots a marker's view to a bitmap and clips text it had not measured
  // yet. Each badge is placed at its leg's midpoint, re-read after every pan
  // or zoom, and only on a leg drawn at least 130px long.
  const [badges, setBadges] = useState<{ x: number; y: number; label: string }[]>([]);
  const placeBadges = async () => {
    const map = ref.current;
    if (!map || !region) { setBadges([]); return; }
    const out: { x: number; y: number; label: string }[] = [];
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      const leg = legs?.legs?.[i];
      if (!p || !(leg?.distanceKm && leg.distanceKm > 0) || !legFits(p)) continue;
      try {
        const pt = await map.pointForCoordinate(p[Math.floor(p.length / 2)]);
        out.push({ x: pt.x, y: pt.y, label: `${leg.distanceKm} km${leg.durationMinutes ? ` · ${formatDrive(leg.durationMinutes)}` : ''}` });
      } catch {
        // The map is not ready to project yet; the next region change places it.
      }
    }
    setBadges(out);
  };
  useEffect(() => { placeBadges(); }, [region, legs, width]);

  /** Only badge a leg drawn at least 130px long at the current zoom. */
  const legFits = (path: { latitude: number; longitude: number }[]) => {
    if (!region || !width) return false;
    const a = path[0];
    const b = path[path.length - 1];
    const pxPerLng = width / region.longitudeDelta;
    const pxPerLat = (MAP_H / region.latitudeDelta);
    const dx = (b.longitude - a.longitude) * pxPerLng;
    const dy = (b.latitude - a.latitude) * pxPerLat;
    return Math.hypot(dx, dy) >= 130;
  };

  if (!stops.length) return null;
  const openStop = open != null ? stops[open] : null;
  const openDay = openStop ? dayTitleFor?.(openStop) : undefined;

  return (
    <View
      style={{ height: MAP_H }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // Hold the page still while the map is being dragged or pinched.
      onTouchStart={() => onInteract?.(true)}
      onTouchEnd={() => onInteract?.(false)}
      onTouchCancel={() => onInteract?.(false)}
    >
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: stops[0].lat, longitude: stops[0].lng, latitudeDelta: 4, longitudeDelta: 4 }}
        onMapReady={() => { fit(); setTimeout(fit, 400); }}
        onRegionChangeComplete={setRegion}
        onRegionChange={() => badges.length && setBadges([])}
        onPress={() => setOpen(null)}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        {paths.map((p, i) => (p ? (
          <React.Fragment key={`l${i}`}>
            <Polyline coordinates={p} strokeColor="rgba(255,255,255,0.9)" strokeWidth={8} zIndex={1} />
            <Polyline coordinates={p} strokeColor={ACCENT} strokeWidth={4} zIndex={2} />
          </React.Fragment>
        ) : null))}

        {stops.map((st, i) => (
          <ViewMarker
            key={`p${i}`}
            coordinate={{ latitude: st.lat, longitude: st.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => setOpen(i)}
            zIndex={10 + i}
          >
            <Pin n={i + 1} end={stops.length > 1 && i === stops.length - 1} />
          </ViewMarker>
        ))}
      </MapView>

      {badges.map((b, i) => (
        <View key={i} pointerEvents="none" style={[s.badge, s.badgeOverlay, { left: b.x, top: b.y }]}>
          <Text style={s.badgeText} numberOfLines={1}>{b.label}</Text>
        </View>
      ))}

      {/* Zoom back out to the whole route. */}
      <Pressable onPress={fit} style={s.recenter} hitSlop={8} accessibilityRole="button" accessibilityLabel="Show the whole route">
        <Ionicons name="scan-outline" size={17} color={END_COLOR} />
      </Pressable>

      {/* The tapped stop: name, nights and the day spent there. */}
      {openStop ? (
        <View style={[s.card, { backgroundColor: themeColors.surface }]}>
          <View style={[s.cardNum, { backgroundColor: stops.length > 1 && open === stops.length - 1 ? END_COLOR : ACCENT }]}>
            <Text style={s.pinText}>{(open ?? 0) + 1}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.cardTitle, { color: themeColors.text }]} numberOfLines={1}>{openStop.name}</Text>
            <Text style={[s.cardSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {[openStop.nights ? `${openStop.nights} night${openStop.nights > 1 ? 's' : ''}` : null, openDay].filter(Boolean).join(' · ') || 'Stop on this route'}
            </Text>
          </View>
          <Pressable onPress={() => setOpen(null)} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={themeColors.textTertiary} />
          </Pressable>
        </View>
      ) : (
        <View style={s.hint} pointerEvents="none">
          <Ionicons name="hand-left-outline" size={11} color="#fff" />
          <Text style={s.hintText}>Drag or pinch to explore</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pin: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 4,
  },
  pinText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  badge: {
    height: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.1)',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  // Centred on the point: half the badge's own size back up and left.
  badgeOverlay: { position: 'absolute', transform: [{ translateX: '-50%' }, { translateY: '-50%' }] },
  badgeText: { color: '#0f172a', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  recenter: {
    position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  card: {
    position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  cardNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },
  hint: {
    position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  hintText: { color: '#fff', fontSize: 10.5, fontWeight: '600' },
});
