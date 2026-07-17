import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { Card, useTheme } from '@prayana/shared-ui';
import { Button } from '../../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';
import { activityMarketplaceAPI } from '@prayana/shared-services';
import { useBusinessStore } from '@prayana/shared-stores';
import TypeSpecificFields, { ActivityTypeConfig } from './TypeSpecificFields';
import ActivityDocumentUploader, {
  PickedDocFile,
  UploadedActivityDoc,
} from './ActivityDocumentUploader';
import { getSuggestions } from './tagSuggestions';

// ─── Wizard steps ────────────────────────────────────────────────────────────────
// Ported from the web FirstListingStep: its Preview step becomes the Review step
// (summary + Submit/Draft actions), matching the PackageForm wizard pattern.

const STEPS = ['Basics', 'Categories', 'Tags', 'Location', 'Photos', 'Pricing', 'Review'];
const STEP_BASICS = 0;
const STEP_CATEGORIES = 1;
const STEP_TAGS = 2;
const STEP_LOCATION = 3;
const STEP_PHOTOS = 4;
const STEP_PRICING = 5;
const STEP_REVIEW = 6;

// ─── Constants (mirroring the web FirstListingStep) ──────────────────────────────

const CATEGORIES: { label: string; emoji: string }[] = [
  { label: 'Adventure', emoji: '🏔️' },
  { label: 'Cultural', emoji: '🏛️' },
  { label: 'Food & Dining', emoji: '🍛' },
  { label: 'Water Sports', emoji: '🏄' },
  { label: 'Wildlife', emoji: '🐘' },
  { label: 'City Tours', emoji: '🏙️' },
  { label: 'Spiritual', emoji: '🕌' },
  { label: 'Wellness', emoji: '🧘' },
  { label: 'Photography', emoji: '📸' },
  { label: 'Nightlife', emoji: '🌃' },
  { label: 'Shopping', emoji: '🛍️' },
  { label: 'Historical', emoji: '🏰' },
  { label: 'Sports & Recreation', emoji: '🏏' },
  { label: 'Other', emoji: '✨' },
];

const MAX_CATEGORIES = 3;
const MIN_TAGS = 3;
const MAX_TAGS = 10;
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;
const TITLE_MAX = 150;
const SHORT_DESC_MAX = 120;
const DESC_MAX = 5000;

// Index == server dayOfWeek (0=Sunday ... 6=Saturday).
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRICE_TYPES = [
  { key: 'per_person', label: 'Per Person' },
  { key: 'per_group', label: 'Per Group' },
];

const DURATION_UNITS = [
  { key: 'hours', label: 'Hours' },
  { key: 'days', label: 'Days' },
];

const CANCELLATION_POLICIES = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund up to 24 hours before' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund up to 5 days before' },
  { key: 'strict', label: 'Strict', desc: '50% refund up to 7 days before' },
  { key: 'non_refundable', label: 'Non-refundable', desc: 'No refund after booking' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface ActivityPhotoDraft {
  /** Local file:// uri from the picker. */
  uri: string;
  isPrimary: boolean;
  caption: string;
  order: number;
}

export interface ExistingActivityImage {
  url: string;
  _id?: string;
}

export interface ActivityFormValues {
  title: string;
  shortDescription: string;
  description: string;
  durationValue: string;
  durationUnit: 'hours' | 'days';
  categories: string[];
  tags: string[];
  city: string;
  meetingPoint: string;
  mapsLink: string;
  /** Captured via expo-location; converted to server {lat,lng} in the payload. */
  coordinates: { latitude: number; longitude: number } | null;
  /** New local picks (uploaded via FormData after save). */
  photos: ActivityPhotoDraft[];
  /** Server images already on the listing (edit mode; display + remove only). */
  existingImages: ExistingActivityImage[];
  basePrice: string;
  priceType: string;
  childPrice: string;
  minGroupSize: string;
  maxGroupSize: string;
  /** One item per line, matching the web textarea shape. */
  includesWhat: string;
  excludesWhat: string;
  cancellationPolicy: string;
  advanceBookingDays: string;
  availableDays: number[];
  startTime: string;
  endTime: string;
  typeSpecificFields: Record<string, any>;
  activityDocuments: UploadedActivityDoc[];
  /**
   * Legacy passthrough — fields the old single-scroll form saved but this
   * wizard has no editor for (highlights, languages, whatToBring, pricing
   * extras like groupDiscount/currency). They're merged back into the payload
   * untouched so an edit round-trip never silently drops data.
   */
  legacy: {
    top: Record<string, any>;
    pricing: Record<string, any>;
  };
}

export const EMPTY_ACTIVITY: ActivityFormValues = {
  title: '',
  shortDescription: '',
  description: '',
  durationValue: '3',
  durationUnit: 'hours',
  categories: [],
  tags: [],
  city: '',
  meetingPoint: '',
  mapsLink: '',
  coordinates: null,
  photos: [],
  existingImages: [],
  basePrice: '',
  priceType: 'per_person',
  childPrice: '',
  minGroupSize: '1',
  maxGroupSize: '10',
  includesWhat: '',
  excludesWhat: '',
  cancellationPolicy: 'moderate',
  advanceBookingDays: '1',
  availableDays: [1, 2, 3, 4, 5, 6],
  startTime: '09:00',
  endTime: '13:00',
  typeSpecificFields: {},
  activityDocuments: [],
  legacy: { top: {}, pricing: {} },
};

// ─── Payload builder (exactly the web FirstListingStep shape) ────────────────────

export function buildActivityPayload(v: ActivityFormValues, typeConfig?: ActivityTypeConfig | null) {
  const childPriceNum =
    v.childPrice !== '' && !isNaN(parseFloat(v.childPrice)) ? parseFloat(v.childPrice) : null;
  const maxGroup = parseInt(v.maxGroupSize, 10) || 10;

  const payload: Record<string, any> = {
    // Legacy fields (highlights, languages, whatToBring, ...) go back untouched;
    // everything the wizard edits is written after them, so mapped keys win.
    ...v.legacy.top,
    title: v.title.trim(),
    ...(v.categories.length > 0
      ? { category: v.categories, primaryCategory: v.categories[0] }
      : {}),
    shortDescription: v.shortDescription.trim() || null,
    description: v.description.trim() || '',
    tags: v.tags,
    duration: {
      value: parseInt(v.durationValue, 10) || 1,
      unit: v.durationUnit || 'hours',
    },
    location: {
      city: v.city || '',
      meetingPoint: v.meetingPoint || '',
      ...(v.mapsLink.trim() ? { mapsLink: v.mapsLink.trim() } : {}),
      // Server Coordinates (shared-types) are {lat, lng}; the form stores the
      // expo-location {latitude, longitude} shape until here.
      ...(v.coordinates
        ? { coordinates: { lat: v.coordinates.latitude, lng: v.coordinates.longitude } }
        : {}),
    },
    pricing: {
      ...v.legacy.pricing,
      basePrice: parseFloat(v.basePrice) || 0,
      priceType: v.priceType || 'per_person',
      childPrice: childPriceNum,
      // Platform policy: children = ages 0-12, adults = 13+.
      childMaxAge: childPriceNum != null ? 12 : null,
      includesWhat: v.includesWhat ? v.includesWhat.split('\n').filter(Boolean) : [],
      excludesWhat: v.excludesWhat ? v.excludesWhat.split('\n').filter(Boolean) : [],
    },
    groupSize: {
      min: Math.max(1, parseInt(v.minGroupSize, 10) || 1),
      max: maxGroup,
    },
    cancellationPolicy: v.cancellationPolicy || 'moderate',
    advanceBookingDays: Math.max(0, parseInt(v.advanceBookingDays, 10) || 0),
    availabilitySchedule: v.availableDays.map((day) => ({
      dayOfWeek: day,
      startTime: v.startTime,
      endTime: v.endTime,
      maxSlots: maxGroup,
    })),
    ...(Object.keys(v.typeSpecificFields).length > 0
      ? { typeSpecificFields: v.typeSpecificFields }
      : {}),
    activityDocuments: v.activityDocuments.map((d) => ({
      docKey: d.docKey,
      url: d.url,
      expiryDate: d.expiryDate ?? null,
      status: 'pending',
    })),
  };

  if (typeConfig?.safetyConfig) {
    const sc = typeConfig.safetyConfig;
    payload.safetyDeclarations = {
      hasInsurance: !!sc.requiresInsurance,
      hasCertifiedInstructors: !!sc.requiresCertifiedInstructor,
      hasEmergencyPlan: !!sc.requiresWaiver,
      minimumAge: sc.minimumAge ?? null,
      riskLevel: sc.riskLevel || 'low',
    };
  }

  return payload;
}

// ─── Hydrate form from a loaded activity (edit mode) ─────────────────────────────
// Defensive against BOTH shapes: the rich shape this wizard writes, and the
// legacy flat shape the old single-scroll form saved (category as string,
// duration as a flat number, pricing.adultPrice, top-level includes[] etc.).

export function activityToFormValues(a: any): ActivityFormValues {
  if (!a) return { ...EMPTY_ACTIVITY };

  // category: rich = string[]; legacy = single string.
  const categories: string[] = Array.isArray(a.category)
    ? a.category.filter(Boolean)
    : a.category
    ? [a.category]
    : [];

  // duration: rich = {value, unit}; legacy = flat number (hours).
  let durationValue = '';
  let durationUnit: 'hours' | 'days' = 'hours';
  if (a.duration && typeof a.duration === 'object') {
    durationValue = a.duration.value != null ? String(a.duration.value) : '';
    durationUnit = a.duration.unit === 'days' ? 'days' : 'hours';
  } else if (a.duration != null && a.duration !== '') {
    durationValue = String(a.duration);
  }

  const pricing = a.pricing || {};
  // legacy edit form saved pricing.adultPrice; some older records used flat price.
  const basePrice = pricing.basePrice ?? pricing.adultPrice ?? a.price;

  // includesWhat: rich = pricing.includesWhat[]; legacy = top-level includes[].
  const includesArr: string[] =
    Array.isArray(pricing.includesWhat) && pricing.includesWhat.length > 0
      ? pricing.includesWhat
      : Array.isArray(a.includes)
      ? a.includes
      : [];
  const excludesArr: string[] = Array.isArray(pricing.excludesWhat) ? pricing.excludesWhat : [];

  // coordinates: server {lat,lng}; tolerate {latitude,longitude} too.
  const raw = a.location?.coordinates;
  let coordinates: ActivityFormValues['coordinates'] = null;
  if (raw && typeof raw === 'object') {
    if (raw.lat != null && raw.lng != null) {
      coordinates = { latitude: Number(raw.lat), longitude: Number(raw.lng) };
    } else if (raw.latitude != null && raw.longitude != null) {
      coordinates = { latitude: Number(raw.latitude), longitude: Number(raw.longitude) };
    }
  }

  // availabilitySchedule → weekly-day chips + a single time window.
  const sched: any[] = Array.isArray(a.availabilitySchedule) ? a.availabilitySchedule : [];
  const availableDays = Array.from(
    new Set(sched.map((s) => s?.dayOfWeek).filter((d) => typeof d === 'number')),
  ).sort() as number[];

  // images: string[] (legacy) or ActivityImage[] ({url, _id, ...}).
  const existingImages: ExistingActivityImage[] = (Array.isArray(a.images) ? a.images : [])
    .map((img: any) =>
      typeof img === 'string'
        ? { url: img }
        : img && img.url
        ? { url: img.url, _id: img._id }
        : null,
    )
    .filter(Boolean) as ExistingActivityImage[];

  const activityDocuments: UploadedActivityDoc[] = (
    Array.isArray(a.activityDocuments) ? a.activityDocuments : []
  )
    .filter((d: any) => d && d.docKey)
    .map((d: any) => ({
      docKey: d.docKey,
      url: d.url || '',
      file: null,
      expiryDate: d.expiryDate || null,
      status: d.status || 'pending',
    }));

  // Legacy passthrough: preserved untouched, re-spread into the payload.
  const legacyTop: Record<string, any> = {};
  if (Array.isArray(a.highlights) && a.highlights.length > 0) legacyTop.highlights = a.highlights;
  if (Array.isArray(a.languages) && a.languages.length > 0) legacyTop.languages = a.languages;
  if (Array.isArray(a.whatToBring) && a.whatToBring.length > 0) legacyTop.whatToBring = a.whatToBring;
  const legacyPricing: Record<string, any> = {};
  if (pricing.groupDiscount != null) legacyPricing.groupDiscount = pricing.groupDiscount;
  if (pricing.currency) legacyPricing.currency = pricing.currency;

  // cancellationPolicy: string in this domain, but tolerate {type} objects.
  const cancellation =
    typeof a.cancellationPolicy === 'string'
      ? a.cancellationPolicy
      : a.cancellationPolicy?.type || 'moderate';

  return {
    title: a.title || a.name || '',
    shortDescription: a.shortDescription || '',
    description: a.description || '',
    durationValue,
    durationUnit,
    categories: categories.slice(0, MAX_CATEGORIES),
    tags: Array.isArray(a.tags) ? a.tags : [],
    city: a.location?.city || a.city || '',
    meetingPoint: a.location?.meetingPoint || '',
    mapsLink: a.location?.mapsLink || '',
    coordinates,
    photos: [],
    existingImages,
    basePrice: basePrice != null && basePrice !== '' ? String(basePrice) : '',
    priceType: pricing.priceType || 'per_person',
    childPrice: pricing.childPrice != null ? String(pricing.childPrice) : '',
    minGroupSize: a.groupSize?.min != null ? String(a.groupSize.min) : '1',
    // legacy edit form saved maxParticipants instead of groupSize.max.
    maxGroupSize:
      a.groupSize?.max != null
        ? String(a.groupSize.max)
        : a.maxParticipants != null && a.maxParticipants !== ''
        ? String(a.maxParticipants)
        : '10',
    includesWhat: includesArr.join('\n'),
    excludesWhat: excludesArr.join('\n'),
    cancellationPolicy: cancellation,
    advanceBookingDays: a.advanceBookingDays != null ? String(a.advanceBookingDays) : '1',
    availableDays: availableDays.length > 0 ? availableDays : [1, 2, 3, 4, 5, 6],
    startTime: sched[0]?.startTime || '09:00',
    endTime: sched[0]?.endTime || '13:00',
    typeSpecificFields:
      a.typeSpecificFields && typeof a.typeSpecificFields === 'object' ? a.typeSpecificFields : {},
    activityDocuments,
    legacy: { top: legacyTop, pricing: legacyPricing },
  };
}

// ─── Small presentational helpers ────────────────────────────────────────────────

function FieldLabel({
  label,
  required = false,
  optional = false,
  hint,
  counter,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  counter?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.labelInRow, { color: themeColors.textSecondary }]}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
        {optional && (
          <Text style={[styles.labelSuffix, { color: themeColors.textTertiary }]}> · optional</Text>
        )}
        {hint && (
          <Text style={[styles.labelSuffix, { color: themeColors.textTertiary }]}> {hint}</Text>
        )}
      </Text>
      {counter !== undefined && (
        <Text style={[styles.counterText, { color: themeColors.textTertiary }]}>{counter}</Text>
      )}
    </View>
  );
}

function SectionHeader({
  title,
  icon,
  subtitle,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={colors.primary[500]} />
      <View style={styles.sectionHeaderText}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Red banner listing the current step's outstanding required items
// (shared Stepper has no error state, so errors surface in the step body).
function StepErrorBanner({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <View style={styles.errorBanner}>
      {messages.map((msg, i) => (
        <View key={i} style={styles.errorBannerRow}>
          <Ionicons name="warning-outline" size={14} color={colors.error} />
          <Text style={styles.errorBannerText}>{msg}</Text>
        </View>
      ))}
    </View>
  );
}

interface MissingItem {
  step: number;
  label: string;
  message: string;
}

// ─── Main form ───────────────────────────────────────────────────────────────────

export default function ActivityForm({
  mode,
  initialValues,
  headerTitle,
  activityId,
  onDelete,
  reviewExtra,
}: {
  mode: 'create' | 'edit';
  initialValues: ActivityFormValues;
  headerTitle: string;
  activityId?: string;
  /**
   * Edit convention: trash icon in the header (Alert confirm handled by caller).
   * Receives `allowLeave`, which the caller must call immediately before it
   * navigates away after a confirmed delete — otherwise the wizard's back
   * interceptor would treat that navigation as a step-back and cancel it.
   */
  onDelete?: (opts: { allowLeave: () => void }) => void;
  /** Extra content rendered on the Review step (e.g. the edit screen's Inventory & Pricing card). */
  reviewExtra?: React.ReactNode;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const { themeColors } = useTheme();
  const { businessAccount, addListingToStore, updateListingInStore } = useBusinessStore();

  const [values, setValues] = useState<ActivityFormValues>(() => {
    // Prefill city from the business account for brand-new listings.
    if (mode === 'create' && !initialValues.city && businessAccount?.location?.city) {
      return { ...initialValues, city: businessAccount.location.city };
    }
    return initialValues;
  });
  const [step, setStep] = useState(0);
  // When true, the next 'beforeRemove' is an intentional exit (a successful
  // save, or leaving from step 1) and must be allowed through rather than
  // reinterpreted as a step-back.
  const allowLeaveRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [locating, setLocating] = useState(false);

  // Activity type config — fetched here once per primary category and passed
  // down to TypeSpecificFields/ActivityDocumentUploader (no double fetching).
  const [typeConfig, setTypeConfig] = useState<ActivityTypeConfig | null>(null);
  const [typeConfigLoading, setTypeConfigLoading] = useState(false);
  const [typeConfigError, setTypeConfigError] = useState(false);

  const primaryCategory = values.categories[0] || null;

  useEffect(() => {
    if (!primaryCategory) {
      setTypeConfig(null);
      setTypeConfigError(false);
      return;
    }
    let cancelled = false;
    setTypeConfigLoading(true);
    setTypeConfigError(false);
    activityMarketplaceAPI
      .getActivityTypeConfig(primaryCategory)
      .then((res: any) => {
        if (cancelled) return;
        setTypeConfig(res?.success && res.data ? res.data : res?.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setTypeConfig(null);
        setTypeConfigError(true);
      })
      .finally(() => {
        if (!cancelled) setTypeConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [primaryCategory]);

  const set = useCallback(
    <K extends keyof ActivityFormValues>(key: K, val: ActivityFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  // ── Categories ─────────────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: string) => {
    setValues((prev) => {
      if (prev.categories.includes(cat)) {
        return { ...prev, categories: prev.categories.filter((c) => c !== cat) };
      }
      if (prev.categories.length >= MAX_CATEGORIES) {
        Toast.show({ type: 'error', text1: `Maximum ${MAX_CATEGORIES} categories allowed` });
        return prev;
      }
      return { ...prev, categories: [...prev.categories, cat] };
    });
  }, []);

  // ── Tags ───────────────────────────────────────────────────────────────────

  const addTag = useCallback((tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t) return;
    setValues((prev) => {
      if (prev.tags.length >= MAX_TAGS) {
        Toast.show({ type: 'error', text1: `Maximum ${MAX_TAGS} tags allowed` });
        return prev;
      }
      if (prev.tags.includes(t)) return prev;
      return { ...prev, tags: [...prev.tags, t] };
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setValues((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }, []);

  const suggestedTags = useMemo(
    () =>
      getSuggestions({
        categories: values.categories,
        city: values.city,
        title: values.title,
      })
        .filter((t) => !values.tags.includes(t))
        .slice(0, 15),
    [values.categories, values.city, values.title, values.tags],
  );

  // ── Location ───────────────────────────────────────────────────────────────

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to capture your coordinates.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      set('coordinates', coords);
      // Auto-fill an empty city from the reverse geocode (best effort).
      try {
        const results = await Location.reverseGeocodeAsync(coords);
        const place = results[0];
        const city = place?.city || place?.subregion || place?.region || '';
        if (city) {
          setValues((prev) => (prev.city.trim() ? prev : { ...prev, city }));
        }
      } catch {
        // Reverse geocode is a bonus — coordinates are already captured.
      }
      Toast.show({ type: 'success', text1: 'Location captured' });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not get location',
        text2: 'Check that location services are on and try again.',
      });
    } finally {
      setLocating(false);
    }
  }, [set]);

  // ── Photos ─────────────────────────────────────────────────────────────────

  const totalPhotoCount = values.photos.length + values.existingImages.length;

  const pickPhotos = useCallback(async () => {
    const remaining = MAX_PHOTOS - totalPhotoCount;
    if (remaining <= 0) {
      Toast.show({ type: 'error', text1: `Maximum ${MAX_PHOTOS} photos allowed` });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant photo library access to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8, // picker-side compression stands in for browser-image-compression
    });
    if (!result.canceled && result.assets) {
      setValues((prev) => {
        const incoming = result.assets.slice(0, MAX_PHOTOS - prev.existingImages.length - prev.photos.length);
        const hasPrimary = prev.photos.some((p) => p.isPrimary);
        const added: ActivityPhotoDraft[] = incoming.map((a, i) => ({
          uri: a.uri,
          isPrimary: !hasPrimary && i === 0,
          caption: '',
          order: prev.photos.length + i,
        }));
        return { ...prev, photos: [...prev.photos, ...added] };
      });
    }
  }, [totalPhotoCount]);

  const setCoverPhoto = useCallback((index: number) => {
    setValues((prev) => ({
      ...prev,
      photos: prev.photos.map((p, i) => ({ ...p, isPrimary: i === index })),
    }));
  }, []);

  const setPhotoCaption = useCallback((index: number, caption: string) => {
    setValues((prev) => ({
      ...prev,
      photos: prev.photos.map((p, i) => (i === index ? { ...p, caption } : p)),
    }));
  }, []);

  const removePhoto = useCallback((index: number) => {
    setValues((prev) => {
      const next = prev.photos.filter((_, i) => i !== index);
      // Keep exactly one cover among the remaining picks.
      if (next.length > 0 && !next.some((p) => p.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return { ...prev, photos: next.map((p, i) => ({ ...p, order: i })) };
    });
  }, []);

  const movePhoto = useCallback((index: number, dir: -1 | 1) => {
    setValues((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.photos.length) return prev;
      const next = [...prev.photos];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...prev, photos: next.map((p, i) => ({ ...p, order: i })) };
    });
  }, []);

  const removeExistingImage = useCallback(
    (img: ExistingActivityImage, index: number) => {
      Alert.alert('Remove photo', 'Remove this photo from the listing?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (mode === 'edit' && activityId && img._id) {
              try {
                await activityMarketplaceAPI.removeImage(activityId, img._id);
              } catch (err: any) {
                Toast.show({
                  type: 'error',
                  text1: 'Failed to remove photo',
                  text2: err?.message || 'Please try again.',
                });
                return;
              }
            }
            setValues((prev) => ({
              ...prev,
              existingImages: prev.existingImages.filter((_, i) => i !== index),
            }));
          },
        },
      ]);
    },
    [mode, activityId],
  );

  // ── Days ───────────────────────────────────────────────────────────────────

  const toggleDay = useCallback((dayIndex: number) => {
    setValues((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(dayIndex)
        ? prev.availableDays.filter((d) => d !== dayIndex)
        : [...prev.availableDays, dayIndex].sort(),
    }));
  }, []);

  // ── Documents ──────────────────────────────────────────────────────────────

  const handleDocUpload = useCallback(
    (docKey: string, file: PickedDocFile, expiryDate: string | null) => {
      setValues((prev) => ({
        ...prev,
        activityDocuments: [
          ...prev.activityDocuments.filter((d) => d.docKey !== docKey),
          {
            docKey,
            url: file.uri,
            file: { uri: file.uri, name: file.name, type: file.type },
            expiryDate,
            status: 'pending',
          },
        ],
      }));
    },
    [],
  );

  const handleDocRemove = useCallback((docKey: string) => {
    setValues((prev) => ({
      ...prev,
      activityDocuments: prev.activityDocuments.filter((d) => d.docKey !== docKey),
    }));
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  // Full submit-time validation, ported from the web's missingItems memo
  // (city not blocking; coordinates recommended but optional on mobile).

  const missingItems = useMemo<MissingItem[]>(() => {
    const items: MissingItem[] = [];
    if (!values.title.trim()) {
      items.push({ step: STEP_BASICS, label: 'Basics', message: 'Activity title is required' });
    }
    if (!values.description.trim()) {
      items.push({ step: STEP_BASICS, label: 'Basics', message: 'Description is required' });
    }
    if (values.categories.length === 0) {
      items.push({ step: STEP_CATEGORIES, label: 'Categories', message: 'Pick at least one category' });
    }
    const requiredDocs = (typeConfig?.requiredDocuments || []).filter((d) => d.required);
    if (requiredDocs.length > 0) {
      const uploadedKeys = new Set(values.activityDocuments.map((d) => d.docKey));
      const missingDocs = requiredDocs.filter((d) => !uploadedKeys.has(d.docKey));
      if (missingDocs.length > 0) {
        const labels = missingDocs.map((d) => d.label);
        items.push({
          step: STEP_CATEGORIES,
          label: 'Required documents',
          message:
            missingDocs.length === 1
              ? `Upload ${labels[0]}`
              : `Upload ${missingDocs.length} required documents (${labels.slice(0, 2).join(', ')}${labels.length > 2 ? ', …' : ''})`,
        });
      }
    }
    if (values.tags.length < MIN_TAGS) {
      items.push({
        step: STEP_TAGS,
        label: 'Tags',
        message: `Add at least ${MIN_TAGS} tags (${values.tags.length}/${MIN_TAGS})`,
      });
    }
    if (totalPhotoCount < MIN_PHOTOS) {
      items.push({
        step: STEP_PHOTOS,
        label: 'Photos',
        message: `Add at least ${MIN_PHOTOS} photos (${totalPhotoCount}/${MIN_PHOTOS})`,
      });
    }
    if (!values.basePrice || isNaN(parseFloat(values.basePrice))) {
      items.push({ step: STEP_PRICING, label: 'Pricing', message: 'Enter a base price' });
    }
    if (values.availableDays.length === 0) {
      items.push({ step: STEP_PRICING, label: 'Availability', message: 'Pick at least one available day' });
    }
    const minG = parseInt(values.minGroupSize, 10) || 0;
    const maxG = parseInt(values.maxGroupSize, 10) || 0;
    if (minG > 0 && maxG > 0 && minG > maxG) {
      items.push({ step: STEP_PRICING, label: 'Group size', message: 'Min group size cannot exceed max' });
    }
    if (!TIME_RE.test(values.startTime) || !TIME_RE.test(values.endTime)) {
      items.push({ step: STEP_PRICING, label: 'Availability', message: 'Times must be in HH:MM format' });
    }
    return items;
  }, [values, totalPhotoCount, typeConfig]);

  const stepErrors = useCallback(
    (s: number) =>
      submitAttempted ? missingItems.filter((m) => m.step === s).map((m) => m.message) : [],
    [submitAttempted, missingItems],
  );

  // Light per-step gate on Next (PackageForm pattern): required fields for the
  // step you're leaving. Docs are only enforced at submit time.
  const validateStep = (s: number): string | null => {
    if (s === STEP_BASICS) {
      if (!values.title.trim()) return 'Activity title is required';
      if (!values.description.trim()) return 'Description is required';
    }
    if (s === STEP_CATEGORIES) {
      if (values.categories.length === 0) return 'Pick at least one category';
    }
    if (s === STEP_TAGS) {
      if (values.tags.length < MIN_TAGS)
        return `Add at least ${MIN_TAGS} tags (${values.tags.length}/${MIN_TAGS})`;
    }
    if (s === STEP_PHOTOS) {
      if (totalPhotoCount < MIN_PHOTOS)
        return `Add at least ${MIN_PHOTOS} photos (${totalPhotoCount}/${MIN_PHOTOS})`;
    }
    if (s === STEP_PRICING) {
      if (!values.basePrice || isNaN(parseFloat(values.basePrice))) return 'Enter a base price';
      if (values.availableDays.length === 0) return 'Pick at least one available day';
      const minG = parseInt(values.minGroupSize, 10) || 0;
      const maxG = parseInt(values.maxGroupSize, 10) || 0;
      if (minG > 0 && maxG > 0 && minG > maxG) return 'Min group size cannot exceed max';
      if (!TIME_RE.test(values.startTime) || !TIME_RE.test(values.endTime))
        return 'Times must be in HH:MM format (e.g. 09:00)';
    }
    return null;
  };

  const isLastStep = step === STEPS.length - 1;

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      Toast.show({ type: 'error', text1: err });
      return;
    }
    if (!isLastStep) setStep((s) => s + 1);
  };

  // The single "go back" behaviour every back affordance uses — header chevron,
  // footer Back, the Android hardware button, and the iOS swipe gesture (the
  // last two via the beforeRemove interceptor below). The 7 steps are React
  // state, not navigation entries, so "back" means "previous step" until you're
  // on step 1, where it leaves the screen instead.
  const goBack = () => {
    if (step === 0) {
      exitScreen();
    } else {
      setStep((s) => s - 1);
    }
  };

  // Leave the wizard entirely. Guard canGoBack so a history-less entry (deep
  // link, or a missing stack anchor) lands on the listings screen instead of
  // being a dead tap — the original bug.
  const exitScreen = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/activity');
    }
  };

  // Map the OS back gestures — the Android hardware button and the iOS
  // edge-swipe — onto the same step-back behaviour as the on-screen controls.
  // Both fire 'beforeRemove' when they try to pop this screen; on any step past
  // the first we cancel the pop and step back instead, so progress isn't thrown
  // away. On step 1 we let the removal through and the screen exits normally.
  useEffect(() => {
    const unsub = (navigation as any).addListener(
      'beforeRemove',
      (e: { preventDefault: () => void }) => {
        if (allowLeaveRef.current) return; // intentional exit (e.g. after save)
        if (step > 0) {
          e.preventDefault();
          setStep((s) => s - 1);
        }
      },
    );
    return unsub;
  }, [navigation, step]);

  const jumpToStep = (s: number) => setStep(Math.max(0, Math.min(s, STEPS.length - 1)));

  // ── Photo upload (after save) ─────────────────────────────────────────────

  const uploadNewPhotos = async (listingId: string) => {
    const formData = new FormData();
    values.photos.forEach((p, i) => {
      const filename = p.uri.split('/').pop() || `photo-${i}.jpg`;
      const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
      formData.append('images', {
        uri: p.uri,
        name: filename,
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      } as any);
    });
    await activityMarketplaceAPI.uploadImageFiles(listingId, formData);
  };

  // ── Save / submit ─────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (asDraft: boolean) => {
      if (!asDraft && missingItems.length > 0) {
        setSubmitAttempted(true);
        const first = missingItems[0];
        Toast.show({
          type: 'error',
          text1:
            missingItems.length === 1
              ? `${first.label}: ${first.message}`
              : `Please complete ${missingItems.length} required items`,
          text2: missingItems.length === 1 ? undefined : `Starting with ${first.label}`,
        });
        jumpToStep(first.step);
        return;
      }

      const setLoading = asDraft ? setSavingDraft : setSubmitting;
      setLoading(true);
      try {
        const payload = buildActivityPayload(values, typeConfig);

        let res: any;
        if (mode === 'edit' && activityId) {
          // Edit never touches status — approval state is managed elsewhere.
          res = await activityMarketplaceAPI.updateListing(activityId, payload);
        } else {
          payload.status = asDraft ? 'draft' : 'pending_approval';
          res = await activityMarketplaceAPI.createListing(payload);
        }
        const saved = res?.data || res?.activity || res;
        const savedId: string | undefined = saved?._id || activityId;

        if (mode === 'create' && !savedId) {
          throw new Error('Unexpected response from server');
        }

        // Photos upload after the listing exists; failure is non-fatal.
        if (values.photos.length > 0 && savedId) {
          try {
            await uploadNewPhotos(savedId);
          } catch {
            Toast.show({
              type: 'error',
              text1: 'Listing saved, but photos failed to upload',
              text2: 'Add them again from Edit Activity.',
            });
          }
        }

        if (mode === 'edit' && activityId) {
          updateListingInStore(activityId, saved);
        } else if (saved?._id) {
          addListingToStore(saved);
        }

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Toast.show({
          type: 'success',
          text1:
            mode === 'edit'
              ? 'Activity updated'
              : asDraft
              ? 'Draft saved'
              : 'Submitted for review',
          text2:
            mode === 'edit'
              ? undefined
              : asDraft
              ? 'You can edit and submit it later.'
              : 'Your activity will be reviewed by our team.',
        });
        allowLeaveRef.current = true; // let this navigation through the guard
        router.back();
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: mode === 'edit' ? 'Failed to update activity' : 'Failed to create activity',
          text2: err?.body?.message || err?.message || 'Please try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [values, missingItems, typeConfig, mode, activityId, addListingToStore, updateListingInStore, router],
  );

  // ── Shared style fragments (StyleSheet stays static; theme applied inline) ──

  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, color: themeColors.text },
  ];
  const hintStyle = [styles.helperText, { color: themeColors.textTertiary }];

  // ── Review helpers ─────────────────────────────────────────────────────────

  const summaryRow = (label: string, value: string) => (
    <View style={styles.summaryRow} key={label}>
      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: themeColors.text }]} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );

  const reviewCard = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    targetStep: number,
    children: React.ReactNode,
  ) => (
    <Card style={styles.formSection} key={title}>
      <View style={styles.reviewCardHeader}>
        <SectionHeader title={title} icon={icon} />
        <TouchableOpacity
          style={styles.editLink}
          onPress={() => jumpToStep(targetStep)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={13} color={colors.primary[500]} />
          <Text style={styles.editLinkText}>Edit</Text>
        </TouchableOpacity>
      </View>
      {children}
    </Card>
  );

  const typeFieldCount = Object.entries(values.typeSpecificFields).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  ).length;

  const photosMissing = MIN_PHOTOS - totalPhotoCount;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{headerTitle}</Text>
        {onDelete ? (
          <TouchableOpacity
            onPress={() => onDelete({ allowLeave: () => { allowLeaveRef.current = true; } })}
            style={styles.headerActionBtn}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ───── Step 0: Basics ───── */}
          {step === STEP_BASICS && (
            <Card style={styles.formSection}>
              <SectionHeader title="Basics" icon="information-circle-outline" subtitle="Title, description & duration" />
              <StepErrorBanner messages={stepErrors(STEP_BASICS)} />

              <FieldLabel label="Activity Title" required counter={`${values.title.length}/${TITLE_MAX}`} />
              <RNTextInput
                value={values.title}
                onChangeText={(t) => set('title', t)}
                maxLength={TITLE_MAX}
                placeholder="e.g., Sunrise Trek to Hampi's Boulder Trails"
                placeholderTextColor={themeColors.textTertiary}
                style={inputStyle}
              />

              <FieldLabel label="Short Description" optional counter={`${values.shortDescription.length}/${SHORT_DESC_MAX}`} />
              <RNTextInput
                value={values.shortDescription}
                onChangeText={(t) => set('shortDescription', t)}
                maxLength={SHORT_DESC_MAX}
                placeholder="One-liner shown on activity cards"
                placeholderTextColor={themeColors.textTertiary}
                style={inputStyle}
              />

              <FieldLabel label="Description" required counter={`${values.description.length}/${DESC_MAX}`} />
              <RNTextInput
                value={values.description}
                onChangeText={(t) => set('description', t)}
                maxLength={DESC_MAX}
                placeholder="Describe your activity in detail. What makes it unique? What will participants experience?"
                placeholderTextColor={themeColors.textTertiary}
                style={[...inputStyle, styles.inputMultiline]}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <FieldLabel label="Duration" />
              <View style={styles.durationRow}>
                <RNTextInput
                  value={values.durationValue}
                  onChangeText={(t) => set('durationValue', t.replace(/[^0-9]/g, ''))}
                  placeholder="3"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[...inputStyle, styles.durationInput]}
                  keyboardType="numeric"
                />
                <View style={styles.chipWrap}>
                  {DURATION_UNITS.map((u) => {
                    const active = values.durationUnit === u.key;
                    return (
                      <TouchableOpacity
                        key={u.key}
                        style={[
                          styles.chip,
                          { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                          active && styles.chipSelected,
                        ]}
                        onPress={() => set('durationUnit', u.key as 'hours' | 'days')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: themeColors.textSecondary }, active && styles.chipTextSelected]}>
                          {u.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Card>
          )}

          {/* ───── Step 1: Categories & type-specific details ───── */}
          {step === STEP_CATEGORIES && (
            <Card style={styles.formSection}>
              <SectionHeader title="Categories & Details" icon="grid-outline" subtitle="Pick 1–3 categories" />
              <StepErrorBanner messages={stepErrors(STEP_CATEGORIES)} />

              <FieldLabel
                label="Pick what fits"
                required
                hint="· up to 3"
                counter={`${values.categories.length}/${MAX_CATEGORIES}`}
              />
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = values.categories.includes(cat.label);
                  const isPrimary = values.categories[0] === cat.label;
                  return (
                    <TouchableOpacity
                      key={cat.label}
                      style={[
                        styles.categoryCard,
                        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                        isSelected && styles.categoryCardSelected,
                      ]}
                      onPress={() => toggleCategory(cat.label)}
                      activeOpacity={0.7}
                    >
                      {isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Ionicons name="star" size={9} color="#ffffff" />
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.categoryLabel,
                          { color: themeColors.textSecondary },
                          isSelected && styles.categoryLabelSelected,
                        ]}
                        numberOfLines={2}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={hintStyle}>First category selected is the primary one shown to travellers.</Text>

              {/* Type-specific fields + documents (driven by the primary category) */}
              {primaryCategory && (
                <View style={[styles.typeSection, { borderTopColor: themeColors.border }]}>
                  {typeConfigLoading ? (
                    <View style={styles.configLoadingRow}>
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                      <Text style={[styles.configLoadingText, { color: themeColors.textSecondary }]}>
                        Loading {primaryCategory} specific fields...
                      </Text>
                    </View>
                  ) : typeConfigError ? (
                    <View style={styles.configErrorBanner}>
                      <Ionicons name="alert-circle-outline" size={16} color="#854d0e" />
                      <Text style={styles.configErrorText}>
                        Couldn't load {primaryCategory} details. You can still continue —
                        type-specific fields will be available after submission.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TypeSpecificFields
                        primaryCategory={primaryCategory}
                        config={typeConfig}
                        values={values.typeSpecificFields}
                        onChange={(fieldKey, value) =>
                          setValues((prev) => ({
                            ...prev,
                            typeSpecificFields: { ...prev.typeSpecificFields, [fieldKey]: value },
                          }))
                        }
                        errors={{}}
                      />
                      {(typeConfig?.requiredDocuments?.length ?? 0) > 0 && (
                        <View style={[styles.docsSection, { borderTopColor: themeColors.border }]}>
                          <ActivityDocumentUploader
                            requiredDocuments={typeConfig?.requiredDocuments}
                            uploadedDocs={values.activityDocuments}
                            onUpload={handleDocUpload}
                            onRemove={handleDocRemove}
                          />
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </Card>
          )}

          {/* ───── Step 2: Tags ───── */}
          {step === STEP_TAGS && (
            <Card style={styles.formSection}>
              <SectionHeader title="Tags" icon="pricetag-outline" subtitle="Keywords that help customers find you" />
              <StepErrorBanner messages={stepErrors(STEP_TAGS)} />

              <FieldLabel
                label="Tags"
                required
                hint={`· ${values.tags.length}/${MIN_TAGS} minimum`}
                counter={`${values.tags.length}/${MAX_TAGS}`}
              />

              {values.tags.length > 0 && (
                <View style={styles.selectedTagsWrap}>
                  {values.tags.map((tag) => (
                    <View key={tag} style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{tag}</Text>
                      <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close" size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {suggestedTags.length > 0 && (
                <>
                  <Text style={hintStyle}>Suggested tags (tap to add):</Text>
                  <View style={styles.suggestionRow}>
                    {suggestedTags.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.suggestionChip, { borderColor: themeColors.border }]}
                        onPress={() => addTag(t)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={14} color={themeColors.textTertiary} />
                        <Text style={[styles.suggestionText, { color: themeColors.textSecondary }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <FieldLabel label="Custom tag" optional />
              <View style={styles.customTagRow}>
                <RNTextInput
                  value={customTag}
                  onChangeText={(t) => setCustomTag(t.toLowerCase())}
                  placeholder="Type a tag and press add"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[...inputStyle, styles.customTagInput]}
                  autoCapitalize="none"
                  onSubmitEditing={() => {
                    addTag(customTag);
                    setCustomTag('');
                  }}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.customTagAddBtn}
                  onPress={() => {
                    addTag(customTag);
                    setCustomTag('');
                  }}
                >
                  <Ionicons name="add" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* ───── Step 3: Location ───── */}
          {step === STEP_LOCATION && (
            <Card style={styles.formSection}>
              <SectionHeader title="Location" icon="location-outline" subtitle="Where the activity happens" />
              <StepErrorBanner messages={stepErrors(STEP_LOCATION)} />

              <FieldLabel label="City / Area" required />
              <RNTextInput
                value={values.city}
                onChangeText={(t) => set('city', t)}
                placeholder="e.g., Goa, Mumbai, Hampi, Manali"
                placeholderTextColor={themeColors.textTertiary}
                style={inputStyle}
              />

              <FieldLabel label="Exact coordinates" hint="· recommended" optional />
              {values.coordinates ? (
                <View style={[styles.coordsCard, { borderColor: themeColors.border, backgroundColor: themeColors.inputBackground }]}>
                  <Ionicons name="navigate" size={18} color={colors.primary[500]} />
                  <Text style={[styles.coordsText, { color: themeColors.text }]}>
                    {values.coordinates.latitude.toFixed(6)}, {values.coordinates.longitude.toFixed(6)}
                  </Text>
                  <TouchableOpacity onPress={useMyLocation} disabled={locating} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Ionicons name="refresh" size={18} color={colors.primary[500]} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => set('coordinates', null)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Button
                  title={locating ? 'Getting location...' : 'Use my location'}
                  onPress={useMyLocation}
                  variant="outline"
                  size="md"
                  loading={locating}
                  fullWidth
                  icon={<Ionicons name="locate-outline" size={18} color={colors.primary[500]} />}
                />
              )}
              <Text style={hintStyle}>
                Capturing coordinates from where you are helps travellers find the meeting spot.
              </Text>

              <FieldLabel label="Meeting Point Instructions" optional />
              <RNTextInput
                value={values.meetingPoint}
                onChangeText={(t) => set('meetingPoint', t)}
                placeholder="Extra directions to help customers find the meeting spot..."
                placeholderTextColor={themeColors.textTertiary}
                style={[...inputStyle, styles.inputMultilineShort]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <FieldLabel label="Google Maps Link" optional />
              <RNTextInput
                value={values.mapsLink}
                onChangeText={(t) => set('mapsLink', t)}
                placeholder="https://maps.google.com/..."
                placeholderTextColor={themeColors.textTertiary}
                style={inputStyle}
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
            </Card>
          )}

          {/* ───── Step 4: Photos ───── */}
          {step === STEP_PHOTOS && (
            <Card style={styles.formSection}>
              <SectionHeader
                title="Activity Photos"
                icon="camera-outline"
                subtitle={`${totalPhotoCount}/${MAX_PHOTOS} photos · min ${MIN_PHOTOS}`}
              />
              <StepErrorBanner messages={stepErrors(STEP_PHOTOS)} />

              <FieldLabel label="Photos" required hint={`· min ${MIN_PHOTOS}`} counter={`${totalPhotoCount}/${MAX_PHOTOS}`} />

              {/* Existing server images (edit mode) */}
              {values.existingImages.length > 0 && (
                <>
                  <Text style={hintStyle}>Already uploaded:</Text>
                  <View style={styles.imageGrid}>
                    {values.existingImages.map((img, i) => (
                      <View key={img._id || img.url || i} style={styles.imageThumb}>
                        <Image source={{ uri: img.url }} style={styles.imageThumbImg} />
                        <TouchableOpacity
                          style={styles.imageRemoveBtn}
                          onPress={() => removeExistingImage(img, i)}
                        >
                          <Ionicons name="close-circle" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* New picks — cover, caption, reorder */}
              {values.photos.map((photo, i) => (
                <View
                  key={`${photo.uri}-${i}`}
                  style={[styles.photoRow, { borderColor: themeColors.border, backgroundColor: themeColors.inputBackground }]}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoRowImg} />
                  <View style={styles.photoRowBody}>
                    <View style={styles.photoRowTop}>
                      {photo.isPrimary ? (
                        <View style={styles.coverBadge}>
                          <Ionicons name="star" size={10} color="#ffffff" />
                          <Text style={styles.coverBadgeText}>Cover</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.setCoverBtn} onPress={() => setCoverPhoto(i)} activeOpacity={0.7}>
                          <Ionicons name="star-outline" size={11} color={colors.primary[500]} />
                          <Text style={styles.setCoverText}>Set Cover</Text>
                        </TouchableOpacity>
                      )}
                      <View style={styles.photoRowActions}>
                        <TouchableOpacity
                          onPress={() => movePhoto(i, -1)}
                          disabled={i === 0}
                          style={[styles.photoIconBtn, i === 0 && styles.photoIconBtnDisabled]}
                        >
                          <Ionicons name="chevron-back" size={16} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => movePhoto(i, 1)}
                          disabled={i === values.photos.length - 1}
                          style={[styles.photoIconBtn, i === values.photos.length - 1 && styles.photoIconBtnDisabled]}
                        >
                          <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removePhoto(i)} style={styles.photoIconBtn}>
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <RNTextInput
                      value={photo.caption}
                      onChangeText={(t) => setPhotoCaption(i, t)}
                      placeholder="Add caption..."
                      placeholderTextColor={themeColors.textTertiary}
                      style={[
                        styles.captionInput,
                        { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, color: themeColors.text },
                      ]}
                    />
                  </View>
                </View>
              ))}

              {totalPhotoCount < MAX_PHOTOS && (
                <TouchableOpacity
                  style={[styles.imageAddBtn, totalPhotoCount === 0 && styles.imageAddBtnFull]}
                  onPress={pickPhotos}
                >
                  <Ionicons
                    name={totalPhotoCount === 0 ? 'cloud-upload-outline' : 'add-outline'}
                    size={28}
                    color={colors.primary[500]}
                  />
                  <Text style={styles.imageAddText}>
                    {totalPhotoCount === 0 ? 'Tap to add photos' : 'Add more'}
                  </Text>
                  <Text style={[styles.imageAddText, { color: themeColors.textTertiary }]}>
                    {MAX_PHOTOS - totalPhotoCount} remaining
                  </Text>
                </TouchableOpacity>
              )}

              {photosMissing > 0 && (
                <View style={styles.photoWarnBanner}>
                  <Ionicons name="warning-outline" size={16} color={colors.warning} />
                  <Text style={styles.photoWarnText}>
                    Need at least {photosMissing} more photo{photosMissing === 1 ? '' : 's'} to submit
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* ───── Step 5: Pricing & Availability ───── */}
          {step === STEP_PRICING && (
            <Card style={styles.formSection}>
              <SectionHeader title="Pricing & Availability" icon="cash-outline" subtitle="Rates, group size, days & times" />
              <StepErrorBanner messages={stepErrors(STEP_PRICING)} />

              <View style={styles.pairRow}>
                <View style={styles.pairField}>
                  <FieldLabel label="Base Price (₹)" required />
                  <RNTextInput
                    value={values.basePrice}
                    onChangeText={(t) => set('basePrice', t.replace(/[^0-9.]/g, ''))}
                    placeholder="1000"
                    placeholderTextColor={themeColors.textTertiary}
                    style={inputStyle}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.pairField}>
                  <FieldLabel label="Price Type" />
                  <View style={styles.chipWrap}>
                    {PRICE_TYPES.map((t) => {
                      const active = values.priceType === t.key;
                      return (
                        <TouchableOpacity
                          key={t.key}
                          style={[
                            styles.chip,
                            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                            active && styles.chipSelected,
                          ]}
                          onPress={() => set('priceType', t.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, { color: themeColors.textSecondary }, active && styles.chipTextSelected]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <FieldLabel label="Child Price (₹)" optional />
              <RNTextInput
                value={values.childPrice}
                onChangeText={(t) => set('childPrice', t.replace(/[^0-9.]/g, ''))}
                placeholder="500"
                placeholderTextColor={themeColors.textTertiary}
                style={inputStyle}
                keyboardType="numeric"
              />
              <Text style={hintStyle}>
                Per-child rate for ages 0–12; ages 13+ pay the base price. Leave blank to charge everyone the same.
              </Text>

              <View style={styles.pairRow}>
                <View style={styles.pairField}>
                  <FieldLabel label="Min Group" />
                  <RNTextInput
                    value={values.minGroupSize}
                    onChangeText={(t) => set('minGroupSize', t.replace(/[^0-9]/g, ''))}
                    placeholder="1"
                    placeholderTextColor={themeColors.textTertiary}
                    style={inputStyle}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.pairField}>
                  <FieldLabel label="Max Group" />
                  <RNTextInput
                    value={values.maxGroupSize}
                    onChangeText={(t) => set('maxGroupSize', t.replace(/[^0-9]/g, ''))}
                    placeholder="10"
                    placeholderTextColor={themeColors.textTertiary}
                    style={inputStyle}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <FieldLabel label="What's Included" hint="· one per line" />
              <RNTextInput
                value={values.includesWhat}
                onChangeText={(t) => set('includesWhat', t)}
                placeholder={'One per line\ne.g.\nProfessional guide\nEquipment'}
                placeholderTextColor={themeColors.textTertiary}
                style={[...inputStyle, styles.inputMultilineShort]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <FieldLabel label="What's Excluded" hint="· one per line" />
              <RNTextInput
                value={values.excludesWhat}
                onChangeText={(t) => set('excludesWhat', t)}
                placeholder={'One per line\ne.g.\nTransportation\nMeals'}
                placeholderTextColor={themeColors.textTertiary}
                style={[...inputStyle, styles.inputMultilineShort]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <FieldLabel label="Cancellation Policy" />
              {CANCELLATION_POLICIES.map((policy) => {
                const active = values.cancellationPolicy === policy.key;
                return (
                  <TouchableOpacity
                    key={policy.key}
                    style={[
                      styles.policyOption,
                      { borderBottomColor: themeColors.border },
                      active && styles.policyOptionSelected,
                    ]}
                    onPress={() => set('cancellationPolicy', policy.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? colors.primary[500] : themeColors.textTertiary}
                    />
                    <View style={styles.policyText}>
                      <Text style={[styles.policyLabel, { color: themeColors.text }]}>{policy.label}</Text>
                      <Text style={[styles.policyDesc, { color: themeColors.textSecondary }]}>{policy.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <FieldLabel label="Advance Booking" />
              <View style={styles.advanceRow}>
                <RNTextInput
                  value={values.advanceBookingDays}
                  onChangeText={(t) => set('advanceBookingDays', t.replace(/[^0-9]/g, ''))}
                  placeholder="1"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[...inputStyle, styles.advanceInput]}
                  keyboardType="numeric"
                />
                <Text style={[styles.advanceSuffix, { color: themeColors.textSecondary }]}>
                  day(s) before {values.advanceBookingDays === '0' ? '· Same-day OK' : ''}
                </Text>
              </View>

              {/* Availability */}
              <View style={styles.availabilityHeader}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                <Text style={[styles.availabilityTitle, { color: themeColors.text }]}>Availability</Text>
              </View>

              <FieldLabel label="Available Days" required />
              <View style={styles.chipWrap}>
                {DAYS.map((day, index) => {
                  const active = values.availableDays.includes(index);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.chip,
                        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                        active && styles.chipSelected,
                      ]}
                      onPress={() => toggleDay(index)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, { color: themeColors.textSecondary }, active && styles.chipTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.pairRow}>
                <View style={styles.pairField}>
                  <FieldLabel label="Start Time" hint="· HH:MM" />
                  <RNTextInput
                    value={values.startTime}
                    onChangeText={(t) => set('startTime', t)}
                    placeholder="09:00"
                    placeholderTextColor={themeColors.textTertiary}
                    style={[
                      ...inputStyle,
                      !TIME_RE.test(values.startTime) && values.startTime !== '' ? styles.inputError : null,
                    ]}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.pairField}>
                  <FieldLabel label="End Time" hint="· HH:MM" />
                  <RNTextInput
                    value={values.endTime}
                    onChangeText={(t) => set('endTime', t)}
                    placeholder="13:00"
                    placeholderTextColor={themeColors.textTertiary}
                    style={[
                      ...inputStyle,
                      !TIME_RE.test(values.endTime) && values.endTime !== '' ? styles.inputError : null,
                    ]}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCorrect={false}
                  />
                </View>
              </View>
            </Card>
          )}

          {/* ───── Step 6: Review ───── */}
          {step === STEP_REVIEW && (
            <>
              {missingItems.length > 0 && (
                <Card style={[styles.formSection, styles.missingCard]}>
                  <View style={styles.missingHeader}>
                    <Ionicons name="warning-outline" size={18} color={colors.error} />
                    <Text style={styles.missingTitle}>
                      {missingItems.length} item{missingItems.length === 1 ? ' needs' : 's need'} attention
                    </Text>
                  </View>
                  {missingItems.map((item, i) => (
                    <View key={i} style={styles.missingRow}>
                      <Text style={styles.missingText}>
                        <Text style={styles.missingLabel}>{item.label}: </Text>
                        {item.message}
                      </Text>
                      <TouchableOpacity onPress={() => jumpToStep(item.step)}>
                        <Text style={styles.missingFix}>Fix</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </Card>
              )}

              {reviewCard('Basics', 'information-circle-outline', STEP_BASICS, (
                <>
                  {summaryRow('Title', values.title)}
                  {summaryRow(
                    'Duration',
                    values.durationValue ? `${values.durationValue} ${values.durationUnit}` : '',
                  )}
                  {summaryRow(
                    'Description',
                    values.description.length > 120
                      ? `${values.description.slice(0, 120)}…`
                      : values.description,
                  )}
                </>
              ))}

              {reviewCard('Categories & Details', 'grid-outline', STEP_CATEGORIES, (
                <>
                  {summaryRow(
                    'Categories',
                    values.categories
                      .map((c, i) => (i === 0 ? `★ ${c}` : c))
                      .join(', '),
                  )}
                  {typeFieldCount > 0 &&
                    summaryRow(`${primaryCategory} details`, `${typeFieldCount} field(s) filled`)}
                  {(typeConfig?.requiredDocuments?.length ?? 0) > 0 &&
                    summaryRow(
                      'Documents',
                      `${values.activityDocuments.length}/${typeConfig?.requiredDocuments?.length} uploaded`,
                    )}
                </>
              ))}

              {reviewCard('Tags', 'pricetag-outline', STEP_TAGS, summaryRow('Tags', values.tags.join(', ')))}

              {reviewCard('Location', 'location-outline', STEP_LOCATION, (
                <>
                  {summaryRow('City', values.city)}
                  {values.meetingPoint ? summaryRow('Meeting point', values.meetingPoint) : null}
                  {summaryRow(
                    'Coordinates',
                    values.coordinates
                      ? `${values.coordinates.latitude.toFixed(6)}, ${values.coordinates.longitude.toFixed(6)}`
                      : 'Not captured',
                  )}
                </>
              ))}

              {reviewCard('Photos', 'camera-outline', STEP_PHOTOS, (
                summaryRow('Photos', `${totalPhotoCount}/${MAX_PHOTOS} (min ${MIN_PHOTOS})`)
              ))}

              {reviewCard('Pricing & Availability', 'cash-outline', STEP_PRICING, (
                <>
                  {summaryRow(
                    'Base price',
                    values.basePrice ? `₹${Number(values.basePrice).toLocaleString('en-IN')}` : '',
                  )}
                  {summaryRow('Price type', values.priceType === 'per_group' ? 'Per group' : 'Per person')}
                  {summaryRow(
                    'Child price (≤12 yrs)',
                    values.childPrice && !isNaN(parseFloat(values.childPrice))
                      ? `₹${Number(values.childPrice).toLocaleString('en-IN')}`
                      : 'Same as adult',
                  )}
                  {summaryRow('Group size', `${values.minGroupSize || 1}–${values.maxGroupSize || 10} people`)}
                  {summaryRow(
                    'Advance booking',
                    values.advanceBookingDays === '0' ? 'Same-day OK' : `${values.advanceBookingDays || 0} day(s) before`,
                  )}
                  {summaryRow(
                    'Cancellation',
                    CANCELLATION_POLICIES.find((p) => p.key === values.cancellationPolicy)?.label || 'Moderate',
                  )}
                  {summaryRow('Time window', `${values.startTime} – ${values.endTime}`)}
                  {summaryRow(
                    'Available days',
                    values.availableDays.map((d) => DAYS[d]).join(', '),
                  )}
                </>
              ))}

              {reviewExtra}
            </>
          )}

          {/* Navigation / actions */}
          {isLastStep ? (
            <View style={styles.actionsStacked}>
              <Button
                title={mode === 'edit' ? 'Save Changes' : 'Submit for Review'}
                onPress={() => handleSave(false)}
                size="lg"
                loading={submitting}
                disabled={savingDraft}
                fullWidth
              />
              {mode === 'create' && (
                <Button
                  title="Save as Draft"
                  onPress={() => handleSave(true)}
                  variant="outline"
                  size="lg"
                  loading={savingDraft}
                  disabled={submitting}
                  fullWidth
                />
              )}
              {/* Step-back from Review — the header chevron now exits the screen,
                  so the wizard's "previous step" affordance lives here. */}
              <Button
                title="Back"
                onPress={goBack}
                variant="ghost"
                size="lg"
                disabled={submitting || savingDraft}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button title="Back" onPress={goBack} variant="outline" size="lg" style={styles.actionBtn} />
              <Button title="Next" onPress={goNext} size="lg" style={styles.actionBtn} />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 36 },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  scrollContent: { padding: spacing.xl },

  formSection: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  sectionSubtitle: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },

  // Labels & inputs
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  labelInRow: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  labelSuffix: { fontWeight: fontWeight.normal, fontSize: fontSize.xs },
  counterText: { fontSize: fontSize.xs, color: colors.textTertiary, marginLeft: spacing.sm },
  requiredMark: { color: colors.error, fontWeight: fontWeight.bold },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputMultiline: { minHeight: 110, paddingTop: spacing.md },
  inputMultilineShort: { minHeight: 80, paddingTop: spacing.md },
  inputError: { borderColor: colors.error },
  helperText: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs },
  pairRow: { flexDirection: 'row', gap: spacing.md },
  pairField: { flex: 1 },

  // Error banner (per-step, shown after a failed submit)
  errorBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  errorBannerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  errorBannerText: { flex: 1, fontSize: fontSize.xs, color: colors.error, lineHeight: 16 },

  // Duration
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  durationInput: { width: 90 },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, flexShrink: 1 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextSelected: { color: colors.primary[600], fontWeight: fontWeight.semibold },

  // Category grid — emoji cards, two columns like the web form.
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  categoryCard: {
    width: '48.5%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  categoryCardSelected: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  categoryEmoji: { fontSize: 22, lineHeight: 26 },
  categoryLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
  categoryLabelSelected: { color: colors.primary[600], fontWeight: fontWeight.semibold },
  primaryBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    zIndex: 1,
  },
  primaryBadgeText: { fontSize: 9, fontWeight: fontWeight.bold, color: '#ffffff' },

  // Type-specific section
  typeSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  docsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  configLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  configLoadingText: { fontSize: fontSize.sm },
  configErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: colors.warningLight,
  },
  configErrorText: { flex: 1, fontSize: fontSize.xs, color: '#854d0e', lineHeight: 16 },

  // Tags
  selectedTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  selectedTagText: { fontSize: fontSize.sm, color: '#ffffff' },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  suggestionText: { fontSize: fontSize.xs, color: colors.textSecondary },
  customTagRow: { flexDirection: 'row', gap: spacing.sm },
  customTagInput: { flex: 1 },
  customTagAddBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Location
  coordsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  coordsText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Photos
  imageGrid: { gap: spacing.md, marginBottom: spacing.sm },
  imageThumb: { width: '100%', height: 180, borderRadius: borderRadius.md, position: 'relative' },
  imageThumbImg: { width: '100%', height: 180, borderRadius: borderRadius.md },
  imageRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  photoRow: {
    flexDirection: 'column',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  photoRowImg: { width: '100%', height: 200, borderRadius: borderRadius.md },
  photoRowBody: { flex: 1, gap: spacing.sm },
  photoRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoRowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  photoIconBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIconBtnDisabled: { opacity: 0.3 },
  coverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  coverBadgeText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#ffffff' },
  setCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  setCoverText: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.primary[500] },
  captionInput: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: fontSize.xs,
  },
  imageAddBtn: {
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    marginTop: spacing.sm,
  },
  imageAddBtnFull: { height: 120 },
  imageAddText: { fontSize: fontSize.xs, color: colors.primary[500], marginTop: 2 },
  photoWarnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  photoWarnText: { fontSize: fontSize.xs, color: '#854d0e', flex: 1 },

  // Advance booking
  advanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  advanceInput: { width: 90 },
  advanceSuffix: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },

  // Availability
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  availabilityTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },

  // Cancellation policy rows
  policyOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  policyOptionSelected: {
    backgroundColor: colors.primary[50],
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderBottomWidth: 0,
  },
  policyText: { flex: 1 },
  policyLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  policyDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Review
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
  editLinkText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[500] },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  missingCard: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.errorLight,
  },
  missingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  missingTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.error },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  missingText: { flex: 1, fontSize: fontSize.xs, color: colors.error, lineHeight: 16 },
  missingLabel: { fontWeight: fontWeight.bold },
  missingFix: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.error,
    textDecorationLine: 'underline',
  },

  // Actions
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  actionBtn: { flex: 1 },
  actionsStacked: { gap: spacing.sm, marginTop: spacing.xl },
  bottomSpacer: { height: spacing['3xl'] },
});
