import React, { useState, useEffect, useCallback } from 'react';
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
import { Card, LoadingSpinner } from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
import { payoutAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommissionInfo {
  tier?: string;
  effectiveRate?: number;
  qualityScore?: number;
  source?: string;
  overrideExpiry?: string;
}

interface PayoutSummary {
  totalEarnings?: number;
  pendingPayouts?: number;
  heldPayouts?: number;
  completedPayouts?: number;
  totalGrossEarned?: number;
  totalGstOnCommission?: number;
  totalTdsDeducted?: number;
  commissionInfo?: CommissionInfo;
  nextPayout?: {
    netAmount?: number;
    grossAmount?: number;
    tdsAmount?: number;
    scheduledFor?: string;
    status?: string;
  };
}

interface PayoutRecord {
  _id: string;
  status: string;
  payoutReference?: string;
  holdUntil?: string;
  bookingId?: {
    bookingReference?: string;
    bookingDate?: string;
    activitySnapshot?: { title?: string };
  };
  amounts?: {
    customerPaid?: number;
    commissionPercent?: number;
    commissionAmount?: number;
    gstOnCommissionPercent?: number;
    gstOnCommissionAmount?: number;
    tdsPercent?: number;
    tdsAmount?: number;
    netPayout?: number;
    commissionSource?: string;
  };
}

interface HistoryState {
  payouts: PayoutRecord[];
  pagination: { totalPages?: number; page?: number };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

// No `purple` token in the shared theme — local accents for TDS / scheduled.
const PURPLE = '#7c3aed';
const PURPLE_LIGHT = '#f3e8ff';
const EMERALD = '#059669';
const EMERALD_LIGHT = '#d1fae5';
const RED = colors.error;
const ORANGE_ACCENT = '#ea580c'; // TDS accent (matches PWA orange callout, non-brand)
const ORANGE_LIGHT = '#ffedd5';

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  platinum: { bg: '#f3f4f6', text: '#374151', label: 'Platinum' },
  gold: { bg: '#fffbeb', text: '#b45309', label: 'Gold' },
  silver: { bg: '#f8fafc', text: '#475569', label: 'Silver' },
  bronze: { bg: colors.primary[50], text: colors.primary[700], label: 'Bronze' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  created: { bg: colors.primary[50], text: colors.primary[700], icon: 'time-outline' },
  held: { bg: colors.warningLight, text: '#a16207', icon: 'shield-outline' },
  scheduled: { bg: colors.primary[50], text: colors.primary[700], icon: 'calendar-outline' },
  processing: { bg: PURPLE_LIGHT, text: PURPLE, icon: 'refresh-outline' },
  completed: { bg: colors.successLight, text: colors.success, icon: 'checkmark-circle' },
  failed: { bg: colors.errorLight, text: colors.error, icon: 'close-circle' },
  cancelled: { bg: colors.backgroundSecondary, text: colors.textTertiary, icon: 'close-circle' },
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'held', label: 'Held' },
  { value: 'processing', label: 'Processing' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Backend stores money in paisa. Mirror the PWA's formatINR.
function formatINR(paisa?: number): string {
  if (paisa === undefined || paisa === null) return '—';
  return (
    '₹' +
    (paisa / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatCountdown(holdUntil?: string): string | null {
  if (!holdUntil) return null;
  const diff = new Date(holdUntil).getTime() - Date.now();
  if (diff <= 0) return 'Ready';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Payout Row (expandable) ────────────────────────────────────────────────────

function PayoutRow({
  payout,
  expanded,
  onToggle,
  onOpenDetail,
}: {
  payout: PayoutRecord;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}) {
  const statusStyle = STATUS_STYLES[payout.status] || STATUS_STYLES.created;
  const countdown = payout.status === 'held' ? formatCountdown(payout.holdUntil) : null;
  const a = payout.amounts || {};
  const title =
    payout.bookingId?.activitySnapshot?.title || payout.payoutReference || 'Payout';

  return (
    <View style={styles.payoutCard}>
      <TouchableOpacity
        style={styles.payoutHeader}
        activeOpacity={0.7}
        onPress={onToggle}
      >
        <View style={styles.payoutHeaderLeft}>
          <View style={[styles.payoutIcon, { backgroundColor: statusStyle.bg }]}>
            <Ionicons name={statusStyle.icon} size={18} color={statusStyle.text} />
          </View>
          <View style={styles.payoutHeaderText}>
            <Text style={styles.payoutTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.payoutRef} numberOfLines={1}>
              {payout.payoutReference}
              {payout.bookingId?.bookingReference
                ? ` · ${payout.bookingId.bookingReference}`
                : ''}
            </Text>
          </View>
        </View>
        <View style={styles.payoutHeaderRight}>
          {countdown && (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
          <View style={styles.payoutAmounts}>
            <Text style={styles.payoutNet}>{formatINR(a.netPayout)}</Text>
            <Text style={styles.payoutComm}>{a.commissionPercent}% comm</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={colors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.payoutDetail}>
          <View style={styles.breakdownGrid}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Customer Paid</Text>
              <Text style={styles.breakdownValue}>{formatINR(a.customerPaid)}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>
                Commission ({a.commissionPercent}%)
              </Text>
              <Text style={[styles.breakdownValue, styles.negative]}>
                -{formatINR(a.commissionAmount)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>
                GST on Comm. ({a.gstOnCommissionPercent || 18}%)
              </Text>
              <Text style={[styles.breakdownValue, styles.negative]}>
                -{formatINR(a.gstOnCommissionAmount || 0)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>
                TDS ({a.tdsPercent}% of gross)
              </Text>
              <Text style={[styles.breakdownValue, styles.negative]}>
                -{formatINR(a.tdsAmount)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Net Payout</Text>
              <Text style={[styles.breakdownValue, styles.positive]}>
                {formatINR(a.netPayout)}
              </Text>
            </View>
          </View>

          {payout.bookingId?.bookingDate && (
            <Text style={styles.activityDate}>
              Activity Date: {formatDate(payout.bookingId.bookingDate)}
            </Text>
          )}

          <View style={styles.tagRow}>
            <View style={[styles.statusTag, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusTagText, { color: statusStyle.text }]}>
                {payout.status}
              </Text>
            </View>
            {a.commissionSource === 'manual_override' && (
              <View style={[styles.statusTag, { backgroundColor: PURPLE_LIGHT }]}>
                <Text style={[styles.statusTagText, { color: PURPLE }]}>
                  Custom Rate
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.detailLink} onPress={onOpenDetail}>
              <Ionicons name="open-outline" size={13} color={colors.primary[500]} />
              <Text style={styles.detailLinkText}>Details</Text>
            </TouchableOpacity>
          </View>

          {payout.status === 'scheduled' && (
            <View style={styles.scheduledNote}>
              <Ionicons name="warning-outline" size={16} color={'#b45309'} />
              <Text style={styles.scheduledNoteText}>
                Awaiting platform processing — our finance team will process this
                transfer within 1-2 business days. Contact support if it stays in
                this state longer.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [history, setHistory] = useState<HistoryState>({ payouts: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res: any = await payoutAPI.getPayoutSummary();
      if (res?.success) setSummary(res.data);
      else if (res?.data) setSummary(res.data);
    } catch (err) {
      console.warn('[Earnings] summary error:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res: any = await payoutAPI.getPayoutHistory({
        status: statusFilter || undefined,
        page,
        limit: 15,
      });
      if (res?.success) setHistory(res.data);
      else if (res?.data) setHistory(res.data);
    } catch (err) {
      console.warn('[Earnings] history error:', err);
    }
    setHistoryLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchSummary();
      setLoading(false);
    })();
  }, [fetchSummary]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchSummary(), fetchHistory()]);
    setRefreshing(false);
  }, [fetchSummary, fetchHistory]);

  const ci = summary?.commissionInfo || {};
  const tierStyle = TIER_STYLES[ci.tier || 'bronze'] || TIER_STYLES.bronze;

  const stats = [
    {
      label: 'Total Earnings',
      value: formatINR(summary?.totalEarnings),
      icon: 'cash-outline' as const,
      iconBg: colors.successLight,
      iconColor: colors.success,
    },
    {
      label: 'Pending',
      value: formatINR(summary?.pendingPayouts),
      icon: 'time-outline' as const,
      iconBg: colors.primary[50],
      iconColor: colors.primary[600],
    },
    {
      label: 'Held (48h)',
      value: formatINR(summary?.heldPayouts),
      icon: 'shield-outline' as const,
      iconBg: colors.warningLight,
      iconColor: '#a16207',
    },
    {
      label: 'Completed',
      value: formatINR(summary?.completedPayouts),
      icon: 'checkmark-circle-outline' as const,
      iconBg: colors.successLight,
      iconColor: colors.success,
    },
  ];

  const totalPages = history.pagination?.totalPages || 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Earnings Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your payouts and commission</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading earnings..." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
        >
          {/* Tier badge */}
          <View style={[styles.tierBadge, { backgroundColor: tierStyle.bg }]}>
            <View style={styles.tierIcon}>
              <Ionicons name="ribbon" size={16} color="#ffffff" />
            </View>
            <Text style={[styles.tierLabel, { color: tierStyle.text }]}>
              {tierStyle.label}
            </Text>
            <Text style={[styles.tierRate, { color: tierStyle.text }]}>
              {ci.source === 'manual_override'
                ? `Custom: ${ci.effectiveRate}%`
                : `${ci.effectiveRate ?? 0}%`}
            </Text>
          </View>

          {/* Stat cards */}
          <View style={styles.statGrid}>
            {stats.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </View>

          {/* Next Payout ETA */}
          {summary?.nextPayout && (
            <View style={styles.nextPayoutCard}>
              <View style={styles.nextPayoutIcon}>
                <Ionicons name="calendar" size={20} color="#ffffff" />
              </View>
              <View style={styles.nextPayoutBody}>
                <Text style={styles.nextPayoutTitle}>
                  Next Payout: {formatINR(summary.nextPayout.netAmount)}
                </Text>
                <Text style={styles.nextPayoutSub}>
                  {summary.nextPayout.scheduledFor
                    ? `Scheduled for ${formatDate(summary.nextPayout.scheduledFor)}`
                    : 'Pending — once cleared, will auto-schedule'}
                  {'  ·  Status: '}
                  <Text style={styles.nextPayoutStatus}>
                    {summary.nextPayout.status}
                  </Text>
                </Text>
                {(summary.nextPayout.tdsAmount ?? 0) > 0 && (
                  <Text style={styles.nextPayoutBreakdown}>
                    Gross {formatINR(summary.nextPayout.grossAmount)} − TDS{' '}
                    {formatINR(summary.nextPayout.tdsAmount)} = Net{' '}
                    {formatINR(summary.nextPayout.netAmount)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Lifetime breakdown */}
          {(summary?.totalTdsDeducted ?? 0) > 0 && (
            <View style={styles.lifetimeGrid}>
              <View style={styles.lifetimeTile}>
                <Text style={styles.lifetimeLabel}>Gross Earned (Lifetime)</Text>
                <Text style={styles.lifetimeValue}>
                  {formatINR(summary?.totalGrossEarned)}
                </Text>
                <Text style={styles.lifetimeHint}>Before commission, GST &amp; TDS</Text>
              </View>
              <View style={[styles.lifetimeTile, { backgroundColor: colors.primary[50] }]}>
                <Text style={[styles.lifetimeLabel, { color: colors.primary[700] }]}>
                  GST on Commission
                </Text>
                <Text style={[styles.lifetimeValue, { color: colors.primary[700] }]}>
                  {formatINR(summary?.totalGstOnCommission || 0)}
                </Text>
                <Text style={[styles.lifetimeHint, { color: colors.primary[600] }]}>
                  18% on platform fee
                </Text>
              </View>
              <View style={[styles.lifetimeTile, { backgroundColor: ORANGE_LIGHT }]}>
                <Text style={[styles.lifetimeLabel, { color: ORANGE_ACCENT }]}>
                  TDS Deducted
                </Text>
                <Text style={[styles.lifetimeValue, { color: ORANGE_ACCENT }]}>
                  {formatINR(summary?.totalTdsDeducted)}
                </Text>
                <Text style={[styles.lifetimeHint, { color: ORANGE_ACCENT }]}>
                  Section 194-O · 1% of gross
                </Text>
              </View>
              <View style={[styles.lifetimeTile, { backgroundColor: EMERALD_LIGHT }]}>
                <Text style={[styles.lifetimeLabel, { color: EMERALD }]}>
                  Net to Bank (Lifetime)
                </Text>
                <Text style={[styles.lifetimeValue, { color: EMERALD }]}>
                  {formatINR(summary?.totalEarnings)}
                </Text>
                <Text style={[styles.lifetimeHint, { color: EMERALD }]}>
                  After all deductions
                </Text>
              </View>
            </View>
          )}

          {/* Commission info callout */}
          <View style={styles.commissionCallout}>
            <View style={styles.commissionTextWrap}>
              <Text style={styles.commissionTitle}>
                {ci.source === 'manual_override'
                  ? `Special Rate: ${ci.effectiveRate}%`
                  : `Your commission rate: ${ci.effectiveRate ?? 0}% (${tierStyle.label} tier)`}
              </Text>
              <Text style={styles.commissionSub}>
                Quality score: {ci.qualityScore || 0}/100.
                {ci.tier !== 'platinum' &&
                  ' Improve your score to unlock lower commission rates!'}
              </Text>
            </View>
            {ci.tier !== 'platinum' && (
              <View style={styles.nextTierWrap}>
                <Ionicons name="arrow-up" size={14} color={colors.primary[600]} />
                <Text style={styles.nextTierText}>Next tier</Text>
              </View>
            )}
          </View>

          {/* Payout History */}
          <View style={styles.historySection}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historyTitle}>Payout History</Text>
              <Ionicons name="filter" size={16} color={colors.textTertiary} />
            </View>

            {/* Status filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value;
                return (
                  <TouchableOpacity
                    key={f.value || 'all'}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => {
                      setStatusFilter(f.value);
                      setPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && styles.filterChipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {historyLoading ? (
              <View style={styles.historyLoading}>
                <LoadingSpinner message="Loading..." />
              </View>
            ) : history.payouts.length === 0 ? (
              <Card>
                <View style={styles.emptyHistory}>
                  <Ionicons
                    name="cash-outline"
                    size={36}
                    color={colors.textTertiary}
                  />
                  <Text style={styles.emptyHistoryTitle}>No payouts yet</Text>
                  <Text style={styles.emptyHistorySub}>
                    Payouts will appear here after your activities are completed.
                  </Text>
                </View>
              </Card>
            ) : (
              <View style={styles.payoutList}>
                {history.payouts.map((p) => (
                  <PayoutRow
                    key={p._id}
                    payout={p}
                    expanded={expandedPayout === p._id}
                    onToggle={() =>
                      setExpandedPayout(expandedPayout === p._id ? null : p._id)
                    }
                    onOpenDetail={() => router.push(`/earnings/${p._id}`)}
                  />
                ))}
              </View>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  Page {page} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    page >= totalPages && styles.pageBtnDisabled,
                  ]}
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

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
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
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
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: spacing.xl,
  },

  // Tier badge
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  tierIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  tierRate: {
    fontSize: fontSize.xs,
    opacity: 0.8,
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Next payout
  nextPayoutCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: EMERALD_LIGHT,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  nextPayoutIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPayoutBody: {
    flex: 1,
  },
  nextPayoutTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#065f46',
  },
  nextPayoutSub: {
    fontSize: fontSize.xs,
    color: '#047857',
    marginTop: 2,
  },
  nextPayoutStatus: {
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  nextPayoutBreakdown: {
    fontSize: fontSize.xs,
    color: '#059669',
    marginTop: 3,
  },

  // Lifetime breakdown
  lifetimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  lifetimeTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  lifetimeLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  lifetimeValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  lifetimeHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Commission callout
  commissionCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  commissionTextWrap: {
    flex: 1,
  },
  commissionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[800],
  },
  commissionSub: {
    fontSize: fontSize.xs,
    color: colors.primary[600],
    marginTop: 3,
  },
  nextTierWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: spacing.sm,
  },
  nextTierText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },

  // History
  historySection: {
    marginBottom: spacing.lg,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  filterRow: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  filterChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  historyLoading: {
    paddingVertical: spacing.xl,
  },
  payoutList: {
    gap: spacing.sm,
  },

  // Payout card
  payoutCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  payoutHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  payoutIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  payoutTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  payoutRef: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  payoutHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countdownBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  countdownText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: '#a16207',
  },
  payoutAmounts: {
    alignItems: 'flex-end',
  },
  payoutNet: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  payoutComm: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Payout detail (expanded)
  payoutDetail: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  breakdownItem: {
    flexBasis: '30%',
    flexGrow: 1,
  },
  breakdownLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: 2,
  },
  negative: {
    color: RED,
  },
  positive: {
    color: colors.success,
    fontWeight: fontWeight.bold,
  },
  activityDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusTagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'capitalize',
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
  },
  detailLinkText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },
  scheduledNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  scheduledNoteText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#92400e',
    lineHeight: 16,
  },

  // Empty state
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyHistoryTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyHistorySub: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  pageBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  pageInfo: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
