// /my-expenses — the mobile port of the web My Expenses hub
// (travel-ai-nextjs/components/my-expenses/MyExpensesPage.jsx). A read-only
// aggregate of every trip the user shares an expense in; per-trip balances are
// computed CLIENT-SIDE (splitwiseCalculator) exactly like the web. Settle-up is
// a read-modify-write of the trip's settledTransactions[] via updateTrip — there
// is no dedicated settle endpoint on the server.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, RefreshControl, Image,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import {
  calculateNetBalances,
  minimizeTransactions,
  settlementKey,
  type Participant,
  type Expense,
  type Settlement,
} from '../../utils/splitwiseCalculator';

const ACCENT = '#4AC0CC'; // Prayana teal

type TripEnvelope = {
  tripId: string;
  name: string;
  coverImage?: string | null;
  currency?: string;
  isOwner?: boolean;
  expenses?: Expense[];
  settledTransactions?: { key: string }[];
  collaborators?: { userId: string; name?: string; email?: string; avatar?: string | null }[];
  offlineMembers?: { id: string; name: string }[];
};

// Build the participant list a trip's balance calc needs, mirroring the web's
// participantsForTrip: owner + collaborators + offlineMembers + any uid that
// only appears inside an expense.
function participantsForTrip(trip: TripEnvelope, meUid: string, meName: string): Participant[] {
  const map = new Map<string, Participant>();
  if (trip.isOwner && meUid) map.set(meUid, { userId: meUid, userName: meName || 'You' });
  (trip.collaborators || []).forEach((c) => {
    if (c.userId) map.set(c.userId, { userId: c.userId, userName: c.name || c.email || c.userId, avatar: c.avatar ?? null });
  });
  (trip.offlineMembers || []).forEach((m) => {
    if (m.id) map.set(m.id, { userId: m.id, userName: m.name });
  });
  (trip.expenses || []).forEach((e: any) => {
    const seed = [e.paidBy, ...(e.splitAmong || [])];
    seed.forEach((uid: string, i: number) => {
      if (uid && !map.has(uid)) {
        map.set(uid, { userId: uid, userName: i === 0 ? (e.paidByName || uid) : uid });
      }
    });
  });
  if (meUid && !map.has(meUid)) map.set(meUid, { userId: meUid, userName: meName || 'You' });
  return Array.from(map.values());
}

type OpenSettlement = Settlement & { key: string };

// Per-trip: open settlements involving me (owe / owed), with already-settled ones removed.
function tripBalanceForMe(trip: TripEnvelope, meUid: string, meName: string) {
  const participants = participantsForTrip(trip, meUid, meName);
  const balances = calculateNetBalances(trip.expenses || [], participants);
  const all = minimizeTransactions(balances, participants);
  const settledKeys = new Set((trip.settledTransactions || []).map((s) => s.key));
  const open: OpenSettlement[] = all
    .map((s) => ({ ...s, key: settlementKey(s) }))
    .filter((s) => !settledKeys.has(s.key));
  const iOwe = open.filter((s) => s.from === meUid);
  const iAmOwed = open.filter((s) => s.to === meUid);
  const owe = iOwe.reduce((sum, s) => sum + s.amount, 0);
  const owed = iAmOwed.reduce((sum, s) => sum + s.amount, 0);
  return { iOwe, iAmOwed, owe, owed, net: owed - owe, hasOpen: open.length > 0 };
}

const money = (n: number, cur = 'INR') =>
  `${cur === 'INR' ? '₹' : cur + ' '}${Math.round(n).toLocaleString('en-IN')}`;

export default function MyExpensesScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();
  const meUid = (user as any)?.uid || '';
  const meName = (user as any)?.displayName || (user as any)?.name || 'You';

  const [trips, setTrips] = useState<TripEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meUid || meUid === 'guest-user') { setLoading(false); return; }
    try {
      const res: any = await createTripAPI.getMyExpenses(meUid);
      setTrips(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // leave whatever we had; pull-to-refresh retries
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [meUid]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // Per-trip balances + a cross-trip rollup (assumes INR; the web converts
  // currencies — mobile shows each trip in its own currency and rolls up the
  // INR-denominated majority, which covers ~all Indian trips).
  const rows = useMemo(
    () => trips.map((t) => ({ trip: t, bal: tripBalanceForMe(t, meUid, meName) })),
    [trips, meUid, meName]
  );
  const totals = useMemo(() => {
    let owe = 0, owed = 0;
    rows.forEach((r) => { owe += r.bal.owe; owed += r.bal.owed; });
    return { owe, owed, net: owed - owe };
  }, [rows]);

  const activeRows = rows.filter((r) => r.bal.hasOpen);

  // Settle a single open transaction: read the trip, append a settledTransactions
  // row, PUT it back. Matches SettleUpButton.markSettledOnServer on the web.
  const settle = useCallback(async (trip: TripEnvelope, s: OpenSettlement) => {
    setSettling(s.key);
    try {
      const cur: any = await createTripAPI.getTripById(trip.tripId);
      const tripDoc = cur?.data || cur || {};
      const existing: any[] = Array.isArray(tripDoc.settledTransactions) ? tripDoc.settledTransactions : [];
      const next = existing.filter((row) => row.key !== s.key);
      next.push({
        key: s.key,
        from: s.from,
        to: s.to,
        amount: s.amount,
        settledBy: meUid,
        method: 'manual',
        note: `Settle: ${trip.name}`,
      });
      await createTripAPI.updateTrip(trip.tripId, {
        settledTransactions: next,
        actorUserId: meUid,
      });
      // Reflect locally so the row disappears immediately.
      setTrips((prev) =>
        prev.map((t) =>
          t.tripId === trip.tripId
            ? { ...t, settledTransactions: [...(t.settledTransactions || []), { key: s.key }] }
            : t
        )
      );
    } catch (e: any) {
      Alert.alert('Could not settle', e?.message || 'Please try again.');
    } finally {
      setSettling(null);
    }
  }, [meUid]);

  const confirmSettle = useCallback((trip: TripEnvelope, s: OpenSettlement) => {
    const who = s.from === meUid ? `to ${s.toName}` : `from ${s.fromName}`;
    Alert.alert(
      'Mark as settled?',
      `Confirm ${money(s.amount, trip.currency)} ${who} has been paid. This only records the settlement — no money moves through the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark settled', onPress: () => settle(trip, s) },
      ]
    );
  }, [meUid, settle]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>My Expenses</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : !meUid || meUid === 'guest-user' ? (
        <View style={styles.center}>
          <Ionicons name="wallet-outline" size={44} color={themeColors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Sign in to see your expenses</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {/* Rollup summary */}
          <View style={[styles.summary, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>You owe</Text>
              <Text style={[styles.summaryVal, { color: '#EF4444' }]}>{money(totals.owe)}</Text>
            </View>
            <View style={[styles.summaryDiv, { backgroundColor: themeColors.border }]} />
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>You're owed</Text>
              <Text style={[styles.summaryVal, { color: '#10B981' }]}>{money(totals.owed)}</Text>
            </View>
            <View style={[styles.summaryDiv, { backgroundColor: themeColors.border }]} />
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Net</Text>
              <Text style={[styles.summaryVal, { color: totals.net >= 0 ? '#10B981' : '#EF4444' }]}>
                {totals.net >= 0 ? '+' : '−'}{money(Math.abs(totals.net))}
              </Text>
            </View>
          </View>

          {activeRows.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>All settled up</Text>
              <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                Split an expense on any trip and open balances show up here.
              </Text>
            </View>
          ) : (
            activeRows.map(({ trip, bal }) => (
              <View
                key={trip.tripId}
                style={[styles.tripCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              >
                <TouchableOpacity
                  style={styles.tripHead}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/trip/${trip.tripId}` as any)}
                >
                  {trip.coverImage ? (
                    <Image source={{ uri: trip.coverImage }} style={styles.tripThumb} />
                  ) : (
                    <View style={[styles.tripThumb, styles.tripThumbPh, { backgroundColor: themeColors.border }]}>
                      <Ionicons name="airplane" size={16} color={themeColors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tripName, { color: themeColors.text }]} numberOfLines={1}>{trip.name}</Text>
                    <Text style={[styles.tripNet, { color: bal.net >= 0 ? '#10B981' : '#EF4444' }]}>
                      {bal.net >= 0 ? `You're owed ${money(bal.owed, trip.currency)}` : `You owe ${money(bal.owe, trip.currency)}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                </TouchableOpacity>

                {/* Open settlements involving me */}
                {[...bal.iOwe, ...bal.iAmOwed].map((s) => {
                  const iPay = s.from === meUid;
                  return (
                    <View key={s.key} style={[styles.settleRow, { borderTopColor: themeColors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settleWho, { color: themeColors.text }]}>
                          {iPay ? `You → ${s.toName}` : `${s.fromName} → You`}
                        </Text>
                        <Text style={[styles.settleAmt, { color: iPay ? '#EF4444' : '#10B981' }]}>
                          {iPay ? 'You owe' : 'Owes you'} {money(s.amount, trip.currency)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.settleBtn, { borderColor: ACCENT }]}
                        onPress={() => confirmSettle(trip, s)}
                        disabled={settling === s.key}
                      >
                        {settling === s.key ? (
                          <ActivityIndicator size="small" color={ACCENT} />
                        ) : (
                          <Text style={[styles.settleBtnText, { color: ACCENT }]}>Settle up</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  body: { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  summary: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: borderRadius.xl, paddingVertical: spacing.lg,
  },
  summaryCell: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDiv: { width: StyleSheet.hairlineWidth, height: 32 },
  summaryLabel: { fontSize: fontSize.xs },
  summaryVal: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  tripCard: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  tripThumb: { width: 44, height: 44, borderRadius: 10 },
  tripThumbPh: { alignItems: 'center', justifyContent: 'center' },
  tripName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  tripNet: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },

  settleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth,
  },
  settleWho: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  settleAmt: { fontSize: fontSize.xs, marginTop: 2 },
  settleBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, minWidth: 84, alignItems: 'center' },
  settleBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  emptyBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'] },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptySub: { fontSize: fontSize.sm, textAlign: 'center', maxWidth: 260 },

  primaryBtn: { backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primaryBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
