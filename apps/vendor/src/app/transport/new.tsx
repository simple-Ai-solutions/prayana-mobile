import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  useTheme,
  RequiredLabel,
  LoadingSpinner,
  EmptyState,
} from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
import { vehicleAPI } from '@prayana/shared-services';

// ─── Wizard steps ───────────────────────────────────────────────────────────────

const STEPS = ['Vehicle', 'Pricing', 'Policies'];

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: 'chauffeur_driven', label: 'Chauffeur' },
  { key: 'self_drive_4wheeler', label: 'Self Drive 4W' },
  { key: 'self_drive_2wheeler', label: 'Self Drive 2W' },
  { key: 'airport_transfer', label: 'Airport Transfer' },
];

const VEHICLE_TYPES: Record<string, string[]> = {
  chauffeur_driven: ['Sedan', 'SUV', 'Tempo Traveller', 'Luxury', 'Mini Bus'],
  self_drive_4wheeler: ['Hatchback', 'Sedan', 'SUV', 'Luxury'],
  self_drive_2wheeler: ['Scooter', 'Motorcycle', 'Cruiser', 'Sports'],
  airport_transfer: ['Sedan', 'SUV', 'Tempo Traveller'],
};

const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic'];

const FUEL_POLICIES = [
  { key: 'full_to_full', label: 'Full to Full' },
  { key: 'included', label: 'Fuel Included' },
  { key: 'pay_per_km', label: 'Pay per Km' },
];

const CANCELLATION_POLICIES = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund up to 24h before' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund up to 48h before' },
  { key: 'strict', label: 'Strict', desc: 'No refund within 7 days' },
];

const MAX_PHOTOS = 6;

// Services priced by the hour / per transfer (hourlyRate required); everything
// else is priced by the day (dailyRate required). Airport transfers reuse the
// hourly/transfer rate to keep the pricing model simple.
const HOURLY_SERVICES = new Set(['chauffeur_driven', 'airport_transfer']);

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleImage {
  /** https URL (existing server image) or a `data:image/...;base64,` URL (new pick). */
  url: string;
  isPrimary: boolean;
  order: number;
}

interface VehicleFormValues {
  // Service & basics
  serviceType: string;
  title: string;
  description: string;
  vehicleType: string;
  // Vehicle details
  make: string;
  model: string;
  year: string;
  fuelType: string;
  transmission: string;
  seatingCapacity: string;
  acAvailable: boolean;
  // Inventory & location
  totalUnits: string;
  city: string;
  state: string;
  // Pricing
  hourlyRate: string;
  minHours: string;
  dailyRate: string;
  perKmRate: string;
  minimumKm: string;
  fuelPolicy: string;
  securityDeposit: string;
  // Policy
  cancellationPolicy: string;
  // Media
  images: VehicleImage[];
}

const EMPTY_VEHICLE: VehicleFormValues = {
  serviceType: 'chauffeur_driven',
  title: '',
  description: '',
  vehicleType: '',
  make: '',
  model: '',
  year: '',
  fuelType: 'Petrol',
  transmission: 'Manual',
  seatingCapacity: '',
  acAvailable: true,
  totalUnits: '1',
  city: '',
  state: '',
  hourlyRate: '',
  minHours: '',
  dailyRate: '',
  perKmRate: '',
  minimumKm: '',
  fuelPolicy: 'full_to_full',
  securityDeposit: '',
  cancellationPolicy: 'flexible',
  images: [],
};

// ─── Payload builder ──────────────────────────────────────────────────────────
// Produces the SAME nested shape the screen sent inline before, plus inline
// images. On create we stamp status:'active'; on edit the status lifecycle is
// owned by the listing screen, so we never send it here.

function buildVehiclePayload(v: VehicleFormValues, mode: 'create' | 'edit') {
  const isTwoWheeler = v.serviceType === 'self_drive_2wheeler';

  const payload: Record<string, any> = {
    serviceType: v.serviceType,
    title: v.title.trim(),
    description: v.description.trim(),
    vehicleType: v.vehicleType,
    vehicleDetails: {
      make: v.make.trim(),
      model: v.model.trim(),
      year: parseInt(v.year, 10) || undefined,
      fuelType: v.fuelType,
      transmission: v.transmission,
      seatingCapacity: parseInt(v.seatingCapacity, 10) || (isTwoWheeler ? 2 : 4),
      acAvailable: v.acAvailable,
    },
    inventory: {
      totalUnits: parseInt(v.totalUnits, 10) || 1,
    },
    location: {
      city: v.city.trim(),
      state: v.state.trim(),
    },
    pricing: {
      hourlyRate: parseFloat(v.hourlyRate) || 0,
      minHours: parseInt(v.minHours, 10) || 0,
      dailyRate: parseFloat(v.dailyRate) || 0,
      perKmRate: parseFloat(v.perKmRate) || 0,
      minimumKm: parseInt(v.minimumKm, 10) || 0,
      fuelPolicy: v.fuelPolicy,
      securityDeposit: parseFloat(v.securityDeposit) || 0,
    },
    cancellationPolicy: v.cancellationPolicy,
    // No dedicated vehicle image-upload endpoint exists, so images ride inline
    // in the body as base64 data URLs (the same approach package images use).
    // The list cards already render images[], so we include them by default.
    images: v.images.map((img, i) => ({
      url: img.url,
      isPrimary: img.isPrimary,
      order: i,
    })),
  };

  if (mode === 'create') payload.status = 'active';

  return payload;
}

// ─── Hydrate form from a loaded vehicle (edit mode) ─────────────────────────────
// Defensive: vehicleDetails / inventory / location / pricing may be partial or
// missing, and images may be string[] or {url, isPrimary, order}[].

function vehicleToFormValues(a: any): VehicleFormValues {
  if (!a) return { ...EMPTY_VEHICLE };

  const vd = a.vehicleDetails || {};
  const inv = a.inventory || {};
  const loc = a.location || {};
  const pr = a.pricing || {};

  const str = (val: any) => (val != null && val !== '' ? String(val) : '');

  const images: VehicleImage[] = (Array.isArray(a.images) ? a.images : [])
    .map((img: any, i: number) => {
      const url = typeof img === 'string' ? img : img?.url;
      if (!url) return null;
      const isObj = img && typeof img === 'object';
      return {
        url,
        isPrimary: isObj && img.isPrimary != null ? !!img.isPrimary : i === 0,
        order: isObj && typeof img.order === 'number' ? img.order : i,
      } as VehicleImage;
    })
    .filter(Boolean) as VehicleImage[];
  // Guarantee exactly one cover among whatever came back.
  if (images.length > 0 && !images.some((im) => im.isPrimary)) images[0].isPrimary = true;

  return {
    serviceType: a.serviceType || 'chauffeur_driven',
    title: a.title || '',
    description: a.description || '',
    vehicleType: a.vehicleType || '',
    make: vd.make || '',
    model: vd.model || '',
    year: str(vd.year),
    fuelType: vd.fuelType || 'Petrol',
    transmission: vd.transmission || 'Manual',
    seatingCapacity: str(vd.seatingCapacity),
    acAvailable: vd.acAvailable != null ? !!vd.acAvailable : true,
    totalUnits: str(inv.totalUnits) || '1',
    city: loc.city || '',
    state: loc.state || '',
    hourlyRate: str(pr.hourlyRate),
    minHours: str(pr.minHours),
    dailyRate: str(pr.dailyRate),
    perKmRate: str(pr.perKmRate),
    minimumKm: str(pr.minimumKm),
    fuelPolicy: pr.fuelPolicy || 'full_to_full',
    securityDeposit: str(pr.securityDeposit),
    cancellationPolicy:
      typeof a.cancellationPolicy === 'string'
        ? a.cancellationPolicy
        : a.cancellationPolicy?.type || 'flexible',
    images,
  };
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={colors.primary[500]} />
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
    </View>
  );
}

// ─── Screen Header (reused across loading / error / form states) ────────────────

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: themeColors.text }]}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ─── Chip Selector ────────────────────────────────────────────────────────────

function ChipSelector({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.chipContainer}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.chip,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              active && styles.chipSelected,
            ]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: themeColors.textSecondary }, active && styles.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VehicleFormScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const mode: 'create' | 'edit' = id ? 'edit' : 'create';
  const headerTitle = mode === 'edit' ? 'Edit Vehicle' : 'List a Vehicle';

  const [values, setValues] = useState<VehicleFormValues>(EMPTY_VEHICLE);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const isLastStep = step === STEPS.length - 1;

  const set = useCallback(
    <K extends keyof VehicleFormValues>(key: K, val: VehicleFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  // ── Edit-mode load ─────────────────────────────────────────────────────────
  // There is no get-by-id endpoint for vehicles, so we pull the vendor's
  // listings and locate this one by _id (matching how the list screen reads).

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await vehicleAPI.getMyVehicleListings();
      const data = res?.data ?? res;
      const list = data?.vehicles || data?.listings || (Array.isArray(data) ? data : []);
      const found = (Array.isArray(list) ? list : []).find(
        (v: any) => (v._id || v.id) === id
      );
      if (!found) {
        setLoadError('Vehicle not found');
      } else {
        setValues(vehicleToFormValues(found));
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load vehicle');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (mode === 'edit') load();
  }, [mode, load]);

  const vehicleTypeOptions = useMemo(
    () => (VEHICLE_TYPES[values.serviceType] || []).map((t) => ({ key: t, label: t })),
    [values.serviceType]
  );

  const isTwoWheeler = values.serviceType === 'self_drive_2wheeler';
  const isHourly = HOURLY_SERVICES.has(values.serviceType);

  const onServiceChange = useCallback((val: string) => {
    setValues((prev) => ({ ...prev, serviceType: val, vehicleType: '' }));
  }, []);

  // ── Photos ───────────────────────────────────────────────────────────────

  const pickPhotos = useCallback(async () => {
    const remaining = MAX_PHOTOS - values.images.length;
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
      // Low quality + base64 keeps the inline payload small (no manipulator dep).
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets) {
      setValues((prev) => {
        const room = MAX_PHOTOS - prev.images.length;
        const incoming = result.assets.slice(0, room).map((asset) =>
          asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri
        );
        const hasPrimary = prev.images.some((im) => im.isPrimary);
        const added: VehicleImage[] = incoming.map((url, i) => ({
          url,
          isPrimary: !hasPrimary && i === 0,
          order: prev.images.length + i,
        }));
        return { ...prev, images: [...prev.images, ...added] };
      });
    }
  }, [values.images.length]);

  const setCoverPhoto = useCallback((index: number) => {
    setValues((prev) => ({
      ...prev,
      images: prev.images.map((im, i) => ({ ...im, isPrimary: i === index })),
    }));
  }, []);

  const removePhoto = useCallback((index: number) => {
    setValues((prev) => {
      const next = prev.images.filter((_, i) => i !== index);
      // Keep exactly one cover among what remains.
      if (next.length > 0 && !next.some((im) => im.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return { ...prev, images: next.map((im, i) => ({ ...im, order: i })) };
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!values.title.trim()) return 'Vehicle title is required';
      if (!values.description.trim()) return 'Description is required';
      if (!values.make.trim()) return 'Make is required';
      if (!values.model.trim()) return 'Model is required';
      if (!values.vehicleType) return 'Please select a vehicle type';
    }
    if (s === 1) {
      if (!values.city.trim()) return 'City is required';
      if (isHourly) {
        if (!values.hourlyRate || isNaN(Number(values.hourlyRate)))
          return 'Valid hourly rate is required';
      } else if (!values.dailyRate || isNaN(Number(values.dailyRate))) {
        return 'Valid daily rate is required';
      }
    }
    return null;
  };

  const validate = (): string | null => {
    for (let s = 0; s < STEPS.length; s++) {
      const err = validateStep(s);
      if (err) return err;
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      Toast.show({ type: 'error', text1: err });
      return;
    }
    if (!isLastStep) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = useCallback(async () => {
    const error = validate();
    if (error) {
      Toast.show({ type: 'error', text1: error });
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildVehiclePayload(values, mode);

      const res =
        mode === 'edit' && id
          ? await vehicleAPI.updateVehicle(id, payload)
          : await vehicleAPI.createVehicle(payload);
      const vehicle = res?.data || res?.vehicle || res;

      // updateVehicle/createVehicle throw on API error, so reaching here on edit
      // is success even if the response body omits the id.
      const ok = mode === 'edit' ? true : !!(vehicle?._id || vehicle?.id);

      if (ok) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Toast.show({
          type: 'success',
          text1: mode === 'edit' ? 'Vehicle updated' : 'Vehicle listed',
          text2:
            mode === 'edit'
              ? 'Your changes are saved.'
              : 'Your vehicle is now live for transport bookings.',
        });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Could not save vehicle', text2: 'Please try again.' });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: mode === 'edit' ? 'Failed to update vehicle' : 'Failed to create vehicle',
        text2: err?.body?.message || err?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [values, mode, id, router]);

  const labelStyle = [styles.label, { color: themeColors.textSecondary }];
  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, color: themeColors.text },
  ];

  // ── Loading / error states (edit mode) ───────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <ScreenHeader title={headerTitle} onBack={() => router.back()} />
        <View style={styles.center}>
          <LoadingSpinner message="Loading vehicle..." />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <ScreenHeader title={headerTitle} onBack={() => router.back()} />
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="alert-circle-outline" size={56} color={colors.gray[300]} />}
            title="Couldn't load vehicle"
            description={loadError}
          />
          <Button title="Retry" onPress={load} variant="outline" size="md" style={styles.retryBtn} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <ScreenHeader title={headerTitle} onBack={goBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ───── Step 0: Vehicle (Service & Basics + Details + Photos) ───── */}
          {step === 0 && (
          <>
          <Card style={styles.formSection}>
            <SectionHeader title="Service Type" icon="car-sport-outline" />
            <ChipSelector options={SERVICE_TYPES} selected={values.serviceType} onSelect={onServiceChange} />

            <RequiredLabel style={labelStyle}>Title</RequiredLabel>
            <RNTextInput
              value={values.title}
              onChangeText={(t) => set('title', t)}
              placeholder="e.g. Toyota Innova Crysta · Bengaluru"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />

            <RequiredLabel style={labelStyle}>Description</RequiredLabel>
            <RNTextInput
              value={values.description}
              onChangeText={(t) => set('description', t)}
              placeholder="Describe the vehicle, condition, perks..."
              placeholderTextColor={themeColors.textTertiary}
              style={[...inputStyle, styles.inputMultiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <RequiredLabel style={labelStyle}>Vehicle Type</RequiredLabel>
            <ChipSelector
              options={vehicleTypeOptions}
              selected={values.vehicleType}
              onSelect={(val) => set('vehicleType', val === values.vehicleType ? '' : val)}
            />
          </Card>

          {/* Vehicle Details */}
          <Card style={styles.formSection}>
            <SectionHeader title="Vehicle Details" icon="construct-outline" />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <RequiredLabel style={labelStyle}>Make</RequiredLabel>
                <RNTextInput
                  value={values.make}
                  onChangeText={(t) => set('make', t)}
                  placeholder="e.g. Toyota"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />
              </View>
              <View style={styles.halfField}>
                <RequiredLabel style={labelStyle}>Model</RequiredLabel>
                <RNTextInput
                  value={values.model}
                  onChangeText={(t) => set('model', t)}
                  placeholder="e.g. Innova"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Year</Text>
                <RNTextInput
                  value={values.year}
                  onChangeText={(t) => set('year', t)}
                  placeholder="e.g. 2022"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>{isTwoWheeler ? 'Seats' : 'Seating Capacity'}</Text>
                <RNTextInput
                  value={values.seatingCapacity}
                  onChangeText={(t) => set('seatingCapacity', t)}
                  placeholder={isTwoWheeler ? '2' : 'e.g. 7'}
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={labelStyle}>Fuel Type</Text>
            <ChipSelector
              options={FUEL_TYPES.map((f) => ({ key: f, label: f }))}
              selected={values.fuelType}
              onSelect={(val) => set('fuelType', val)}
            />

            <Text style={labelStyle}>Transmission</Text>
            <ChipSelector
              options={TRANSMISSIONS.map((t) => ({ key: t, label: t }))}
              selected={values.transmission}
              onSelect={(val) => set('transmission', val)}
            />

            {!isTwoWheeler ? (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => set('acAvailable', !values.acAvailable)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={values.acAvailable ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={values.acAvailable ? colors.primary[500] : themeColors.textTertiary}
                />
                <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>Air conditioning available</Text>
              </TouchableOpacity>
            ) : null}
          </Card>

          {/* Photos */}
          <Card style={styles.formSection}>
            <SectionHeader title="Photos" icon="camera-outline" />
            <Text style={[styles.photoHint, { color: themeColors.textTertiary }]}>
              Add up to {MAX_PHOTOS} photos. The cover photo shows on your listing card.
            </Text>

            <View style={styles.photoGrid}>
              {values.images.map((img, index) => (
                <View key={`${img.url.slice(0, 24)}-${index}`} style={styles.photoThumb}>
                  <Image source={{ uri: img.url }} style={styles.photoImg} contentFit="cover" transition={120} />

                  {img.isPrimary ? (
                    <View style={styles.coverBadge}>
                      <Ionicons name="star" size={9} color="#ffffff" />
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.setCoverBtn}
                      onPress={() => setCoverPhoto(index)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.setCoverText}>Set cover</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(index)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={13} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}

              {values.images.length < MAX_PHOTOS ? (
                <TouchableOpacity
                  style={[styles.addPhoto, { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
                  onPress={pickPhotos}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={26} color={colors.primary[500]} />
                  <Text style={[styles.addPhotoText, { color: themeColors.textSecondary }]}>Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
          </>
          )}

          {/* ───── Step 1: Pricing (Inventory & Location + Pricing) ───── */}
          {step === 1 && (
          <>
          <Card style={styles.formSection}>
            <SectionHeader title="Inventory & Location" icon="location-outline" />

            <Text style={labelStyle}>Total Units Available</Text>
            <RNTextInput
              value={values.totalUnits}
              onChangeText={(t) => set('totalUnits', t)}
              placeholder="1"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
              keyboardType="numeric"
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <RequiredLabel style={labelStyle}>City</RequiredLabel>
                <RNTextInput
                  value={values.city}
                  onChangeText={(t) => set('city', t)}
                  placeholder="e.g. Bengaluru"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>State</Text>
                <RNTextInput
                  value={values.state}
                  onChangeText={(t) => set('state', t)}
                  placeholder="e.g. Karnataka"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />
              </View>
            </View>
          </Card>

          {/* Pricing */}
          <Card style={styles.formSection}>
            <SectionHeader title="Pricing" icon="pricetag-outline" />

            <View style={styles.row}>
              <View style={styles.halfField}>
                {isHourly ? (
                  <RequiredLabel style={labelStyle}>Hourly Rate ({'₹'})</RequiredLabel>
                ) : (
                  <Text style={labelStyle}>Hourly Rate ({'₹'})</Text>
                )}
                <RNTextInput
                  value={values.hourlyRate}
                  onChangeText={(t) => set('hourlyRate', t)}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Min Hours</Text>
                <RNTextInput
                  value={values.minHours}
                  onChangeText={(t) => set('minHours', t)}
                  placeholder="e.g. 4"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                {!isHourly ? (
                  <RequiredLabel style={labelStyle}>Daily Rate ({'₹'})</RequiredLabel>
                ) : (
                  <Text style={labelStyle}>Daily Rate ({'₹'})</Text>
                )}
                <RNTextInput
                  value={values.dailyRate}
                  onChangeText={(t) => set('dailyRate', t)}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Per Km Rate ({'₹'})</Text>
                <RNTextInput
                  value={values.perKmRate}
                  onChangeText={(t) => set('perKmRate', t)}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Minimum Km</Text>
                <RNTextInput
                  value={values.minimumKm}
                  onChangeText={(t) => set('minimumKm', t)}
                  placeholder="e.g. 250"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Security Deposit ({'₹'})</Text>
                <RNTextInput
                  value={values.securityDeposit}
                  onChangeText={(t) => set('securityDeposit', t)}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={labelStyle}>Fuel Policy</Text>
            <ChipSelector options={FUEL_POLICIES} selected={values.fuelPolicy} onSelect={(val) => set('fuelPolicy', val)} />
          </Card>
          </>
          )}

          {/* ───── Step 2: Policies (Cancellation) ───── */}
          {step === 2 && (
          <Card style={styles.formSection}>
            <SectionHeader title="Cancellation Policy" icon="shield-checkmark-outline" />
            {CANCELLATION_POLICIES.map((policy) => (
              <TouchableOpacity
                key={policy.key}
                style={[
                  styles.policyOption,
                  { borderBottomColor: themeColors.border },
                  values.cancellationPolicy === policy.key && styles.policyOptionSelected,
                ]}
                onPress={() => set('cancellationPolicy', policy.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={values.cancellationPolicy === policy.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={values.cancellationPolicy === policy.key ? colors.primary[500] : themeColors.textTertiary}
                />
                <View style={styles.policyText}>
                  <Text style={[styles.policyLabel, { color: themeColors.text }]}>{policy.label}</Text>
                  <Text style={[styles.policyDesc, { color: themeColors.textSecondary }]}>{policy.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
          )}

          {/* Navigation / Actions */}
          {isLastStep ? (
            <View style={styles.actionsRow}>
              <Button
                title="Back"
                onPress={goBack}
                variant="outline"
                size="lg"
                style={styles.actionBtn}
              />
              <Button
                title={mode === 'edit' ? 'Save Changes' : 'List Vehicle'}
                onPress={handleSubmit}
                size="lg"
                loading={submitting}
                style={styles.actionBtn}
                icon={<Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />}
              />
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <Button
                title="Back"
                onPress={goBack}
                variant="outline"
                size="lg"
                style={styles.actionBtn}
              />
              <Button title="Next" onPress={goNext} size="lg" style={styles.actionBtn} />
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  retryBtn: {
    marginTop: spacing.lg,
    minWidth: 140,
  },
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
  headerSpacer: {
    width: 36,
  },
  stepperWrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    padding: spacing.xl,
  },

  // Form Sections
  formSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Labels & Inputs
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
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
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkboxLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },

  // Photos
  photoHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  photoGrid: {
    gap: spacing.md,
  },
  photoThumb: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  setCoverBtn: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  setCoverText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  addPhoto: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },

  // Policy
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
  policyText: {
    flex: 1,
  },
  policyLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  policyDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  actionBtn: {
    flex: 1,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
