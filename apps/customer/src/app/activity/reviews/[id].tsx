import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  Avatar,
  Badge,
  EmptyState,
  StarRating,
  useTheme,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';

type SortKey = 'newest' | 'highest' | 'lowest' | 'helpful';

type Review = {
  _id: string;
  rating: number;
  title?: string;
  body?: string;
  createdAt?: string;
  user?: { name?: string; avatar?: string };
  helpfulCount?: number;
  photos?: string[];
  tags?: string[];
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
  { key: 'helpful', label: 'Most helpful' },
];

const PAGE_SIZE = 20;

export default function AllReviewsScreen() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<SortKey>('newest');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  const fetchPage = useCallback(
    async (nextPage: number, replace = false) => {
      if (!id) return;
      if (loading) return;
      setLoading(true);
      try {
        const res = await activityMarketplaceAPI.getActivityReviews(
          id,
          nextPage,
          sort,
        );
        const incoming: Review[] = res?.data || [];
        const total = res?.pagination?.total ?? res?.total ?? 0;
        const avg = res?.averageRating ?? 0;

        setAverageRating(avg);
        setTotalReviews(total);
        setHasMore(nextPage * PAGE_SIZE < total);
        setReviews((prev) => (replace ? incoming : [...prev, ...incoming]));
        setPage(nextPage);
      } catch (err: any) {
        console.warn('[AllReviews] fetch failed:', err?.message);
      } finally {
        setLoading(false);
      }
    },
    [id, sort, loading],
  );

  // Reset and reload when sort changes
  useEffect(() => {
    setReviews([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
    // We deliberately exclude fetchPage from deps to avoid loop with `loading`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (!loading && hasMore) {
      fetchPage(page + 1);
    }
  }, [loading, hasMore, page, fetchPage]);

  const renderItem = ({ item }: { item: Review }) => (
    <ReviewRow review={item} />
  );

  const ListHeader = (
    <View style={[styles.header, { borderBottomColor: themeColors.border, backgroundColor: themeColors.background }]}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryAvg, { color: themeColors.text }]}>{averageRating.toFixed(1)}</Text>
        <View style={{ flex: 1 }}>
          <StarRating rating={averageRating} size={18} />
          <Text style={[styles.summaryMeta, { color: themeColors.textSecondary }]}>
            Based on {totalReviews.toLocaleString()} review
            {totalReviews === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setSort(opt.key)}
              style={[styles.sortChip, !active && { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }, active && styles.sortChipActive]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortChipText,
                  !active && { color: themeColors.textSecondary },
                  active && styles.sortChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const ListEmpty = !loading ? (
    <EmptyState
      title="No reviews yet"
      description="Be the first to share your experience after your booking is completed."
    />
  ) : null;

  const ListFooter = loading && reviews.length > 0 ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator color={colors.primary[500]} />
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Reviews</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlashList
        data={reviews}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReachedThreshold={0.5}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
      <View style={styles.rowHead}>
        <Avatar
          uri={review.user?.avatar}
          name={review.user?.name || 'Traveller'}
          size={40}
        />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[styles.userName, { color: themeColors.text }]}>{review.user?.name || 'Traveller'}</Text>
          {review.createdAt ? (
            <Text style={[styles.dateText, { color: themeColors.textTertiary }]}>
              {new Date(review.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          ) : null}
        </View>
        <StarRating rating={review.rating} size={14} />
      </View>

      {review.title ? <Text style={[styles.title, { color: themeColors.text }]}>{review.title}</Text> : null}
      {review.body ? <Text style={[styles.body, { color: themeColors.textSecondary }]}>{review.body}</Text> : null}

      {review.tags && review.tags.length > 0 && (
        <View style={styles.tagRow}>
          {review.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} label={tag} variant="default" size="sm" />
          ))}
        </View>
      )}

      {review.helpfulCount && review.helpfulCount > 0 ? (
        <Text style={[styles.helpful, { color: themeColors.textTertiary }]}>
          {review.helpfulCount} found this helpful
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  listContent: {
    paddingBottom: spacing['3xl'],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  summaryAvg: {
    fontSize: 44,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginRight: spacing.md,
  },
  summaryMeta: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  sortChipActive: {
    backgroundColor: colors.primary[500],
  },
  sortChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: colors.textInverse,
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  helpful: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
