import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  StatusBadge,
  SearchBar,
  LoadingSpinner,
  EmptyState,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
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
  payment?: { total?: number };
  participants?: { adults?: number; children?: number };
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

function OrderCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const activityName =
    booking.activityName || booking.activity?.title || booking.activity?.name || 'Activity';
  const customerName =
    booking.customerName ||
    [booking.customer?.firstName, booking.customer?.lastName].filter(Boolean).join(' ') ||
    booking.customer?.name ||
    'Customer';
  const amount = booking.totalAmount || booking.payment?.total || 0;
  const dateStr = booking.date || booking.bookingDate || '';
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';
  const totalParticipants =
    (booking.participants?.adults || 0) + (booking.participants?.children || 0);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderRef}>
            {booking.bookingReference || `#${booking._id?.slice(-6)}`}
          </Text>
          <StatusBadge status={booking.status} />
        </View>

        <Text style={styles.orderActivity} numberOfLines={1}>
          {activityName}
        </Text>

        <View style={styles.orderDetails}>
          <View style={styles.orderDetailItem}>
            <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.orderDetailText}>{customerName}</Text>
          </View>
          <View style={styles.orderDetailItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.orderDetailText}>{formattedDate}</Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.orderDetailItem}>
            <Ionicons name="people-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.orderDetailText}>
              {totalParticipants || '-'} participant{totalParticipants !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.orderAmount}>
            {'\u20B9'}{amount.toLocaleString('en-IN')}
          </Text>
        </View>
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

  // ── Render ───────────────────────────────────────────────────────────────

  const renderOrderItem = useCallback(
    ({ item }: { item: Booking }) => (
      <OrderCard
        booking={item}
        onPress={() => router.push(`/booking/${item._id}`)}
      />
    ),
    [router]
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
        <Text style={styles.title}>Order Management</Text>
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
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderRef: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  orderActivity: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  orderDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
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
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  orderAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
