// "Discover by Interest" cards, ported from the web home page:
//   components/collections/DiscoverByInterest (data) + PosterTile variant="mood"
//
// The photo is the whole card, ringed in the mood's own colour, with a short
// looping clip over it, the big poster name, the mood's perks as glass chips
// and a "15+ places" tag. The clip's first frame is the photo, so the switch
// from picture to video cannot be seen. Keep the data in step with the web.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowRight, Mountain, Footprints, Coffee, Umbrella, Waves, Sunset, BedDouble,
  UtensilsCrossed, Palmtree, Sparkles, Plane, Wallet, CalendarDays, Car, Tent,
} from 'lucide-react-native';
import { spacing } from '@prayana/shared-ui';
import { CardVideo, useRailPlayback } from './HomeRails';
import { RAIL_GAP, TWO_UP_W } from '../../lib/railLayout';

const CARD_W = TWO_UP_W;
const CARD_H = Math.round((CARD_W * 4.3) / 3); // the web's 3:4.3 poster
const GAP = RAIL_GAP;
const CLIP_CDN = 'https://prayanaai.com/images/interest-clips';

type Perk = { label: string; Icon: React.ComponentType<any> };
type Mood = {
  id: string;
  name: string;   // the big name on the poster
  kind: string;   // the word set in the top-left pill
  strap: string;
  accent: string;
  perks: Perk[];
  count: number;
  clip: string;   // file name under CLIP_CDN, without extension
};

// A re-cut clip gets a new file name on the CDN (cached for a year), hence
// "honeymoon-2" and the two "-reel" files.
const MOODS: Mood[] = [
  {
    id: 'mountain', name: 'Hill Stations', kind: 'Escapes', strap: 'Escape to peaceful mountain retreats',
    accent: '#38BDF8', count: 15, clip: 'hill-stations-reel',
    perks: [{ label: 'Viewpoints', Icon: Mountain }, { label: 'Treks', Icon: Footprints }, { label: 'Cafés', Icon: Coffee }],
  },
  {
    id: 'beach', name: 'Beaches', kind: 'Getaways', strap: 'Sun, sand, and crystal-clear waters',
    accent: '#06B6D4', count: 12, clip: 'beach',
    perks: [{ label: 'Beaches', Icon: Umbrella }, { label: 'Water sports', Icon: Waves }, { label: 'Sunsets', Icon: Sunset }],
  },
  {
    id: 'romantic', name: 'Romantic', kind: 'Getaways', strap: 'Perfect spots for couples',
    accent: '#F43F5E', count: 18, clip: 'romantic',
    perks: [{ label: 'Sunsets', Icon: Sunset }, { label: 'Stays', Icon: BedDouble }, { label: 'Dining', Icon: UtensilsCrossed }],
  },
  {
    id: 'honeymoon', name: 'Honeymoon', kind: 'Escapes', strap: 'Magical moments for newlyweds',
    accent: '#EC4899', count: 20, clip: 'honeymoon-2',
    perks: [{ label: 'Resorts', Icon: Palmtree }, { label: 'Spa', Icon: Sparkles }, { label: 'Islands', Icon: Umbrella }],
  },
  {
    id: 'international', name: 'Abroad', kind: 'On a budget', strap: 'Explore the world on a budget',
    accent: '#8B5CF6', count: 25, clip: 'abroad-reel',
    perks: [{ label: 'Flights', Icon: Plane }, { label: 'Stays', Icon: BedDouble }, { label: 'Budget', Icon: Wallet }],
  },
  {
    id: 'weekend', name: 'Weekend', kind: 'Getaways', strap: 'Quick escapes from city life',
    accent: '#F59E0B', count: 22, clip: 'weekend',
    perks: [{ label: '2 days', Icon: CalendarDays }, { label: 'Road trip', Icon: Car }, { label: 'Stays', Icon: BedDouble }],
  },
  {
    id: 'adventure', name: 'Adventure', kind: 'Trips', strap: 'For the adrenaline seekers',
    accent: '#22C55E', count: 14, clip: 'adventure',
    perks: [{ label: 'Treks', Icon: Footprints }, { label: 'Rafting', Icon: Waves }, { label: 'Camping', Icon: Tent }],
  },
];

function MoodCard({ mood, playing }: { mood: Mood; playing: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/interest/${mood.id}` as any)}
      style={({ pressed }) => [styles.shadow, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="link"
      accessibilityLabel={`${mood.name} ${mood.kind}`}
    >
      {/* The coloured ring: a 2px gradient frame around the photo. */}
      <LinearGradient
        colors={[mood.accent, 'rgba(255,255,255,0.25)', mood.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ring}
      >
        <View style={styles.inner}>
          <Image
            source={{ uri: `${CLIP_CDN}/${mood.clip}.jpg` }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          {playing && <CardVideo uri={`${CLIP_CDN}/${mood.clip}.mp4`} />}
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.3, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={[styles.pill, styles.kindPill]}>
            <Text style={styles.kindText}>{mood.kind}</Text>
          </View>
          <View style={[styles.pill, styles.countPill, { backgroundColor: mood.accent }]}>
            <Text style={styles.countText}>{mood.count}+ places</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>{mood.name}</Text>
            <View style={[styles.bar, { backgroundColor: mood.accent }]} />
            <Text style={styles.strap} numberOfLines={1}>{mood.strap}</Text>
            <View style={styles.perks}>
              {mood.perks.map(({ label, Icon }) => (
                <View key={label} style={styles.perk}>
                  <Icon size={12} color="#fff" strokeWidth={2} />
                  <Text style={styles.perkText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* White button with a soft glass halo around it. */}
          <View style={styles.arrowHalo}>
            <View style={styles.arrow}>
              <ArrowRight size={16} color="#111827" />
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function DiscoverByInterestRail() {
  const { canPlay, scrollProps } = useRailPlayback(CARD_W, GAP, { video: true });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      {...scrollProps}
    >
      {MOODS.map((mood, i) => (
        <MoodCard key={mood.id} mood={mood} playing={canPlay(i)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { gap: GAP, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  shadow: {
    borderRadius: 26,
    shadowColor: '#111827', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  ring: { width: CARD_W, height: CARD_H, borderRadius: 26, padding: 2 },
  inner: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#111827' },

  pill: { position: 'absolute', top: 10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  kindPill: {
    left: 10, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  kindText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  countPill: { right: 10 },
  countText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },

  body: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  name: {
    color: '#fff', fontSize: 21, fontWeight: '900', lineHeight: 23, letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 3 },
  },
  bar: { marginTop: 8, height: 3, width: 40, borderRadius: 999 },
  strap: { marginTop: 6, color: 'rgba(255,255,255,0.85)', fontSize: 11.5, lineHeight: 15 },
  // Right padding keeps the chips clear of the arrow button.
  perks: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxHeight: 48, overflow: 'hidden', paddingRight: 40 },
  perk: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3,
  },
  perkText: { color: '#fff', fontSize: 9.5, fontWeight: '600' },
  arrowHalo: {
    position: 'absolute', right: 8, bottom: 8, padding: 3, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  arrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
});
