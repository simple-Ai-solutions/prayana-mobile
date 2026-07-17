import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../theme/vendorColors';
import { vehicleAPI } from '@prayana/shared-services';
import { DEV_BYPASS_AUTH } from '../../config/devFlags';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TransportBooking = {
  _id: string;
  id?: string;
  bookingReference?: string;
  vehicleSnapshot?: { title?: string };
  vehicle?: { title?: string };
  title?: string;
  serviceType?: string;
  status?: string;
  startDate?: string;
  pickupDate?: string;
  endDate?: string;
  dropoffDate?: string;
  pickupTime?: string;
  customerName?: string;
  customerPhone?: string;
  pricing?: { totalAmount?: number };
  totalAmount?: number;
};

const SERVICE_LABELS: Record<string, string> = {
  chauffeur_driven: 'Chauffeur Driven',
  self_drive_4wheeler: 'Self Drive · 4W',
  self_drive_2wheeler: 'Self Drive · 2W',
  airport_transfer: 'Airport Transfer',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function serviceLabel(type?: string): string {
  if (!type) return 'Transport';
  return SERVICE_LABELS[type] || type.replace(/[_-]+/g, ' ');
}

function money(n?: number): string {
  return `₹${(n ?? 0).toLocaleString('en-IN')}`;
}

function bookingTitle(b: TransportBooking): string {
  return b.vehicleSnapshot?.title || b.vehicle?.title || b.title || 'Vehicle';
}

function bookingAmount(b: TransportBooking): number | undefined {
  return b.pricing?.totalAmount ?? b.totalAmount;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dateRange(b: TransportBooking): string {
  const start = formatDate(b.startDate || b.pickupDate);
  const end = formatDate(b.endDate || b.dropoffDate);
  if (start && end && start !== end) return `${start} → ${end}`;
  const time = b.pickupTime ? ` · ${b.pickupTime}` : '';
  return start ? `${start}${time}` : 'Date not set';
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function TransportBookingsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [bookings, setBookings] = useState<TransportBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res: any = await vehicleAPI.getBusinessTransportBookings({});
      const payload = res?.data ?? res;
      const list =
        payload?.bookings ||
        payload?.transportBookings ||
        (Array.isArray(payload) ? payload : []);
      setBookings(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('[TransportBookings] fetch failed:', err?.message);
      // Under the dev auth bypass every authenticated call 401s; that's expected,
      // so stay quiet and let the empty state cover it (matches other screens).
      if (!DEV_BYPASS_AUTH) {
        Toast.show({ type: 'error', text1: 'Failed to load bookings', text2: err?.message });
      }
      setBookings([]);
    }
  }, []);

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

  const renderItem = ({ item }: { item: TransportBooking }) => (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={1}>
            {bookingTitle(item)}
          </Text>
          <View style={styles.metaLine}>
            <Ionicons name="pricetag-outline" size={12} color={themeColors.textTertiary} />
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {serviceLabel(item.serviceType)}
            </Text>
          </View>
        </View>
        <StatusBadge status={item.status || 'pending'} />
      </View>

      <View style={styles.metaLine}>
        <Ionicons name="calendar-outline" size={13} color={themeColors.textTertiary} />
        <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {dateRange(item)}
        </Text>
      </View>

      {!!item.customerName && (
        <View style={styles.metaLine}>
          <Ionicons name="person-outline" size={13} color={themeColors.textTertiary} />
          <Text style={[styles.metaText, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {item.customerName}
            {item.customerPhone ? ` · ${item.customerPhone}` : ''}
          </Text>
        </View>
      )}

      <View style={[styles.cardFooter, { borderTopColor: themeColors.border }]}>
        {!!item.bookingReference && (
          <Text style={[styles.bookingRef, { color: themeColors.textTertiary }]} numberOfLines={1}>
            {item.bookingReference}
          </Text>
        )}
        <Text style={[styles.amount, { color: themeColors.text }]}>{money(bookingAmount(item))}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Transport Bookings</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading bookings..." />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item, i) => item._id || item.id || item.bookingReference || String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<Ionicons name="receipt-outline" size={56} color={colors.gray[300]} />}
                title="No transport bookings yet"
                description="Once travelers book your vehicles, their reservations will appear here."
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },

  listContent: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  emptyWrap: { paddingTop: spacing['4xl'] },

  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  metaText: { fontSize: fontSize.xs, flex: 1 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  bookingRef: { fontSize: fontSize.xs, flex: 1 },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.bold as any },
});
