// "Top 20 Destinations to visit in India", ported from the web home page:
//   components/collections/MasonrySection + PosterTile variant="rank"
//
// A tall photo wearing its list position as a white "#01" chip, the name and
// a one-line strap over it, and a slim bar showing where it sits in the top
// 20; the rating sits in a white strip beneath. While a card is on screen its
// photos step through the place's gallery.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useTheme, spacing } from '@prayana/shared-ui';
import { Rail, useRailPlayback, useRailClock, usePhotoStep } from './HomeRails';
import { RAIL_GAP, TWO_UP_W } from '../../lib/railLayout';
import { TOP_INDIA, TOP_INDIA_GALLERY, type TopPlace } from '../../lib/topIndia';

const CARD_W = TWO_UP_W;
const PHOTO_H = Math.round((CARD_W * 5) / 4); // the web's 4:5 photo
const GAP = RAIL_GAP;

/** "Golden beaches, Portuguese heritage, and …" -> "Golden beaches". */
const strapOf = (d = '') => d.split(/,|\s+with\s+|\s+—\s+/i)[0].trim();

function RankCard({ place, rank, playing, tick, onPress }: {
  place: TopPlace; rank: number; playing: boolean; tick: number; onPress: () => void;
}) {
  const { isDarkMode } = useTheme();
  const frames = useMemo(
    () => [...new Set([place.image, ...(TOP_INDIA_GALLERY[place.id] || [])])],
    [place],
  );
  const { photo, onLoad } = usePhotoStep(frames, playing, tick, CARD_W);
  // Where it sits in the top 20, as the web draws it.
  const barPct = Math.max(8, 100 - ((rank - 1) / 20) * 100);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDarkMode ? '#111827' : '#fff',
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(229,231,235,0.8)',
        },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Number ${rank}, ${place.name}`}
    >
      <View style={styles.photo}>
        <Image
          source={{ uri: photo }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={700}
          cachePolicy="memory-disk"
          onLoad={onLoad}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.28, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.rankChip}>
          <Text style={styles.rankHash}>#</Text>
          <Text style={styles.rankNum}>{String(rank).padStart(2, '0')}</Text>
        </View>
        <View style={styles.photoBody}>
          <Text style={styles.name} numberOfLines={2}>{place.name}</Text>
          <Text style={styles.strap} numberOfLines={1}>{strapOf(place.description)}</Text>
          <View style={styles.track}>
            <LinearGradient
              colors={['#FCD34D', '#F97316']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${barPct}%` }]}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.rating, { color: isDarkMode ? '#FB923C' : '#EA580C' }]} numberOfLines={1}>
          ★ {place.rating}
        </Text>
        <View style={[styles.go, { backgroundColor: isDarkMode ? '#fff' : '#111827' }]}>
          <ArrowRight size={16} color={isDarkMode ? '#111827' : '#fff'} />
        </View>
      </View>
    </Pressable>
  );
}

export function TopIndiaRail({ onPlacePress }: {
  onPlacePress: (place: TopPlace) => void;
}) {
  const { canPlay, scrollProps, inView } = useRailPlayback(CARD_W, GAP);
  const tick = useRailClock(inView);
  return (
    <Rail scrollProps={scrollProps} contentContainerStyle={styles.rail}>
      {TOP_INDIA.map((place, i) => (
        <RankCard
          key={place.id}
          place={place}
          rank={i + 1}
          playing={canPlay(i)}
          tick={tick}
          onPress={() => onPlacePress(place)}
        />
      ))}
    </Rail>
  );
}

const styles = StyleSheet.create({
  rail: { gap: GAP, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  card: {
    width: CARD_W, borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  photo: { height: PHOTO_H, backgroundColor: '#111827', overflow: 'hidden' },

  rankChip: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'baseline', gap: 2,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rankHash: { color: '#F97316', fontSize: 11, fontWeight: '700' },
  rankNum: { color: '#111827', fontSize: 20, fontWeight: '900', lineHeight: 22, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },

  photoBody: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  name: {
    color: '#fff', fontSize: 19, fontWeight: '900', lineHeight: 21, letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 },
  },
  strap: { marginTop: 4, color: 'rgba(255,255,255,0.85)', fontSize: 11.5 },
  track: { marginTop: 10, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  rating: { flex: 1, fontSize: 12, fontWeight: '600' },
  go: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
