// A region on the eSIM landing page as the web's "pass card"
// (app/esim/page.jsx, Browse by region): a wide photo with the live plan count,
// the region name and its headline countries, then a stub with the cheapest
// plan the region's countries sell, how many destinations it covers, and a
// View / Selected button.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import type { EsimRegion } from '../../lib/esimRegions';
import { sizedImage } from '../../lib/countryAssets';
import { PassTear, ESIM_RED, inr } from './EsimPass';

export function EsimRegionPass({ region, fromINR, dataLabel, planCount, destinations, selected, onPress }: {
  region: EsimRegion;
  fromINR?: number;
  dataLabel?: string;
  planCount?: number;
  destinations?: number;
  selected?: boolean;
  onPress: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const more = Math.max(0, region.totalCountries - region.highlights.length);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${region.name}${fromINR ? `, from ${inr(fromINR)}` : ''}`}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: themeColors.surface, borderColor: selected ? ESIM_RED : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
        selected && { borderWidth: 2 },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={s.top}>
        <LinearGradient colors={['#334155', '#0f172a']} style={StyleSheet.absoluteFill} />
        <Image source={{ uri: sizedImage(region.image, 900) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
        <LinearGradient
          colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        {planCount ? (
          <View style={s.plans}>
            <View style={s.plansDot}><Ionicons name="globe-outline" size={10} color="#fff" /></View>
            <Text style={s.plansText}>{planCount} PLANS</Text>
          </View>
        ) : null}
        <View style={s.caption}>
          <Text style={s.name}>{region.name}</Text>
          <View style={s.hlRow}>
            <View style={[s.hlBar, { backgroundColor: region.accent }]} />
            <Text style={s.hl} numberOfLines={1}>
              {region.highlights.join(' · ')}{more ? ` +${more}` : ''}
            </Text>
          </View>
        </View>
      </View>

      <PassTear background={themeColors.background} />

      <View style={s.stub}>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: themeColors.textTertiary }]}>FROM</Text>
          <Text style={s.priceLine}>
            <Text style={[s.price, { color: themeColors.text }]}>{fromINR ? inr(fromINR) : '—'}</Text>
            {dataLabel ? <Text style={[s.per, { color: themeColors.textSecondary }]}> / {dataLabel}</Text> : null}
          </Text>
          {destinations ? (
            <Text style={[s.dest, { color: themeColors.textSecondary }]}>{destinations} destinations</Text>
          ) : null}
        </View>
        <View style={[s.btn, { backgroundColor: selected ? ESIM_RED : isDarkMode ? '#fff' : '#111827' }]}>
          <Text style={[s.btnText, { color: selected || !isDarkMode ? '#fff' : '#111827' }]}>{selected ? 'Selected' : 'View'}</Text>
          <Ionicons name={selected ? 'checkmark' : 'chevron-down'} size={14} color={selected || !isDarkMode ? '#fff' : '#111827'} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 22, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  top: { aspectRatio: 16 / 9, overflow: 'hidden' },
  plans: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingLeft: 3, paddingRight: 10, paddingVertical: 3,
  },
  plansDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: ESIM_RED, alignItems: 'center', justifyContent: 'center' },
  plansText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: '#111827' },
  caption: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  name: {
    color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  hlRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  hlBar: { width: 14, height: 3, borderRadius: 2 },
  hl: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },

  stub: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 14 },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  priceLine: { marginTop: 3 },
  price: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  per: { fontSize: 12 },
  dest: { fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  btnText: { fontSize: 13, fontWeight: '700' },
});
