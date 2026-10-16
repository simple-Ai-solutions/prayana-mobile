import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeImageUrl } from '../../../lib/imageUrl';
import { useIsha } from '../ishaTheme';
import type { ChatImage } from '../types';

export const imageUrlOf = (img: ChatImage | null | undefined): string =>
  normalizeImageUrl(typeof img === 'string' ? img : img?.url || img?.mediumUrl || img?.imageUrl || '');
const captionOf = (img: ChatImage) => (typeof img === 'string' ? '' : img?.caption || '');
// "Palais Garnier, Paris" → "Palais Garnier": the place, on the big photo
const placeName = (caption: string) => String(caption || '').split(',')[0].trim();

function Tile({
  img,
  index,
  total,
  onOpen,
  style,
  more = 0,
  captioned = false,
}: {
  img: ChatImage;
  index: number;
  total: number;
  onOpen: (i: number) => void;
  style?: object;
  more?: number;
  captioned?: boolean;
}) {
  const t = useIsha();
  const caption = captionOf(img);
  return (
    <Pressable
      onPress={() => onOpen(index)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`View photo ${index + 1} of ${total}${caption ? `: ${caption}` : ''}`}
      style={[styles.tile, { backgroundColor: t.sunken }, style]}
    >
      <Image source={{ uri: imageUrlOf(img) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={imageUrlOf(img)} />
      {captioned && !!placeName(caption) && (
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={1}>
            {placeName(caption)}
          </Text>
        </View>
      )}
      {more > 0 && (
        <View style={styles.more}>
          <Text style={styles.moreText}>+{more}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Destination photos as a collage: one large and two small, with "+N" for the
 * rest. Every photo opens the viewer at that photo.
 */
export default function ImageCarousel({ images }: { images: ChatImage[] }) {
  const list = (images || []).filter((i) => !!imageUrlOf(i));
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (!list.length) return null;
  const total = list.length;
  const open = (i: number) => setOpenAt(i);

  return (
    <>
      {total === 1 ? (
        <View style={[styles.frame, { height: 200 }]}>
          <Tile img={list[0]} index={0} total={1} onOpen={open} style={{ flex: 1 }} captioned />
        </View>
      ) : total === 2 ? (
        <View style={[styles.frame, styles.row, { height: 180 }]}>
          <Tile img={list[0]} index={0} total={2} onOpen={open} style={{ flex: 1 }} captioned />
          <Tile img={list[1]} index={1} total={2} onOpen={open} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={[styles.frame, styles.row, { height: 224 }]} accessibilityLabel="Destination photos">
          <Tile img={list[0]} index={0} total={total} onOpen={open} style={{ flex: 2 }} captioned />
          <View style={{ flex: 1, gap: 3 }}>
            <Tile img={list[1]} index={1} total={total} onOpen={open} style={{ flex: 1 }} />
            <Tile img={list[2]} index={2} total={total} onOpen={open} style={{ flex: 1 }} more={total - 3} />
          </View>
        </View>
      )}
      {openAt !== null && <Lightbox images={list} index={openAt} onClose={() => setOpenAt(null)} />}
    </>
  );
}

/** Photos full size, one at a time; swipe between them. */
export function Lightbox({ images, index = 0, onClose }: { images: ChatImage[]; index?: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState(index);
  const listRef = useRef<FlatList<ChatImage>>(null);
  const many = images.length > 1;

  const onEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setAt(Math.round(e.nativeEvent.contentOffset.x / width)),
    [width],
  );
  const caption = captionOf(images[at] || images[0]);

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.lightbox}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
          keyExtractor={(img, i) => `${imageUrlOf(img)}-${i}`}
          renderItem={({ item }) => (
            <Pressable onPress={onClose} style={{ width, height, justifyContent: 'center' }}>
              <Image source={{ uri: imageUrlOf(item) }} style={{ width, height: height * 0.72 }} contentFit="contain" />
            </Pressable>
          )}
        />
        <View style={[styles.lbFooter, { paddingBottom: insets.bottom + 20 }]} pointerEvents="none">
          {many && (
            <Text style={styles.lbCount}>
              {at + 1} / {images.length}
            </Text>
          )}
          {!!caption && <Text style={styles.lbCaption}>{caption}</Text>}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photos"
          hitSlop={10}
          style={[styles.lbClose, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={20} color="#0c0a09" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 3 },
  tile: { overflow: 'hidden' },
  caption: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '80%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  captionText: { color: '#fff', fontSize: 11.5, fontWeight: '500' },
  more: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  lbFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  lbCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontVariant: ['tabular-nums'] },
  lbCaption: { color: '#fff', fontSize: 14, textAlign: 'center' },
  lbClose: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
