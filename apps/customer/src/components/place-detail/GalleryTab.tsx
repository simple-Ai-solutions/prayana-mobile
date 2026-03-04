import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, spacing, useTheme } from '@prayana/shared-ui';
import { destinationAPI } from '@prayana/shared-services';
import { resolveImageUrl, getPlaceImageUrl } from '@prayana/shared-utils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COL_GAP = 8;
const IMAGE_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - COL_GAP) / 2;

interface GalleryTabProps {
  placeName: string;
  location: string;
  initialImages?: string[];
}

export const GalleryTab: React.FC<GalleryTabProps> = ({ placeName, location, initialImages = [] }) => {
  const { themeColors, isDarkMode } = useTheme();
  const [images, setImages] = useState<string[]>(initialImages);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        const res = await destinationAPI.getPlaceImages(placeName, location, 10);
        const fetched = res?.data || res?.images || (Array.isArray(res) ? res : []);
        const urls: string[] = [];

        for (const item of fetched) {
          const url = typeof item === 'string'
            ? resolveImageUrl(item)
            : resolveImageUrl(item?.url || item?.imageUrl || item?.src || getPlaceImageUrl(item));
          if (url) urls.push(url);
        }

        // Merge with initial images, dedup
        const merged = [...new Set([...initialImages.map(i => resolveImageUrl(i) || i), ...urls])].filter(Boolean);
        setImages(merged as string[]);
      } catch (err: any) {
        console.warn('[Gallery] Error:', err.message);
        // Keep initial images if fetch fails
        if (initialImages.length > 0) {
          setImages(initialImages.map(i => resolveImageUrl(i) || i).filter(Boolean) as string[]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchImages();
  }, [placeName, location]);

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  // Alternate image heights for masonry effect
  const getImageHeight = (idx: number) => {
    const heights = [140, 180, 160, 200, 150, 170];
    return heights[idx % heights.length];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Loading gallery...
        </Text>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          No images available
        </Text>
      </View>
    );
  }

  // Split into two columns for masonry
  const leftCol: { url: string; idx: number }[] = [];
  const rightCol: { url: string; idx: number }[] = [];
  images.forEach((url, idx) => {
    if (idx % 2 === 0) leftCol.push({ url, idx });
    else rightCol.push({ url, idx });
  });

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="images" size={20} color={colors.primary[500]} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Gallery</Text>
        <Text style={[styles.countBadge, { color: themeColors.textTertiary }]}>
          {images.length} photos
        </Text>
      </View>

      {/* Masonry Grid */}
      <View style={styles.masonry}>
        <View style={styles.masonryCol}>
          {leftCol.map(({ url, idx }) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.9}
              onPress={() => openViewer(idx)}
              style={[styles.imageCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
            >
              <Image
                source={{ uri: url }}
                style={[styles.masonryImage, { height: getImageHeight(idx) }]}
                contentFit="cover" transition={200} cachePolicy="memory-disk"
              />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.masonryCol}>
          {rightCol.map(({ url, idx }) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.9}
              onPress={() => openViewer(idx)}
              style={[styles.imageCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
            >
              <Image
                source={{ uri: url }}
                style={[styles.masonryImage, { height: getImageHeight(idx + 1) }]}
                contentFit="cover" transition={200} cachePolicy="memory-disk"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Fullscreen Viewer Modal */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.viewerContainer}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerVisible(false)}
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>

          {/* Counter */}
          <View style={styles.viewerCounter}>
            <Text style={styles.viewerCounterText}>
              {viewerIndex + 1} / {images.length}
            </Text>
          </View>

          {/* Paging gallery */}
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setViewerIndex(idx);
            }}
            keyExtractor={(_, idx) => String(idx)}
            renderItem={({ item }) => (
              <View style={styles.viewerSlide}>
                <Image
                  source={{ uri: item }}
                  style={styles.viewerImage}
                  contentFit="contain" transition={200} cachePolicy="memory-disk"
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  loadingContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.md },
  emptyContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: fontSize.md },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1 },
  countBadge: { fontSize: fontSize.sm },

  masonry: {
    flexDirection: 'row',
    gap: COL_GAP,
    paddingBottom: spacing['2xl'],
  },
  masonryCol: {
    flex: 1,
    gap: COL_GAP,
  },
  imageCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  masonryImage: {
    width: '100%',
  },

  // Fullscreen viewer
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCounter: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  viewerCounterText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewerSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
});

export default GalleryTab;
