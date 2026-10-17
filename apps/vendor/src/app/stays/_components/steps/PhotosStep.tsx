// Step 3 — photos, as a shot list: outside, entrance, common areas, view …
// then a room and a bathroom photo for each room type. Each photo is tagged
// by the slot it's added to, so there's no separate tagging step. Photos are
// checked for size (at least 800×600), de-duplicated, compressed by the picker
// and uploaded straight away.

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { staysAPI } from '../api';
import { fontSize, fontWeight, spacing, borderRadius } from '../../../../theme/vendorColors';
import { usePalette, Section, Banner, ChoiceSheet } from '../controls';
import {
  MAX_PHOTOS_PER_UPLOAD,
  MIN_PHOTO_HEIGHT,
  MIN_PHOTO_WIDTH,
  MIN_PROPERTY_PHOTOS,
  PROPERTY_PHOTO_SLOTS,
  ROOM_PHOTO_SLOTS,
  StayPhoto,
  StepProps,
  apiError,
  plural,
  toUploadFile,
} from '../stayConfig';

function Thumb({ photo, busy, onPress }: { photo: StayPhoto; busy: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
      style={[styles.thumb, { backgroundColor: p.soft.gray.bg }]}
      accessibilityRole="button"
      accessibilityLabel={`${photo.isCover ? 'Cover photo' : 'Photo'}. Options`}
    >
      <Image source={{ uri: photo.url }} style={styles.thumbImg} contentFit="cover" transition={120} />
      {photo.isCover ? (
        <View style={styles.coverBadge}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.coverText}>Cover</Text>
        </View>
      ) : null}
      {busy ? (
        <View style={styles.thumbBusy}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <View style={styles.thumbMore}>
          <Ionicons name="ellipsis-horizontal" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function Slot({
  label,
  hint,
  photos,
  needed,
  uploading,
  busyId,
  onAdd,
  onPhoto,
}: {
  label: string;
  hint?: string;
  photos: StayPhoto[];
  needed?: boolean;
  uploading: boolean;
  busyId: string | null;
  onAdd: () => void;
  onPhoto: (photo: StayPhoto) => void;
}) {
  const p = usePalette();
  const missing = needed && !photos.length;
  return (
    <View style={[styles.slot, { borderColor: missing ? p.soft.amber.border : p.c.border, backgroundColor: p.c.surface }]}>
      <View style={styles.slotHead}>
        <View style={styles.flex}>
          <Text style={[styles.slotTitle, { color: p.c.text }]}>
            {label}
            {photos.length ? <Text style={{ color: p.c.textTertiary, fontWeight: fontWeight.normal }}> ({photos.length})</Text> : null}
          </Text>
          {hint ? <Text style={[styles.slotHint, { color: p.c.textTertiary }]}>{hint}</Text> : null}
        </View>
        {missing ? <Text style={[styles.needed, { color: p.warning }]}>Needed</Text> : null}
      </View>
      <View style={styles.grid}>
        {photos.map((ph) => (
          <Thumb key={ph._id} photo={ph} busy={busyId === ph._id} onPress={() => onPhoto(ph)} />
        ))}
        <TouchableOpacity
          onPress={onAdd}
          disabled={uploading}
          style={[styles.thumb, styles.addTile, { borderColor: p.c.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Add photos: ${label}`}
          accessibilityState={{ busy: uploading, disabled: uploading }}
        >
          {uploading ? <ActivityIndicator color={p.brand} /> : <Ionicons name="add" size={22} color={p.brand} />}
          <Text style={[styles.addText, { color: p.c.textSecondary }]}>{uploading ? 'Uploading…' : 'Add'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PhotosStep({ draft, stay, applyServer, save }: StepProps) {
  const p = usePalette();
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ slot: string; roomTypeId: string | null; label: string } | null>(null);
  const seen = useRef(new Set<string>()); // photos added this session
  const photos = stay.photos || [];
  const rooms = (draft.roomTypes || []).filter((r) => r.isActive !== false);
  const propertyPhotos = photos.filter((ph) => !ph.roomTypeId);
  const knownSlot = (s: string) => PROPERTY_PHOTO_SLOTS.some((x) => x.id === s);

  const setPhotos = (data: any) => applyServer({ photos: data?.photos, completeness: data?.completeness });

  const upload = async (assets: ImagePicker.ImagePickerAsset[], slot: string, roomTypeId: string | null) => {
    const key = `${slot}:${roomTypeId || ''}`;
    setUploadingSlot(key);
    try {
      // A room type added a moment ago may not be saved yet; its photos need it to be.
      if (roomTypeId && !(await save())) throw new Error("Couldn't save the room first. Check your connection and try again.");
      const files = [];
      const dims: { width?: number; height?: number }[] = [];
      const ids: string[] = [];
      let tooSmall = 0;
      let dupes = 0;
      for (const a of assets.slice(0, MAX_PHOTOS_PER_UPLOAD)) {
        const id = a.assetId || `${a.fileName || a.uri}|${a.fileSize || ''}`;
        if (seen.current.has(id)) {
          dupes++;
          continue;
        }
        if (a.width && a.height && (Math.max(a.width, a.height) < MIN_PHOTO_WIDTH || Math.min(a.width, a.height) < MIN_PHOTO_HEIGHT)) {
          tooSmall++;
          continue;
        }
        ids.push(id);
        files.push(toUploadFile(a, `photo-${files.length + 1}.jpg`));
        dims.push(a.width && a.height ? { width: a.width, height: a.height } : {});
      }
      if (assets.length > MAX_PHOTOS_PER_UPLOAD) Toast.show({ type: 'info', text1: `Added the first ${MAX_PHOTOS_PER_UPLOAD}`, text2: 'Add the rest in another go.' });
      if (tooSmall) Toast.show({ type: 'error', text1: `${plural(tooSmall, 'photo')} too small`, text2: `Use photos at least ${MIN_PHOTO_WIDTH}×${MIN_PHOTO_HEIGHT}.` });
      if (dupes) Toast.show({ type: 'info', text1: `Skipped ${plural(dupes, 'photo')} you already added` });
      if (!files.length) return;
      const res: any = await staysAPI.uploadPhotos(stay._id, files, { slot, roomTypeId: roomTypeId || undefined, dimensions: dims });
      if (res?.success === false) throw new Error(res.message);
      ids.forEach((id) => seen.current.add(id));
      setPhotos(res?.data);
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't upload", text2: apiError(e, 'Check your connection and try again.') });
    } finally {
      setUploadingSlot(null);
    }
  };

  const pick = async (source: 'camera' | 'library', t: { slot: string; roomTypeId: string | null } | null) => {
    if (!t) return;
    const { slot, roomTypeId } = t;
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos.');
        const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!r.canceled && r.assets?.length) await upload(r.assets, slot, roomTypeId);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('Photo access needed', 'Allow photo library access in Settings to add photos.');
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: MAX_PHOTOS_PER_UPLOAD,
          orderedSelection: true,
          quality: 0.8,
        });
        if (!r.canceled && r.assets?.length) await upload(r.assets, slot, roomTypeId);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't open photos", text2: apiError(e, 'Try again.') });
    }
  };

  const setCover = async (photo: StayPhoto) => {
    setBusyId(photo._id);
    try {
      const res: any = await staysAPI.updatePhoto(stay._id, photo._id, { isCover: true });
      setPhotos(res?.data);
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't change the cover", text2: apiError(e, 'Try again.') });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (photo: StayPhoto) => {
    setBusyId(photo._id);
    try {
      const res: any = await staysAPI.deletePhoto(stay._id, photo._id);
      setPhotos(res?.data);
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't remove the photo", text2: apiError(e, 'Try again.') });
    } finally {
      setBusyId(null);
    }
  };

  const photoMenu = (photo: StayPhoto) => {
    const confirmRemove = () =>
      Alert.alert('Remove this photo?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove(photo) },
      ]);
    Alert.alert(photo.isCover ? 'Cover photo' : 'Photo', undefined, [
      ...(photo.isCover ? [] : [{ text: 'Make cover', onPress: () => setCover(photo) }]),
      { text: 'Remove', style: 'destructive' as const, onPress: confirmRemove },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const slotProps = (slot: string, label: string, roomTypeId: string | null = null) => ({
    uploading: uploadingSlot === `${slot}:${roomTypeId || ''}`,
    busyId,
    onAdd: () => setTarget({ slot, roomTypeId, label }),
    onPhoto: photoMenu,
  });

  const count = propertyPhotos.length;

  return (
    <View>
      <Banner tone="blue" icon="bulb-outline" style={styles.lead}>
        Phone photos are fine. Shoot in daylight, hold the phone sideways, switch the lights on and tidy up first. Listings with 8 or more photos get noticeably more bookings.
      </Banner>

      <Section
        title="The property"
        hint={`At least ${MIN_PROPERTY_PHOTOS} photos. The first outside photo becomes your cover; you can change it.`}
        aside={
          <Text style={[styles.counter, { color: count >= MIN_PROPERTY_PHOTOS ? p.success : p.warning }]} accessibilityLabel={`${count} of ${MIN_PROPERTY_PHOTOS} property photos`}>
            {count}/{MIN_PROPERTY_PHOTOS}
          </Text>
        }
      >
        {PROPERTY_PHOTO_SLOTS.map((s) => (
          <Slot
            key={s.id}
            label={s.label}
            hint={s.hint}
            photos={propertyPhotos.filter((ph) => ph.slot === s.id)}
            needed={['exterior', 'reception'].includes(s.id) && count < MIN_PROPERTY_PHOTOS}
            {...slotProps(s.id, s.label)}
          />
        ))}
        {propertyPhotos.some((ph) => !knownSlot(ph.slot)) ? (
          <Slot label="Other" photos={propertyPhotos.filter((ph) => !knownSlot(ph.slot))} {...slotProps('other', 'Other')} />
        ) : null}
      </Section>

      {rooms.map((rt) => {
        const ofRoom = photos.filter((ph) => String(ph.roomTypeId) === String(rt._id));
        return (
          <Section key={rt._id} title={rt.name} hint="At least one photo of the room. A bathroom photo helps a lot.">
            {ROOM_PHOTO_SLOTS.map((s) => (
              <Slot
                key={s.id}
                label={s.label}
                hint={s.hint}
                photos={ofRoom.filter((ph) => ph.slot === s.id)}
                needed={s.id === 'room' && !ofRoom.length}
                {...slotProps(s.id, `${rt.name}: ${s.label}`, rt._id)}
              />
            ))}
          </Section>
        );
      })}

      {!rooms.length ? (
        <View style={styles.noRooms}>
          <Ionicons name="camera-outline" size={16} color={p.c.textTertiary} />
          <Text style={[styles.slotHint, { color: p.c.textSecondary }]}>Add your rooms first, then their photos.</Text>
        </View>
      ) : null}

      <ChoiceSheet
        visible={!!target}
        title="Add photos"
        message={target?.label}
        onClose={() => setTarget(null)}
        options={[
          { label: 'Take a photo', icon: 'camera-outline', onPress: () => pick('camera', target) },
          { label: 'Choose from your photos', icon: 'images-outline', onPress: () => pick('library', target) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  lead: { marginBottom: spacing.xl },
  counter: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  slot: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md },
  slotHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  slotTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  slotHint: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  needed: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: '31%', aspectRatio: 4 / 3, borderRadius: borderRadius.lg, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  coverText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.semibold },
  thumbMore: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 2 },
  thumbBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  addTile: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addText: { fontSize: fontSize.xs },
  noRooms: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
