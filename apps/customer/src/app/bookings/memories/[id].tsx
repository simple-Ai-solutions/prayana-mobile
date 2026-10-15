// Share trip memories — the phone side of the web's
// /bookings/packages/[id]/memories. A traveller with a COMPLETED package
// booking picks photos from their gallery; the server checks each one
// against the trip's places and dates and answers per photo: published,
// waiting for a quick review, or not accepted (with the reason). Their own
// uploads are listed below with that status and can be deleted.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { holidayPackagesAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const MAX_PER_BATCH = 10; // the server's multer limit per request
const MAX_PHOTO_MB = 10;

type MyItem = {
  _id: string;
  url: string;
  mediaType?: string;
  isHidden?: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  hiddenReason?: string | null;
};
type FileResult = { name: string; status: 'approved' | 'pending' | 'rejected' | 'error'; reason?: string; uri?: string };

// Older items have no reviewStatus; a hidden one of those was hidden by an admin.
const statusOf = (i: MyItem) => (i.reviewStatus === 'pending' ? 'pending' : i.isHidden ? 'hidden' : 'live');
const STATUS = {
  live: { label: 'Live', bg: 'rgba(34,197,94,0.92)', icon: 'checkmark-circle' },
  pending: { label: 'In review', bg: 'rgba(245,158,11,0.95)', icon: 'time' },
  hidden: { label: 'Hidden', bg: 'rgba(100,116,139,0.95)', icon: 'eye-off' },
} as const;
const RESULT = {
  approved: { color: '#16a34a', icon: 'checkmark-circle', label: 'Published' },
  pending: { color: '#d97706', icon: 'time', label: 'Awaiting review' },
  rejected: { color: '#dc2626', icon: 'close-circle', label: 'Not accepted' },
  error: { color: '#dc2626', icon: 'alert-circle', label: 'Failed' },
} as const;

export default function ShareMemoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const signedIn = !!user?.uid && user.uid !== 'guest-user';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [mine, setMine] = useState<MyItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);

  const load = useCallback(async () => {
    if (!id || !signedIn) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res: any = await holidayPackagesAPI.getMyBookingById(id);
      const b = res?.data;
      if (!res?.success || !b) { setError('Booking not found'); return; }
      if (b.status !== 'completed') { setError('You can only share photos for completed trips.'); return; }
      setBooking(b);
      const pid = typeof b.package === 'string' ? b.package : b.package?._id;
      setPackageId(pid || null);
      if (pid) {
        // The public package leaves out photos still in review, so the
        // traveller's own uploads come from their own endpoint.
        const m: any = await holidayPackagesAPI.getMyTripGallery(pid).catch(() => null);
        if (m?.success) setMine(m.data || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load this booking');
    } finally {
      setLoading(false);
    }
  }, [id, signedIn]);

  useEffect(() => { load(); }, [load]);

  const pickAndUpload = async () => {
    if (!packageId || uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photos to share them from this trip.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PER_BATCH,
      // The original file, not a re-encoded copy: the trip check reads the
      // date the photo was taken (and where) from the photo itself.
      quality: 1,
      exif: false,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const tooBig = picked.assets.filter((a) => (a.fileSize ?? 0) > MAX_PHOTO_MB * 1024 * 1024);
    const assets = picked.assets.filter((a) => !tooBig.includes(a)).slice(0, MAX_PER_BATCH);
    if (tooBig.length) Toast.show({ type: 'error', text1: `${tooBig.length} photo(s) over ${MAX_PHOTO_MB} MB were skipped` });
    if (!assets.length) return;

    const files = assets.map((a, i) => {
      const type = a.mimeType || 'image/jpeg';
      const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1] || 'jpg';
      return { uri: a.uri, name: a.fileName || `trip-photo-${Date.now()}-${i}.${ext}`, type };
    });

    setUploading(true);
    setResults([]);
    try {
      const res: any = await holidayPackagesAPI.uploadTripGallery(packageId, files);
      if (Array.isArray(res?.data) && res.data.length) setMine((prev) => [...prev, ...res.data]);
      if (Array.isArray(res?.results)) {
        const byName = new Map(files.map((f) => [f.name, f.uri]));
        setResults(res.results.map((r: FileResult) => ({ ...r, uri: byName.get(r.name) })));
        const published = res.results.filter((r: FileResult) => r.status === 'approved').length;
        Toast.show({
          type: res.success ? 'success' : 'error',
          text1: res.message || (published ? `${published} published` : 'No photos were accepted'),
        });
      } else if (!res?.success) {
        Toast.show({ type: 'error', text1: res?.message || 'Upload failed' });
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const remove = (item: MyItem) => {
    if (!packageId) return;
    Alert.alert('Delete this photo?', 'It will be removed from the package page.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res: any = await holidayPackagesAPI.deleteMyTripGalleryItem(packageId, item._id);
            if (res?.success === false) throw new Error(res.message);
            setMine((prev) => prev.filter((i) => i._id !== item._id));
            Toast.show({ type: 'success', text1: 'Photo deleted' });
          } catch (e: any) {
            Toast.show({ type: 'error', text1: e?.message || 'Could not delete' });
          }
        },
      },
    ]);
  };

  const snap = booking?.packageSnapshot || {};
  const title = snap.title || booking?.package?.title;
  const firstName = (user as any)?.displayName?.split(' ')[0] || (user as any)?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'you';
  const tileW = Math.floor((width - 32 - 32 - 20) / 3);
  const photos = mine.filter((i) => i.mediaType !== 'video');

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.back, { backgroundColor: themeColors.surface }]} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={themeColors.text} />
      </Pressable>
      <Text style={[styles.topTitle, { color: themeColors.text }]}>Share memories</Text>
      <View style={{ width: 38 }} />
    </View>
  );

  if (!signedIn) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: themeColors.background }]}>
        {topBar}
        <View style={styles.center}>
          <Ionicons name="log-in-outline" size={40} color={themeColors.textTertiary} />
          <Text style={[styles.msg, { color: themeColors.textSecondary }]}>Sign in to share your trip memories.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push({ pathname: '/(auth)/login', params: { redirectTo: `/bookings/memories/${id}` } } as any)}>
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: themeColors.background }]}>
        {topBar}
        <View style={styles.center}><ActivityIndicator color="#f97316" /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: themeColors.background }]}>
        {topBar}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#f59e0b" />
          <Text style={[styles.errTitle, { color: themeColors.text }]}>Cannot share photos</Text>
          <Text style={[styles.msg, { color: themeColors.textSecondary }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: themeColors.background }]} edges={['top']}>
      {topBar}
      <ScrollView contentContainerStyle={styles.body}>
        <LinearGradient colors={['#f97316', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTitleRow}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.heroTitle}>Share your trip memories</Text>
          </View>
          <Text style={styles.heroSub}>Your photos help future travelers see what this trip is really like.</Text>
          {title ? (
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaStrong} numberOfLines={2}>{title}</Text>
              <View style={styles.heroMetaRow}>
                {snap.primaryDestination ? (
                  <View style={styles.heroChip}>
                    <Ionicons name="location-outline" size={12} color="#fff" />
                    <Text style={styles.heroChipText}>{snap.primaryDestination}</Text>
                  </View>
                ) : null}
                {booking?.travelEndDate ? (
                  <View style={styles.heroChip}>
                    <Ionicons name="calendar-outline" size={12} color="#fff" />
                    <Text style={styles.heroChipText}>
                      Completed {new Date(booking.travelEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </LinearGradient>

        <View style={[styles.info, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Ionicons name="camera-outline" size={18} color="#16a34a" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Only photos from this trip, please</Text>
            <Text style={styles.infoText}>
              Each photo is checked against this trip's places and dates. Photos from other places aren't accepted,
              and some wait for a quick review before they appear. Published photos show your first name
              ("By {firstName}"). You can delete your own uploads any time.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={pickAndUpload}
          disabled={uploading || !packageId}
          style={[styles.picker, { borderColor: '#fdba74', backgroundColor: themeColors.surface }, uploading && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#f97316" />
              <Text style={[styles.pickerTitle, { color: themeColors.text }]}>Checking and uploading…</Text>
              <Text style={[styles.pickerSub, { color: themeColors.textSecondary }]}>This can take a minute for several photos.</Text>
            </>
          ) : (
            <>
              <View style={styles.pickerIcon}>
                <Ionicons name="images-outline" size={24} color="#f97316" />
              </View>
              <Text style={[styles.pickerTitle, { color: themeColors.text }]}>Choose photos</Text>
              <Text style={[styles.pickerSub, { color: themeColors.textSecondary }]}>
                Up to {MAX_PER_BATCH} at a time · JPG, PNG or WebP · max {MAX_PHOTO_MB} MB each
              </Text>
            </>
          )}
        </Pressable>

        {results.length ? (
          <View style={[styles.block, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.blockTitle, { color: themeColors.text }]}>What happened to each photo</Text>
            {results.map((r, i) => {
              const m = RESULT[r.status] || RESULT.error;
              return (
                <View key={`${r.name}-${i}`} style={styles.resultRow}>
                  {r.uri ? <Image source={{ uri: r.uri }} style={styles.resultThumb} contentFit="cover" /> : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.resultHead}>
                      <Ionicons name={m.icon} size={14} color={m.color} />
                      <Text style={[styles.resultLabel, { color: m.color }]}>{m.label}</Text>
                    </View>
                    {r.reason ? <Text style={[styles.resultReason, { color: themeColors.textSecondary }]}>{r.reason}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.block, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.blockTitle, { color: themeColors.text }]}>
            Your photos{photos.length ? ` (${photos.length})` : ''}
          </Text>
          {photos.length ? (
            <View style={styles.grid}>
              {photos.map((item) => {
                const st = STATUS[statusOf(item)];
                return (
                  <View key={item._id} style={[styles.tile, { width: tileW, height: tileW }]}>
                    <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                    <View style={[styles.status, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon} size={10} color="#fff" />
                      <Text style={styles.statusText}>{st.label}</Text>
                    </View>
                    <Pressable onPress={() => remove(item)} style={styles.del} hitSlop={8} accessibilityLabel="Delete photo">
                      <Ionicons name="trash-outline" size={13} color="#fff" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.msg, { color: themeColors.textSecondary, textAlign: 'left' }]}>
              Nothing shared yet. Your first photo from this trip could inspire someone's next one.
            </Text>
          )}
        </View>

        {packageId ? (
          <Pressable onPress={() => router.push(`/packages/${packageId}` as any)} style={styles.viewLink}>
            <Text style={styles.viewLinkText}>See how your photos appear on the package page</Text>
            <Ionicons name="arrow-forward" size={14} color="#2563eb" />
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errTitle: { fontSize: 17, fontWeight: '700' },
  primaryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12, marginTop: 6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  body: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { borderRadius: 18, padding: 18 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 6, lineHeight: 18 },
  heroMeta: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', gap: 8 },
  heroMetaStrong: { color: '#fff', fontSize: 14, fontWeight: '700' },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  heroChipText: { color: '#fff', fontSize: 11.5, fontWeight: '600' },

  info: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoTitle: { color: '#15803d', fontSize: 13.5, fontWeight: '700' },
  infoText: { color: '#16a34a', fontSize: 12, marginTop: 3, lineHeight: 17 },

  picker: { alignItems: 'center', gap: 6, paddingVertical: 26, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed' },
  pickerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  pickerTitle: { fontSize: 15, fontWeight: '800' },
  pickerSub: { fontSize: 12, textAlign: 'center' },

  block: { borderRadius: 16, padding: 16, gap: 12 },
  blockTitle: { fontSize: 15, fontWeight: '800' },
  resultRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  resultThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#e5e7eb' },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultLabel: { fontSize: 13, fontWeight: '700' },
  resultReason: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  status: { position: 'absolute', left: 5, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  statusText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
  del: { position: 'absolute', top: 5, right: 5, padding: 5, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },

  viewLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  viewLinkText: { color: '#2563eb', fontSize: 13.5, fontWeight: '600' },
});
