import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  EmptyState,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { vehicleAPI } from '@prayana/shared-services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenuePoint {
  _id?: string;
  date?: string;
  revenue?: number;
}

interface ServiceTypeBreakdown {
  _id?: string;
  serviceType?: string;
  count?: number;
  revenue?: number;
}

interface TopVehicle {
  _id?: string;
  title?: string;
  bookings?: number;
  revenue?: number;
}

interface DriverSummary {
  _id?: string;
  name?: string;
  totalTrips?: number;
  rating?: { average?: number };
}

interface AnalyticsData {
  overview?: {
    totalBookings?: number;
    totalRevenue?: number;
    completionRate?: number;
    avgBookingValue?: number;
  };
  revenueChart?: RevenuePoint[];
  serviceTypeBreakdown?: ServiceTypeBreakdown[];
  topVehicles?: TopVehicle[];
  drivers?: DriverSummary[];
}

const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
];

const SERVICE_LABELS: Record<string, string> = {
  chauffeur_driven: 'Chauffeur Driven',
  self_drive_4wheeler: 'Self Drive · 4W',
  self_drive_2wheeler: 'Self Drive · 2W',
  airport_transfer: 'Airport Transfer',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n?: number): string {
  return `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
}

function compactMoney(n?: number): string {
  const v = n ?? 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
}

function serviceLabel(type?: string): string {
  if (!type) return 'Other';
  return SERVICE_LABELS[type] || type.replace(/[_-]+/g, ' ');
}

function shortDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value.slice(5);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: string;
}) {
  const { themeColors } = useTheme();
  return (
    <Card style={styles.kpiCard} padding="md">
      <View style={[styles.kpiIcon, { backgroundColor: tint + '15' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={[styles.kpiValue, { color: themeColors.text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{label}</Text>
    </Card>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function RevenueBarChart({ data }: { data: RevenuePoint[] }) {
  const { themeColors } = useTheme();
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.revenue ?? 0)), [data]);

  if (data.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Ionicons name="bar-chart-outline" size={28} color={themeColors.textTertiary} />
        <Text style={[styles.chartEmptyText, { color: themeColors.textTertiary }]}>No revenue in this period</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
      {data.map((point, i) => {
        const value = point.revenue ?? 0;
        const height = Math.max(4, Math.round((value / max) * 120));
        return (
          <View key={point._id || point.date || i} style={styles.barColumn}>
            <Text style={[styles.barValue, { color: themeColors.textSecondary }]}>{compactMoney(value)}</Text>
            <View style={[styles.barTrack, { backgroundColor: themeColors.inputBackground }]}>
              <View style={[styles.barFill, { height, backgroundColor: colors.primary[500] }]} />
            </View>
            <Text style={[styles.barLabel, { color: themeColors.textTertiary }]} numberOfLines={1}>
              {shortDate(point._id || point.date)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TransportAnalyticsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await vehicleAPI.getTransportAnalytics(period);
      const payload = res?.data ?? res;
      setData(payload || null);
    } catch (err: any) {
      console.warn('[TransportAnalytics] fetch failed:', err?.message);
      setData(null);
    }
  }, [period]);

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

  const overview = data?.overview;
  const revenueChart = Array.isArray(data?.revenueChart) ? data!.revenueChart : [];
  const serviceBreakdown = Array.isArray(data?.serviceTypeBreakdown) ? data!.serviceTypeBreakdown : [];
  const topVehicles = Array.isArray(data?.topVehicles) ? data!.topVehicles : [];
  const drivers = Array.isArray(data?.drivers) ? data!.drivers : [];

  const hasData =
    !!overview ||
    revenueChart.length > 0 ||
    serviceBreakdown.length > 0 ||
    topVehicles.length > 0 ||
    drivers.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Transport Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Period pills */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.periodPill,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                active && styles.periodPillActive,
              ]}
              onPress={() => setPeriod(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, { color: themeColors.textSecondary }, active && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading analytics..." />
      ) : !hasData ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Ionicons name="stats-chart-outline" size={56} color={colors.gray[300]} />}
            title="No analytics yet"
            description="Once you receive transport bookings, performance insights will appear here."
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
          }
        >
          {/* KPIs */}
          <View style={styles.kpiGrid}>
            <KpiCard
              icon="cube-outline"
              label="Total Bookings"
              value={String(overview?.totalBookings ?? 0)}
              tint={colors.info}
            />
            <KpiCard
              icon="cash-outline"
              label="Total Revenue"
              value={compactMoney(overview?.totalRevenue)}
              tint={colors.success}
            />
            <KpiCard
              icon="checkmark-done-outline"
              label="Completion Rate"
              value={`${Math.round(overview?.completionRate ?? 0)}%`}
              tint={colors.primary[500]}
            />
            <KpiCard
              icon="trending-up-outline"
              label="Avg Booking Value"
              value={compactMoney(overview?.avgBookingValue)}
              tint={colors.warning}
            />
          </View>

          {/* Revenue chart */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.primary[500]} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Revenue Trend</Text>
            </View>
            <RevenueBarChart data={revenueChart} />
          </Card>

          {/* Service type breakdown */}
          {serviceBreakdown.length > 0 ? (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pie-chart-outline" size={20} color={colors.primary[500]} />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>By Service Type</Text>
              </View>
              {serviceBreakdown.map((s, i) => (
                <View key={s._id || s.serviceType || i} style={[styles.breakdownRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.breakdownLabel, { color: themeColors.text }]} numberOfLines={1}>
                    {serviceLabel(s._id || s.serviceType)}
                  </Text>
                  <View style={styles.breakdownRight}>
                    <Text style={[styles.breakdownCount, { color: themeColors.textSecondary }]}>
                      {s.count ?? 0} {(s.count ?? 0) === 1 ? 'booking' : 'bookings'}
                    </Text>
                    <Text style={[styles.breakdownRevenue, { color: themeColors.text }]}>{money(s.revenue)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Top vehicles */}
          {topVehicles.length > 0 ? (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trophy-outline" size={20} color={colors.primary[500]} />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Top Vehicles</Text>
              </View>
              {topVehicles.map((v, i) => (
                <View key={v._id || v.title || i} style={[styles.breakdownRow, { borderBottomColor: themeColors.border }]}>
                  <View style={styles.rankWrap}>
                    <Text style={[styles.rankText, { color: colors.primary[600] }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.breakdownLabel, { color: themeColors.text }]} numberOfLines={1}>
                    {v.title || 'Vehicle'}
                  </Text>
                  <View style={styles.breakdownRight}>
                    <Text style={[styles.breakdownCount, { color: themeColors.textSecondary }]}>
                      {v.bookings ?? 0} trips
                    </Text>
                    <Text style={[styles.breakdownRevenue, { color: themeColors.text }]}>{money(v.revenue)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Drivers */}
          {drivers.length > 0 ? (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people-outline" size={20} color={colors.primary[500]} />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Drivers</Text>
              </View>
              {drivers.map((d, i) => (
                <View key={d._id || d.name || i} style={[styles.breakdownRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={[styles.breakdownLabel, { color: themeColors.text }]} numberOfLines={1}>
                    {d.name || 'Driver'}
                  </Text>
                  <View style={styles.breakdownRight}>
                    <Text style={[styles.breakdownCount, { color: themeColors.textSecondary }]}>
                      {d.totalTrips ?? 0} trips
                    </Text>
                    {(d.rating?.average ?? 0) > 0 ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={colors.warning} />
                        <Text style={[styles.breakdownRevenue, { color: themeColors.text }]}>
                          {(d.rating?.average ?? 0).toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
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

  // Period pills
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  periodPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodPillActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  periodText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  periodTextActive: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },

  scrollContent: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },

  // KPIs
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  kpiLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Sections
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Chart
  chartScroll: {
    paddingTop: spacing.sm,
    gap: spacing.md,
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    width: 56,
  },
  barValue: {
    fontSize: 10,
    marginBottom: 4,
  },
  barTrack: {
    width: 28,
    height: 120,
    borderRadius: borderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: borderRadius.sm,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  chartEmptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },

  // Breakdown rows
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  breakdownRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  breakdownCount: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  breakdownRevenue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rankWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
