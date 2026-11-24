// "Adventure Hotspots": the places our vendors run activities in (Jim
// Corbett, Rishikesh…) as a row of round photos, like stories. It's small,
// colourful and quick to swipe, and each circle opens that place's
// activities. Same data as the web's ActivityPlacesRail. It renders nothing
// until there are at least two places.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { retryOnce } from '../../lib/retryOnce';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { PressableScale } from '../ui/PressableScale';
import { SectionHeader, SECTION_PAD } from './SectionHeader';
import { sizedImageUrl } from '../../lib/imageUrl';
import { RailPlaceholder } from './HomeRails';

type Place = { city: string; state?: string; count: number; image?: string; photos?: string[] };

const SIZE = 74; // the photo; the ring adds 3px a side

export function PlacesStrip() {
  const { themeColors, isDarkMode } = useTheme();
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    let alive = true;
    retryOnce(() => makeAPICall('/activities/places'))
      .then((res: any) => alive && setPlaces(Array.isArray(res?.data) ? res.data : []))
      .catch(() => alive && setPlaces([]));
    return () => { alive = false; };
  }, []);

  if (places === null) return <RailPlaceholder cardW={SIZE + 8} round paddingTop={32} />;
  if (places.length < 2) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Adventure Hotspots"
        onSeeAll={() => router.push('/global-experiences' as any)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {places.map((p) => {
          const photo = p.image || p.photos?.[0];
          return (
            <PressableScale
              key={p.city}
              scaleTo={0.92}
              onPress={() => router.push(`/global-experiences?q=${encodeURIComponent(p.city)}` as any)}
              accessibilityRole="link"
              accessibilityLabel={`${p.city}, ${p.count} activities`}
              style={styles.item}
            >
              <LinearGradient
                colors={['#4AC0CC', '#FB923C', '#E61417']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.ring}
              >
                <View style={[styles.gap, { backgroundColor: themeColors.background }]}>
                  {photo ? (
                    <Image
                      source={{ uri: sizedImageUrl(photo, SIZE) }}
                      style={styles.photo}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.photo, { backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                  )}
                </View>
              </LinearGradient>
              <Text style={[styles.name, { color: themeColors.text }]} numberOfLines={1}>{p.city}</Text>
              <Text style={[styles.count, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {p.count} {p.count === 1 ? 'activity' : 'activities'}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 32 },
  row: { paddingHorizontal: SECTION_PAD, gap: 14 },
  item: { width: SIZE + 10, alignItems: 'center' },
  ring: { width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, padding: 2.5 },
  gap: { flex: 1, borderRadius: SIZE, padding: 2.5 },
  photo: { flex: 1, borderRadius: SIZE },
  name: { marginTop: 8, fontSize: 12.5, fontWeight: '700', maxWidth: SIZE + 10, textAlign: 'center' },
  count: { marginTop: 1, fontSize: 11, maxWidth: SIZE + 10, textAlign: 'center' },
});

export default PlacesStrip;
