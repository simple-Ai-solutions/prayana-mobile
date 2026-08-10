// /vip — VIP membership upgrade + checkout, the mobile port of the web
// app/vip/VipUpgradeClient + VipCheckoutClient. ₹999/year: unlimited AI
// itineraries, 12% off every booking, +500 credits, and more. Payment is
// hybrid — redeem Planner Credits first, pay the rest via Razorpay (if credits
// cover the full ₹999 the server upgrades synchronously, no payment sheet).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { membershipAPI, openCheckout } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../config/env';

const VIP_PRICE = 999;
const VIOLET = '#8B5CF6';
const VIOLET_DEEP = '#6D28D9';

const PERKS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'infinite', title: 'Unlimited AI Quick Itineraries', body: 'Plan as many trips as you want — no 5-credit charge per plan.' },
  { icon: 'pricetag', title: '12% off every booking', body: 'Automatic discount on activities, eSIMs, transport, packages, hotels.' },
  { icon: 'wallet', title: '+500 Planner Credits up-front', body: 'Banked instantly on purchase and every renewal.' },
  { icon: 'trending-up', title: '5 Travel Credits per ₹100 spent', body: 'Highest-tier earn rate — every booking sends value back to your wallet.' },
  { icon: 'people', title: 'Skip the collab join fee', body: 'Join unlimited trips from friends and family at zero credit cost.' },
  { icon: 'flash', title: 'Priority AI generation', body: 'Skip the queue — premium model, faster, richer day-by-day plans.' },
  { icon: 'ribbon', title: 'VIP badge across the app', body: 'Profile, community answers, share links — your name carries a Crown.' },
  { icon: 'headset', title: 'Priority customer support', body: 'Direct line to the team. Replies within 4 working hours.' },
  { icon: 'lock-closed', title: 'Anti-downgrade lock', body: 'Your VIP perks stay active the full 365 days you paid for.' },
  { icon: 'star', title: 'Founder pricing locked forever', body: "Renew at today's ₹999 no matter what the public price becomes." },
];

export default function VipScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res: any = await membershipAPI.getStatus();
      const s = res?.data || res;
      setStatus(s);
      // Default the credit slider to the max that can be applied.
      const maxApply = Math.min(s?.creditsBalance ?? 0, VIP_PRICE);
      setCredits(maxApply);
    } catch {
      // keep the page usable; upgrade will error clearly if needed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const isVip = status?.isVip;
  const balance = status?.creditsBalance ?? 0;
  const maxCredits = Math.min(balance, VIP_PRICE);
  const cashDue = Math.max(0, VIP_PRICE - credits);

  const handleUpgrade = useCallback(async () => {
    if (!user || (user as any).uid === 'guest-user') {
      Alert.alert('Sign in to continue', 'Please sign in to upgrade to VIP.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    setSubmitting(true);
    try {
      // 1) Create the upgrade order (credits applied server-side).
      const initRes: any = await membershipAPI.createUpgradeOrder(credits);
      if (!initRes?.success) {
        Alert.alert('Upgrade unavailable', initRes?.message || 'Please try again.');
        return;
      }
      const data = initRes.data || {};

      // 2) Credits covered the full price → already upgraded, no payment.
      if (data.upgraded) {
        await loadStatus();
        Alert.alert('You’re VIP! 🎉', 'Your VIP benefits are now active.');
        return;
      }

      // 3) Pay the remaining cash via Razorpay.
      const result = await openCheckout({
        keyId: data.keyId || ENV.razorpayKeyId,
        orderId: data.orderId,
        amountInPaise: data.cashDuePaisa ?? data.amountPaisa ?? cashDue * 100,
        currency: data.currency || 'INR',
        name: 'PrayanaAI VIP',
        description: 'VIP membership · 1 year',
        themeColor: VIOLET,
        prefill: { email: user?.email || undefined, name: user?.displayName || undefined },
        notes: { membership: 'vip-1year', creditsToApply: String(credits) },
      });
      if (result.status === 'cancelled') return;
      if (result.status === 'failed') {
        Alert.alert('Payment failed', result.reason || 'Please try again.');
        return;
      }

      // 4) Verify → finalise VIP.
      const verifyRes: any = await membershipAPI.verifyUpgrade({
        orderId: result.orderId,
        paymentId: result.paymentId,
        signature: result.signature,
      });
      if (verifyRes?.success) {
        setStatus(verifyRes.data || verifyRes);
        Alert.alert('You’re VIP! 🎉', 'Your VIP benefits are now active.');
      } else {
        Alert.alert('Almost there', verifyRes?.message || 'Payment captured — VIP will activate shortly.');
      }
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [user, credits, cashDue, loadStatus]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Prayana VIP</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={VIOLET} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient colors={[VIOLET, VIOLET_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.crown}>
              <Ionicons name="star" size={26} color="#FDE68A" />
            </View>
            <Text style={styles.heroTitle}>
              {isVip ? "You're a VIP member" : 'Go VIP'}
            </Text>
            <Text style={styles.heroSub}>
              {isVip
                ? status?.daysRemaining != null
                  ? `${status.daysRemaining} days remaining`
                  : 'Enjoy all VIP benefits'
                : 'Unlimited AI trips, 12% off everything, and more — for a full year.'}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{VIP_PRICE}</Text>
              <Text style={styles.priceUnit}>/ year</Text>
            </View>
            <Text style={styles.priceNote}>≈ ₹4,500 in annual value · founder pricing</Text>
          </LinearGradient>

          {/* Perks */}
          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.title} style={[styles.perk, { borderColor: themeColors.border }]}>
                <View style={styles.perkIcon}>
                  <Ionicons name={p.icon} size={16} color={VIOLET} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.perkTitle, { color: themeColors.text }]}>{p.title}</Text>
                  <Text style={[styles.perkBody, { color: themeColors.textSecondary }]}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Credits redemption — apply your Planner Credits toward the ₹999. */}
          {maxCredits > 0 && (
            <View style={[styles.creditsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.creditsHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.creditsTitle, { color: themeColors.text }]}>Use Planner Credits</Text>
                  <Text style={[styles.creditsBalance, { color: themeColors.textSecondary }]}>
                    Apply {maxCredits.toLocaleString('en-IN')} credits · Balance {balance.toLocaleString('en-IN')}
                  </Text>
                </View>
                <Switch
                  value={credits > 0}
                  onValueChange={(on) => setCredits(on ? maxCredits : 0)}
                  trackColor={{ true: VIOLET, false: themeColors.border }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.creditsRow}>
                <Text style={[styles.creditsApplied, { color: VIOLET }]}>−{credits} credits</Text>
                <Text style={[styles.cashDue, { color: themeColors.text }]}>
                  Pay ₹{cashDue.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Sticky CTA */}
      {!loading && (
        <View style={[styles.footer, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
          <TouchableOpacity onPress={handleUpgrade} disabled={submitting} activeOpacity={0.9} style={styles.cta}>
            <LinearGradient colors={[VIOLET, VIOLET_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="star" size={18} color="#fff" />
                  <Text style={styles.ctaText}>
                    {isVip
                      ? `Renew for ₹${cashDue.toLocaleString('en-IN')}`
                      : cashDue < VIP_PRICE
                        ? `Go VIP · Pay ₹${cashDue.toLocaleString('en-IN')}`
                        : `Go VIP · ₹${VIP_PRICE}`}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingBottom: spacing.xl },

  hero: { margin: spacing.lg, borderRadius: 24, padding: spacing.xl, alignItems: 'center' },
  crown: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.lg },
  price: { color: '#fff', fontSize: 40, fontWeight: '900' },
  priceUnit: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.md, marginLeft: 4 },
  priceNote: { color: '#FDE68A', fontSize: fontSize.xs, marginTop: 4, fontWeight: fontWeight.semibold },

  perks: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  perk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  perkBody: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 17 },

  creditsCard: { margin: spacing.lg, borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg },
  creditsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  creditsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  creditsBalance: { fontSize: fontSize.xs },
  creditsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  creditsApplied: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  cashDue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, borderTopWidth: 1 },
  cta: { borderRadius: borderRadius.xl, overflow: 'hidden' },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  ctaText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
