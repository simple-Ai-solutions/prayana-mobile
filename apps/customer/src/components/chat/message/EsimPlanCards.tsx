import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsha } from '../ishaTheme';
import { goToLogin, qs } from '../links';
import type { EsimPlan } from '../types';

const flagOf = (code?: string) =>
  code && /^[a-z]{2}$/i.test(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : null;

/**
 * eSIM plans for a trip abroad. Buy opens the app's checkout with the plan
 * picked: it collects the passport details and travel dates the provider
 * needs before it will activate a SIM, then pays.
 */
export default function EsimPlanCards({ plans, isAuthenticated }: { plans: EsimPlan[]; isAuthenticated: boolean }) {
  const t = useIsha();
  const router = useRouter();
  if (!plans?.length) return null;

  const buy = (plan: EsimPlan) => {
    if (!isAuthenticated) {
      goToLogin(router);
      return;
    }
    router.push(`/esim/checkout/${encodeURIComponent(plan.name)}${qs({ country: plan.countryCode || plan.country })}` as never);
  };
  const code = plans[0]?.countryCode;

  return (
    <View style={{ gap: 10 }} accessibilityLabel="eSIM plans">
      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: t.sunken }]}>
          <Ionicons name="phone-portrait-outline" size={16} color={t.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>eSIM plans</Text>
          <Text style={[styles.sub, { color: t.muted }]}>Works the moment you land, no SIM swap</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {plans.map((plan, idx) => (
          <Pressable
            key={plan.name || idx}
            onPress={() => buy(plan)}
            accessibilityRole="button"
            accessibilityLabel={`${plan.data} for ${plan.duration} days in ${plan.country}, ₹${Math.round(plan.price || 0)}. ${isAuthenticated ? 'Buy' : 'Sign in to buy'}`}
            style={({ pressed }) => [styles.plan, { borderColor: t.border, backgroundColor: pressed ? t.pressed : t.surface }]}
          >
            <Text style={styles.flag}>{flagOf(plan.countryCode) || '🌐'}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.planTitle, { color: t.text }]} numberOfLines={1}>
                {[plan.data, plan.duration ? `${plan.duration} days` : null].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.planMeta}>
                <Text style={[styles.speed, { backgroundColor: t.sunken, color: t.body }]}>{plan.speed || '4G'}</Text>
                <Text style={[styles.country, { color: t.muted }]} numberOfLines={1}>
                  {plan.country}
                </Text>
              </View>
            </View>
            {typeof plan.price === 'number' && (
              <Text style={[styles.price, { color: t.text }]}>
                {plan.currency === 'USD' ? '$' : '₹'}
                {Math.round(plan.price).toLocaleString('en-IN')}
              </Text>
            )}
            <View style={[styles.buy, { backgroundColor: t.ink }]}>
              <Text style={[styles.buyText, { color: t.onInk }]}>{isAuthenticated ? 'Buy' : 'Sign in'}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Said up front: activation needs these, and finding out after Buy reads as the app losing details */}
      <Text style={[styles.note, { color: t.muted }]}>
        Checkout asks for your passport number and travel dates. Anything already saved is filled in.
      </Text>

      <Pressable
        onPress={() => router.push((code ? `/esim/${code.toUpperCase()}` : '/esim') as never)}
        accessibilityRole="link"
        hitSlop={8}
        style={styles.all}
      >
        <Text style={[styles.allText, { color: t.text }]}>See all plans</Text>
        <Ionicons name="chevron-forward" size={14} color={t.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontWeight: '600' },
  sub: { fontSize: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  flag: { fontSize: 24 },
  planTitle: { fontSize: 13.5, fontWeight: '600' },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  speed: { fontSize: 10.5, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  country: { fontSize: 12, flexShrink: 1 },
  price: { fontSize: 15, fontWeight: '700' },
  buy: { height: 32, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  buyText: { fontSize: 12, fontWeight: '600' },
  note: { fontSize: 11.5, lineHeight: 16 },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  allText: { fontSize: 13, fontWeight: '500' },
});
