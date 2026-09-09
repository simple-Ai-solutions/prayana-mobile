// /outstation-cabs — chauffeur-driven intercity cabs. Mobile port of the web
// app/outstation-cabs/{page,search,book}. One screen, three phases:
//   search  → collect route/date/time/tripType (+optional return)
//   fares   → cabAPI.search returns the fully-priced vehicle list (server prices
//             everything; we never compute money on the client)
//   review  → traveller form + fare breakup → book → Razorpay → verify
//
// Palette mirrors the PWA: ORANGE search CTA, EMERALD results/fare cards,
// BLUE review page + Pay button. Prices are neutral ink; green = savings only.
//
// The NO_REFUND_ACKNOWLEDGEMENT_REQUIRED error means the pickup is inside the
// free-cancellation cutoff; we reveal an acknowledgement checkbox and retry.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius, TextInput } from '@prayana/shared-ui';
import { cabAPI, openCheckout } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../config/env';
import DateField from '../../components/common/DateField';

// PWA palette
const ORANGE = '#f97316';   // search / success CTA
const EMERALD = '#059669';  // results + fare-card structural accent
const EMERALD_BG = '#ecfdf5';
const EMERALD_BORDER = '#a7f3d0';
const EMERALD_TEXT = '#047857';
const BLUE = '#1d4ed8';     // review page + Pay
const BLUE_DARK = '#1e3a8a';
const BLUE_BG = '#eff6ff';
const BLUE_TEXT = '#1d4ed8';
const VIOLET = '#7c3aed';
const VIOLET_BG = '#f5f3ff';
const VIOLET_TEXT = '#6d28d9';
const AMBER = '#d97706';
const AMBER_BG = '#fffbeb';
const ROSE = '#e11d48';
const GREEN = '#10b981';
const SLATE_400 = '#94a3b8';

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
  includedKm?: number;
  extraKmRate?: number;
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

const CATEGORY_TINT: Record<string, string> = {
  hatchback: '#e0f2fe',
  sedan: '#ede9fe',
  suv: '#fef3c7',
  muv: '#fef3c7',
};

const inr = (n?: number) => Number(n || 0).toLocaleString('en-IN');
const inr2 = (n?: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // The cheapest fare gets the "Cheapest" badge; highest-rated gets "Best value".
  const badges = useMemo(() => {
    const map: Record<string, 'cheapest' | 'best'> = {};
    if (vehicles.length > 1) {
      let cheapest = vehicles[0];
      for (const v of vehicles) {
        if ((v.fare?.totalAmount ?? Infinity) < (cheapest.fare?.totalAmount ?? Infinity)) cheapest = v;
      }
      map[cheapest.code] = 'cheapest';
      const rated = vehicles.filter((v) => (v.rating ?? 0) > 0 && v.code !== cheapest.code);
      if (rated.length) {
        const best = rated.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a));
        map[best.code] = 'best';
      }
    }
    return map;
  }, [vehicles]);

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

  const swap = () => { setFrom(to); setTo(from); };
  const pickCab = (v: Vehicle) => { setSelected(v); setAck(false); setAckRequired(false); setPhase('review'); };

  const total = selected?.fare?.totalAmount || 0;
  const discount = selected?.fare?.discountAmount || 0;
  const gross = total + discount;

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
        themeColor: ORANGE,
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

  const headerColor = phase === 'review' ? BLUE : phase === 'fares' ? EMERALD : themeColors.text;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: phase === 'search' ? themeColors.background : '#f8fafc' }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          onPress={() => (phase === 'search' ? router.back() : setPhase(phase === 'review' ? 'fares' : 'search'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>
          {phase === 'search' ? 'Outstation Cabs' : phase === 'fares' ? 'Choose your cab' : 'Review & pay'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {/* ───────────────────────── SEARCH ───────────────────────── */}
        {phase === 'search' && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Ionicons name="car-sport" size={15} color={ORANGE} />
                <Text style={styles.heroBadgeText}>Chauffeur-driven · Intercity</Text>
              </View>
              <Text style={[styles.heroTitle, { color: themeColors.text }]}>Book an outstation cab</Text>
              <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
                Transparent all-inclusive fares. Verified drivers. Pay online.
              </Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {/* Trip-type radios */}
              <View style={styles.tripRow}>
                {(['one_way', 'round_trip'] as TripType[]).map((t) => {
                  const on = tripType === t;
                  return (
                    <TouchableOpacity key={t} style={styles.radio} activeOpacity={0.7} onPress={() => setTripType(t)}>
                      <View style={[styles.radioDot, { borderColor: on ? EMERALD : '#cbd5e1' }]}>
                        {on && <View style={styles.radioDotInner} />}
                      </View>
                      <Text style={[styles.radioLabel, { color: on ? themeColors.text : themeColors.textSecondary }]}>
                        {t === 'one_way' ? 'One-Way' : 'Round-Trip'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* From with emerald dot */}
              <FieldWithDot dot={EMERALD}>
                <TextInput label="Pickup Point" value={from} onChangeText={setFrom} placeholder="Bangalore, Karnataka" />
              </FieldWithDot>

              {/* Swap */}
              <TouchableOpacity style={styles.swapBtn} onPress={swap} activeOpacity={0.8}>
                <Ionicons name="swap-vertical" size={16} color="#0f766e" />
              </TouchableOpacity>

              {/* To with rose dot */}
              <FieldWithDot dot={ROSE}>
                <TextInput label="Drop-off Point" value={to} onChangeText={setTo} placeholder="Mysore, Karnataka" />
              </FieldWithDot>

              <DateField label="Travel date" value={date} onChange={setDate} placeholder="Select date" minimumDate={new Date()} />
              <TextInput label="Pickup time (HH:mm)" value={time} onChangeText={setTime} placeholder="09:00" />
              {tripType === 'round_trip' && (
                <>
                  <DateField
                    label="Return date"
                    value={returnDate}
                    onChange={setReturnDate}
                    placeholder="Select return date"
                    minimumDate={date ? new Date(date) : new Date()}
                  />
                  <Text style={[styles.noteLine, { color: themeColors.textSecondary }]}>
                    Same cab & driver both ways · returns by 11:00 PM · billed per day.
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity style={[styles.searchBtn, { opacity: searching ? 0.6 : 1 }]} onPress={runSearch} disabled={searching} activeOpacity={0.9}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="search" size={18} color="#fff" />
                  <Text style={styles.searchBtnText}>Search Cabs</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ───────────────────────── FARES ───────────────────────── */}
        {phase === 'fares' && (
          <>
            {/* Route summary strip (emerald) */}
            <View style={styles.routeStrip}>
              <View style={styles.routeStripRow}>
                <View style={[styles.dot, { backgroundColor: EMERALD }]} />
                <Text style={[styles.routeStripVal, { color: themeColors.text }]} numberOfLines={1}>{routeInfo?.from || from}</Text>
              </View>
              <View style={styles.routeStripRow}>
                <Ionicons name="location" size={13} color={ROSE} />
                <Text style={[styles.routeStripVal, { color: themeColors.text }]} numberOfLines={1}>{routeInfo?.to || to}</Text>
              </View>
              <View style={styles.routeStripMetaRow}>
                {!!routeInfo?.distanceKm && (
                  <View style={[styles.metaPill, { backgroundColor: BLUE_BG }]}>
                    <Ionicons name="navigate" size={11} color={BLUE_TEXT} />
                    <Text style={[styles.metaPillText, { color: BLUE_TEXT }]}>{routeInfo.distanceKm} km</Text>
                  </View>
                )}
                {!!routeInfo?.durationText && (
                  <View style={[styles.metaPill, { backgroundColor: VIOLET_BG }]}>
                    <Ionicons name="time-outline" size={11} color={VIOLET_TEXT} />
                    <Text style={[styles.metaPillText, { color: VIOLET_TEXT }]}>{routeInfo.durationText}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.editBtn} onPress={() => setPhase('search')}>
                  <Ionicons name="pencil" size={12} color="#fff" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Results header */}
            <View style={styles.resultsHeader}>
              <View style={styles.resultsHeaderIcon}><Ionicons name="car" size={15} color={EMERALD_TEXT} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultsCount, { color: themeColors.text }]}>{vehicles.length} vehicles found</Text>
                <Text style={styles.resultsSub}>All prices inclusive of taxes</Text>
              </View>
            </View>

            {vehicles.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="car-outline" size={40} color={SLATE_400} />
                <Text style={[styles.dim, { color: themeColors.textSecondary }]}>No cabs for this route yet.</Text>
              </View>
            ) : (
              vehicles.map((v) => {
                const badge = badges[v.code];
                const borderColor = badge === 'best' ? '#c4b5fd' : EMERALD_BORDER;
                const tint = CATEGORY_TINT[(v.category || '').toLowerCase()] || '#f1f5f9';
                const includedKm = v.fare?.includedKm ?? v.fare?.chargeableKm;
                return (
                  <View key={v.code} style={[styles.fareCard, { borderColor, paddingTop: badge ? 40 : spacing.lg }]}>
                    {badge && (
                      <View style={[styles.badge, { backgroundColor: badge === 'best' ? VIOLET_BG : EMERALD_BG }]}>
                        <Text style={[styles.badgeText, { color: badge === 'best' ? VIOLET_TEXT : EMERALD_TEXT }]}>
                          {badge === 'best' ? 'Best value' : 'Cheapest'}
                        </Text>
                      </View>
                    )}

                    {/* Artwork */}
                    <View style={[styles.artTile, { backgroundColor: tint }]}>
                      {v.imageUrl ? (
                        <Image source={{ uri: v.imageUrl }} style={styles.artImg} resizeMode="cover" />
                      ) : (
                        <Ionicons name="car-sport" size={44} color="#64748b" />
                      )}
                    </View>

                    {/* Identity */}
                    <View style={styles.idRow}>
                      <Text style={[styles.cabName, { color: themeColors.text }]} numberOfLines={1}>{v.displayName}</Text>
                      {!!v.rating && v.rating > 0 && (
                        <View style={styles.ratingChip}>
                          <Ionicons name="star" size={11} color="#f59e0b" />
                          <Text style={styles.ratingText}>{v.rating.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cabSub}>
                      {[v.category, v.fuelType, v.acAvailable === false ? 'Non-AC' : 'AC'].filter(Boolean).join(' · ')}
                    </Text>

                    <View style={styles.pillRow}>
                      {!!v.seats && (
                        <View style={styles.featPill}>
                          <Ionicons name="people-outline" size={13} color={SLATE_400} />
                          <Text style={styles.featPillText}>{v.seats} Seats</Text>
                        </View>
                      )}
                      {!!v.luggage && (
                        <View style={styles.featPill}>
                          <Ionicons name="briefcase-outline" size={13} color={SLATE_400} />
                          <Text style={styles.featPillText}>{v.luggage} Bags</Text>
                        </View>
                      )}
                    </View>

                    {/* Fare block, fenced by dashed rule */}
                    <View style={styles.fareBlock}>
                      <View>
                        <Text style={[styles.farePrice, { color: themeColors.text }]}>₹{inr2(v.fare?.totalAmount)}</Text>
                        <Text style={styles.fareCaption}>PER CAR</Text>
                        {!!includedKm && (
                          <View style={styles.kmPill}>
                            <Text style={styles.kmPillText}>{includedKm} km included</Text>
                          </View>
                        )}
                        {!!v.fare?.extraKmRate && (
                          <Text style={styles.extraKm}>Extra km ₹{inr(v.fare.extraKmRate)}/km</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.selectBtn, { borderColor: badge === 'best' ? '#c4b5fd' : '#6ee7b7' }]}
                        onPress={() => pickCab(v)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.selectBtnText, { color: badge === 'best' ? VIOLET_TEXT : EMERALD_TEXT }]}>View Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ───────────────────────── REVIEW ───────────────────────── */}
        {phase === 'review' && selected && (
          <>
            {/* Route timeline + chosen cab */}
            <View style={[styles.reviewCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.timeline}>
                <TimelineNode color={EMERALD} halo="#d1fae5" label="PICKUP" value={from.trim()} c={themeColors} rail />
                <TimelineNode color={ROSE} halo="#ffe4e6" label="DROP-OFF" value={to.trim()} c={themeColors} />
              </View>
              <View style={styles.chipRow}>
                {!!routeInfo?.distanceKm && (
                  <View style={[styles.metaPill, { backgroundColor: BLUE_BG }]}>
                    <Ionicons name="navigate" size={11} color={BLUE_TEXT} />
                    <Text style={[styles.metaPillText, { color: BLUE_TEXT }]}>{routeInfo.distanceKm} km</Text>
                  </View>
                )}
                {tripType === 'round_trip' && (
                  <View style={[styles.metaPill, { backgroundColor: AMBER_BG }]}>
                    <Ionicons name="refresh" size={11} color={AMBER} />
                    <Text style={[styles.metaPillText, { color: AMBER }]}>Round trip · returns by 11 PM</Text>
                  </View>
                )}
              </View>

              <View style={[styles.chosenCab, { borderTopColor: themeColors.border }]}>
                <View style={styles.chosenTile}><Ionicons name="car-sport" size={28} color="#64748b" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chosenName, { color: themeColors.text }]} numberOfLines={1}>{selected.displayName}</Text>
                  <Text style={styles.cabSub}>
                    {[selected.category, selected.acAvailable === false ? 'Non-AC' : 'AC',
                      selected.seats ? `${selected.seats} Seats` : null,
                      selected.luggage ? `${selected.luggage} Bags` : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.chosenPrice, { color: themeColors.text }]}>₹{inr(total)}</Text>
              </View>
            </View>

            {/* Traveller */}
            <View style={[styles.reviewCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: BLUE_BG }]}><Ionicons name="person" size={16} color={BLUE_TEXT} /></View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Traveller details</Text>
              </View>
              <TextInput label="Full name" value={tName} onChangeText={setTName} placeholder="As on your ID" />
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((g) => {
                  const on = tGender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderChip, { borderColor: on ? BLUE : themeColors.border, backgroundColor: on ? BLUE_BG : 'transparent' }]}
                      onPress={() => setTGender(g)}
                    >
                      <Text style={[styles.genderText, { color: on ? BLUE_TEXT : themeColors.textSecondary }]}>
                        {g[0].toUpperCase() + g.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput label="Mobile" value={tMobile} onChangeText={setTMobile} placeholder="10-digit mobile" keyboardType="phone-pad" />
              <TextInput label="Email (optional)" value={tEmail} onChangeText={setTEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
              <TextInput label="Exact pickup address" value={pickup} onChangeText={setPickup} placeholder="Flat, building, landmark, city" />
              <TextInput label="Exact drop address" value={drop} onChangeText={setDrop} placeholder="Flat, building, landmark, city" />
            </View>

            {/* Fare breakup */}
            <View style={[styles.reviewCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: BLUE_BG }]}><Ionicons name="receipt-outline" size={16} color={BLUE_TEXT} /></View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Fare breakup</Text>
              </View>
              <FareRow c={themeColors} icon="car-outline" k={`Base fare${selected.fare?.chargeableKm ? ` · ${selected.fare.chargeableKm} km` : ''}`} v={selected.fare?.baseFare} />
              <FareRow c={themeColors} icon="person-outline" k="Driver allowance" v={selected.fare?.driverAllowance} />
              {!!selected.fare?.nightCharge && <FareRow c={themeColors} icon="moon-outline" k="Night charge" v={selected.fare?.nightCharge} />}
              <FareRow c={themeColors} icon="receipt-outline" k="GST" v={selected.fare?.gstAmount} />
              <FareRow c={themeColors} icon="business-outline" k="Platform fee" v={selected.fare?.platformFee} />
              {!!selected.fare?.tollAmount && <FareRow c={themeColors} icon="cash-outline" k="Tolls" sub="FASTag estimate · paid on your behalf" v={selected.fare?.tollAmount} />}
              {!!selected.fare?.driverLanguageFee && <FareRow c={themeColors} icon="language-outline" k="Language-speaking driver" sub="Add-on" v={selected.fare?.driverLanguageFee} />}
              {!!discount && (
                <>
                  <View style={[styles.dashDivider, { borderColor: themeColors.border }]} />
                  <FareRow c={themeColors} icon="pricetag-outline" k="Discount" v={-discount} />
                </>
              )}
              {!!discount && (
                <View style={styles.saveBanner}>
                  <Ionicons name="sparkles" size={13} color={EMERALD_TEXT} />
                  <Text style={styles.saveBannerText}>You save ₹{inr(discount)}</Text>
                </View>
              )}

              {/* Blue total bar */}
              <View style={styles.totalBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.totalBarLabel}>Total payable</Text>
                  <Text style={styles.totalBarSub}>Incl. all taxes and fees</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {!!discount && <Text style={styles.totalBarStrike}>₹{inr(gross)}</Text>}
                  <Text style={styles.totalBarValue}>₹{inr(total)}</Text>
                </View>
              </View>
            </View>

            {/* No-refund acknowledgement */}
            {ackRequired && (
              <TouchableOpacity style={styles.ackRow} activeOpacity={0.7} onPress={() => setAck((val) => !val)}>
                <View style={[styles.checkbox, ack && { backgroundColor: AMBER, borderColor: AMBER }]}>
                  {ack && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.ackText, { color: '#92400e' }]}>{ackMessage}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {phase === 'review' && selected && (
        <View style={[styles.footer, { borderTopColor: themeColors.border, backgroundColor: themeColors.background }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.footerTotal, { color: themeColors.text }]}>₹{inr(total)}</Text>
            <Text style={[styles.footerSub, { color: themeColors.textSecondary }]}>incl. all taxes & fees</Text>
          </View>
          <TouchableOpacity style={[styles.payBtn, { opacity: booking ? 0.6 : 1 }]} onPress={doBook} disabled={booking} activeOpacity={0.9}>
            {booking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.payBtnText}>PAY NOW</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function FieldWithDot({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWithDot}>
      <View style={[styles.fieldDot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function TimelineNode({ color, halo, label, value, c, rail }: { color: string; halo: string; label: string; value: string; c: any; rail?: boolean }) {
  return (
    <View style={styles.tlNode}>
      <View style={styles.tlLeft}>
        <View style={[styles.tlHalo, { backgroundColor: halo }]}>
          <View style={[styles.tlDot, { backgroundColor: color }]} />
        </View>
        {rail && <View style={styles.tlRail} />}
      </View>
      <View style={{ flex: 1, paddingBottom: rail ? spacing.md : 0 }}>
        <Text style={[styles.tlLabel, { color }]}>{label}</Text>
        <Text style={[styles.tlValue, { color: c.text }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function FareRow({ c, icon, k, sub, v }: { c: any; icon: any; k: string; sub?: string; v?: number }) {
  if (v == null) return null;
  const neg = v < 0;
  return (
    <View style={styles.fareRow}>
      <Ionicons name={icon} size={14} color={SLATE_400} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.fareK, { color: c.text }]}>{k}</Text>
        {!!sub && <Text style={styles.fareSub}>{sub}</Text>}
      </View>
      <Text style={[styles.fareV, { color: neg ? EMERALD_TEXT : c.text }]}>
        {neg ? '− ' : ''}₹{inr(Math.abs(v))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  // Hero
  hero: { gap: 6, marginBottom: spacing.xs },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroBadgeText: { fontSize: 11, fontWeight: fontWeight.bold, color: ORANGE },
  heroTitle: { fontSize: 24, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  heroSub: { fontSize: fontSize.sm, lineHeight: 20 },

  // Search form
  formCard: { borderWidth: 1, borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  tripRow: { flexDirection: 'row', gap: 24 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: EMERALD },
  radioLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  fieldWithDot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldDot: { width: 8, height: 8, borderRadius: 4, marginTop: 20 },
  swapBtn: { alignSelf: 'center', width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', marginVertical: -4 },
  noteLine: { fontSize: 12, lineHeight: 17 },

  searchBtn: { flexDirection: 'row', gap: 8, backgroundColor: ORANGE, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  searchBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },

  // Route strip
  routeStrip: { borderWidth: 1, borderColor: EMERALD_BORDER, borderRadius: 16, backgroundColor: '#fff', padding: spacing.md, gap: 6 },
  routeStripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeStripVal: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  routeStripMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  metaPillText: { fontSize: 12, fontWeight: fontWeight.bold },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: '#065f46', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  editBtnText: { color: '#fff', fontSize: 12, fontWeight: fontWeight.bold },

  // Results header
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  resultsHeaderIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  resultsCount: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  resultsSub: { fontSize: 12, color: '#64748b', marginTop: 1 },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: 50 },
  dim: { fontSize: fontSize.sm, textAlign: 'center' },

  // Fare card
  fareCard: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderRadius: 16, backgroundColor: '#fff', padding: spacing.lg },
  badge: { position: 'absolute', left: spacing.lg, top: 14, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, zIndex: 2 },
  badgeText: { fontSize: 10, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  artTile: { height: 130, width: '100%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artImg: { width: '100%', height: '100%' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  cabName: { flexShrink: 1, fontSize: 17, fontWeight: fontWeight.bold },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { fontSize: 12, fontWeight: fontWeight.bold, color: '#b45309' },
  cabSub: { fontSize: 13, color: '#64748b', marginTop: 3 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  featPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  featPillText: { fontSize: 13, color: '#475569', fontWeight: fontWeight.medium },
  fareBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: EMERALD_BORDER, borderStyle: 'dashed', marginTop: spacing.md, paddingTop: spacing.md },
  farePrice: { fontSize: 26, fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  fareCaption: { fontSize: 10, fontWeight: fontWeight.bold, color: SLATE_400, letterSpacing: 0.6, marginTop: 3 },
  kmPill: { alignSelf: 'flex-start', backgroundColor: EMERALD_BG, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  kmPillText: { fontSize: 12, fontWeight: fontWeight.bold, color: EMERALD_TEXT },
  extraKm: { fontSize: 11, color: '#64748b', marginTop: 4 },
  selectBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  selectBtnText: { fontSize: 13, fontWeight: fontWeight.bold },

  // Review — route timeline
  reviewCard: { borderWidth: 1, borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  timeline: { gap: 0 },
  tlNode: { flexDirection: 'row', gap: 12 },
  tlLeft: { alignItems: 'center', width: 20 },
  tlHalo: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 5 },
  tlRail: { flex: 1, width: 2, backgroundColor: '#d1d5db', marginVertical: 2 },
  tlLabel: { fontSize: 11, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  tlValue: { fontSize: 16, fontWeight: fontWeight.bold, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chosenCab: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  chosenTile: { width: 64, height: 46, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  chosenName: { fontSize: 16, fontWeight: fontWeight.bold },
  chosenPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: fontWeight.bold },

  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderChip: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  genderText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Fare breakup rows
  fareRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  fareK: { fontSize: 13, fontWeight: fontWeight.medium },
  fareSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  fareV: { fontSize: 13, fontWeight: fontWeight.bold },
  dashDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 4 },
  saveBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: EMERALD_BG, borderRadius: 8, paddingVertical: 8, marginTop: 4 },
  saveBannerText: { fontSize: 13, fontWeight: fontWeight.bold, color: EMERALD_TEXT },

  totalBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 14, marginTop: spacing.sm, backgroundColor: BLUE_DARK },
  totalBarLabel: { fontSize: 14, fontWeight: fontWeight.bold, color: '#fff' },
  totalBarSub: { fontSize: 11, color: '#bfdbfe', marginTop: 2 },
  totalBarStrike: { fontSize: 12, color: '#bfdbfe', textDecorationLine: 'line-through' },
  totalBarValue: { fontSize: 22, fontWeight: fontWeight.bold, color: '#fff' },

  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: AMBER_BG, borderRadius: 12, padding: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#d97706', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ackText: { flex: 1, fontSize: fontSize.xs, lineHeight: 18 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  footerTotal: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  footerSub: { fontSize: fontSize.xs },
  payBtn: { backgroundColor: BLUE, borderRadius: 14, paddingHorizontal: spacing.xl, paddingVertical: 15, alignItems: 'center', minWidth: 160, shadowColor: BLUE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  payBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md, letterSpacing: 0.5 },
});
