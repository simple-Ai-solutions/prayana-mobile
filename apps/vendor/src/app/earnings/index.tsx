import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { makeAPICall, businessAPI, payoutAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningsData {
  availableBalance: number;
  pendingPayouts: number;
  totalEarnings: number;
  bankAccount?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
  payoutHistory: Array<{
    _id: string;
    amount: number;
    status: string;
    createdAt: string;
    reference?: string;
  }>;
}

const PAYOUT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: colors.successLight, text: colors.success },
  processing: { bg: colors.warningLight, text: colors.warning },
  pending: { bg: colors.infoLight, text: colors.info },
  failed: { bg: colors.errorLight, text: colors.error },
};

// ─── Payout Item ──────────────────────────────────────────────────────────────

function PayoutItem({
  payout,
  onPress,
}: {
  payout: EarningsData['payoutHistory'][0];
  onPress?: () => void;
}) {
  const statusColor = PAYOUT_STATUS_COLORS[payout.status] || PAYOUT_STATUS_COLORS.pending;
  const date = new Date(payout.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      style={styles.payoutItem}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.payoutLeft}>
        <View style={[styles.payoutIcon, { backgroundColor: statusColor.bg }]}>
          <Ionicons
            name={
              payout.status === 'completed'
                ? 'checkmark-circle'
                : payout.status === 'processing'
                ? 'time'
                : payout.status === 'failed'
                ? 'alert-circle'
                : 'arrow-up'
            }
            size={18}
            color={statusColor.text}
          />
        </View>
        <View>
          <Text style={styles.payoutAmount}>
            {'\u20B9'}{payout.amount.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.payoutDate}>{date}</Text>
          {payout.reference && (
            <Text style={styles.payoutRef}>{payout.reference}</Text>
          )}
        </View>
      </View>
      <View style={[styles.payoutStatusBadge, { backgroundColor: statusColor.bg }]}>
        <Text style={[styles.payoutStatusText, { color: statusColor.text }]}>
          {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      // Prefer the richer /payouts/business/* endpoints over /business/dashboard.
      // Run in parallel to keep the screen snappy on first load.
      const [summaryRes, historyRes, payoutCfgRes] = await Promise.all([
        payoutAPI.getPayoutSummary().catch(() => null),
        payoutAPI.getPayoutHistory({ limit: 30 }).catch(() => null),
        businessAPI.getPayoutConfig().catch(() => null),
      ]);

      const summary = summaryRes?.data || summaryRes;
      const history = historyRes?.data || historyRes?.payouts || [];
      const bank = payoutCfgRes?.data?.bankAccount || payoutCfgRes?.bankAccount;

      // Fallback: use /business/dashboard if summary endpoint hasn't shipped yet.
      if (!summary) {
        const dashRes = await businessAPI.getDashboard();
        const d = dashRes?.data || dashRes?.dashboard || dashRes;
        setData({
          availableBalance: d?.earnings?.available ?? d?.availableBalance ?? 0,
          pendingPayouts: d?.earnings?.pending ?? d?.pendingPayouts ?? 0,
          totalEarnings: d?.earnings?.total ?? d?.totalEarnings ?? d?.monthlyRevenue ?? 0,
          bankAccount: bank || null,
          payoutHistory: history.length ? history : (d?.payoutHistory || []),
        });
        return;
      }

      setData({
        availableBalance:
          summary?.availableBalance ?? summary?.balances?.available ?? 0,
        pendingPayouts:
          summary?.pendingPayouts ?? summary?.balances?.pending ?? 0,
        totalEarnings:
          summary?.totalEarnings ?? summary?.totalEarned ?? summary?.lifetime?.gross ?? 0,
        bankAccount: bank || null,
        payoutHistory: history,
      });
    } catch (err) {
      console.warn('[Earnings] fetch error:', err);
    }
  }, [businessAccount?._id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchEarnings();
    setLoading(false);
  }, [fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEarnings();
    setRefreshing(false);
  }, [fetchEarnings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRequestPayout = useCallback(async () => {
    setRequestingPayout(true);
    try {
      await makeAPICall('/business/me/payout/request', {
        method: 'POST',
      });
      Toast.show({ type: 'success', text1: 'Payout requested', text2: 'Processing will take 2-3 business days.' });
      await fetchEarnings();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Payout request failed', text2: err?.message });
    } finally {
      setRequestingPayout(false);
    }
  }, [fetchEarnings]);

  const maskedAccount = data?.bankAccount?.accountNumber
    ? `****${data.bankAccount.accountNumber.slice(-4)}`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading earnings..." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
          }
        >
          {/* Balance Card */}
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              {'\u20B9'}{(data?.availableBalance ?? 0).toLocaleString('en-IN')}
            </Text>

            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceItemLabel}>Pending</Text>
                <Text style={styles.balanceItemValue}>
                  {'\u20B9'}{(data?.pendingPayouts ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceItemLabel}>Total Earned</Text>
                <Text style={styles.balanceItemValue}>
                  {'\u20B9'}{(data?.totalEarnings ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <Button
              title="Request Payout"
              onPress={handleRequestPayout}
              size="lg"
              fullWidth
              loading={requestingPayout}
              disabled={(data?.availableBalance ?? 0) <= 0}
              style={styles.payoutBtn}
              icon={<Ionicons name="wallet-outline" size={20} color="#ffffff" />}
            />
          </Card>

          {/* Bank Account */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="business-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.sectionTitle}>Bank Account</Text>
            </View>

            {data?.bankAccount ? (
              <View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Bank</Text>
                  <Text style={styles.bankValue}>{data.bankAccount.bankName || '-'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Account</Text>
                  <Text style={styles.bankValue}>{maskedAccount || '-'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>IFSC</Text>
                  <Text style={styles.bankValue}>{data.bankAccount.ifscCode || '-'}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noBankWrap}>
                <Ionicons name="card-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.noBankText}>No bank account configured</Text>
                <Button
                  title="Add Bank Account"
                  onPress={() => router.push('/settings')}
                  variant="outline"
                  size="sm"
                  style={styles.noBankBtn}
                />
              </View>
            )}
          </Card>

          {/* Payout History */}
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>Payout History</Text>

            {!data?.payoutHistory || data.payoutHistory.length === 0 ? (
              <Card>
                <View style={styles.emptyHistory}>
                  <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} />
                  <Text style={styles.emptyHistoryText}>No payouts yet</Text>
                </View>
              </Card>
            ) : (
              <Card padding="sm">
                {data.payoutHistory.map((payout, i) => (
                  <React.Fragment key={payout._id}>
                    <PayoutItem
                      payout={payout}
                      onPress={() => router.push(`/earnings/${payout._id}`)}
                    />
                    {i < data.payoutHistory.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
              </Card>
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
  scrollContent: {
    padding: spacing.xl,
  },

  // Balance Card
  balanceCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  balanceAmount: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    width: '100%',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceItemLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  balanceItemValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  balanceDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  payoutBtn: {
    marginTop: spacing.xl,
  },

  // Bank Section
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
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bankLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  bankValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  noBankWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noBankText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  noBankBtn: {
    marginTop: spacing.md,
  },

  // History
  historySection: {
    marginBottom: spacing.lg,
  },
  historySectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  payoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  payoutDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  payoutRef: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  payoutStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  payoutStatusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyHistoryText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
