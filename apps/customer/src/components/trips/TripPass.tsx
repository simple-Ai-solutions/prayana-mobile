// A saved trip as a boarding pass, the phone layout of the web's TripPass
// (components/create-trip/MyTripsPage.jsx): the destination photo with the
// days chip (and Draft / role), the trip's name and places over it; then a
// perforated tear and a stub with spots, days and when it was last edited, or
// who it's shared with, and an Open button.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';

const RED = '#E61417';
const NOTCH = 14;

export const tripDays = (t: any) => t?.days?.length || 0;
export const tripSpots = (t: any) => (t?.days || []).reduce((n: number, d: any) => n + (d?.activities?.length || 0), 0);
export const tripPlaces = (t: any): string[] =>
  (t?.destinations || []).map((d: any) => (typeof d === 'string' ? d : d?.name || d?.city || '')).filter(Boolean);

/** The trip's own name, or "Manali trip" when it was saved under the default. */
export function tripTitle(t: any) {
  const name = String(t?.name || '').trim();
  const places = tripPlaces(t);
  if ((!name || /^(my|untitled)\s+trip$/i.test(name)) && places.length) {
    return places.length > 1 ? `${places[0]} & ${places.length - 1} more` : `${places[0]} trip`;
  }
  return name || 'Untitled trip';
}

export function editedAgo(value: any) {
  const t = value ? new Date(value?._seconds ? value._seconds * 1000 : value).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function TripPass({ trip, image, fallbackImage, onOpen, shared }: {
  trip: any;
  image?: string | null;
  /** Shown if `image` fails to load. */
  fallbackImage?: string;
  onOpen: () => void;
  /** For a trip planned with others: who owns it and the viewer's role. */
  shared?: { isOwner: boolean; role: 'owner' | 'editor' | 'viewer' } | null;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [src, setSrc] = useState(image);
  useEffect(() => { setSrc(image); }, [image]);
  const days = tripDays(trip);
  const nights = Math.max(0, days - 1);
  const spots = tripSpots(trip);
  const places = tripPlaces(trip);
  const edited = editedAgo(trip.updatedAt || trip.createdAt);
  const isDraft = !spots && !places.length;
  const crew: any[] = trip.collaborators || [];
  const role = shared
    ? ({ owner: { icon: 'person' as const, label: 'Owner', bg: '#f97316', fg: '#fff' },
        editor: { icon: 'create' as const, label: 'Editor', bg: '#10b981', fg: '#fff' },
        viewer: { icon: 'eye' as const, label: 'Viewer', bg: 'rgba(255,255,255,0.95)', fg: '#111827' } } as const)[shared.role]
    : null;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${tripTitle(trip)}`}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={s.top}>
        <LinearGradient colors={['#fb923c', RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {src ? (
          <Image
            source={{ uri: src }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            onError={() => setSrc(fallbackImage && src !== fallbackImage ? fallbackImage : null)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.noPhoto]}><Ionicons name="airplane" size={44} color="rgba(255,255,255,0.35)" /></View>
        )}
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']} locations={[0, 0.3, 0.45, 1]} style={StyleSheet.absoluteFill} />

        <View style={s.chips}>
          {days > 0 ? (
            <View style={s.chip}>
              <Ionicons name="time" size={11} color="#f97316" />
              <Text style={s.chipText}>{days}D{nights > 0 ? ` · ${nights}N` : ''}</Text>
            </View>
          ) : null}
          {role ? (
            <View style={[s.chip, { backgroundColor: role.bg }]}>
              <Ionicons name={role.icon} size={11} color={role.fg} />
              <Text style={[s.chipText, { color: role.fg }]}>{role.label}</Text>
            </View>
          ) : null}
          {isDraft && !shared ? <View style={[s.chip, { backgroundColor: '#fbbf24' }]}><Text style={[s.chipText, { color: '#451a03' }]}>Draft</Text></View> : null}
        </View>

        <View style={s.caption}>
          <Text style={s.name} numberOfLines={2}>{tripTitle(trip)}</Text>
          {places.length ? (
            <View style={s.placesRow}>
              <Ionicons name="location" size={13} color="#fdba74" />
              <Text style={s.places} numberOfLines={1}>{places.join(' · ')}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* The tear between photo and stub. */}
      <View style={s.tear}>
        <View style={[s.notch, { left: -NOTCH / 2, backgroundColor: themeColors.background }]} />
        <View style={[s.dash, { borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(148,163,184,0.5)' }]} />
        <View style={[s.notch, { right: -NOTCH / 2, backgroundColor: themeColors.background }]} />
      </View>

      <View style={s.stub}>
        {shared ? (
          <View style={s.crew}>
            <View style={s.faces}>
              {crew.slice(0, 4).map((c, i) => (
                <LinearGradient key={c.userId || i} colors={['#fb923c', RED]} style={[s.face, { marginLeft: i ? -8 : 0, borderColor: themeColors.surface }]}>
                  <Text style={s.faceText}>{String(c.name || c.userName || c.email || '?')[0].toUpperCase()}</Text>
                </LinearGradient>
              ))}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={[s.label, { color: themeColors.textTertiary }]}>{shared.isOwner ? 'CREW' : 'PLANNED BY'}</Text>
              <Text style={[s.crewText, { color: themeColors.text }]} numberOfLines={1}>
                {shared.isOwner ? `You + ${crew.length} member${crew.length === 1 ? '' : 's'}` : trip.ownerName || 'Trip owner'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.facts}>
            <View>
              <Text style={[s.label, { color: themeColors.textTertiary }]}>SPOTS</Text>
              <Text style={[s.value, { color: themeColors.text }]}>{spots || '—'}</Text>
            </View>
            <View>
              <Text style={[s.label, { color: themeColors.textTertiary }]}>DAYS</Text>
              <Text style={[s.value, { color: themeColors.text }]}>{days || '—'}</Text>
            </View>
            {edited ? (
              <View style={{ flexShrink: 1 }}>
                <Text style={[s.label, { color: themeColors.textTertiary }]}>EDITED</Text>
                <Text style={[s.edited, { color: themeColors.textSecondary }]} numberOfLines={1}>{edited}</Text>
              </View>
            ) : null}
          </View>
        )}
        <View style={[s.open, { backgroundColor: isDarkMode ? '#fff' : '#111827' }]}>
          <Text style={[s.openText, { color: isDarkMode ? '#111827' : '#fff' }]}>Open</Text>
          <Ionicons name="arrow-forward" size={14} color={isDarkMode ? '#111827' : '#fff'} />
        </View>
      </View>
    </Pressable>
  );
}

/** The dashed "Plan a new trip" tile that ends the list (web NewTripTile). */
export function NewTripTile({ onPress }: { onPress: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      <LinearGradient
        colors={isDarkMode ? ['rgba(249,115,22,0.12)', themeColors.surface, 'rgba(230,20,23,0.1)'] : ['#fff7ed', '#ffffff', '#fef2f2']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.newTile}
      >
        <LinearGradient colors={['#f97316', RED]} style={s.newIcon}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
        <Text style={[s.newTitle, { color: themeColors.text }]}>Plan a new trip</Text>
        <Text style={[s.newSub, { color: themeColors.textSecondary }]}>
          Tell our AI where you're going and get a day-by-day plan in seconds.
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 22, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  top: { aspectRatio: 16 / 10, overflow: 'hidden' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  chips: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '800', color: '#111827' },
  caption: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  name: {
    color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: -0.4, lineHeight: 25,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  placesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  places: { flex: 1, color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600' },

  tear: { height: 0, zIndex: 5 },
  notch: { position: 'absolute', top: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  dash: { position: 'absolute', left: NOTCH, right: NOTCH, top: 0, borderTopWidth: 1, borderStyle: 'dashed' },

  stub: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  facts: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 22 },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  value: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  edited: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  crew: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  faces: { flexDirection: 'row' },
  face: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  faceText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  crewText: { fontSize: 13.5, fontWeight: '800', marginTop: 2 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  openText: { fontSize: 13, fontWeight: '800' },

  newTile: { borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(251,146,60,0.7)', padding: 24, alignItems: 'center' },
  newIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  newTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  newSub: { fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 240, lineHeight: 18 },
});
