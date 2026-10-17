// PhotoViewer — full-screen, swipeable photos with a count, for the
// property gallery, a room's photos and review photos.
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, fontWeight } from '@prayana/shared-ui';

export type ViewerPhoto = { url: string; caption?: string | null };

export function PhotoViewer({
  photos,
  startIndex = 0,
  title,
  visible,
  onClose,
}: {
  photos: ViewerPhoto[];
  startIndex?: number;
  title?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const listRef = useRef<FlatList<ViewerPhoto>>(null);

  useEffect(() => {
    if (visible) setIndex(startIndex);
  }, [visible, startIndex]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < photos.length) setIndex(i);
  };

  const current = photos[index];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.count} numberOfLines={1}>
            {photos.length ? `${index + 1} / ${photos.length}` : ''}
            {title ? <Text style={styles.title}>{`  ${title}`}</Text> : null}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close photos"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(startIndex, Math.max(0, photos.length - 1))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p, i) => `${p.url}-${i}`}
          onMomentumScrollEnd={onScroll}
          renderItem={({ item }) => (
            <View style={{ width, height: height * 0.75, justifyContent: 'center' }}>
              <Image source={{ uri: item.url }} style={{ width, height: height * 0.75 }} contentFit="contain" />
            </View>
          )}
        />
        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          {current?.caption ? <Text style={styles.caption}>{current.caption}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  count: { flex: 1, color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  title: { color: 'rgba(255,255,255,0.75)', fontWeight: fontWeight.normal },
  close: { padding: 4 },
  bottom: { minHeight: 60, paddingHorizontal: spacing.lg, justifyContent: 'flex-end' },
  caption: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, textAlign: 'center' },
});
