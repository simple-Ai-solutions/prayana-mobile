// The pieces the web's eSIM cards are built from (components/esim/
// EsimCountryCard.jsx and the region "pass cards" on app/esim/page.jsx): a
// white "eSIM" pill, a small gold SIM chip, and the perforated tear between a
// card's photo and its stub, with a notch bitten out of each side.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export const ESIM_RED = '#E61417';
export const ESIM_RED_DARK = '#B91C1C';

/** "eSIM" on a white pill, with the red wifi dot. */
export function EsimPill() {
  return (
    <View style={s.pill}>
      <LinearGradient colors={[ESIM_RED, ESIM_RED_DARK]} style={s.pillDot}>
        <Ionicons name="wifi" size={9} color="#fff" />
      </LinearGradient>
      <Text style={s.pillText}>ESIM</Text>
    </View>
  );
}

/** A small gold SIM chip, so a card reads as an eSIM at a glance. */
export function SimChip({ scale = 1 }: { scale?: number }) {
  return (
    <LinearGradient
      colors={['#fde68a', '#f59e0b', '#fcd34d', '#d97706']}
      locations={[0, 0.45, 0.7, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.chip, { width: 32 * scale, height: 24 * scale, borderRadius: 5 * scale }]}
    >
      <View style={s.chipH} />
      <View style={s.chipV} />
    </LinearGradient>
  );
}

/**
 * The perforation between photo and stub: a dashed line with a semicircle cut
 * from each edge in the page's background colour.
 */
export function PassTear({ background }: { background: string }) {
  return (
    <View style={s.tear} pointerEvents="none">
      <View style={[s.notch, s.notchL, { backgroundColor: background }]} />
      <View style={s.dash} />
      <View style={[s.notch, s.notchR, { backgroundColor: background }]} />
    </View>
  );
}

/** "Unlimited", "500 MB", "1 GB". */
export function dataLabel(mb?: number | null, unlimited?: boolean): string | undefined {
  if (unlimited) return 'Unlimited';
  if (!mb) return undefined;
  if (mb < 1000) return `${mb} MB`;
  const gb = mb / 1000;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const NOTCH = 14;

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999,
    paddingLeft: 3, paddingRight: 8, paddingVertical: 2,
  },
  pillDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.3, color: '#111827' },

  chip: {
    borderWidth: 1, borderColor: 'rgba(253,230,138,0.7)', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  chipH: { position: 'absolute', left: '18%', right: '18%', top: '50%', height: 1, backgroundColor: 'rgba(146,64,14,0.4)' },
  chipV: { position: 'absolute', top: '15%', bottom: '15%', left: '50%', width: 1, backgroundColor: 'rgba(146,64,14,0.4)' },

  tear: { height: 0, flexDirection: 'row', alignItems: 'center', zIndex: 5 },
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, top: -NOTCH / 2 },
  notchL: { left: -NOTCH / 2 },
  notchR: { right: -NOTCH / 2 },
  dash: {
    position: 'absolute', left: NOTCH, right: NOTCH, top: 0,
    borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(148,163,184,0.55)',
  },
});
