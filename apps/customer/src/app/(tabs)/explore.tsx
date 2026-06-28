import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  Badge,
  StarRating,
  useTheme,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI, makeAPICall } from '@prayana/shared-services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_IMAGE_HEIGHT = 200;
const PAGE_SIZE = 12;

// ============================================================
// CATEGORY DATA
// ============================================================
const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps-outline' as const },
  { key: 'adventure', label: 'Adventure', icon: 'compass-outline' as const },
  { key: 'cultural', label: 'Cultural', icon: 'library-outline' as const },
  { key: 'food', label: 'Food & Dining', icon: 'restaurant-outline' as const },
  { key: 'water-sports', label: 'Water Sports', icon: 'boat-outline' as const },
  { key: 'nature', label: 'Nature', icon: 'leaf-outline' as const },
  { key: 'wellness', label: 'Wellness', icon: 'fitness-outline' as const },
  { key: 'nightlife', label: 'Nightlife', icon: 'moon-outline' as const },
  { key: 'shopping', label: 'Shopping', icon: 'bag-outline' as const },
  { key: 'tours', label: 'Tours', icon: 'map-outline' as const },
  { key: 'photography', label: 'Photography', icon: 'camera-outline' as const },
];

// ============================================================
// SORT OPTIONS
// ============================================================
const SORT_OPTIONS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'rating', label: 'Rating' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'newest', label: 'Newest' },
];

// ============================================================
// SKELETON CARD COMPONENT
// ============================================================
function SkeletonCard() {
  return (
    <View style={[styles.card, shadow.md]}>
      <View style={[styles.cardImage, styles.skeleton]} />
      <View style={styles.cardContent}>
        <View style={[styles.skeletonLine, { width: '75%', height: 16 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 12, marginTop: spacing.sm }]} />
        <View style={[styles.skeletonLine, { width: '40%', height: 12, marginTop: spacing.sm }]} />
        <View style={styles.cardFooter}>
          <View style={[styles.skeletonLine, { width: '30%', height: 14 }]} />
          <View style={[styles.skeletonLine, { width: '25%', height: 14 }]} />
        </View>
      </View>
    </View>
  );
}

// ============================================================
// ACTIVITY CARD COMPONENT
// ============================================================
interface ActivityCardProps {
  activity: any;
  onPress: () => void;
}

function ActivityCard({ activity, onPress }: ActivityCardProps) {
  const { themeColors } = useTheme();
  const imageUrl =
    activity.images?.[0]?.url ||
    activity.images?.[0] ||
    activity.coverImage ||
    activity.imageUrl ||
    null;

  const rating = activity.rating?.average || activity.averageRating || 0;
  const reviewCount = activity.rating?.count || activity.reviewCount || 0;
  const basePrice =
    activity.pricing?.basePrice ?? activity.basePrice ?? activity.price ?? 0;
  const city =
    activity.location?.city || activity.city || activity.destination || '';
  const duration = activity.duration?.label || activity.durationLabel || '';
  const isInstant =
    activity.instantBooking?.enabled ?? activity.isInstantBooking ?? false;

  return (
    <TouchableOpacity
      style={[styles.card, shadow.md, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {/* Image */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[colors.primary[300], colors.primary[600]]}
          style={styles.cardImage}
        >
          <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.5)" />
        </LinearGradient>
      )}

      {/* Instant Badge */}
      {isInstant && (
        <View style={styles.instantBadge}>
          <Ionicons name="flash" size={12} color="#ffffff" />
          <Text style={styles.instantBadgeText}>Instant</Text>
        </View>
      )}

      {/* Card Content */}
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
          {activity.title || activity.name || 'Untitled Activity'}
        </Text>

        {/* Location & Duration Row */}
        <View style={styles.cardMeta}>
          {city ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {city}
              </Text>
            </View>
          ) : null}
          {duration ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {duration}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Rating */}
        {rating > 0 && (
          <View style={styles.ratingRow}>
            <StarRating rating={Math.round(rating)} size={14} />
            <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
              {rating.toFixed(1)} ({reviewCount})
            </Text>
          </View>
        )}

        {/* Footer: Price */}
        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.priceLabel, { color: themeColors.textTertiary }]}>From</Text>
            <Text style={styles.priceValue}>
              {'\u20B9'}{basePrice.toLocaleString('en-IN')}
            </Text>
          </View>
          {activity.category && (
            <Badge label={activity.category} variant="primary" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// MAIN EXPLORE SCREEN
// ============================================================
export default function ExploreScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();

  // --- State ---
  const [activities, setActivities] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(params.query || '');
  const [selectedCategory, setSelectedCategory] = useState(params.category || 'all');
  const [sortBy, setSortBy] = useState('recommended');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Track if initial params have been applied
  const initialParamsApplied = useRef(false);

  // ============================================================
  // FETCH ACTIVITIES
  // ============================================================
  const fetchActivities = useCallback(
    async (
      pageNum: number,
      query: string,
      category: string,
      sort: string,
      append: boolean = false
    ) => {
      if (pageNum === 1 && !append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const filters: Record<string, string> = {
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        };
        if (query.trim()) filters.query = query.trim();
        if (category && category !== 'all') filters.category = category;
        if (sort && sort !== 'recommended') filters.sort = sort;

        const response: any = await activityMarketplaceAPI.searchActivities(filters);

        const data = response?.data || response?.activities || [];
        const pagination = response?.pagination || {};
        const total = pagination.total || response?.total || 0;
        const serverHasMore =
          pagination.hasMore ?? (pageNum * PAGE_SIZE < total);

        if (append) {
          setActivities((prev) => [...prev, ...data]);
        } else {
          setActivities(data);
        }

        setTotalResults(total);
        setHasMore(data.length >= PAGE_SIZE && serverHasMore);
        setPage(pageNum);
      } catch (err: any) {
        console.warn('[Explore] Failed to fetch activities:', err.message);
        if (!append) {
          setActivities([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // ============================================================
  // INITIAL LOAD & PARAM CHANGES
  // ============================================================
  useEffect(() => {
    // Apply route params on mount or when they change
    const incomingCategory = params.category || 'all';
    const incomingQuery = params.query || '';

    if (!initialParamsApplied.current) {
      initialParamsApplied.current = true;
      setSelectedCategory(incomingCategory);
      setSearchQuery(incomingQuery);
      fetchActivities(1, incomingQuery, incomingCategory, sortBy, false);
    }
  }, [params.category, params.query]);

  // ============================================================
  // SEARCH WITH DEBOUNCE
  // ============================================================
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setPage(1);
        fetchActivities(1, text, selectedCategory, sortBy, false);
      }, 300);
    },
    [selectedCategory, sortBy, fetchActivities]
  );

  const handleSearchSubmit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPage(1);
    fetchActivities(1, searchQuery, selectedCategory, sortBy, false);
  }, [searchQuery, selectedCategory, sortBy, fetchActivities]);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPage(1);
    fetchActivities(1, '', selectedCategory, sortBy, false);
  }, [selectedCategory, sortBy, fetchActivities]);

  // ============================================================
  // CATEGORY SELECT
  // ============================================================
  const handleCategorySelect = useCallback(
    (categoryKey: string) => {
      setSelectedCategory(categoryKey);
      setPage(1);
      fetchActivities(1, searchQuery, categoryKey, sortBy, false);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [searchQuery, sortBy, fetchActivities]
  );

  // ============================================================
  // SORT SELECT
  // ============================================================
  const handleSortSelect = useCallback(
    (sortKey: string) => {
      setSortBy(sortKey);
      setSortModalVisible(false);
      setPage(1);
      fetchActivities(1, searchQuery, selectedCategory, sortKey, false);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [searchQuery, selectedCategory, fetchActivities]
  );

  // ============================================================
  // INFINITE SCROLL
  // ============================================================
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    const nextPage = page + 1;
    fetchActivities(nextPage, searchQuery, selectedCategory, sortBy, true);
  }, [loadingMore, hasMore, loading, page, searchQuery, selectedCategory, sortBy, fetchActivities]);

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchActivities(1, searchQuery, selectedCategory, sortBy, false);
    setRefreshing(false);
  }, [searchQuery, selectedCategory, sortBy, fetchActivities]);

  // ============================================================
  // NAVIGATE TO ACTIVITY
  // ============================================================
  const handleActivityPress = useCallback(
    (activityId: string) => {
      router.push(`/activity/${activityId}`);
    },
    [router]
  );

  // ============================================================
  // CURRENT SORT LABEL
  // ============================================================
  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find((s) => s.key === sortBy)?.label || 'Recommended',
    [sortBy]
  );

  // ============================================================
  // RENDER HELPERS
  // ============================================================
  const renderActivityCard = useCallback(
    ({ item }: { item: any }) => (
      <ActivityCard
        activity={item}
        onPress={() => handleActivityPress(item._id || item.id)}
      />
    ),
    [handleActivityPress]
  );

  const keyExtractor = useCallback(
    (item: any, index: number) => item._id || item.id || String(index),
    []
  );

  // --- List Header (search + categories + sort) ---
  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, shadow.sm, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
            <Ionicons name="search-outline" size={20} color={themeColors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Search activities..."
              placeholderTextColor={themeColors.textTertiary}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleSearchClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          style={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryPill,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  isSelected && styles.categoryPillActive,
                ]}
                onPress={() => handleCategorySelect(cat.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon}
                  size={16}
                  color={isSelected ? '#ffffff' : themeColors.textSecondary}
                  style={{ marginRight: spacing.xs }}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: themeColors.textSecondary },
                    isSelected && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort & Results Count Row */}
        <View style={styles.sortRow}>
          <Text style={[styles.resultsCount, { color: themeColors.textSecondary }]}>
            {loading ? 'Searching...' : `${totalResults} activities`}
          </Text>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setSortModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={colors.primary[500]} />
            <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
            <Ionicons name="chevron-down-outline" size={14} color={colors.primary[500]} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      searchQuery,
      selectedCategory,
      sortBy,
      currentSortLabel,
      totalResults,
      loading,
      themeColors,
      handleSearchChange,
      handleSearchSubmit,
      handleSearchClear,
      handleCategorySelect,
    ]
  );

  // --- Footer Loading Indicator ---
  const ListFooterComponent = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
        <Text style={[styles.footerLoaderText, { color: themeColors.textSecondary }]}>Loading more...</Text>
      </View>
    );
  }, [loadingMore, themeColors]);

  // --- Empty State ---
  const ListEmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color={colors.gray[300]} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No activities found</Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
          {searchQuery
            ? `No results for "${searchQuery}". Try a different search.`
            : 'Try changing your filters or category.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedCategory('all');
            setSortBy('recommended');
            fetchActivities(1, '', 'all', 'recommended', false);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color="#ffffff" />
          <Text style={styles.retryButtonText}>Reset & Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, searchQuery, themeColors, fetchActivities]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Explore</Text>
        <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>Discover amazing experiences</Text>
      </View>

      {/* Activity List */}
      <FlatList
        ref={flatListRef}
        data={loading ? [] : activities}
        renderItem={renderActivityCard}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={ListEmptyComponent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={[styles.sortModal, shadow.lg, { backgroundColor: themeColors.surface }]}>
            <View style={[styles.sortModalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.sortModalTitle, { color: themeColors.text }]}>Sort By</Text>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            {SORT_OPTIONS.map((option) => {
              const isActive = sortBy === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortOption,
                    { borderBottomColor: themeColors.border },
                    isActive && styles.sortOptionActive,
                  ]}
                  onPress={() => handleSortSelect(option.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      { color: themeColors.text },
                      isActive && styles.sortOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary[500]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Header ---
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // --- Search Bar ---
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: 0,
  },

  // --- Category Pills ---
  categoryScroll: {
    marginBottom: spacing.md,
  },
  categoryList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  categoryPillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },

  // --- Sort Row ---
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  resultsCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  sortButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },

  // --- List ---
  listContent: {
    paddingBottom: spacing['3xl'],
  },

  // --- Activity Card ---
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  instantBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  cardContent: {
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    lineHeight: 22,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  ratingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  priceLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  priceValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },

  // --- Skeleton ---
  skeleton: {
    backgroundColor: colors.gray[200],
  },
  skeletonLine: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.sm,
  },
  skeletonContainer: {
    paddingTop: spacing.sm,
  },

  // --- Footer Loader ---
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  footerLoaderText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // --- Empty State ---
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // --- Sort Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sortModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.xl,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sortOptionActive: {
    backgroundColor: colors.primary[50],
  },
  sortOptionText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.normal,
  },
  sortOptionTextActive: {
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
  },
});
