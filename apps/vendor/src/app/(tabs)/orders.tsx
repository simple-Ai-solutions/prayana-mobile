import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, SearchBar, EmptyState } from '@prayana/shared-ui';
import { StatusBadge, LoadingSpinner } from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  _id: string;
  bookingReference: string;
  status: string;
  activityName?: string;
  activity?: { title?: string; name?: string; _id?: string };
  customerName?: string;
  customer?: { name?: string; firstName?: string; lastName?: string; email?: string };
  date?: string;
  bookingDate?: string;
  totalAmount?: number;
  payment?: { total?: number; status?: string };
  participants?: { adults?: number; children?: number };
  totalParticipants?: number;
  timeSlot?: { startTime?: string };
  specialRequests?: string;
  activitySnapshot?: { title?: string };
  pricing?: {
    totalAmount?: number;
    creditsApplied?: number;
    couponDiscount?: number;
    tierDiscount?: { tier?: string; amount?: number };
  };
  createdAt?: string;
}

interface StatusCounts {
  all: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

const FILTER_TABS = [
  { key: 'all', label: 'All', icon: 'list-outline' as const },
  { key: 'pending', label: 'Pending', icon: 'time-outline' as const },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' as const },
  { key: 'completed', label: 'Completed', icon: 'flag-outline' as const },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' as const },
];

// ─── Filter Tab ───────────────────────────────────────────────────────────────

function FilterTab({
  item,
  active,
  count,
  onPress,
}: {
  item: typeof FILTER_TABS[0];
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && styles.filterTabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={item.icon}
        size={16}
        color={active ? colors.primary[500] : colors.textTertiary}
      />
      <Text style={[styles.filterTabLabel, active && styles.filterTabLabelActive]}>
        {item.label}
      </Text>
      {count > 0 && (
        <View style={[styles.filterCount, active && styles.filterCountActive]}>
          <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ counts }: { counts: StatusCounts }) {
  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={[styles.statCount, { color: colors.warning }]}>{counts.pending}</Text>
        <Text style={styles.statItemLabel}>Pending</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statCount, { color: colors.success }]}>{counts.confirmed}</Text>
        <Text style={styles.statItemLabel}>Confirmed</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statCount, { color: colors.info }]}>{counts.completed}</Text>
        <Text style={styles.statItemLabel}>Completed</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statCount, { color: colors.error }]}>{counts.cancelled}</Text>
        <Text style={styles.statItemLabel}>Cancelled</Text>
      </View>
    </View>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function DiscountBadge({
  label,
  amount,
  variant,
}: {
  label: string;
  amount: number;
  variant: 'coupon' | 'tier' | 'credits';
}) {
  const palette = {
    coupon: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    tier: { bg: '#fdf4ff', border: '#f5d0fe', text: '#a21caf' },
    credits: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
  }[variant];
  return (
    <View
      style={[
        styles.discountBadge,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.discountBadgeText, { color: palette.text }]}>
        {label} {'\u2212\u20B9'}
        {amount.toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

function OrderCard({
  booking,
  onPress,
  onAction,
  busy,
}: {
  booking: Booking;
  onPress: () => void;
  onAction: (status: string) => void;
  busy: boolean;
}) {
  const activityName =
    booking.activitySnapshot?.title ||
    booking.activityName ||
    booking.activity?.title ||
    booking.activity?.name ||
    'Activity';
  const customerName =
    booking.customerName ||
    [booking.customer?.firstName, booking.customer?.lastName].filter(Boolean).join(' ') ||
    booking.customer?.name ||
    'Customer';
  const amount =
    booking.pricing?.totalAmount || booking.totalAmount || booking.payment?.total || 0;
  const dateStr = booking.bookingDate || booking.date || '';
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';
  const timeStr = booking.timeSlot?.startTime ? ` at ${booking.timeSlot.startTime}` : '';
  const totalParticipants =
    booking.totalParticipants ??
    (booking.participants?.adults || 0) + (booking.participants?.children || 0);

  const p = booking.pricing;
  const hasDiscounts =
    !!p &&
    ((p.creditsApplied || 0) > 0 ||
      (p.tierDiscount?.amount || 0) > 0 ||
      (p.couponDiscount || 0) > 0);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.orderCard}>
        {/* Title + status */}
        <View style={styles.orderHeader}>
          <Text style={styles.orderActivity} numberOfLines={1}>
            {activityName}
          </Text>
          <StatusBadge status={booking.status} />
        </View>

        {/* Meta line: reference \u00B7 customer \u00B7 participants */}
        <View style={styles.orderMetaRow}>
          <Text style={styles.orderRef}>
            {booking.bookingReference || `#${booking._id?.slice(-6)}`}
          </Text>
          <Text style={styles.orderMetaDot}>\u00B7</Text>
          <Text style={styles.orderMetaText}>{customerName}</Text>
          <Text style={styles.orderMetaDot}>\u00B7</Text>
          <View style={styles.orderDetailItem}>
            <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
            <Text style={styles.orderMetaText}>
              {totalParticipants || 0} {totalParticipants === 1 ? 'person' : 'people'}
            </Text>
          </View>
        </View>

        {/* Date + time */}
        <View style={styles.orderDetailItem}>
          <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.orderDetailText}>
            {formattedDate}
            {timeStr}
          </Text>
        </View>

        {/* Special requests */}
        {booking.specialRequests ? (
          <View style={styles.specialRequests}>
            <Text style={styles.specialRequestsText} numberOfLines={3}>
              {'\u201C'}
              {booking.specialRequests}
              {'\u201D'}
            </Text>
          </View>
        ) : null}

        {/* Footer: amount + loyalty badges */}
        <View style={styles.orderFooter}>
          <Text style={styles.orderAmount}>
            {'\u20B9'}
            {amount.toLocaleString('en-IN')}
          </Text>
          {hasDiscounts && (
            <View style={styles.discountRow}>
              {(p!.couponDiscount || 0) > 0 && (
                <DiscountBadge label="Coupon" amount={p!.couponDiscount!} variant="coupon" />
              )}
              {(p!.tierDiscount?.amount || 0) > 0 && (
                <DiscountBadge
                  label={p!.tierDiscount!.tier || 'Tier'}
                  amount={p!.tierDiscount!.amount!}
                  variant="tier"
                />
              )}
              {(p!.creditsApplied || 0) > 0 && (
                <DiscountBadge label="Credits" amount={p!.creditsApplied!} variant="credits" />
              )}
            </View>
          )}
        </View>

        {/* Status actions */}
        {booking.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionConfirm]}
              onPress={() => onAction('confirmed')}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={15} color="#ffffff" />
              <Text style={styles.actionConfirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionCancel]}
              onPress={() => onAction('cancelled')}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={15} color={colors.error} />
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {booking.status === 'confirmed' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionComplete]}
              onPress={() => onAction('completed')}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={styles.actionCompleteText}>Mark Completed</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const filters: Record<string, string> = {};
      if (activeFilter !== 'all') filters.status = activeFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const res = await businessAPI.getMyBookings(filters);
      const data = res?.data || res?.bookings || res || [];
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[Orders] fetch error:', err);
      Toast.show({ type: 'error', text1: 'Failed to load orders' });
    }
  }, [businessAccount?._id, activeFilter, searchQuery]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchBookings();
    setLoading(false);
  }, [fetchBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }, [fetchBookings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Counts ───────────────────────────────────────────────────────────────

  const counts = useMemo<StatusCounts>(() => {
    const c: StatusCounts = { all: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookings.forEach((b) => {
      c.all++;
      if (b.status === 'pending') c.pending++;
      else if (b.status === 'confirmed') c.confirmed++;
      else if (b.status === 'completed') c.completed++;
      else if (b.status === 'cancelled') c.cancelled++;
    });
    return c;
  }, [bookings]);

  // ── Filter Change ────────────────────────────────────────────────────────

  const handleFilterChange = useCallback((key: string) => {
    setActiveFilter(key);
  }, []);

  // ── Status Actions ─────────────────────────────────────────────────────────

  const applyStatus = useCallback(async (bookingId: string, status: string) => {
    setActioningId(bookingId);
    try {
      const res = await businessAPI.updateBookingStatus(bookingId, status);
      if (res?.success !== false) {
        setBookings((prev) =>
          prev.map((b) => (b._id === bookingId ? { ...b, status } : b))
        );
        const label =
          status === 'confirmed'
            ? 'Booking confirmed!'
            : status === 'cancelled'
            ? 'Booking cancelled'
            : 'Booking marked as completed';
        Toast.show({ type: 'success', text1: label });
      } else {
        Toast.show({ type: 'error', text1: 'Failed to update booking' });
      }
    } catch (err) {
      console.warn('[Orders] status update error:', err);
      Toast.show({ type: 'error', text1: 'Failed to update booking' });
    } finally {
      setActioningId(null);
    }
  }, []);

  const handleStatusAction = useCallback(
    (bookingId: string, status: string) => {
      // Guard the destructive action, mirroring the PWA confirm() prompt.
      if (status === 'cancelled') {
        Alert.alert('Cancel booking?', 'This will cancel the reservation for the customer.', [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Cancel booking',
            style: 'destructive',
            onPress: () => applyStatus(bookingId, status),
          },
        ]);
        return;
      }
      applyStatus(bookingId, status);
    },
    [applyStatus]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const renderOrderItem = useCallback(
    ({ item }: { item: Booking }) => (
      <OrderCard
        booking={item}
        busy={actioningId === item._id}
        onAction={(status) => handleStatusAction(item._id, status)}
        onPress={() => router.push(`/booking/${item._id}`)}
      />
    ),
    [router, actioningId, handleStatusAction]
  );

  const keyExtractor = useCallback((item: Booking) => item._id, []);

  const ListHeader = useMemo(
    () => (
      <>
        {/* Stats Bar */}
        <Card style={styles.statsCard}>
          <StatsBar counts={counts} />
        </Card>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchWrap}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by reference or customer..."
              onSubmit={fetchBookings}
            />
          </View>
        )}
      </>
    ),
    [counts, showSearch, searchQuery, fetchBookings]
  );

  const ListEmpty = useMemo(() => {
    if (loading) return <LoadingSpinner message="Loading orders..." />;
    const filterLabel = FILTER_TABS.find((t) => t.key === activeFilter)?.label || '';
    return (
      <EmptyState
        icon={<Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />}
        title={`No ${filterLabel.toLowerCase()} orders`}
        description={
          activeFilter === 'all'
            ? 'Orders from customers will appear here once you start receiving bookings.'
            : `You don't have any ${filterLabel.toLowerCase()} orders right now.`
        }
      />
    );
  }, [loading, activeFilter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Bookings</Text>
          <Text style={styles.subtitle}>Review and manage incoming reservations</Text>
        </View>
        <TouchableOpacity
          style={styles.searchToggle}
          onPress={() => setShowSearch(!showSearch)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showSearch ? 'close-outline' : 'search-outline'}
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Pending needs-action banner */}
      {counts.pending > 0 && (
        <View style={styles.needsActionBanner}>
          <Ionicons name="sparkles-outline" size={16} color={colors.warning} />
          <Text style={styles.needsActionText}>
            {counts.pending} need{counts.pending === 1 ? 's' : ''} action
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <FlatList
        horizontal
        data={FILTER_TABS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <FilterTab
            item={item}
            active={activeFilter === item.key}
            count={counts[item.key as keyof StatusCounts]}
            onPress={() => handleFilterChange(item.key)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterList}
      />

      {/* Bookings List */}
      <FlatList
        data={bookings}
        renderItem={renderOrderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
        showsVerticalScrollIndicator={false}
      />
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
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
  },
  needsActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  needsActionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#b45309',
  },
  searchToggle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  // Filter Tabs
  filterList: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    ...shadow.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  filterTabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  filterTabLabelActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  filterCount: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountActive: {
    backgroundColor: colors.primary[500],
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  filterCountTextActive: {
    color: '#ffffff',
  },

  // Stats
  statsCard: {
    marginBottom: spacing.md,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statCount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  statItemLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Search
  searchWrap: {
    marginBottom: spacing.md,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },

  // Order Card
  orderCard: {
    marginBottom: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  orderActivity: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  orderRef: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  orderMetaDot: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  orderMetaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  orderDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  orderDetailText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  specialRequests: {
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary[300],
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
  },
  specialRequestsText: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  orderAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  discountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    flex: 1,
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  discountBadgeText: {
    fontSize: 10.5,
    fontWeight: fontWeight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  actionConfirm: {
    backgroundColor: colors.primary[500],
  },
  actionConfirmText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  actionCancel: {
    backgroundColor: '#fef2f2',
  },
  actionCancelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },
  actionComplete: {
    backgroundColor: colors.primary[50],
  },
  actionCompleteText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
});
