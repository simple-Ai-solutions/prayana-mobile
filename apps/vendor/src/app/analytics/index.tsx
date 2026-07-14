import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, LoadingSpinner } from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { makeAPICall, getBaseURL } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// 3-up stat grid to mirror the PWA's 6-card (2×3) layout.
const STAT_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md * 2) / 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  totalBookings: number;
  totalRevenue: number;
  totalCommission: number | null;
  netEarnings: number | null;
  totalParticipants: number;
  avgBookingValue: number;
  topActivities?: Array<{
    _id?: string;
    activityId?: string;
    name?: string;
    title?: string;
    revenue: number;
    count: number;
  }>;
  dailyBookings?: Array<{
    date: string;
    count: number;
  }>;
}

// Match the PWA period keys exactly (`7d`/`30d`/`90d`). The backend switch
// keys off these strings — sending bare `7`/`90` silently fell through to the
// 30d default, so 7-day and 90-day filters never actually changed the data.
const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
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
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
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
  activity: { name?: string; title?: string; revenue: number; count: number };
  rank: number;
  maxRevenue: number;
}) {
  const barWidth = maxRevenue > 0 ? (activity.revenue / maxRevenue) * 100 : 0;
  const count = activity.count ?? 0;
  const perBooking = count > 0 ? Math.round(activity.revenue / count) : 0;

  return (
    <View style={styles.topActivityRow}>
      <View style={styles.topActivityRank}>
        <Text style={styles.topActivityRankText}>{rank}</Text>
      </View>
      <View style={styles.topActivityInfo}>
        <Text style={styles.topActivityName} numberOfLines={1}>
          {activity.title || activity.name || 'Activity'}
        </Text>
        <Text style={styles.topActivitySub}>
          {count} booking{count !== 1 ? 's' : ''}
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
            {'\u20B9'}{perBooking.toLocaleString('en-IN')}/booking
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

  const [period, setPeriod] = useState('30d');
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
      const s = d?.summary || d;
      setData({
        totalBookings: s?.totalBookings ?? 0,
        totalRevenue: s?.totalRevenue ?? 0,
        totalCommission: s?.totalCommission ?? null,
        netEarnings: s?.netEarnings ?? null,
        totalParticipants: s?.totalParticipants ?? 0,
        avgBookingValue: s?.avgBookingValue ?? 0,
        topActivities: d?.topActivities || [],
        dailyBookings: d?.dailyBookings || [],
      });
    } catch (err) {
      console.warn('[Analytics] fetch error:', err);
    }
  }, [businessAccount?._id, period]);

  const exportCSV = useCallback(() => {
    if (!businessAccount?._id) return;
    const url = `${getBaseURL()}/business/${businessAccount._id}/analytics/export?period=${period}`;
    Linking.openURL(url).catch((err) =>
      console.warn('[Analytics] export error:', err)
    );
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
          <Ionicons name="chevron-back" size={24} color={colors.text} />
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
        {/* Title + subtitle (mirrors the PWA page header) */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderText}>
            <Text style={styles.pageTitle}>Analytics Dashboard</Text>
            <Text style={styles.pageSubtitle}>Track your performance and revenue</Text>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={exportCSV}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={16} color={colors.primary[600]} />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

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
            {/* Stat Cards \u2014 same six as the PWA, in the same order */}
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
                icon="cash-outline"
                color={colors.success}
                bg={colors.successLight}
              />
              <StatCard
                label="Commission Paid"
                value={
                  data?.totalCommission != null
                    ? `\u20B9${Math.round(data.totalCommission / 100).toLocaleString('en-IN')}`
                    : '\u2014'
                }
                icon="pricetag-outline"
                color={colors.error}
                bg={colors.errorLight}
              />
              <StatCard
                label="Net Earnings"
                value={
                  data?.netEarnings != null
                    ? `\u20B9${Math.round(data.netEarnings / 100).toLocaleString('en-IN')}`
                    : '\u2014'
                }
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
                label="Avg Booking"
                value={`\u20B9${Math.round(data?.avgBookingValue ?? 0).toLocaleString('en-IN')}`}
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
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="bar-chart-outline" size={18} color={colors.primary[600]} />
                  <Text style={styles.sectionTitleInline}>Top Performing Activities</Text>
                </View>
                {data.topActivities.slice(0, 5).map((activity, i) => (
                  <TopActivityRow
                    key={activity._id || activity.activityId || i}
                    activity={activity}
                    rank={i + 1}
                    maxRevenue={maxRevenue}
                  />
                ))}
              </Card>
            )}

            {/* Empty State */}
            {data && (data.totalBookings ?? 0) === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="bar-chart-outline" size={44} color={colors.gray[400]} />
                <Text style={styles.emptyTitle}>No data yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start receiving bookings to see your analytics here
                </Text>
              </View>
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

  // Page header (title + subtitle + export)
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  pageHeaderText: {
    flex: 1,
  },
  pageTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  exportBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
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
    padding: spacing.md,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitleInline: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
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
  },
  topActivitySub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
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

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    marginTop: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
