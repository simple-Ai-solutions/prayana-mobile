import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Stepper,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { vehicleAPI } from '@prayana/shared-services';

// ─── Wizard steps ───────────────────────────────────────────────────────────────

const STEPS = ['Vehicle', 'Pricing', 'Policies'];

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: 'chauffeur_driven', label: 'Chauffeur' },
  { key: 'self_drive_4wheeler', label: 'Self Drive 4W' },
  { key: 'self_drive_2wheeler', label: 'Self Drive 2W' },
];

const VEHICLE_TYPES: Record<string, string[]> = {
  chauffeur_driven: ['Sedan', 'SUV', 'Tempo Traveller', 'Luxury', 'Mini Bus'],
  self_drive_4wheeler: ['Hatchback', 'Sedan', 'SUV', 'Luxury'],
  self_drive_2wheeler: ['Scooter', 'Motorcycle', 'Cruiser', 'Sports'],
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

export default function NewVehicleScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  // Service & basics
  const [serviceType, setServiceType] = useState('chauffeur_driven');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vehicleType, setVehicleType] = useState('');

  // Vehicle details
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuelType, setFuelType] = useState('Petrol');
  const [transmission, setTransmission] = useState('Manual');
  const [seatingCapacity, setSeatingCapacity] = useState('');
  const [acAvailable, setAcAvailable] = useState(true);

  // Inventory & location
  const [totalUnits, setTotalUnits] = useState('1');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Pricing
  const [hourlyRate, setHourlyRate] = useState('');
  const [minHours, setMinHours] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [minimumKm, setMinimumKm] = useState('');
  const [fuelPolicy, setFuelPolicy] = useState('full_to_full');
  const [securityDeposit, setSecurityDeposit] = useState('');

  // Policy
  const [cancellationPolicy, setCancellationPolicy] = useState('flexible');

  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const isLastStep = step === STEPS.length - 1;

  const vehicleTypeOptions = useMemo(
    () => (VEHICLE_TYPES[serviceType] || []).map((t) => ({ key: t, label: t })),
    [serviceType]
  );

  const isTwoWheeler = serviceType === 'self_drive_2wheeler';

  const onServiceChange = useCallback((val: string) => {
    setServiceType(val);
    setVehicleType('');
  }, []);

  // Per-step validation — returns an error for the given step, or null.
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!title.trim()) return 'Vehicle title is required';
      if (!description.trim()) return 'Description is required';
      if (!make.trim()) return 'Make is required';
      if (!model.trim()) return 'Model is required';
      if (!vehicleType) return 'Please select a vehicle type';
    }
    if (s === 1) {
      if (!city.trim()) return 'City is required';
      if (serviceType === 'chauffeur_driven') {
        if (!hourlyRate || isNaN(Number(hourlyRate))) return 'Valid hourly rate is required';
      } else if (!dailyRate || isNaN(Number(dailyRate))) {
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
      const payload = {
        serviceType,
        title: title.trim(),
        description: description.trim(),
        vehicleType,
        vehicleDetails: {
          make: make.trim(),
          model: model.trim(),
          year: Number(year) || undefined,
          fuelType,
          transmission,
          seatingCapacity: Number(seatingCapacity) || (isTwoWheeler ? 2 : 4),
          acAvailable,
        },
        inventory: {
          totalUnits: Number(totalUnits) || 1,
        },
        location: {
          city: city.trim(),
          state: state.trim(),
        },
        pricing: {
          hourlyRate: Number(hourlyRate) || 0,
          minHours: Number(minHours) || 0,
          dailyRate: Number(dailyRate) || 0,
          perKmRate: Number(perKmRate) || 0,
          minimumKm: Number(minimumKm) || 0,
          fuelPolicy,
          securityDeposit: Number(securityDeposit) || 0,
        },
        cancellationPolicy,
        status: 'active',
      };

      const res = await vehicleAPI.createVehicle(payload);
      const vehicle = res?.data || res?.vehicle || res;

      if (vehicle?._id || vehicle?.id) {
        Toast.show({
          type: 'success',
          text1: 'Vehicle listed',
          text2: 'Your vehicle is now live for transport bookings.',
        });
        router.back();
      } else {
        Toast.show({ type: 'error', text1: 'Could not create vehicle', text2: 'Please try again.' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to create vehicle', text2: err?.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [
    serviceType, title, description, vehicleType, make, model, year, fuelType,
    transmission, seatingCapacity, acAvailable, totalUnits, city, state,
    hourlyRate, minHours, dailyRate, perKmRate, minimumKm, fuelPolicy,
    securityDeposit, cancellationPolicy, isTwoWheeler, router,
  ]);

  const labelStyle = [styles.label, { color: themeColors.textSecondary }];
  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>New Vehicle</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Wizard progress */}
      <View style={[styles.stepperWrap, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <Stepper steps={STEPS} currentStep={step} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ───── Step 0: Vehicle (Service & Basics + Details) ───── */}
          {step === 0 && (
          <>
          <Card style={styles.formSection}>
            <SectionHeader title="Service Type" icon="car-sport-outline" />
            <ChipSelector options={SERVICE_TYPES} selected={serviceType} onSelect={onServiceChange} />

            <Text style={labelStyle}>Title *</Text>
            <RNTextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Toyota Innova Crysta · Bengaluru"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />

            <Text style={labelStyle}>Description *</Text>
            <RNTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the vehicle, condition, perks..."
              placeholderTextColor={themeColors.textTertiary}
              style={[...inputStyle, styles.inputMultiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={labelStyle}>Vehicle Type *</Text>
            <ChipSelector
              options={vehicleTypeOptions}
              selected={vehicleType}
              onSelect={(val) => setVehicleType(val === vehicleType ? '' : val)}
            />
          </Card>

          {/* Vehicle Details */}
          <Card style={styles.formSection}>
            <SectionHeader title="Vehicle Details" icon="construct-outline" />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Make *</Text>
                <RNTextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="e.g. Toyota"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Model *</Text>
                <RNTextInput
                  value={model}
                  onChangeText={setModel}
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
                  value={year}
                  onChangeText={setYear}
                  placeholder="e.g. 2022"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>{isTwoWheeler ? 'Seats' : 'Seating Capacity'}</Text>
                <RNTextInput
                  value={seatingCapacity}
                  onChangeText={setSeatingCapacity}
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
              selected={fuelType}
              onSelect={setFuelType}
            />

            <Text style={labelStyle}>Transmission</Text>
            <ChipSelector
              options={TRANSMISSIONS.map((t) => ({ key: t, label: t }))}
              selected={transmission}
              onSelect={setTransmission}
            />

            {!isTwoWheeler ? (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAcAvailable(!acAvailable)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={acAvailable ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={acAvailable ? colors.primary[500] : themeColors.textTertiary}
                />
                <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>Air conditioning available</Text>
              </TouchableOpacity>
            ) : null}
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
              value={totalUnits}
              onChangeText={setTotalUnits}
              placeholder="1"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
              keyboardType="numeric"
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>City *</Text>
                <RNTextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Bengaluru"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>State</Text>
                <RNTextInput
                  value={state}
                  onChangeText={setState}
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
                <Text style={labelStyle}>Hourly Rate ({'₹'})</Text>
                <RNTextInput
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Min Hours</Text>
                <RNTextInput
                  value={minHours}
                  onChangeText={setMinHours}
                  placeholder="e.g. 4"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Daily Rate ({'₹'})</Text>
                <RNTextInput
                  value={dailyRate}
                  onChangeText={setDailyRate}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Per Km Rate ({'₹'})</Text>
                <RNTextInput
                  value={perKmRate}
                  onChangeText={setPerKmRate}
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
                  value={minimumKm}
                  onChangeText={setMinimumKm}
                  placeholder="e.g. 250"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Security Deposit ({'₹'})</Text>
                <RNTextInput
                  value={securityDeposit}
                  onChangeText={setSecurityDeposit}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={labelStyle}>Fuel Policy</Text>
            <ChipSelector options={FUEL_POLICIES} selected={fuelPolicy} onSelect={setFuelPolicy} />
          </Card>
          </>
          )}

          {/* ───── Step 2: Policies (Cancellation + review) ───── */}
          {step === 2 && (
          <Card style={styles.formSection}>
            <SectionHeader title="Cancellation Policy" icon="shield-checkmark-outline" />
            {CANCELLATION_POLICIES.map((policy) => (
              <TouchableOpacity
                key={policy.key}
                style={[
                  styles.policyOption,
                  { borderBottomColor: themeColors.border },
                  cancellationPolicy === policy.key && styles.policyOptionSelected,
                ]}
                onPress={() => setCancellationPolicy(policy.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cancellationPolicy === policy.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={cancellationPolicy === policy.key ? colors.primary[500] : themeColors.textTertiary}
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
                title="List Vehicle"
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
  actions: {
    marginTop: spacing.xl,
  },
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
