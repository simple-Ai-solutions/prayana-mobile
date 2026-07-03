import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Alert,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import {
  Card,
  Badge,
  StarRating,
  LoadingSpinner,
  EmptyState,
  Button,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  _id: string;
  title?: string;
  name?: string;
  category?: string;
  description?: string;
  status?: string;
  pricing?: { basePrice?: number; adultPrice?: number };
  price?: number;
  rating?: { average?: number; count?: number };
  averageRating?: number;
  reviewCount?: number;
  images?: string[];
  thumbnailUrl?: string;
  bookingCount?: number;
  totalBookings?: number;
  isActive?: boolean;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: colors.successLight, text: colors.success, label: 'Active' },
  approved: { bg: colors.successLight, text: colors.success, label: 'Active' },
  draft: { bg: colors.gray[200], text: colors.gray[600], label: 'Draft' },
  paused: { bg: colors.warningLight, text: colors.warning, label: 'Paused' },
  pending_approval: { bg: colors.infoLight, text: colors.info, label: 'In Review' },
  rejected: { bg: colors.errorLight, text: colors.error, label: 'Rejected' },
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonActivityCard() {
  return (
    <Card style={styles.activityCard}>
      <View style={[styles.skeletonThumb, { backgroundColor: colors.gray[200] }]} />
      <View style={styles.activityContent}>
        <View style={[styles.skeletonLine, { width: '70%', height: 16 }]} />
        <View style={[styles.skeletonLine, { width: '40%', height: 12, marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 14, marginTop: 12 }]} />
      </View>
    </Card>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  onPress,
  onToggleStatus,
}: {
  activity: Activity;
  onPress: () => void;
  onToggleStatus: (active: boolean) => void;
}) {
  const title = activity.title || activity.name || 'Untitled Activity';
  const price = activity.pricing?.basePrice || activity.pricing?.adultPrice || activity.price || 0;
  const rating = activity.rating?.average || activity.averageRating || 0;
  const reviewCount = activity.rating?.count || activity.reviewCount || 0;
  const bookings = activity.bookingCount || activity.totalBookings || 0;
  const statusKey = activity.status || 'draft';
  const statusConfig = STATUS_COLORS[statusKey] || STATUS_COLORS.draft;
  const isActive = statusKey === 'active' || statusKey === 'approved';
  const thumbnail = activity.images?.[0] || activity.thumbnailUrl;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.activityCard} padding="sm">
        <View style={styles.activityRow}>
          {/* Thumbnail */}
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.activityThumb} />
          ) : (
            <LinearGradient
              colors={[colors.primary[100], colors.primary[200]]}
              style={styles.activityThumb}
            >
              <Ionicons name="image-outline" size={28} color={colors.primary[400]} />
            </LinearGradient>
          )}

          {/* Content */}
          <View style={styles.activityContent}>
            <View style={styles.activityTitleRow}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>

            {activity.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{activity.category}</Text>
              </View>
            )}

            <View style={styles.activityMeta}>
              {rating > 0 && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text style={styles.ratingText}>
                    {rating.toFixed(1)} ({reviewCount})
                  </Text>
                </View>
              )}
              <View style={styles.bookingCountRow}>
                <Ionicons name="ticket-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.bookingCountText}>{bookings} bookings</Text>
              </View>
            </View>

            <View style={styles.activityFooter}>
              <Text style={styles.activityPrice}>
                {'\u20B9'}{price.toLocaleString('en-IN')}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusPillText, { color: statusConfig.text }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Toggle */}
          {(statusKey === 'active' || statusKey === 'approved' || statusKey === 'paused') && (
            <View style={styles.toggleWrap}>
              <Switch
                value={isActive}
                onValueChange={onToggleStatus}
                trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                thumbColor={isActive ? colors.primary[500] : colors.gray[400]}
              />
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActivitiesScreen() {
  const router = useRouter();
  const { businessAccount, myListings, setMyListings, setListingsLoading } = useBusinessStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchActivities = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res = await activityMarketplaceAPI.getMyListings();
      const data = res?.data || res?.activities || res?.listings || res || [];
      setMyListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[Activities] fetch error:', err);
      Toast.show({ type: 'error', text1: 'Failed to load activities' });
    }
  }, [businessAccount?._id, setMyListings]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setListingsLoading(true);
    await fetchActivities();
    setLoading(false);
  }, [fetchActivities, setListingsLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchActivities();
    setRefreshing(false);
  }, [fetchActivities]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Toggle Status ────────────────────────────────────────────────────────

  const handleToggleStatus = useCallback(
    async (activity: Activity, newActive: boolean) => {
      const newStatus = newActive ? 'active' : 'paused';
      try {
        await activityMarketplaceAPI.toggleListingStatus(activity._id, newStatus);
        // Update local store
        const updated = myListings.map((a: Activity) =>
          a._id === activity._id ? { ...a, status: newStatus } : a
        );
        setMyListings(updated);
        Toast.show({
          type: 'success',
          text1: `Activity ${newActive ? 'activated' : 'paused'}`,
        });
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Failed to update status' });
      }
    },
    [myListings, setMyListings]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: Activity }) => (
      <ActivityCard
        activity={item}
        onPress={() => router.push(`/activity/${item._id}/edit`)}
        onToggleStatus={(active) => handleToggleStatus(item, active)}
      />
    ),
    [router, handleToggleStatus]
  );

  const keyExtractor = useCallback((item: Activity) => item._id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Activities</Text>
        <Button
          title="+ New"
          onPress={() => router.push('/activity/new')}
          size="sm"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.skeletonList}>
          <SkeletonActivityCard />
          <SkeletonActivityCard />
          <SkeletonActivityCard />
        </View>
      ) : (
        <FlatList
          data={myListings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="compass-outline" size={48} color={colors.textTertiary} />}
              title="No activities listed"
              description="Create your first activity listing to start attracting customers."
              actionLabel="Create Activity"
              onAction={() => router.push('/activity/new')}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/activity/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  skeletonList: {
    paddingHorizontal: spacing.xl,
  },

  // Activity Card
  activityCard: {
    marginBottom: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  activityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary[600],
  },
  activityMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  bookingCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bookingCountText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  activityPrice: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statusPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  toggleWrap: {
    marginLeft: spacing.sm,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },

  // Skeleton
  skeletonThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  skeletonLine: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.sm,
  },
});
