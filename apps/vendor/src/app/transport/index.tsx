import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput as RNTextInput,
  Alert,
  ScrollView,
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
  useTheme,
} from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { vehicleAPI } from '@prayana/shared-services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  _id: string;
  id?: string;
  title?: string;
  slug?: string;
  serviceType?: string;
  status?: string;
  isApproved?: boolean;
  location?: { city?: string; state?: string };
  vehicleDetails?: { make?: string; model?: string; year?: number };
  images?: Array<{ url?: string } | string>;
  stats?: { totalRevenue?: number; totalBookings?: number; viewCount?: number };
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

// Status filters mirror the PWA scope chips: all / active / pending / drafts / archived
type StatusFilterKey = 'all' | 'active' | 'pending' | 'draft' | 'archived';

const STATUS_FILTERS: { key: StatusFilterKey; label: string; dot: string }[] = [
  { key: 'all', label: 'All', dot: colors.gray[400] },
  { key: 'active', label: 'Active', dot: colors.success },
  { key: 'pending', label: 'Pending', dot: colors.warning },
  { key: 'draft', label: 'Drafts', dot: colors.primary[500] },
  { key: 'archived', label: 'Archived', dot: colors.error },
];

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

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tone: string;
}) {
  const { themeColors } = useTheme();
  return (
    <Card style={styles.statCard} padding="sm">
      <View style={styles.statRow}>
        <View style={[styles.statIconWrap, { backgroundColor: `${tone}22` }]}>
          <Ionicons name={icon} size={18} color={tone} />
        </View>
        <View style={styles.statTextCol}>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.statValue, { color: themeColors.text }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────

function VehicleCard({
  item,
  onEdit,
  onToggleStatus,
  onMoveToDraft,
  onArchive,
  onDelete,
}: {
  item: Vehicle;
  onEdit: () => void;
  onToggleStatus: () => void;
  onMoveToDraft: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { themeColors } = useTheme();
  const image = vehicleImage(item);
  const status = (item.status || 'active').toLowerCase();
  const isActive = status === 'active';
  const isArchived = status === 'archived';
  const isDraft = status === 'draft';
  const makeModel = [item.vehicleDetails?.make, item.vehicleDetails?.model]
    .filter(Boolean)
    .join(' ');

  return (
    <Card style={styles.vehicleCard} padding="sm">
      <View style={styles.vehicleRow}>
        <View style={styles.imageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.vehicleImage} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.vehicleImage, styles.imagePlaceholder, { backgroundColor: themeColors.inputBackground }]}>
              <Ionicons name="car-outline" size={26} color={themeColors.textTertiary} />
            </View>
          )}
          {item.isApproved === false ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending approval</Text>
            </View>
          ) : null}
        </View>

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
            ) : (
              <Text style={[styles.ratingText, { color: themeColors.textTertiary }]}>No reviews yet</Text>
            )}
          </View>

          <View style={styles.statusRow}>
            <StatusBadge status={item.status || 'active'} />
            <View style={styles.miniStats}>
              <View style={styles.miniStat}>
                <Ionicons name="eye-outline" size={12} color={themeColors.textTertiary} />
                <Text style={[styles.miniStatText, { color: themeColors.textSecondary }]}>
                  {(item.stats?.viewCount ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
              {(item.stats?.totalBookings ?? 0) > 0 ? (
                <View style={styles.miniStat}>
                  <Ionicons name="trending-up-outline" size={12} color={colors.success} />
                  <Text style={[styles.miniStatText, { color: colors.success }]}>
                    {item.stats?.totalBookings}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.actionBar, { borderTopColor: themeColors.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={16} color={colors.primary[600]} />
          <Text style={[styles.actionText, { color: colors.primary[600] }]}>Edit</Text>
        </TouchableOpacity>

        {!isArchived ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onToggleStatus}
            activeOpacity={0.7}
            disabled={!isActive && item.isApproved === false}
          >
            <Ionicons
              name={isActive ? 'pause-outline' : 'play-outline'}
              size={16}
              color={
                !isActive && item.isApproved === false
                  ? themeColors.textTertiary
                  : isActive
                    ? colors.warning
                    : colors.success
              }
            />
            <Text
              style={[
                styles.actionText,
                {
                  color:
                    !isActive && item.isApproved === false
                      ? themeColors.textTertiary
                      : isActive
                        ? colors.warning
                        : colors.success,
                },
              ]}
            >
              {isActive ? 'Pause' : 'Activate'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!isDraft ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onMoveToDraft} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.actionText, { color: themeColors.textSecondary }]}>
              {isArchived ? 'Restore' : 'Draft'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!isArchived ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onArchive} activeOpacity={0.7}>
            <Ionicons name="archive-outline" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.actionText, { color: themeColors.textSecondary }]}>Archive</Text>
          </TouchableOpacity>
        ) : null}

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

// ─── Empty-state onboarding steps (vehicles, zero listings) ─────────────────────

const ONBOARDING_STEPS = [
  { n: 1, title: 'Vehicle details', desc: 'Make, model, capacity, photos' },
  { n: 2, title: 'Pricing & service', desc: 'Hourly, daily, or per-trip rates' },
  { n: 3, title: 'Documents', desc: 'RC, permit, insurance, fitness' },
];

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
  const [vehicleFilter, setVehicleFilter] = useState<StatusFilterKey>('all');
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
    async (vehicle: Vehicle, nextStatus: string, successText?: string) => {
      const id = vehicle._id || vehicle.id;
      if (!id) return;
      const previous = vehicles;
      setVehicles((prev) =>
        prev.map((v) => ((v._id || v.id) === id ? { ...v, status: nextStatus } : v))
      );
      try {
        await vehicleAPI.setVehicleStatus(id, nextStatus);
        Toast.show({ type: 'success', text1: successText || `Vehicle ${nextStatus}` });
      } catch (err: any) {
        setVehicles(previous);
        Toast.show({ type: 'error', text1: 'Update failed', text2: err?.message });
      }
    },
    [vehicles]
  );

  const archiveVehicle = useCallback(
    (vehicle: Vehicle) => {
      Alert.alert(
        'Archive this vehicle?',
        `${vehicle.title || 'This vehicle'} will be hidden from travellers and moved to the Archived tab. Nothing is deleted — booking history stays intact and you can restore it anytime.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            onPress: () => setStatus(vehicle, 'archived', 'Vehicle archived'),
          },
        ]
      );
    },
    [setStatus]
  );

  const moveToDraft = useCallback(
    (vehicle: Vehicle) => {
      const wasArchived = (vehicle.status || '').toLowerCase() === 'archived';
      setStatus(
        vehicle,
        'draft',
        wasArchived ? 'Restored to drafts' : 'Moved to drafts'
      );
    },
    [setStatus]
  );

  const deleteVehicle = useCallback(
    (vehicle: Vehicle) => {
      const id = vehicle._id || vehicle.id;
      if (!id) return;
      Alert.alert(
        'Delete this vehicle?',
        `${vehicle.title || 'This vehicle'} will be permanently removed. This cannot be undone. To hide it temporarily and keep booking history, archive it instead.`,
        [
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
        ]
      );
    },
    [vehicles]
  );

  // ── Derived stats + counts (mirror the PWA) ──────────────────────────────────

  const stats = useMemo(() => {
    const activeCount = vehicles.filter((v) => (v.status || '').toLowerCase() === 'active').length;
    const pendingCount = vehicles.filter((v) => v.isApproved === false).length;
    const totalBookings = vehicles.reduce((sum, v) => sum + (v.stats?.totalBookings || 0), 0);
    const totalRevenue = vehicles.reduce((sum, v) => sum + (v.stats?.totalRevenue || 0), 0);
    return { activeCount, pendingCount, totalBookings, totalRevenue };
  }, [vehicles]);

  const statusCounts = useMemo(() => {
    const s = (v: Vehicle) => (v.status || '').toLowerCase();
    return {
      all: vehicles.length,
      active: vehicles.filter((v) => s(v) === 'active').length,
      pending: vehicles.filter((v) => v.isApproved === false && s(v) !== 'archived').length,
      draft: vehicles.filter((v) => s(v) === 'draft').length,
      archived: vehicles.filter((v) => s(v) === 'archived').length,
    } as Record<StatusFilterKey, number>;
  }, [vehicles]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const status = (v.status || 'active').toLowerCase();
      if (vehicleFilter === 'pending') {
        if (!(v.isApproved === false && status !== 'archived')) return false;
      } else if (vehicleFilter !== 'all' && status !== vehicleFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${v.title || ''} ${v.vehicleDetails?.make || ''} ${v.vehicleDetails?.model || ''} ${v.location?.city || ''} ${v.serviceType || ''}`.toLowerCase();
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

  const editVehicle = useCallback(
    (vehicle: Vehicle) => {
      const id = vehicle._id || vehicle.id;
      router.push(id ? `/transport/new?id=${id}` : '/transport/new');
    },
    [router]
  );

  // ── List header (stats + toolbar) rendered above the FlashList content ───────

  const renderVehicleHeader = () => (
    <View>
      {/* Stat tiles */}
      <View style={styles.statGrid}>
        <StatTile icon="checkmark-circle-outline" tone={colors.success} label="Active vehicles" value={stats.activeCount} />
        <StatTile icon="time-outline" tone={colors.warning} label="Pending approval" value={stats.pendingCount} />
        <StatTile icon="cube-outline" tone={colors.primary[500]} label="Total bookings" value={stats.totalBookings} />
        <StatTile icon="cash-outline" tone={colors.info || colors.primary[600]} label="Total revenue" value={money(stats.totalRevenue)} />
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillContent}
        style={styles.pillScroll}
      >
        {STATUS_FILTERS.map((f) => {
          const active = vehicleFilter === f.key;
          const count = statusCounts[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.pill,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                active && styles.pillActive,
              ]}
              onPress={() => setVehicleFilter(f.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.pillDot, { backgroundColor: active ? '#ffffff' : f.dot }]} />
              <Text style={[styles.pillText, { color: themeColors.textSecondary }, active && styles.pillTextActive]}>
                {f.label}
              </Text>
              {count > 0 ? (
                <View style={[styles.pillCount, active && styles.pillCountActive]}>
                  <Text style={[styles.pillCountText, { color: active ? '#ffffff' : themeColors.textSecondary }]}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

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
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Transport Dashboard</Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
            Manage your vehicles, bookings, and drivers
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/transport/analytics')} style={styles.headerAction}>
          <Ionicons name="stats-chart-outline" size={22} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* Tabs (with counts) */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        {([
          { key: 'vehicles', label: 'My Vehicles', count: vehicles.length },
          { key: 'bookings', label: 'Bookings', count: bookings.length },
        ] as { key: Tab; label: string; count: number }[]).map((t) => {
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
              <Text style={[styles.tabCount, { color: active ? colors.primary[600] : themeColors.textTertiary }]}>
                {t.count}
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
            placeholder={tab === 'vehicles' ? 'Search by title, city or model…' : 'Search bookings…'}
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

      {/* Booking filter pills (bookings tab only) */}
      {tab === 'bookings' ? (
        <View style={styles.pillRow}>
          <FlashList
            data={BOOKING_STATUS_FILTERS as unknown as string[]}
            keyExtractor={(f) => f}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillContent}
            renderItem={({ item: f }) => {
              const active = bookingFilter === f;
              return (
                <TouchableOpacity
                  style={[
                    styles.pill,
                    { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                    active && styles.pillActive,
                  ]}
                  onPress={() => setBookingFilter(f)}
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
      ) : null}

      {/* Content */}
      {loading ? (
        <LoadingSpinner fullScreen message="Loading transport..." />
      ) : tab === 'vehicles' ? (
        vehicles.length === 0 ? (
          // Zero-listing onboarding empty state
          <ScrollView
            contentContainerStyle={styles.onboardScroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
            }
          >
            <View style={[styles.onboardIcon, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="car-sport-outline" size={30} color={colors.primary[600]} />
            </View>
            <Text style={[styles.onboardTitle, { color: themeColors.text }]}>No vehicles listed yet</Text>
            <Text style={[styles.onboardDesc, { color: themeColors.textSecondary }]}>
              Add your first vehicle to start receiving bookings from travellers.
            </Text>
            <TouchableOpacity
              style={styles.onboardCta}
              activeOpacity={0.85}
              onPress={() => router.push('/transport/new')}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.onboardCtaText}>Add your first vehicle</Text>
            </TouchableOpacity>

            <View style={styles.stepsWrap}>
              {ONBOARDING_STEPS.map((step) => (
                <Card key={step.n} style={styles.stepCard} padding="sm">
                  <View style={styles.stepHead}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{step.n}</Text>
                    </View>
                    <Text style={[styles.stepTitle, { color: themeColors.text }]}>{step.title}</Text>
                  </View>
                  <Text style={[styles.stepDesc, { color: themeColors.textSecondary }]}>{step.desc}</Text>
                </Card>
              ))}
            </View>
          </ScrollView>
        ) : filteredVehicles.length === 0 ? (
          // Filtered / search empty state
          <FlashList
            data={[]}
            keyExtractor={() => 'empty'}
            renderItem={null as any}
            ListHeaderComponent={renderVehicleHeader}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={
                    <Ionicons
                      name={search ? 'search-outline' : 'car-sport-outline'}
                      size={56}
                      color={colors.gray[300]}
                    />
                  }
                  title={
                    search
                      ? `No vehicles match "${search}"`
                      : `No ${vehicleFilter} vehicles`
                  }
                  description={
                    search
                      ? 'Try a different search term or clear the filter.'
                      : 'Try a different filter to see your other vehicles.'
                  }
                  actionLabel={search ? 'Clear filters' : 'Show all vehicles'}
                  onAction={() => {
                    setSearch('');
                    setVehicleFilter('all');
                  }}
                />
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
            }
          />
        ) : (
          <FlashList
            data={filteredVehicles}
            keyExtractor={(item) => item._id || item.id || item.title || ''}
            ListHeaderComponent={renderVehicleHeader}
            renderItem={({ item }) => (
              <VehicleCard
                item={item}
                onEdit={() => editVehicle(item)}
                onToggleStatus={() =>
                  setStatus(item, (item.status || 'active').toLowerCase() === 'active' ? 'paused' : 'active')
                }
                onMoveToDraft={() => moveToDraft(item)}
                onArchive={() => archiveVehicle(item)}
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
            description="Once a traveller books one of your vehicles, it will show up here."
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
      {tab === 'vehicles' && vehicles.length > 0 ? (
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
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
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
    flexDirection: 'row',
    gap: 6,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  tabCount: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
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

  // Stat tiles
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextCol: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 1,
  },

  // Filter pills
  pillRow: {
    height: 52,
    justifyContent: 'center',
  },
  pillScroll: {
    marginBottom: spacing.xs,
  },
  pillContent: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  pillActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },
  pillCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  pillCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },

  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'] + 48,
  },
  emptyWrap: {
    paddingVertical: spacing['4xl'],
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
  imageWrap: {
    position: 'relative',
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
  pendingBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.warning,
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
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
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  miniStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniStatText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
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
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: fontSize.xs,
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

  // Onboarding empty state
  onboardScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
  },
  onboardIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  onboardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  onboardDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  onboardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    ...shadow.sm,
  },
  onboardCtaText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  stepsWrap: {
    width: '100%',
    marginTop: spacing['3xl'],
    gap: spacing.md,
  },
  stepCard: {},
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  stepTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  stepDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginLeft: 30,
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
