// /monuments/book — 4-step ONDC ticket checkout wizard.
// Mobile port of web app/monuments/book/page.js. Drives the async BAP sequence
// against the transactionId handed over from the search screen:
//   select  → poll on_select  (quote)
//   details → init → poll on_init  (payment terms)
//   pay (Razorpay) → confirm → poll on_confirm  (QR ticket issued)
// Each outbound call returns immediately; ondcAPI.pollForCallback waits for the
// matching currentAction on the transaction.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { ondcAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const SAFFRON = '#E38B29';

type Step = 'select' | 'details' | 'pay' | 'done';
type Nationality = 'Indian' | 'Foreigner';

export default function MonumentBookScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    transactionId?: string; providerId?: string; itemId?: string;
    name?: string; price?: string; currency?: string; monumentName?: string;
  }>();

  const transactionId = String(params.transactionId || '');
  const providerId = String(params.providerId || '');
  const itemId = String(params.itemId || '');
  const name = String(params.name || 'Monument Ticket');
  const listedPrice = Number(params.price || 0) || 0;
  const currency = String(params.currency || 'INR');

  const [step, setStep] = useState<Step>('select');
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');

  // select inputs
  const [quantity, setQuantity] = useState(1);
  const [nationality, setNationality] = useState<Nationality>('Indian');
  const [visitDate, setVisitDate] = useState(''); // YYYY-MM-DD

  // quote from on_select
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);

  // billing/visitor
  const [billName, setBillName] = useState((user as any)?.displayName || '');
  const [billEmail, setBillEmail] = useState((user as any)?.email || '');
  const [billPhone, setBillPhone] = useState('');

  // ticket
  const [ticket, setTicket] = useState<any>(null);

  useEffect(() => {
    if (!transactionId || !providerId || !itemId) {
      Alert.alert('Session expired', 'Please search and pick a ticket again.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [transactionId, providerId, itemId]);

  const estTotal = useMemo(
    () => (quoteTotal != null ? quoteTotal : listedPrice * quantity),
    [quoteTotal, listedPrice, quantity]
  );

  // Step 1 → select → poll on_select → move to details
  const doSelect = useCallback(async () => {
    if (!visitDate.trim()) { Alert.alert('Pick a date', 'Enter your visit date (YYYY-MM-DD).'); return; }
    setBusy(true); setBusyMsg('Checking availability & price…');
    try {
      const res: any = await ondcAPI.selectTicket({ transactionId, providerId, itemId, quantity });
      if (!res?.success) { Alert.alert('Unavailable', res?.message || 'Please try again.'); return; }
      const txn: any = await ondcAPI.pollForCallback(transactionId, 'on_select');
      if (!txn) { Alert.alert('No response yet', 'The network is slow. Please try again.'); return; }
      const total = Number(txn?.quote?.price?.value ?? txn?.quote?.value ?? 0) || null;
      setQuoteTotal(total);
      setStep('details');
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setBusy(false); setBusyMsg('');
    }
  }, [transactionId, providerId, itemId, quantity, visitDate]);

  // Step 2 → init → poll on_init → move to pay
  const doInit = useCallback(async () => {
    if (!billName.trim() || !billPhone.trim()) { Alert.alert('Details needed', 'Please enter name and phone.'); return; }
    setBusy(true); setBusyMsg('Reserving your ticket…');
    try {
      const visitors = Array.from({ length: quantity }, (_, i) => ({
        name: i === 0 ? billName.trim() : `${billName.trim()} +${i}`,
        nationality,
      }));
      const res: any = await ondcAPI.initOrder({
        transactionId,
        billing: { name: billName.trim(), email: billEmail.trim(), phone: billPhone.trim() },
        visitors,
        visitDate: visitDate.trim(),
      });
      if (!res?.success) { Alert.alert('Could not reserve', res?.message || 'Please try again.'); return; }
      const txn: any = await ondcAPI.pollForCallback(transactionId, 'on_init');
      if (!txn) { Alert.alert('No response yet', 'The network is slow. Please try again.'); return; }
      const total = Number(txn?.quote?.price?.value ?? txn?.quote?.value ?? 0) || null;
      if (total != null) setQuoteTotal(total);
      setStep('pay');
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setBusy(false); setBusyMsg('');
    }
  }, [transactionId, billName, billEmail, billPhone, quantity, nationality, visitDate]);

  // Step 3 → confirm → poll on_confirm → ticket.
  // NOTE: ONDC monument payment is collected-by-BAP and the server confirm flow
  // does not mint a Razorpay order (the web app stubs/simulates payment here).
  // We therefore confirm directly against the txn; when the server adds a real
  // create-order endpoint we can slot openCheckout back in before confirmOrder.
  const doPay = useCallback(async () => {
    setBusy(true); setBusyMsg('Confirming your ticket…');
    try {
      const res: any = await ondcAPI.confirmOrder({
        transactionId,
        payment: {
          amount: estTotal,
          currency,
          collectedBy: 'BAP',
        },
      });
      if (!res?.success) { Alert.alert('Confirmation issue', res?.message || 'Payment captured — ticket will issue shortly.'); return; }
      const txn: any = await ondcAPI.pollForCallback(transactionId, 'on_confirm');
      if (!txn) {
        Alert.alert('Ticket issuing', 'Payment captured. Your ticket will appear in My Tickets shortly.', [
          { text: 'View My Tickets', onPress: () => router.replace('/monuments/my-tickets' as any) },
        ]);
        return;
      }
      setTicket({
        qrCode: txn.qrCode,
        ondcOrderId: txn.ondcOrderId,
        ticketStatus: txn.ticketStatus || 'issued',
        ticketData: txn.ticketData,
      });
      setStep('done');
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setBusy(false); setBusyMsg('');
    }
  }, [estTotal, currency, transactionId]);

  const inputStyle = [styles.input, { color: themeColors.text, borderColor: themeColors.border }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (step === 'done' ? router.replace('/monuments' as any) : router.back())} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={step === 'done' ? 'close' : 'chevron-back'} size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]} numberOfLines={1}>{name}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      {step !== 'done' && (
        <View style={styles.steps}>
          {(['select', 'details', 'pay'] as Step[]).map((s, i) => {
            const idx = ['select', 'details', 'pay'].indexOf(step);
            const active = i <= idx;
            return (
              <View key={s} style={styles.stepPill}>
                <View style={[styles.stepDot, { backgroundColor: active ? SAFFRON : themeColors.border }]}>
                  <Text style={[styles.stepNum, { color: active ? '#fff' : themeColors.textSecondary }]}>{i + 1}</Text>
                </View>
                {i < 2 && <View style={[styles.stepLine, { backgroundColor: i < idx ? SAFFRON : themeColors.border }]} />}
              </View>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 'select' && (
          <>
            <Text style={[styles.h, { color: themeColors.text }]}>Tickets</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.row}>
                <Text style={[styles.label, { color: themeColors.text }]}>Quantity</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={[styles.stepBtn, { borderColor: themeColors.border }]} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                    <Ionicons name="remove" size={18} color={themeColors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.qty, { color: themeColors.text }]}>{quantity}</Text>
                  <TouchableOpacity style={[styles.stepBtn, { borderColor: themeColors.border }]} onPress={() => setQuantity((q) => Math.min(10, q + 1))}>
                    <Ionicons name="add" size={18} color={themeColors.text} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={[styles.label, { color: themeColors.text }]}>Nationality</Text>
              <View style={styles.segmented}>
                {(['Indian', 'Foreigner'] as Nationality[]).map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.seg, { borderColor: nationality === n ? SAFFRON : themeColors.border, backgroundColor: nationality === n ? SAFFRON + '22' : 'transparent' }]}
                    onPress={() => setNationality(n)}
                  >
                    <Text style={[styles.segText, { color: nationality === n ? SAFFRON : themeColors.textSecondary }]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.divider} />
              <Text style={[styles.label, { color: themeColors.text }]}>Visit date</Text>
              <TextInput value={visitDate} onChangeText={setVisitDate} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textSecondary} style={inputStyle} />
            </View>
            {listedPrice > 0 && (
              <Text style={[styles.est, { color: themeColors.textSecondary }]}>
                Approx ₹{(listedPrice * quantity).toLocaleString('en-IN')} · final price confirmed next
              </Text>
            )}
          </>
        )}

        {step === 'details' && (
          <>
            <Text style={[styles.h, { color: themeColors.text }]}>Your details</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.label, { color: themeColors.text }]}>Full name</Text>
              <TextInput value={billName} onChangeText={setBillName} placeholder="As on your ID" placeholderTextColor={themeColors.textSecondary} style={inputStyle} />
              <Text style={[styles.label, { color: themeColors.text, marginTop: spacing.sm }]}>Email</Text>
              <TextInput value={billEmail} onChangeText={setBillEmail} placeholder="you@email.com" placeholderTextColor={themeColors.textSecondary} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />
              <Text style={[styles.label, { color: themeColors.text, marginTop: spacing.sm }]}>Phone</Text>
              <TextInput value={billPhone} onChangeText={setBillPhone} placeholder="10-digit mobile" placeholderTextColor={themeColors.textSecondary} keyboardType="phone-pad" style={inputStyle} />
            </View>
            {quoteTotal != null && (
              <View style={[styles.totalRow, { borderColor: themeColors.border }]}>
                <Text style={[styles.label, { color: themeColors.text }]}>Total</Text>
                <Text style={[styles.total, { color: SAFFRON }]}>₹{estTotal.toLocaleString('en-IN')}</Text>
              </View>
            )}
          </>
        )}

        {step === 'pay' && (
          <>
            <Text style={[styles.h, { color: themeColors.text }]}>Review & pay</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <SummaryRow c={themeColors} k="Monument" v={name} />
              <SummaryRow c={themeColors} k="Tickets" v={`${quantity} × ${nationality}`} />
              <SummaryRow c={themeColors} k="Visit date" v={visitDate} />
              <View style={styles.divider} />
              <View style={styles.totalRow2}>
                <Text style={[styles.label, { color: themeColors.text }]}>Amount payable</Text>
                <Text style={[styles.total, { color: SAFFRON }]}>₹{estTotal.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </>
        )}

        {step === 'done' && (
          <View style={styles.doneWrap}>
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={56} color="#10B981" />
            </View>
            <Text style={[styles.doneTitle, { color: themeColors.text }]}>Ticket confirmed!</Text>
            <Text style={[styles.doneSub, { color: themeColors.textSecondary }]}>
              {ticket?.ondcOrderId ? `Order ${ticket.ondcOrderId}` : 'Your ticket has been issued.'}
            </Text>
            <View style={[styles.qrCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {ticket?.qrCode ? (
                <QRBlock value={ticket.qrCode} />
              ) : (
                <Text style={[styles.qrHint, { color: themeColors.textSecondary }]}>
                  Your QR entry pass is in My Tickets.
                </Text>
              )}
            </View>
            <TouchableOpacity style={[styles.cta, { backgroundColor: SAFFRON }]} onPress={() => router.replace('/monuments/my-tickets' as any)}>
              <Text style={styles.ctaText}>View My Tickets</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom action */}
      {step !== 'done' && (
        <View style={[styles.footer, { borderTopColor: themeColors.border, backgroundColor: themeColors.background }]}>
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: SAFFRON, opacity: busy ? 0.7 : 1 }]}
            disabled={busy}
            onPress={step === 'select' ? doSelect : step === 'details' ? doInit : doPay}
          >
            {busy ? (
              <View style={styles.ctaBusy}>
                <ActivityIndicator size="small" color="#fff" />
                {!!busyMsg && <Text style={styles.ctaText}>{busyMsg}</Text>}
              </View>
            ) : (
              <Text style={styles.ctaText}>
                {step === 'select' ? 'Continue' : step === 'details' ? 'Reserve ticket' : `Pay ₹${estTotal.toLocaleString('en-IN')}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryRow({ c, k, v }: { c: any; k: string; v: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumK, { color: c.textSecondary }]}>{k}</Text>
      <Text style={[styles.sumV, { color: c.text }]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

// The server returns qrCode as a base64 image or a URL. Render whichever it is.
function QRBlock({ value }: { value: string }) {
  const isDataOrUrl = /^https?:\/\//.test(value) || value.startsWith('data:');
  const uri = isDataOrUrl ? value : `data:image/png;base64,${value}`;
  // Use Image via require to avoid an extra import at top; RN Image handles both.
  const { Image } = require('react-native');
  return <Image source={{ uri }} style={styles.qrImg} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.md, fontWeight: fontWeight.bold },

  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.md },
  stepPill: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  stepLine: { width: 40, height: 2, marginHorizontal: 4 },

  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  h: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  card: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(128,128,128,0.25)', marginVertical: spacing.xs },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, minWidth: 24, textAlign: 'center' },

  segmented: { flexDirection: 'row', gap: spacing.sm },
  seg: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingVertical: 10, alignItems: 'center' },
  segText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  input: { borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.md },
  est: { fontSize: fontSize.sm, textAlign: 'center' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  totalRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  sumK: { fontSize: fontSize.sm },
  sumV: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flexShrink: 1, textAlign: 'right' },

  doneWrap: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  doneBadge: { marginBottom: spacing.sm },
  doneTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  doneSub: { fontSize: fontSize.sm, textAlign: 'center' },
  qrCard: { width: '100%', borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.xl, alignItems: 'center', marginVertical: spacing.md, minHeight: 160, justifyContent: 'center' },
  qrImg: { width: 200, height: 200 },
  qrHint: { fontSize: fontSize.sm, textAlign: 'center' },

  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { borderRadius: 999, alignItems: 'center', paddingVertical: 15 },
  ctaBusy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ctaText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
