import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';

type EsimOrder = {
  _id: string;
  bundleName: string;
  bundleDisplayName?: string;
  status:
    | 'pending_payment'
    | 'paid'
    | 'fulfilling'
    | 'fulfilled'
    | 'failed'
    | 'cancelled'
    | 'refunded';
  provider?: string;
  countryName?: string;
  pricing?: { sellingPrice?: number; currency?: string };
  fulfilment?: {
    qrCodeUrl?: string;
    activationCode?: string;
    smdpAddress?: string;
    iccid?: string;
    issuedAt?: string;
  };
  createdAt?: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  pending_payment: { label: 'Pending payment', variant: 'warning' },
  paid: { label: 'Paid', variant: 'info' },
  fulfilling: { label: 'Issuing eSIM', variant: 'info' },
  fulfilled: { label: 'Active', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'default' },
  refunded: { label: 'Refunded', variant: 'default' },
};

export default function MyEsimOrdersScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [orders, setOrders] = useState<EsimOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeOrder, setActiveOrder] = useState<EsimOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await esimAPI.getMyOrders();
      setOrders(res?.data || []);
    } catch (err: any) {
      console.warn('[MyEsim] fetch failed:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
        <View style={styles.center}>
          <LoadingSpinner size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>My eSIMs</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {orders.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="cellular-outline" size={56} color={themeColors.textTertiary} />}
            title="No eSIMs yet"
            description="Your purchased eSIMs will appear here with installation QR codes."
            actionLabel="Browse plans"
            onAction={() => router.replace('/esim')}
          />
        ) : (
          orders.map((order) => {
            const statusCfg = STATUS_LABEL[order.status] || STATUS_LABEL.fulfilled;
            const hasQr = !!order.fulfilment?.qrCodeUrl || !!order.fulfilment?.activationCode;
            return (
              <Card key={order._id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle} numberOfLines={1}>
                      {order.bundleDisplayName || order.bundleName}
                    </Text>
                    <Text style={styles.orderMeta}>
                      {order.countryName || ''} · Issued{' '}
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </Text>
                  </View>
                  <Badge label={statusCfg.label} variant={statusCfg.variant} size="sm" />
                </View>

                {order.pricing?.sellingPrice ? (
                  <Text style={styles.priceRow}>
                    {order.pricing.currency || '₹'}
                    {order.pricing.sellingPrice.toLocaleString('en-IN')}
                  </Text>
                ) : null}

                {hasQr ? (
                  <Button
                    title="View QR & install"
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveOrder(order);
                    }}
                    variant="primary"
                    size="md"
                    fullWidth
                    icon={<Ionicons name="qr-code" size={18} color="#fff" />}
                  />
                ) : order.status === 'pending_payment' ? (
                  <Button
                    title="Resume payment"
                    onPress={() => router.push(`/esim/checkout/${encodeURIComponent(order.bundleName)}`)}
                    variant="primary"
                    size="md"
                    fullWidth
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* QR + activation modal */}
      <Modal
        visible={!!activeOrder}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveOrder(null)}
      >
        {activeOrder ? <QrModal order={activeOrder} onClose={() => setActiveOrder(null)} /> : null}
      </Modal>
    </SafeAreaView>
  );
}

function QrModal({ order, onClose }: { order: EsimOrder; onClose: () => void }) {
  const { themeColors } = useTheme();
  const qrUrl = order.fulfilment?.qrCodeUrl;
  const code = order.fulfilment?.activationCode;
  const smdp = order.fulfilment?.smdpAddress;

  const copy = async (label: string, value?: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: `${label} copied` });
  };

  const shareInstall = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Prayana eSIM activation\nCode: ${code}${smdp ? `\nSM-DP+: ${smdp}` : ''}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.modalTitle, { color: themeColors.text }]}>Install eSIM</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={26} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.modalScroll}>
        <Text style={[styles.modalBundleName, { color: themeColors.text }]}>
          {order.bundleDisplayName || order.bundleName}
        </Text>

        {qrUrl ? (
          <View style={styles.qrWrap}>
            <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
            <Text style={[styles.qrCaption, { color: themeColors.textSecondary }]}>
              On iOS: Settings → Mobile Service → Add eSIM → Scan QR
            </Text>
          </View>
        ) : null}

        {code ? (
          <Card style={styles.detailCard}>
            <DetailRow label="Activation code" value={code} onCopy={() => copy('Activation code', code)} />
            {smdp ? (
              <DetailRow label="SM-DP+ address" value={smdp} onCopy={() => copy('SM-DP+ address', smdp)} />
            ) : null}
            {order.fulfilment?.iccid ? (
              <DetailRow label="ICCID" value={order.fulfilment.iccid} onCopy={() => copy('ICCID', order.fulfilment?.iccid)} />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.helpCard}>
          <Text style={styles.helpTitle}>Manual installation</Text>
          <Text style={styles.helpStep}>1. Open Settings → Mobile Service / Cellular</Text>
          <Text style={styles.helpStep}>2. Tap "Add eSIM" → "Use QR code" or enter details manually</Text>
          <Text style={styles.helpStep}>3. Activate when you arrive at your destination</Text>
        </Card>

        {code ? (
          <Button title="Share install details" onPress={shareInstall} variant="outline" size="md" fullWidth />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value?: string;
  onCopy?: () => void;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} selectable numberOfLines={2}>
          {value}
        </Text>
      </View>
      <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="copy-outline" size={20} color={colors.primary[500]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  scroll: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  orderCard: { padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  orderHeader: { flexDirection: 'row', alignItems: 'center' },
  orderTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  orderMeta: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  priceRow: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[600] },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  modalScroll: { padding: spacing.lg, gap: spacing.lg },
  modalBundleName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  qrWrap: { alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  qrImage: {
    width: 240,
    height: 240,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
  },
  qrCaption: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
  detailCard: { padding: spacing.lg, gap: spacing.md },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailLabel: { fontSize: fontSize.xs, color: colors.textTertiary, marginBottom: 2 },
  detailValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  helpCard: { padding: spacing.lg, gap: spacing.xs },
  helpTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  helpStep: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },
});
