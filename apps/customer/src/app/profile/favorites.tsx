import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useTheme, colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { favoritesAPI } from '@prayana/shared-services';

type Favorite = {
  id: string;
  name: string;
  location: string;
  image: string;
  savedAt: string;
  rating?: number;
  category?: string;
};

function formatSavedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { isDarkMode, themeColors } = useTheme();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await favoritesAPI.getFavorites();
      const list = (res?.favorites || []).map((f: any) => ({
        id: f.placeId,
        name: f.placeName || 'Saved place',
        location: f.placeLocation || '',
        image: f.placeImage || '',
        savedAt: f.savedAt || new Date().toISOString(),
        rating: f.placeData?.rating,
        category: f.placeData?.category,
      }));
      setFavorites(list);
    } catch (err: any) {
      console.warn('[Favorites] fetch failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemove = async (id: string) => {
    Haptics.selectionAsync();
    // Optimistic remove
    const prev = favorites;
    setFavorites((p) => p.filter((f) => f.id !== id));
    try {
      const res = await favoritesAPI.removeFavorite(id);
      if (!res?.success) {
        Toast.show({ type: 'error', text1: 'Could not remove' });
        setFavorites(prev);
      }
    } catch {
      setFavorites(prev);
      Toast.show({ type: 'error', text1: 'Could not remove' });
    }
  };

  const handlePress = (name: string, image?: string) => {
    const params = new URLSearchParams();
    if (image) params.set('previewImage', image);
    const qs = params.toString();
    router.push(`/destination/${encodeURIComponent(name)}${qs ? '?' + qs : ''}` as any);
  };

  const renderItem = ({ item }: { item: Favorite }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.card }, shadow.sm]}
      onPress={() => handlePress(item.name, item.image)}
      activeOpacity={0.85}
    >
      {/* Image */}
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: item.image }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={styles.imageOverlay}
        />
        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        {/* Heart */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => handleRemove(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="heart" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardMain}>
          <Text style={[styles.cardName, { color: themeColors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={themeColors.textSecondary} />
            <Text style={[styles.locationText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
          <Text style={[styles.savedDate, { color: themeColors.textTertiary }]}>
            Saved {formatSavedDate(item.savedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>My Favorites</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{favorites.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={64} color={themeColors.border} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Favorites Yet</Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Explore destinations and tap the heart icon to save them here.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600]]}
              style={styles.exploreBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.exploreBtnText}>Explore Destinations</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },

  list: {
    padding: spacing.xl,
    paddingBottom: 40,
  },

  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  imageWrap: { height: 160, position: 'relative' },
  image: { flex: 1 },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
  },

  cardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardMain: { flex: 1 },
  cardName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: { fontSize: 12, flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  savedDate: { fontSize: 10 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['2xl'],
  },
  exploreBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  exploreBtnGrad: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  exploreBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
});
