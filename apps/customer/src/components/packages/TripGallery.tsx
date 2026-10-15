// "Real photos from past trips", ported from the web's TripGallerySection:
// photos the vendor and past travellers uploaded for this package, filtered
// by who took them, each traveller photo reportable. With none yet, the
// package's own photos stand in as a preview under the same invitation to
// share. Sharing starts from My Bookings: only a completed trip can upload.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, useWindowDimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, Card } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import Toast from 'react-native-toast-message';

export type TripGalleryItem = {
  _id: string;
  url: string;
  mediaType?: 'photo' | 'video';
  caption?: string | null;
  travelDate?: string | null;
  isHidden?: boolean;
  uploadedBy?: { type?: 'vendor' | 'customer'; userName?: string };
};

const ORANGE = '#f97316';
const GRADIENT = ['#f97316', '#ec4899', '#f43f5e'] as const;
const GAP = 10;

type Filter = 'all' | 'vendor' | 'customer';
const FILTERS: { value: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', label: 'All', icon: 'sparkles-outline' },
  { value: 'vendor', label: 'By Vendor', icon: 'storefront-outline' },
  { value: 'customer', label: 'By Travelers', icon: 'people-outline' },
];

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Full-screen swipeable viewer for a set of photos. */
function Lightbox({ photos, index, onClose }: {
  photos: { url: string; caption?: string | null }[];
  index: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(index);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.lbWrap}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p, i) => `${p.url}-${i}`}
          onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center' }}>
              <Image source={{ uri: item.url }} style={{ width, height: height * 0.75 }} contentFit="contain" cachePolicy="memory-disk" />
            </View>
          )}
        />
        <Pressable onPress={onClose} style={s.lbClose} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={s.lbFoot} pointerEvents="none">
          {photos[at]?.caption ? <Text style={s.lbCaption} numberOfLines={3}>{photos[at].caption}</Text> : null}
          <Text style={s.lbCount}>{at + 1} / {photos.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

/** The invitation to share, full (no photos at all) or compact (above a preview). */
function UploadCTA({ compact, onPress }: { compact?: boolean; onPress: () => void }) {
  const { themeColors, isDarkMode: isDark } = useTheme();
  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={[s.ctaCompact, { backgroundColor: isDark ? 'rgba(249,115,22,0.12)' : '#fff7ed', borderColor: isDark ? 'rgba(249,115,22,0.35)' : '#fed7aa' }]}
        accessibilityRole="button"
      >
        <View style={[s.ctaCompactIcon, { backgroundColor: themeColors.surface, borderColor: '#fed7aa' }]}>
          <Ionicons name="cloud-upload-outline" size={18} color={ORANGE} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.ctaCompactTitle, { color: themeColors.text }]}>Been on this trip? Share your memories</Text>
          <Text style={[s.ctaCompactSub, { color: themeColors.textSecondary }]}>Upload photos from your bookings</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={ORANGE} />
      </Pressable>
    );
  }
  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
      <View style={s.ctaGlow} />
      <View style={s.ctaRow}>
        <View style={s.ctaIcon}>
          <Ionicons name="heart" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.ctaTitle}>Been on this trip? Share your memories</Text>
          <Text style={s.ctaSub}>Upload photos from your completed trip and inspire future travelers.</Text>
        </View>
      </View>
      <Pressable onPress={onPress} style={s.ctaBtn} accessibilityRole="button">
        <Ionicons name="cloud-upload-outline" size={15} color="#ea580c" />
        <Text style={s.ctaBtnText}>Upload photos</Text>
      </Pressable>
    </LinearGradient>
  );
}

export function TripGallery({ packageId, items, fallback, cardStyle }: {
  packageId: string;
  items: TripGalleryItem[];
  /** The package's own photos, shown while no trip photos exist yet. */
  fallback: string[];
  cardStyle?: any;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const [viewer, setViewer] = useState<number | null>(null);

  // Sharing is per booking, so it starts from the package bookings list.
  const goShare = () => router.push({ pathname: '/bookings', params: { category: 'packages', tab: 'completed' } } as any);
  const markBroken = (url: string) => setBroken((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const photos = useMemo(
    () => items.filter((i) => !i.isHidden && i.mediaType === 'photo' && i.url && !broken.has(i.url)),
    [items, broken],
  );
  const shown = useMemo(
    () => (filter === 'all' ? photos : photos.filter((i) => i.uploadedBy?.type === filter)),
    [photos, filter],
  );
  const counts = {
    all: photos.length,
    vendor: photos.filter((i) => i.uploadedBy?.type === 'vendor').length,
    customer: photos.filter((i) => i.uploadedBy?.type === 'customer').length,
  };

  // Two whole tiles a row inside the card (card padding 16 each side).
  const tileW = Math.floor((width - 32 - 32 - GAP) / 2);

  const report = (item: TripGalleryItem) => {
    if (!user?.uid || user.uid === 'guest-user') {
      Toast.show({ type: 'info', text1: 'Sign in to report a photo' });
      return;
    }
    Alert.alert('Report this photo?', 'Report it as not from this trip, or inappropriate.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            const res: any = await holidayPackagesAPI.reportTripGalleryItem(packageId, item._id, 'not-from-trip-or-inappropriate');
            if (res?.success) {
              setReported((prev) => new Set(prev).add(item._id));
              Toast.show({ type: 'success', text1: res.message || "Thanks — we'll take a look." });
            } else {
              Toast.show({ type: 'error', text1: res?.message || "Couldn't report this photo" });
            }
          } catch (e: any) {
            Toast.show({ type: 'error', text1: e?.message || "Couldn't report this photo" });
          }
        },
      },
    ]);
  };

  const header = (title: string, sub: string, action?: React.ReactNode) => (
    <View style={s.head}>
      <View style={{ flex: 1 }}>
        <View style={s.titleRow}>
          <Ionicons name="sparkles" size={16} color={ORANGE} />
          <Text style={[s.title, { color: themeColors.text }]}>{title}</Text>
        </View>
        <View style={s.subRow}>
          <Ionicons name="camera-outline" size={12} color={themeColors.textSecondary} />
          <Text style={[s.sub, { color: themeColors.textSecondary }]}>{sub}</Text>
        </View>
      </View>
      {action}
    </View>
  );

  // No traveller or vendor photos yet.
  if (!photos.length) {
    const live = fallback.filter((u) => u && !broken.has(u));
    if (!live.length) {
      return (
        <Card style={cardStyle}>
          <View style={[s.titleRow, { marginBottom: 12 }]}>
            <Ionicons name="sparkles" size={16} color={ORANGE} />
            <Text style={[s.title, { color: themeColors.text }]}>Real photos from past trips</Text>
          </View>
          <UploadCTA onPress={goShare} />
        </Card>
      );
    }
    const preview = showAll ? live : live.slice(0, 4);
    return (
      <Card style={cardStyle}>
        {header('Real photos from past trips', `${live.length} photos · Traveler memories appear here after trips complete`)}
        <UploadCTA compact onPress={goShare} />
        <View style={s.grid}>
          {preview.map((url, i) => (
            <Pressable key={`${url}-${i}`} onPress={() => setViewer(i)} style={[s.tile, { width: tileW, height: tileW * 0.75 }]}>
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" onError={() => markBroken(url)} />
            </Pressable>
          ))}
        </View>
        {live.length > 4 ? (
          <Pressable onPress={() => setShowAll((v) => !v)} style={s.moreBtn}>
            <Text style={s.moreText}>{showAll ? 'View less' : `View all ${live.length} photos`}</Text>
            <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={14} color="#ea580c" />
          </Pressable>
        ) : null}
        {viewer != null ? <Lightbox photos={live.map((url) => ({ url }))} index={viewer} onClose={() => setViewer(null)} /> : null}
      </Card>
    );
  }

  const list = showAll ? shown : shown.slice(0, 6);
  // A lone photo gets the full width; the first of five or more leads wide.
  const wide = (i: number) => list.length === 1 || (list.length >= 5 && i === 0);

  return (
    <Card style={cardStyle}>
      {header(
        'Real photos from past trips',
        `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`,
        <Pressable onPress={goShare} style={s.sharePill} accessibilityRole="button">
          <Ionicons name="cloud-upload-outline" size={13} color="#ea580c" />
          <Text style={s.sharePillText}>Share yours</Text>
        </Pressable>,
      )}

      <View style={[s.filters, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6', borderColor: themeColors.border }]}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => { setFilter(f.value); setShowAll(false); }}
              style={[s.filter, active && [s.filterOn, { backgroundColor: themeColors.surface }]]}
            >
              <Ionicons name={f.icon} size={12} color={active ? ORANGE : themeColors.textSecondary} />
              <Text style={[s.filterText, { color: active ? '#ea580c' : themeColors.textSecondary }]} numberOfLines={1}>{f.label}</Text>
              <View style={[s.filterCount, { backgroundColor: active ? '#ffedd5' : 'rgba(148,163,184,0.25)' }]}>
                <Text style={[s.filterCountText, { color: active ? '#ea580c' : themeColors.textSecondary }]}>{counts[f.value]}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {list.length ? (
        <View style={s.grid}>
          {list.map((item, i) => {
            const w = wide(i) ? tileW * 2 + GAP : tileW;
            const h = wide(i) ? w * 0.56 : list.length === 2 ? tileW * 1.25 : tileW * 0.75;
            const byVendor = item.uploadedBy?.type === 'vendor';
            const isReported = reported.has(item._id);
            return (
              <Pressable key={item._id} onPress={() => setViewer(shown.indexOf(item))} style={[s.tile, { width: w, height: h }]}>
                <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" onError={() => markBroken(item.url)} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={s.tileShade} pointerEvents="none" />
                {item.uploadedBy ? (
                  <View style={[s.byBadge, { backgroundColor: byVendor ? 'rgba(249,115,22,0.92)' : 'rgba(34,197,94,0.92)' }]}>
                    <Text style={s.byText} numberOfLines={1}>
                      {byVendor ? 'By vendor' : `By ${item.uploadedBy.userName?.split(' ')[0] || 'traveler'}`}
                    </Text>
                  </View>
                ) : null}
                {item.travelDate ? <Text style={s.tileDate}>{formatDate(item.travelDate)}</Text> : null}
                {item.uploadedBy?.type === 'customer' ? (
                  <Pressable
                    onPress={() => !isReported && report(item)}
                    style={[s.flag, isReported && { opacity: 0.6 }]}
                    hitSlop={8}
                    accessibilityLabel={isReported ? 'Reported' : 'Report this photo'}
                  >
                    <Ionicons name={isReported ? 'flag' : 'flag-outline'} size={12} color="#fff" />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[s.empty, { color: themeColors.textSecondary }]}>No photos in this view yet.</Text>
      )}

      {!showAll && shown.length > 6 ? (
        <Pressable onPress={() => setShowAll(true)} style={s.moreBtn}>
          <Text style={s.moreText}>View all {shown.length} photos</Text>
          <Ionicons name="chevron-down" size={14} color="#ea580c" />
        </Pressable>
      ) : null}

      {viewer != null && viewer >= 0 ? (
        <Lightbox photos={shown.map((p) => ({ url: p.url, caption: p.caption }))} index={viewer} onClose={() => setViewer(null)} />
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 17, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  sub: { fontSize: 12, flexShrink: 1 },
  sharePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa',
  },
  sharePillText: { color: '#ea580c', fontSize: 12, fontWeight: '700' },

  filters: { flexDirection: 'row', padding: 3, borderRadius: 999, borderWidth: 1, gap: 2 },
  filter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 999 },
  filterOn: {
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  filterText: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  filterCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  filterCountText: { fontSize: 10, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 4 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  byBadge: { position: 'absolute', left: 8, bottom: 8, maxWidth: '75%', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  byText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  tileDate: { position: 'absolute', right: 8, bottom: 9, color: 'rgba(255,255,255,0.85)', fontSize: 9.5, fontWeight: '600' },
  flag: { position: 'absolute', top: 6, right: 6, padding: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  moreBtn: {
    flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 4, marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff7ed',
  },
  moreText: { color: '#ea580c', fontSize: 13, fontWeight: '700' },

  cta: { borderRadius: 16, padding: 18, overflow: 'hidden' },
  ctaGlow: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.18)' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaIcon: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  ctaTitle: { color: '#fff', fontSize: 15.5, fontWeight: '800', lineHeight: 20 },
  ctaSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 11,
  },
  ctaBtnText: { color: '#ea580c', fontSize: 14, fontWeight: '800' },
  ctaCompact: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1 },
  ctaCompactIcon: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ctaCompactTitle: { fontSize: 13.5, fontWeight: '700' },
  ctaCompactSub: { fontSize: 11.5, marginTop: 1 },

  lbWrap: { flex: 1, backgroundColor: '#000' },
  lbClose: { position: 'absolute', top: 44, right: 16, padding: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  lbFoot: { position: 'absolute', left: 16, right: 16, bottom: 40, alignItems: 'center', gap: 6 },
  lbCaption: { color: '#fff', fontSize: 13, textAlign: 'center' },
  lbCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
});
