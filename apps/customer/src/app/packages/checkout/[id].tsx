import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Stepper,
  TextInput,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import {
  holidayPackagesAPI,
  openCheckout,
  toPaise,
} from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../../config/env';
import { requiredDocsFor } from '../../../lib/legalRegistry';
import DateField from '../../../components/common/DateField';

// Packages use the theme's blue accent rather than the app-wide orange, so the
// holiday-package flow reads as its own product. Aliased once here: every
// `packageColors.primary[n]` below resolves to accent[n] via this object, which keeps
// the shade ramp (50..900) and the rest of the palette untouched.
const packageColors = { ...colors, primary: colors.accent };


// Docs the server requires the customer to accept before a package booking
// (validated server-side; a missing/stale acceptance is a 400).
const PACKAGE_LEGAL_DOCS = requiredDocsFor('booking:package');
const PACKAGE_ACCEPTANCE = PACKAGE_LEGAL_DOCS.map((d) => ({ slug: d.slug, version: d.version }));

type Step = 'travelers' | 'dates' | 'contact' | 'pay';

type Variant = {
  // The only unique handle: `name` repeats across variants on some packages.
  _id?: string;
  name: string;
  displayName?: string;
  // The API prices variants via pricing.basePrice / pricing.display.amount —
  // NOT a flat pricePerPerson (which is undefined → ₹0 on every card).
  pricing?: { basePrice?: number; isOnRequest?: boolean; display?: { amount?: number } };
  pricePerPerson?: number; // legacy fallback
  inclusions?: string[];
  highlights?: string[];
};

type Pkg = {
  _id: string;
  title: string;
  pricing?: { startingFrom: number; currency?: string; mrp?: number };
  duration?: { days: number; nights: number };
  variants?: Variant[];
  // Operator notice period — the server rejects any start date inside it.
  availability?: { advanceBookingDays?: number };
  // "fixed" packages run only on set departures; the server requires the start
  // date to match one exactly (HolidayPackage.isAvailableForDate).
  packageType?: string;
  departures?: {
    _id: string;
    startDate: string;
    endDate?: string;
    status?: string;
    availableSlots?: number;
    bookedSlots?: number;
  }[];
};

// Local-time ISO date. toISOString() shifts the day for anyone east of UTC —
// in IST a date at local midnight becomes the previous day.
const toLocalISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "2026-10-03T00:00:00.000Z" -> "Sat, 3 Oct 2026"
const fmtDepDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso.slice(0, 10);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
};

// Per-person price for a variant (converted display amount, else base, else legacy).
const variantPrice = (v?: Variant | null) =>
  v?.pricing?.display?.amount ?? v?.pricing?.basePrice ?? v?.pricePerPerson ?? 0;

export default function PackageCheckoutScreen() {
  const router = useRouter();
  const { id, variant: variantParam, addOns: addOnsParam } = useLocalSearchParams<{
    id: string;
    variant?: string;
    addOns?: string;
  }>();
  // Extras chosen on the detail screen, carried as ids only. The server
  // re-reads each one off the package and prices it, so nothing the client
  // holds can change what is charged.
  const selectedAddOnIds = useMemo(
    () => String(addOnsParam || '').split(',').map((x) => x.trim()).filter(Boolean),
    [addOnsParam],
  );
  const selectedAddOnPayload = useMemo(
    () => selectedAddOnIds.map((addOnId) => ({ addOnId })),
    [selectedAddOnIds],
  );
  const { user } = useAuth();

  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('travelers');
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Step 1: variant + travelers
  const [variantName, setVariantName] = useState<string | null>(null);
  // Variant NAMES are not unique — Andaman 3N/4D ships five variants called
  // Standard, Standard, Premium, Premium, Luxury (the labels on screen come
  // from displayName). Keying or matching on name collapsed the duplicates:
  // React warned about duplicate keys, tapping one highlighted both, and
  // find(v => v.name === ...) returned the FIRST match — so picking the
  // 22,890 tier priced the 16,330 one. Track the unique _id.
  const [variantId, setVariantId] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Step 2: dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // The server enforces availability.advanceBookingDays and rejects the
  // booking at the LAST step with "Package is not available for the selected
  // date" — after the user has entered travellers, contact details and hit
  // Pay. Mirror the rule in the picker so an unbookable date is never
  // offered in the first place (the web calendar already greys these out).
  // A 9N/10D package booked 23rd->26th priced as a 10-day trip while showing
  // a 3-night stay. The end date is not a free choice for a fixed-length
  // package — derive it from the package's own duration.
  // For a fixed-departure package the start date is NOT a free choice: the
  // server matches it against an open departure and 400s otherwise ("Package is
  // not available for the selected date"). Bhutan Group Departure, for example,
  // runs on exactly 3 dates. Offer those instead of a blank calendar.
  const bookableDepartures = useMemo(() => {
    if (pkg?.packageType !== 'fixed') return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notice = Number(pkg?.availability?.advanceBookingDays) || 0;
    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() + notice);
    return (pkg?.departures || [])
      .filter((d) => {
        if (d.status !== 'open') return false;
        if ((d.bookedSlots ?? 0) >= (d.availableSlots ?? 0)) return false;
        const sd = new Date(d.startDate);
        return sd >= earliest;
      })
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  }, [pkg]);

  const selectedDeparture = useMemo(
    () => bookableDepartures.find((d) => d.startDate.slice(0, 10) === startDate) || null,
    [bookableDepartures, startDate],
  );

  const handleStartDateChange = (next: string) => {
    setStartDate(next);
    const nights = Number(pkg?.duration?.nights);
    if (next && Number.isFinite(nights) && nights > 0) {
      const end = new Date(next);
      end.setDate(end.getDate() + nights);
      setEndDate(toLocalISODate(end));
    }
  };

  const minStartDate = useMemo(() => {
    const notice = Number(pkg?.availability?.advanceBookingDays) || 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + notice);
    return d;
  }, [pkg]);

  // Step 3: contact
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 4: legal acceptance (required by the server before booking)
  const [agreedLegal, setAgreedLegal] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await holidayPackagesAPI.getById(id);
        if (!mounted) return;
        const p: Pkg = res?.data || res?.package || null;
        setPkg(p);
        // Preselect the variant chosen on the detail screen (?variant=), else first.
        const preset =
          p?.variants?.find((v: any) => v._id === variantParam) ||
          p?.variants?.find((v: any) => v.name === variantParam);
        const chosen = preset || p?.variants?.[0];
        if (chosen?.name) {
          setVariantName(chosen.name);
          setVariantId(chosen._id || null);
        }
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: 'Could not load package',
          text2: err?.message,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    if (!name && user.displayName) setName(user.displayName);
    if (!email && user.email) setEmail(user.email);
    if (!phone && user.phoneNumber) setPhone(user.phoneNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalTravelers = adults + children;

  const selectedVariant = useMemo(() => {
    if (!pkg?.variants) return null;
    return (
      pkg.variants.find((v) => v._id && v._id === variantId) ||
      pkg.variants.find((v) => v.name === variantName) ||
      null
    );
  }, [pkg, variantId, variantName]);

  const clientEstimate = useMemo(() => {
    const perPerson = variantPrice(selectedVariant) || pkg?.pricing?.startingFrom || 0;
    return perPerson * totalTravelers;
  }, [selectedVariant, pkg, totalTravelers]);

  // Server-authoritative price (discounts, GST, TCS). Fetched once we reach the
  // pay step with a variant + start date. The client estimate is only a
  // placeholder until this lands.
  const [livePrice, setLivePrice] = useState<any>(null);
  const [pricing, setPricing] = useState(false);
  useEffect(() => {
    if (step !== 'pay' || !pkg || !variantName) return;
    let alive = true;
    setPricing(true);
    (async () => {
      try {
        const res: any = await holidayPackagesAPI.calculatePrice({
          packageId: pkg._id,
          variantName,
          adults,
          children,
          infants: 0,
          travelDate: startDate || undefined,
          selectedAddOns: selectedAddOnPayload,
        });
        if (alive) setLivePrice(res?.data || null);
      } catch {
        if (alive) setLivePrice(null);
      } finally {
        if (alive) setPricing(false);
      }
    })();
    return () => { alive = false; };
  }, [step, pkg, variantName, adults, children, startDate, selectedAddOnPayload]);

  // What we display + charge: server finalPrice when available, else the estimate.
  const estimatedTotal = useMemo(() => {
    const server = livePrice?.display?.finalPrice ?? livePrice?.finalPrice;
    return typeof server === 'number' && server > 0 ? server : clientEstimate;
  }, [livePrice, clientEstimate]);

  const stepIndex = step === 'travelers' ? 0 : step === 'dates' ? 1 : step === 'contact' ? 2 : 3;

  const validateStep = (s: Step): boolean => {
    if (s === 'travelers') {
      if (!variantName) {
        Toast.show({ type: 'error', text1: 'Pick a package variant' });
        return false;
      }
      if (totalTravelers < 1) {
        Toast.show({ type: 'error', text1: 'At least one traveler required' });
        return false;
      }
      return true;
    }
    if (s === 'dates') {
      if (!startDate || !endDate) {
        Toast.show({ type: 'error', text1: 'Travel dates required' });
        return false;
      }
      if (new Date(startDate) >= new Date(endDate)) {
        Toast.show({ type: 'error', text1: 'End date must be after start' });
        return false;
      }
      // Catch a start date below the operator's notice period before the user
      // walks through two more steps only to be rejected at payment.
      if (new Date(startDate) < minStartDate) {
        const notice = Number(pkg?.availability?.advanceBookingDays) || 0;
        Toast.show({
          type: 'error',
          text1: `This package needs ${notice} days' notice`,
          text2: `Earliest start: ${toLocalISODate(minStartDate)}`,
        });
        return false;
      }
      return true;
    }
    if (s === 'contact') {
      if (!name.trim()) {
        Toast.show({ type: 'error', text1: 'Name required' });
        return false;
      }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        Toast.show({ type: 'error', text1: 'Valid email required' });
        return false;
      }
      if (phone.replace(/\D/g, '').length < 10) {
        Toast.show({ type: 'error', text1: 'Valid phone required' });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    Haptics.selectionAsync();
    setStep(step === 'travelers' ? 'dates' : step === 'dates' ? 'contact' : 'pay');
  };

  const handlePay = async () => {
    if (!pkg) return;
    if (!agreedLegal) {
      Toast.show({ type: 'error', text1: 'Please accept the terms to continue' });
      return;
    }
    setSubmitting(true);
    try {
      let currentBookingId = bookingId;

      if (!currentBookingId) {
        const createRes = await holidayPackagesAPI.createBooking({
          packageId: pkg._id,
          variantName,
          travelStartDate: startDate,
          travelEndDate: endDate,
          // Required for fixed departures — the server decrements that
          // departure's slot count and rejects a mismatched date.
          ...(selectedDeparture ? { departureId: selectedDeparture._id } : {}),
          // The server prices off totalTravelers.{adults,children,infants} — it
          // must be an OBJECT, not a count, or every booking is priced for 1 adult.
          totalTravelers: { adults, children, infants: 0 },
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          specialRequests: specialRequests.trim() || undefined,
          // Ids only — the server prices each extra off the package itself.
          selectedAddOns: selectedAddOnPayload,
          // Required — server rejects the booking without these acceptances.
          acceptedLegalDocs: PACKAGE_ACCEPTANCE,
        });
        if (!createRes?.success || !createRes?.data?._id) {
          Toast.show({
            type: 'error',
            text1: 'Could not create booking',
            text2: createRes?.message,
          });
          setSubmitting(false);
          return;
        }
        currentBookingId = createRes.data._id;
        setBookingId(currentBookingId);
      }

      // Pay the first (due-now) installment. For "full" this is the whole amount.
      const orderRes = await holidayPackagesAPI.createPaymentOrder(currentBookingId!, { installmentNumber: 1 });
      if (!orderRes?.success || !orderRes?.data?.orderId) {
        Toast.show({
          type: 'error',
          text1: 'Payment unavailable',
          text2: orderRes?.message,
        });
        setSubmitting(false);
        return;
      }
      const { orderId, amount, currency, keyId } = orderRes.data;
      // The package create-order returns `amount` in RUPEES (installment.amount),
      // not paise like other flows — convert, or Razorpay gets the wrong amount
      // and rejects the payment.
      const amountInPaise = amount ? toPaise(amount) : toPaise(estimatedTotal);

      const result = await openCheckout({
        keyId: keyId || ENV.razorpayKeyId,
        orderId,
        amountInPaise,
        currency: currency || 'INR',
        description: pkg.title,
        prefill: { email, contact: phone, name },
        notes: { bookingId: currentBookingId!, packageId: pkg._id },
      });

      if (result.status === 'cancelled') {
        Toast.show({ type: 'info', text1: 'Payment cancelled' });
        setSubmitting(false);
        return;
      }
      if (result.status === 'failed') {
        Toast.show({
          type: 'error',
          text1: 'Payment failed',
          text2: result.reason,
        });
        setSubmitting(false);
        return;
      }

      // Server reads camelCase — snake_case keys are silently ignored, leaving
      // the booking unpaid after a successful charge.
      const verifyRes = await holidayPackagesAPI.verifyPayment(currentBookingId!, {
        razorpayOrderId: result.orderId,
        razorpayPaymentId: result.paymentId,
        razorpaySignature: result.signature,
        installmentNumber: 1,
      });

      if (verifyRes?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: 'Booking confirmed',
          text2: 'See it under My Bookings.',
        });
        router.replace('/bookings');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification failed',
          text2: verifyRes?.message,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: err?.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={packageColors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!pkg) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Package not found</Text>
          <Button title="Browse" onPress={() => router.replace('/packages')} variant="primary" size="md" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/packages'))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Checkout</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Stepper steps={['Travelers', 'Dates', 'Contact', 'Pay']} currentStep={stepIndex} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Summary card */}
          <Card style={styles.summary}>
            <Text style={styles.summaryTitle} numberOfLines={2}>
              {pkg.title}
            </Text>
            <Text style={styles.summaryMeta}>
              {pkg.duration?.days || 0} days · {totalTravelers} traveler
              {totalTravelers === 1 ? '' : 's'}
            </Text>
            <View style={styles.summaryPriceRow}>
              <Text style={styles.summaryLabel}>Estimated total</Text>
              <Text style={styles.summaryPrice}>
                ₹{estimatedTotal.toLocaleString('en-IN')}
              </Text>
            </View>
          </Card>

          {step === 'travelers' && (
            <>
              {pkg.variants && pkg.variants.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Choose variant</Text>
                  {pkg.variants.map((v) => {
                    const active = v._id ? variantId === v._id : variantName === v.name;
                    return (
                      <TouchableOpacity
                        key={v._id || v.name}
                        style={[styles.variantCard, active && styles.variantCardActive]}
                        onPress={() => {
                          setVariantName(v.name);
                          setVariantId(v._id || null);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.variantName}>{v.displayName || v.name}</Text>
                          {(v.highlights?.length || v.inclusions?.length) ? (
                            <Text style={styles.variantHint} numberOfLines={2}>
                              {(v.highlights || v.inclusions || []).slice(0, 3).join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {v.pricing?.isOnRequest ? (
                            <Text style={styles.variantPrice}>On request</Text>
                          ) : (
                            <>
                              <Text style={styles.variantPrice}>₹{variantPrice(v).toLocaleString('en-IN')}</Text>
                              <Text style={styles.variantHint}>per person</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Travelers</Text>
                <CounterRow
                  label="Adults"
                  sublabel="13+ years"
                  value={adults}
                  min={1}
                  max={20}
                  onChange={setAdults}
                />
                <CounterRow
                  label="Children"
                  sublabel="2–12 years"
                  value={children}
                  min={0}
                  max={10}
                  onChange={setChildren}
                />
              </View>
            </>
          )}

          {step === 'dates' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {pkg?.packageType === 'fixed' ? 'Choose a departure' : 'Travel dates'}
              </Text>

              {pkg?.packageType === 'fixed' ? (
                bookableDepartures.length > 0 ? (
                  <>
                    {bookableDepartures.map((d) => {
                      const iso = d.startDate.slice(0, 10);
                      const active = startDate === iso;
                      const left = (d.availableSlots ?? 0) - (d.bookedSlots ?? 0);
                      return (
                        <TouchableOpacity
                          key={d._id}
                          onPress={() => {
                            setStartDate(iso);
                            setEndDate((d.endDate || '').slice(0, 10));
                          }}
                          activeOpacity={0.8}
                          style={[styles.depRow, active && styles.depRowActive]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.depDate, active && styles.depDateActive]}>
                              {fmtDepDate(d.startDate)}
                              {d.endDate ? ` → ${fmtDepDate(d.endDate)}` : ''}
                            </Text>
                            <Text style={styles.depSeats}>
                              {left > 0 ? `${left} seats left` : 'Sold out'}
                            </Text>
                          </View>
                          {active ? <Text style={styles.depTick}>✓</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={styles.hint}>
                      This is a group departure — it runs only on these dates.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.hint}>
                    No departures are open for booking right now. Please check back soon.
                  </Text>
                )
              ) : (
                <>
                  <DateField
                    label="Start date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    placeholder="Select start date"
                    minimumDate={minStartDate}
                  />
                  <DateField
                    label="End date"
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Select end date"
                    minimumDate={startDate ? new Date(startDate) : minStartDate}
                  />
                  <Text style={styles.hint}>
                    Dates can be flexible — the operator will confirm based on availability.
                  </Text>
                </>
              )}
            </View>
          )}

          {step === 'contact' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact details</Text>
              <TextInput label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98xxx xxxxx"
                keyboardType="phone-pad"
              />
              <TextInput
                label="Special requests (optional)"
                value={specialRequests}
                onChangeText={setSpecialRequests}
                placeholder="Wheelchair access, dietary preferences..."
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {step === 'pay' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Review & pay</Text>
              <Card style={styles.review}>
                <ReviewRow label="Variant" value={variantName || ''} />
                <ReviewRow label="Travelers" value={`${adults} adults · ${children} kids`} />
                <ReviewRow label="Travel" value={`${startDate} → ${endDate}`} />
                <ReviewRow label="Contact" value={`${name} · ${phone}`} />
                <ReviewRow label="Email" value={email} />
              </Card>

              {/* Server-authoritative price breakdown */}
              <Card style={styles.review}>
                {pricing ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                    <ActivityIndicator color={packageColors.primary[600]} />
                    <Text style={[styles.hint, { marginTop: spacing.sm }]}>Getting your best price…</Text>
                  </View>
                ) : livePrice ? (
                  <>
                    {!!livePrice.breakdown?.adults?.total && (
                      <ReviewRow label={`Adults × ${livePrice.breakdown.adults.count}`} value={`₹${Number(livePrice.breakdown.adults.total).toLocaleString('en-IN')}`} />
                    )}
                    {!!livePrice.breakdown?.children?.total && (
                      <ReviewRow label={`Children × ${livePrice.breakdown.children.count}`} value={`₹${Number(livePrice.breakdown.children.total).toLocaleString('en-IN')}`} />
                    )}
                    {livePrice.earlyBirdDiscount?.applied && (
                      <ReviewRow label={`Early-bird −${livePrice.earlyBirdDiscount.discountPercent}%`} value={`−₹${Number(livePrice.earlyBirdDiscount.discountAmount).toLocaleString('en-IN')}`} />
                    )}
                    {livePrice.groupDiscount?.applied && (
                      <ReviewRow label={`Group −${livePrice.groupDiscount.discountPercent}%`} value={`−₹${Number(livePrice.groupDiscount.discountAmount).toLocaleString('en-IN')}`} />
                    )}
                    {/* One line per extra, priced by the server (per_couple
                        halves the count, per_booking is flat) so the figure
                        here is the figure charged. */}
                    {(livePrice.addOns || []).map((a: any, i: number) => (
                      <ReviewRow
                        key={a.addOnId || i}
                        label={`${a.name}${a.units > 1 ? ` × ${a.units}` : ''}`}
                        value={`₹${Number(a.total ?? a.price ?? 0).toLocaleString('en-IN')}`}
                      />
                    ))}
                    {!!livePrice.taxes?.total && (
                      <ReviewRow label={`Taxes (GST${livePrice.taxes?.tcs ? ' + TCS' : ''})`} value={`₹${Number(livePrice.taxes.total).toLocaleString('en-IN')}`} />
                    )}
                    <ReviewRow label="Total" value={`₹${estimatedTotal.toLocaleString('en-IN')}`} />
                  </>
                ) : (
                  <ReviewRow label="Total" value={`₹${estimatedTotal.toLocaleString('en-IN')}`} />
                )}
              </Card>

              <Text style={styles.hint}>
                You'll be charged ₹{estimatedTotal.toLocaleString('en-IN')} now. Final
                price may adjust based on operator confirmation.
              </Text>

              {/* Legal acceptance — required by the server before booking */}
              <TouchableOpacity
                style={styles.legalRow}
                activeOpacity={0.7}
                onPress={() => setAgreedLegal((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreedLegal }}
              >
                <View style={[styles.checkbox, agreedLegal && styles.checkboxOn]}>
                  {agreedLegal && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.legalText}>
                  I agree to the{' '}
                  {PACKAGE_LEGAL_DOCS.map((d, i) => (
                    <Text key={d.slug}>
                      <Text style={styles.legalLink}>{d.title}</Text>
                      {i < PACKAGE_LEGAL_DOCS.length - 1 ? (i === PACKAGE_LEGAL_DOCS.length - 2 ? ' & ' : ', ') : ''}
                    </Text>
                  ))}
                  .
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={step === 'pay' ? `Pay ₹${estimatedTotal.toLocaleString('en-IN')}` : 'Continue'}
            onPress={step === 'pay' ? handlePay : handleNext}
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={submitting || (step === 'pay' && !agreedLegal)}
            icon={
              <Ionicons
                name={step === 'pay' ? 'lock-closed' : 'arrow-forward'}
                size={18}
                color="#fff"
              />
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CounterRow({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.counterRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.counterLabel}>{label}</Text>
        {sublabel ? <Text style={styles.counterSub}>{sublabel}</Text> : null}
      </View>
      <View style={styles.counterControls}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={[styles.counterBtn, value <= min && { opacity: 0.4 }]}
        >
          <Ionicons name="remove" size={20} color={packageColors.primary[500]} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={[styles.counterBtn, value >= max && { opacity: 0.4 }]}
        >
          <Ionicons name="add" size={20} color={packageColors.primary[500]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  errorTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  summary: { marginTop: spacing.lg, padding: spacing.lg },
  summaryTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  summaryMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  summaryPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryPrice: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: packageColors.primary[600] },

  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  variantCardActive: {
    borderColor: packageColors.primary[500],
    backgroundColor: packageColors.primary[50],
  },
  variantName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  variantHint: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  variantPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: packageColors.primary[600] },

  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  counterLabel: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text },
  counterSub: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: packageColors.primary[500],
  },
  counterValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, minWidth: 24, textAlign: 'center' },

  hint: { fontSize: fontSize.sm, color: colors.textTertiary, lineHeight: 20 },
  // Fixed-departure picker
  depRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: colors.gray[200],
    backgroundColor: colors.surface, marginBottom: 10,
  },
  depRowActive: { borderColor: packageColors.primary[500], backgroundColor: packageColors.primary[50] },
  depDate: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, color: colors.text },
  depDateActive: { color: packageColors.primary[700] },
  depSeats: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 3 },
  depTick: { fontSize: 18, color: packageColors.primary[600], fontWeight: fontWeight.bold as any },
  legalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: packageColors.primary[600], borderColor: packageColors.primary[600] },
  legalText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
  legalLink: { color: packageColors.primary[600], fontWeight: fontWeight.semibold },

  review: { padding: spacing.lg, gap: spacing.sm },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  reviewLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  reviewValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
