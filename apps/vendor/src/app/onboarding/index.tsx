import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';

import { TextInput, Card, Button, LoadingSpinner, useTheme } from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { useAuth } from '@prayana/shared-hooks';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ---------------------------------------------------------------------------
// Constants (mirrored from the web onboarding)
// ---------------------------------------------------------------------------

type AccountType = 'company' | 'agent';

interface AccountTypeOption {
  id: AccountType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  bestFor: string;
}

const ACCOUNT_TYPES: AccountTypeOption[] = [
  {
    id: 'company',
    icon: 'business-outline',
    title: 'Company / Tour Operator',
    description: 'Business entity with multiple guides and activities.',
    bestFor: 'Tour Operators & Agencies',
  },
  {
    id: 'agent',
    icon: 'person-outline',
    title: 'Individual Guide',
    description: 'Solo guide or freelance operator.',
    bestFor: 'Freelance Guides',
  },
];

// Reused verbatim from the web BusinessSetupStep INDIAN_STATES list.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
];

// Vendor Agreement doc (mirrors lib/legal/registry.js "vendor-agreement").
const VENDOR_AGREEMENT = {
  slug: 'vendor-agreement',
  versionTag: 'v1',
  currentVersion: '1.0.0',
  effectiveDate: '2026-05-28',
  title: 'Vendor / Supplier Agreement',
};
const AGREEMENT_URL = `https://prayanaai.com/legal/${VENDOR_AGREEMENT.slug}-${VENDOR_AGREEMENT.versionTag}`;

interface PayoutTabOption {
  id: 'bank_transfer' | 'upi' | 'stripe';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  sub: string;
  comingSoon?: boolean;
}

const PAYOUT_TABS: PayoutTabOption[] = [
  { id: 'bank_transfer', label: 'Bank Transfer', icon: 'card-outline', sub: 'Direct deposit' },
  { id: 'upi', label: 'UPI', icon: 'phone-portrait-outline', sub: 'Fast & free' },
  { id: 'stripe', label: 'Stripe', icon: 'globe-outline', sub: 'International', comingSoon: true },
];

// The wizard is 3 linear steps: Business Setup -> Vendor Agreement -> Payout.
// Each step's own heading names it, and the header shows "Step N of 3", so no
// step-list data is needed for rendering.
const TOTAL_STEPS = 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{10,}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingWizardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();

  const {
    onboardingStep,
    onboardingData,
    businessAccount,
    setOnboardingStep,
    setOnboardingData,
    setBusinessAccount,
  } = useBusinessStore();

  // 3-step wizard, 1-indexed. Seeded from the store so a reload returns to step.
  const [currentStep, setCurrentStep] = useState<number>(
    onboardingStep >= 1 && onboardingStep <= 3 ? onboardingStep : 1
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      setOnboardingStep(step);
    },
    [setOnboardingStep]
  );

  // ---------------------------------------------------------------------
  // Step 1 — Business Setup local state
  // ---------------------------------------------------------------------

  const seed = (onboardingData?.businessDetails ?? {}) as Record<string, any>;

  const [accountType, setAccountType] = useState<AccountType | null>(
    (onboardingData?.accountType as AccountType) ||
      (businessAccount?.accountType as AccountType) ||
      null
  );
  const [businessName, setBusinessName] = useState<string>(
    businessAccount?.businessName || seed.businessName || ''
  );
  const [tagline, setTagline] = useState<string>(
    businessAccount?.tagline || seed.tagline || ''
  );
  const [description, setDescription] = useState<string>(
    businessAccount?.description || seed.description || ''
  );
  const [city, setCity] = useState<string>(
    businessAccount?.location?.city || seed.city || ''
  );
  const [state, setState] = useState<string>(
    businessAccount?.location?.state || seed.state || ''
  );
  const [email, setEmail] = useState<string>(
    businessAccount?.contact?.email || seed.email || user?.email || ''
  );
  const [phone, setPhone] = useState<string>(
    businessAccount?.contact?.phone || seed.phone || (user as any)?.phoneNumber || ''
  );
  const [logoUri, setLogoUri] = useState<string | null>(businessAccount?.logo || null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [setupErrors, setSetupErrors] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------
  // Step 2 — Vendor Agreement local state
  // ---------------------------------------------------------------------

  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryDesignation, setSignatoryDesignation] = useState('');
  const [signatoryEmail, setSignatoryEmail] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Step 3 — Payout local state
  // ---------------------------------------------------------------------

  const [payoutTab, setPayoutTab] = useState<PayoutTabOption['id']>('bank_transfer');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscError, setIfscError] = useState('');

  const businessNameLabel = accountType === 'agent' ? 'Your name' : 'Business name';
  const businessNamePlaceholder =
    accountType === 'agent' ? 'e.g., Ravi Kumar' : 'e.g., Hampi Heritage Tours';

  const initials = useMemo(
    () =>
      (businessName || '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || '?',
    [businessName]
  );

  // ---- IFSC auto-lookup (debounced), mirrors web PayoutStep useEffect ----
  useEffect(() => {
    const ifsc = ifscCode.trim();
    const debounce = setTimeout(async () => {
      if (ifsc.length === 11 && IFSC_RE.test(ifsc)) {
        setIfscLoading(true);
        setIfscError('');
        try {
          const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
          if (res.ok) {
            const data = await res.json();
            setBankName(data.BANK || '');
            setBranchName(data.BRANCH || '');
            setIfscError('');
          } else {
            setIfscError('Invalid IFSC code');
            setBankName('');
            setBranchName('');
          }
        } catch {
          setIfscError('Could not validate IFSC code');
        } finally {
          setIfscLoading(false);
        }
      } else if (ifsc.length > 0 && ifsc.length < 11) {
        setIfscError('IFSC code must be 11 characters');
      } else {
        setIfscError('');
        setBankName('');
        setBranchName('');
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [ifscCode]);

  // ---------------------------------------------------------------------
  // Step 1 handlers
  // ---------------------------------------------------------------------

  const handleLogoUpload = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission needed to pick a logo' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLogoUri(asset.uri); // local preview immediately
      setLogoUploading(true);
      try {
        const fd = new FormData();
        fd.append('logo', {
          uri: asset.uri,
          name: asset.uri.split('/').pop() || 'logo.jpg',
          type: asset.mimeType || 'image/jpeg',
        } as any);
        const res: any = await businessAPI.uploadLogo(fd);
        const serverUrl = res?.logoUrl || res?.data?.logoUrl || res?.url;
        if (serverUrl) setLogoUri(serverUrl);
        Toast.show({ type: 'success', text1: 'Logo added' });
      } catch {
        Toast.show({ type: 'error', text1: 'Logo upload failed — preview shown' });
      } finally {
        setLogoUploading(false);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not pick logo' });
    }
  }, []);

  const validateSetup = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!accountType) errs.accountType = 'Please select an account type';
    if (!businessName.trim() || businessName.trim().length < 3) {
      errs.businessName = 'Must be at least 3 characters';
    }
    if (email && !EMAIL_RE.test(email)) errs.email = 'Invalid email format';
    if (phone && !PHONE_RE.test(phone)) errs.phone = 'Invalid phone (min 10 digits)';
    setSetupErrors(errs);
    return Object.keys(errs).length === 0;
  }, [accountType, businessName, email, phone]);

  const handleSetupNext = useCallback(async () => {
    if (!validateSetup()) return;
    setIsSubmitting(true);
    try {
      const location = { city: city.trim(), state: state.trim(), country: 'India' };
      const contact = { email: email.trim(), phone: phone.trim() };
      const stepData = {
        accountType,
        businessName: businessName.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        city: city.trim(),
        state: state.trim(),
        country: 'India',
        email: email.trim(),
        phone: phone.trim(),
      };

      // Mirror the web wizard's handleSetupNext: update if a business already
      // exists, otherwise register a new one.
      const existing = await businessAPI.getMyBusiness().catch(() => null);

      let res: any;
      if (existing?.success && existing.data) {
        res = await businessAPI.updateMyBusiness({
          businessName: businessName.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          location,
          contact,
        });
      } else {
        res = await businessAPI.register({
          accountType,
          businessName:
            businessName.trim() ||
            `My ${accountType === 'agent' ? 'Guide' : 'Business'}`,
          tagline: tagline.trim(),
          description: description.trim(),
          location,
          contact,
        });
      }

      if (res?.success) {
        setBusinessAccount(res.data);
        setOnboardingData('accountType', accountType);
        setOnboardingData('businessDetails', stepData);
      } else {
        throw new Error(res?.message || 'Could not save business details.');
      }

      await businessAPI.saveOnboardingStep(2, stepData);
      goToStep(2);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: error?.message || 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateSetup,
    accountType,
    businessName,
    tagline,
    description,
    city,
    state,
    email,
    phone,
    setBusinessAccount,
    setOnboardingData,
    goToStep,
  ]);

  // ---------------------------------------------------------------------
  // Step 2 handlers
  // ---------------------------------------------------------------------

  const canAcceptAgreement =
    agreementAccepted &&
    signatoryName.trim().length > 1 &&
    signatoryDesignation.trim().length > 1 &&
    EMAIL_RE.test(signatoryEmail.trim());

  const openAgreement = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(AGREEMENT_URL);
    } catch {
      Linking.openURL(AGREEMENT_URL).catch(() => {
        Toast.show({ type: 'error', text1: 'Could not open the agreement' });
      });
    }
  }, []);

  const handleAcceptAgreement = useCallback(async () => {
    if (!canAcceptAgreement || isSubmitting) return;
    setIsSubmitting(true);
    setAgreementError(null);
    try {
      const res: any = await businessAPI.acceptVendorAgreement({
        signatoryName: signatoryName.trim(),
        signatoryDesignation: signatoryDesignation.trim(),
        signatoryEmail: signatoryEmail.trim().toLowerCase(),
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Could not record acceptance.');
      }

      // Refresh the business so acceptedVendorAgreements is current downstream.
      try {
        const fresh: any = await businessAPI.getMyBusiness();
        if (fresh?.success) setBusinessAccount(fresh.data);
      } catch {
        /* non-fatal */
      }

      await businessAPI.saveOnboardingStep(3, {
        signatoryName: signatoryName.trim(),
        signatoryDesignation: signatoryDesignation.trim(),
        signatoryEmail: signatoryEmail.trim().toLowerCase(),
      });

      Toast.show({
        type: 'success',
        text1: 'Vendor Agreement accepted',
        text2: 'Welcome to the Prayana AI marketplace.',
      });
      goToStep(3);
    } catch (error: any) {
      setAgreementError(error?.message || 'Could not record acceptance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canAcceptAgreement,
    isSubmitting,
    signatoryName,
    signatoryDesignation,
    signatoryEmail,
    setBusinessAccount,
    goToStep,
  ]);

  // ---------------------------------------------------------------------
  // Step 3 handlers
  // ---------------------------------------------------------------------

  const payoutComplete =
    (payoutTab === 'bank_transfer' &&
      !!accountHolderName.trim() &&
      !!accountNumber.trim() &&
      !!bankName.trim()) ||
    (payoutTab === 'upi' && upiId.trim().length > 0);

  const completeOnboarding = useCallback(
    async (payload: Record<string, any>) => {
      setIsSubmitting(true);
      try {
        // Persist a real payout config only when a method was chosen.
        if (payload.method && payload.method !== 'skip') {
          await businessAPI.configurePayout(payload);
        }
        // Server understands step 5 = onboarding fully complete.
        await businessAPI.saveOnboardingStep(5, payload);
        setOnboardingData('payoutDetails', payload);
        Toast.show({ type: 'success', text1: 'Setup complete! Welcome aboard.' });
        router.push('/(tabs)');
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'Could not finish setup',
          text2: error?.message || 'Please try again.',
        });
        setIsSubmitting(false);
      }
    },
    [setOnboardingData, router]
  );

  const handlePayoutComplete = useCallback(() => {
    if (payoutTab === 'bank_transfer') {
      completeOnboarding({
        method: accountNumber ? 'bank_transfer' : 'skip',
        bankDetails: accountNumber
          ? { accountHolderName, accountNumber, ifscCode, bankName, branchName }
          : null,
      });
    } else if (payoutTab === 'upi') {
      completeOnboarding({
        method: upiId ? 'upi' : 'skip',
        upiId: upiId || null,
      });
    } else {
      completeOnboarding({ method: 'skip' });
    }
  }, [
    payoutTab,
    accountNumber,
    accountHolderName,
    ifscCode,
    bankName,
    branchName,
    upiId,
    completeOnboarding,
  ]);

  const handleSkipToDashboard = useCallback(() => {
    completeOnboarding({ method: 'skip' });
  }, [completeOnboarding]);

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------

  const handleBack = useCallback(() => {
    if (currentStep > 1) goToStep(currentStep - 1);
    else router.back();
  }, [currentStep, goToStep, router]);

  // ======================================================================
  // Renderers
  // ======================================================================

  const renderSetupStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: themeColors.text }]}>Set up your business</Text>
      <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
        Takes less than 2 minutes. You can refine details anytime.
      </Text>

      {/* Account type */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>ACCOUNT TYPE</Text>
        {setupErrors.accountType && (
          <Text style={styles.inlineError}>{setupErrors.accountType}</Text>
        )}
      </View>
      <View style={styles.accountTypeGrid}>
        {ACCOUNT_TYPES.map((type) => {
          const isSelected = accountType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              activeOpacity={0.8}
              onPress={() => {
                setAccountType(type.id);
                setSetupErrors((e) => ({ ...e, accountType: '' }));
              }}
              style={[
                styles.accountTypeCard,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                isSelected && styles.accountTypeCardSelected,
              ]}
            >
              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary[500]} />
                </View>
              )}
              <View
                style={[
                  styles.accountTypeIcon,
                  { backgroundColor: colors.primary[500] },
                ]}
              >
                <Ionicons name={type.icon} size={22} color="#ffffff" />
              </View>
              <Text style={[styles.accountTypeTitle, { color: themeColors.text }]}>
                {type.title}
              </Text>
              <Text style={[styles.accountTypeDesc, { color: themeColors.textSecondary }]}>
                {type.description}
              </Text>
              <View
                style={[
                  styles.bestForPill,
                  {
                    backgroundColor: isSelected ? colors.primary[500] : colors.primary[50],
                  },
                ]}
              >
                <Ionicons
                  name="sparkles"
                  size={11}
                  color={isSelected ? '#ffffff' : colors.primary[500]}
                />
                <Text
                  style={[
                    styles.bestForText,
                    { color: isSelected ? '#ffffff' : colors.primary[600] },
                  ]}
                >
                  {type.bestFor}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Identity: logo + name + tagline */}
      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: themeColors.textSecondary }]}>
        IDENTITY
      </Text>
      <View style={styles.identityStack}>
        <View style={styles.logoColumn}>
          <TouchableOpacity
            style={[styles.logoBox, { borderColor: themeColors.border, backgroundColor: themeColors.inputBackground }]}
            onPress={handleLogoUpload}
            activeOpacity={0.8}
          >
            {logoUploading ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="cloud-upload-outline" size={20} color={themeColors.textTertiary} />
                <Text style={[styles.logoPlaceholderText, { color: themeColors.textTertiary }]}>Logo</Text>
              </View>
            )}
          </TouchableOpacity>
          {logoUri ? (
            <TouchableOpacity onPress={() => setLogoUri(null)} style={styles.logoRemove}>
              <Ionicons name="close" size={12} color={colors.error} />
              <Text style={styles.logoRemoveText}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.logoHint, { color: themeColors.textTertiary }]}>Optional, &lt;5MB</Text>
          )}
        </View>

        <View style={styles.identityFields}>
          <TextInput
            label={`${businessNameLabel} *`}
            placeholder={businessNamePlaceholder}
            value={businessName}
            onChangeText={(v: string) => {
              setBusinessName(v);
              if (setupErrors.businessName) setSetupErrors((e) => ({ ...e, businessName: '' }));
            }}
            error={setupErrors.businessName}
            autoCapitalize="words"
          />
          <TextInput
            label="Tagline (optional)"
            placeholder="A short line about what you offer"
            value={tagline}
            onChangeText={(v: string) => setTagline(v.slice(0, 200))}
            maxLength={200}
            hint={`${tagline.length}/200`}
          />
        </View>
      </View>

      {/* Location */}
      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: themeColors.textSecondary }]}>
        LOCATION
      </Text>
      <TextInput
        label="City"
        placeholder="City (e.g., Hampi)"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
      />
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>State</Text>
        <TouchableOpacity
          style={[styles.selector, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }]}
          onPress={() => setShowStatePicker((s) => !s)}
          activeOpacity={0.8}
        >
          <Text style={{ color: state ? themeColors.text : themeColors.textTertiary, fontSize: fontSize.md }}>
            {state || 'Select state'}
          </Text>
          <Ionicons
            name={showStatePicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>
      </View>
      {showStatePicker && (
        <View style={[styles.stateDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {INDIAN_STATES.map((s) => {
              const isSel = state === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.stateOption, { borderBottomColor: themeColors.border }, isSel && { backgroundColor: colors.primary[50] }]}
                  onPress={() => {
                    setState(s);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={{ color: isSel ? colors.primary[600] : themeColors.text, fontSize: fontSize.md, fontWeight: isSel ? fontWeight.semibold : fontWeight.normal }}>
                    {s}
                  </Text>
                  {isSel && <Ionicons name="checkmark" size={16} color={colors.primary[500]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Contact */}
      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: themeColors.textSecondary }]}>
        CONTACT
      </Text>
      <TextInput
        label="Business email"
        placeholder="you@business.com"
        value={email}
        onChangeText={(v: string) => {
          setEmail(v);
          if (setupErrors.email) setSetupErrors((e) => ({ ...e, email: '' }));
        }}
        error={setupErrors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon={<Ionicons name="mail-outline" size={18} color={themeColors.textTertiary} />}
      />
      <TextInput
        label="Phone / WhatsApp"
        placeholder="10-digit mobile number"
        value={phone}
        onChangeText={(v: string) => {
          setPhone(v);
          if (setupErrors.phone) setSetupErrors((e) => ({ ...e, phone: '' }));
        }}
        error={setupErrors.phone}
        keyboardType="phone-pad"
        leftIcon={<Ionicons name="call-outline" size={18} color={themeColors.textTertiary} />}
      />

      <Text style={[styles.helperNote, { color: themeColors.textTertiary }]}>
        Documents (PAN, GSTIN) can be added later from your dashboard.
      </Text>
    </View>
  );

  const renderAgreementStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: themeColors.text }]}>Vendor Agreement</Text>
      <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
        You must accept the Vendor Agreement before publishing any listing on Prayana. The text is
        binding once signed; please read it before accepting.
      </Text>

      <Card style={styles.agreementInfoCard} bordered elevated={false} padding="md">
        <Text style={[styles.agreementDocTitle, { color: themeColors.text }]}>
          {VENDOR_AGREEMENT.title}
        </Text>
        <Text style={[styles.agreementDocMeta, { color: themeColors.textSecondary }]}>
          version {VENDOR_AGREEMENT.currentVersion} · effective {VENDOR_AGREEMENT.effectiveDate}
        </Text>
        <TouchableOpacity onPress={openAgreement} style={styles.agreementLinkRow} activeOpacity={0.7}>
          <Text style={[styles.agreementLink, { color: colors.primary[600] }]}>
            Read the full agreement
          </Text>
          <Ionicons name="open-outline" size={15} color={colors.primary[600]} />
        </TouchableOpacity>
      </Card>

      <TextInput
        label="Signatory name"
        placeholder="e.g. Ravi Kumar"
        value={signatoryName}
        onChangeText={setSignatoryName}
        autoCapitalize="words"
      />
      <TextInput
        label="Designation"
        placeholder="e.g. Director / Proprietor"
        value={signatoryDesignation}
        onChangeText={setSignatoryDesignation}
        autoCapitalize="words"
      />
      <TextInput
        label="Signatory email"
        placeholder="signatory@company.com"
        value={signatoryEmail}
        onChangeText={setSignatoryEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setAgreementAccepted((a) => !a)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: agreementAccepted ? colors.primary[500] : themeColors.border },
            agreementAccepted && { backgroundColor: colors.primary[500] },
          ]}
        >
          {agreementAccepted && <Ionicons name="checkmark" size={14} color="#ffffff" />}
        </View>
        <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>
          I confirm I am authorised to bind my business and accept the {VENDOR_AGREEMENT.title} on
          its behalf at version {VENDOR_AGREEMENT.currentVersion}.
        </Text>
      </TouchableOpacity>

      {agreementError && <Text style={styles.blockError}>{agreementError}</Text>}
    </View>
  );

  const renderPayoutStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: themeColors.text }]}>Set up your payout</Text>
      <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
        Choose how you'd like to receive your earnings — you can change this anytime.
      </Text>

      {/* Method tabs */}
      <View style={styles.payoutTabs}>
        {PAYOUT_TABS.map((tab) => {
          const isActive = payoutTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.payoutTab,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                isActive && styles.payoutTabActive,
              ]}
              onPress={() => setPayoutTab(tab.id)}
              activeOpacity={0.8}
            >
              <View style={styles.payoutTabHeader}>
                <View
                  style={[
                    styles.payoutTabIcon,
                    { backgroundColor: isActive ? colors.primary[500] : colors.primary[50] },
                  ]}
                >
                  <Ionicons name={tab.icon} size={18} color={isActive ? '#ffffff' : colors.primary[500]} />
                </View>
                {tab.comingSoon ? (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>SOON</Text>
                  </View>
                ) : isActive ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                ) : null}
              </View>
              <Text style={[styles.payoutTabLabel, { color: themeColors.text }]}>{tab.label}</Text>
              <Text style={[styles.payoutTabSub, { color: themeColors.textSecondary }]}>{tab.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bank Transfer */}
      {payoutTab === 'bank_transfer' && (
        <View>
          <TextInput
            label="Account holder name *"
            placeholder="Full name as per bank records"
            value={accountHolderName}
            onChangeText={setAccountHolderName}
            autoCapitalize="words"
          />
          <TextInput
            label="Account number *"
            placeholder="Enter bank account number"
            value={accountNumber}
            onChangeText={(v: string) => setAccountNumber(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            secureTextEntry={!showAccountNumber}
            rightIcon={
              <TouchableOpacity onPress={() => setShowAccountNumber((s) => !s)}>
                <Ionicons
                  name={showAccountNumber ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            }
          />
          <TextInput
            label="IFSC code *"
            placeholder="e.g., HDFC0000123"
            value={ifscCode}
            onChangeText={(v: string) => setIfscCode(v.toUpperCase().slice(0, 11))}
            autoCapitalize="characters"
            maxLength={11}
            error={ifscError || undefined}
            rightIcon={
              ifscLoading ? (
                <ActivityIndicator size="small" color={colors.primary[500]} />
              ) : bankName ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : undefined
            }
          />
          {!!bankName && (
            <View style={styles.bankConfirmCard}>
              <View style={styles.bankConfirmIcon}>
                <Ionicons name="business" size={16} color="#ffffff" />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.bankConfirmName} numberOfLines={1}>{bankName}</Text>
                {!!branchName && (
                  <Text style={styles.bankConfirmBranch} numberOfLines={1}>{branchName}</Text>
                )}
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </View>
          )}
        </View>
      )}

      {/* UPI */}
      {payoutTab === 'upi' && (
        <View>
          <TextInput
            label="UPI ID *"
            placeholder="e.g., yourname@upi or 9876543210@paytm"
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.upiInfoCard}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary[600]} />
            <View style={styles.flex1}>
              <Text style={[styles.upiInfoTitle, { color: colors.primary[700] }]}>Fast & free transfers</Text>
              <Text style={[styles.upiInfoText, { color: colors.primary[600] }]}>
                Payments arrive in your UPI account within 2–3 business days after each booking
                completes.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Stripe */}
      {payoutTab === 'stripe' && (
        <View style={[styles.stripeCard, { borderColor: themeColors.border }]}>
          <View style={styles.stripeIcon}>
            <Ionicons name="globe-outline" size={26} color="#ffffff" />
          </View>
          <Text style={[styles.stripeTitle, { color: themeColors.text }]}>
            Stripe Connect (International)
          </Text>
          <Text style={[styles.stripeText, { color: themeColors.textSecondary }]}>
            For receiving foreign-currency payouts (USD, EUR, GBP). Most India-based vendors only
            need bank transfer or UPI above.
          </Text>
          <Text style={[styles.stripeSoon, { color: themeColors.textTertiary }]}>
            Coming soon — Stripe Connect onboarding activates once foreign-currency settlement is
            enabled.
          </Text>
        </View>
      )}

      {/* Trust banner */}
      <View style={styles.trustBanner}>
        <View style={styles.trustIcon}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary[600]} />
        </View>
        <View style={styles.flex1}>
          <Text style={[styles.trustTitle, { color: themeColors.text }]}>Bank-grade encryption</Text>
          <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
            Your payout details are encrypted at rest and in transit. Prayana takes a 5% platform
            fee per booking — no setup or hidden charges.
          </Text>
        </View>
      </View>
    </View>
  );

  // No progress graphic: the header's "Step N of 3" already states progress
  // precisely, and a bar or stepper under it would only redraw the same fact
  // while costing ~90px of a phone screen that the form needs.

  if (isSubmitting && currentStep === 3) {
    // keep footer interactive elsewhere; only the final complete blocks fully
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Sticky header */}
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.backButton, { backgroundColor: themeColors.inputBackground }]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color={themeColors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>Business Registration</Text>
              <Text style={[styles.headerStep, { color: themeColors.textSecondary }]}>
                Step {currentStep} of {TOTAL_STEPS}
              </Text>
            </View>
            <View style={styles.backButtonPlaceholder} />
          </View>
        </View>

        {/* Scroll content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 && renderSetupStep()}
          {currentStep === 2 && renderAgreementStep()}
          {currentStep === 3 && renderPayoutStep()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          {currentStep === 1 && (
            <Button
              title="Continue"
              onPress={handleSetupNext}
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={!accountType || !businessName.trim() || isSubmitting}
              style={styles.primaryAction}
              icon={!isSubmitting ? <Ionicons name="arrow-forward" size={18} color="#ffffff" /> : undefined}
            />
          )}

          {currentStep === 2 && (
            <>
              <Button
                title="Back"
                onPress={handleBack}
                variant="outline"
                size="lg"
                style={styles.backAction}
              />
              <Button
                title="Accept and continue"
                onPress={handleAcceptAgreement}
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={!canAcceptAgreement || isSubmitting}
                style={styles.primaryAction}
              />
            </>
          )}

          {currentStep === 3 && (
            <>
              <Button
                title="Back"
                onPress={handleBack}
                variant="outline"
                size="lg"
                style={styles.backAction}
              />
              {!payoutComplete && (
                <TouchableOpacity
                  onPress={handleSkipToDashboard}
                  disabled={isSubmitting}
                  style={styles.skipButton}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.skipText, { color: themeColors.textSecondary }]}>Skip to Dashboard</Text>
                </TouchableOpacity>
              )}
              <Button
                title={payoutComplete ? 'Complete Setup' : 'Next'}
                onPress={handlePayoutComplete}
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.primaryAction}
                icon={
                  !isSubmitting ? (
                    <Ionicons
                      name={payoutComplete ? 'checkmark-circle-outline' : 'arrow-forward'}
                      size={18}
                      color="#ffffff"
                    />
                  ) : undefined
                }
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {isSubmitting && currentStep === 3 && (
        <View style={styles.overlay} pointerEvents="none">
          <LoadingSpinner size="large" message="Finishing setup..." />
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  flex: { flex: 1 },

  // Header
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  backButtonPlaceholder: { width: 40 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  headerStep: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },


  // Scroll
  scrollContent: { paddingBottom: spacing['3xl'] },
  stepContainer: { padding: spacing.xl },
  stepTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.xs },
  stepSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 22 },

  // Section labels
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  sectionLabelSpaced: { marginTop: spacing.xl, marginBottom: spacing.md },
  inlineError: { fontSize: fontSize.xs, color: colors.error },

  // Account type cards
  accountTypeGrid: { gap: spacing.md },
  accountTypeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    position: 'relative',
  },
  accountTypeCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  accountTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  accountTypeTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.xs },
  accountTypeDesc: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  bestForPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  bestForText: { fontSize: 11, fontWeight: fontWeight.semibold },
  selectedBadge: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },

  // Identity — every control is stacked and spans the full width.
  identityStack: { gap: spacing.md },
  logoColumn: { alignSelf: 'stretch', alignItems: 'center' },
  logoBox: {
    alignSelf: 'stretch',
    height: 104,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholder: { alignItems: 'center', gap: 4 },
  logoPlaceholderText: { fontSize: 10, fontWeight: fontWeight.medium },
  logoRemove: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.xs },
  logoRemoveText: { fontSize: 11, color: colors.error },
  logoHint: { fontSize: 10, textAlign: 'center', marginTop: spacing.xs },
  identityFields: { alignSelf: 'stretch' },

  // Location / generic — fields stack one per row, each full width.
  field: { alignSelf: 'stretch', marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginBottom: spacing.xs },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  stateDropdown: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    ...shadow.md,
    overflow: 'hidden',
  },
  stateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  helperNote: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.lg, lineHeight: 18 },

  // Agreement
  agreementInfoCard: { marginBottom: spacing.lg, backgroundColor: colors.backgroundSecondary },
  agreementDocTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  agreementDocMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  agreementLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  agreementLink: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textDecorationLine: 'underline' },
  checkboxRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxLabel: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  blockError: { fontSize: fontSize.sm, color: colors.error, marginTop: spacing.md },

  // Payout tabs
  payoutTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  payoutTab: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  payoutTabActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  payoutTabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  payoutTabIcon: { width: 34, height: 34, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  payoutTabLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  payoutTabSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  soonBadge: { backgroundColor: colors.text, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  soonBadgeText: { fontSize: 9, fontWeight: fontWeight.bold, color: colors.surface, letterSpacing: 0.5 },

  // Bank confirm
  bankConfirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bankConfirmIcon: { width: 32, height: 32, borderRadius: borderRadius.md, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  bankConfirmName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.success },
  bankConfirmBranch: { fontSize: fontSize.xs, color: colors.success, marginTop: 1 },
  flex1: { flex: 1 },

  // UPI info
  upiInfoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  upiInfoTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  upiInfoText: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },

  // Stripe
  stripeCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  stripeIcon: { width: 56, height: 56, borderRadius: borderRadius.xl, backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  stripeTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, textAlign: 'center' },
  stripeText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  stripeSoon: { fontSize: fontSize.xs, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },

  // Trust banner
  trustBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  trustIcon: { width: 36, height: 36, borderRadius: borderRadius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary[200], alignItems: 'center', justifyContent: 'center' },
  trustTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  trustText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  primaryAction: { flex: 1 },
  backAction: { flex: 0.35 },
  skipButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  skipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
