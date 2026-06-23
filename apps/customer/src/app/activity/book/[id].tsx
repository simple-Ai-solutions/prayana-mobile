import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  Badge,
  Button,
  LoadingSpinner,
  ErrorView,
  Stepper,
  TextInput,
  Card,
  useTheme,
} from '@prayana/shared-ui';
import {
  activityMarketplaceAPI,
  bookingAPI,
  makeAPICall,
  openCheckout,
  toPaise,
} from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../../config/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STEP_LABELS = ['Date', 'Options', 'Contact', 'Payment'];
const TOMORROW = new Date(Date.now() + 86400000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(time: string): string {
  // Handles "HH:mm" or "HH:mm:ss" → "h:mm A"
  if (!time) return '';
  const parts = time.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function tomorrowDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Counter component
// ---------------------------------------------------------------------------

function Counter({
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
  onChange: (v: number) => void;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={[counterStyles.row, { borderBottomColor: themeColors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[counterStyles.label, { color: themeColors.text }]}>{label}</Text>
        {sublabel ? <Text style={[counterStyles.sublabel, { color: themeColors.textTertiary }]}>{sublabel}</Text> : null}
      </View>
      <View style={counterStyles.controls}>
        <TouchableOpacity
          style={[counterStyles.btn, value <= min && counterStyles.btnDisabled]}
          disabled={value <= min}
          onPress={() => onChange(value - 1)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="remove"
            size={20}
            color={value <= min ? colors.gray[300] : colors.primary[500]}
          />
        </TouchableOpacity>
        <Text style={[counterStyles.value, { color: themeColors.text }]}>{value}</Text>
        <TouchableOpacity
          style={[counterStyles.btn, value >= max && counterStyles.btnDisabled]}
          disabled={value >= max}
          onPress={() => onChange(value + 1)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="add"
            size={20}
            color={value >= max ? colors.gray[300] : colors.primary[500]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const counterStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  sublabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    borderColor: colors.gray[200],
  },
  value: {
    width: 40,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});

// ---------------------------------------------------------------------------
// Selectable card
// ---------------------------------------------------------------------------

function SelectableCard({
  selected,
  disabled,
  onPress,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { themeColors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.7}
      onPress={disabled ? undefined : onPress}
      style={[
        selectableStyles.card,
        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
        selected && selectableStyles.selected,
        disabled && selectableStyles.disabled,
      ]}
    >
      {children}
      {selected && (
        <View style={selectableStyles.check}>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary[500]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const selectableStyles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  selected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: colors.gray[50],
  },
  check: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
});

// ---------------------------------------------------------------------------
// Price breakdown row
// ---------------------------------------------------------------------------

function BreakdownRow({
  label,
  amount,
  isTotal,
  isDiscount,
}: {
  label: string;
  amount: number;
  isTotal?: boolean;
  isDiscount?: boolean;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={breakdownStyles.row}>
      <Text
        style={[
          breakdownStyles.label,
          { color: themeColors.textSecondary },
          isTotal && breakdownStyles.totalLabel,
          isTotal && { color: themeColors.text },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          breakdownStyles.amount,
          { color: themeColors.text },
          isTotal && breakdownStyles.totalAmount,
          isDiscount && breakdownStyles.discount,
        ]}
      >
        {isDiscount ? `- ${formatCurrency(Math.abs(amount))}` : formatCurrency(amount)}
      </Text>
    </View>
  );
}

const breakdownStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  totalAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  discount: {
    color: colors.success,
  },
});

// ===========================================================================
// MAIN BOOKING SCREEN
// ===========================================================================

export default function BookingFlowScreen() {
  const { themeColors } = useTheme();
  const { id: activityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  // -------------------------------------------------------------------------
  // Core state
  // -------------------------------------------------------------------------

  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Step 1: Date & Participants
  const [selectedDate, setSelectedDate] = useState(tomorrowDate());
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  // Step 2: Time Slots & Variants
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Step 3: Contact
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Step 4: Payment & Confirmation
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'venue'>('online');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);

  // -------------------------------------------------------------------------
  // Initial data fetch
  // -------------------------------------------------------------------------

  const fetchActivity = useCallback(async () => {
    if (!activityId) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const res = await activityMarketplaceAPI.getActivityById(activityId);
      if (res?.success && res.data) {
        setActivity(res.data);
      } else {
        setPageError('Activity not found.');
      }
    } catch (err: any) {
      setPageError(err.message || 'Failed to load activity.');
    } finally {
      setPageLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Pre-fill contact from user profile
  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      setEmail(user.email || '');
      setPhone(user.phoneNumber || '');
    }
  }, [user]);

  // -------------------------------------------------------------------------
  // Step 2 data fetches
  // -------------------------------------------------------------------------

  const fetchTimeSlots = useCallback(async () => {
    if (!activityId || !selectedDate) return;
    setSlotsLoading(true);
    try {
      const dateISO = selectedDate.toISOString().split('T')[0];
      const res = await makeAPICall(`/activities/${activityId}/time-slots/${dateISO}`);
      if (res?.success) {
        setTimeSlots(res.data || []);
      } else {
        setTimeSlots([]);
      }
    } catch (err: any) {
      console.warn('[Booking] time slots error:', err.message);
      setTimeSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [activityId, selectedDate]);

  const fetchVariants = useCallback(async () => {
    if (!activityId) return;
    setVariantsLoading(true);
    try {
      const res = await makeAPICall(`/activities/${activityId}/variants`);
      if (res?.success) {
        setVariants(res.data || []);
      } else {
        setVariants([]);
      }
    } catch (err: any) {
      console.warn('[Booking] variants error:', err.message);
      setVariants([]);
    } finally {
      setVariantsLoading(false);
    }
  }, [activityId]);

  // Fetch when entering step 2
  useEffect(() => {
    if (step === 1) {
      fetchTimeSlots();
      fetchVariants();
    }
  }, [step, fetchTimeSlots, fetchVariants]);

  // Price preview whenever selections change in step 2
  const fetchPriceBreakdown = useCallback(async () => {
    if (!activityId) return;
    setPriceLoading(true);
    try {
      const res = await bookingAPI.calculateBreakdown({
        activityId,
        adults,
        children,
        date: selectedDate.toISOString().split('T')[0],
        variantId: selectedVariant?._id || null,
        couponCode: undefined,
      });
      if (res?.success) {
        setPriceBreakdown(res.data || res);
      }
    } catch (err: any) {
      // Non-fatal: price preview may not be available before full selection
      console.warn('[Booking] price preview:', err.message);
    } finally {
      setPriceLoading(false);
    }
  }, [activityId, adults, children, selectedDate, selectedVariant]);

  useEffect(() => {
    if (step === 1) {
      fetchPriceBreakdown();
    }
  }, [step, fetchPriceBreakdown]);

  // -------------------------------------------------------------------------
  // Navigation between steps
  // -------------------------------------------------------------------------

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollToTop();
    } else {
      router.back();
    }
  };

  const goNext = () => {
    if (step < 3) {
      setStep(step + 1);
      scrollToTop();
    }
  };

  // -------------------------------------------------------------------------
  // Step 1 validation
  // -------------------------------------------------------------------------

  const validateStep1 = (): boolean => {
    const totalParticipants = adults + children;
    const maxGroup = activity?.groupSize?.max || 20;

    if (totalParticipants < 1) {
      Toast.show({ type: 'error', text1: 'Invalid participants', text2: 'At least 1 adult is required.' });
      return false;
    }

    if (totalParticipants > maxGroup) {
      Toast.show({
        type: 'error',
        text1: 'Group too large',
        text2: `Maximum ${maxGroup} participants allowed.`,
      });
      return false;
    }

    if (selectedDate <= new Date()) {
      Toast.show({ type: 'error', text1: 'Invalid date', text2: 'Please select a future date.' });
      return false;
    }

    return true;
  };

  // -------------------------------------------------------------------------
  // Step 2 validation
  // -------------------------------------------------------------------------

  const validateStep2 = (): boolean => {
    // Time slots are optional if the activity doesn't have them
    if (timeSlots.length > 0 && !selectedSlot) {
      Toast.show({ type: 'error', text1: 'Select a time slot', text2: 'Please choose a time for your booking.' });
      return false;
    }
    // Variants are optional if the activity doesn't have them
    if (variants.length > 0 && !selectedVariant) {
      Toast.show({ type: 'error', text1: 'Select a tier', text2: 'Please choose an experience tier.' });
      return false;
    }
    return true;
  };

  // -------------------------------------------------------------------------
  // Step 3: Create booking
  // -------------------------------------------------------------------------

  const validateStep3 = (): boolean => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter your full name.' });
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Toast.show({ type: 'error', text1: 'Email required', text2: 'Please enter a valid email address.' });
      return false;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      Toast.show({ type: 'error', text1: 'Phone required', text2: 'Please enter a valid phone number.' });
      return false;
    }
    return true;
  };

  const handleCreateBooking = async () => {
    if (!validateStep3()) return;
    setBookingLoading(true);

    try {
      const payload = {
        activityId,
        bookingDate: selectedDate.toISOString(),
        participants: { adults, children },
        timeSlot: selectedSlot
          ? {
              timeSlotId: selectedSlot._id,
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime,
              label: selectedSlot.label,
            }
          : null,
        variantId: selectedVariant?._id || null,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        specialRequests: specialRequests.trim() || undefined,
      };

      const res = await bookingAPI.createBooking(payload);

      if (res?.success && res.data) {
        const booking = res.data;
        setBookingId(booking._id);
        setBookingRef(booking.bookingReference || booking.referenceNumber || null);
        setBookingData(booking);
        goNext();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Booking failed',
          text2: res?.message || 'Could not create booking. Please try again.',
        });
      }
    } catch (err: any) {
      console.error('[Booking] create error:', err.message);
      Toast.show({
        type: 'error',
        text1: 'Booking error',
        text2: err.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step 4: Payment
  // -------------------------------------------------------------------------

  const handlePayOnline = async () => {
    if (!bookingId) return;
    setPaymentLoading(true);

    try {
      // Step 1: Server creates the Razorpay order. Returns { orderId, amount, currency, keyId }.
      const orderRes = await bookingAPI.createPaymentOrder(bookingId, 'razorpay');

      if (!orderRes?.success || !orderRes.data?.orderId) {
        Toast.show({
          type: 'error',
          text1: 'Payment unavailable',
          text2: orderRes?.message || 'Could not create order. Please try again.',
        });
        setPaymentLoading(false);
        return;
      }

      const { orderId, amount, currency, keyId } = orderRes.data;

      // Step 2: Open native Razorpay sheet. Server-issued keyId takes precedence
      // over the env value so live/test rotation is server-controlled.
      const result = await openCheckout({
        keyId: keyId || ENV.razorpayKeyId,
        orderId,
        amountInPaise: amount || toPaise(totalPrice),
        currency: currency || 'INR',
        description: activity?.title || 'Activity booking',
        prefill: { email, contact: phone, name },
        notes: { bookingId, activityId: String(activityId || '') },
      });

      if (result.status === 'cancelled') {
        Toast.show({
          type: 'info',
          text1: 'Payment cancelled',
          text2: 'You can complete payment anytime from My Bookings.',
        });
        setPaymentLoading(false);
        return;
      }

      if (result.status === 'failed') {
        Toast.show({
          type: 'error',
          text1: 'Payment failed',
          text2: result.reason || 'Please try again.',
        });
        setPaymentLoading(false);
        return;
      }

      // Step 3: Server verifies the signature and marks the booking confirmed.
      // Never trust client-side success — signature check is the source of truth.
      const verifyRes = await bookingAPI.verifyPayment(bookingId, {
        gateway: 'razorpay',
        razorpay_order_id: result.orderId,
        razorpay_payment_id: result.paymentId,
        razorpay_signature: result.signature,
      });

      if (verifyRes?.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment successful',
          text2: 'Your booking is confirmed.',
        });
        setBookingComplete(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification failed',
          text2:
            verifyRes?.message ||
            'Payment captured but verification failed. Our team will reconcile within 24 hours.',
        });
      }
    } catch (err: any) {
      console.warn('[Booking] payment flow error:', err?.message);
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: err?.message || 'Please try again or contact support.',
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePayAtVenue = () => {
    setBookingComplete(true);
  };

  const handleConfirmPayment = () => {
    if (paymentMethod === 'online') {
      handlePayOnline();
    } else {
      handlePayAtVenue();
    }
  };

  // -------------------------------------------------------------------------
  // Date picker handler
  // -------------------------------------------------------------------------

  const onDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      // Reset time slot selection when date changes
      setSelectedSlot(null);
    }
  };

  // -------------------------------------------------------------------------
  // Loading / Error
  // -------------------------------------------------------------------------

  if (pageLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: themeColors.background }]} edges={['top']}>
        <LoadingSpinner fullScreen message="Loading booking details..." />
      </SafeAreaView>
    );
  }

  if (pageError || !activity) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: themeColors.background }]} edges={['top']}>
        <ErrorView
          fullScreen
          title="Could not load activity"
          message={pageError || 'Activity not found.'}
          onRetry={fetchActivity}
        />
      </SafeAreaView>
    );
  }

  // Derived
  const basePrice = activity.pricing?.basePrice ?? activity.pricing?.adultPrice ?? activity.price ?? 0;
  const totalPrice = priceBreakdown?.total ?? priceBreakdown?.totalAmount ?? (basePrice * (adults + children));
  const maxGroupSize = activity.groupSize?.max || 20;

  // =========================================================================
  // RENDER STEPS
  // =========================================================================

  // --------------- STEP 1: Date & Participants ---------------
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: themeColors.text }]}>Select Date & Participants</Text>

      {/* Date selector */}
      <Card bordered style={{ marginBottom: spacing.lg, backgroundColor: themeColors.card, borderColor: themeColors.border }}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Booking Date</Text>

        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.dateButton, { borderColor: themeColors.border }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary[500]} />
            <Text style={[styles.dateButtonText, { color: themeColors.text }]}>{formatDate(selectedDate)}</Text>
            <Ionicons name="chevron-down" size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        )}

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={TOMORROW}
            onChange={onDateChange}
            style={Platform.OS === 'ios' ? { height: 320 } : undefined}
          />
        )}
      </Card>

      {/* Participant counters */}
      <Card bordered style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Participants</Text>
        <Counter
          label="Adults"
          sublabel="Age 18+"
          value={adults}
          min={1}
          max={maxGroupSize - children}
          onChange={setAdults}
        />
        <Counter
          label="Children"
          sublabel="Under 18"
          value={children}
          min={0}
          max={maxGroupSize - adults}
          onChange={setChildren}
        />
        <View style={styles.totalParticipants}>
          <Text style={[styles.totalParticipantsText, { color: themeColors.text }]}>
            Total: {adults + children} participant{adults + children !== 1 ? 's' : ''}
          </Text>
          {maxGroupSize && (
            <Text style={[styles.maxGroupText, { color: themeColors.textTertiary }]}>Max {maxGroupSize} per group</Text>
          )}
        </View>
      </Card>

      <View style={styles.stepFooter}>
        <Button
          title="Continue"
          onPress={() => {
            if (validateStep1()) goNext();
          }}
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );

  // --------------- STEP 2: Time Slots & Variants ---------------
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: themeColors.text }]}>Choose Your Experience</Text>

      {/* Time Slots */}
      {slotsLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading time slots...</Text>
        </View>
      ) : timeSlots.length > 0 ? (
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Available Time Slots</Text>
          {timeSlots.map((slot) => {
            const isSoldOut = (slot.capacity?.booked ?? 0) >= (slot.capacity?.total ?? Infinity);
            const spotsLeft = (slot.capacity?.total ?? 0) - (slot.capacity?.booked ?? 0);
            const isSelected = selectedSlot?._id === slot._id;

            return (
              <SelectableCard
                key={slot._id}
                selected={isSelected}
                disabled={isSoldOut}
                onPress={() => setSelectedSlot(slot)}
              >
                <View style={styles.slotRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slotLabel, { color: themeColors.text }]}>{slot.label || 'Time Slot'}</Text>
                    <Text style={[styles.slotTime, { color: themeColors.textSecondary }]}>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {isSoldOut ? (
                      <Badge label="Sold Out" variant="error" />
                    ) : spotsLeft > 0 && spotsLeft <= 5 ? (
                      <Badge label={`${spotsLeft} spots left`} variant="warning" />
                    ) : spotsLeft > 0 ? (
                      <Text style={[styles.spotsText, { color: themeColors.textTertiary }]}>{spotsLeft} spots</Text>
                    ) : null}
                    {slot.priceModifier && slot.priceModifier !== 1 && (
                      <Badge
                        label={slot.priceModifier > 1 ? `${Math.round((slot.priceModifier - 1) * 100)}% extra` : `${Math.round((1 - slot.priceModifier) * 100)}% off`}
                        variant={slot.priceModifier > 1 ? 'warning' : 'success'}
                        style={{ marginTop: spacing.xs }}
                      />
                    )}
                  </View>
                </View>
              </SelectableCard>
            );
          })}
        </View>
      ) : (
        <View style={[styles.emptyBox, { marginBottom: spacing.xl, backgroundColor: themeColors.surface }]}>
          <Ionicons name="time-outline" size={24} color={themeColors.textTertiary} />
          <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>No specific time slots - open availability</Text>
        </View>
      )}

      {/* Variants */}
      {variantsLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading experience tiers...</Text>
        </View>
      ) : variants.length > 0 ? (
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Experience Tier</Text>
          {variants.map((variant) => {
            const isSelected = selectedVariant?._id === variant._id;
            const variantPrice = variant.pricing?.adultPrice ?? variant.price ?? basePrice;

            return (
              <SelectableCard
                key={variant._id}
                selected={isSelected}
                onPress={() => setSelectedVariant(variant)}
              >
                <View style={styles.variantHeader}>
                  <Text style={[styles.variantName, { color: themeColors.text }]}>{variant.name}</Text>
                  <Text style={styles.variantPrice}>{formatCurrency(variantPrice)}</Text>
                </View>
                {variant.description ? (
                  <Text style={[styles.variantDesc, { color: themeColors.textSecondary }]}>{variant.description}</Text>
                ) : null}
                {variant.highlights && variant.highlights.length > 0 && (
                  <View style={{ marginTop: spacing.sm }}>
                    {variant.highlights.slice(0, 3).map((h: string, i: number) => (
                      <View key={i} style={styles.variantHighlight}>
                        <Ionicons name="checkmark" size={14} color={colors.success} />
                        <Text style={[styles.variantHighlightText, { color: themeColors.textSecondary }]}>{h}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </SelectableCard>
            );
          })}
        </View>
      ) : (
        <View style={[styles.emptyBox, { marginBottom: spacing.xl, backgroundColor: themeColors.surface }]}>
          <Ionicons name="layers-outline" size={24} color={themeColors.textTertiary} />
          <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>Standard experience - no variant selection needed</Text>
        </View>
      )}

      {/* Price Preview */}
      <Card bordered style={{ marginBottom: spacing.lg, backgroundColor: themeColors.card, borderColor: themeColors.border }}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Price Estimate</Text>
        {priceLoading ? (
          <ActivityIndicator color={colors.primary[500]} style={{ paddingVertical: spacing.md }} />
        ) : priceBreakdown ? (
          <View>
            {priceBreakdown.baseAmount != null && (
              <BreakdownRow
                label={`${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? ` + ${children} child${children > 1 ? 'ren' : ''}` : ''}`}
                amount={priceBreakdown.baseAmount}
              />
            )}
            {priceBreakdown.bulkDiscount > 0 && (
              <BreakdownRow label="Group discount" amount={priceBreakdown.bulkDiscount} isDiscount />
            )}
            {priceBreakdown.seasonalAdjustment != null && priceBreakdown.seasonalAdjustment !== 0 && (
              <BreakdownRow
                label="Seasonal pricing"
                amount={Math.abs(priceBreakdown.seasonalAdjustment)}
                isDiscount={priceBreakdown.seasonalAdjustment < 0}
              />
            )}
            {priceBreakdown.tax > 0 && (
              <BreakdownRow label="Tax & fees" amount={priceBreakdown.tax} />
            )}
            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
            <BreakdownRow label="Total" amount={priceBreakdown.total ?? priceBreakdown.totalAmount ?? totalPrice} isTotal />
          </View>
        ) : (
          <View style={styles.priceSimple}>
            <Text style={[styles.priceSimpleLabel, { color: themeColors.textSecondary }]}>Estimated total</Text>
            <Text style={styles.priceSimpleValue}>{formatCurrency(totalPrice)}</Text>
          </View>
        )}
      </Card>

      <View style={styles.stepFooter}>
        <Button
          title="Continue"
          onPress={() => {
            if (validateStep2()) goNext();
          }}
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );

  // --------------- STEP 3: Contact Details ---------------
  const renderStep3 = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={100}
    >
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>Contact Details</Text>

        <TextInput
          label="Full Name"
          placeholder="Enter your full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          leftIcon={<Ionicons name="person-outline" size={18} color={themeColors.textTertiary} />}
        />

        <TextInput
          label="Email Address"
          placeholder="your@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon={<Ionicons name="mail-outline" size={18} color={themeColors.textTertiary} />}
        />

        <TextInput
          label="Phone Number"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          leftIcon={<Ionicons name="call-outline" size={18} color={themeColors.textTertiary} />}
        />

        <TextInput
          label="Special Requests (optional)"
          placeholder="Any special requirements or requests..."
          value={specialRequests}
          onChangeText={setSpecialRequests}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        {/* Booking summary mini card */}
        <Card bordered style={{ marginBottom: spacing.lg, backgroundColor: themeColors.surface, borderColor: themeColors.border }}>
          <Text style={[styles.fieldLabel, { marginBottom: spacing.sm, color: themeColors.text }]}>Booking Summary</Text>
          <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Date</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>{formatDate(selectedDate)}</Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Participants</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>
              {adults} adult{adults > 1 ? 's' : ''}
              {children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}
            </Text>
          </View>
          {selectedSlot && (
            <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Time</Text>
              <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
              </Text>
            </View>
          )}
          {selectedVariant && (
            <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Tier</Text>
              <Text style={[styles.summaryValue, { color: themeColors.text }]}>{selectedVariant.name}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={[styles.summaryLabel, { fontWeight: fontWeight.bold, color: themeColors.text }]}>Total</Text>
            <Text style={[styles.summaryValue, { color: colors.primary[500], fontWeight: fontWeight.bold }]}>
              {formatCurrency(totalPrice)}
            </Text>
          </View>
        </Card>

        <View style={styles.stepFooter}>
          <Button
            title="Create Booking"
            onPress={handleCreateBooking}
            loading={bookingLoading}
            disabled={bookingLoading}
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // --------------- STEP 4: Payment & Confirmation ---------------
  const renderStep4 = () => {
    if (bookingComplete) {
      return renderSuccessScreen();
    }

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>Payment</Text>

        {/* Booking summary */}
        <Card bordered style={{ marginBottom: spacing.xl, backgroundColor: themeColors.card, borderColor: themeColors.border }}>
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Booking Summary</Text>
          <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Activity</Text>
            <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right', color: themeColors.text }]} numberOfLines={2}>
              {activity.title}
            </Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Date</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>{formatDate(selectedDate)}</Text>
          </View>
          {selectedSlot && (
            <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Time</Text>
              <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Participants</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>
              {adults} adult{adults > 1 ? 's' : ''}
              {children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}
            </Text>
          </View>
          {selectedVariant && (
            <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Tier</Text>
              <Text style={[styles.summaryValue, { color: themeColors.text }]}>{selectedVariant.name}</Text>
            </View>
          )}
          {bookingRef && (
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Reference</Text>
              <Text style={[styles.summaryValue, { fontWeight: fontWeight.bold, color: colors.primary[500] }]}>
                {bookingRef}
              </Text>
            </View>
          )}
        </Card>

        {/* Total */}
        <View style={styles.paymentTotalRow}>
          <Text style={[styles.paymentTotalLabel, { color: themeColors.text }]}>Amount to Pay</Text>
          <Text style={styles.paymentTotalAmount}>{formatCurrency(totalPrice)}</Text>
        </View>

        {/* Payment method selection */}
        <Text style={[styles.fieldLabel, { marginBottom: spacing.md, color: themeColors.text }]}>Payment Method</Text>

        <SelectableCard
          selected={paymentMethod === 'online'}
          onPress={() => setPaymentMethod('online')}
        >
          <View style={styles.paymentOptionRow}>
            <View style={[styles.paymentOptionIcon, { backgroundColor: themeColors.surface }]}>
              <Ionicons name="card-outline" size={24} color={colors.primary[500]} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.paymentOptionTitle, { color: themeColors.text }]}>Pay Online</Text>
                <Badge label="Recommended" variant="primary" style={{ marginLeft: spacing.sm }} />
              </View>
              <Text style={[styles.paymentOptionDesc, { color: themeColors.textTertiary }]}>
                Credit/Debit Card, UPI, Net Banking, Wallets
              </Text>
            </View>
          </View>
        </SelectableCard>

        <SelectableCard
          selected={paymentMethod === 'venue'}
          onPress={() => setPaymentMethod('venue')}
        >
          <View style={styles.paymentOptionRow}>
            <View style={[styles.paymentOptionIcon, { backgroundColor: themeColors.surface }]}>
              <Ionicons name="cash-outline" size={24} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.paymentOptionTitle, { color: themeColors.text }]}>Pay at Venue</Text>
              <Text style={[styles.paymentOptionDesc, { color: themeColors.textTertiary }]}>
                Cash or card payment at the activity location
              </Text>
            </View>
          </View>
        </SelectableCard>

        <View style={styles.stepFooter}>
          <Button
            title={paymentMethod === 'online' ? 'Pay Now' : 'Confirm Booking'}
            onPress={handleConfirmPayment}
            loading={paymentLoading}
            disabled={paymentLoading}
            size="lg"
            fullWidth
            icon={
              <Ionicons
                name={paymentMethod === 'online' ? 'lock-closed' : 'checkmark-circle'}
                size={18}
                color="#ffffff"
              />
            }
          />
        </View>
      </View>
    );
  };

  // --------------- Success Screen ---------------
  const renderSuccessScreen = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIconCircle}>
        <Ionicons name="checkmark" size={48} color="#ffffff" />
      </View>

      <Text style={[styles.successTitle, { color: themeColors.text }]}>Booking Confirmed!</Text>
      <Text style={[styles.successSubtext, { color: themeColors.textSecondary }]}>
        Your booking has been {bookingData?.isInstantBooking ? 'instantly confirmed' : 'created successfully'}.
      </Text>

      {bookingRef && (
        <View style={[styles.refContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.refLabel, { color: themeColors.textTertiary }]}>Booking Reference</Text>
          <Text style={styles.refValue}>{bookingRef}</Text>
        </View>
      )}

      {bookingData?.isInstantBooking && (
        <Badge
          label="Instantly Confirmed"
          variant="success"
          size="md"
          style={{ marginBottom: spacing.xl, alignSelf: 'center' }}
        />
      )}

      {paymentMethod === 'venue' && (
        <View style={styles.venuePayNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Text style={styles.venuePayNoteText}>
            Please pay at the venue on the day of the activity.
          </Text>
        </View>
      )}

      <Card bordered style={{ marginBottom: spacing.xl, width: '100%', backgroundColor: themeColors.card, borderColor: themeColors.border }}>
        <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Activity</Text>
          <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right', color: themeColors.text }]} numberOfLines={2}>
            {activity.title}
          </Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Date</Text>
          <Text style={[styles.summaryValue, { color: themeColors.text }]}>{formatDate(selectedDate)}</Text>
        </View>
        {selectedSlot && (
          <View style={[styles.summaryRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>Time</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>
              {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.summaryLabel, { fontWeight: fontWeight.bold, color: themeColors.text }]}>Total</Text>
          <Text style={[styles.summaryValue, { color: colors.primary[500], fontWeight: fontWeight.bold, fontSize: fontSize.lg }]}>
            {formatCurrency(totalPrice)}
          </Text>
        </View>
      </Card>

      <Button
        title="View My Bookings"
        onPress={() => router.replace('/bookings')}
        size="lg"
        fullWidth
        style={{ marginBottom: spacing.md }}
      />
      <Button
        title="Back to Activity"
        onPress={() => router.replace(`/activity/${activityId}`)}
        variant="outline"
        size="lg"
        fullWidth
      />
    </View>
  );

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      {!bookingComplete && (
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            onPress={goBack}
            style={styles.headerBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
            {step === 3 && bookingComplete ? 'Confirmed' : activity.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Step indicator */}
      {!bookingComplete && <Stepper steps={STEP_LABELS} currentStep={step} />}

      {/* Step content */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {stepRenderers[step]()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },

  // Step content
  stepContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  stepFooter: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Field label
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  // Date button (Android)
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
  },
  dateButtonText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    marginLeft: spacing.md,
  },

  // Total participants
  totalParticipants: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  totalParticipantsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  maxGroupText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Time slots
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  slotTime: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  spotsText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Variants
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  variantName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  variantPrice: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  variantDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  variantHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  variantHighlightText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },

  // Loading & empty
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Price
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.sm,
  },
  priceSimple: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  priceSimpleLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  priceSimpleValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },

  // Summary rows
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },

  // Payment
  paymentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  paymentTotalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  paymentTotalAmount: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  paymentOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  paymentOptionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  paymentOptionDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Success screen
  successContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['4xl'],
    alignItems: 'center',
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successSubtext: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  refContainer: {
    backgroundColor: colors.gray[50],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
  },
  refLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  refValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
    letterSpacing: 1,
  },
  venuePayNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  venuePayNoteText: {
    fontSize: fontSize.sm,
    color: colors.info,
    marginLeft: spacing.sm,
    flex: 1,
  },
});
