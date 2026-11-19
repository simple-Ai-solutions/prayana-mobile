// Full-screen photo viewer. Swipe between photos; pinch or double-tap to
// zoom in (drag to look around while zoomed); swipe down to close, with the
// backdrop fading as the photo follows the finger; a strip of thumbnails at
// the bottom jumps straight to any photo.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const CLOSE_DRAG = 140;

function ZoomableImage({
  uri, width, height, onZoomChange, onDragDown, onClose,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  /** 0..1 progress of a swipe-down, for the backdrop fade. */
  onDragDown: (progress: number) => void;
  onClose: () => void;
}) {
  // Which drag is in play depends on zoom, so track it here as well as
  // telling the viewer (which locks the list while zoomed).
  const [zoomedLocal, setZoomedLocal] = useState(false);
  const setZoom = useCallback((z: boolean) => {
    setZoomedLocal(z);
    onZoomChange(z);
  }, [onZoomChange]);
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const clampPan = (s: number) => {
    'worklet';
    const maxX = ((s - 1) * width) / 2;
    const maxY = ((s - 1) * height) / 2;
    tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
    ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
  };

  const reset = () => {
    'worklet';
    scale.value = withSpring(1);
    saved.value = 1;
    tx.value = withSpring(0);
    ty.value = withSpring(0);
    runOnJS(setZoom)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(0.8, saved.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        reset();
      } else {
        saved.value = scale.value;
        clampPan(scale.value);
        runOnJS(setZoom)(true);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (saved.value > 1) {
        reset();
      } else {
        // Zoom in towards where the finger tapped.
        const s = DOUBLE_TAP_ZOOM;
        scale.value = withTiming(s, { duration: 220 });
        saved.value = s;
        tx.value = withTiming((width / 2 - e.x) * (s - 1), { duration: 220 });
        ty.value = withTiming((height / 2 - e.y) * (s - 1), { duration: 220 });
        clampPan(s);
        runOnJS(setZoom)(true);
      }
    });

  // Zoomed: drag to look around. Not zoomed: drag down to close.
  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-18, 18])
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      if (saved.value > 1) {
        tx.value = startX.value + e.translationX;
        ty.value = startY.value + e.translationY;
      } else {
        ty.value = Math.max(0, e.translationY);
        runOnJS(onDragDown)(Math.min(1, ty.value / (CLOSE_DRAG * 2)));
      }
    })
    .onEnd((e) => {
      if (saved.value > 1) {
        clampPan(saved.value);
        return;
      }
      if (e.translationY > CLOSE_DRAG || e.velocityY > 1200) {
        runOnJS(onClose)();
      } else {
        ty.value = withSpring(0);
        runOnJS(onDragDown)(0);
      }
    });

  // While zoomed, horizontal drags pan the photo too (the list is locked).
  const zoomPan = Gesture.Pan()
    .minPointers(1)
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      if (saved.value <= 1) return;
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      if (saved.value > 1) clampPan(saved.value);
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, zoomedLocal ? zoomPan : pan));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={{ width, height, justifyContent: 'center' }} collapsable={false}>
        <Animated.View style={[{ width, height }, style]}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export function PhotoViewer({
  visible, images, initialIndex = 0, onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const fade = useSharedValue(0);
  const listRef = useRef<FlatList<string>>(null);
  const thumbsRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setZoomed(false);
      fade.value = 0;
    }
  }, [visible, initialIndex, fade]);

  useEffect(() => {
    if (images.length > 1) thumbsRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }, [index, images.length]);

  const onZoomChange = useCallback((z: boolean) => setZoomed(z), []);

  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
  const chrome = useAnimatedStyle(() => ({ opacity: 1 - fade.value * 2 }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, Math.max(0, images.length - 1))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          keyExtractor={(u, i) => `${i}-${u}`}
          renderItem={({ item }) => (
            <ZoomableImage
              uri={item}
              width={width}
              height={height}
              onZoomChange={onZoomChange}
              onDragDown={(p) => { fade.value = p; }}
              onClose={onClose}
            />
          )}
        />

        <Animated.View style={[styles.top, chrome]} pointerEvents="box-none">
          <SafeAreaView edges={['top']} style={styles.topRow}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.round} accessibilityRole="button" accessibilityLabel="Close photos">
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            {images.length > 1 && (
              <View style={styles.counter}>
                <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
              </View>
            )}
            <View style={{ width: 40 }} />
          </SafeAreaView>
        </Animated.View>

        {images.length > 1 && !zoomed && (
          <Animated.View style={[styles.bottom, chrome]}>
            <SafeAreaView edges={['bottom']}>
              <FlatList
                ref={thumbsRef}
                data={images}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}
                keyExtractor={(u, i) => `t-${i}-${u}`}
                getItemLayout={(_, i) => ({ length: 62, offset: 62 * i, index: i })}
                onScrollToIndexFailed={() => {}}
                renderItem={({ item, index: i }) => (
                  <Pressable
                    onPress={() => {
                      setIndex(i);
                      listRef.current?.scrollToIndex({ index: i, animated: true });
                    }}
                    accessibilityLabel={`Photo ${i + 1}`}
                    style={[styles.thumb, i === index && styles.thumbOn]}
                  >
                    <Image source={{ uri: item }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                  </Pressable>
                )}
              />
            </SafeAreaView>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  counter: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  counterText: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  thumbs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  thumb: { width: 54, height: 54, borderRadius: 10, overflow: 'hidden', opacity: 0.55, borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { opacity: 1, borderColor: '#fff' },
});

export default PhotoViewer;
