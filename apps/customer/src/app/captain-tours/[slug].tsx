// /captain-tours/[slug] — captain-run tour detail + booking, mobile port of the
// web app/captain-tours/[slug]/page.js. Loads the tour via captainAPI, shows
// hero + day-by-day itinerary + inclusions, lets the traveler pick a departure
// batch and enter a lead booker, then creates a booking (POST /captain/bookings
// with tourSlug + batchId) and fires payment-link emails. Payment is collected
// per-traveller via those emailed links (the web does the same), so the mobile
// flow confirms "check your email to pay".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius, TextInput } from '@prayana/shared-ui';
import { captainAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const TEAL = '#4AC0CC';

type Batch = {
  _id: string;
  startDate?: string;
  endDate?: string;
  capacityTotal?: number;
  capacityBooked?: number;
  status?: string;
  priceOverridePerPerson?: number | null;
};
type ItineraryDay = { dayNumber?: number; title?: string | null; description?: string | null };
type Tour = {
  _id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  heroImage?: string | null;
  images?: { url: string }[];
  destinations?: { city?: string; state?: string }[];
  durationDays?: number | null;
  durationNights?: number | null;
  itinerary?: ItineraryDay[];
  inclusions?: string[];
  pricing?: { pricePerPerson?: number | null; currency?: string };
  departureBatches?: Batch[];
  minGroupSize?: number;
  stats?: { averageRating?: number };
};

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const seatsLeft = (b: Batch) => Math.max(0, (b.capacityTotal || 0) - (b.capacityBooked || 0));
const bookable = (b: Batch) => (b.status === 'open' || b.status === 'filling') && seatsLeft(b) > 0;

export default function CaptainTourDetailScreen() {
  const { themeColors } = useTheme();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState((user as any)?.displayName || '');
  const [email, setEmail] = useState((user as any)?.email || '');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const res: any = await captainAPI.getTourBySlug(String(slug));
      const t = res?.tour || res?.data || null;
      setTour(t);
      const firstOpen = (t?.departureBatches || []).find((b: Batch) => bookable(b));
      if (firstOpen) setBatchId(firstOpen._id);
    } catch {
      // leave null → error state
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const selectedBatch = useMemo(
    () => tour?.departureBatches?.find((b) => b._id === batchId) || null,
    [tour, batchId]
  );
  const perPerson = selectedBatch?.priceOverridePerPerson ?? tour?.pricing?.pricePerPerson ?? 0;
  const total = perPerson * seats;
  const openBatches = (tour?.departureBatches || []).filter(bookable);

  const book = useCallback(async () => {
    if (!tour) return;
    if (!user || (user as any).uid === 'guest-user') {
      Alert.alert('Sign in to book', 'Please sign in to book this trip.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (!batchId) { Alert.alert('Pick a departure', 'Choose an available departure date.'); return; }
    if (!name.trim() || !email.trim()) { Alert.alert('Details needed', 'Enter the lead traveller name and email.'); return; }

    setSubmitting(true);
    try {
      // Lead booker + one traveller row per seat (booker fills seat 1).
      const travelers = Array.from({ length: seats }, (_, i) =>
        i === 0
          ? { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined }
          : { name: `${name.trim()} +${i}`, email: email.trim() }
      );
      const res: any = await captainAPI.createBooking({
        tourSlug: tour.slug,
        batchId,
        booker: { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined },
        travelers,
      });
      const bookingId = res?.booking?._id || res?.data?._id;
      if (!res?.success && !bookingId) {
        Alert.alert('Could not book', res?.message || 'Please try again.');
        return;
      }
      if (bookingId) captainAPI.notifyPaymentLinks(bookingId).catch(() => {});
      Alert.alert(
        'Booking requested! 🎉',
        `We've emailed a secure payment link to each traveller at ${email.trim()}. Pay to confirm your seat — your booking holds until then.`,
        [{ text: 'View My Bookings', onPress: () => router.replace('/bookings') }]
      );
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('need_auth')) {
        Alert.alert('Sign in to book', 'Please sign in to book this trip.');
      } else {
        Alert.alert('Something went wrong', msg || 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [tour, user, batchId, name, email, phone, seats]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>
      </SafeAreaView>
    );
  }
  if (!tour) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
          <Text style={[styles.dim, { color: themeColors.textSecondary }]}>This tour isn't available.</Text>
          <TouchableOpacity style={[styles.cta, { backgroundColor: TEAL }]} onPress={() => router.back()}>
            <Text style={styles.ctaText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const img = tour.heroImage || tour.images?.[0]?.url || null;
  const city = tour.destinations?.[0]?.city || '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View style={styles.hero}>
          {img ? (
            <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#CFF3F6' }]} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle} numberOfLines={3}>{tour.title}</Text>
            <View style={styles.heroMeta}>
              {!!city && (
                <View style={styles.heroTag}>
                  <Ionicons name="location" size={12} color="#fff" />
                  <Text style={styles.heroTagText}>{city}</Text>
                </View>
              )}
              {tour.durationDays ? (
                <View style={styles.heroTag}>
                  <Ionicons name="time" size={12} color="#fff" />
                  <Text style={styles.heroTagText}>{tour.durationDays}D / {tour.durationNights ?? Math.max(0, tour.durationDays - 1)}N</Text>
                </View>
              ) : null}
              {tour.stats?.averageRating ? (
                <View style={styles.heroTag}>
                  <Ionicons name="star" size={12} color="#FBBF24" />
                  <Text style={styles.heroTagText}>{tour.stats.averageRating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {!!tour.subtitle && <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{tour.subtitle}</Text>}

          {/* Departures */}
          <Text style={[styles.h, { color: themeColors.text }]}>Choose a departure</Text>
          {openBatches.length === 0 ? (
            <View style={[styles.noBatch, { borderColor: themeColors.border }]}>
              <Text style={[styles.dim, { color: themeColors.textSecondary }]}>
                No open departures right now. Check back soon.
              </Text>
            </View>
          ) : (
            openBatches.map((b) => {
              const active = batchId === b._id;
              const left = seatsLeft(b);
              return (
                <TouchableOpacity
                  key={b._id}
                  style={[styles.batch, { borderColor: active ? TEAL : themeColors.border, backgroundColor: active ? TEAL + '14' : themeColors.surface }]}
                  onPress={() => setBatchId(b._id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radio, active && { borderColor: TEAL }]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.batchDate, { color: themeColors.text }]}>
                      {fmtDate(b.startDate)}{b.endDate ? ` – ${fmtDate(b.endDate)}` : ''}
                    </Text>
                    <Text style={[styles.batchSeats, { color: left <= 3 ? '#EF4444' : themeColors.textSecondary }]}>
                      {left <= 3 ? `Only ${left} seat${left === 1 ? '' : 's'} left` : `${left} seats available`}
                    </Text>
                  </View>
                  {(b.priceOverridePerPerson ?? tour.pricing?.pricePerPerson) ? (
                    <Text style={[styles.batchPrice, { color: themeColors.text }]}>
                      ₹{Number(b.priceOverridePerPerson ?? tour.pricing?.pricePerPerson).toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

          {/* Itinerary */}
          {tour.itinerary && tour.itinerary.length > 0 && (
            <>
              <Text style={[styles.h, { color: themeColors.text }]}>Day-by-day itinerary</Text>
              {tour.itinerary.map((d, i) => (
                <View key={i} style={styles.dayRow}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{d.dayNumber ?? i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {!!d.title && <Text style={[styles.dayTitle, { color: themeColors.text }]}>{d.title}</Text>}
                    {!!d.description && <Text style={[styles.dayDesc, { color: themeColors.textSecondary }]}>{d.description}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Inclusions */}
          {tour.inclusions && tour.inclusions.length > 0 && (
            <>
              <Text style={[styles.h, { color: themeColors.text }]}>What's included</Text>
              {tour.inclusions.map((inc, i) => (
                <View key={i} style={styles.incRow}>
                  <Ionicons name="checkmark-circle" size={16} color={TEAL} />
                  <Text style={[styles.incText, { color: themeColors.textSecondary }]}>{inc}</Text>
                </View>
              ))}
            </>
          )}

          {/* Lead booker */}
          <Text style={[styles.h, { color: themeColors.text }]}>Lead traveller</Text>
          <TextInput label="Full name" value={name} onChangeText={setName} placeholder="As on your ID" />
          <TextInput label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
          <TextInput label="Phone (optional)" value={phone} onChangeText={setPhone} placeholder="10-digit mobile" keyboardType="phone-pad" />

          {/* Seats stepper */}
          <View style={styles.seatsRow}>
            <Text style={[styles.seatsLabel, { color: themeColors.text }]}>Seats</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={[styles.stepBtn, { borderColor: themeColors.border }]} onPress={() => setSeats((s) => Math.max(1, s - 1))}>
                <Ionicons name="remove" size={18} color={themeColors.text} />
              </TouchableOpacity>
              <Text style={[styles.seatCount, { color: themeColors.text }]}>{seats}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: themeColors.border }]}
                onPress={() => setSeats((s) => Math.min(selectedBatch ? seatsLeft(selectedBatch) : 10, s + 1))}
              >
                <Ionicons name="add" size={18} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky book bar */}
      <View style={[styles.footer, { borderTopColor: themeColors.border, backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1 }}>
          {total > 0 && (
            <>
              <Text style={[styles.footerTotal, { color: themeColors.text }]}>₹{total.toLocaleString('en-IN')}</Text>
              <Text style={[styles.footerSub, { color: themeColors.textSecondary }]}>{seats} × ₹{perPerson.toLocaleString('en-IN')}</Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, { backgroundColor: TEAL, opacity: submitting || openBatches.length === 0 ? 0.6 : 1 }]}
          onPress={book}
          disabled={submitting || openBatches.length === 0}
        >
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bookBtnText}>Request booking</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  dim: { fontSize: fontSize.sm, textAlign: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },

  hero: { height: 280, justifyContent: 'flex-end' },
  heroText: { padding: spacing.lg, gap: spacing.sm },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, letterSpacing: -0.5 },
  heroMeta: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroTagText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  body: { padding: spacing.lg, gap: spacing.md },
  subtitle: { fontSize: fontSize.sm, lineHeight: 20 },
  h: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.md },

  noBatch: { borderWidth: 1, borderStyle: 'dashed', borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center' },
  batch: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.md },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },
  batchDate: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  batchSeats: { fontSize: fontSize.xs, marginTop: 2 },
  batchPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold },

  dayRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dayBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: TEAL + '22', alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { color: TEAL, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  dayTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  dayDesc: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 17 },

  incRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  incText: { fontSize: fontSize.sm, flex: 1 },

  seatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  seatsLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seatCount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, minWidth: 24, textAlign: 'center' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  footerTotal: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  footerSub: { fontSize: fontSize.xs },
  bookBtn: { borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: 14, alignItems: 'center', minWidth: 160 },
  bookBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },

  cta: { borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  ctaText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
