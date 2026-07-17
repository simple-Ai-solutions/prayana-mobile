import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Badge,
  EmptyState,
  TextInput,
  useTheme,
} from '@prayana/shared-ui';
import { Button, LoadingSpinner } from '../../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import { variantAPI } from '@prayana/shared-services';

// ============================================================
// Types — server variant supports both the new nested shape
// (pricing/capacity) and the legacy flat shape (pricePerPerson…)
// ============================================================
type VariantPricing = {
  basePrice?: number;
  priceModifier?: number;
  childPrice?: number;
  priceType?: 'per_person' | 'per_group';
  currency?: string;
};

type Variant = {
  _id: string;
  name: string;
  customName?: string;
  displayName?: string;
  description?: string;
  highlights?: string[];
  pricing?: VariantPricing;
  capacity?: { min?: number; max?: number };
  includes?: string[];
  excludes?: string[];
  bookingCount?: number;
  isFeatured?: boolean;
  isAvailable?: boolean;
  // Legacy flat shape
  tier?: 'standard' | 'vip' | 'private' | string;
  pricePerPerson?: number;
  pricePerGroup?: number;
  minParticipants?: number;
  maxParticipants?: number;
  inclusions?: string[];
};

type VariantForm = {
  name: string;
  customName: string;
  description: string;
  highlights: string[];
  basePrice: string;
  priceModifier: string;
  childPrice: string;
  priceType: 'per_person' | 'per_group';
  minCapacity: string;
  maxCapacity: string;
  includes: string[];
  excludes: string[];
};

type ArrayFieldName = 'highlights' | 'includes' | 'excludes';

const VARIANT_TYPES = ['Standard', 'VIP', 'Private', 'Deluxe', 'Premium', 'Budget', 'Custom'];

const TIER_TO_NAME: Record<string, string> = {
  standard: 'Standard',
  vip: 'VIP',
  private: 'Private',
};

const CURRENCY = 'INR';
const DEFAULT_BASE_PRICE = 500;

const makeDefaultForm = (): VariantForm => ({
  name: 'Standard',
  customName: '',
  description: '',
  highlights: [''],
  basePrice: String(DEFAULT_BASE_PRICE),
  priceModifier: '1.0',
  childPrice: String(Math.round(DEFAULT_BASE_PRICE * 0.7)),
  priceType: 'per_person',
  minCapacity: '1',
  maxCapacity: '10',
  includes: [''],
  excludes: [''],
});

// Pad an empty/missing array back to [''] so the editor always shows one row.
const padArray = (arr?: string[]): string[] => (arr && arr.length > 0 ? [...arr] : ['']);

// ── Shape-tolerant readers (new pricing.* shape, legacy flat fallback) ──
const getBasePrice = (v: Variant) => v.pricing?.basePrice ?? v.pricePerPerson ?? 0;
const getPriceModifier = (v: Variant) => v.pricing?.priceModifier ?? 1;
const getPriceType = (v: Variant): 'per_person' | 'per_group' =>
  v.pricing?.priceType === 'per_group' ? 'per_group' : 'per_person';
const getCapacityMin = (v: Variant) => v.capacity?.min ?? v.minParticipants ?? 1;
const getCapacityMax = (v: Variant) => v.capacity?.max ?? v.maxParticipants ?? 10;
const getIncludes = (v: Variant) =>
  v.includes && v.includes.length > 0 ? v.includes : v.inclusions || [];

const getVariantIcon = (name: string): React.ComponentProps<typeof Ionicons>['name'] => {
  switch (name) {
    case 'VIP':
    case 'Premium':
    case 'Deluxe':
      return 'diamond';
    case 'Private':
      return 'people';
    case 'Standard':
    case 'Budget':
      return 'cube';
    default:
      return 'star';
  }
};

export default function VariantsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [form, setForm] = useState<VariantForm>(makeDefaultForm());

  // ── Fetch ───────────────────────────────────────────────
  const fetchVariants = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await variantAPI.getActivityVariants(id, true);
      const data = res?.success ? res.data : res?.data || res;
      setVariants(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('[Variants] fetch failed:', err?.message);
      Toast.show({ type: 'error', text1: 'Failed to load variants', text2: err?.message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  // ── Quick setup (bulk template) ─────────────────────────
  const quickSetup = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await variantAPI.bulkCreateVariants(id, 'standard_vip_private');
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: `Created ${res.data?.length ?? 3} variants successfully!`,
        });
        await fetchVariants();
      } else {
        Toast.show({ type: 'error', text1: 'Failed to create variants', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to create variants', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmQuickSetup = () => {
    Alert.alert(
      'Quick Setup',
      'This will create Standard, VIP, and Private variants. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: quickSetup },
      ]
    );
  };

  // ── Editor open/close ───────────────────────────────────
  const openEditor = (variant?: Variant) => {
    if (variant) {
      setEditing(variant);
      const basePrice = variant.pricing?.basePrice ?? variant.pricePerPerson ?? DEFAULT_BASE_PRICE;
      // If the stored name isn't one of the known types, fall back to the
      // legacy tier, then to Custom (preserving the original name).
      const knownName = VARIANT_TYPES.includes(variant.name)
        ? variant.name
        : TIER_TO_NAME[variant.tier || ''] || 'Custom';
      const customName = VARIANT_TYPES.includes(variant.name)
        ? variant.customName || ''
        : variant.customName || variant.name || '';
      setForm({
        name: knownName,
        customName,
        description: variant.description || '',
        highlights: padArray(variant.highlights),
        basePrice: String(basePrice),
        priceModifier: String(variant.pricing?.priceModifier ?? 1),
        childPrice: String(variant.pricing?.childPrice ?? Math.round(basePrice * 0.7)),
        priceType: getPriceType(variant),
        minCapacity: String(getCapacityMin(variant)),
        maxCapacity: String(getCapacityMax(variant)),
        includes: padArray(getIncludes(variant)),
        excludes: padArray(variant.excludes),
      });
    } else {
      setEditing(null);
      setForm(makeDefaultForm());
    }
    setEditorVisible(true);
    Haptics.selectionAsync();
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setEditing(null);
    setForm(makeDefaultForm());
  };

  // ── Dynamic string[] rows (highlights / includes / excludes) ──
  const addArrayItem = (field: ArrayFieldName) =>
    setForm((f) => ({ ...f, [field]: [...f[field], ''] }));

  const removeArrayItem = (field: ArrayFieldName, index: number) =>
    setForm((f) => {
      const next = f[field].filter((_, i) => i !== index);
      return { ...f, [field]: next.length > 0 ? next : [''] };
    });

  const updateArrayItem = (field: ArrayFieldName, index: number, value: string) =>
    setForm((f) => {
      const next = [...f[field]];
      next[index] = value;
      return { ...f, [field]: next };
    });

  // ── Save (create / update) ──────────────────────────────
  const saveVariant = async () => {
    if (!id) return;
    const basePrice = parseFloat(form.basePrice);
    const priceModifier = parseFloat(form.priceModifier);
    const childPrice = parseFloat(form.childPrice);
    const minCapacity = parseInt(form.minCapacity, 10);
    const maxCapacity = parseInt(form.maxCapacity, 10);

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      Toast.show({ type: 'error', text1: 'Valid base price required' });
      return;
    }
    if (!Number.isFinite(priceModifier) || priceModifier <= 0) {
      Toast.show({ type: 'error', text1: 'Valid price modifier required' });
      return;
    }
    if (!Number.isFinite(childPrice) || childPrice < 0) {
      Toast.show({ type: 'error', text1: 'Valid child price required' });
      return;
    }
    if (!Number.isFinite(minCapacity) || !Number.isFinite(maxCapacity) || minCapacity < 1 || maxCapacity < minCapacity) {
      Toast.show({ type: 'error', text1: 'Valid capacity range required' });
      return;
    }

    const payload = {
      name: form.name,
      customName: form.name === 'Custom' ? form.customName : '',
      description: form.description,
      highlights: form.highlights.filter((h) => h.trim()),
      pricing: {
        basePrice,
        priceModifier,
        childPrice,
        priceType: form.priceType,
        currency: CURRENCY,
      },
      capacity: {
        min: minCapacity,
        max: maxCapacity,
      },
      includes: form.includes.filter((i) => i.trim()),
      excludes: form.excludes.filter((e) => e.trim()),
    };

    setSubmitting(true);
    try {
      const res = editing
        ? await variantAPI.updateVariant(editing._id, payload)
        : await variantAPI.createVariant(id, payload);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: editing ? 'Variant updated' : 'Variant created',
        });
        closeEditor();
        await fetchVariants();
      } else {
        Toast.show({ type: 'error', text1: 'Failed to save variant', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to save variant', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────
  const deleteVariant = (variant: Variant) => {
    Alert.alert(
      'Delete Variant',
      'Are you sure you want to delete this variant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await variantAPI.deleteVariant(variant._id);
              if (res?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Toast.show({ type: 'success', text1: 'Variant deleted' });
                await fetchVariants();
              } else {
                Toast.show({ type: 'error', text1: 'Failed to delete variant', text2: res?.message });
              }
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to delete variant', text2: err?.message });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Activity variants</Text>
        <TouchableOpacity onPress={() => openEditor()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add" size={26} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Offer different tiers (Standard, VIP, Private) with different pricing and features.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <LoadingSpinner message="Loading variants..." />
          </View>
        ) : variants.length === 0 ? (
          <View style={{ paddingTop: spacing.xl }}>
            <EmptyState
              icon={<Ionicons name="cube-outline" size={56} color={themeColors.textTertiary} />}
              title="No variants yet"
              description="Create variant tiers to offer different experience levels"
              actionLabel="Quick Setup (Standard/VIP/Private)"
              onAction={confirmQuickSetup}
            />
            <View style={{ height: spacing.lg }} />
            <Button
              title="Create custom variant"
              onPress={() => openEditor()}
              variant="outline"
              size="md"
              fullWidth
            />
          </View>
        ) : (
          variants.map((v) => {
            const basePrice = getBasePrice(v);
            const priceModifier = getPriceModifier(v);
            const priceType = getPriceType(v);
            const highlights = v.highlights || [];
            const isPopular = (v.bookingCount ?? 0) > 0 && !!v.isFeatured;
            const isActive = v.isAvailable !== false;

            return (
              <Card key={v._id} bordered style={styles.variantCard}>
                {isPopular ? (
                  <View style={styles.popularBadge}>
                    <Badge label="⭐ Popular" variant="warning" size="sm" />
                  </View>
                ) : null}

                {/* Head: icon + name + description */}
                <View style={styles.variantHead}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.primary[50] }]}>
                    <Ionicons name={getVariantIcon(v.name)} size={20} color={colors.primary[500]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.variantName, { color: themeColors.text }]}>
                      {v.displayName || v.name}
                    </Text>
                    {v.description ? (
                      <Text
                        style={[styles.variantDesc, { color: themeColors.textSecondary }]}
                        numberOfLines={2}
                      >
                        {v.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Pricing */}
                <View style={styles.priceRow}>
                  <Text style={[styles.variantPrice, { color: themeColors.text }]}>
                    ₹{basePrice.toLocaleString('en-IN')}
                  </Text>
                  <Text style={[styles.priceTypeLabel, { color: themeColors.textSecondary }]}>
                    {priceType === 'per_group' ? 'per group' : 'per person'}
                  </Text>
                </View>
                {priceModifier !== 1.0 ? (
                  <Text style={styles.modifierNote}>{priceModifier}x base price</Text>
                ) : null}

                {/* Capacity */}
                <View style={styles.capacityRow}>
                  <Ionicons name="people-outline" size={16} color={themeColors.textSecondary} />
                  <Text style={[styles.capacityText, { color: themeColors.textSecondary }]}>
                    {getCapacityMin(v)}-{getCapacityMax(v)} people
                  </Text>
                </View>

                {/* Highlights */}
                {highlights.length > 0 ? (
                  <View style={styles.highlights}>
                    {highlights.slice(0, 3).map((h, i) => (
                      <View key={i} style={styles.highlightRow}>
                        <Ionicons name="checkmark" size={16} color={colors.success} style={styles.highlightIcon} />
                        <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{h}</Text>
                      </View>
                    ))}
                    {highlights.length > 3 ? (
                      <Text style={[styles.moreHighlights, { color: themeColors.textTertiary }]}>
                        +{highlights.length - 3} more
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Stats */}
                <View style={[styles.statsRow, { borderTopColor: themeColors.border }]}>
                  <Text style={[styles.statsText, { color: themeColors.textSecondary }]}>
                    Bookings:{' '}
                    <Text style={[styles.statsValue, { color: themeColors.text }]}>
                      {v.bookingCount || 0}
                    </Text>
                  </Text>
                  <Badge label={isActive ? 'Active' : 'Inactive'} variant={isActive ? 'success' : 'default'} size="sm" />
                </View>

                {/* Actions */}
                <View style={styles.variantActions}>
                  <Button
                    title="Edit"
                    onPress={() => openEditor(v)}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Delete"
                    onPress={() => deleteVariant(v)}
                    variant="ghost"
                    size="sm"
                    textStyle={{ color: colors.error }}
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ── Editor modal ── */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {editing ? 'Edit variant' : 'Add variant'}
            </Text>
            <TouchableOpacity onPress={closeEditor} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Variant type */}
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Variant Type</Text>
              <View style={styles.chipWrap}>
                {VARIANT_TYPES.map((t) => {
                  const active = form.name === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setForm((f) => ({ ...f, name: t }))}
                      style={[
                        styles.chip,
                        { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                        active && styles.chipActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: themeColors.textSecondary },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom name */}
              {form.name === 'Custom' ? (
                <TextInput
                  label="Custom Name"
                  value={form.customName}
                  onChangeText={(t) => setForm((f) => ({ ...f, customName: t }))}
                  placeholder="e.g., Luxury Experience"
                />
              ) : null}

              {/* Description */}
              <TextInput
                label="Description"
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                placeholder="What makes this variant special?"
                multiline
                numberOfLines={3}
              />

              {/* Pricing */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label={`Base Price (${CURRENCY})`}
                    value={form.basePrice}
                    onChangeText={(t) => setForm((f) => ({ ...f, basePrice: t }))}
                    keyboardType="decimal-pad"
                    placeholder="500"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Price Modifier"
                    value={form.priceModifier}
                    onChangeText={(t) => setForm((f) => ({ ...f, priceModifier: t }))}
                    keyboardType="decimal-pad"
                    placeholder="1.0"
                    hint="1.0 = base price, 1.5 = 50% more"
                  />
                </View>
              </View>

              <TextInput
                label={`Child Price (${CURRENCY})`}
                value={form.childPrice}
                onChangeText={(t) => setForm((f) => ({ ...f, childPrice: t }))}
                keyboardType="decimal-pad"
                placeholder="350"
              />

              {/* Price type */}
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Price Type</Text>
              <View style={[styles.chipWrap, { marginBottom: spacing.lg }]}>
                {(['per_person', 'per_group'] as const).map((t) => {
                  const active = form.priceType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setForm((f) => ({ ...f, priceType: t }))}
                      style={[
                        styles.chip,
                        { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                        active && styles.chipActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: themeColors.textSecondary },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {t === 'per_person' ? 'Per person' : 'Per group'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Capacity */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Min Capacity"
                    value={form.minCapacity}
                    onChangeText={(t) => setForm((f) => ({ ...f, minCapacity: t }))}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    label="Max Capacity"
                    value={form.maxCapacity}
                    onChangeText={(t) => setForm((f) => ({ ...f, maxCapacity: t }))}
                    keyboardType="number-pad"
                    placeholder="10"
                  />
                </View>
              </View>

              {/* Highlights */}
              <ArrayField
                label="Highlights"
                items={form.highlights}
                placeholder="e.g., Priority access"
                addLabel="Add highlight"
                themeColors={themeColors}
                onAdd={() => addArrayItem('highlights')}
                onRemove={(i) => removeArrayItem('highlights', i)}
                onChangeItem={(i, t) => updateArrayItem('highlights', i, t)}
              />

              {/* Includes */}
              <ArrayField
                label="What's Included"
                items={form.includes}
                placeholder="e.g., Complimentary refreshments"
                addLabel="Add item"
                themeColors={themeColors}
                onAdd={() => addArrayItem('includes')}
                onRemove={(i) => removeArrayItem('includes', i)}
                onChangeItem={(i, t) => updateArrayItem('includes', i, t)}
              />

              {/* Excludes */}
              <ArrayField
                label="What's Not Included"
                items={form.excludes}
                placeholder="e.g., Hotel pickup"
                addLabel="Add item"
                themeColors={themeColors}
                onAdd={() => addArrayItem('excludes')}
                onRemove={(i) => removeArrayItem('excludes', i)}
                onChangeItem={(i, t) => updateArrayItem('excludes', i, t)}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
              <Button
                title={editing ? 'Save Changes' : 'Create Variant'}
                onPress={saveVariant}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// Dynamic string[] field (highlights / includes / excludes)
// ============================================================
function ArrayField({
  label,
  items,
  placeholder,
  addLabel,
  themeColors,
  onAdd,
  onRemove,
  onChangeItem,
}: {
  label: string;
  items: string[];
  placeholder: string;
  addLabel: string;
  themeColors: any;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChangeItem: (index: number, value: string) => void;
}) {
  return (
    <View style={styles.arrayField}>
      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.arrayRow}>
          <TextInput
            value={item}
            onChangeText={(t) => onChangeItem(index, t)}
            placeholder={placeholder}
            containerStyle={styles.arrayInput}
          />
          <TouchableOpacity
            onPress={() => onRemove(index)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.arrayRemoveBtn}
          >
            <Ionicons name="close" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.arrayAdd}>+ {addLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  topBarTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  subtitle: { fontSize: fontSize.sm, marginBottom: spacing.lg, lineHeight: 20 },

  // Variant card
  variantCard: { padding: spacing.lg, marginBottom: spacing.md },
  popularBadge: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
  variantHead: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  variantDesc: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  variantPrice: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  priceTypeLabel: { fontSize: fontSize.sm },
  modifierNote: { fontSize: fontSize.sm, color: colors.primary[500], marginTop: 2 },

  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  capacityText: { fontSize: fontSize.sm },

  highlights: { marginTop: spacing.md, gap: 4 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  highlightIcon: { marginTop: 1 },
  highlightText: { fontSize: fontSize.sm, flex: 1, lineHeight: 18 },
  moreHighlights: { fontSize: fontSize.sm, marginLeft: spacing.xl },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  statsText: { fontSize: fontSize.sm },
  statsValue: { fontWeight: fontWeight.semibold },

  variantActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  modalScroll: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  row2: { flexDirection: 'row', gap: spacing.md },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  chipTextActive: { color: '#fff' },

  arrayField: { marginBottom: spacing.lg },
  arrayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrayInput: { flex: 1, marginBottom: spacing.sm },
  arrayRemoveBtn: { padding: spacing.xs, marginBottom: spacing.sm },
  arrayAdd: { fontSize: fontSize.sm, color: colors.primary[500], fontWeight: fontWeight.medium },
});
