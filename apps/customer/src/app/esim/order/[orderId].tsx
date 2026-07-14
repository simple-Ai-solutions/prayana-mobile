// eSIM order detail — the mobile port of app/esim/order/[orderId]/page.jsx.
//
// This route did not exist. My eSIMs listed orders but had nowhere to send you,
// so after buying an eSIM there was no way to reach the QR code and install it.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';
import { formatData } from '../../../lib/esim';
import { EsimOrder, resolveEsim, statusStyle, usageOf } from '../../../lib/esimOrder';
import { CountryFlag } from '../../../components/esim/CountryFlag';
import { EsimQRCode } from '../../../components/esim/EsimQRCode';
import { EsimUsageMeter } from '../../../components/esim/EsimUsageMeter';
import { EsimInstallGuide } from '../../../components/esim/EsimInstallGuide';

const ACCENT_RED = '#E61417';

export default function EsimOrderScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [order, setOrder] = useState<EsimOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const res: any = await esimAPI.getOrderById(orderId);
      const found: EsimOrder | null = res?.data ?? null;
      if (!found) {
        setError('Order not found.');
        return;
      }
      setOrder(found);
    } catch {
      setError("Couldn't load this order. Please try again.");
    }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // An active eSIM's usage moves, so refresh it while the screen is open —
  // but only while active, or we would poll a completed order forever.
  useEffect(() => {
    if (order?.status !== 'active') return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [order?.status, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'eSIM order',
        headerBackTitle: 'My eSIMs',
      }}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
        {header}
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={ACCENT_RED} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
        {header}
        <View style={styles.centre}>
          <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
          <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
            {error || 'Order not found.'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
            style={styles.retry}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const esim = resolveEsim(order);
  const st = statusStyle(order.status);
  const bundle = order.bundle ?? {};
  const totalMB = bundle.dataAmountMB;
  const usage = usageOf(order.fulfillment ?? order.esimGo, totalMB);

  // The QR is only meaningful once the provider has issued the profile.
  const canInstall =
    ['active', 'completed', 'pending_kyc'].includes(order.status) &&
    (esim.installUrl || esim.smdpAddress || esim.base64QRCode);

  const dataLabel = bundle.isUnlimited ? 'Unlimited' : formatData(totalMB);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['bottom']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_RED} />
        }
      >
        {/* Header — country, reference, status */}
        <View style={styles.head}>
          <CountryFlag countryCode={bundle.country} size={34} />
          <View style={styles.headText}>
            <Text style={[styles.country, { color: themeColors.text }]} numberOfLines={1}>
              {bundle.countryName || bundle.country || 'eSIM'}
            </Text>
            {!!order.orderReference && (
              <Text style={[styles.ref, { color: themeColors.textTertiary }]}>
                {order.orderReference}
              </Text>
            )}
          </View>
          <View style={[styles.status, { backgroundColor: st.bg }]}>
            <View style={[styles.dot, { backgroundColor: st.dot }]} />
            <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>

        {/* Plan summary */}
        <View
          style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
        >
          <View style={styles.summary}>
            <Summary label="Data" value={dataLabel} icon="wifi-outline" />
            <Summary label="Validity" value={`${bundle.durationDays ?? '—'} days`} icon="calendar-outline" />
            <Summary
              label="Paid"
              value={`₹${(order.pricing?.sellingPrice ?? 0).toLocaleString('en-IN')}`}
              icon="card-outline"
            />
          </View>
        </View>

        {/* Usage — only meaningful for a plan with a metered allowance. */}
        {!bundle.isUnlimited && order.status !== 'pending_payment' && (
          <EsimUsageMeter usage={usage} totalMB={totalMB} isUnlimited={bundle.isUnlimited} />
        )}

        {/* KYC still owed — say so loudly, it is what blocks activation. */}
        {order.kyc?.required && order.kyc.status !== 'approved' && (
          <View style={styles.kyc}>
            <Ionicons name="document-text-outline" size={18} color={ACCENT_RED} />
            <View style={styles.kycBody}>
              <Text style={[styles.kycTitle, { color: themeColors.text }]}>
                {order.kyc.status === 'submitted'
                  ? 'KYC under review'
                  : order.kyc.status === 'rejected'
                    ? 'KYC rejected'
                    : 'KYC required'}
              </Text>
              <Text style={[styles.kycText, { color: themeColors.textSecondary }]}>
                {order.kyc.status === 'submitted'
                  ? 'Your documents are being reviewed. This usually takes a few hours.'
                  : order.kyc.status === 'rejected'
                    ? 'Please re-upload clear, legible copies of your documents.'
                    : 'Your passport is required before this eSIM can be activated.'}
              </Text>
            </View>
          </View>
        )}

        {/* QR code + install */}
        {canInstall && (
          <EsimQRCode
            installUrl={esim.installUrl}
            smdpAddress={esim.smdpAddress}
            activationCode={esim.activationCode}
            iccid={esim.iccid}
            base64QRCode={esim.base64QRCode}
          />
        )}

        {order.status === 'processing' && (
          <View style={[styles.processing, { borderColor: themeColors.border }]}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={[styles.processingText, { color: themeColors.textSecondary }]}>
              Your payment went through and the eSIM is being prepared. The QR code will appear here
              shortly.
            </Text>
          </View>
        )}

        {/* Order details */}
        <View
          style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
        >
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Order details</Text>
          <Row label="Reference" value={order.orderReference} mono />
          <Row label="ICCID" value={esim.iccid} mono />
          <Row label="Mobile number" value={esim.mobileNumber} mono />
          <Row
            label="Ordered"
            value={
              order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : undefined
            }
          />
          <Row
            label="Total paid"
            value={`₹${(order.pricing?.sellingPrice ?? 0).toLocaleString('en-IN')}`}
            bold
          />
        </View>

        {(order.status === 'active' || order.status === 'processing') && <EsimInstallGuide />}
      </ScrollView>
    </SafeAreaView>
  );
}

const Summary: React.FC<{
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = ({ label, value, icon }) => {
  const { themeColors } = useTheme();
  return (
    <View style={styles.summaryCell}>
      <Ionicons name={icon} size={17} color={ACCENT_RED} />
      <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: themeColors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
};

/** A label/value row. Renders nothing when the value is absent — no "—" filler. */
const Row: React.FC<{ label: string; value?: string | null; mono?: boolean; bold?: boolean }> = ({
  label,
  value,
  mono,
  bold,
}) => {
  const { themeColors } = useTheme();
  if (!value) return null;
  return (
    <View style={[styles.row, { borderTopColor: themeColors.border }]}>
      <Text style={[styles.rowLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: themeColors.text },
          mono && styles.mono,
          bold && { fontWeight: fontWeight.bold },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { fontSize: fontSize.sm, textAlign: 'center' },
  retry: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: ACCENT_RED,
  },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1 },
  country: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  ref: { fontSize: 11, fontFamily: 'Courier', marginTop: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: fontWeight.bold },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.xs },

  summary: { flexDirection: 'row' },
  summaryCell: { flex: 1, alignItems: 'center', gap: 3 },
  summaryLabel: { fontSize: 10, fontWeight: fontWeight.semibold },
  summaryValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: fontSize.sm },
  rowValue: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
  mono: { fontFamily: 'Courier', fontSize: fontSize.xs },

  kyc: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(230,20,23,0.25)',
    backgroundColor: 'rgba(230,20,23,0.05)',
  },
  kycBody: { flex: 1 },
  kycTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  kycText: { fontSize: fontSize.xs, lineHeight: 18, marginTop: 2 },

  processing: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  processingText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },
});
