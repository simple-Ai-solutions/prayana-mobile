// EsimCountryCard — a destination as a boarding pass, ported from the web's
// components/esim/EsimCountryCard.jsx: the country photo with an eSIM pill and
// either a "% OFF" badge or a gold SIM chip, the flag and name over it, then a
// perforated tear and a stub with the "from" price (MRP struck through when
// discounted), what that buys, the plan count, a 5G pill and an arrow.
//
// Every figure is the cheapest bundle the catalogue actually returns for the
// country. Until that lands the stub says "—" — it never guesses.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { CountryFlag } from './CountryFlag';
import { EsimPill, SimChip, PassTear, ESIM_RED, ESIM_RED_DARK, inr } from './EsimPass';
import { countryImage } from '../../lib/countryAssets';

interface Props {
  iso: string;
  name: string;
  fromINR?: number;
  mrpINR?: number;
  dataLabel?: string;
  planCount?: number;
  discountPercent?: number;
  has5G?: boolean;
  selected?: boolean;
  onPress: () => void;
}

export const EsimCountryCard: React.FC<Props> = ({
  iso, name, fromINR, mrpINR, dataLabel, planCount, discountPercent, has5G, selected = false, onPress,
}) => {
  const { themeColors, isDarkMode } = useTheme();
  const image = countryImage(iso, 640);
  const discounted = !!discountPercent && discountPercent > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fromINR ? `${name}, from ${inr(fromINR)}${planCount ? `, ${planCount} plans` : ''}` : name}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: themeColors.surface, borderColor: selected ? ESIM_RED : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
        selected && { borderWidth: 2 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.top}>
        <LinearGradient colors={[ESIM_RED, ESIM_RED_DARK, '#7F1D1D']} style={StyleSheet.absoluteFill} />
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.flagFill}><CountryFlag countryCode={iso} size={56} /></View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']}
          locations={[0, 0.3, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.pillAt}><EsimPill /></View>
        <View style={styles.cornerAt}>
          {discounted ? (
            <View style={styles.off}><Text style={styles.offText}>{Math.round(discountPercent!)}% OFF</Text></View>
          ) : (
            <SimChip />
          )}
        </View>
        <View style={styles.nameRow}>
          <CountryFlag countryCode={iso} size={20} />
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>
      </View>

      <PassTear background={themeColors.background} />

      <View style={styles.stub}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.label, { color: themeColors.textTertiary }]}>
            FROM{discounted && mrpINR && fromINR ? '  ' : ''}
            {discounted && mrpINR && fromINR ? <Text style={styles.mrp}>{inr(mrpINR)}</Text> : null}
          </Text>
          <Text style={styles.priceLine} numberOfLines={1}>
            <Text style={[styles.price, { color: themeColors.text }]}>{fromINR ? inr(fromINR) : '—'}</Text>
            {dataLabel ? <Text style={[styles.per, { color: themeColors.textSecondary }]}> / {dataLabel}</Text> : null}
          </Text>
          {(planCount || has5G) ? (
            <View style={styles.meta}>
              {planCount ? <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{planCount} plans</Text> : null}
              {has5G ? (
                <View style={styles.g5}>
                  <Ionicons name="flash" size={9} color="#047857" />
                  <Text style={styles.g5Text}>5G</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={[styles.arrow, { backgroundColor: isDarkMode ? '#fff' : '#111827' }]}>
          <Ionicons name="arrow-forward" size={15} color={isDarkMode ? '#111827' : '#fff'} />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  top: { aspectRatio: 4 / 3, overflow: 'hidden' },
  flagFill: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pillAt: { position: 'absolute', top: 10, left: 10 },
  cornerAt: { position: 'absolute', top: 10, right: 10 },
  off: { backgroundColor: ESIM_RED, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  offText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  nameRow: { position: 'absolute', left: 12, right: 12, bottom: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    flex: 1, color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 },
  },

  stub: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 12 },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  mrp: { textDecorationLine: 'line-through', letterSpacing: 0, fontWeight: '600', color: '#9ca3af' },
  priceLine: { marginTop: 3 },
  price: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  per: { fontSize: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  metaText: { fontSize: 10.5, fontWeight: '600' },
  g5: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  g5Text: { color: '#047857', fontSize: 10, fontWeight: '700' },
  arrow: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

export default EsimCountryCard;
