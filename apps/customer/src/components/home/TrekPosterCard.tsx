// The trek rail's poster card, ported from the web's
// components/activities/TrekPosterClassic.jsx: a tall poster with the trek's
// name set big in yellow block capitals, a one-line strap, and a glass strip
// of what the price includes; beneath it a plain block with when it runs,
// the title, where it is and the price. No operator name — the card sells the
// experience.
//
// The commissioned clip plays over the poster on Wi-Fi only.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight, Bus, CalendarDays, Camera, Coffee, FileCheck2, HeartPulse, MapPin, Tent,
  UserRound, UtensilsCrossed,
} from 'lucide-react-native';
import { useTheme } from '@prayana/shared-ui';
import { trekArtFor } from '../../lib/trekArt';
import { normalizeImageUrl } from '../../lib/imageUrl';
import { TWO_UP_W } from '../../lib/railLayout';
import {
  displayTitle, hashOf, inclusions, isTrekking, posterName, regionOf, scheduleLine, strapFor,
  type Inclusion,
} from '../../lib/trekPoster';

export const POSTER_CARD_W = TWO_UP_W;
const POSTER_H = Math.round((POSTER_CARD_W * 5) / 4); // the web's 4:5 poster
const ORANGE = '#EA580C'; // the web's brand-600

const PERK_ICONS: Record<Inclusion, React.ComponentType<any>> = {
  Travel: Bus, Guide: UserRound, Permits: FileCheck2, Food: UtensilsCrossed, Stay: Tent,
  'First aid': HeartPulse, Photos: Camera, Tea: Coffee,
};

const inr = (n: number) => Math.round(n).toLocaleString('en-IN');

const primaryImage = (images?: any[]): string | undefined => {
  const list = (Array.isArray(images) ? images : []).filter((i) => i?.url);
  const pick = list.find((i) => i.isPrimary) || list[0];
  return pick?.url ? normalizeImageUrl(pick.url) : undefined;
};

export function TrekPosterCard({ activity, video, onPress }: {
  activity: any;
  /** The playing clip, when there is one to play now; the rail decides. */
  video?: React.ReactNode;
  onPress: () => void;
}) {
  const { isDarkMode } = useTheme();
  const trek = isTrekking(activity);
  const seed = hashOf(String(activity._id || activity.title || ''));
  const art = trek ? trekArtFor(activity) : null;
  const imageUrl = art?.poster || primaryImage(activity.images);

  const price = activity.platformSellingPrice || activity.pricing?.basePrice || 0;
  const hasDiscount = activity.platformDiscountPercent > 0 && activity.platformMRP > price;
  const perLabel = activity.pricing?.priceType === 'per_group' ? 'per group' : 'per person';
  const durationLabel = activity.duration?.label
    || (activity.duration?.value ? `${activity.duration.value} ${activity.duration.unit || 'days'}` : null);
  const region = regionOf(activity, trek);
  const title = displayTitle(activity.title, trek ? region : null);
  const when = scheduleLine(activity, durationLabel);
  const { name, kind } = posterName(activity.title, trek);
  const perks = inclusions(activity);
  // The web scales the name up 1.25× tall; sized here so the longest names fit.
  const nameSize = name.length > 18 ? 15 : name.length > 12 ? 18 : 24;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isDarkMode && styles.cardDark,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="link"
      accessibilityLabel={[title, region, when].filter(Boolean).join(', ')}
    >
      {/* ── The poster ─────────────────────────────────────────────── */}
      <View style={styles.poster}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient colors={['#374151', '#111827']} style={StyleSheet.absoluteFill} />
        )}
        {video}

        {/* Top and bottom washes so white and yellow type hold on any
            photo, while the middle of the picture stays clear. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.26, 0.46, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.head}>
          {!!kind && <Text style={styles.kind}>{kind.toUpperCase()}</Text>}
          <Text
            style={[styles.name, { fontSize: nameSize, lineHeight: nameSize }]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {name.toUpperCase()}
          </Text>
          <View style={styles.strapPill}>
            <Text style={styles.strap} numberOfLines={1}>{strapFor(activity, trek, seed)}</Text>
          </View>
        </View>

        {perks.length > 0 && (
          <View style={styles.perkWrap}>
            <View style={styles.perkStrip}>
              {perks.map((label, k) => {
                const Icon = PERK_ICONS[label];
                return (
                  <View key={label} style={[styles.perk, k > 0 && styles.perkDivider]}>
                    <Icon size={15} color="#fff" strokeWidth={1.6} />
                    <Text style={styles.perkText}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* ── The facts ──────────────────────────────────────────────── */}
      <View style={styles.facts}>
        {!!when && (
          <View style={styles.whenRow}>
            <CalendarDays size={14} color={isDarkMode ? '#FB923C' : ORANGE} />
            <Text style={[styles.when, isDarkMode && { color: '#FB923C' }]} numberOfLines={1}>
              {when.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.title, isDarkMode && { color: '#fff' }]} numberOfLines={1}>{title}</Text>
        {!!region && (
          <View style={styles.regionRow}>
            <MapPin size={14} color="#6B7280" />
            <Text style={styles.region} numberOfLines={1}>{region}</Text>
          </View>
        )}
        {price > 0 && (
          <View style={styles.priceRow}>
            <View style={{ flexShrink: 1 }}>
              {hasDiscount && (
                <Text style={styles.mrp}>
                  <Text style={styles.strike}>₹{inr(activity.platformMRP)}</Text>
                  <Text style={styles.off}>  {Math.round(activity.platformDiscountPercent)}% off</Text>
                </Text>
              )}
              <Text numberOfLines={1}>
                <Text style={[styles.price, isDarkMode && { color: '#fff' }]}>₹{inr(price)}</Text>
              </Text>
            </View>
            <View style={[styles.view, isDarkMode && { backgroundColor: '#fff' }]}>
              <Text style={[styles.viewText, isDarkMode && { color: '#111827' }]}>View</Text>
              <ArrowRight size={14} color={isDarkMode ? '#111827' : '#fff'} />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: POSTER_CARD_W, borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(229,231,235,0.8)',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardDark: { backgroundColor: '#111827', borderColor: '#1F2937' },
  poster: { height: POSTER_H, overflow: 'hidden', backgroundColor: '#111827' },

  head: { position: 'absolute', top: 14, left: 10, right: 10, alignItems: 'center' },
  kind: {
    color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700', letterSpacing: 2.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  name: {
    marginTop: 4, color: '#FFE135', fontWeight: '900', letterSpacing: -0.5, textAlign: 'center',
    transform: [{ scaleY: 1.25 }],
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 1, textShadowOffset: { width: 0, height: 3 },
  },
  strapPill: { marginTop: 10, maxWidth: '100%', borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4 },
  strap: { color: 'rgba(255,255,255,0.95)', fontSize: 9.5, fontWeight: '600' },

  perkWrap: { position: 'absolute', left: 6, right: 6, bottom: 8, alignItems: 'center' },
  perkStrip: { flexDirection: 'row', borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 3, paddingVertical: 5 },
  perk: { alignItems: 'center', gap: 2, paddingHorizontal: 5 },
  perkDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)' },
  perkText: { color: '#fff', fontSize: 9, fontWeight: '600' },

  facts: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  when: { flexShrink: 1, color: ORANGE, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  title: { marginTop: 4, color: '#111827', fontSize: 13.5, fontWeight: '700' },
  regionRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  region: { flexShrink: 1, color: '#6B7280', fontSize: 12 },
  priceRow: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  mrp: { marginBottom: 2, fontSize: 11, color: '#9CA3AF' },
  strike: { textDecorationLine: 'line-through' },
  off: { fontWeight: '700', color: ORANGE },
  price: { color: '#111827', fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  per: { color: '#6B7280', fontSize: 11 },
  view: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999,
    backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6,
  },
  viewText: { color: '#fff', fontSize: 11.5, fontWeight: '600' },
});
