import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';

import {
  Stepper,
  TextInput,
  Button,
  Card,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BusinessType = 'tour_operator' | 'activity_provider' | 'hotel_resort' | 'local_guide';

interface BusinessTypeOption {
  key: BusinessType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

interface DocumentFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

interface DocumentUpload {
  file: DocumentFile | null;
  status: 'pending' | 'uploaded' | 'uploading' | 'error';
}

interface Documents {
  businessRegistration: DocumentUpload;
  ownerIdProof: DocumentUpload;
  businessPhoto: DocumentUpload;
}

interface BusinessDetails {
  businessName: string;
  gstin: string;
  contactPersonName: string;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  city: string;
  state: string;
  pincode: string;
}

interface FirstActivity {
  activityName: string;
  category: string;
  shortDescription: string;
  basePrice: string;
  duration: string;
  maxParticipants: string;
}

interface PayoutDetails {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string;
}

interface ValidationErrors {
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Type', 'Details', 'Documents', 'Activity', 'Payout'];

const BUSINESS_TYPES: BusinessTypeOption[] = [
  {
    key: 'tour_operator',
    icon: 'map-outline',
    title: 'Tour Operator',
    description: 'Organize and sell guided tours, packages, and multi-day trips',
  },
  {
    key: 'activity_provider',
    icon: 'bicycle-outline',
    title: 'Activity Provider',
    description: 'Offer adventure sports, water activities, workshops, and more',
  },
  {
    key: 'hotel_resort',
    icon: 'bed-outline',
    title: 'Hotel / Resort',
    description: 'Provide stays with curated local experiences and activities',
  },
  {
    key: 'local_guide',
    icon: 'person-outline',
    title: 'Local Guide',
    description: 'Share your local expertise through walking tours and cultural experiences',
  },
];

const ACTIVITY_CATEGORIES = [
  'Tours',
  'Adventure',
  'Water Sports',
  'Cultural',
  'Food & Drink',
  'Wellness',
  'Transport',
  'Workshop',
];

const EMPTY_BUSINESS_DETAILS: BusinessDetails = {
  businessName: '',
  gstin: '',
  contactPersonName: '',
  contactEmail: '',
  contactPhone: '',
  businessAddress: '',
  city: '',
  state: '',
  pincode: '',
};

const EMPTY_FIRST_ACTIVITY: FirstActivity = {
  activityName: '',
  category: '',
  shortDescription: '',
  basePrice: '',
  duration: '',
  maxParticipants: '',
};

const EMPTY_PAYOUT_DETAILS: PayoutDetails = {
  accountHolderName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  bankName: '',
  upiId: '',
};

const EMPTY_DOCUMENT: DocumentUpload = { file: null, status: 'pending' };

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  return /^\d{10}$/.test(phone.replace(/\s/g, ''));
}

function validatePincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode);
}

function validateIFSC(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

function validateUPI(upi: string): boolean {
  if (!upi) return true; // optional
  return /^[\w.-]+@[\w]+$/.test(upi);
}

function maskAccountNumber(value: string): string {
  if (value.length <= 4) return value;
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

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
    setOnboardingStep,
    setOnboardingData,
    setBusinessAccount,
    resetOnboarding,
  } = useBusinessStore();

  // ---- Local state (hydrated from store) ----

  const [currentStep, setCurrentStep] = useState<number>(onboardingStep - 1); // 0-indexed
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType | null>(
    (onboardingData.accountType as BusinessType) || null
  );
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>({
    ...EMPTY_BUSINESS_DETAILS,
    ...(onboardingData.businessDetails as Partial<BusinessDetails>),
  });
  const [documents, setDocuments] = useState<Documents>({
    businessRegistration: EMPTY_DOCUMENT,
    ownerIdProof: EMPTY_DOCUMENT,
    businessPhoto: EMPTY_DOCUMENT,
  });
  const [firstActivity, setFirstActivity] = useState<FirstActivity>({
    ...EMPTY_FIRST_ACTIVITY,
    ...(onboardingData.firstListing as Partial<FirstActivity>),
  });
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails>({
    ...EMPTY_PAYOUT_DETAILS,
    ...(onboardingData.payoutDetails as Partial<PayoutDetails>),
  });
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Persist helper ----

  const persistToStore = useCallback(
    (step: number) => {
      setOnboardingStep(step + 1); // store uses 1-indexed
      setOnboardingData('accountType', selectedBusinessType);
      setOnboardingData('businessDetails', businessDetails);
      setOnboardingData('firstListing', firstActivity);
      setOnboardingData('payoutDetails', payoutDetails);
    },
    [
      selectedBusinessType,
      businessDetails,
      firstActivity,
      payoutDetails,
      setOnboardingStep,
      setOnboardingData,
    ]
  );

  // ---- Validation per step ----

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors: ValidationErrors = {};

      switch (step) {
        case 0: // Business Type
          if (!selectedBusinessType) {
            newErrors.businessType = 'Please select a business type';
          }
          break;

        case 1: // Business Details
          if (!businessDetails.businessName.trim()) {
            newErrors.businessName = 'Business name is required';
          }
          if (!businessDetails.contactPersonName.trim()) {
            newErrors.contactPersonName = 'Contact person name is required';
          }
          if (!businessDetails.contactEmail.trim()) {
            newErrors.contactEmail = 'Email is required';
          } else if (!validateEmail(businessDetails.contactEmail)) {
            newErrors.contactEmail = 'Enter a valid email address';
          }
          if (!businessDetails.contactPhone.trim()) {
            newErrors.contactPhone = 'Phone number is required';
          } else if (!validatePhone(businessDetails.contactPhone)) {
            newErrors.contactPhone = 'Enter a valid 10-digit phone number';
          }
          if (!businessDetails.businessAddress.trim()) {
            newErrors.businessAddress = 'Business address is required';
          }
          if (!businessDetails.city.trim()) {
            newErrors.city = 'City is required';
          }
          if (!businessDetails.state.trim()) {
            newErrors.state = 'State is required';
          }
          if (!businessDetails.pincode.trim()) {
            newErrors.pincode = 'Pincode is required';
          } else if (!validatePincode(businessDetails.pincode)) {
            newErrors.pincode = 'Enter a valid 6-digit pincode';
          }
          break;

        case 2: // Documents
          if (!documents.businessRegistration.file) {
            newErrors.businessRegistration = 'Business registration document is required';
          }
          if (!documents.ownerIdProof.file) {
            newErrors.ownerIdProof = 'Owner ID proof is required';
          }
          // businessPhoto is optional
          break;

        case 3: // First Activity
          if (!firstActivity.activityName.trim()) {
            newErrors.activityName = 'Activity name is required';
          }
          if (!firstActivity.category) {
            newErrors.category = 'Please select a category';
          }
          if (!firstActivity.shortDescription.trim()) {
            newErrors.shortDescription = 'Short description is required';
          }
          if (!firstActivity.basePrice.trim()) {
            newErrors.basePrice = 'Base price is required';
          } else if (isNaN(Number(firstActivity.basePrice)) || Number(firstActivity.basePrice) <= 0) {
            newErrors.basePrice = 'Enter a valid price';
          }
          if (!firstActivity.duration.trim()) {
            newErrors.duration = 'Duration is required';
          } else if (isNaN(Number(firstActivity.duration)) || Number(firstActivity.duration) <= 0) {
            newErrors.duration = 'Enter a valid duration';
          }
          if (!firstActivity.maxParticipants.trim()) {
            newErrors.maxParticipants = 'Max participants is required';
          } else if (
            isNaN(Number(firstActivity.maxParticipants)) ||
            Number(firstActivity.maxParticipants) < 1
          ) {
            newErrors.maxParticipants = 'Enter a valid number';
          }
          break;

        case 4: // Payout Setup
          if (!payoutDetails.accountHolderName.trim()) {
            newErrors.accountHolderName = 'Account holder name is required';
          }
          if (!payoutDetails.accountNumber.trim()) {
            newErrors.accountNumber = 'Account number is required';
          } else if (!/^\d{9,18}$/.test(payoutDetails.accountNumber)) {
            newErrors.accountNumber = 'Enter a valid account number (9-18 digits)';
          }
          if (!payoutDetails.confirmAccountNumber.trim()) {
            newErrors.confirmAccountNumber = 'Please confirm your account number';
          } else if (payoutDetails.accountNumber !== payoutDetails.confirmAccountNumber) {
            newErrors.confirmAccountNumber = 'Account numbers do not match';
          }
          if (!payoutDetails.ifscCode.trim()) {
            newErrors.ifscCode = 'IFSC code is required';
          } else if (!validateIFSC(payoutDetails.ifscCode)) {
            newErrors.ifscCode = 'Enter a valid 11-character IFSC code';
          }
          if (!payoutDetails.bankName.trim()) {
            newErrors.bankName = 'Bank name is required';
          }
          if (payoutDetails.upiId && !validateUPI(payoutDetails.upiId)) {
            newErrors.upiId = 'Enter a valid UPI ID (e.g. name@upi)';
          }
          break;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [selectedBusinessType, businessDetails, documents, firstActivity, payoutDetails]
  );

  // ---- Navigation ----

  const handleNext = useCallback(() => {
    if (!validateStep(currentStep)) return;
    persistToStore(currentStep);
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      setErrors({});
    }
  }, [currentStep, validateStep, persistToStore]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      persistToStore(currentStep);
      setCurrentStep((prev) => prev - 1);
      setErrors({});
    }
  }, [currentStep, persistToStore]);

  // ---- Submit ----

  const handleSubmit = useCallback(async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      const registrationData = {
        accountType: selectedBusinessType,
        businessName: businessDetails.businessName.trim(),
        gstin: businessDetails.gstin.trim() || undefined,
        contact: {
          personName: businessDetails.contactPersonName.trim(),
          email: businessDetails.contactEmail.trim(),
          phone: businessDetails.contactPhone.trim(),
        },
        location: {
          address: businessDetails.businessAddress.trim(),
          city: businessDetails.city.trim(),
          state: businessDetails.state.trim(),
          pincode: businessDetails.pincode.trim(),
        },
        firstActivity: {
          name: firstActivity.activityName.trim(),
          category: firstActivity.category,
          description: firstActivity.shortDescription.trim(),
          basePrice: Number(firstActivity.basePrice),
          duration: Number(firstActivity.duration),
          maxParticipants: Number(firstActivity.maxParticipants),
        },
        payout: {
          accountHolderName: payoutDetails.accountHolderName.trim(),
          accountNumber: payoutDetails.accountNumber,
          ifscCode: payoutDetails.ifscCode.toUpperCase(),
          bankName: payoutDetails.bankName.trim(),
          upiId: payoutDetails.upiId.trim() || undefined,
        },
      };

      const response = await businessAPI.register(registrationData);

      // Upload documents after registration
      if (response?.data?._id || response?._id) {
        const businessId = response?.data?._id || response?._id;
        const docUploads = [documents.businessRegistration, documents.ownerIdProof, documents.businessPhoto];
        const docTypes = ['business_registration', 'owner_id_proof', 'business_photo'];

        for (let i = 0; i < docUploads.length; i++) {
          const doc = docUploads[i];
          if (doc.file) {
            const formData = new FormData();
            formData.append('document', {
              uri: doc.file.uri,
              name: doc.file.name,
              type: doc.file.type,
            } as any);
            formData.append('documentType', docTypes[i]);
            try {
              await businessAPI.uploadDocument(formData);
            } catch {
              // Non-critical: document upload can be retried later
            }
          }
        }

        setBusinessAccount(response?.data || response);
      }

      resetOnboarding();

      Toast.show({
        type: 'success',
        text1: 'Registration Submitted!',
        text2: "We'll review your application within 24 hours.",
        visibilityTime: 4000,
      });

      router.replace('/(tabs)');
    } catch (error: any) {
      const message = error?.message || 'Registration failed. Please try again.';
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: message,
        visibilityTime: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateStep,
    selectedBusinessType,
    businessDetails,
    documents,
    firstActivity,
    payoutDetails,
    resetOnboarding,
    setBusinessAccount,
    router,
  ]);

  // ---- Document picking ----

  const pickImage = useCallback(async (docKey: keyof Documents) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to upload documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const fileName = asset.uri.split('/').pop() || 'document.jpg';
        setDocuments((prev) => ({
          ...prev,
          [docKey]: {
            file: {
              uri: asset.uri,
              name: fileName,
              type: asset.mimeType || 'image/jpeg',
              size: asset.fileSize,
            },
            status: 'uploaded' as const,
          },
        }));
        // Clear error if any
        setErrors((prev) => {
          const next = { ...prev };
          delete next[docKey];
          return next;
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  const pickDocument = useCallback(async (docKey: keyof Documents) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setDocuments((prev) => ({
          ...prev,
          [docKey]: {
            file: {
              uri: asset.uri,
              name: asset.name,
              type: asset.mimeType || 'application/pdf',
              size: asset.size,
            },
            status: 'uploaded' as const,
          },
        }));
        setErrors((prev) => {
          const next = { ...prev };
          delete next[docKey];
          return next;
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  }, []);

  const removeDocument = useCallback((docKey: keyof Documents) => {
    setDocuments((prev) => ({
      ...prev,
      [docKey]: EMPTY_DOCUMENT,
    }));
  }, []);

  // ---- Field updaters ----

  const updateBusinessField = useCallback(
    (field: keyof BusinessDetails, value: string) => {
      setBusinessDetails((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const updateActivityField = useCallback(
    (field: keyof FirstActivity, value: string) => {
      setFirstActivity((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const updatePayoutField = useCallback(
    (field: keyof PayoutDetails, value: string) => {
      let processedValue = value;
      if (field === 'ifscCode') {
        processedValue = value.toUpperCase().slice(0, 11);
      }
      if (field === 'accountNumber' || field === 'confirmAccountNumber') {
        processedValue = value.replace(/\D/g, '');
      }
      setPayoutDetails((prev) => ({ ...prev, [field]: processedValue }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  // ---- IFSC auto-fill (best-effort) ----

  const handleIFSCBlur = useCallback(async () => {
    const ifsc = payoutDetails.ifscCode.toUpperCase();
    if (!validateIFSC(ifsc)) return;

    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (response.ok) {
        const data = await response.json();
        if (data?.BANK) {
          setPayoutDetails((prev) => ({
            ...prev,
            bankName: data.BANK,
            ifscCode: ifsc,
          }));
        }
      }
    } catch {
      // Silently fail - user can manually type bank name
    }
  }, [payoutDetails.ifscCode]);

  // ======================================================================
  // STEP RENDERERS
  // ======================================================================

  // ---- Step 1: Business Type ----

  const renderBusinessTypeStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>What type of business are you?</Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Select the category that best describes your offerings
        </Text>

        <View style={styles.businessTypeGrid}>
          {BUSINESS_TYPES.map((type) => {
            const isSelected = selectedBusinessType === type.key;
            return (
              <TouchableOpacity
                key={type.key}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedBusinessType(type.key);
                  setErrors({});
                }}
                style={[
                  styles.businessTypeCard,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  isSelected && styles.businessTypeCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.businessTypeIconWrapper,
                    { backgroundColor: themeColors.inputBackground },
                    isSelected && styles.businessTypeIconWrapperSelected,
                  ]}
                >
                  <Ionicons
                    name={type.icon}
                    size={28}
                    color={isSelected ? colors.primary[500] : themeColors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.businessTypeTitle,
                    { color: themeColors.text },
                    isSelected && styles.businessTypeTitleSelected,
                  ]}
                >
                  {type.title}
                </Text>
                <Text style={[styles.businessTypeDescription, { color: themeColors.textSecondary }]}>{type.description}</Text>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary[500]} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {errors.businessType && (
          <Text style={styles.errorText}>{errors.businessType}</Text>
        )}
      </View>
    ),
    [selectedBusinessType, errors.businessType, themeColors]
  );

  // ---- Step 2: Business Details ----

  const renderBusinessDetailsStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>Business Details</Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Tell us about your business so we can set up your account
        </Text>

        <TextInput
          label="Business Name *"
          placeholder="e.g. Coastal Adventures Goa"
          value={businessDetails.businessName}
          onChangeText={(val: string) => updateBusinessField('businessName', val)}
          error={errors.businessName}
          autoCapitalize="words"
        />

        <TextInput
          label="GSTIN (optional)"
          placeholder="e.g. 27AAACA1234A1Z5"
          value={businessDetails.gstin}
          onChangeText={(val: string) => updateBusinessField('gstin', val)}
          autoCapitalize="characters"
          hint="Enter if you have a GST registration"
        />

        <TextInput
          label="Contact Person Name *"
          placeholder="Full name of the primary contact"
          value={businessDetails.contactPersonName}
          onChangeText={(val: string) => updateBusinessField('contactPersonName', val)}
          error={errors.contactPersonName}
          autoCapitalize="words"
        />

        <TextInput
          label="Contact Email *"
          placeholder="you@business.com"
          value={businessDetails.contactEmail}
          onChangeText={(val: string) => updateBusinessField('contactEmail', val)}
          error={errors.contactEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          label="Contact Phone *"
          placeholder="10-digit mobile number"
          value={businessDetails.contactPhone}
          onChangeText={(val: string) =>
            updateBusinessField('contactPhone', val.replace(/\D/g, '').slice(0, 10))
          }
          error={errors.contactPhone}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <TextInput
          label="Business Address *"
          placeholder="Full address of your business"
          value={businessDetails.businessAddress}
          onChangeText={(val: string) => updateBusinessField('businessAddress', val)}
          error={errors.businessAddress}
          multiline
          numberOfLines={3}
          style={styles.multilineInput}
        />

        <View style={styles.row}>
          <View style={styles.rowHalf}>
            <TextInput
              label="City *"
              placeholder="City"
              value={businessDetails.city}
              onChangeText={(val: string) => updateBusinessField('city', val)}
              error={errors.city}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.rowHalf}>
            <TextInput
              label="State *"
              placeholder="State"
              value={businessDetails.state}
              onChangeText={(val: string) => updateBusinessField('state', val)}
              error={errors.state}
              autoCapitalize="words"
            />
          </View>
        </View>

        <TextInput
          label="Pincode *"
          placeholder="6-digit pincode"
          value={businessDetails.pincode}
          onChangeText={(val: string) =>
            updateBusinessField('pincode', val.replace(/\D/g, '').slice(0, 6))
          }
          error={errors.pincode}
          keyboardType="number-pad"
          maxLength={6}
        />
      </View>
    ),
    [businessDetails, errors, updateBusinessField, themeColors]
  );

  // ---- Step 3: Document Upload ----

  const renderDocumentUploadCard = useCallback(
    (
      title: string,
      subtitle: string,
      docKey: keyof Documents,
      required: boolean = true
    ) => {
      const doc = documents[docKey];
      const hasFile = !!doc.file;
      const isImage = doc.file?.type?.startsWith('image/');

      return (
        <Card
          key={docKey}
          style={[
            styles.documentCard,
            errors[docKey] ? styles.documentCardError : undefined,
          ]}
          bordered
          elevated={false}
          padding="lg"
        >
          <View style={styles.documentHeader}>
            <View style={styles.documentInfo}>
              <View style={styles.documentTitleRow}>
                <Ionicons
                  name={hasFile ? 'document-text' : 'cloud-upload-outline'}
                  size={20}
                  color={hasFile ? colors.success : themeColors.textSecondary}
                />
                <Text style={[styles.documentTitle, { color: themeColors.text }]}>
                  {title} {required ? '*' : '(optional)'}
                </Text>
              </View>
              <Text style={[styles.documentSubtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text>
            </View>
            {hasFile && (
              <View style={styles.uploadedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.uploadedText}>Uploaded</Text>
              </View>
            )}
          </View>

          {hasFile && doc.file ? (
            <View style={[styles.filePreview, { backgroundColor: themeColors.inputBackground }]}>
              {isImage ? (
                <Image source={{ uri: doc.file.uri }} style={styles.thumbnailImage} />
              ) : (
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text-outline" size={32} color={colors.primary[500]} />
                </View>
              )}
              <View style={styles.fileDetails}>
                <Text style={[styles.fileName, { color: themeColors.text }]} numberOfLines={1}>
                  {doc.file.name}
                </Text>
                {doc.file.size && (
                  <Text style={[styles.fileSize, { color: themeColors.textTertiary }]}>
                    {(doc.file.size / 1024).toFixed(1)} KB
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => removeDocument(docKey)}
                style={styles.removeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadActions}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickImage(docKey)}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={20} color={colors.primary[500]} />
                <Text style={styles.uploadButtonText}>Camera / Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => pickDocument(docKey)}
                activeOpacity={0.7}
              >
                <Ionicons name="folder-outline" size={20} color={colors.primary[500]} />
                <Text style={styles.uploadButtonText}>Browse Files</Text>
              </TouchableOpacity>
            </View>
          )}

          {errors[docKey] && (
            <Text style={styles.documentError}>{errors[docKey]}</Text>
          )}
        </Card>
      );
    },
    [documents, errors, pickImage, pickDocument, removeDocument, themeColors]
  );

  const renderDocumentUploadStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>Document Upload</Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Upload your business documents for verification. Supported formats: PDF, JPG, PNG.
        </Text>

        {renderDocumentUploadCard(
          'Business Registration',
          'Trade license, Shop Act, FSSAI, or company registration certificate',
          'businessRegistration',
          true
        )}

        {renderDocumentUploadCard(
          'Owner ID Proof',
          'Aadhaar card, PAN card, or passport of the business owner',
          'ownerIdProof',
          true
        )}

        {renderDocumentUploadCard(
          'Business Photo',
          'A photo of your shop, office, or activity venue',
          'businessPhoto',
          false
        )}
      </View>
    ),
    [renderDocumentUploadCard, themeColors]
  );

  // ---- Step 4: First Activity ----

  const renderFirstActivityStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>Your First Activity</Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Set up a quick listing to get started. You can edit all details later.
        </Text>

        <TextInput
          label="Activity Name *"
          placeholder="e.g. Sunset Kayaking in Palolem"
          value={firstActivity.activityName}
          onChangeText={(val: string) => updateActivityField('activityName', val)}
          error={errors.activityName}
          autoCapitalize="words"
        />

        {/* Category Selector */}
        <View style={styles.inputContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Category *</Text>
          <TouchableOpacity
            style={[
              styles.categorySelector,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              errors.category ? styles.categorySelectorError : undefined,
            ]}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categorySelectorText,
                { color: themeColors.text },
                !firstActivity.category && { color: themeColors.textTertiary },
              ]}
            >
              {firstActivity.category || 'Select a category'}
            </Text>
            <Ionicons
              name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
          {errors.category && <Text style={styles.fieldError}>{errors.category}</Text>}

          {showCategoryPicker && (
            <View style={[styles.categoryDropdown, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              {ACTIVITY_CATEGORIES.map((cat) => {
                const isSelected = firstActivity.category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      { borderBottomColor: themeColors.border },
                      isSelected && styles.categoryOptionSelected,
                    ]}
                    onPress={() => {
                      updateActivityField('category', cat);
                      setShowCategoryPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: themeColors.text },
                        isSelected && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <TextInput
          label="Short Description *"
          placeholder="Describe what makes your activity special..."
          value={firstActivity.shortDescription}
          onChangeText={(val: string) => updateActivityField('shortDescription', val)}
          error={errors.shortDescription}
          multiline
          numberOfLines={3}
          style={styles.multilineInput}
          maxLength={300}
          hint={`${firstActivity.shortDescription.length}/300 characters`}
        />

        {/* Price input with rupee prefix */}
        <View style={styles.inputContainer}>
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Base Price (per person) *</Text>
          <View
            style={[
              styles.priceInputWrapper,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              errors.basePrice ? styles.priceInputWrapperError : undefined,
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: themeColors.text }]}>&#8377;</Text>
            <TextInput
              placeholder="e.g. 1500"
              value={firstActivity.basePrice}
              onChangeText={(val: string) =>
                updateActivityField('basePrice', val.replace(/[^0-9.]/g, ''))
              }
              keyboardType="decimal-pad"
              containerStyle={styles.noPadding}
              style={styles.priceInput}
            />
          </View>
          {errors.basePrice && <Text style={styles.fieldError}>{errors.basePrice}</Text>}
        </View>

        <View style={styles.row}>
          <View style={styles.rowHalf}>
            <TextInput
              label="Duration (hours) *"
              placeholder="e.g. 2.5"
              value={firstActivity.duration}
              onChangeText={(val: string) =>
                updateActivityField('duration', val.replace(/[^0-9.]/g, ''))
              }
              error={errors.duration}
              keyboardType="decimal-pad"
              rightIcon={
                <Text style={[styles.unitLabel, { color: themeColors.textTertiary }]}>hrs</Text>
              }
            />
          </View>
          <View style={styles.rowHalf}>
            <TextInput
              label="Max Participants *"
              placeholder="e.g. 15"
              value={firstActivity.maxParticipants}
              onChangeText={(val: string) =>
                updateActivityField('maxParticipants', val.replace(/\D/g, ''))
              }
              error={errors.maxParticipants}
              keyboardType="number-pad"
              rightIcon={
                <Text style={[styles.unitLabel, { color: themeColors.textTertiary }]}>people</Text>
              }
            />
          </View>
        </View>
      </View>
    ),
    [firstActivity, errors, showCategoryPicker, updateActivityField, themeColors]
  );

  // ---- Step 5: Payout Setup ----

  const renderPayoutSetupStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>Payout Setup</Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Add your bank details so we can transfer your earnings securely
        </Text>

        <Card style={styles.securityNotice} bordered elevated={false} padding="md">
          <View style={styles.securityNoticeContent}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <Text style={styles.securityNoticeText}>
              Your bank details are encrypted and stored securely. We use industry-standard
              security practices.
            </Text>
          </View>
        </Card>

        <TextInput
          label="Account Holder Name *"
          placeholder="As per bank records"
          value={payoutDetails.accountHolderName}
          onChangeText={(val: string) => updatePayoutField('accountHolderName', val)}
          error={errors.accountHolderName}
          autoCapitalize="words"
        />

        <TextInput
          label="Account Number *"
          placeholder="Enter bank account number"
          value={
            showAccountNumber
              ? payoutDetails.accountNumber
              : maskAccountNumber(payoutDetails.accountNumber)
          }
          onChangeText={(val: string) => updatePayoutField('accountNumber', val)}
          error={errors.accountNumber}
          keyboardType="number-pad"
          secureTextEntry={!showAccountNumber}
          rightIcon={
            <TouchableOpacity onPress={() => setShowAccountNumber(!showAccountNumber)}>
              <Ionicons
                name={showAccountNumber ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          }
        />

        <TextInput
          label="Confirm Account Number *"
          placeholder="Re-enter account number"
          value={payoutDetails.confirmAccountNumber}
          onChangeText={(val: string) => updatePayoutField('confirmAccountNumber', val)}
          error={errors.confirmAccountNumber}
          keyboardType="number-pad"
          secureTextEntry
        />

        <TextInput
          label="IFSC Code *"
          placeholder="e.g. SBIN0001234"
          value={payoutDetails.ifscCode}
          onChangeText={(val: string) => updatePayoutField('ifscCode', val)}
          onBlur={handleIFSCBlur}
          error={errors.ifscCode}
          autoCapitalize="characters"
          maxLength={11}
          hint="11-character code printed on your cheque book"
        />

        <TextInput
          label="Bank Name *"
          placeholder="Auto-filled from IFSC or type manually"
          value={payoutDetails.bankName}
          onChangeText={(val: string) => updatePayoutField('bankName', val)}
          error={errors.bankName}
          autoCapitalize="words"
        />

        <TextInput
          label="UPI ID (optional)"
          placeholder="e.g. business@upi"
          value={payoutDetails.upiId}
          onChangeText={(val: string) => updatePayoutField('upiId', val)}
          error={errors.upiId}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Optional - for faster payouts"
        />
      </View>
    ),
    [payoutDetails, errors, showAccountNumber, updatePayoutField, handleIFSCBlur, themeColors]
  );

  // ---- Step content switcher ----

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case 0:
        return renderBusinessTypeStep;
      case 1:
        return renderBusinessDetailsStep;
      case 2:
        return renderDocumentUploadStep;
      case 3:
        return renderFirstActivityStep;
      case 4:
        return renderPayoutSetupStep;
      default:
        return null;
    }
  }, [
    currentStep,
    renderBusinessTypeStep,
    renderBusinessDetailsStep,
    renderDocumentUploadStep,
    renderFirstActivityStep,
    renderPayoutSetupStep,
  ]);

  // ---- Main render ----

  if (isSubmitting) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <LoadingSpinner size="large" message="Submitting your registration..." />
        <Text style={[styles.loadingSubtext, { color: themeColors.textTertiary }]}>This may take a moment</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <View style={styles.headerTop}>
            {currentStep > 0 ? (
              <TouchableOpacity onPress={handleBack} style={[styles.backButton, { backgroundColor: themeColors.inputBackground }]} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={themeColors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButtonPlaceholder} />
            )}
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Business Registration</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>
          <Stepper steps={STEP_LABELS} currentStep={currentStep} />
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {stepContent}
        </ScrollView>

        {/* Bottom navigation */}
        <View style={[styles.bottomBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          {currentStep > 0 && (
            <Button
              title="Back"
              onPress={handleBack}
              variant="outline"
              size="lg"
              style={styles.backActionButton}
            />
          )}
          {currentStep < 4 ? (
            <Button
              title="Next"
              onPress={handleNext}
              variant="primary"
              size="lg"
              style={[styles.nextButton, currentStep === 0 && styles.fullWidthButton]}
              icon={<Ionicons name="arrow-forward" size={18} color="#ffffff" />}
            />
          ) : (
            <Button
              title="Submit for Review"
              onPress={handleSubmit}
              variant="primary"
              size="lg"
              loading={isSubmitting}
              style={styles.nextButton}
              icon={
                !isSubmitting ? (
                  <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                ) : undefined
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },

  // ---- Header ----
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
  },
  backButtonPlaceholder: {
    width: 40,
  },

  // ---- Scroll content ----
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // ---- Step container ----
  stepContainer: {
    padding: spacing.xl,
  },
  stepTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing['2xl'],
    lineHeight: 22,
  },

  // ---- Business Type cards ----
  businessTypeGrid: {
    gap: spacing.md,
  },
  businessTypeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.xl,
    position: 'relative',
  },
  businessTypeCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  businessTypeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  businessTypeIconWrapperSelected: {
    backgroundColor: colors.primary[100],
  },
  businessTypeTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  businessTypeTitleSelected: {
    color: colors.primary[700],
  },
  businessTypeDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  selectedBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },

  // ---- Business Details ----
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowHalf: {
    flex: 1,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // ---- Document Upload ----
  documentCard: {
    marginBottom: spacing.lg,
  },
  documentCardError: {
    borderColor: colors.error,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  documentInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  documentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  documentSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginLeft: 28, // aligned with title text after icon
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  uploadedText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: fontWeight.medium,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  thumbnailImage: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[200],
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  fileSize: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.xs,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    backgroundColor: colors.primary[50],
  },
  uploadButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[600],
  },
  documentError: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.sm,
  },

  // ---- First Activity ----
  inputContainer: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  categorySelectorError: {
    borderColor: colors.error,
  },
  categorySelectorText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  categorySelectorPlaceholder: {
    color: colors.textTertiary,
  },
  categoryDropdown: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    ...shadow.md,
    overflow: 'hidden',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  categoryOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  categoryOptionText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  categoryOptionTextSelected: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  fieldError: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    paddingLeft: spacing.lg,
  },
  priceInputWrapperError: {
    borderColor: colors.error,
  },
  currencyPrefix: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginRight: spacing.xs,
  },
  noPadding: {
    marginBottom: 0,
  },
  priceInput: {
    borderWidth: 0,
  },
  unitLabel: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },

  // ---- Payout Setup ----
  securityNotice: {
    marginBottom: spacing.xl,
    backgroundColor: colors.successLight,
  },
  securityNoticeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },

  // ---- Error text ----
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.lg,
  },

  // ---- Bottom bar ----
  bottomBar: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  backActionButton: {
    flex: 0.4,
  },
  nextButton: {
    flex: 1,
  },
  fullWidthButton: {
    flex: 1,
  },
});
