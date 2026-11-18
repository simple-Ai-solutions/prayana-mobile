// "Things to Do": one soft light tile per kind of activity (Tours, Wildlife,
// Food Tours…), the name in bold at the top left, the count under it and the
// photo tucked into the bottom-right corner, as on the web. On Wi-Fi, while on screen, the photos cross-fade through
// that kind's set; on mobile data a card keeps its first photo. Same data as
// the web's ActivityKindsRail. It hides itself with fewer than three kinds.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { spacing, useTheme } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { PressableScale } from '../ui/PressableScale';
import { SectionHeader } from './SectionHeader';
import { Rail, useRailPlayback, useRailClock } from './HomeRails';
import { RAIL_GAP } from '../../lib/railLayout';
import { categorySlug } from '../../lib/categoryMenuData';
import { sizedImageUrl } from '../../lib/imageUrl';

type Kind = { category: string; name: string; count: number; photos: string[] };

const CARD_W = 132; // the web's phone tile width
const CARD_H = 176; // 3:4

export function ThingsToDoRail() {
  const { isDarkMode } = useTheme();
  const [kinds, setKinds] = useState<Kind[] | null>(null);
  const { canPlay, scrollProps, inView } = useRailPlayback(CARD_W, RAIL_GAP);
  const tick = useRailClock(inView);

  useEffect(() => {
    let alive = true;
    makeAPICall('/activities/kinds')
      .then((res: any) => alive && setKinds(Array.isArray(res?.data) ? res.data.filter((k: Kind) => k.photos?.length) : []))
      .catch(() => alive && setKinds([]));
    return () => { alive = false; };
  }, []);

  if (!kinds || kinds.length < 3) return null;

  // The web's soft light tile (#f4f4f8; gray-800 in dark mode). The photo's
  // fade runs from this colour to clear.
  const tile = isDarkMode ? '#1F2937' : '#F4F4F8';
  const rgb = isDarkMode ? '31,41,55' : '244,244,248';
  const fade = (a: number) => `rgba(${rgb},${a})`;

  const open = (k: Kind) => {
    const slug = categorySlug(k.category);
    router.push((slug ? `/experiences/${slug}` : `/global-experiences?q=${encodeURIComponent(k.name)}`) as any);
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Things to Do" onSeeAll={() => router.push('/global-experiences' as any)} />
      <Rail scrollProps={scrollProps} contentContainerStyle={styles.rail}>
        {kinds.map((k, i) => {
          // Staggered so the cards don't all change at once.
          const frame = canPlay(i) ? (tick + i) % k.photos.length : 0;
          return (
            <PressableScale
              key={k.category}
              onPress={() => open(k)}
              accessibilityRole="link"
              accessibilityLabel={`${k.name}, ${k.count} experiences`}
              style={[styles.card, { backgroundColor: tile, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            >
              {/* The picture, rounded into the bottom-right corner and fading
                  toward the name so it sits on the tile like an object. */}
              <View style={styles.photoBox}>
                <Image
                  source={{ uri: sizedImageUrl(k.photos[frame], CARD_W) }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={600}
                  cachePolicy="memory-disk"
                />
                <LinearGradient
                  colors={[tile, fade(0.6), fade(0)]}
                  locations={[0, 0.2, 0.55]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={[tile, fade(0.5), fade(0)]}
                  locations={[0, 0.18, 0.5]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </View>
              <Text style={[styles.name, { color: isDarkMode ? '#fff' : '#111827' }]} numberOfLines={2}>{k.name}</Text>
              <Text style={[styles.count, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                {k.count.toLocaleString('en-IN')}+
              </Text>
            </PressableScale>
          );
        })}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 36 },
  rail: { gap: RAIL_GAP, paddingHorizontal: spacing.lg },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  name: {
    paddingHorizontal: 14,
    paddingTop: 14,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  count: { paddingHorizontal: 14, marginTop: 2, fontSize: 11, fontWeight: '500' },
  photoBox: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '88%',
    height: '64%',
    borderTopLeftRadius: 48,
    overflow: 'hidden',
  },
});

export default ThingsToDoRail;
