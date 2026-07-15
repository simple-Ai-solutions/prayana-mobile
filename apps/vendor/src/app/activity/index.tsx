import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Card, EmptyState, Button, SearchBar } from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';
import { DEV_BYPASS_AUTH } from '../../config/devFlags';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  _id: string;
  title?: string;
  name?: string;
  category?: string | string[];
  primaryCategory?: string;
  description?: string;
  status?: string;
  isApproved?: boolean;
  pricing?: { basePrice?: number; adultPrice?: number; priceType?: string };
  price?: number;
  rating?: { average?: number; count?: number };
  averageRating?: number;
  reviewCount?: number;
  images?: Array<{ url?: string; isPrimary?: boolean }> | string[];
  thumbnailUrl?: string;
  location?: { city?: string };
  duration?: { value?: number; unit?: string };
  groupSize?: { max?: number };
  stats?: { totalBookings?: number; totalRevenue?: number; viewCount?: number };
  bookingCount?: number;
  totalBookings?: number;
  updatedAt?: string;
  createdAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function primaryImage(activity: Activity): string | undefined {
  const imgs = activity.images as any[];
  if (Array.isArray(imgs) && imgs.length) {
    if (typeof imgs[0] === 'string') return imgs[0];
    return imgs.find((i) => i?.isPrimary)?.url || imgs[0]?.url;
  }
  return activity.thumbnailUrl;
}

function photoCountOf(activity: Activity): number {
  const imgs = activity.images as any[];
  return Array.isArray(imgs) ? imgs.length : 0;
}

function categoriesOf(activity: Activity): string[] {
  return Array.isArray(activity.category)
    ? activity.category
    : activity.category
      ? [activity.category]
      : [];
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

const STAT_TONES: Record<string, { bg: string; fg: string }> = {
  green: { bg: colors.successLight, fg: colors.success },
  amber: { bg: colors.warningLight, fg: '#a16207' },
  blue: { bg: colors.primary[50], fg: colors.primary[600] },
  purple: { bg: '#f3e8ff', fg: '#9333ea' },
};

function StatTile({
  icon,
  label,
  value,
  tone = 'blue',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tone?: keyof typeof STAT_TONES;
}) {
  const t = STAT_TONES[tone];
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.fg} />
      </View>
      <View style={styles.statTextWrap}>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Status Filter Tabs ─────────────────────────────────────────────────────────

const TAB_DOTS: Record<string, string> = {
  all: colors.gray[500],
  active: colors.success,
  pending: '#eab308',
  draft: colors.primary[500],
  archived: colors.error,
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonActivityCard() {
  return (
    <Card style={styles.activityCard}>
      <View style={[styles.cardImage, { backgroundColor: colors.gray[200] }]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeletonLine, { width: '70%', height: 16 }]} />
        <View style={[styles.skeletonLine, { width: '40%', height: 12, marginTop: 10 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 20, marginTop: 14 }]} />
      </View>
    </Card>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  onPress,
  onMenu,
}: {
  activity: Activity;
  onPress: () => void;
  onMenu: () => void;
}) {
  const title = activity.title || activity.name || 'Untitled Activity';
  const price =
    activity.pricing?.basePrice || activity.pricing?.adultPrice || activity.price || 0;
  const priceType = (activity.pricing?.priceType || 'person')
    .replace('per_', '')
    .replace('_', ' ');
  const rating = activity.rating?.average || activity.averageRating || 0;
  const reviewCount = activity.rating?.count || activity.reviewCount || 0;
  const bookings =
    activity.stats?.totalBookings || activity.bookingCount || activity.totalBookings || 0;
  const views = activity.stats?.viewCount || 0;
  const status = activity.status || 'draft';
  const isApproved = !!activity.isApproved;
  const img = primaryImage(activity);
  const photoCount = photoCountOf(activity);
  const cats = categoriesOf(activity);
  const primaryCat = activity.primaryCategory || cats[0];
  const extraCats = Math.max(0, cats.length - 1);
  const city = activity.location?.city;
  const durationLabel = activity.duration?.value
    ? `${activity.duration.value}${(activity.duration.unit || 'h').charAt(0)}`
    : null;
  const groupMax = activity.groupSize?.max;
  const initial = title.trim().charAt(0).toUpperCase();

  const statusColor =
    status === 'active'
      ? { bg: colors.successLight, text: colors.success, dot: colors.success }
      : status === 'paused'
        ? { bg: colors.warningLight, text: '#a16207', dot: '#eab308' }
        : { bg: colors.gray[200], text: colors.gray[600], dot: colors.gray[400] };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card style={styles.activityCard}>
        {/* Image */}
        <View style={styles.cardImageWrap}>
          {img ? (
            <Image source={{ uri: img }} style={styles.cardImage} />
          ) : (
            <LinearGradient
              colors={[colors.primary[50], colors.primary[100]]}
              style={styles.cardImage}
            >
              <View style={styles.imagePlaceholderInitial}>
                <Text style={styles.imagePlaceholderInitialText}>{initial}</Text>
              </View>
              <View style={styles.addPhotosRow}>
                <Ionicons name="camera-outline" size={13} color={colors.primary[400]} />
                <Text style={styles.addPhotosText}>Add photos to make it shine</Text>
              </View>
            </LinearGradient>
          )}

          {/* Top-left: category chip */}
          {primaryCat && (
            <View style={styles.categoryChipTL}>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{primaryCat}</Text>
              </View>
              {extraCats > 0 && (
                <View style={styles.categoryExtra}>
                  <Text style={styles.categoryExtraText}>+{extraCats}</Text>
                </View>
              )}
            </View>
          )}

          {/* Top-right: approval / live status */}
          {!isApproved ? (
            <View style={[styles.statusBadgeTR, { backgroundColor: '#f59e0b' }]}>
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Text style={styles.statusBadgeTRText}>Pending approval</Text>
            </View>
          ) : (
            <View style={[styles.statusBadgeTR, { backgroundColor: statusColor.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor.dot }]} />
              <Text style={[styles.statusBadgeTRText, { color: statusColor.text }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          )}

          {/* Bottom-right: photo count */}
          {img && photoCount > 0 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="camera" size={11} color="#fff" />
              <Text style={styles.photoCountText}>{photoCount}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.metaRow}>
            {city && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {city}
                </Text>
              </View>
            )}
            {durationLabel && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.metaText}>{durationLabel}</Text>
              </View>
            )}
            {groupMax ? (
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.metaText}>{'≤'}{groupMax}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.priceRatingRow}>
            <View>
              <Text style={styles.cardPrice}>
                {'₹'}{price.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.cardPriceUnit}>per {priceType}</Text>
            </View>
            <View>
              {rating > 0 ? (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color="#f59e0b" />
                  <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({reviewCount})</Text>
                </View>
              ) : (
                <Text style={styles.noReviews}>No reviews yet</Text>
              )}
            </View>
          </View>

          {/* Stats + menu */}
          <View style={styles.cardFooter}>
            <View style={styles.footerStats}>
              <View style={styles.metaItem}>
                <Ionicons name="eye-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.metaText}>{views.toLocaleString()}</Text>
              </View>
              {bookings > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                  <Text style={[styles.metaText, { color: colors.success, fontWeight: fontWeight.medium }]}>
                    {bookings}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onMenu}
              style={styles.menuBtn}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Actions Sheet ──────────────────────────────────────────────────────────────

function ActionRow({
  icon,
  label,
  color,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={18} color={color || colors.text} />
      <Text style={[styles.actionLabel, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActivitiesScreen() {
  const router = useRouter();
  const {
    businessAccount,
    myListings,
    listingsLoading,
    setMyListings,
    setListingsLoading,
    updateListingInStore,
    removeListingFromStore,
  } = useBusinessStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState<Activity | null>(null);
  const [archivingListing, setArchivingListing] = useState<Activity | null>(null);
  const [deletingListing, setDeletingListing] = useState<Activity | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchActivities = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res: any = await activityMarketplaceAPI.getMyListings();
      const data = res?.data || res?.activities || res?.listings || res || [];
      setMyListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[Activities] fetch error:', err);
      // Expected 401s under the dev auth bypass — stay quiet. Real errors show in prod.
      if (!DEV_BYPASS_AUTH) {
        Toast.show({ type: 'error', text1: 'Failed to load listings' });
      }
    }
  }, [businessAccount?._id, setMyListings]);

  const loadData = useCallback(async () => {
    setListingsLoading(true);
    await fetchActivities();
    setListingsLoading(false);
  }, [fetchActivities, setListingsLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchActivities();
    setRefreshing(false);
  }, [fetchActivities]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleToggleStatus = useCallback(
    async (activity: Activity) => {
      const newStatus = activity.status === 'active' ? 'paused' : 'active';
      if (newStatus === 'active' && !activity.isApproved) {
        Toast.show({
          type: 'error',
          text1: 'This listing needs admin approval before going live.',
        });
        return;
      }
      try {
        await activityMarketplaceAPI.toggleListingStatus(activity._id, newStatus);
        updateListingInStore(activity._id, { status: newStatus });
        Toast.show({
          type: 'success',
          text1: `Listing ${newStatus === 'active' ? 'activated' : 'paused'}`,
        });
      } catch {
        Toast.show({ type: 'error', text1: 'Failed to update status' });
      }
    },
    [updateListingInStore]
  );

  const handleMoveToDraft = useCallback(
    async (activity: Activity) => {
      try {
        await activityMarketplaceAPI.toggleListingStatus(activity._id, 'draft');
        updateListingInStore(activity._id, { status: 'draft' });
        Toast.show({ type: 'success', text1: 'Moved to drafts' });
      } catch {
        Toast.show({ type: 'error', text1: 'Failed to move to draft' });
      }
    },
    [updateListingInStore]
  );

  const handleSubmitForReview = useCallback(
    async (activity: Activity) => {
      try {
        const res: any = await activityMarketplaceAPI.submitForApproval(activity._id);
        if (res?.data) updateListingInStore(activity._id, res.data);
        Toast.show({
          type: 'success',
          text1: res?.message || "Submitted for review. We'll notify you once approved.",
        });
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: err?.body?.message || err?.message || 'Failed to submit for review',
        });
      }
    },
    [updateListingInStore]
  );

  const confirmArchive = useCallback(async () => {
    if (!archivingListing) return;
    setBusy(true);
    try {
      await activityMarketplaceAPI.toggleListingStatus(archivingListing._id, 'archived');
      updateListingInStore(archivingListing._id, { status: 'archived' });
      Toast.show({ type: 'success', text1: 'Listing archived' });
      setArchivingListing(null);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to archive listing' });
    } finally {
      setBusy(false);
    }
  }, [archivingListing, updateListingInStore]);

  const confirmDelete = useCallback(async () => {
    if (!deletingListing) return;
    setBusy(true);
    try {
      await activityMarketplaceAPI.deleteListing(deletingListing._id);
      removeListingFromStore(deletingListing._id);
      Toast.show({ type: 'success', text1: 'Listing deleted permanently' });
      setDeletingListing(null);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.body?.message || err?.message || 'Failed to delete listing',
      });
    } finally {
      setBusy(false);
    }
  }, [deletingListing, removeListingFromStore]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const counts = useMemo(
    () => ({
      all: myListings.filter((l: Activity) => l.status !== 'archived').length,
      active: myListings.filter((l: Activity) => l.status === 'active').length,
      pending: myListings.filter((l: Activity) => !l.isApproved && l.status !== 'archived')
        .length,
      draft: myListings.filter((l: Activity) => l.status === 'draft').length,
      archived: myListings.filter((l: Activity) => l.status === 'archived').length,
    }),
    [myListings]
  );

  const stats = useMemo(() => {
    const activeCount = myListings.filter((l: Activity) => l.status === 'active').length;
    const pendingCount = myListings.filter(
      (l: Activity) => !l.isApproved && l.status !== 'archived'
    ).length;
    const totalBookings = myListings.reduce(
      (s: number, l: Activity) => s + (l.stats?.totalBookings || 0),
      0
    );
    const totalRevenue = myListings.reduce(
      (s: number, l: Activity) => s + (l.stats?.totalRevenue || 0),
      0
    );
    return { activeCount, pendingCount, totalBookings, totalRevenue };
  }, [myListings]);

  const searchTerm = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      myListings
        .filter((l: Activity) => {
          if (filter === 'all') return l.status !== 'archived';
          if (filter === 'pending') return !l.isApproved && l.status !== 'archived';
          return l.status === filter;
        })
        .filter((l: Activity) => {
          if (!searchTerm) return true;
          const haystack = [l.title, l.location?.city, ...categoriesOf(l)]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(searchTerm);
        })
        .sort(
          (a: Activity, b: Activity) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        ),
    [myListings, filter, searchTerm]
  );

  const STATUS_TABS = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'draft', label: 'Drafts', count: counts.draft },
    { key: 'archived', label: 'Archived', count: counts.archived },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: Activity }) => (
      <ActivityCard
        activity={item}
        onPress={() => router.push(`/activity/${item._id}/edit`)}
        onMenu={() => setMenuFor(item)}
      />
    ),
    [router]
  );

  const keyExtractor = useCallback((item: Activity) => item._id, []);

  const ListHeader = (
    <View>
      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatTile icon="checkmark-circle" tone="green" label="Active activities" value={stats.activeCount} />
        <StatTile icon="time" tone="amber" label="Pending approval" value={stats.pendingCount} />
        <StatTile icon="cube" tone="blue" label="Total bookings" value={stats.totalBookings} />
        <StatTile
          icon="cash"
          tone="purple"
          label="Total revenue"
          value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
        />
      </View>

      {/* Toolbar: search + status tabs */}
      {myListings.length > 0 && (
        <View style={styles.toolbar}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search by title, city or category"
            style={styles.searchBar}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {STATUS_TABS.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  activeOpacity={0.8}
                  style={[styles.tab, isActive && styles.tabActive]}
                >
                  <View
                    style={[
                      styles.tabDot,
                      { backgroundColor: isActive ? '#fff' : TAB_DOTS[tab.key] },
                    ]}
                  />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                      <Text
                        style={[styles.tabCountText, isActive && styles.tabCountTextActive]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const EmptyView = searchTerm ? (
    <EmptyState
      icon={<Ionicons name="search-outline" size={44} color={colors.primary[500]} />}
      title={`No matches for "${searchTerm}"`}
      description="Try a different keyword or clear the search."
      actionLabel="Clear filters"
      onAction={() => {
        setSearch('');
        setFilter('all');
      }}
    />
  ) : filter === 'all' ? (
    <EmptyState
      icon={<Ionicons name="ticket-outline" size={44} color={colors.primary[500]} />}
      title="No activities yet"
      description="Create your first listing to start receiving bookings from travelers."
      actionLabel="Create First Listing"
      onAction={() => router.push('/activity/new')}
    />
  ) : (
    <EmptyState
      icon={<Ionicons name="ticket-outline" size={44} color={colors.primary[500]} />}
      title={`No ${filter} activities`}
      description="Try a different filter or create a new activity."
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/activities'))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Ionicons name="ticket" size={20} color="#fff" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Activities</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Manage inventory, pricing and availability.
            </Text>
          </View>
        </View>
        <Button title="+ Add" onPress={() => router.push('/activity/new')} size="sm" />
      </View>

      {/* List */}
      {listingsLoading ? (
        <View style={styles.skeletonList}>
          {ListHeader}
          <SkeletonActivityCard />
          <SkeletonActivityCard />
          <SkeletonActivityCard />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<View style={styles.emptyWrap}>{EmptyView}</View>}
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
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Actions bottom sheet */}
      <Modal
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setMenuFor(null)}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {menuFor && (
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {menuFor.title || 'Activity'}
              </Text>
            )}
            {menuFor && (
              <>
                <ActionRow
                  icon="pencil-outline"
                  label="Edit Activity"
                  onPress={() => {
                    const id = menuFor._id;
                    setMenuFor(null);
                    router.push(`/activity/${id}/edit`);
                  }}
                />
                {menuFor.status === 'active' && (
                  <ActionRow
                    icon="open-outline"
                    label="View Live Page"
                    onPress={() => {
                      const id = menuFor._id;
                      setMenuFor(null);
                      router.push(`/activity/${id}`);
                    }}
                  />
                )}
                {menuFor.status === 'draft' && !menuFor.isApproved && (
                  <ActionRow
                    icon="send-outline"
                    label="Submit for Review"
                    onPress={() => {
                      const a = menuFor;
                      setMenuFor(null);
                      handleSubmitForReview(a);
                    }}
                  />
                )}
                {menuFor.isApproved && menuFor.status === 'active' && (
                  <ActionRow
                    icon="pause-outline"
                    label="Pause Listing"
                    onPress={() => {
                      const a = menuFor;
                      setMenuFor(null);
                      handleToggleStatus(a);
                    }}
                  />
                )}
                {menuFor.status !== 'active' && menuFor.status !== 'archived' && (
                  <ActionRow
                    icon="play-outline"
                    label="Activate"
                    color={colors.success}
                    disabled={!menuFor.isApproved}
                    onPress={() => {
                      const a = menuFor;
                      setMenuFor(null);
                      handleToggleStatus(a);
                    }}
                  />
                )}
                {menuFor.status !== 'draft' && (
                  <ActionRow
                    icon="document-text-outline"
                    label={menuFor.status === 'archived' ? 'Restore to Draft' : 'Move to Draft'}
                    onPress={() => {
                      const a = menuFor;
                      setMenuFor(null);
                      handleMoveToDraft(a);
                    }}
                  />
                )}
                <View style={styles.sheetDivider} />
                {menuFor.status !== 'archived' && (
                  <ActionRow
                    icon="archive-outline"
                    label="Archive"
                    onPress={() => {
                      const a = menuFor;
                      setMenuFor(null);
                      setArchivingListing(a);
                    }}
                  />
                )}
                <ActionRow
                  icon="trash-outline"
                  label="Delete"
                  color={colors.error}
                  onPress={() => {
                    const a = menuFor;
                    setMenuFor(null);
                    setDeletingListing(a);
                  }}
                />
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Archive confirmation */}
      <Modal
        visible={!!archivingListing}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setArchivingListing(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={[styles.confirmIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="warning-outline" size={26} color="#a16207" />
            </View>
            <Text style={styles.confirmTitle}>Archive this listing?</Text>
            <Text style={styles.confirmBody}>
              <Text style={styles.confirmBold}>{archivingListing?.title}</Text> will be hidden
              from travelers and moved to the Archived tab. Nothing is deleted — you can restore
              it anytime.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setArchivingListing(null)}
                disabled={busy}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#d97706' }]}
                onPress={confirmArchive}
                disabled={busy}
              >
                <Text style={styles.confirmBtnText}>{busy ? 'Archiving…' : 'Archive'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        visible={!!deletingListing}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setDeletingListing(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={[styles.confirmIcon, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="warning-outline" size={26} color={colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Delete this listing?</Text>
            <Text style={styles.confirmBody}>
              <Text style={styles.confirmBold}>{deletingListing?.title}</Text> will be permanently
              removed. This cannot be undone. To hide it temporarily and keep booking history,
              archive it instead.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setDeletingListing(null)}
                disabled={busy}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
                disabled={busy}
              >
                <Text style={styles.confirmBtnText}>{busy ? 'Deleting…' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },

  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  backBtn: {
    marginRight: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  skeletonList: {
    paddingHorizontal: spacing.xl,
  },
  emptyWrap: {
    marginTop: spacing.xl,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Toolbar
  toolbar: {
    marginBottom: spacing.lg,
  },
  searchBar: {
    marginBottom: spacing.sm,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tabActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: '#fff',
  },

  // Activity Card
  activityCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
    padding: 0,
  },
  cardImageWrap: {
    position: 'relative',
    width: '100%',
    height: 160,
  },
  cardImage: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  imagePlaceholderInitial: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderInitialText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[400],
  },
  addPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  addPhotosText: {
    fontSize: fontSize.xs,
    color: colors.primary[400],
    fontWeight: fontWeight.medium,
  },
  categoryChipTL: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '60%',
  },
  categoryChip: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  categoryChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },
  categoryExtra: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  categoryExtraText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  statusBadgeTR: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeTRText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  photoCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: '#fff',
  },

  cardBody: {
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  cardPrice: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardPriceUnit: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  ratingCount: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  noReviews: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  menuBtn: {
    padding: 4,
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
  skeletonLine: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.sm,
  },

  // Actions sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing['2xl'],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  actionLabel: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // Confirm modals
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadow.lg,
  },
  confirmIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  confirmBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  confirmBold: {
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  confirmCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  confirmBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  confirmBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
});
