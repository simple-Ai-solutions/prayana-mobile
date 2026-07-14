import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  Button,
  StatusBadge,
  EmptyState,
  LoadingSpinner,
  useTheme,
} from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
import { payoutAPI, businessAPI } from '@prayana/shared-services';

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'earnings' | 'payout';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

interface CommissionInfo {
  tier?: string;
  effectiveRate?: number; // percent
}

interface NextPayout {
  netAmount?: number;
  scheduledFor?: string;
  tdsAmount?: number;
}

interface Summary {
  totalEarnings: number;
  pendingPayouts: number;
  heldPayouts: number;
  commissionInfo: CommissionInfo;
  nextPayout: NextPayout | null;
}

interface PayoutRow {
  _id: string;
  status: string;
  createdAt?: string;
  scheduledFor?: string;
  amounts: {
    customerPaid?: number;
    commissionAmount?: number;
    tdsAmount?: number;
    netPayout?: number;
  };
}

interface PayoutConfig {
  isPayoutConfigured?: boolean;
  method?: 'bank_transfer' | 'upi';
  bankDetails?: {
    accountHolderName?: string;
    accountNumber?: string;
    maskedAccountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
  };
  upiId?: string;
  razorpayRoute?: {
    status?: string;
    lastError?: string;
  };
}

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const RUPEE = '₹';

function money(n: number | undefined | null): string {
  return `${RUPEE}${Number(n ?? 0).toLocaleString('en-IN')}`;
}

function parseSummary(raw: any): Summary {
  const p = raw?.data ?? raw?.summary ?? raw ?? {};
  const commission = p.commissionInfo ?? p.commission ?? {};
  const next = p.nextPayout ?? p.next ?? null;
  return {
    totalEarnings: Number(p.totalEarnings ?? p.totalEarned ?? p.lifetime?.gross ?? 0),
    pendingPayouts: Number(p.pendingPayouts ?? p.pending ?? 0),
    heldPayouts: Number(p.heldPayouts ?? p.held ?? p.onHold ?? 0),
    commissionInfo: {
      tier: commission.tier ?? commission.level ?? undefined,
      effectiveRate:
        commission.effectiveRate != null
          ? Number(commission.effectiveRate)
          : commission.rate != null
          ? Number(commission.rate)
          : undefined,
    },
    nextPayout: next
      ? {
          netAmount: Number(next.netAmount ?? next.amount ?? 0),
          scheduledFor: next.scheduledFor ?? next.date ?? undefined,
          tdsAmount: Number(next.tdsAmount ?? next.tds ?? 0),
        }
      : null,
  };
}

function parseHistory(raw: any): PayoutRow[] {
  const list = raw?.data ?? raw?.payouts ?? raw?.history ?? raw ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((it: any, i: number) => {
    const amounts = it.amounts ?? it.breakdown ?? {};
    return {
      _id: String(it._id ?? it.id ?? `payout-${i}`),
      status: String(it.status ?? 'pending'),
      createdAt: it.createdAt ?? it.requestedAt ?? undefined,
      scheduledFor: it.scheduledFor ?? undefined,
      amounts: {
        customerPaid: Number(amounts.customerPaid ?? it.customerPaid ?? 0),
        commissionAmount: Number(amounts.commissionAmount ?? it.commissionAmount ?? 0),
        tdsAmount: Number(amounts.tdsAmount ?? it.tdsAmount ?? 0),
        netPayout: Number(amounts.netPayout ?? it.netPayout ?? it.amount ?? 0),
      },
    };
  });
}

function maskAccountNumber(accNum?: string): string {
  if (!accNum || accNum.length < 4) return accNum ?? '—';
  return 'X'.repeat(Math.max(0, accNum.length - 4)) + ' ' + accNum.slice(-4);
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: themeColors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: tint + '15' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={[styles.statValue, { color: themeColors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function PayoutRowCard({
  row,
  onPress,
}: {
  row: PayoutRow;
  onPress: () => void;
}) {
  const { themeColors } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <Card style={styles.payoutCard}>
        <View style={styles.payoutHead}>
          <View>
            <Text style={[styles.payoutNet, { color: themeColors.text }]}>
              {money(row.amounts.netPayout)}
            </Text>
            <Text style={[styles.payoutDate, { color: themeColors.textTertiary }]}>
              {formatDate(row.scheduledFor || row.createdAt) || 'Pending schedule'}
            </Text>
          </View>
          <StatusBadge status={row.status} />
        </View>

        <View style={[styles.payoutBreakdown, { borderTopColor: themeColors.border }]}>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownLabel, { color: themeColors.textTertiary }]}>
              Customer paid
            </Text>
            <Text style={[styles.breakdownValue, { color: themeColors.textSecondary }]}>
              {money(row.amounts.customerPaid)}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownLabel, { color: themeColors.textTertiary }]}>
              Commission
            </Text>
            <Text style={[styles.breakdownValue, { color: themeColors.textSecondary }]}>
              -{money(row.amounts.commissionAmount)}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownLabel, { color: themeColors.textTertiary }]}>TDS</Text>
            <Text style={[styles.breakdownValue, { color: themeColors.textSecondary }]}>
              -{money(row.amounts.tdsAmount)}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function FinanceScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [tab, setTab] = useState<Tab>('earnings');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [payoutConfig, setPayoutConfig] = useState<PayoutConfig | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);

  const loadPayoutConfig = useCallback(async () => {
    setPayoutLoading(true);
    try {
      const res: any = await businessAPI.getPayoutConfig().catch(() => null);
      if (res?.success) {
        setPayoutConfig(res.data ?? null);
      } else if (res?.data) {
        setPayoutConfig(res.data);
      }
    } catch (err: any) {
      console.warn('[Finance] payout config error:', err?.message);
    } finally {
      setPayoutLoading(false);
    }
  }, []);

  const fetchData = useCallback(
    async (status: StatusFilter) => {
      try {
        const [summaryRes, historyRes] = await Promise.all([
          payoutAPI.getPayoutSummary().catch(() => null),
          payoutAPI
            .getPayoutHistory({ status, limit: 50, page: 1 })
            .catch(() => null),
        ]);
        if (summaryRes) setSummary(parseSummary(summaryRes));
        setHistory(parseHistory(historyRes));
      } catch (err: any) {
        console.warn('[Finance] fetch error:', err?.message);
      }
    },
    [],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchData(statusFilter);
    setLoading(false);
  }, [fetchData, statusFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(statusFilter);
    setRefreshing(false);
  }, [fetchData, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load payout config lazily the first time the Payout Settings tab opens.
  useEffect(() => {
    if (tab === 'payout' && payoutConfig === null && payoutLoading) {
      loadPayoutConfig();
    }
  }, [tab, payoutConfig, payoutLoading, loadPayoutConfig]);

  const nextPayoutLabel = useMemo(() => {
    const d = summary?.nextPayout?.scheduledFor;
    return d ? formatDate(d) : null;
  }, [summary?.nextPayout?.scheduledFor]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Finance</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
        ]}
      >
        {(
          [
            { key: 'earnings', label: 'Earnings' },
            { key: 'payout', label: 'Payout Settings' },
          ] as { key: Tab; label: string }[]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary[500] : themeColors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'payout' ? (
        payoutLoading ? (
          <LoadingSpinner fullScreen message="Loading payout settings..." />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await loadPayoutConfig();
                  setRefreshing(false);
                }}
                tintColor={colors.primary[500]}
              />
            }
          >
            {/* Header card */}
            <Card style={styles.payoutHeaderCard}>
              <View style={styles.payoutHeaderRow}>
                <View style={styles.payoutHeaderIcon}>
                  <Ionicons name="wallet-outline" size={22} color={colors.primary[500]} />
                </View>
                <View style={styles.payoutHeaderText}>
                  <Text style={[styles.payoutHeaderTitle, { color: themeColors.text }]}>
                    Payout Settings
                  </Text>
                  <Text
                    style={[styles.payoutHeaderSub, { color: themeColors.textSecondary }]}
                  >
                    Manage how you receive your earnings from bookings
                  </Text>
                </View>
              </View>
              <Button
                title={payoutConfig?.isPayoutConfigured ? 'Edit' : 'Set Up'}
                onPress={() => router.push('/payout')}
                size="md"
                fullWidth
                style={styles.payoutEditBtn}
                icon={
                  <Ionicons name="create-outline" size={18} color="#ffffff" />
                }
              />
            </Card>

            {payoutConfig?.isPayoutConfigured ? (
              <Card style={styles.payoutDetailCard}>
                {/* Active badge */}
                <View style={styles.activeRow}>
                  <View style={styles.activeBadge}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                  <Text
                    style={[styles.activeCaption, { color: themeColors.textSecondary }]}
                  >
                    Payouts are configured and ready
                  </Text>
                </View>

                {/* Method details */}
                {payoutConfig.method === 'bank_transfer' && payoutConfig.bankDetails ? (
                  <View style={styles.methodBlock}>
                    <View style={styles.methodHead}>
                      <Ionicons name="card-outline" size={18} color={colors.primary[500]} />
                      <Text style={[styles.methodTitle, { color: themeColors.text }]}>
                        Bank Transfer
                      </Text>
                    </View>
                    <View style={styles.detailGrid}>
                      <View
                        style={[styles.detailTile, { backgroundColor: themeColors.backgroundSecondary }]}
                      >
                        <Text
                          style={[styles.detailLabel, { color: themeColors.textTertiary }]}
                        >
                          Account Holder
                        </Text>
                        <Text style={[styles.detailValue, { color: themeColors.text }]}>
                          {payoutConfig.bankDetails.accountHolderName || '—'}
                        </Text>
                      </View>
                      <View
                        style={[styles.detailTile, { backgroundColor: themeColors.backgroundSecondary }]}
                      >
                        <Text
                          style={[styles.detailLabel, { color: themeColors.textTertiary }]}
                        >
                          Account Number
                        </Text>
                        <Text
                          style={[styles.detailValueMono, { color: themeColors.text }]}
                        >
                          {payoutConfig.bankDetails.maskedAccountNumber ||
                            maskAccountNumber(payoutConfig.bankDetails.accountNumber)}
                        </Text>
                      </View>
                      <View
                        style={[styles.detailTile, { backgroundColor: themeColors.backgroundSecondary }]}
                      >
                        <Text
                          style={[styles.detailLabel, { color: themeColors.textTertiary }]}
                        >
                          IFSC Code
                        </Text>
                        <Text
                          style={[styles.detailValueMono, { color: themeColors.text }]}
                        >
                          {payoutConfig.bankDetails.ifscCode || '—'}
                        </Text>
                      </View>
                      <View
                        style={[styles.detailTile, { backgroundColor: themeColors.backgroundSecondary }]}
                      >
                        <Text
                          style={[styles.detailLabel, { color: themeColors.textTertiary }]}
                        >
                          Bank
                        </Text>
                        <Text style={[styles.detailValue, { color: themeColors.text }]}>
                          {payoutConfig.bankDetails.bankName || '—'}
                        </Text>
                        {payoutConfig.bankDetails.branchName ? (
                          <Text
                            style={[styles.detailSub, { color: themeColors.textTertiary }]}
                          >
                            {payoutConfig.bankDetails.branchName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : null}

                {payoutConfig.method === 'upi' ? (
                  <View style={styles.methodBlock}>
                    <View style={styles.methodHead}>
                      <Ionicons name="phone-portrait-outline" size={18} color={colors.primary[500]} />
                      <Text style={[styles.methodTitle, { color: themeColors.text }]}>
                        UPI
                      </Text>
                    </View>
                    <View
                      style={[styles.detailTile, { backgroundColor: themeColors.backgroundSecondary }]}
                    >
                      <Text
                        style={[styles.detailLabel, { color: themeColors.textTertiary }]}
                      >
                        UPI ID
                      </Text>
                      <Text style={[styles.detailValueMono, { color: themeColors.text }]}>
                        {payoutConfig.upiId || '—'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Razorpay Route auto-payout status (bank_transfer only) */}
                {payoutConfig.method === 'bank_transfer' && payoutConfig.razorpayRoute
                  ? (() => {
                      const st = payoutConfig.razorpayRoute?.status;
                      const err = payoutConfig.razorpayRoute?.lastError;
                      if (st === 'active') {
                        return (
                          <View style={[styles.notice, styles.noticeSuccess]}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                            <View style={styles.noticeBody}>
                              <Text style={[styles.noticeTitle, { color: colors.success }]}>
                                Automated payouts active
                              </Text>
                              <Text style={[styles.noticeText, { color: themeColors.textSecondary }]}>
                                Earnings transfer directly to your bank after the 48h hold
                                via Razorpay.
                              </Text>
                            </View>
                          </View>
                        );
                      }
                      if (st === 'failed') {
                        return (
                          <View style={[styles.notice, styles.noticeWarning]}>
                            <Ionicons name="alert-circle" size={18} color={colors.warning} />
                            <View style={styles.noticeBody}>
                              <Text style={[styles.noticeTitle, { color: colors.warning }]}>
                                Auto-payout setup needs attention
                              </Text>
                              <Text style={[styles.noticeText, { color: themeColors.textSecondary }]}>
                                Your bank details are saved, but Razorpay registration
                                failed{err ? `: ${err}` : ''}. Your payouts will be processed
                                manually by the team until this is resolved.
                              </Text>
                            </View>
                          </View>
                        );
                      }
                      if (st === 'skipped' || st === 'not_registered') {
                        return (
                          <View style={[styles.notice, styles.noticeInfo]}>
                            <Ionicons name="information-circle" size={18} color={colors.info} />
                            <View style={styles.noticeBody}>
                              <Text style={[styles.noticeTitle, { color: colors.info }]}>
                                Manual payouts
                              </Text>
                              <Text style={[styles.noticeText, { color: themeColors.textSecondary }]}>
                                Earnings will be transferred manually by our finance team
                                after the 48h hold. Automated payouts will activate once
                                platform setup is complete.
                              </Text>
                            </View>
                          </View>
                        );
                      }
                      return null;
                    })()
                  : null}

                {/* How payouts work */}
                <View style={[styles.notice, styles.noticeInfo]}>
                  <Ionicons name="information-circle" size={18} color={colors.info} />
                  <View style={styles.noticeBody}>
                    <Text style={[styles.noticeTitle, { color: colors.info }]}>
                      How payouts work
                    </Text>
                    <Text style={[styles.noticeBullet, { color: themeColors.textSecondary }]}>
                      • Payouts are processed after a 48-hour hold post activity completion
                    </Text>
                    <Text style={[styles.noticeBullet, { color: themeColors.textSecondary }]}>
                      • Platform commission is deducted automatically based on your quality
                      tier
                    </Text>
                    <Text style={[styles.noticeBullet, { color: themeColors.textSecondary }]}>
                      • Bank transfers take 2-3 business days; UPI is near-instant
                    </Text>
                  </View>
                </View>
              </Card>
            ) : (
              /* Not configured */
              <Card style={styles.payoutPrompt}>
                <View style={styles.payoutPromptIconWarn}>
                  <Ionicons name="alert-circle-outline" size={30} color={colors.warning} />
                </View>
                <Text style={[styles.payoutPromptTitle, { color: themeColors.text }]}>
                  Payout not configured
                </Text>
                <Text style={[styles.payoutPromptText, { color: themeColors.textSecondary }]}>
                  Set up your bank account or UPI to start receiving earnings from your
                  bookings. You won't receive payouts until this is configured.
                </Text>
                <Button
                  title="Set Up Payout"
                  onPress={() => router.push('/payout')}
                  size="lg"
                  fullWidth
                  style={styles.payoutPromptBtn}
                  icon={<Ionicons name="arrow-forward" size={20} color="#ffffff" />}
                />
              </Card>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )
      ) : loading ? (
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
          {/* Total earnings hero */}
          <Card style={styles.heroCard}>
            <Text style={[styles.heroLabel, { color: themeColors.textSecondary }]}>
              Total Earnings
            </Text>
            <Text style={[styles.heroValue, { color: themeColors.text }]}>
              {money(summary?.totalEarnings)}
            </Text>
            {summary?.commissionInfo?.tier || summary?.commissionInfo?.effectiveRate != null ? (
              <View style={[styles.commissionBadge, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="pricetag-outline" size={13} color={colors.primary[600]} />
                <Text style={styles.commissionText}>
                  {summary?.commissionInfo?.tier ? `${summary.commissionInfo.tier} · ` : ''}
                  {summary?.commissionInfo?.effectiveRate != null
                    ? `${summary.commissionInfo.effectiveRate}% commission`
                    : 'commission'}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Stat row */}
          <View style={styles.statRow}>
            <StatCard
              label="Pending"
              value={money(summary?.pendingPayouts)}
              icon="time-outline"
              tint={colors.warning}
            />
            <StatCard
              label="On Hold"
              value={money(summary?.heldPayouts)}
              icon="lock-closed-outline"
              tint={colors.info}
            />
          </View>

          {/* Next payout */}
          {summary?.nextPayout ? (
            <Card style={styles.nextCard}>
              <View style={styles.nextHeader}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                <Text style={[styles.nextTitle, { color: themeColors.text }]}>Next Payout</Text>
              </View>
              <View style={styles.nextRow}>
                <Text style={[styles.nextLabel, { color: themeColors.textSecondary }]}>
                  Net amount
                </Text>
                <Text style={[styles.nextValue, { color: themeColors.text }]}>
                  {money(summary.nextPayout.netAmount)}
                </Text>
              </View>
              {summary.nextPayout.tdsAmount ? (
                <View style={styles.nextRow}>
                  <Text style={[styles.nextLabel, { color: themeColors.textSecondary }]}>
                    TDS deducted
                  </Text>
                  <Text style={[styles.nextValue, { color: themeColors.text }]}>
                    {money(summary.nextPayout.tdsAmount)}
                  </Text>
                </View>
              ) : null}
              {nextPayoutLabel ? (
                <View style={styles.nextRow}>
                  <Text style={[styles.nextLabel, { color: themeColors.textSecondary }]}>
                    Scheduled for
                  </Text>
                  <Text style={[styles.nextValue, { color: themeColors.text }]}>
                    {nextPayoutLabel}
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* History */}
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Payout History</Text>

          {/* Status filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setStatusFilter(f.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.primary[500] : themeColors.surface,
                      borderColor: active ? colors.primary[500] : themeColors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: active ? '#fff' : themeColors.textSecondary },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {history.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="receipt-outline" size={48} color={colors.gray[300]} />}
              title="No payouts yet"
              description="Completed payouts will appear here once your bookings settle."
            />
          ) : (
            <View style={styles.historyList}>
              {history.map((row) => (
                <PayoutRowCard
                  key={row._id}
                  row={row}
                  onPress={() => router.push(`/earnings/${row._id}`)}
                />
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    borderRadius: 1,
    backgroundColor: colors.primary[500],
  },

  scrollContent: {
    padding: spacing.xl,
  },

  // Hero
  heroCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroLabel: {
    fontSize: fontSize.sm,
  },
  heroValue: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  commissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  commissionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },

  // Stats
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Next payout
  nextCard: {
    marginBottom: spacing.lg,
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nextTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  nextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  nextLabel: {
    fontSize: fontSize.sm,
  },
  nextValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // History
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  historyList: {
    gap: spacing.md,
  },
  payoutCard: {
    padding: spacing.lg,
  },
  payoutHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutNet: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  payoutDate: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  payoutBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: fontSize.xs,
  },
  breakdownValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
  },

  // Payout Settings tab — header card
  payoutHeaderCard: {
    marginBottom: spacing.lg,
  },
  payoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  payoutHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutHeaderText: {
    flex: 1,
  },
  payoutHeaderTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  payoutHeaderSub: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  payoutEditBtn: {
    marginTop: spacing.lg,
  },

  // Payout Settings tab — detail card
  payoutDetailCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success + '1A',
  },
  activeBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  activeCaption: {
    fontSize: fontSize.xs,
    flexShrink: 1,
  },
  methodBlock: {
    gap: spacing.md,
  },
  methodHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailTile: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  detailLabel: {
    fontSize: fontSize.xs,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  detailValueMono: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  detailSub: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Notices (auto-payout status + how payouts work)
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  noticeBody: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  noticeBullet: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  noticeSuccess: {
    backgroundColor: colors.success + '14',
    borderColor: colors.success + '33',
  },
  noticeWarning: {
    backgroundColor: colors.warning + '14',
    borderColor: colors.warning + '33',
  },
  noticeInfo: {
    backgroundColor: colors.info + '14',
    borderColor: colors.info + '33',
  },

  // Payout tab prompt (not configured)
  payoutPrompt: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  payoutPromptIconWarn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  payoutPromptTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  payoutPromptText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  payoutPromptBtn: {
    marginTop: spacing.xl,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
