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
import { useListingPrice } from '../../lib/exchangeRates';
import { View, Text, StyleSheet, Pressable } from 'react-native';
// expo-image (Glide): RN's Image left partly off-screen rail cards grey.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import {
  Experience, imageOf, priceOf, ratingOf, providerLabel, } from '../../lib/experiences';
import { fallbackPhoto } from '../../lib/fallbackPhoto';
import { cardTitle } from '../../lib/cardTitle';
import { router } from 'expo-router';

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

/** "KODACHADRI TREK" → "Kodachadri Trek". */
const tidyTitle = (t: string) => (t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : t);

/** "Fri, 27 Nov" / "Tomorrow" for the next date it runs, or null. */
function nextRun(e: any): string | null {
  const iso = Array.isArray(e?.upcomingDates) ? e.upcomingDates[0] : null;
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (n < 0) return null;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
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
  const money = useListingPrice();
  const rating = ratingOf(experience);
  const provider = providerLabel(experience);
  const city = experience.location?.city;
  const duration = experience.duration?.label;
  const lg = size === 'lg';
  const e: any = experience;
  const instant = !!e?.instantBooking?.enabled || e?.instantBooking === true;
  const next = nextRun(e);
  const title = tidyTitle(cardTitle(experience.title));
  // Our own listings book in the app; partner ones open their page first.
  const bookable = !e?.source || e.source === 'internal';
  const book = () => {
    if (!experience._id) return;
    router.push((bookable ? `/activity/book/${experience._id}` : `/activity/${experience._id}`) as any);
  };

  return (
    <Pressable
      onPress={() => onPress(experience)}
      accessibilityRole="button"
      accessibilityLabel={[title, city, next, price ? `from ${money(price, experience)}` : '']
        .filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.poster,
        { aspectRatio: lg ? 0.78 : 0.68 },
        width ? { width } : styles.fill,
        { borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {img ? (
        <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <LinearGradient colors={['#2A2A36', '#14141C']} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.28, 0.48, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        {instant ? (
          <View style={[styles.glassChip, styles.instantChip]}>
            <Ionicons name="flash" size={10} color="#111" />
            <Text style={[styles.chipText, { color: '#111' }]}>Instant</Text>
          </View>
        ) : provider ? (
          <View style={styles.glassChip}><Text style={styles.chipText}>{provider}</Text></View>
        ) : <View />}
        {rating ? (
          <View style={styles.glassChip}>
            <Ionicons name="star" size={10} color="#FACC15" />
            <Text style={styles.chipText}>{rating.average.toFixed(1)}</Text>
          </View>
        ) : !!duration && (
          <View style={styles.glassChip}>
            <Ionicons name="time-outline" size={11} color="#fff" />
            <Text style={styles.chipText}>{duration}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottom}>
        {!!city && <Text style={styles.city} numberOfLines={1}>{city.toUpperCase()}</Text>}
        <Text style={[styles.title, lg && styles.titleLg]} numberOfLines={2}>{title}</Text>
        {next ? (
          <View style={styles.nextRow}>
            <Ionicons name="calendar" size={11} color="#FDBA74" />
            <Text style={styles.nextText} numberOfLines={1}>
              Next: {next}{duration && rating ? ` · ${duration}` : ''}
            </Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          {price ? (
            <Text style={[styles.price, lg && { fontSize: 18 }]} numberOfLines={1}>
              {money(price, experience)}
              <Text style={styles.onwards}>{lg ? '  onwards' : ''}</Text>
            </Text>
          ) : <View />}
          {/* One tap into booking: the card opens the details, this skips them. */}
          <Pressable
            onPress={book}
            hitSlop={8}
            style={({ pressed }) => [styles.bookPill, !lg && styles.bookPillSm, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`Book ${title}`}
          >
            <Text style={[styles.bookText, !lg && { fontSize: 12 }]}>Book</Text>
            {lg ? <Ionicons name="arrow-forward" size={13} color="#fff" /> : null}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** A row of the "Top 5 this week" chart: big rank, thumbnail, details, Book. */
export function TopRow({ a, rank, onPress }: { a: Experience; rank: number; onPress: (e: Experience) => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const money = useListingPrice();
  const e: any = a;
  const img = imageOf(a) || fallbackPhoto(a);
  const price = priceOf(a);
  const rating = ratingOf(a);
  const next = nextRun(e);
  const title = tidyTitle(cardTitle(a.title));
  const bookable = !e?.source || e.source === 'internal';
  return (
    <Pressable
      onPress={() => onPress(a)}
      style={({ pressed }) => [
        styles.topRowCard,
        { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Number ${rank}: ${title}`}
    >
      <Text style={[styles.rank, { color: rank === 1 ? ACCENT : themeColors.textTertiary }]}>{rank}</Text>
      <View style={styles.topThumb}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.topTitle, { color: themeColors.text }]} numberOfLines={2}>{title}</Text>
        <Text style={[styles.topMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {[a.location?.city, next ? `Next ${next}` : a.duration?.label].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {price ? <Text style={[styles.topPrice, { color: themeColors.text }]}>{money(price, a)}</Text> : null}
          {rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={[styles.topMeta, { color: themeColors.textSecondary }]}>{rating.average.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={() => a._id && router.push((bookable ? `/activity/book/${a._id}` : `/activity/${a._id}`) as any)}
        hitSlop={8}
        style={({ pressed }) => [styles.bookPill, styles.bookPillSm, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={`Book ${title}`}
      >
        <Text style={[styles.bookText, { fontSize: 12 }]}>Book</Text>
      </Pressable>
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
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
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
      <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
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
    backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  bookText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bookPillSm: { paddingHorizontal: 12, paddingVertical: 6 },
  topRowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 10 },
  rank: { width: 26, textAlign: 'center', fontSize: 30, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1 },
  topThumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  topTitle: { fontSize: 14.5, fontWeight: '800', lineHeight: 18 },
  topMeta: { fontSize: 12, fontWeight: '600' },
  topPrice: { fontSize: 14, fontWeight: '900' },
  instantChip: { backgroundColor: 'rgba(255,255,255,0.95)' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  nextText: { flexShrink: 1, color: '#FED7AA', fontSize: 11.5, fontWeight: '700' },

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
