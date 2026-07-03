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

type Step = 'travelers' | 'dates' | 'contact' | 'pay';

type Variant = {
  name: string;
  pricePerPerson?: number;
  inclusions?: string[];
};

type Pkg = {
  _id: string;
  title: string;
  pricing?: { startingFrom: number; currency?: string; mrp?: number };
  duration?: { days: number; nights: number };
  variants?: Variant[];
};

export default function PackageCheckoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('travelers');
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Step 1: variant + travelers
  const [variantName, setVariantName] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Step 2: dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Step 3: contact
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
        if (p?.variants?.[0]?.name) setVariantName(p.variants[0].name);
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
    return pkg?.variants?.find((v) => v.name === variantName) || null;
  }, [pkg, variantName]);

  const estimatedTotal = useMemo(() => {
    const perPerson =
      selectedVariant?.pricePerPerson || pkg?.pricing?.startingFrom || 0;
    return perPerson * totalTravelers;
  }, [selectedVariant, pkg, totalTravelers]);

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
    setSubmitting(true);
    try {
      let currentBookingId = bookingId;

      if (!currentBookingId) {
        const createRes = await holidayPackagesAPI.createBooking({
          packageId: pkg._id,
          variantName,
          travelStartDate: startDate,
          travelEndDate: endDate,
          travelers: { adults, children },
          totalTravelers,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          specialRequests: specialRequests.trim() || undefined,
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

      const orderRes = await holidayPackagesAPI.createPaymentOrder(currentBookingId!);
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

      const result = await openCheckout({
        keyId: keyId || ENV.razorpayKeyId,
        orderId,
        amountInPaise: amount || toPaise(estimatedTotal),
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

      const verifyRes = await holidayPackagesAPI.verifyPayment(currentBookingId!, {
        razorpay_order_id: result.orderId,
        razorpay_payment_id: result.paymentId,
        razorpay_signature: result.signature,
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
          <ActivityIndicator size="large" color={colors.primary[500]} />
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Checkout</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Stepper steps={['Travelers', 'Dates', 'Contact', 'Pay']} currentStep={stepIndex} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                    const active = variantName === v.name;
                    return (
                      <TouchableOpacity
                        key={v.name}
                        style={[styles.variantCard, active && styles.variantCardActive]}
                        onPress={() => {
                          setVariantName(v.name);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.variantName}>{v.name}</Text>
                          {v.inclusions?.length ? (
                            <Text style={styles.variantHint} numberOfLines={2}>
                              {v.inclusions.slice(0, 3).join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.variantPrice}>
                            ₹{(v.pricePerPerson || 0).toLocaleString('en-IN')}
                          </Text>
                          <Text style={styles.variantHint}>per person</Text>
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
              <Text style={styles.sectionTitle}>Travel dates</Text>
              <TextInput
                label="Start date (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-05-01"
              />
              <TextInput
                label="End date (YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-05-08"
              />
              <Text style={styles.hint}>
                Dates can be flexible — the operator will confirm based on availability.
              </Text>
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
              <Text style={styles.hint}>
                You'll be charged ₹{estimatedTotal.toLocaleString('en-IN')} now. Final
                price may adjust based on operator confirmation.
              </Text>
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
            disabled={submitting}
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
          <Ionicons name="remove" size={20} color={colors.primary[500]} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={[styles.counterBtn, value >= max && { opacity: 0.4 }]}
        >
          <Ionicons name="add" size={20} color={colors.primary[500]} />
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
  summaryPrice: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary[600] },

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
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  variantName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  variantHint: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  variantPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary[600] },

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
    borderColor: colors.primary[500],
  },
  counterValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, minWidth: 24, textAlign: 'center' },

  hint: { fontSize: fontSize.sm, color: colors.textTertiary, lineHeight: 20 },

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
