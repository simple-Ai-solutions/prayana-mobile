import React, { useEffect, useMemo, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Button,
  Card,
  TextInput,
  Stepper,
  Badge,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import {
  esimAPI,
  openCheckout,
  toPaise,
} from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { ENV } from '../../../config/env';

type CheckoutStep = 'contact' | 'kyc' | 'pay';

type Bundle = {
  bundleName: string;
  displayName?: string;
  countryCode?: string;
  countryName?: string;
  data?: string;
  validity?: string | number;
  sellingPrice?: number;
  currency?: string;
  provider?: 'matrix' | 'esim_go' | string;
  requiresKyc?: boolean;
};

export default function ESimCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bundle: string }>();
  const bundleName = params.bundle;
  const { user } = useAuth();
  const { themeColors } = useTheme();

  const [step, setStep] = useState<CheckoutStep>('contact');
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Contact / personal details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [travelStart, setTravelStart] = useState('');
  const [travelEnd, setTravelEnd] = useState('');

  // Address (Matrix-required)
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');

  // Identity / KYC
  const [passportNo, setPassportNo] = useState('');
  const [passportImage, setPassportImage] = useState<string | null>(null);

  // Order id once created
  const [orderId, setOrderId] = useState<string | null>(null);

  const requiresMatrixKyc = useMemo(() => {
    if (!bundle) return false;
    return (bundle.provider || '').toLowerCase() === 'matrix' || bundle.requiresKyc === true;
  }, [bundle]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!bundleName) return;
      setLoading(true);
      try {
        const res = await esimAPI.getBundleDetails(bundleName);
        if (!mounted) return;
        setBundle(res?.data || res?.bundle || null);
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: 'Could not load plan',
          text2: err?.message || 'Please try again.',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [bundleName]);

  // Pre-fill from auth profile
  useEffect(() => {
    if (!user) return;
    const parts = (user.displayName || '').split(' ');
    if (!firstName && parts[0]) setFirstName(parts[0]);
    if (!lastName && parts.length > 1) setLastName(parts.slice(1).join(' '));
    if (!email && user.email) setEmail(user.email);
    if (!phone && user.phoneNumber) setPhone(user.phoneNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const validateContact = () => {
    if (!firstName.trim() || !lastName.trim()) {
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
  };

  const validateKyc = () => {
    if (!requiresMatrixKyc) return true;
    if (!passportNo.trim() || passportNo.trim().length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Passport number required',
        text2: 'Matrix eSIM activation requires a valid passport number.',
      });
      return false;
    }
    if (!addressLine1.trim() || !city.trim() || !pincode.trim()) {
      Toast.show({ type: 'error', text1: 'Complete address required' });
      return false;
    }
    return true;
  };

  const pickPassportImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({
        type: 'error',
        text1: 'Permission needed',
        text2: 'Please allow photo access to upload your passport.',
      });
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setPassportImage(res.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleNext = () => {
    if (step === 'contact') {
      if (!validateContact()) return;
      Haptics.selectionAsync();
      setStep(requiresMatrixKyc ? 'kyc' : 'pay');
    } else if (step === 'kyc') {
      if (!validateKyc()) return;
      Haptics.selectionAsync();
      setStep('pay');
    }
  };

  const handlePay = async () => {
    if (!bundle) return;
    setSubmitting(true);

    try {
      // Step 1: Create order on the server
      let currentOrderId = orderId;
      if (!currentOrderId) {
        const createRes = await esimAPI.createOrder({
          bundleName: bundle.bundleName,
          customerFirstName: firstName.trim(),
          customerLastName: lastName.trim(),
          customerName: `${firstName.trim()} ${lastName.trim()}`,
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          customerDOB: dob || undefined,
          travelStartDate: travelStart || undefined,
          travelEndDate: travelEnd || undefined,
          customerPassportNo: passportNo.trim() || undefined,
          addressLine1: addressLine1.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          pincode: pincode.trim() || undefined,
          country,
        });
        if (!createRes?.success || !createRes?.data?._id) {
          Toast.show({
            type: 'error',
            text1: 'Could not create order',
            text2: createRes?.message || 'Please try again.',
          });
          setSubmitting(false);
          return;
        }
        currentOrderId = createRes.data._id;
        setOrderId(currentOrderId);

        // Optional: upload passport image to KYC endpoint if user picked one
        if (requiresMatrixKyc && passportImage) {
          try {
            const fd = new FormData();
            // RN FormData accepts an object with uri/name/type; cast to any to satisfy TS.
            fd.append('passport', {
              uri: passportImage,
              name: 'passport.jpg',
              type: 'image/jpeg',
            } as any);
            await esimAPI.uploadKYC(currentOrderId!, fd);
          } catch (err: any) {
            console.warn('[eSIM] KYC upload non-fatal:', err?.message);
          }
        }
      }

      // Step 2: Server creates Razorpay order
      const orderRes = await esimAPI.createPaymentOrder(currentOrderId!);
      if (!orderRes?.success || !orderRes?.data?.orderId) {
        Toast.show({
          type: 'error',
          text1: 'Payment unavailable',
          text2: orderRes?.message || 'Please try again.',
        });
        setSubmitting(false);
        return;
      }
      const { orderId: rzpOrderId, amount, currency, keyId } = orderRes.data;

      // Step 3: Open Razorpay checkout sheet
      const result = await openCheckout({
        keyId: keyId || ENV.razorpayKeyId,
        orderId: rzpOrderId,
        amountInPaise: amount || toPaise(bundle.sellingPrice || 0),
        currency: currency || bundle.currency || 'INR',
        description: bundle.displayName || bundle.bundleName,
        prefill: { email: email.trim(), contact: phone.trim(), name: `${firstName} ${lastName}`.trim() },
        notes: { orderId: currentOrderId!, bundleName: bundle.bundleName },
      });

      if (result.status === 'cancelled') {
        Toast.show({
          type: 'info',
          text1: 'Payment cancelled',
          text2: 'You can resume from My eSIM Orders.',
        });
        setSubmitting(false);
        return;
      }
      if (result.status === 'failed') {
        Toast.show({
          type: 'error',
          text1: 'Payment failed',
          text2: result.reason || 'Please try again.',
        });
        setSubmitting(false);
        return;
      }

      // Step 4: Server-side verify + provider fulfilment (issues the eSIM)
      const verifyRes = await esimAPI.verifyPayment(currentOrderId!, {
        razorpayOrderId: result.orderId,
        razorpayPaymentId: result.paymentId,
        razorpaySignature: result.signature,
      });

      if (verifyRes?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: 'eSIM purchased',
          text2: 'Your QR code is ready in My eSIM Orders.',
        });
        router.replace('/esim/my-orders');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification failed',
          text2:
            verifyRes?.message ||
            'Payment captured but eSIM provisioning failed. Our team will reconcile within 24h.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: err?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary[500]} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!bundle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: themeColors.text }]}>Plan not found</Text>
          <Button
            title="Browse plans"
            onPress={() => router.replace('/esim')}
            variant="primary"
            size="md"
          />
        </View>
      </SafeAreaView>
    );
  }

  const stepIndex = step === 'contact' ? 0 : step === 'kyc' ? 1 : requiresMatrixKyc ? 2 : 1;
  const totalSteps = requiresMatrixKyc ? 3 : 2;
  const stepLabels = requiresMatrixKyc
    ? ['Contact', 'KYC', 'Pay']
    : ['Contact', 'Pay'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Checkout</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Stepper steps={stepLabels} currentStep={stepIndex} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Plan summary card */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>
                {bundle.displayName || bundle.bundleName}
              </Text>
              {bundle.provider ? (
                <Badge label={bundle.provider.toUpperCase()} variant="primary" size="sm" />
              ) : null}
            </View>
            <Text style={styles.summaryMeta}>
              {bundle.countryName || bundle.countryCode || 'Global'} · {bundle.data || ''} · {bundle.validity || ''} days
            </Text>
            <View style={styles.summaryPriceRow}>
              <Text style={styles.summaryPriceLabel}>Total</Text>
              <Text style={styles.summaryPriceValue}>
                {bundle.currency || '₹'} {(bundle.sellingPrice || 0).toLocaleString('en-IN')}
              </Text>
            </View>
          </Card>

          {step === 'contact' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Your details</Text>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First name"
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Last name"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last name"
                  />
                </View>
              </View>
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
                label="Date of birth (YYYY-MM-DD)"
                value={dob}
                onChangeText={setDob}
                placeholder="1995-04-21"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Travel start"
                    value={travelStart}
                    onChangeText={setTravelStart}
                    placeholder="2026-05-01"
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Travel end"
                    value={travelEnd}
                    onChangeText={setTravelEnd}
                    placeholder="2026-05-15"
                  />
                </View>
              </View>
            </View>
          )}

          {step === 'kyc' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Identity & address</Text>
              <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
                Required by Matrix Cellular regulations for international eSIM activation.
              </Text>

              <TextInput
                label="Passport number"
                value={passportNo}
                onChangeText={setPassportNo}
                placeholder="A1234567"
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={styles.uploadBox}
                onPress={pickPassportImage}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={passportImage ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={28}
                  color={passportImage ? colors.success : colors.primary[500]}
                />
                <Text style={styles.uploadText}>
                  {passportImage ? 'Passport photo selected' : 'Upload passport photo'}
                </Text>
                <Text style={styles.uploadHint}>
                  JPG/PNG, clear image of the bio page
                </Text>
              </TouchableOpacity>

              <TextInput
                label="Address line"
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="Building, street"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput label="City" value={city} onChangeText={setCity} placeholder="Bengaluru" />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <TextInput label="State" value={state} onChangeText={setState} placeholder="KA" />
                </View>
              </View>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Pincode"
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="560001"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <TextInput label="Country" value={country} onChangeText={setCountry} placeholder="India" />
                </View>
              </View>
            </View>
          )}

          {step === 'pay' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Review & pay</Text>
              <Card style={styles.reviewCard}>
                <ReviewRow label="Name" value={`${firstName} ${lastName}`.trim()} />
                <ReviewRow label="Email" value={email} />
                <ReviewRow label="Phone" value={phone} />
                {requiresMatrixKyc && passportNo ? (
                  <ReviewRow label="Passport" value={passportNo} />
                ) : null}
                {travelStart ? (
                  <ReviewRow label="Travel" value={`${travelStart} → ${travelEnd}`} />
                ) : null}
              </Card>
              <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
                You'll be charged {bundle.currency || '₹'}
                {(bundle.sellingPrice || 0).toLocaleString('en-IN')}. The eSIM
                QR code arrives instantly on success.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
          <Button
            title={step === 'pay' ? `Pay ${bundle.currency || '₹'}${(bundle.sellingPrice || 0).toLocaleString('en-IN')}` : 'Continue'}
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
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
  summaryCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  summaryMeta: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  summaryPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryPriceLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  summaryPriceValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary[600] },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  sectionHint: { fontSize: fontSize.sm, color: colors.textTertiary, lineHeight: 20 },
  row2: { flexDirection: 'row', alignItems: 'flex-end' },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary[300],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    gap: spacing.xs,
  },
  uploadText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  uploadHint: { fontSize: fontSize.xs, color: colors.textTertiary },
  reviewCard: { padding: spacing.lg, gap: spacing.sm },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  reviewLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  reviewValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
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
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
});
