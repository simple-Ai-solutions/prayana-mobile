// EsimRechargeSection — top up an active eSIM with more data, the mobile port of
// the recharge UI in the web app/esim/order/[orderId] page. The recharge API
// (esimAPI.getRechargeOptions / createRecharge / verifyRecharge) already existed
// in shared-services but had no mobile UI — so buyers couldn't add data once a
// plan ran low. Recharge is a Matrix-only, active-order feature.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { esimAPI, openCheckout, toPaise } from '@prayana/shared-services';
import { ENV } from '../../config/env';

const ACCENT_RED = '#E61417';

interface RechargePlan {
  id?: string;
  planId?: string;
  name?: string;
  dataAmountMB?: number;
  durationDays?: number;
  price?: number;
  sellingPrice?: number;
  currency?: string;
}

interface Props {
  orderId: string;
  /** Show recharge only for active Matrix orders (web parity). */
  isMatrix: boolean;
  status?: string;
  /** Refresh the parent order after a successful top-up. */
  onRecharged?: () => void;
}

export const EsimRechargeSection: React.FC<Props> = ({ orderId, isMatrix, status, onRecharged }) => {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<RechargePlan[] | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const eligible = isMatrix && status === 'active';

  const loadOptions = useCallback(async () => {
    if (plans) {
      setOpen((v) => !v);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res: any = await esimAPI.getRechargeOptions(orderId);
      const list: RechargePlan[] = res?.data?.rechargeOptions || res?.data || [];
      setPlans(Array.isArray(list) ? list : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, plans]);

  const handleRecharge = useCallback(
    async (plan: RechargePlan) => {
      const planId = plan.planId || plan.id;
      if (!planId) return;
      setBuyingId(planId);
      try {
        // 1) Create the recharge order → Razorpay params
        const initRes: any = await esimAPI.createRecharge(orderId, planId);
        if (!initRes?.success || !initRes?.data?.razorpayOrderId) {
          Alert.alert('Recharge unavailable', initRes?.message || 'Please try again.');
          return;
        }
        const { razorpayOrderId, amount, currency, keyId } = initRes.data;

        // 2) Open Razorpay
        const price = plan.sellingPrice || plan.price || 0;
        const result = await openCheckout({
          keyId: keyId || ENV.razorpayKeyId,
          orderId: razorpayOrderId,
          amountInPaise: amount || toPaise(price),
          currency: currency || 'INR',
          description: `Recharge · ${plan.name || 'eSIM top-up'}`,
        });
        if (result.status === 'cancelled') return;
        if (result.status === 'failed') {
          Alert.alert('Payment failed', result.reason || 'Please try again.');
          return;
        }

        // 3) Verify → the provider adds the data
        const verifyRes: any = await esimAPI.verifyRecharge(orderId, {
          razorpayOrderId: result.orderId,
          razorpayPaymentId: result.paymentId,
          razorpaySignature: result.signature,
        });
        if (verifyRes?.success) {
          Alert.alert('Recharge successful', 'Your extra data has been added.');
          onRecharged?.();
          setOpen(false);
        } else {
          Alert.alert(
            'Recharge processing',
            verifyRes?.message || 'Payment captured. Your data will be added shortly.',
          );
        }
      } catch (e: any) {
        Alert.alert('Something went wrong', e?.message || 'Please try again.');
      } finally {
        setBuyingId(null);
      }
    },
    [orderId, onRecharged],
  );

  if (!eligible) return null;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <TouchableOpacity style={styles.header} onPress={loadOptions} activeOpacity={0.8}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="flash" size={16} color={ACCENT_RED} />
          </View>
          <View>
            <Text style={[styles.title, { color: themeColors.text }]}>Add more data</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Top up this eSIM without buying a new one
            </Text>
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={themeColors.textTertiary} />
      </TouchableOpacity>

      {open && (
        <View style={styles.plans}>
          {loading ? (
            <ActivityIndicator color={ACCENT_RED} style={{ paddingVertical: spacing.lg }} />
          ) : !plans || plans.length === 0 ? (
            <Text style={[styles.empty, { color: themeColors.textTertiary }]}>
              No top-up plans available for this eSIM right now.
            </Text>
          ) : (
            plans.map((p, i) => {
              const planId = p.planId || p.id || String(i);
              const price = p.sellingPrice || p.price || 0;
              const data =
                p.dataAmountMB != null
                  ? p.dataAmountMB >= 1024
                    ? `${(p.dataAmountMB / 1024).toFixed(p.dataAmountMB % 1024 === 0 ? 0 : 1)} GB`
                    : `${p.dataAmountMB} MB`
                  : p.name || 'Top-up';
              const busy = buyingId === planId;
              return (
                <TouchableOpacity
                  key={planId}
                  style={[styles.plan, { borderColor: themeColors.border }]}
                  activeOpacity={0.85}
                  disabled={!!buyingId}
                  onPress={() => handleRecharge(p)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planData, { color: themeColors.text }]}>{data}</Text>
                    {p.durationDays != null && (
                      <Text style={[styles.planMeta, { color: themeColors.textTertiary }]}>
                        {p.durationDays} days
                      </Text>
                    )}
                  </View>
                  <View style={styles.buyBtn}>
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.buyBtnText}>
                        ₹{Math.round(price).toLocaleString('en-IN')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
};

export default EsimRechargeSection;

const styles = StyleSheet.create({
  card: { borderRadius: borderRadius.xl, borderWidth: 1, marginTop: spacing.md, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(230,20,23,0.10)',
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  subtitle: { fontSize: fontSize.xs, marginTop: 1 },
  plans: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  empty: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  planData: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  planMeta: { fontSize: fontSize.xs, marginTop: 1 },
  buyBtn: {
    backgroundColor: ACCENT_RED,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    minWidth: 72,
    alignItems: 'center',
  },
  buyBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
