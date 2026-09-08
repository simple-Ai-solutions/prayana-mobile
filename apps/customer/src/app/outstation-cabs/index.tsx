// /outstation-cabs — chauffeur-driven intercity cabs. Mobile port of the web
// app/outstation-cabs/{page,search,book}. One screen, three phases:
//   search  → collect route/date/time/tripType (+optional return)
//   fares   → cabAPI.search returns the fully-priced vehicle list (server prices
//             everything; we never compute money on the client)
//   review  → traveller form + fare breakup → book → Razorpay → verify
//
// The NO_REFUND_ACKNOWLEDGEMENT_REQUIRED error means the pickup is inside the
// free-cancellation cutoff; we reveal an acknowledgement checkbox and retry.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius, TextInput } from '@prayana/shared-ui';
import { cabAPI, openCheckout } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../config/env';
import DateField from '../../components/common/DateField';

const YELLOW = '#F59E0B';
const INK = '#1F2937';

type Phase = 'search' | 'fares' | 'review';
type TripType = 'one_way' | 'round_trip';

type Fare = {
  totalAmount?: number;
  baseFare?: number;
  gstAmount?: number;
  driverAllowance?: number;
  platformFee?: number;
  nightCharge?: number;
  tollAmount?: number;
  driverLanguageFee?: number;
  discountAmount?: number;
  currency?: string;
  chargeableKm?: number;
  inclusions?: string[];
  exclusions?: string[];
};
type Vehicle = {
  code: string;
  displayName: string;
  category?: string;
  fuelType?: string;
  seats?: number;
  luggage?: number;
  acAvailable?: boolean;
  rating?: number | null;
  isNew?: boolean;
  imageUrl?: string | null;
  fare?: Fare;
};
type RouteInfo = { from?: string; to?: string; distanceKm?: number; durationText?: string };

export default function OutstationCabsScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('search');

  // Search inputs
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [tripType, setTripType] = useState<TripType>('one_way');
  const [returnDate, setReturnDate] = useState('');

  // Results
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searching, setSearching] = useState(false);

  // Review
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [tName, setTName] = useState((user as any)?.displayName || '');
  const [tGender, setTGender] = useState<'male' | 'female' | 'other'>('male');
  const [tMobile, setTMobile] = useState('');
  const [tEmail, setTEmail] = useState((user as any)?.email || '');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [ack, setAck] = useState(false);
  const [ackRequired, setAckRequired] = useState(false);
  const [ackMessage, setAckMessage] = useState('');
  const [booking, setBooking] = useState(false);

  const runSearch = useCallback(async () => {
    if (!from.trim() || !to.trim()) { Alert.alert('Route needed', 'Enter both pickup and drop cities.'); return; }
    if (!date) { Alert.alert('Pick a date', 'Choose your travel date.'); return; }
    if (tripType === 'round_trip' && !returnDate) { Alert.alert('Return date needed', 'Round trips need a return date.'); return; }
    setSearching(true);
    try {
      const res: any = await cabAPI.search({
        from: from.trim(), to: to.trim(), departureDate: date, pickupTime: time,
        tripType, returnDate: tripType === 'round_trip' ? returnDate : undefined,
      } as any);
      if (res?.code === 'ROUND_TRIP_TOO_SHORT' && res?.suggestedReturnDate) {
        setReturnDate(res.suggestedReturnDate);
        Alert.alert('Return date adjusted', 'We moved your return to the earliest feasible date and re-priced.');
      }
      const data = res?.data || {};
      if (!res?.success && !data.vehicles) {
        Alert.alert('No cabs found', res?.message || 'Try a different route or date.');
        return;
      }
      setRouteInfo(data.route || null);
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
      setPickup((p) => p || from.trim());
      setDrop((d) => d || to.trim());
      setPhase('fares');
    } catch (e: any) {
      Alert.alert('Search failed', e?.message || 'Please try again.');
    } finally {
      setSearching(false);
    }
  }, [from, to, date, time, tripType, returnDate]);

  const pickCab = (v: Vehicle) => { setSelected(v); setAck(false); setAckRequired(false); setPhase('review'); };

  const total = selected?.fare?.totalAmount || 0;

  const doBook = useCallback(async () => {
    if (!selected) return;
    if (!user || (user as any).uid === 'guest-user') {
      Alert.alert('Sign in to book', 'Please sign in to book a cab.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (!tName.trim() || tName.trim().length < 2) { Alert.alert('Name needed', 'Enter the traveller name.'); return; }
    if (!/^[6-9]\d{9}$/.test(tMobile.trim())) { Alert.alert('Valid mobile needed', 'Enter a 10-digit Indian mobile number.'); return; }
    if (!pickup.trim() || pickup.trim().length < 5) { Alert.alert('Pickup address', 'Enter a full pickup address.'); return; }
    if (!drop.trim() || drop.trim().length < 5) { Alert.alert('Drop address', 'Enter a full drop address.'); return; }
    if (ackRequired && !ack) { Alert.alert('Please acknowledge', 'Tick the no-refund acknowledgement to continue.'); return; }

    setBooking(true);
    try {
      const bookRes: any = await cabAPI.book({
        cabVehicleCode: selected.code,
        from: from.trim(), to: to.trim(),
        pickup: { address: pickup.trim() },
        drop: { address: drop.trim() },
        departureDate: date, pickupTime: time,
        tripType, returnDate: tripType === 'round_trip' ? returnDate : undefined,
        traveller: { name: tName.trim(), gender: tGender, mobile: tMobile.trim(), email: tEmail.trim() || undefined },
        acknowledgeNoRefund: ack,
      });

      // The pickup is inside the free-cancellation window → reveal the checkbox.
      if (bookRes?.code === 'NO_REFUND_ACKNOWLEDGEMENT_REQUIRED') {
        setAckRequired(true);
        setAckMessage(bookRes?.policy?.message || 'This booking is inside the free-cancellation window and is non-refundable.');
        Alert.alert('Non-refundable', bookRes?.policy?.message || 'This booking cannot be cancelled for a refund. Tick to acknowledge and try again.');
        return;
      }
      const bookingId = bookRes?.data?.bookingId;
      if (!bookRes?.success || !bookingId) {
        Alert.alert('Could not book', bookRes?.message || 'Please try again.');
        return;
      }

      const orderRes: any = await cabAPI.createPaymentOrder(bookingId);
      const order = orderRes?.data || {};
      if (!orderRes?.success || !order.orderId) {
        Alert.alert('Payment unavailable', orderRes?.message || 'Booking held — try paying again from My Bookings.');
        return;
      }

      const result = await openCheckout({
        keyId: order.keyId || ENV.razorpayKeyId,
        orderId: order.orderId,
        amountInPaise: order.amount ?? Math.round(total * 100),
        currency: order.currency || 'INR',
        name: 'PrayanaAI Cabs',
        description: `${selected.displayName} · ${from.trim()} → ${to.trim()}`,
        themeColor: YELLOW,
        prefill: { email: tEmail || undefined, contact: tMobile || undefined, name: tName || undefined },
        notes: { bookingId, ref: order.bookingReference || '' },
      });
      if (result.status === 'cancelled') return;
      if (result.status === 'failed') { Alert.alert('Payment failed', result.reason || 'Please try again.'); return; }

      const verifyRes: any = await cabAPI.verifyPayment(bookingId, {
        razorpayPaymentId: result.paymentId,
        razorpaySignature: result.signature,
      });
      if (verifyRes?.success || verifyRes?.data?.paymentStatus === 'paid') {
        Alert.alert('Cab booked! 🚕', `Payment received. Your booking ${order.bookingReference || ''} is confirmed.`, [
          { text: 'View My Bookings', onPress: () => router.replace('/bookings') },
        ]);
      } else {
        Alert.alert('Payment captured', `Do NOT pay again. Reference ${order.bookingReference || bookingId} — contact support if it doesn't confirm shortly.`);
      }
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setBooking(false);
    }
  }, [selected, user, tName, tGender, tMobile, tEmail, pickup, drop, ack, ackRequired, from, to, date, time, tripType, returnDate, total]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (phase === 'search' ? router.back() : setPhase(phase === 'review' ? 'fares' : 'search'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>
          {phase === 'search' ? 'Outstation Cabs' : phase === 'fares' ? 'Choose a cab' : 'Review & pay'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {phase === 'search' && (
          <>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.segmented}>
                {(['one_way', 'round_trip'] as TripType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.seg, { borderColor: tripType === t ? YELLOW : themeColors.border, backgroundColor: tripType === t ? YELLOW + '22' : 'transparent' }]}
                    onPress={() => setTripType(t)}
                  >
                    <Text style={[styles.segText, { color: tripType === t ? '#B45309' : themeColors.textSecondary }]}>
                      {t === 'one_way' ? 'One way' : 'Round trip'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput label="From (pickup city)" value={from} onChangeText={setFrom} placeholder="e.g. Bengaluru" />
              <TextInput label="To (drop city)" value={to} onChangeText={setTo} placeholder="e.g. Mysuru" />
              <DateField label="Travel date" value={date} onChange={setDate} placeholder="Select date" minimumDate={new Date()} />
              <TextInput label="Pickup time (HH:mm)" value={time} onChangeText={setTime} placeholder="09:00" />
              {tripType === 'round_trip' && (
                <DateField
                  label="Return date"
                  value={returnDate}
                  onChange={setReturnDate}
                  placeholder="Select return date"
                  minimumDate={date ? new Date(date) : new Date()}
                />
              )}
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: YELLOW, opacity: searching ? 0.7 : 1 }]} onPress={runSearch} disabled={searching}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Search cabs</Text>}
            </TouchableOpacity>
          </>
        )}

        {phase === 'fares' && (
          <>
            {routeInfo && (
              <View style={[styles.routeStrip, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={[styles.routeText, { color: themeColors.text }]} numberOfLines={1}>
                  {routeInfo.from} → {routeInfo.to}
                </Text>
                <Text style={[styles.routeMeta, { color: themeColors.textSecondary }]}>
                  {routeInfo.distanceKm ? `${routeInfo.distanceKm} km` : ''}{routeInfo.durationText ? ` · ${routeInfo.durationText}` : ''}
                </Text>
              </View>
            )}
            {vehicles.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="car-outline" size={40} color={themeColors.textTertiary} />
                <Text style={[styles.dim, { color: themeColors.textSecondary }]}>No cabs for this route yet.</Text>
              </View>
            ) : (
              vehicles.map((v) => (
                <TouchableOpacity
                  key={v.code}
                  style={[styles.cabCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  activeOpacity={0.9}
                  onPress={() => pickCab(v)}
                >
                  <View style={styles.cabIcon}><Ionicons name="car-sport" size={26} color={YELLOW} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cabName, { color: themeColors.text }]} numberOfLines={1}>{v.category || v.displayName}</Text>
                    <Text style={[styles.cabSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {v.displayName}{v.seats ? ` · ${v.seats} seats` : ''}{v.acAvailable ? ' · AC' : ''}
                    </Text>
                    {!!v.fare?.chargeableKm && (
                      <Text style={[styles.cabKm, { color: themeColors.textTertiary }]}>{v.fare.chargeableKm} km included</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.cabPrice, { color: themeColors.text }]}>₹{Number(v.fare?.totalAmount || 0).toLocaleString('en-IN')}</Text>
                    <Text style={[styles.cabPriceSub, { color: YELLOW }]}>Select ›</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {phase === 'review' && selected && (
          <>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.reviewCab, { color: themeColors.text }]}>{selected.category || selected.displayName}</Text>
              <Text style={[styles.cabSub, { color: themeColors.textSecondary }]}>{from.trim()} → {to.trim()} · {date} {time}</Text>
            </View>

            {/* Traveller */}
            <Text style={[styles.h, { color: themeColors.text }]}>Traveller details</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <TextInput label="Full name" value={tName} onChangeText={setTName} placeholder="As on your ID" />
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderChip, { borderColor: tGender === g ? YELLOW : themeColors.border, backgroundColor: tGender === g ? YELLOW + '22' : 'transparent' }]}
                    onPress={() => setTGender(g)}
                  >
                    <Text style={[styles.genderText, { color: tGender === g ? '#B45309' : themeColors.textSecondary }]}>
                      {g[0].toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput label="Mobile" value={tMobile} onChangeText={setTMobile} placeholder="10-digit mobile" keyboardType="phone-pad" />
              <TextInput label="Email (optional)" value={tEmail} onChangeText={setTEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
              <TextInput label="Pickup address" value={pickup} onChangeText={setPickup} placeholder="Full pickup address" />
              <TextInput label="Drop address" value={drop} onChangeText={setDrop} placeholder="Full drop address" />
            </View>

            {/* Fare breakup */}
            <Text style={[styles.h, { color: themeColors.text }]}>Fare breakup</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <FareRow c={themeColors} k="Base fare" v={selected.fare?.baseFare} />
              <FareRow c={themeColors} k="Driver allowance" v={selected.fare?.driverAllowance} />
              {!!selected.fare?.nightCharge && <FareRow c={themeColors} k="Night charge" v={selected.fare?.nightCharge} />}
              {!!selected.fare?.tollAmount && <FareRow c={themeColors} k="Tolls (est.)" v={selected.fare?.tollAmount} />}
              {!!selected.fare?.driverLanguageFee && <FareRow c={themeColors} k="Language fee" v={selected.fare?.driverLanguageFee} />}
              <FareRow c={themeColors} k="GST" v={selected.fare?.gstAmount} />
              <FareRow c={themeColors} k="Platform fee" v={selected.fare?.platformFee} />
              {!!selected.fare?.discountAmount && <FareRow c={themeColors} k="Discount" v={-(selected.fare?.discountAmount || 0)} />}
              <View style={[styles.fareDivider, { backgroundColor: themeColors.border }]} />
              <View style={styles.fareRow}>
                <Text style={[styles.fareTotalK, { color: themeColors.text }]}>Total</Text>
                <Text style={[styles.fareTotalV, { color: themeColors.text }]}>₹{total.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* No-refund acknowledgement (only when server requires it) */}
            {ackRequired && (
              <TouchableOpacity style={styles.ackRow} activeOpacity={0.7} onPress={() => setAck((v) => !v)}>
                <View style={[styles.checkbox, ack && { backgroundColor: YELLOW, borderColor: YELLOW }]}>
                  {ack && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.ackText, { color: themeColors.textSecondary }]}>{ackMessage}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {phase === 'review' && selected && (
        <View style={[styles.footer, { borderTopColor: themeColors.border, backgroundColor: themeColors.background }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.footerTotal, { color: themeColors.text }]}>₹{total.toLocaleString('en-IN')}</Text>
            <Text style={[styles.footerSub, { color: themeColors.textSecondary }]}>all-inclusive</Text>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: YELLOW, opacity: booking ? 0.6 : 1 }]}
            onPress={doBook}
            disabled={booking}
          >
            {booking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.payBtnText}>Pay ₹{total.toLocaleString('en-IN')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function FareRow({ c, k, v }: { c: any; k: string; v?: number }) {
  if (v == null) return null;
  const neg = v < 0;
  return (
    <View style={styles.fareRow}>
      <Text style={[styles.fareK, { color: c.textSecondary }]}>{k}</Text>
      <Text style={[styles.fareV, { color: neg ? '#10B981' : c.text }]}>
        {neg ? '−' : ''}₹{Math.abs(v).toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  card: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.md },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  seg: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingVertical: 10, alignItems: 'center' },
  segText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  primaryBtn: { borderRadius: 999, alignItems: 'center', paddingVertical: 15 },
  primaryBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },

  routeStrip: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  routeText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  routeMeta: { fontSize: fontSize.xs, marginTop: 2 },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: 50 },
  dim: { fontSize: fontSize.sm, textAlign: 'center' },

  cabCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md },
  cabIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: YELLOW + '1A', alignItems: 'center', justifyContent: 'center' },
  cabName: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cabSub: { fontSize: fontSize.xs, marginTop: 2 },
  cabKm: { fontSize: 11, marginTop: 2 },
  cabPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cabPriceSub: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 2 },

  reviewCab: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  h: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderChip: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingVertical: 9, alignItems: 'center' },
  genderText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareK: { fontSize: fontSize.sm },
  fareV: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fareDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  fareTotalK: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  fareTotalV: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ackText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  footerTotal: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  footerSub: { fontSize: fontSize.xs },
  payBtn: { borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: 14, alignItems: 'center', minWidth: 150 },
  payBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
