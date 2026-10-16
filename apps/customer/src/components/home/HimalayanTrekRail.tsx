// "Himalayan Trails Worth the Climb", ported from the web home page:
//   components/collections/TrekkingSection + PosterTile variant="altitude"
//
// A dark poster per trek: the grade as signal bars and the days on the trail
// across the top, faint contour lines over the photo, the trek's name in a
// yellow script with its summit height under it, and the region and rating
// beneath. Photos step through the trek's gallery while it is on screen.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useFonts, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { ArrowRight } from 'lucide-react-native';
import { spacing } from '@prayana/shared-ui';
import { Rail, useRailPlayback, useRailClock, usePhotoStep } from './HomeRails';
import { RAIL_GAP, TWO_UP_W } from '../../lib/railLayout';
import {
  HIMALAYAN_TREKS, TREK_FACTS, TREK_GALLERY, type HimalayanTrek,
} from '../../lib/himalayanTreks';

const CARD_W = TWO_UP_W;
const PHOTO_H = Math.round((CARD_W * 5) / 4); // the web's 4:5 photo
const GAP = RAIL_GAP;

/** Grade -> bar colour and how many of the three bars are lit. */
function gradeOf(level = '') {
  if (/diff|hard|strenu/i.test(level)) return { tone: '#F43F5E', bars: 3 };
  if (/mod/i.test(level)) return { tone: '#F59E0B', bars: 2 };
  return { tone: '#10B981', bars: 1 };
}

/** The web's six contour lines, in a 200×250 box stretched over the photo. */
const CONTOURS = [0, 1, 2, 3, 4, 5].map(
  (k) => `M-10 ${150 + k * 16} C 40 ${120 + k * 14}, 80 ${175 + k * 10}, 120 ${140 + k * 14} S 190 ${150 + k * 12}, 215 ${130 + k * 15}`,
);

function AltitudeCard({ trek, playing, tick, script, onPress }: {
  trek: HimalayanTrek; playing: boolean; tick: number; script?: string; onPress: () => void;
}) {
  const [level, days, height] = TREK_FACTS[trek.id] || [];
  const grade = gradeOf(level);
  const name = trek.name.replace(/\s+Trek$/i, '');
  const frames = useMemo(
    () => [...new Set([trek.image, ...(TREK_GALLERY[trek.id] || [])])],
    [trek],
  );
  const { photo, onLoad } = usePhotoStep(frames, playing, tick, CARD_W);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="link"
      accessibilityLabel={`${trek.name}, ${trek.location}${height ? `, up to ${height}` : ''}`}
    >
      <View style={styles.photo}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={700}
            cachePolicy="memory-disk"
            onLoad={onLoad}
          />
        ) : null}
        <LinearGradient
          colors={['rgba(2,6,23,0.55)', 'rgba(2,6,23,0)', 'rgba(2,6,23,0.2)', 'rgba(2,6,23,0.97)']}
          locations={[0, 0.35, 0.6, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Svg style={[StyleSheet.absoluteFill, { opacity: 0.3 }]} viewBox="0 0 200 250" preserveAspectRatio="none" pointerEvents="none">
          {CONTOURS.map((d) => (
            <Path key={d} d={d} fill="none" stroke="#7DD3FC" strokeWidth={0.6} />
          ))}
        </Svg>

        <View style={styles.topRow}>
          {!!level && (
            <View style={styles.levelPill}>
              <View style={styles.bars}>
                {[1, 2, 3].map((b) => (
                  <View
                    key={b}
                    style={[
                      styles.bar,
                      { height: 4 + b * 3, backgroundColor: b <= grade.bars ? grade.tone : 'rgba(255,255,255,0.3)' },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.levelText}>{level.toUpperCase()}</Text>
            </View>
          )}
          {!!days && (
            <View style={styles.daysPill}>
              <Text style={styles.daysText}>{days}</Text>
            </View>
          )}
        </View>

        <View style={styles.photoBody}>
          <Text
            style={[
              styles.name,
              { fontSize: name.length > 14 ? 24 : 30, lineHeight: name.length > 14 ? 26 : 32 },
              script ? { fontFamily: script } : styles.nameFallback,
            ]}
            numberOfLines={2}
          >
            {name}
          </Text>
          {!!height && (
            <View style={styles.maxPill}>
              <Text style={styles.maxLabel}>MAX</Text>
              <Text style={styles.maxValue}>{height}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.where} numberOfLines={1}>
          {trek.location}
          {trek.rating ? <Text style={styles.rating}> · ★ {trek.rating} rated</Text> : null}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Explore</Text>
          <ArrowRight size={14} color="#111827" />
        </View>
      </View>
    </Pressable>
  );
}

export function HimalayanTrekRail({ onTrekPress }: {
  onTrekPress: (trek: HimalayanTrek) => void;
}) {
  // Until the script face has loaded the names show in a bold italic serif,
  // so the cards never wait on the font.
  const [fontsLoaded] = useFonts({ DancingScript_700Bold });
  const { canPlay, scrollProps, inView } = useRailPlayback(CARD_W, GAP);
  const tick = useRailClock(inView);
  return (
    <Rail scrollProps={scrollProps} contentContainerStyle={styles.rail}>
      {HIMALAYAN_TREKS.map((trek, i) => (
        <AltitudeCard
          key={trek.id}
          trek={trek}
          playing={canPlay(i)}
          tick={tick}
          script={fontsLoaded ? 'DancingScript_700Bold' : undefined}
          onPress={() => onTrekPress(trek)}
        />
      ))}
    </Rail>
  );
}

const styles = StyleSheet.create({
  rail: { gap: GAP, paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16 },
  card: {
    width: CARD_W, borderRadius: 22, overflow: 'hidden', backgroundColor: '#020617',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#020617', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  photo: { height: PHOTO_H, overflow: 'hidden', backgroundColor: '#0F172A' },

  topRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 7, paddingVertical: 4,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 3, borderRadius: 1 },
  levelText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  daysPill: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 7, paddingVertical: 4 },
  daysText: { color: '#0F172A', fontSize: 9.5, fontWeight: '800' },

  photoBody: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'flex-start' },
  name: {
    color: '#FFE135',
    textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 1, textShadowOffset: { width: 2, height: 3 },
  },
  nameFallback: { fontStyle: 'italic', fontWeight: '800' },
  maxPill: {
    marginTop: 8, flexDirection: 'row', alignItems: 'baseline', gap: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  maxLabel: { color: 'rgba(125,211,252,0.9)', fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  maxValue: { color: '#fff', fontSize: 12, fontWeight: '800' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  where: { flex: 1, color: '#CBD5E1', fontSize: 10.5, fontWeight: '600' },
  rating: { color: '#64748B' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999,
    backgroundColor: '#fff', paddingHorizontal: 9, paddingVertical: 5,
  },
  ctaText: { color: '#111827', fontSize: 11, fontWeight: '600' },
});
