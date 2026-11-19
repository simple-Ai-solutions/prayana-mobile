// The two personal rows on home. Both stay hidden until there's something
// real to show, so a first-time visitor sees nothing empty.
//
//   Recently viewed — the activities this phone opened last (stored on the
//     device by the activity page), refreshed every time home comes back
//     into view, so a trek you just looked at is waiting when you return.
//   Because you saved … — more in the town of the last thing you saved to
//     the wishlist, minus what's already saved.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { PressableScale } from '../ui/PressableScale';
import { SectionHeader, SECTION_PAD } from './SectionHeader';
import { ExperienceCard } from '../experiences/ExperienceCard';
import { getRecentlyViewed, RecentActivity } from '../../lib/recentlyViewedActivities';
import { useSavedActivities } from '../../lib/savedActivities';
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

/** "Gangadikal Peak Trek — Chikmagalur" → "Gangadikal Peak Trek". */
function shortTitle(t?: string) {
  return String(t || '').split(/\s[—–-]\s/)[0].trim();
}

export function BecauseYouSavedRail() {
  const ids = useSavedActivities((s) => s.ids);
  const lastSaved = ids[0];
  const [state, setState] = useState<{ seed: string; title: string; place: string; near: boolean; items: any[] } | null>(null);

  useEffect(() => {
    useSavedActivities.getState().load();
  }, []);

  useEffect(() => {
    if (!lastSaved) {
      setState(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res: any = await activityMarketplaceAPI.getActivityById(lastSaved);
        const a = res?.data;
        // The listed town can be a tiny village ("Samse") with nothing else in
        // it, so also try the area in the title ("… — Chikmagalur"), then the
        // state, and use the first that has at least two more to show.
        const titleArea = String(a?.title || '').split(/\s[—–]\s/)[1]?.trim();
        const places = [...new Set([a?.location?.city, titleArea, a?.location?.state].filter(Boolean) as string[])];
        const saved = new Set(useSavedActivities.getState().ids);
        let city = '';
        let scope = '';
        let items: any[] = [];
        for (const place of places) {
          const more: any = await activityMarketplaceAPI.getGlobalActivities({ city: place, limit: 12 });
          const sc: string = more?.resolvedScope || '';
          // Only what's actually in or near that place; a fallback to the
          // whole country wouldn't match "more in …".
          if (!['city', 'named', 'nearby', 'state'].includes(sc)) continue;
          const found = (more?.data || []).filter((x: any) => x?._id && !saved.has(String(x._id))).slice(0, 10);
          if (found.length >= 2) {
            city = place;
            scope = sc;
            items = found;
            break;
          }
        }
        if (!city) return;
        if (alive) setState({ seed: lastSaved, title: shortTitle(a.title), place: city, near: scope === 'nearby', items });
      } catch {
        // a personal row is a nice-to-have; on failure it just stays hidden
      }
    })();
    return () => { alive = false; };
  }, [lastSaved]);

  if (!state || state.seed !== lastSaved || state.items.length < 2) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        eyebrow={`BECAUSE YOU SAVED ${state.title.toUpperCase()}`}
        title={`More ${state.near ? 'near' : 'in'} ${state.place}`}
        onSeeAll={() => router.push(`/global-experiences?city=${encodeURIComponent(state.place)}` as any)}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {state.items.map((e) => (
          <ExperienceCard
            key={String(e._id)}
            experience={e}
            width={160}
            onPress={(x) => router.push(`/activity/${x._id}` as any)}
          />
        ))}
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
