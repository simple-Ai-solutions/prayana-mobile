import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
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
  Button,
  Card,
  TextInput,
  Stepper,
  colors,
  spacing,
  fontSize,
  fontWeight,
} from '@prayana/shared-ui';
import {
  transportAPI,
  openCheckout,
  toPaise,
} from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../../config/env';

type Step = 'trip' | 'contact' | 'pay';

type Vehicle = {
  _id: string;
  name: string;
  type?: string;
  pricing?: { perDay?: number; perKm?: number; perHour?: number; basePrice?: number; deposit?: number };
};

export default function TransportCheckoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('trip');
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Trip
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [dropDate, setDropDate] = useState('');

  // Contact
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await transportAPI.getVehicleBySlug(id);
        if (mounted) setVehicle(res?.data || res?.vehicle || null);
      } catch {}
      finally {
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

  const stepIndex = step === 'trip' ? 0 : step === 'contact' ? 1 : 2;

  const validate = (s: Step): boolean => {
    if (s === 'trip') {
      if (!pickupLocation.trim() || !pickupDate || !pickupTime) {
        Toast.show({ type: 'error', text1: 'Pickup location, date & time required' });
        return false;
      }
      return true;
    }
    if (s === 'contact') {
      if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()) || phone.replace(/\D/g, '').length < 10) {
        Toast.show({ type: 'error', text1: 'Complete contact details' });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validate(step)) return;
    Haptics.selectionAsync();
    setStep(step === 'trip' ? 'contact' : 'pay');
  };

  const estimatedTotal =
    vehicle?.pricing?.perDay ||
    vehicle?.pricing?.basePrice ||
    vehicle?.pricing?.perHour ||
    vehicle?.pricing?.perKm ||
    0;

  const handlePay = async () => {
    if (!vehicle) return;
    setSubmitting(true);
    try {
      let currentBookingId = bookingId;
      if (!currentBookingId) {
        const createRes = await transportAPI.createBooking({
          vehicleId: vehicle._id,
          pickupLocation: pickupLocation.trim(),
          dropLocation: dropLocation.trim() || undefined,
          pickupDate,
          pickupTime,
          dropDate: dropDate || pickupDate,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          notes: notes.trim() || undefined,
        });
        if (!createRes?.success || !createRes?.data?._id) {
          Toast.show({ type: 'error', text1: 'Could not create booking', text2: createRes?.message });
          setSubmitting(false);
          return;
        }
        currentBookingId = createRes.data._id;
        setBookingId(currentBookingId);
      }

      const orderRes = await transportAPI.createPaymentOrder(currentBookingId!);
      if (!orderRes?.success || !orderRes?.data?.orderId) {
        Toast.show({ type: 'error', text1: 'Payment unavailable', text2: orderRes?.message });
        setSubmitting(false);
        return;
      }
      const { orderId, amount, currency, keyId } = orderRes.data;

      const result = await openCheckout({
        keyId: keyId || ENV.razorpayKeyId,
        orderId,
        amountInPaise: amount || toPaise(estimatedTotal),
        currency: currency || 'INR',
        description: `${vehicle.name} booking`,
        prefill: { email, contact: phone, name },
        notes: { bookingId: currentBookingId!, vehicleId: vehicle._id },
      });

      if (result.status === 'cancelled') {
        Toast.show({ type: 'info', text1: 'Payment cancelled' });
        setSubmitting(false);
        return;
      }
      if (result.status === 'failed') {
        Toast.show({ type: 'error', text1: 'Payment failed', text2: result.reason });
        setSubmitting(false);
        return;
      }

      const verifyRes = await transportAPI.verifyPayment(currentBookingId!, {
        razorpay_order_id: result.orderId,
        razorpay_payment_id: result.paymentId,
        razorpay_signature: result.signature,
      });

      if (verifyRes?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Vehicle booked', text2: 'Track your ride from My Bookings.' });
        router.replace('/bookings');
      } else {
        Toast.show({ type: 'error', text1: 'Verification failed', text2: verifyRes?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Something went wrong', text2: err?.message });
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

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Vehicle not found</Text>
          <Button title="Browse" onPress={() => router.replace('/transport')} variant="primary" size="md" />
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
        <Text style={styles.topBarTitle}>Book {vehicle.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Stepper steps={['Trip', 'Contact', 'Pay']} currentStep={stepIndex} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card style={styles.summary}>
            <Text style={styles.summaryTitle}>{vehicle.name}</Text>
            <Text style={styles.summaryMeta}>{vehicle.type?.replace(/_/g, ' ') || ''}</Text>
            <View style={styles.summaryPriceRow}>
              <Text style={styles.summaryLabel}>Estimated</Text>
              <Text style={styles.summaryPrice}>₹{estimatedTotal.toLocaleString('en-IN')}</Text>
            </View>
            {vehicle.pricing?.deposit ? (
              <Text style={styles.summaryHint}>
                + ₹{vehicle.pricing.deposit.toLocaleString('en-IN')} refundable deposit
              </Text>
            ) : null}
          </Card>

          {step === 'trip' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trip details</Text>
              <TextInput
                label="Pickup location"
                value={pickupLocation}
                onChangeText={setPickupLocation}
                placeholder="Airport / Hotel / City"
              />
              <TextInput
                label="Drop location (optional)"
                value={dropLocation}
                onChangeText={setDropLocation}
                placeholder="Destination"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput label="Pickup date" value={pickupDate} onChangeText={setPickupDate} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <TextInput label="Pickup time" value={pickupTime} onChangeText={setPickupTime} placeholder="14:00" />
                </View>
              </View>
              <TextInput label="Drop date (optional)" value={dropDate} onChangeText={setDropDate} placeholder="YYYY-MM-DD" />
            </View>
          )}

          {step === 'contact' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact details</Text>
              <TextInput label="Name" value={name} onChangeText={setName} placeholder="Your name" />
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
                label="Notes for driver / operator (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Flight number, special requests..."
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {step === 'pay' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Review & pay</Text>
              <Card style={styles.review}>
                <Row label="Pickup" value={`${pickupLocation} · ${pickupDate} ${pickupTime}`} />
                {dropLocation ? <Row label="Drop" value={dropLocation} /> : null}
                <Row label="Contact" value={`${name} · ${phone}`} />
                <Row label="Email" value={email} />
              </Card>
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
            icon={<Ionicons name={step === 'pay' ? 'lock-closed' : 'arrow-forward'} size={18} color="#fff" />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
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
  topBarTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  summary: { marginTop: spacing.lg, padding: spacing.lg },
  summaryTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  summaryMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4 },
  summaryPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryPrice: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary[600] },
  summaryHint: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 4 },

  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  row2: { flexDirection: 'row', alignItems: 'flex-end' },

  review: { padding: spacing.lg, gap: spacing.sm },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, gap: spacing.md },
  reviewLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  reviewValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, flexShrink: 1, textAlign: 'right' },

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
