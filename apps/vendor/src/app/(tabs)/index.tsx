import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  StatusBadge,
  LoadingSpinner,
  Button,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAT_CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  todaysBookings: number;
  pendingConfirmation: number;
  monthlyRevenue: number;
  avgRating: number;
}

interface RecentBooking {
  _id: string;
  bookingReference: string;
  status: string;
  activityName?: string;
  activity?: { title?: string; name?: string };
  customerName?: string;
  customer?: { name?: string; firstName?: string };
  date?: string;
  bookingDate?: string;
  totalAmount?: number;
  payment?: { total?: number };
  participants?: { adults?: number; children?: number };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  bgColor: string;
}

function StatCard({ label, value, icon, accentColor, bgColor }: StatCardProps) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
    </Card>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={22} color={colors.primary[500]} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────

function BookingRow({ booking, onPress }: { booking: RecentBooking; onPress: () => void }) {
  const activityName =
    booking.activityName ||
    booking.activity?.title ||
    booking.activity?.name ||
    'Activity';
  const customerName =
    booking.customerName ||
    booking.customer?.name ||
    booking.customer?.firstName ||
    'Customer';
  const amount = booking.totalAmount || booking.payment?.total || 0;
  const dateStr = booking.date || booking.bookingDate || '';
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '-';

  return (
    <TouchableOpacity style={styles.bookingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingRef}>{booking.bookingReference || booking._id?.slice(-8)}</Text>
        <Text style={styles.bookingActivity} numberOfLines={1}>
          {activityName}
        </Text>
        <Text style={styles.bookingCustomer} numberOfLines={1}>
          {customerName}
        </Text>
      </View>
      <View style={styles.bookingRight}>
        <StatusBadge status={booking.status} />
        <Text style={styles.bookingAmount}>
          {'\u20B9'}{amount.toLocaleString('en-IN')}
        </Text>
        <Text style={styles.bookingDate}>{formattedDate}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonStatCard() {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.skeletonBox, { width: 36, height: 36, borderRadius: borderRadius.md }]} />
      <View style={[styles.skeletonBox, { width: 60, height: 24, marginTop: spacing.md }]} />
      <View style={[styles.skeletonBox, { width: 80, height: 12, marginTop: spacing.sm }]} />
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { businessAccount } = useBusinessStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const businessName = businessAccount?.businessName || businessAccount?.name || '';

  // ── Fetch Dashboard ──────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res = await businessAPI.getDashboard();
      if (res?.data || res?.dashboard) {
        const d = res.data || res.dashboard || res;
        setStats({
          todaysBookings: d.todaysBookings ?? d.todayBookings ?? 0,
          pendingConfirmation: d.pendingConfirmation ?? d.pendingCount ?? 0,
          monthlyRevenue: d.monthlyRevenue ?? d.revenue?.monthly ?? 0,
          avgRating: d.avgRating ?? d.averageRating ?? 0,
        });
        const bookings = d.recentBookings || d.latestBookings || [];
        setRecentBookings(bookings.slice(0, 5));
      }
    } catch (err) {
      console.warn('[Dashboard] fetch error:', err);
    }
  }, [businessAccount?._id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchDashboard();
    setLoading(false);
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── No Business Account ──────────────────────────────────────────────────

  if (!businessAccount) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.onboardingCta}>
          <Ionicons name="storefront-outline" size={64} color={colors.primary[300]} />
          <Text style={styles.onboardingTitle}>Welcome to Prayana Business</Text>
          <Text style={styles.onboardingDesc}>
            Set up your business profile to start listing activities and receiving bookings.
          </Text>
          <Button
            title="Complete Onboarding"
            onPress={() => router.push('/onboarding')}
            size="lg"
            fullWidth
            style={styles.onboardingBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
              {businessName ? `, ${businessName}` : ''}!
            </Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/messaging')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        {loading ? (
          <View style={styles.statsGrid}>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              label="Today's Bookings"
              value={String(stats?.todaysBookings ?? 0)}
              icon="calendar-outline"
              accentColor={colors.primary[500]}
              bgColor={colors.primary[50]}
            />
            <StatCard
              label="Pending"
              value={String(stats?.pendingConfirmation ?? 0)}
              icon="time-outline"
              accentColor={colors.warning}
              bgColor={colors.warningLight}
            />
            <StatCard
              label="Monthly Revenue"
              value={`\u20B9${(stats?.monthlyRevenue ?? 0).toLocaleString('en-IN')}`}
              icon="wallet-outline"
              accentColor={colors.success}
              bgColor={colors.successLight}
            />
            <StatCard
              label="Avg Rating"
              value={stats?.avgRating ? stats.avgRating.toFixed(1) : '-'}
              icon="star-outline"
              accentColor={colors.info}
              bgColor={colors.infoLight}
            />
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <QuickAction
              icon="add-circle-outline"
              label="New Activity"
              onPress={() => router.push('/activity/new')}
            />
            <QuickAction
              icon="receipt-outline"
              label="View Orders"
              onPress={() => router.push('/(tabs)/orders')}
            />
            <QuickAction
              icon="calendar-outline"
              label="Calendar"
              onPress={() => router.push('/(tabs)/calendar')}
            />
            <QuickAction
              icon="bar-chart-outline"
              label="Analytics"
              onPress={() => router.push('/analytics')}
            />
          </View>
        </View>

        {/* Recent Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            {recentBookings.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <LoadingSpinner size="small" message="Loading bookings..." />
          ) : recentBookings.length === 0 ? (
            <Card>
              <View style={styles.emptyBookings}>
                <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText}>
                  No bookings yet. Create your first activity listing to start receiving bookings.
                </Text>
              </View>
            </Card>
          ) : (
            <Card padding="sm">
              {recentBookings.map((booking, index) => (
                <React.Fragment key={booking._id}>
                  <BookingRow
                    booking={booking}
                    onPress={() => router.push(`/booking/${booking._id}`)}
                  />
                  {index < recentBookings.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </Card>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statCard: {
    width: STAT_CARD_WIDTH,
    position: 'relative',
    overflow: 'hidden',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    height: '100%',
    borderTopRightRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - spacing.xl * 2) / 4,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Section
  section: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  viewAll: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
    marginBottom: spacing.md,
  },

  // Booking Row
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  bookingLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  bookingRef: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
    marginBottom: 2,
  },
  bookingActivity: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  bookingCustomer: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookingRight: {
    alignItems: 'flex-end',
  },
  bookingAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  bookingDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },

  // Empty
  emptyBookings: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.md,
    maxWidth: 260,
  },

  // Onboarding CTA
  onboardingCta: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  onboardingTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  onboardingDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.md,
  },
  onboardingBtn: {
    marginTop: spacing['2xl'],
  },

  // Skeleton
  skeletonBox: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.sm,
  },

  // Bottom
  bottomSpacer: {
    height: spacing['3xl'],
  },
});
