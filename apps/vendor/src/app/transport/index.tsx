import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import Toast from 'react-native-toast-message';
import {
  Card,
  StatusBadge,
  EmptyState,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { vehicleAPI } from '@prayana/shared-services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  _id: string;
  id?: string;
  title?: string;
  serviceType?: string;
  status?: string;
  location?: { city?: string; state?: string };
  vehicleDetails?: { make?: string; model?: string; year?: number };
  images?: Array<{ url?: string } | string>;
  stats?: { totalRevenue?: number; totalBookings?: number };
  rating?: { average?: number; count?: number };
}

interface TransportBooking {
  _id: string;
  id?: string;
  bookingReference?: string;
  status?: string;
  customerName?: string;
  customer?: { name?: string };
  serviceType?: string;
  tripDetails?: { pickupDate?: string; pickupLocation?: string };
  pricing?: { totalAmount?: number };
  payment?: { status?: string };
}

type Tab = 'vehicles' | 'bookings';

const SERVICE_LABELS: Record<string, string> = {
  chauffeur_driven: 'Chauffeur Driven',
  self_drive_4wheeler: 'Self Drive · 4W',
  self_drive_2wheeler: 'Self Drive · 2W',
  airport_transfer: 'Airport Transfer',
};

const VEHICLE_STATUS_FILTERS = ['all', 'active', 'paused', 'archived'] as const;
const BOOKING_STATUS_FILTERS = ['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serviceLabel(type?: string): string {
  if (!type) return 'Transport';
  return SERVICE_LABELS[type] || type.replace(/[_-]+/g, ' ');
}

function vehicleImage(item: Vehicle): string | undefined {
  const first = Array.isArray(item.images) ? item.images[0] : undefined;
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return first.url;
}

function money(n?: number): string {
  return `₹${(n ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────

function VehicleCard({
  item,
  onToggleStatus,
  onArchive,
  onDelete,
}: {
  item: Vehicle;
  onToggleStatus: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { themeColors } = useTheme();
  const image = vehicleImage(item);
  const status = (item.status || 'active').toLowerCase();
  const isActive = status === 'active';
  const makeModel = [item.vehicleDetails?.make, item.vehicleDetails?.model]
    .filter(Boolean)
    .join(' ');

  return (
    <Card style={styles.vehicleCard} padding="sm">
      <View style={styles.vehicleRow}>
        {image ? (
          <Image source={{ uri: image }} style={styles.vehicleImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.vehicleImage, styles.imagePlaceholder, { backgroundColor: themeColors.inputBackground }]}>
            <Ionicons name="car-outline" size={26} color={themeColors.textTertiary} />
          </View>
        )}

        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehicleTitle, { color: themeColors.text }]} numberOfLines={2}>
            {item.title || makeModel || 'Untitled vehicle'}
          </Text>

          <View style={styles.metaLine}>
            <Ionicons name="pricetag-outline" size={12} color={themeColors.textTertiary} />
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {serviceLabel(item.serviceType)}
            </Text>
          </View>

          {item.location?.city ? (
            <View style={styles.metaLine}>
              <Ionicons name="location-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {item.location.city}
                {item.location.state ? `, ${item.location.state}` : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.statsRow}>
            <Text style={[styles.revenueText, { color: themeColors.text }]}>
              {money(item.stats?.totalRevenue)}
            </Text>
            {(item.rating?.average ?? 0) > 0 ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
                  {(item.rating?.average ?? 0).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statusRow}>
            <StatusBadge status={item.status || 'active'} />
          </View>
        </View>
      </View>

      <View style={[styles.actionBar, { borderTopColor: themeColors.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleStatus} activeOpacity={0.7}>
          <Ionicons
            name={isActive ? 'pause-outline' : 'play-outline'}
            size={16}
            color={isActive ? colors.warning : colors.success}
          />
          <Text style={[styles.actionText, { color: isActive ? colors.warning : colors.success }]}>
            {isActive ? 'Pause' : 'Activate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onArchive} activeOpacity={0.7}>
          <Ionicons name="archive-outline" size={16} color={themeColors.textSecondary} />
          <Text style={[styles.actionText, { color: themeColors.textSecondary }]}>Archive</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────

function BookingRow({ item }: { item: TransportBooking }) {
  const { themeColors } = useTheme();
  const customer = item.customerName || item.customer?.name || 'Customer';

  return (
    <Card style={styles.bookingCard} padding="sm">
      <View style={styles.bookingHead}>
        <Text style={[styles.bookingRef, { color: themeColors.text }]} numberOfLines={1}>
          {item.bookingReference || `#${(item._id || item.id || '').slice(-6)}`}
        </Text>
        <StatusBadge status={item.status || 'pending'} />
      </View>

      <View style={styles.bookingMetaLine}>
        <Ionicons name="person-outline" size={13} color={themeColors.textTertiary} />
        <Text style={[styles.bookingMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {customer}
        </Text>
      </View>

      <View style={styles.bookingMetaLine}>
        <Ionicons name="car-outline" size={13} color={themeColors.textTertiary} />
        <Text style={[styles.bookingMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {serviceLabel(item.serviceType)}
        </Text>
      </View>

      <View style={styles.bookingMetaLine}>
        <Ionicons name="calendar-outline" size={13} color={themeColors.textTertiary} />
        <Text style={[styles.bookingMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
          Pickup {formatDate(item.tripDetails?.pickupDate)}
        </Text>
      </View>

      <View style={[styles.bookingFooter, { borderTopColor: themeColors.border }]}>
        <Text style={[styles.bookingAmount, { color: themeColors.text }]}>
          {money(item.pricing?.totalAmount)}
        </Text>
        {item.payment?.status ? (
          <StatusBadge status={item.payment.status} />
        ) : null}
      </View>
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TransportScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [tab, setTab] = useState<Tab>('vehicles');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [bookingFilter, setBookingFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const [vehicleRes, bookingRes] = await Promise.all([
        vehicleAPI.getMyVehicleListings().catch(() => null),
        vehicleAPI.getBusinessTransportBookings().catch(() => null),
      ]);

      const vData = vehicleRes?.data ?? vehicleRes;
      const vList = vData?.vehicles || vData?.listings || (Array.isArray(vData) ? vData : []);
      setVehicles(Array.isArray(vList) ? vList : []);

      const bData = bookingRes?.data ?? bookingRes;
      const bList = bData?.bookings || (Array.isArray(bData) ? bData : []);
      setBookings(Array.isArray(bList) ? bList : []);
    } catch (err: any) {
      console.warn('[Transport] fetch failed:', err?.message);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Vehicle actions ────────────────────────────────────────────────────────

  const setStatus = useCallback(
    async (vehicle: Vehicle, nextStatus: string) => {
      const id = vehicle._id || vehicle.id;
      if (!id) return;
      const previous = vehicles;
      setVehicles((prev) =>
        prev.map((v) => ((v._id || v.id) === id ? { ...v, status: nextStatus } : v))
      );
      try {
        await vehicleAPI.setVehicleStatus(id, nextStatus);
        Toast.show({ type: 'success', text1: `Vehicle ${nextStatus}` });
      } catch (err: any) {
        setVehicles(previous);
        Toast.show({ type: 'error', text1: 'Update failed', text2: err?.message });
      }
    },
    [vehicles]
  );

  const deleteVehicle = useCallback(
    (vehicle: Vehicle) => {
      const id = vehicle._id || vehicle.id;
      if (!id) return;
      Alert.alert('Delete vehicle', 'This permanently removes the listing. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const previous = vehicles;
            setVehicles((prev) => prev.filter((v) => (v._id || v.id) !== id));
            try {
              await vehicleAPI.deleteVehicle(id);
              Toast.show({ type: 'success', text1: 'Vehicle deleted' });
            } catch (err: any) {
              setVehicles(previous);
              Toast.show({ type: 'error', text1: 'Delete failed', text2: err?.message });
            }
          },
        },
      ]);
    },
    [vehicles]
  );

  // ── Derived lists ──────────────────────────────────────────────────────────

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (vehicleFilter !== 'all' && (v.status || 'active').toLowerCase() !== vehicleFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${v.title || ''} ${v.vehicleDetails?.make || ''} ${v.vehicleDetails?.model || ''} ${v.location?.city || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, vehicleFilter, search]);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (bookingFilter !== 'all' && (b.status || '').toLowerCase() !== bookingFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${b.bookingReference || ''} ${b.customerName || b.customer?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, bookingFilter, search]);

  const filters = tab === 'vehicles' ? VEHICLE_STATUS_FILTERS : BOOKING_STATUS_FILTERS;
  const activeFilter = tab === 'vehicles' ? vehicleFilter : bookingFilter;
  const setActiveFilter = tab === 'vehicles' ? setVehicleFilter : setBookingFilter;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Transport</Text>
        <TouchableOpacity onPress={() => router.push('/transport/analytics')} style={styles.headerAction}>
          <Ionicons name="stats-chart-outline" size={22} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        {([
          { key: 'vehicles', label: 'My Vehicles' },
          { key: 'bookings', label: 'Bookings' },
        ] as { key: Tab; label: string }[]).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && { borderBottomColor: colors.primary[500] }]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary[600] : themeColors.textSecondary }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
          <Ionicons name="search-outline" size={18} color={themeColors.textTertiary} />
          <RNTextInput
            value={search}
            onChangeText={setSearch}
            placeholder={tab === 'vehicles' ? 'Search vehicles...' : 'Search bookings...'}
            placeholderTextColor={themeColors.textTertiary}
            style={[styles.searchInput, { color: themeColors.text }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.pillRow}>
        <FlashList
          data={filters as unknown as string[]}
          keyExtractor={(f) => f}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillContent}
          renderItem={({ item: f }) => {
            const active = activeFilter === f;
            return (
              <TouchableOpacity
                style={[
                  styles.pill,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  active && styles.pillActive,
                ]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, { color: themeColors.textSecondary }, active && styles.pillTextActive]}>
                  {f === 'all' ? 'All' : f.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Content */}
      {loading ? (
        <LoadingSpinner fullScreen message="Loading transport..." />
      ) : tab === 'vehicles' ? (
        filteredVehicles.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<Ionicons name="car-sport-outline" size={56} color={colors.gray[300]} />}
              title="No vehicles yet"
              description="List a taxi or self-drive vehicle to start accepting transport bookings."
              actionLabel="Add Vehicle"
              onAction={() => router.push('/transport/new')}
            />
          </View>
        ) : (
          <FlashList
            data={filteredVehicles}
            keyExtractor={(item) => item._id || item.id || item.title || ''}
            renderItem={({ item }) => (
              <VehicleCard
                item={item}
                onToggleStatus={() =>
                  setStatus(item, (item.status || 'active').toLowerCase() === 'active' ? 'paused' : 'active')
                }
                onArchive={() => setStatus(item, 'archived')}
                onDelete={() => deleteVehicle(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
            }
          />
        )
      ) : filteredBookings.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Ionicons name="receipt-outline" size={56} color={colors.gray[300]} />}
            title="No bookings yet"
            description="Transport bookings from travellers will appear here."
          />
        </View>
      ) : (
        <FlashList
          data={filteredBookings}
          keyExtractor={(item) => item._id || item.id || item.bookingReference || ''}
          renderItem={({ item }) => <BookingRow item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
          }
        />
      )}

      {/* FAB (vehicles tab only) */}
      {tab === 'vehicles' ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => router.push('/transport/new')}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },

  // Search
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: 2,
  },

  // Filter pills
  pillRow: {
    height: 52,
    justifyContent: 'center',
  },
  pillContent: {
    paddingHorizontal: spacing.xl,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  pillActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  pillText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },

  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing['3xl'] + 48,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  // Vehicle card
  vehicleCard: {
    marginBottom: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  vehicleImage: {
    width: 92,
    height: 92,
    borderRadius: borderRadius.md,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  vehicleTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  revenueText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Booking card
  bookingCard: {
    marginBottom: spacing.md,
  },
  bookingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingRef: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginRight: spacing.sm,
  },
  bookingMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  bookingMeta: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  bookingAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl + 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
});
