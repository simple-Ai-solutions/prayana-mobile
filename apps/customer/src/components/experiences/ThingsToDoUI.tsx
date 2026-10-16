// Building blocks for the Things to do screen, in the District-style language
// the app is moving to: dark surfaces, posters that carry their own type,
// small spaced-out section labels and soft coloured glows.
//
//   SectionLabel  ──── TRENDING THIS WEEK ────
//   PosterCard    a portrait poster: photo full-bleed, chips on top, the title
//                 and price set over a bottom wash (size "lg" for the spotlight)
//   VibeTile      a category tile: name top-left, its photo as a rounded cut-out
//                 in the bottom-right corner (District's "What's the mood?")
//   PlaceCard     a tall destination card with the name set on the photo
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import {
  Experience, imageOf, priceOf, ratingOf, providerLabel, formatPrice,
} from '../../lib/experiences';
import { fallbackPhoto } from '../../lib/fallbackPhoto';

export const ACCENT = '#FF5A5F';

/** ──── LABEL ──── centred, small and widely spaced. */
export function SectionLabel({ label, style }: { label: string; style?: any }) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.labelRow, style]} accessibilityRole="header">
      <View style={[styles.labelLine, { backgroundColor: themeColors.border }]} />
      <Text style={[styles.labelText, { color: themeColors.textSecondary }]}>{label.toUpperCase()}</Text>
      <View style={[styles.labelLine, { backgroundColor: themeColors.border }]} />
    </View>
  );
}

export function PosterCard({
  experience, width, onPress, size = 'md',
}: {
  experience: Experience;
  /** Omit to fill the parent (grid cell). */
  width?: number;
  onPress: (e: Experience) => void;
  size?: 'md' | 'lg';
}) {
  const { isDarkMode } = useTheme();
  const img = imageOf(experience) || fallbackPhoto(experience);
  const price = priceOf(experience);
  const rating = ratingOf(experience);
  const provider = providerLabel(experience);
  const city = experience.location?.city;
  const duration = experience.duration?.label;
  const lg = size === 'lg';

  return (
    <Pressable
      onPress={() => onPress(experience)}
      accessibilityRole="button"
      accessibilityLabel={[experience.title, city, duration, price ? `from ${formatPrice(price)}` : '']
        .filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.poster,
        { aspectRatio: lg ? 0.78 : 0.72 },
        width ? { width } : styles.fill,
        { borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {img ? (
        <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#2A2A36', '#14141C']} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.28, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        {provider ? (
          <View style={styles.glassChip}>
            <Text style={styles.chipText}>{provider}</Text>
          </View>
        ) : <View />}
        {!!duration && (
          <View style={styles.glassChip}>
            <Ionicons name="time-outline" size={11} color="#fff" />
            <Text style={styles.chipText}>{duration}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        {!!city && (
          <Text style={styles.city} numberOfLines={1}>{city.toUpperCase()}</Text>
        )}
        <Text style={[styles.title, lg && styles.titleLg]} numberOfLines={2}>{experience.title}</Text>
        <View style={styles.priceRow}>
          {price ? (
            <Text style={styles.price}>
              {formatPrice(price)}
              <Text style={styles.onwards}>  onwards</Text>
            </Text>
          ) : <View />}
          {rating ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={11} color="#FACC15" />
              <Text style={styles.ratingText}>{rating.average.toFixed(1)}</Text>
            </View>
          ) : lg ? (
            <View style={styles.bookPill}>
              <Text style={styles.bookText}>Book</Text>
              <Ionicons name="arrow-forward" size={13} color="#111" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function VibeTile({
  label, image, active, onPress, width,
}: {
  label: string; image: string; active?: boolean; onPress: () => void; width: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.vibe,
        { width, borderColor: active ? ACCENT : 'transparent' },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={styles.vibeInner}>
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        {active && (
          <View style={styles.vibeTick}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
        <Text style={styles.vibeLabel} numberOfLines={2}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function PlaceCard({
  label, image, onPress, width,
}: { label: string; image: string; onPress: () => void; width: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Experiences in ${label}`}
      style={({ pressed }) => [styles.place, { width }, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.placeName} numberOfLines={1}>{label}</Text>
      <Text style={styles.placeSub}>Explore →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  labelLine: { flex: 1, height: StyleSheet.hairlineWidth },
  labelText: { fontSize: 12, fontWeight: '600', letterSpacing: 2.4 },

  poster: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, backgroundColor: '#14141C',
    justifyContent: 'space-between',
  },
  fill: { width: '100%' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, gap: 6 },
  glassChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bottom: { padding: 12, paddingTop: 0 },
  city: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1.6, marginBottom: 3 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 19, letterSpacing: -0.2 },
  titleLg: { fontSize: 22, lineHeight: 26, letterSpacing: -0.5 },
  priceRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: '#fff', fontSize: 15, fontWeight: '800' },
  onwards: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '500' },
  rating: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3,
  },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bookPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  bookText: { color: '#111', fontSize: 13, fontWeight: '800' },

  vibe: { height: 132, borderRadius: 20, borderWidth: 2, padding: 2 },
  vibeInner: { flex: 1, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  vibeLabel: {
    color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 17, letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  vibeTick: {
    position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },

  place: { height: 150, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', padding: 12 },
  placeName: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  placeSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', marginTop: 2 },
});
