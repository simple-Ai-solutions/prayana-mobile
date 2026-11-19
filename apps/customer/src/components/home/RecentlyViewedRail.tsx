// "Recently viewed" on home: the activities this phone opened last (stored
// on the device by the activity page), refreshed every time home comes back
// into view, so a trek you just looked at is waiting when you return. Hidden
// until there's history, so a first-time visitor sees nothing empty.
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { PressableScale } from '../ui/PressableScale';
import { SectionHeader, SECTION_PAD } from './SectionHeader';
import { getRecentlyViewed, RecentActivity } from '../../lib/recentlyViewedActivities';
import { handOffPhoto } from '../../lib/photoHandoff';
import { normalizeImageUrl, sizedImageUrl } from '../../lib/imageUrl';

const RECENT_W = 128;

function inr(n?: number | null) {
  return typeof n === 'number' && n > 0 ? `₹${Math.round(n).toLocaleString('en-IN')}` : null;
}

export function RecentlyViewedRail() {
  const { themeColors, isDarkMode } = useTheme();
  const [items, setItems] = useState<RecentActivity[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getRecentlyViewed().then((list) => alive && setItems(list));
      return () => { alive = false; };
    }, []),
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Recently viewed" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((a) => {
          const photo = a.image ? sizedImageUrl(normalizeImageUrl(a.image) || a.image, RECENT_W) : null;
          const price = inr(a.sellingPrice ?? a.price);
          return (
            <PressableScale
              key={a.id}
              onPress={() => {
                handOffPhoto(a.id, photo);
                router.push(`/activity/${a.id}` as any);
              }}
              accessibilityRole="link"
              accessibilityLabel={a.title}
              wrapperStyle={{ width: RECENT_W }}
            >
              <View style={[styles.recentPhoto, { backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB' }]}>
                {!!photo && (
                  <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                )}
              </View>
              <Text style={[styles.recentTitle, { color: themeColors.text }]} numberOfLines={2}>{a.title}</Text>
              {!!price && <Text style={[styles.recentPrice, { color: themeColors.textSecondary }]}>{price}</Text>}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 36 },
  row: { paddingHorizontal: SECTION_PAD, gap: 14 },
  recentPhoto: { width: RECENT_W, height: RECENT_W, borderRadius: 16, overflow: 'hidden' },
  recentTitle: { marginTop: 8, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  recentPrice: { marginTop: 2, fontSize: 12, fontWeight: '600' },
});
