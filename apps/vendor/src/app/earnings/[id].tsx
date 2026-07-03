import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Badge,
  colors,
  spacing,
  fontSize,
  fontWeight,
} from '@prayana/shared-ui';
import { payoutAPI } from '@prayana/shared-services';

type Payout = {
  _id: string;
  amount: number;
  netAmount?: number;
  commission?: number;
  gst?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt?: string;
  processedAt?: string;
  reference?: string;
  utr?: string;
  failureReason?: string;
  bookings?: Array<{
    _id: string;
    bookingReference?: string;
    activityTitle?: string;
    customerName?: string;
    grossAmount?: number;
    netAmount?: number;
    completedAt?: string;
  }>;
  bankAccount?: {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
};

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  processing: { label: 'Processing', variant: 'info' },
  completed: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
};

export default function PayoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await payoutAPI.getPayoutDetails(id);
      setPayout(res?.data || res?.payout || null);
    } catch (err: any) {
      console.warn('[PayoutDetail] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const copy = async (label: string, value?: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: `${label} copied` });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!payout) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Payout not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CFG[payout.status] || STATUS_CFG.pending;
  const masked = payout.bankAccount?.accountNumber
    ? `••••${payout.bankAccount.accountNumber.slice(-4)}`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Payout details</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero amount */}
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>Net to bank</Text>
          <Text style={styles.heroAmount}>
            ₹{(payout.netAmount ?? payout.amount).toLocaleString('en-IN')}
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Badge label={cfg.label} variant={cfg.variant} size="md" />
          </View>

          {payout.processedAt ? (
            <Text style={styles.heroMeta}>
              Processed on{' '}
              {new Date(payout.processedAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </Text>
          ) : payout.createdAt ? (
            <Text style={styles.heroMeta}>
              Initiated on{' '}
              {new Date(payout.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </Text>
          ) : null}
        </Card>

        {/* Breakdown */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Amount breakdown</Text>
          <Row label="Gross collected" value={`₹${payout.amount.toLocaleString('en-IN')}`} />
          {payout.commission != null ? (
            <Row label="Platform commission" value={`-₹${payout.commission.toLocaleString('en-IN')}`} />
          ) : null}
          {payout.gst != null ? (
            <Row label="GST on commission" value={`-₹${payout.gst.toLocaleString('en-IN')}`} />
          ) : null}
          <View style={styles.divider} />
          <Row
            label="Net to your bank"
            value={`₹${(payout.netAmount ?? payout.amount).toLocaleString('en-IN')}`}
            bold
          />
        </Card>

        {/* Bank + UTR */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Transfer details</Text>
          {payout.bankAccount?.bankName ? (
            <Row label="Bank" value={payout.bankAccount.bankName} />
          ) : null}
          {masked ? <Row label="Account" value={masked} /> : null}
          {payout.bankAccount?.ifscCode ? (
            <Row label="IFSC" value={payout.bankAccount.ifscCode} />
          ) : null}
          {payout.utr ? (
            <CopyableRow label="UTR / Reference" value={payout.utr} onCopy={() => copy('UTR', payout.utr)} />
          ) : payout.reference ? (
            <CopyableRow label="Reference" value={payout.reference} onCopy={() => copy('Reference', payout.reference)} />
          ) : null}
          {payout.failureReason ? (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.warningText}>{payout.failureReason}</Text>
            </View>
          ) : null}
        </Card>

        {/* Bookings included */}
        {payout.bookings && payout.bookings.length > 0 ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              Bookings included ({payout.bookings.length})
            </Text>
            {payout.bookings.map((b, i) => (
              <View
                key={b._id}
                style={[styles.bookingRow, i < payout.bookings!.length - 1 && styles.bookingDivider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>
                    {b.activityTitle || b.bookingReference || 'Booking'}
                  </Text>
                  <Text style={styles.bookingMeta}>
                    {b.customerName || ''}
                    {b.completedAt
                      ? ` · ${new Date(b.completedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.bookingAmount}>
                  ₹{(b.netAmount ?? b.grossAmount ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

function CopyableRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <TouchableOpacity onPress={onCopy} activeOpacity={0.7} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text style={styles.rowValue} selectable>{value}</Text>
        <Ionicons name="copy-outline" size={14} color={colors.primary[500]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  errorText: { fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.semibold },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
  heroCard: { padding: spacing.lg, alignItems: 'center', gap: 6 },
  heroLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  heroAmount: { fontSize: 38, fontWeight: fontWeight.bold, color: colors.primary[600] },
  heroMeta: { marginTop: spacing.md, fontSize: fontSize.xs, color: colors.textTertiary },

  section: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  rowValueBold: { fontWeight: fontWeight.bold, color: colors.primary[600], fontSize: fontSize.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

  warningBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
  },
  warningText: { flex: 1, fontSize: fontSize.sm, color: colors.error, lineHeight: 20 },

  bookingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  bookingDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  bookingTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  bookingMeta: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  bookingAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
});
