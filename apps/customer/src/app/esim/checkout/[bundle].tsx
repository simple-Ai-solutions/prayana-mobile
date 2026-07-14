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
import { EsimBundle, coverageLabel, dataLabelFor } from '../../../lib/esim';
import { DateField } from '../../../components/common/DateField';

// Date bounds, mirroring the web checkout's <input type="date"> limits.
const TODAY = new Date();
const MIN_DOB = new Date(1920, 0, 1);
// At least a year old — the web uses the same guard.
const MAX_DOB = new Date(TODAY.getFullYear() - 1, TODAY.getMonth(), TODAY.getDate());

function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

type CheckoutStep = 'contact' | 'kyc' | 'pay';

// The REAL bundle shape (GET /esim/bundles/:name, and data.bundles[] in the
// catalogue). The previous type here described the old mock data — `bundleName`,
// `displayName`, `data`, `validity` and `requiresKyc` do not exist on the wire,
// so every one of them rendered blank.
type Bundle = EsimBundle;

export default function ESimCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bundle: string;
    country?: string;
    provider?: string;
    bundleId?: string;
  }>();
  const bundleName = params.bundle;
  const originCountry = (params.country || '').toUpperCase();
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
    return (bundle.provider || '').toLowerCase() === 'matrix' || bundle.requiresKYC === true;
  }, [bundle]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!bundleName) return;
      setLoading(true);

      // Pass the country the customer clicked through from, so a regional plan
      // is priced (and discounted) exactly as the card showed it.
      let found: Bundle | null = null;
      try {
        const res: any = await esimAPI.getBundleDetails(bundleName, originCountry || undefined);
        found = res?.data || res?.bundle || null;
      } catch {
        // Fall through to the catalogue lookup below.
      }

      // Most bundle names contain a literal "/" ("... - 10 Days / Data Only"),
      // which breaks the /esim/bundles/:name path even percent-encoded — 22 of
      // Japan's 32 plans are named that way. The web hits the same wall and
      // falls back to the catalogue, so do the same rather than dead-end the
      // customer on a plan they just tapped Buy on.
      if (!found) {
        try {
          const cat: any = await esimAPI.getCatalogue(
            originCountry ? { country: originCountry } : {},
          );
          const list: Bundle[] = cat?.data?.bundles ?? [];
          // Match on the provider id first — the same regional plan NAME is sold
          // under many countries, so name alone picks an arbitrary one (it
          // showed "Albania" for a plan bought from the Japan page).
          found =
            list.find((b) => b.providerBundleId && b.providerBundleId === params.bundleId) ??
            list.find(
              (b) =>
                b.name === bundleName &&
                (!originCountry || (b.country ?? '').toUpperCase() === originCountry),
            ) ??
            list.find((b) => b.name === bundleName) ??
            null;
        } catch {
          // Both routes failed — report it below.
        }
      }

      if (!mounted) return;

      if (found) {
        setBundle(found);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Could not load plan',
          text2: 'Please go back and pick the plan again.',
        });
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [bundleName, originCountry, params.bundleId]);

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

    // Matrix requires a DOB and the travel window. These used to be optional
    // free-text fields, so an order could be submitted with them blank and be
    // rejected by the provider AFTER the customer had committed — catch it here,
    // where it is still a form error and not a failed purchase.
    if (!dob) {
      Toast.show({
        type: 'error',
        text1: 'Date of birth required',
        text2: 'Matrix needs it to activate the eSIM.',
      });
      return false;
    }
    if (!travelStart || !travelEnd) {
      Toast.show({
        type: 'error',
        text1: 'Travel dates required',
        text2: 'Pick when you leave and when you return.',
      });
      return false;
    }
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
          bundleName: bundle.name,
          // Send the provider's id and the provider too. A bundle NAME is not
          // unique — the same regional plan is sold under many countries — so
          // the id is what lets the server resolve exactly the plan that was
          // tapped.
          providerBundleId: bundle.providerBundleId || undefined,
          provider: bundle.provider || undefined,
          // The country the customer shopped from, so a regional plan keeps the
          // country-scoped price they were shown. Distinct from `country` below,
          // which is the billing address country.
          coverageCountry: originCountry || bundle.country || undefined,

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
        currency: currency || bundle.sellingCurrency || 'INR',
        description: bundle.name,
        prefill: { email: email.trim(), contact: phone.trim(), name: `${firstName} ${lastName}`.trim() },
        notes: { orderId: currentOrderId!, bundleName: bundle.name },
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
          {/* Plan summary card — real provider fields only. */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>{bundle.name}</Text>
              {bundle.provider ? (
                <Badge label={bundle.provider.toUpperCase()} variant="primary" size="sm" />
              ) : null}
            </View>
            <Text style={styles.summaryMeta}>
              {coverageLabel(bundle)} · {dataLabelFor(bundle)} · {bundle.durationDays} days
            </Text>
            <View style={styles.summaryPriceRow}>
              <Text style={styles.summaryPriceLabel}>Total</Text>
              <View style={styles.summaryPriceStack}>
                {(bundle.discountPercent ?? 0) > 0 && !!bundle.originalPrice && (
                  <Text style={styles.summaryPriceWas}>
                    ₹{bundle.originalPrice.toLocaleString('en-IN')}
                  </Text>
                )}
                <Text style={styles.summaryPriceValue}>
                  ₹{(bundle.sellingPrice || 0).toLocaleString('en-IN')}
                </Text>
              </View>
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
              {/* Real calendars. These were free-text "YYYY-MM-DD" boxes, which
                  is how a purchase silently fails: Matrix validates the format,
                  so a single typo — or an untouched field — rejects the order. */}
              <DateField
                label="Date of birth"
                value={dob}
                onChange={setDob}
                placeholder="Select your date of birth"
                minimumDate={MIN_DOB}
                maximumDate={MAX_DOB}
                editable={!submitting}
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <DateField
                    label="Travel start"
                    value={travelStart}
                    onChange={(iso) => {
                      setTravelStart(iso);
                      // A return before departure is not a date range. Clear it
                      // rather than posting an impossible trip to the provider.
                      if (travelEnd && travelEnd < iso) setTravelEnd('');
                    }}
                    placeholder="Departure"
                    minimumDate={TODAY}
                    editable={!submitting}
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <DateField
                    label="Travel end"
                    value={travelEnd}
                    onChange={setTravelEnd}
                    placeholder="Return"
                    minimumDate={parseISODate(travelStart) ?? TODAY}
                    editable={!submitting}
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
                You'll be charged ₹
                {(bundle.sellingPrice || 0).toLocaleString('en-IN')}. The eSIM
                QR code arrives instantly on success.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
          <Button
            title={step === 'pay' ? `Pay ₹${(bundle.sellingPrice || 0).toLocaleString('en-IN')}` : 'Continue'}
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
  summaryPriceStack: { alignItems: 'flex-end' },
  summaryPriceWas: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  // eSIM is a brand-red surface (the logo's secondary), not the app's orange.
  summaryPriceValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: '#E61417' },
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
