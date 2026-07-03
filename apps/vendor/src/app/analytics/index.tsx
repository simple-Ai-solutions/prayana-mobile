import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
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
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAT_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  totalBookings: number;
  totalRevenue: number;
  totalParticipants: number;
  avgBookingValue: number;
  topActivities?: Array<{
    _id?: string;
    name?: string;
    title?: string;
    revenue: number;
    bookings: number;
  }>;
  dailyBookings?: Array<{
    date: string;
    count: number;
  }>;
}

const PERIODS = [
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// ─── Simple Bar Chart ─────────────────────────────────────────────────────────

function SimpleBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const barWidth = Math.max((SCREEN_WIDTH - spacing.xl * 2 - spacing.lg * 2 - data.length * 4) / data.length, 8);

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {data.map((item, i) => {
          const height = (item.count / maxVal) * 120;
          return (
            <View key={i} style={styles.chartBarWrap}>
              <Text style={styles.chartBarCount}>{item.count > 0 ? item.count : ''}</Text>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: Math.max(height, 4),
                    width: barWidth,
                    backgroundColor:
                      item.count > 0 ? colors.primary[500] : colors.gray[200],
                  },
                ]}
              />
              <Text style={styles.chartBarLabel}>
                {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric' })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Top Activity Row ─────────────────────────────────────────────────────────

function TopActivityRow({
  activity,
  rank,
  maxRevenue,
}: {
  activity: { name?: string; title?: string; revenue: number; bookings: number };
  rank: number;
  maxRevenue: number;
}) {
  const barWidth = maxRevenue > 0 ? (activity.revenue / maxRevenue) * 100 : 0;

  return (
    <View style={styles.topActivityRow}>
      <View style={styles.topActivityRank}>
        <Text style={styles.topActivityRankText}>#{rank}</Text>
      </View>
      <View style={styles.topActivityInfo}>
        <Text style={styles.topActivityName} numberOfLines={1}>
          {activity.title || activity.name || 'Activity'}
        </Text>
        <View style={styles.topActivityBarBg}>
          <View
            style={[styles.topActivityBar, { width: `${barWidth}%` }]}
          />
        </View>
        <View style={styles.topActivityStats}>
          <Text style={styles.topActivityRevenue}>
            {'\u20B9'}{activity.revenue.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.topActivityBookings}>
            {activity.bookings} booking{activity.bookings !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const [period, setPeriod] = useState('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res = await makeAPICall(
        `/business/${businessAccount._id}/analytics?period=${period}`,
        { timeout: 30000 }
      );
      const d = res?.data || res?.analytics || res;
      setData({
        totalBookings: d?.totalBookings ?? d?.summary?.totalBookings ?? 0,
        totalRevenue: d?.totalRevenue ?? d?.summary?.totalRevenue ?? 0,
        totalParticipants: d?.totalParticipants ?? d?.summary?.totalParticipants ?? 0,
        avgBookingValue: d?.avgBookingValue ?? d?.summary?.avgBookingValue ?? 0,
        topActivities: d?.topActivities || [],
        dailyBookings: d?.dailyBookings || [],
      });
    } catch (err) {
      console.warn('[Analytics] fetch error:', err);
    }
  }, [businessAccount?._id, period]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchAnalytics();
    setLoading(false);
  }, [fetchAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  }, [fetchAnalytics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxRevenue = Math.max(
    ...(data?.topActivities?.map((a) => a.revenue) || [0]),
    1
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        {/* Period Tabs */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodTab, period === p.key && styles.periodTabActive]}
              onPress={() => setPeriod(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <LoadingSpinner message="Loading analytics..." />
        ) : (
          <View style={styles.content}>
            {/* Stat Cards */}
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Bookings"
                value={String(data?.totalBookings ?? 0)}
                icon="calendar-outline"
                color={colors.primary[500]}
                bg={colors.primary[50]}
              />
              <StatCard
                label="Total Revenue"
                value={`\u20B9${(data?.totalRevenue ?? 0).toLocaleString('en-IN')}`}
                icon="wallet-outline"
                color={colors.success}
                bg={colors.successLight}
              />
              <StatCard
                label="Participants"
                value={String(data?.totalParticipants ?? 0)}
                icon="people-outline"
                color={colors.info}
                bg={colors.infoLight}
              />
              <StatCard
                label="Avg Value"
                value={`\u20B9${(data?.avgBookingValue ?? 0).toLocaleString('en-IN')}`}
                icon="trending-up-outline"
                color={colors.warning}
                bg={colors.warningLight}
              />
            </View>

            {/* Daily Bookings Chart */}
            {data?.dailyBookings && data.dailyBookings.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={styles.sectionTitle}>Daily Bookings</Text>
                <SimpleBarChart data={data.dailyBookings.slice(-14)} />
              </Card>
            )}

            {/* Top Activities */}
            {data?.topActivities && data.topActivities.length > 0 && (
              <Card style={styles.topCard}>
                <Text style={styles.sectionTitle}>Top Performing Activities</Text>
                {data.topActivities.slice(0, 5).map((activity, i) => (
                  <TopActivityRow
                    key={activity._id || i}
                    activity={activity}
                    rank={i + 1}
                    maxRevenue={maxRevenue}
                  />
                ))}
              </Card>
            )}
          </View>
        )}

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
  headerSpacer: {
    width: 36,
  },

  // Period Tabs
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  periodTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    ...shadow.sm,
  },
  periodTabActive: {
    backgroundColor: colors.primary[500],
  },
  periodTabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  periodTabTextActive: {
    color: '#ffffff',
  },

  // Content
  content: {
    paddingHorizontal: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: STAT_WIDTH,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Chart
  chartCard: {
    marginTop: spacing.lg,
  },
  chartContainer: {
    marginTop: spacing.md,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 160,
    paddingBottom: 20,
  },
  chartBarWrap: {
    alignItems: 'center',
  },
  chartBarCount: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
    marginBottom: 2,
  },
  chartBar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  chartBarLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Top Activities
  topCard: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  topActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topActivityRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  topActivityRankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  topActivityInfo: {
    flex: 1,
  },
  topActivityName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  topActivityBarBg: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  topActivityBar: {
    height: 6,
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },
  topActivityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  topActivityRevenue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  topActivityBookings: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
