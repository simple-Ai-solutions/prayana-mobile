// My eSIMs — the mobile port of app/esim/my-orders/page.jsx.
//
// The previous version was wrong in two ways that made it unusable:
//
//  - It read `order.fulfilment` (one L) to show the QR inline. The server field
//    is `fulfillment`, so that object was always undefined and the QR could
//    never render.
//  - It invented its own status vocabulary — paid / fulfilling / fulfilled /
//    cancelled — none of which the server emits. The real enum is
//    pending_payment / pending_kyc / pending_validation / processing / active /
//    completed / failed / refunded, so every order fell through to an unknown
//    status.
//
// Statuses now come from one shared table, and orders link to
// /esim/order/[orderId], which owns the QR, usage, KYC and install guide.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';
import { formatData } from '../../../lib/esim';
import { EsimOrder, statusStyle } from '../../../lib/esimOrder';
import { CountryFlag } from '../../../components/esim/CountryFlag';

const ACCENT_RED = '#E61417';

export default function MyEsimOrdersScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [orders, setOrders] = useState<EsimOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res: any = await esimAPI.getMyOrders();
      const data = res?.data;
      const list: EsimOrder[] = Array.isArray(data) ? data : (data?.orders ?? []);
      setOrders(list);
    } catch {
      // Surface this: a failed request and an empty list look identical to the
      // customer otherwise, and only one of them is worth retrying.
      setError("Couldn't load your eSIMs. Please try again.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const retry = () => {
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'My eSIMs' }} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT_RED} />
        }
      >
        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator size="large" color={ACCENT_RED} />
          </View>
        ) : error ? (
          <View style={styles.centre}>
            <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
            <Text style={[styles.msg, { color: themeColors.textSecondary }]}>{error}</Text>
            <TouchableOpacity onPress={retry} style={styles.cta} accessibilityRole="button">
              <Text style={styles.ctaText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centre}>
            <LinearGradient
              colors={['#FF3344', '#E61417', '#C30E11']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIcon}
            >
              <Ionicons name="phone-portrait-outline" size={26} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No eSIMs yet</Text>
            <Text style={[styles.msg, { color: themeColors.textSecondary }]}>
              Stay connected on your next trip abroad.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/esim')}
              style={styles.cta}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>Browse plans</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((o) => {
            const st = statusStyle(o.status);
            const b = o.bundle ?? {};
            const dataLabel = b.isUnlimited ? 'Unlimited' : formatData(b.dataAmountMB);

            return (
              <TouchableOpacity
                key={o._id}
                onPress={() => router.push(`/esim/order/${o._id}`)}
                style={[
                  styles.card,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${b.countryName ?? 'eSIM'} order, ${st.label}`}
              >
                <View style={styles.cardTop}>
                  <CountryFlag countryCode={b.country} size={30} />
                  <View style={styles.cardHead}>
                    <Text style={[styles.country, { color: themeColors.text }]} numberOfLines={1}>
                      {b.countryName || b.country || 'eSIM'}
                    </Text>
                    {!!o.orderReference && (
                      <Text
                        style={[styles.ref, { color: themeColors.textTertiary }]}
                        numberOfLines={1}
                      >
                        {o.orderReference}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.status, { backgroundColor: st.bg }]}>
                    <View style={[styles.dot, { backgroundColor: st.dot }]} />
                    <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                <View style={styles.cardBottom}>
                  <Ionicons name="wifi-outline" size={16} color={themeColors.textSecondary} />
                  <Text style={[styles.data, { color: themeColors.text }]}>{dataLabel}</Text>
                  {!!b.durationDays && (
                    <Text style={[styles.days, { color: themeColors.textSecondary }]}>
                      {b.durationDays} days
                    </Text>
                  )}
                  <View style={styles.spacer} />
                  <Text style={[styles.price, { color: themeColors.text }]}>
                    ₹{(o.pricing?.sellingPrice ?? 0).toLocaleString('en-IN')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },

  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  msg: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: ACCENT_RED,
  },
  ctaText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  cardHead: { flex: 1 },
  country: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ref: { fontSize: 10, fontFamily: 'Courier', marginTop: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: fontWeight.bold },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.md },

  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  data: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  days: { fontSize: fontSize.xs },
  spacer: { flex: 1 },
  price: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
