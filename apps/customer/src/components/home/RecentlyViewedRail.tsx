// "Recently viewed" on home: the activities this phone opened last (stored
// on the device by the activity page), refreshed every time home comes back
// into view, so a trek you just looked at is waiting when you return. Hidden
// until there's history, so a first-time visitor sees nothing empty.
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { PressableScale } from '../ui/PressableScale';
import { SectionHeader, SECTION_PAD } from './SectionHeader';
import { getRecentlyViewed, RecentActivity } from '../../lib/recentlyViewedActivities';
import { handOffPhoto } from '../../lib/photoHandoff';
import { normalizeImageUrl, sizedImageUrl } from '../../lib/imageUrl';

const CARD_W = 248;
const PHOTO = 68;

function inr(n?: number | null) {
  return typeof n === 'number' && n > 0 ? `₹${Math.round(n).toLocaleString('en-IN')}` : null;
}

/** Tidies ALL-CAPS names ("KODACHADRI TREK" → "Kodachadri Trek"). */
function cleanTitle(t: string) {
  const s = String(t || '').trim();
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

/** "Viewed today", "Viewed yesterday", "Viewed 3 days ago". */
function viewedLabel(at?: number) {
  if (!at) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.floor((start.getTime() - new Date(at).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'Viewed today';
  if (days === 1) return 'Viewed yesterday';
  if (days < 7) return `Viewed ${days} days ago`;
  return null;
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
      {/* Compact history cards: small photo, then what it was, where and
          the price. Lighter than the big rails, so it reads as "pick up
          where you left off" rather than another shelf to browse. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((a) => {
          const photo = a.image ? sizedImageUrl(normalizeImageUrl(a.image) || a.image, PHOTO) : null;
          const price = inr(a.sellingPrice ?? a.price);
          const seen = viewedLabel(a.viewedAt);
          const meta = a.city || '';
          return (
            <PressableScale
              key={a.id}
              onPress={() => {
                handOffPhoto(a.id, a.image ? normalizeImageUrl(a.image) || a.image : null);
                router.push(`/activity/${a.id}` as any);
              }}
              accessibilityRole="link"
              accessibilityLabel={a.title}
              wrapperStyle={{ width: CARD_W }}
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode ? '#141B26' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.07)',
                },
              ]}
            >
              <View style={[styles.photo, { backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB' }]}>
                {!!photo && (
                  <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                )}
              </View>
              <View style={styles.body}>
                {!!seen && <Text style={styles.seen}>{seen}</Text>}
                <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>{cleanTitle(a.title)}</Text>
                {!!meta && (
                  <Text style={[styles.meta, { color: themeColors.textSecondary }]} numberOfLines={1}>{meta}</Text>
                )}
                {!!price && <Text style={[styles.price, { color: themeColors.text }]}>{price}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 36 },
  row: { paddingHorizontal: SECTION_PAD, gap: 12, paddingBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  photo: { width: PHOTO, height: PHOTO, borderRadius: 14, overflow: 'hidden' },
  body: { flex: 1, minWidth: 0 },
  seen: { fontSize: 10.5, fontWeight: '700', color: '#EA580C', marginBottom: 2 },
  title: { fontSize: 13.5, lineHeight: 17, fontWeight: '700', letterSpacing: -0.2 },
  meta: { fontSize: 12, marginTop: 2 },
  price: { fontSize: 13.5, fontWeight: '800', marginTop: 4, letterSpacing: -0.2 },
});
