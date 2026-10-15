// Explore cards: a wide "featured" poster for the swipe rail, and the list
// card — a full-bleed photo with the place, duration and tags on it, then a
// stub with what's included, the price and a Book button. Commissioned trek
// art (lib/trekArt) is used where a trip has it.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { trekArtFor } from '../../lib/trekArt';
import { FULL_W } from '../../lib/railLayout';

const RED = '#E61417';
const ORANGE = '#f97316';

export const activityImage = (a: any): string | null =>
  trekArtFor(a)?.poster || a?.images?.[0]?.url || a?.images?.[0] || a?.coverImage || a?.imageUrl || null;

/** Categories arrive as a list ("Trekking", "Adventure"); older ones as a string. */
export const activityTags = (a: any): string[] =>
  (Array.isArray(a?.category) ? a.category : a?.category ? [a.category] : []).filter(Boolean);

const priceOf = (a: any) => a?.pricing?.basePrice ?? a?.basePrice ?? a?.price ?? 0;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function Facts({ a }: { a: any }) {
  const city = a?.location?.city || a?.city || a?.destination || '';
  const duration = a?.duration?.label || a?.durationLabel || '';
  return (
    <View style={s.facts}>
      {city ? (
        <View style={s.fact}>
          <Ionicons name="location" size={12} color="#fdba74" />
          <Text style={s.factText} numberOfLines={1}>{city}</Text>
        </View>
      ) : null}
      {duration ? (
        <View style={s.fact}>
          <Ionicons name="time" size={12} color="#fdba74" />
          <Text style={s.factText}>{duration}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** A wide poster for the Featured rail. */
export function FeaturedPoster({ a, onPress }: { a: any; onPress: () => void }) {
  const img = activityImage(a);
  const price = priceOf(a);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a.title} style={({ pressed }) => [s.feat, pressed && { transform: [{ scale: 0.985 }] }]}>
      <LinearGradient colors={['#1f2937', '#0b0b0b']} style={StyleSheet.absoluteFill} />
      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" /> : null}
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.88)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.featTop}>
        <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.featBadge}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={s.featBadgeText}>FEATURED</Text>
        </LinearGradient>
        {a?.instantBooking?.enabled ? (
          <View style={s.instant}><Ionicons name="flash" size={10} color="#111827" /><Text style={s.instantText}>Instant</Text></View>
        ) : null}
      </View>
      <View style={s.featFoot}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.featTitle} numberOfLines={2}>{a.title || 'Experience'}</Text>
          <Facts a={a} />
        </View>
        {price > 0 ? (
          <View style={s.featPrice}>
            <Text style={s.featFrom}>FROM</Text>
            <Text style={s.featAmount}>{inr(price)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The list card. */
export function ExploreCard({ a, onPress }: { a: any; onPress: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const [img, setImg] = useState(activityImage(a));
  const price = priceOf(a);
  const tags = activityTags(a).slice(0, 3);
  const incl: string[] = (a?.pricing?.includesWhat || []).map((x: string) => String(x).replace(/^[^A-Za-z0-9]+/, '').trim()).filter(Boolean);
  const rating = a?.rating?.average || 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a.title}
      style={({ pressed }) => [s.card, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={s.photo}>
        <LinearGradient colors={['#fb923c', RED]} style={StyleSheet.absoluteFill} />
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" onError={() => setImg(null)} /> : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="compass" size={44} color="rgba(255,255,255,0.4)" /></View>
        )}
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.topRow}>
          {a?.instantBooking?.enabled ? (
            <View style={s.instant}><Ionicons name="flash" size={10} color="#111827" /><Text style={s.instantText}>Instant confirm</Text></View>
          ) : <View />}
          {rating > 0 ? (
            <View style={s.rating}><Ionicons name="star" size={11} color="#f59e0b" /><Text style={s.ratingText}>{rating.toFixed(1)}</Text></View>
          ) : null}
        </View>
        <View style={s.photoFoot}>
          {tags.length ? (
            <View style={s.tags}>
              {tags.map((t) => <View key={t} style={s.tag}><Text style={s.tagText} numberOfLines={1}>{t}</Text></View>)}
            </View>
          ) : null}
          <Text style={s.title} numberOfLines={2}>{a.title || 'Experience'}</Text>
          <Facts a={a} />
        </View>
      </View>

      <View style={s.stub}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {incl.length ? (
            <View style={s.inclRow}>
              <Ionicons name="checkmark-circle" size={13} color="#10b981" />
              <Text style={[s.incl, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {incl.slice(0, 2).join(' · ')}{incl.length > 2 ? ` +${incl.length - 2}` : ''}
              </Text>
            </View>
          ) : null}
          {price > 0 ? (
            <Text style={[s.price, { color: themeColors.text }]}>
              {inr(price)}<Text style={[s.per, { color: themeColors.textTertiary }]}> / person</Text>
            </Text>
          ) : null}
        </View>
        <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.book}>
          <Text style={s.bookText}>View</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  feat: {
    width: FULL_W, height: 250, borderRadius: 26, overflow: 'hidden', justifyContent: 'space-between',
    shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  featTop: { flexDirection: 'row', gap: 6, padding: 14 },
  featBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  featBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  featFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 16 },
  featTitle: {
    color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: -0.5, lineHeight: 27,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  featPrice: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'flex-end' },
  featFrom: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#6b7280' },
  featAmount: { fontSize: 17, fontWeight: '900', color: '#111827' },

  instant: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  instantText: { color: '#111827', fontSize: 10.5, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '70%' },
  factText: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' },

  card: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  photo: { aspectRatio: 16 / 11, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  photoFoot: { padding: 16, paddingTop: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  title: {
    color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.4, lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 },
  },
  stub: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  inclRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  incl: { flex: 1, fontSize: 12, fontWeight: '600' },
  price: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  per: { fontSize: 12, fontWeight: '600' },
  book: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 },
  bookText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
