// app/wishlist.tsx — My Wishlist (mobile), after the web's /wishlist: the
// activities saved with the heart, kept on this device (lib/savedActivities),
// in a two-column grid with how many, how many cities and the average rating.
// Each is fetched fresh; one the server no longer has is dropped from the list.
// Not Favorites (saved places, profile/favorites).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert, useWindowDimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { useSavedActivities } from '../lib/savedActivities';
import { activityImage } from '../components/explore/ExploreCards';
import { fallbackPhoto } from '../lib/fallbackPhoto';
import { useGoBack } from '../lib/goBack';

const RED = '#E61417';
const ORANGE = '#f97316';
const ROSE = '#ff4d5e';
const GAP = 12;

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ',
  SGD: 'S$', THB: '฿', AUD: 'A$', JPY: '¥', MYR: 'RM ',
};

function priceLabel(a: any): string | null {
  const n = Number(a?.platformSellingPrice ?? a?.pricing?.basePrice ?? a?.price ?? 0);
  if (!n) return null;
  const code = String(a?.pricing?.currency || a?.currency || 'INR').toUpperCase();
  return `${CURRENCY_SYMBOLS[code] ?? `${code} `}${Math.round(n).toLocaleString(code === 'INR' ? 'en-IN' : 'en-US')}`;
}

const cityOf = (a: any): string => a?.location?.city || a?.externalData?.city?.name || a?.city || '';
const ratingOf = (a: any): number => Number(a?.rating?.average ?? a?.averageRating ?? 0) || 0;

/** A 404 (or a reply with no activity) means it's gone; anything else may be the network. */
const isGone = (r: PromiseSettledResult<any>) =>
  r.status === 'fulfilled' ? !r.value?.data : r.reason?.status === 404 || r.reason?.status === 400;

function WishCard({ a, width, onPress, onRemove }: { a: any; width: number; onPress: () => void; onRemove: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const own = activityImage(a);
  const [failed, setFailed] = useState(false);
  const img = own && !failed ? own : fallbackPhoto(a);
  const city = cityOf(a);
  const rating = ratingOf(a);
  const price = priceLabel(a);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a.title}
      style={({ pressed }) => [
        s.card,
        { width, backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={s.photo}>
        <LinearGradient colors={['#fb923c', RED]} style={StyleSheet.absoluteFill} />
        <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" onError={() => setFailed(true)} />
        <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.photoTop}>
          {rating > 0 ? (
            <View style={s.rating}>
              <Ionicons name="star" size={10} color="#f59e0b" />
              <Text style={s.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : <View />}
          <Pressable onPress={onRemove} hitSlop={8} style={({ pressed }) => [s.heart, pressed && { transform: [{ scale: 0.9 }] }]} accessibilityRole="button" accessibilityLabel="Remove from Wishlist">
            <Ionicons name="heart" size={16} color={ROSE} />
          </Pressable>
        </View>
        {city ? (
          <View style={s.city}>
            <Ionicons name="location" size={11} color="#fdba74" />
            <Text style={s.cityText} numberOfLines={1}>{city}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.cardBody}>
        <Text style={[s.cardTitle, { color: themeColors.text }]} numberOfLines={2}>{a.title || a.name || 'Experience'}</Text>
        {price ? (
          <Text style={[s.price, { color: themeColors.text }]}>
            <Text style={[s.from, { color: themeColors.textTertiary }]}>from </Text>{price}
          </Text>
        ) : (
          <Text style={[s.from, { color: themeColors.textTertiary }]}>See prices</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function WishlistScreen() {
  const router = useRouter();
  const goBack = useGoBack('/(tabs)/profile');
  const { themeColors, isDarkMode } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.floor((screenW - 32 - GAP) / 2);
  const ids = useSavedActivities((st) => st.ids);
  const [byId, setById] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchAll = useCallback(async (only?: string[]) => {
    const store = useSavedActivities.getState();
    await store.load();
    const list = only || useSavedActivities.getState().ids;
    if (!list.length) return;
    const results = await Promise.allSettled(list.map((id) => activityMarketplaceAPI.getActivityById(id)));
    const found: Record<string, any> = {};
    const gone: string[] = [];
    let netErrors = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.data) found[list[i]] = r.value.data;
      else if (isGone(r)) gone.push(list[i]);
      else netErrors += 1;
    });
    if (gone.length) useSavedActivities.getState().remove(gone);
    setById((prev) => ({ ...prev, ...found }));
    setFailed(netErrors > 0 && !Object.keys(found).length);
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // Saved somewhere else while this screen was open (e.g. back from a detail).
  useEffect(() => {
    if (loading) return;
    const missing = ids.filter((id) => !byId[id]);
    if (missing.length) fetchAll(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const remove = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    useSavedActivities.getState().toggle(id);
  };

  const clearAll = () => {
    Alert.alert('Clear your wishlist?', `This removes all ${ids.length} saved ${ids.length === 1 ? 'activity' : 'activities'} from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all', style: 'destructive', onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          useSavedActivities.getState().clear();
        },
      },
    ]);
  };

  const items = ids.map((id) => byId[id]).filter(Boolean);
  const cities = new Set(items.map(cityOf).filter(Boolean).map((c) => c.toLowerCase())).size;
  const rated = items.map(ratingOf).filter((r) => r > 0);
  const avg = rated.length ? rated.reduce((n, r) => n + r, 0) / rated.length : 0;
  const line = isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  const bg = isDarkMode ? themeColors.background : '#fafafa';
  const showLoading = loading && ids.length > 0 && !items.length;

  const header = (
    <View style={s.wash}>
      <LinearGradient
        colors={isDarkMode ? ['rgba(255,77,94,0.2)', 'rgba(230,20,23,0.05)', bg] : ['#ffe4e6', '#fff1f2', bg]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.topRow}>
        <Pressable onPress={goBack} hitSlop={10} style={[s.round, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </Pressable>
        {ids.length ? (
          <Pressable onPress={clearAll} hitSlop={8} style={({ pressed }) => [s.clear, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Ionicons name="trash-outline" size={14} color={RED} />
            <Text style={s.clearText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.titleRow}>
        <LinearGradient colors={[ROSE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
          <Ionicons name="heart" size={26} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>SAVED FOR LATER</Text>
          <Text style={[s.h1, { color: themeColors.text }]}>My Wishlist</Text>
        </View>
      </View>

      {items.length ? (
        <View style={s.stats}>
          {([
            ['bookmark', `${items.length} ${items.length === 1 ? 'activity' : 'activities'}`],
            ...(cities ? [['location', `${cities} ${cities === 1 ? 'city' : 'cities'}`]] : []),
            ...(avg ? [['star', `${avg.toFixed(1)} avg`]] : []),
          ] as [keyof typeof Ionicons.glyphMap, string][]).map(([icon, label]) => (
            <View key={label} style={[s.stat, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)', borderColor: line }]}>
              <Ionicons name={icon} size={12} color={icon === 'star' ? '#f59e0b' : ORANGE} />
              <Text style={[s.statText, { color: themeColors.text }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[s.lead, { color: themeColors.textSecondary }]}>Things to do you've hearted, all in one place.</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: bg }]} edges={['top']}>
      <FlatList
        data={showLoading ? [] : items}
        keyExtractor={(a) => a._id}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16 }}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 40, gap: GAP }}
        renderItem={({ item }) => (
          <WishCard a={item} width={cardW} onPress={() => router.push(`/activity/${item._id}` as any)} onRemove={() => remove(item._id)} />
        )}
        initialNumToRender={8}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          showLoading ? (
            <View style={s.skelGrid}>
              {Array.from({ length: Math.min(Math.max(ids.length, 2), 6) }).map((_, i) => (
                <View key={i} style={[s.skel, { width: cardW, backgroundColor: themeColors.surface, borderColor: line }]}>
                  <View style={s.skelPhoto} />
                  <View style={[s.skelLine, { width: '85%' }]} />
                  <View style={[s.skelLine, { width: '45%' }]} />
                </View>
              ))}
            </View>
          ) : failed && ids.length ? (
            <View style={[s.empty, { backgroundColor: themeColors.surface, borderColor: line }]}>
              <View style={[s.emptyIcon, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]}>
                <Ionicons name="cloud-offline-outline" size={26} color={themeColors.textSecondary} />
              </View>
              <Text style={[s.emptyTitle, { color: themeColors.text }]}>Couldn't load your wishlist</Text>
              <Text style={[s.emptyText, { color: themeColors.textSecondary }]}>Your saves are safe on this phone. Check your connection and try again.</Text>
              <Pressable onPress={onRefresh} accessibilityRole="button">
                <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                  <Ionicons name="refresh" size={14} color="#fff" />
                  <Text style={s.emptyBtnText}>Try again</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <View style={[s.empty, { backgroundColor: themeColors.surface, borderColor: line }]}>
              <LinearGradient colors={[ROSE, RED]} style={[s.emptyIcon, { transform: [{ rotate: '-6deg' }] }]}>
                <Ionicons name="heart-outline" size={28} color="#fff" />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: themeColors.text }]}>Nothing saved yet</Text>
              <Text style={[s.emptyText, { color: themeColors.textSecondary }]}>Tap the heart on any activity to save it here.</Text>
              <Pressable onPress={() => router.push('/activities' as any)} accessibilityRole="button">
                <LinearGradient colors={[ORANGE, RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                  <Ionicons name="compass" size={15} color="#fff" />
                  <Text style={s.emptyBtnText}>Browse things to do</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  wash: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  clearText: { color: RED, fontSize: 12.5, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  tile: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowColor: ROSE, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  eyebrow: { color: ROSE, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.6 },
  h1: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 33, marginTop: 2 },
  lead: { fontSize: 14.5, lineHeight: 21, marginTop: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  statText: { fontSize: 12.5, fontWeight: '800' },

  card: {
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  photo: { aspectRatio: 4 / 4.4, justifyContent: 'space-between' },
  photoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  heart: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
  cityText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 11, paddingTop: 10, gap: 6, flex: 1, justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', lineHeight: 18.5, letterSpacing: -0.1 },
  price: { fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  from: { fontSize: 11.5, fontWeight: '600' },

  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: 16 },
  skel: { borderWidth: 1, borderRadius: 20, overflow: 'hidden', gap: 8, paddingBottom: 12 },
  skelPhoto: { aspectRatio: 4 / 4.4, backgroundColor: 'rgba(148,163,184,0.18)' },
  skelLine: { height: 12, borderRadius: 6, marginHorizontal: 11, backgroundColor: 'rgba(148,163,184,0.18)' },

  empty: { marginHorizontal: 16, borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
