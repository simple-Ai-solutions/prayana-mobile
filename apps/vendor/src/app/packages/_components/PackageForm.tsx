import React, { useState, useCallback } from 'react';
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
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { packageAPI } from '@prayana/shared-services';

// ─── Constants ────────────────────────────────────────────────────────────────

const PACKAGE_TYPES = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'flexible', label: 'Flexible' },
];

const CATEGORIES = [
  'Adventure',
  'Honeymoon',
  'Family',
  'Pilgrimage',
  'Wildlife',
  'Beach',
  'Hill Station',
  'Heritage',
  'Luxury',
  'Budget',
];

const PRICE_TYPES = [
  { key: 'per_person', label: 'Per Person' },
  { key: 'per_group', label: 'Per Group' },
];

const MEAL_PLANS = [
  { key: 'none', label: 'No Meals' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'half_board', label: 'Half Board' },
  { key: 'full_board', label: 'Full Board' },
];

const HOTEL_CATEGORIES = [
  { key: '3_star', label: '3 Star' },
  { key: '4_star', label: '4 Star' },
  { key: '5_star', label: '5 Star' },
  { key: 'budget', label: 'Budget' },
  { key: 'homestay', label: 'Homestay' },
];

const CANCELLATION_TYPES = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund up to 7 days before' },
  { key: 'moderate', label: 'Moderate', desc: 'Partial refund up to 15 days before' },
  { key: 'strict', label: 'Strict', desc: 'No refund within 30 days' },
];

const MAX_CATEGORIES = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DestinationDraft = {
  name: string;
  city: string;
  state: string;
};

export type PackageFormValues = {
  title: string;
  shortDescription: string;
  description: string;
  packageType: string;
  categories: string[];
  nights: string;
  destinations: DestinationDraft[];
  variantName: string;
  basePrice: string;
  priceType: string;
  mealPlan: string;
  hotelCategory: string;
  inclusions: string[];
  exclusions: string[];
  cancellationType: string;
};

export const EMPTY_PACKAGE: PackageFormValues = {
  title: '',
  shortDescription: '',
  description: '',
  packageType: 'fixed',
  categories: [],
  nights: '',
  destinations: [{ name: '', city: '', state: '' }],
  variantName: 'Standard',
  basePrice: '',
  priceType: 'per_person',
  mealPlan: 'breakfast',
  hotelCategory: '3_star',
  inclusions: [],
  exclusions: [],
  cancellationType: 'moderate',
};

// ─── Payload Builder (web-compatible shape) ─────────────────────────────────────

export function buildPackagePayload(v: PackageFormValues) {
  const nights = Number(v.nights) || 0;
  const destinations = v.destinations
    .filter((d) => d.name.trim() || d.city.trim())
    .map((d) => ({
      name: d.name.trim() || d.city.trim(),
      city: d.city.trim(),
      state: d.state.trim(),
      country: 'India',
    }));

  return {
    title: v.title.trim(),
    shortDescription: v.shortDescription.trim(),
    description: v.description.trim(),
    packageType: v.packageType,
    category: v.categories,
    primaryDestination: destinations[0]?.name || destinations[0]?.city || '',
    duration: {
      nights,
      days: nights > 0 ? nights + 1 : 1,
    },
    destinations,
    variants: [
      {
        name: v.variantName.trim() || 'Standard',
        pricing: {
          basePrice: Number(v.basePrice) || 0,
          priceType: v.priceType,
          currency: 'INR',
        },
        mealPlan: v.mealPlan,
        hotelCategory: v.hotelCategory,
      },
    ],
    inclusions: v.inclusions,
    exclusions: v.exclusions,
    cancellationPolicy: {
      type: v.cancellationType,
    },
  };
}

// ─── Hydrate form from an existing package (edit) ───────────────────────────────

export function packageToFormValues(pkg: any): PackageFormValues {
  if (!pkg) return { ...EMPTY_PACKAGE };
  const variant = Array.isArray(pkg.variants) && pkg.variants.length > 0 ? pkg.variants[0] : {};
  const pricing = variant.pricing || {};
  const dests: DestinationDraft[] =
    Array.isArray(pkg.destinations) && pkg.destinations.length > 0
      ? pkg.destinations.map((d: any) => ({
          name: d?.name || '',
          city: d?.city || '',
          state: d?.state || '',
        }))
      : [{ name: '', city: '', state: '' }];

  const categories: string[] = Array.isArray(pkg.category)
    ? pkg.category
    : pkg.category
    ? [pkg.category]
    : [];

  return {
    title: pkg.title || '',
    shortDescription: pkg.shortDescription || '',
    description: pkg.description || '',
    packageType: pkg.packageType || 'fixed',
    categories: categories.slice(0, MAX_CATEGORIES),
    nights: pkg.duration?.nights != null ? String(pkg.duration.nights) : '',
    destinations: dests,
    variantName: variant.name || 'Standard',
    basePrice: pricing.basePrice != null ? String(pricing.basePrice) : '',
    priceType: pricing.priceType || 'per_person',
    mealPlan: variant.mealPlan || 'breakfast',
    hotelCategory: variant.hotelCategory || '3_star',
    inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
    exclusions: Array.isArray(pkg.exclusions) ? pkg.exclusions : [],
    cancellationType: pkg.cancellationPolicy?.type || 'moderate',
  };
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={colors.primary[500]} />
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
    </View>
  );
}

// ─── Segmented Selector ─────────────────────────────────────────────────────────

function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border }]}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, { color: themeColors.textSecondary }, active && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Chip Selector (multi) ──────────────────────────────────────────────────────

function ChipSelector({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.chipContainer}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.chip,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              isSelected && styles.chipSelected,
            ]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: themeColors.textSecondary }, isSelected && styles.chipTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── List Editor ────────────────────────────────────────────────────────────────

function ListEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (val: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const { themeColors } = useTheme();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const val = input.trim();
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput('');
    }
  };

  return (
    <View>
      <View style={styles.listEditorInput}>
        <RNTextInput
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          style={[
            styles.listEditorTextInput,
            { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text },
          ]}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.listEditorAddBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
      {items.length > 0 && (
        <View style={styles.listEditorItems}>
          {items.map((item, i) => (
            <View key={`${item}-${i}`} style={[styles.listEditorItem, { backgroundColor: themeColors.inputBackground }]}>
              <Text style={[styles.listEditorItemText, { color: themeColors.text }]}>{item}</Text>
              <TouchableOpacity onPress={() => onRemove(i)}>
                <Ionicons name="close-circle" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Form ──────────────────────────────────────────────────────────────────

export default function PackageForm({
  mode,
  initialValues,
  headerTitle,
  packageId,
}: {
  mode: 'create' | 'edit';
  initialValues: PackageFormValues;
  headerTitle: string;
  packageId?: string;
}) {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [values, setValues] = useState<PackageFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const set = useCallback(<K extends keyof PackageFormValues>(key: K, val: PackageFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setValues((prev) => {
      if (prev.categories.includes(cat)) {
        return { ...prev, categories: prev.categories.filter((c) => c !== cat) };
      }
      if (prev.categories.length >= MAX_CATEGORIES) {
        Toast.show({ type: 'info', text1: `Up to ${MAX_CATEGORIES} categories` });
        return prev;
      }
      return { ...prev, categories: [...prev.categories, cat] };
    });
  }, []);

  const updateDestination = useCallback((index: number, field: keyof DestinationDraft, val: string) => {
    setValues((prev) => {
      const next = prev.destinations.map((d, i) => (i === index ? { ...d, [field]: val } : d));
      return { ...prev, destinations: next };
    });
  }, []);

  const addDestination = useCallback(() => {
    setValues((prev) => ({ ...prev, destinations: [...prev.destinations, { name: '', city: '', state: '' }] }));
  }, []);

  const removeDestination = useCallback((index: number) => {
    setValues((prev) => {
      if (prev.destinations.length <= 1) return prev;
      return { ...prev, destinations: prev.destinations.filter((_, i) => i !== index) };
    });
  }, []);

  const validate = (): string | null => {
    if (!values.title.trim()) return 'Package title is required';
    if (values.categories.length === 0) return 'Select at least one category';
    if (!values.nights || isNaN(Number(values.nights))) return 'Valid number of nights is required';
    const hasDestination = values.destinations.some((d) => d.name.trim() || d.city.trim());
    if (!hasDestination) return 'At least one destination is required';
    if (!values.basePrice || isNaN(Number(values.basePrice))) return 'Valid base price is required';
    return null;
  };

  const handleSave = useCallback(
    async (submitAfter: boolean) => {
      const error = validate();
      if (error) {
        Toast.show({ type: 'error', text1: error });
        return;
      }

      const setLoading = submitAfter ? setSubmitting : setSavingDraft;
      setLoading(true);

      try {
        const payload = buildPackagePayload(values);
        let saved: any;

        if (mode === 'edit' && packageId) {
          const res = await packageAPI.updatePackage(packageId, payload);
          saved = res?.data ?? res;
        } else {
          const res = await packageAPI.createPackage(payload);
          saved = res?.data ?? res;
        }

        const savedId = saved?._id || saved?.id || packageId;

        if (submitAfter && savedId) {
          await packageAPI.submitForApproval(savedId);
        }

        Toast.show({
          type: 'success',
          text1:
            mode === 'edit'
              ? submitAfter
                ? 'Updated & submitted for review'
                : 'Package updated'
              : submitAfter
              ? 'Submitted for review'
              : 'Draft saved',
          text2: submitAfter
            ? 'Our team will review your package shortly.'
            : 'You can edit and submit it later.',
        });
        router.back();
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: mode === 'edit' ? 'Failed to update package' : 'Failed to create package',
          text2: err?.message || 'Please try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [values, mode, packageId, router],
  );

  const labelStyle = [styles.label, { color: themeColors.textSecondary }];
  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border, color: themeColors.text },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <Card style={styles.formSection}>
            <SectionHeader title="Basic Info" icon="information-circle-outline" />

            <Text style={labelStyle}>Package Title *</Text>
            <RNTextInput
              value={values.title}
              onChangeText={(t) => set('title', t)}
              placeholder="e.g. Magical Kerala Backwaters"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />

            <Text style={labelStyle}>Short Description</Text>
            <RNTextInput
              value={values.shortDescription}
              onChangeText={(t) => set('shortDescription', t)}
              placeholder="One-line summary travellers will see first"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />

            <Text style={labelStyle}>Description</Text>
            <RNTextInput
              value={values.description}
              onChangeText={(t) => set('description', t)}
              placeholder="Describe the package, itinerary highlights, experience..."
              placeholderTextColor={themeColors.textTertiary}
              style={[...inputStyle, styles.inputMultiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={labelStyle}>Package Type</Text>
            <Segmented
              options={PACKAGE_TYPES}
              selected={values.packageType}
              onSelect={(k) => set('packageType', k)}
            />

            <Text style={labelStyle}>
              Categories * ({values.categories.length}/{MAX_CATEGORIES})
            </Text>
            <ChipSelector options={CATEGORIES} selected={values.categories} onToggle={toggleCategory} />
          </Card>

          {/* Duration & Destinations */}
          <Card style={styles.formSection}>
            <SectionHeader title="Duration & Destinations" icon="map-outline" />

            <Text style={labelStyle}>Number of Nights *</Text>
            <RNTextInput
              value={values.nights}
              onChangeText={(t) => set('nights', t)}
              placeholder="e.g. 4"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
              keyboardType="numeric"
            />

            <Text style={labelStyle}>Destinations *</Text>
            {values.destinations.map((dest, index) => (
              <View key={index} style={[styles.destCard, { borderColor: themeColors.border, backgroundColor: themeColors.inputBackground }]}>
                <View style={styles.destHeader}>
                  <Text style={[styles.destLabel, { color: themeColors.textSecondary }]}>
                    Destination {index + 1}
                  </Text>
                  {values.destinations.length > 1 && (
                    <TouchableOpacity onPress={() => removeDestination(index)}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <RNTextInput
                  value={dest.name}
                  onChangeText={(t) => updateDestination(index, 'name', t)}
                  placeholder="Place name (e.g. Alleppey)"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[inputStyle, styles.destInput]}
                />
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <RNTextInput
                      value={dest.city}
                      onChangeText={(t) => updateDestination(index, 'city', t)}
                      placeholder="City"
                      placeholderTextColor={themeColors.textTertiary}
                      style={[inputStyle, styles.destInput]}
                    />
                  </View>
                  <View style={styles.halfField}>
                    <RNTextInput
                      value={dest.state}
                      onChangeText={(t) => updateDestination(index, 'state', t)}
                      placeholder="State"
                      placeholderTextColor={themeColors.textTertiary}
                      style={[inputStyle, styles.destInput]}
                    />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addRowBtn} onPress={addDestination} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.addRowText}>Add destination</Text>
            </TouchableOpacity>
          </Card>

          {/* Pricing & Inclusions */}
          <Card style={styles.formSection}>
            <SectionHeader title="Pricing & Plan" icon="pricetag-outline" />

            <Text style={labelStyle}>Variant Name</Text>
            <RNTextInput
              value={values.variantName}
              onChangeText={(t) => set('variantName', t)}
              placeholder="e.g. Standard"
              placeholderTextColor={themeColors.textTertiary}
              style={inputStyle}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Base Price ({'₹'}) *</Text>
                <RNTextInput
                  value={values.basePrice}
                  onChangeText={(t) => set('basePrice', t)}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={inputStyle}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={labelStyle}>Price Type</Text>
                <Segmented
                  options={PRICE_TYPES}
                  selected={values.priceType}
                  onSelect={(k) => set('priceType', k)}
                />
              </View>
            </View>

            <Text style={labelStyle}>Meal Plan</Text>
            <ChipSelector
              options={MEAL_PLANS.map((m) => m.label)}
              selected={[MEAL_PLANS.find((m) => m.key === values.mealPlan)?.label || '']}
              onToggle={(label) => {
                const found = MEAL_PLANS.find((m) => m.label === label);
                if (found) set('mealPlan', found.key);
              }}
            />

            <Text style={labelStyle}>Hotel Category</Text>
            <ChipSelector
              options={HOTEL_CATEGORIES.map((h) => h.label)}
              selected={[HOTEL_CATEGORIES.find((h) => h.key === values.hotelCategory)?.label || '']}
              onToggle={(label) => {
                const found = HOTEL_CATEGORIES.find((h) => h.label === label);
                if (found) set('hotelCategory', found.key);
              }}
            />

            <Text style={labelStyle}>Inclusions</Text>
            <ListEditor
              items={values.inclusions}
              onAdd={(val) => set('inclusions', [...values.inclusions, val])}
              onRemove={(i) => set('inclusions', values.inclusions.filter((_, idx) => idx !== i))}
              placeholder="e.g. Daily breakfast"
            />

            <Text style={labelStyle}>Exclusions</Text>
            <ListEditor
              items={values.exclusions}
              onAdd={(val) => set('exclusions', [...values.exclusions, val])}
              onRemove={(i) => set('exclusions', values.exclusions.filter((_, idx) => idx !== i))}
              placeholder="e.g. Airfare"
            />
          </Card>

          {/* Cancellation Policy */}
          <Card style={styles.formSection}>
            <SectionHeader title="Cancellation Policy" icon="shield-checkmark-outline" />
            {CANCELLATION_TYPES.map((policy) => {
              const active = values.cancellationType === policy.key;
              return (
                <TouchableOpacity
                  key={policy.key}
                  style={[
                    styles.policyOption,
                    { borderBottomColor: themeColors.border },
                    active && styles.policyOptionSelected,
                  ]}
                  onPress={() => set('cancellationType', policy.key)}
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
          </Card>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={mode === 'edit' ? 'Save Changes' : 'Save as Draft'}
              onPress={() => handleSave(false)}
              variant="outline"
              size="lg"
              loading={savingDraft}
              disabled={submitting}
              style={styles.actionBtn}
            />
            <Button
              title={mode === 'edit' ? 'Save & Submit' : 'Submit for Review'}
              onPress={() => handleSave(true)}
              size="lg"
              loading={submitting}
              disabled={savingDraft}
              style={styles.actionBtn}
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

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
  scrollContent: { padding: spacing.xl },

  formSection: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },

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
  inputMultiline: { minHeight: 100, paddingTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  halfField: { flex: 1 },

  // Segmented
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary[500] },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  segmentTextActive: { color: '#ffffff', fontWeight: fontWeight.semibold },

  // Chips
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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

  // Destinations
  destCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundSecondary,
  },
  destHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  destLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  destInput: { marginBottom: spacing.sm },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  addRowText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[500] },

  // List Editor
  listEditorInput: { flexDirection: 'row', gap: spacing.sm },
  listEditorTextInput: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  listEditorAddBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  listEditorItems: { marginTop: spacing.sm, gap: spacing.xs },
  listEditorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  listEditorItemText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },

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
  policyText: { flex: 1 },
  policyLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  policyDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Actions
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  actionBtn: { flex: 1 },
  bottomSpacer: { height: spacing['3xl'] },
});
