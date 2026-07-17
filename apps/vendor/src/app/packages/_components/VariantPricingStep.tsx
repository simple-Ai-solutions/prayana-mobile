// Multi-variant pricing step for the holiday-package wizard.
// Ported from the web partner portal's VariantPricingStep.jsx.
//
// Pattern: inline expandable cards (not a modal) — reads best on a phone and
// lets the vendor eyeball several tiers at once. Advanced pricing rules
// (group discounts, early-bird, seasonal, blackout) live below the variants,
// collapsed behind a single toggle so the step isn't overwhelming.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, Badge, TextInput, useTheme } from '@prayana/shared-ui';
import { Button } from '../../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import {
  StepProps,
  PackageVariant,
  PackagePricingRules,
  GroupDiscount,
  SeasonalPricing,
  BlackoutDate,
  HotelCategory,
  MealPlan,
  makeDefaultVariant,
} from './packageTypes';

// ─── Constants (mirrored from the web ground truth) ─────────────────────────

type VariantName = PackageVariant['name'];

const VARIANT_NAMES: VariantName[] = ['Budget', 'Standard', 'Luxury', 'Premium', 'Custom'];

const MEAL_PLANS: { value: MealPlan; label: string }[] = [
  { value: 'EP', label: 'EP · No Meals' },
  { value: 'CP', label: 'CP · Breakfast' },
  { value: 'MAP', label: 'MAP · B + Dinner' },
  { value: 'AP', label: 'AP · All Meals' },
];

const HOTEL_CATEGORIES: HotelCategory[] = ['budget', 'standard', 'premium', 'luxury'];
const HOTEL_LABELS: Record<HotelCategory, string> = {
  budget: '2-3★ Budget',
  standard: '3-4★ Standard',
  premium: '4-5★ Premium',
  luxury: '5★ Luxury',
};
const MEAL_SHORT: Record<MealPlan, string> = {
  EP: 'No meals',
  CP: 'Breakfast',
  MAP: 'B+D',
  AP: 'All meals',
};

// Smart defaults per variant tier (hotelCategory / mealPlan / transportType / description).
const VARIANT_DEFAULTS: Record<
  VariantName,
  { hotelCategory: HotelCategory; mealPlan: MealPlan; description: string; transportType: string }
> = {
  Budget: {
    hotelCategory: 'budget',
    mealPlan: 'CP',
    description: 'Best value — comfortable stays, essential meals',
    transportType: 'Shared shuttle / bus',
  },
  Standard: {
    hotelCategory: 'standard',
    mealPlan: 'MAP',
    description: 'Most popular — quality hotels, breakfast + dinner',
    transportType: 'Private sedan',
  },
  Luxury: {
    hotelCategory: 'luxury',
    mealPlan: 'AP',
    description: 'Premium experience — 5-star stays, all meals, VIP service',
    transportType: 'Premium SUV + guide',
  },
  Premium: {
    hotelCategory: 'luxury',
    mealPlan: 'AP',
    description: 'Ultra-premium — heritage properties, personal concierge',
    transportType: 'Luxury SUV + personal guide',
  },
  Custom: {
    hotelCategory: 'standard',
    mealPlan: 'MAP',
    description: 'Customizable to your needs',
    transportType: '',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatPrice = (n: number | null | undefined): string => {
  if (!n) return '—';
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

// Parse a numeric text field, tolerating stray characters. Returns 0 on empty/NaN.
const parseNum = (t: string): number => {
  const n = parseFloat(String(t).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (s: string): boolean => s === '' || DATE_RE.test(s);

// ─── Component ───────────────────────────────────────────────────────────────

export default function VariantPricingStep({ values, onChange }: StepProps) {
  const { themeColors } = useTheme();

  const variants: PackageVariant[] = values.variants || [];
  const pricing: PackagePricingRules = values.pricing;

  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const [showComparison, setShowComparison] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleExpanded = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  // ── Variant mutations ──────────────────────────────────────────────────────
  const updateVariant = (index: number, updates: Partial<PackageVariant>) => {
    const next = [...variants];
    next[index] = { ...next[index], ...updates };
    onChange({ variants: next });
  };

  const updateVariantPricing = (index: number, updates: Partial<PackageVariant['pricing']>) => {
    updateVariant(index, { pricing: { ...variants[index].pricing, ...updates } });
  };

  const changeVariantName = (index: number, name: VariantName) => {
    const d = VARIANT_DEFAULTS[name];
    updateVariant(index, {
      name,
      displayName: `${name} Package`,
      description: d.description,
      hotelCategory: d.hotelCategory,
      mealPlan: d.mealPlan,
      transportType: d.transportType,
    });
  };

  const addVariant = () => {
    if (variants.length >= 5) return;
    const used = variants.map((v) => v.name);
    const nextName = (VARIANT_NAMES.find((n) => !used.includes(n)) || 'Custom') as VariantName;
    const d = VARIANT_DEFAULTS[nextName];
    const newVariant: PackageVariant = {
      ...makeDefaultVariant(),
      name: nextName,
      displayName: `${nextName} Package`,
      description: d.description,
      hotelCategory: d.hotelCategory,
      mealPlan: d.mealPlan,
      transportType: d.transportType,
      isDefault: variants.length === 0,
      isActive: true,
      displayOrder: variants.length,
    };
    onChange({ variants: [...variants, newVariant] });
    setExpanded((prev) => ({ ...prev, [variants.length]: true }));
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    onChange({ variants: variants.filter((_, i) => i !== index) });
  };

  // Single-default enforcement: exactly one variant carries isDefault.
  const setDefaultVariant = (index: number) => {
    onChange({ variants: variants.map((v, i) => ({ ...v, isDefault: i === index })) });
  };

  // ── Pricing-rules mutations ────────────────────────────────────────────────
  const setPricing = (updates: Partial<PackagePricingRules>) => {
    onChange({ pricing: { ...pricing, ...updates } });
  };

  const groupDiscounts = pricing.groupDiscounts || [];
  const seasonalPricing = pricing.seasonalPricing || [];
  const blackoutDates = pricing.blackoutDates || [];
  const earlyBird = pricing.earlyBirdDiscount;

  const addGroupDiscount = () =>
    setPricing({ groupDiscounts: [...groupDiscounts, { minPeople: 5, maxPeople: 10, discountPercent: 5 }] });
  const updateGroupDiscount = (i: number, field: keyof GroupDiscount, value: number) => {
    const d = [...groupDiscounts];
    d[i] = { ...d[i], [field]: value };
    setPricing({ groupDiscounts: d });
  };
  const removeGroupDiscount = (i: number) =>
    setPricing({ groupDiscounts: groupDiscounts.filter((_, x) => x !== i) });

  const addSeason = () =>
    setPricing({
      seasonalPricing: [
        ...seasonalPricing,
        { name: '', startDate: '', endDate: '', priceModifier: 1.2, isActive: true },
      ],
    });
  const updateSeason = (i: number, updates: Partial<SeasonalPricing>) => {
    const s = [...seasonalPricing];
    s[i] = { ...s[i], ...updates };
    setPricing({ seasonalPricing: s });
  };
  const removeSeason = (i: number) =>
    setPricing({ seasonalPricing: seasonalPricing.filter((_, x) => x !== i) });

  const addBlackout = () =>
    setPricing({ blackoutDates: [...blackoutDates, { startDate: '', endDate: '', reason: '' }] });
  const updateBlackout = (i: number, updates: Partial<BlackoutDate>) => {
    const b = [...blackoutDates];
    b[i] = { ...b[i], ...updates };
    setPricing({ blackoutDates: b });
  };
  const removeBlackout = (i: number) =>
    setPricing({ blackoutDates: blackoutDates.filter((_, x) => x !== i) });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ═══ Variants ═══ */}
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Package Variants</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Create different tiers for different budgets
          </Text>
        </View>
        <TouchableOpacity
          onPress={addVariant}
          disabled={variants.length >= 5}
          style={[styles.addBtn, variants.length >= 5 && styles.addBtnDisabled]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={16} color={colors.primary[500]} />
          <Text style={styles.addBtnText}>Add Variant</Text>
        </TouchableOpacity>
      </View>

      {variants.map((variant, idx) => {
        const isOpen = !!expanded[idx];
        const base = variant.pricing.basePrice;
        const childEffective = variant.pricing.childPrice ?? Math.round(base * 0.7);
        return (
          <Card key={idx} bordered padding="lg" style={styles.variantCard}>
            {/* Collapsed header (tap to expand) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleExpanded(idx)}
              style={styles.variantHeadRow}
            >
              <View style={styles.variantHeadLeft}>
                <Badge label={variant.name} variant="primary" size="sm" />
                {variant.isDefault ? (
                  <View style={styles.defaultTag}>
                    <Ionicons name="star" size={11} color={colors.primary[500]} />
                    <Text style={styles.defaultTagText}>Default</Text>
                  </View>
                ) : null}
                {!variant.isActive ? (
                  <Badge label="Inactive" variant="default" size="sm" />
                ) : null}
              </View>
              <View style={styles.variantHeadRight}>
                <Text style={[styles.headPrice, { color: themeColors.text }]}>
                  {formatPrice(base)}
                </Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={themeColors.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {isOpen ? (
              <View style={styles.variantBody}>
                {/* Name chips */}
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Tier</Text>
                <ChipRow
                  options={VARIANT_NAMES.map((n) => ({ value: n, label: n }))}
                  value={variant.name}
                  onSelect={(v) => changeVariantName(idx, v as VariantName)}
                  themeColors={themeColors}
                />

                {/* Default / Active toggles */}
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: themeColors.text }]}>
                    Default (shown as "Popular")
                  </Text>
                  <Switch
                    value={variant.isDefault}
                    onValueChange={(val) => {
                      if (val) setDefaultVariant(idx);
                      else Toast.show({ type: 'info', text1: 'At least one variant must stay default' });
                    }}
                    trackColor={{ true: colors.primary[500], false: themeColors.border }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Active</Text>
                  <Switch
                    value={variant.isActive}
                    onValueChange={(val) => updateVariant(idx, { isActive: val })}
                    trackColor={{ true: colors.primary[500], false: themeColors.border }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Pricing */}
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Base Price / Person *"
                      value={base ? String(base) : ''}
                      onChangeText={(t) => updateVariantPricing(idx, { basePrice: parseNum(t) })}
                      keyboardType="numeric"
                      placeholder="0"
                      leftIcon={<Text style={[styles.rupee, { color: themeColors.textSecondary }]}>₹</Text>}
                      error={base > 0 ? undefined : 'Required'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Child Price"
                      value={variant.pricing.childPrice != null ? String(variant.pricing.childPrice) : ''}
                      onChangeText={(t) =>
                        updateVariantPricing(idx, { childPrice: t.trim() === '' ? null : parseNum(t) })
                      }
                      keyboardType="numeric"
                      placeholder="Auto: 70% of base"
                      leftIcon={<Text style={[styles.rupee, { color: themeColors.textSecondary }]}>₹</Text>}
                    />
                  </View>
                </View>

                <TextInput
                  label="Single Occupancy Extra"
                  value={variant.pricing.singleOccupancySupplement ? String(variant.pricing.singleOccupancySupplement) : ''}
                  onChangeText={(t) =>
                    updateVariantPricing(idx, { singleOccupancySupplement: parseNum(t) })
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  leftIcon={<Text style={[styles.rupee, { color: themeColors.textSecondary }]}>₹</Text>}
                />

                {/* Hotel category chips */}
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Hotel Category</Text>
                <ChipRow
                  options={HOTEL_CATEGORIES.map((c) => ({ value: c, label: HOTEL_LABELS[c] }))}
                  value={variant.hotelCategory}
                  onSelect={(v) => updateVariant(idx, { hotelCategory: v as HotelCategory })}
                  themeColors={themeColors}
                />

                <TextInput
                  label="Hotel Name"
                  value={variant.hotelName}
                  onChangeText={(t) => updateVariant(idx, { hotelName: t })}
                  placeholder="e.g., The Oberoi Udaivilas, Udaipur"
                  leftIcon={<Ionicons name="bed-outline" size={16} color={themeColors.textSecondary} />}
                />

                {/* Meal plan chips */}
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Meal Plan</Text>
                <ChipRow
                  options={MEAL_PLANS.map((m) => ({ value: m.value, label: m.label }))}
                  value={variant.mealPlan}
                  onSelect={(v) => updateVariant(idx, { mealPlan: v as MealPlan })}
                  themeColors={themeColors}
                />

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Room Type"
                      value={variant.roomType}
                      onChangeText={(t) => updateVariant(idx, { roomType: t })}
                      placeholder="e.g., Deluxe Room"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Transport Type"
                      value={variant.transportType}
                      onChangeText={(t) => updateVariant(idx, { transportType: t })}
                      placeholder="e.g., Private Innova"
                    />
                  </View>
                </View>

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Min Group Size"
                      value={String(variant.minGroupSize)}
                      onChangeText={(t) => updateVariant(idx, { minGroupSize: parseNum(t) || 1 })}
                      keyboardType="number-pad"
                      placeholder="1"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Max Group Size"
                      value={String(variant.maxGroupSize)}
                      onChangeText={(t) => updateVariant(idx, { maxGroupSize: parseNum(t) || 20 })}
                      keyboardType="number-pad"
                      placeholder="20"
                    />
                  </View>
                </View>

                <TextInput
                  label="Description"
                  value={variant.description}
                  onChangeText={(t) => updateVariant(idx, { description: t })}
                  placeholder="Best value for couples"
                  multiline
                  numberOfLines={2}
                />

                <TextInput
                  label="Highlights (one per line)"
                  value={(variant.highlights || []).join('\n')}
                  onChangeText={(t) =>
                    updateVariant(idx, { highlights: t.split('\n').filter((h) => h.trim()) })
                  }
                  placeholder={'3-star deluxe hotel\nAll meals included\nPrivate vehicle for sightseeing'}
                  multiline
                  numberOfLines={3}
                />

                {/* Live customer preview */}
                {base > 0 ? (
                  <View style={[styles.preview, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}>
                    <View style={styles.previewHeadRow}>
                      <Ionicons name="eye-outline" size={11} color={themeColors.textTertiary} />
                      <Text style={[styles.previewLabel, { color: themeColors.textTertiary }]}>
                        CUSTOMER PREVIEW
                      </Text>
                      {variant.isDefault ? (
                        <View style={styles.popularPill}>
                          <Ionicons name="star" size={9} color="#fff" />
                          <Text style={styles.popularPillText}>Popular</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.previewPriceRow}>
                      <Text style={[styles.previewPrice, { color: themeColors.text }]}>
                        {formatPrice(base)}
                      </Text>
                      <Text style={[styles.previewPerPerson, { color: themeColors.textTertiary }]}>
                        / person
                      </Text>
                    </View>
                    <View style={styles.previewMetaRow}>
                      {variant.hotelName ? (
                        <PreviewChip icon="bed-outline" text={variant.hotelName} themeColors={themeColors} />
                      ) : null}
                      <PreviewChip icon="business-outline" text={HOTEL_LABELS[variant.hotelCategory]} themeColors={themeColors} />
                      <PreviewChip icon="restaurant-outline" text={MEAL_SHORT[variant.mealPlan]} themeColors={themeColors} />
                      {variant.transportType ? (
                        <PreviewChip icon="car-outline" text={variant.transportType} themeColors={themeColors} />
                      ) : null}
                    </View>
                    <View style={[styles.previewCalcRow, { borderTopColor: themeColors.border }]}>
                      <Text style={[styles.previewCalc, { color: themeColors.textSecondary }]}>
                        2 Adults: {formatPrice(base * 2)}
                      </Text>
                      <Text style={[styles.previewCalc, { color: themeColors.textSecondary }]}>
                        Family of 4: {formatPrice(base * 2 + childEffective * 2)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {variants.length > 1 ? (
                  <View style={styles.removeVariantWrap}>
                    <Button
                      title="Remove variant"
                      onPress={() => removeVariant(idx)}
                      variant="ghost"
                      size="sm"
                      icon={<Ionicons name="trash-outline" size={16} color={colors.error} />}
                      textStyle={{ color: colors.error }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}

      {/* ═══ Comparison table ═══ */}
      {variants.length >= 2 ? (
        <View>
          <TouchableOpacity
            onPress={() => setShowComparison((s) => !s)}
            style={styles.collapseToggle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="bar-chart-outline" size={16} color={colors.primary[500]} />
            <Text style={styles.collapseToggleText}>
              {showComparison ? 'Hide' : 'Compare'} Variants
            </Text>
            <Ionicons
              name={showComparison ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primary[500]}
            />
          </TouchableOpacity>
          {showComparison ? (
            <ComparisonTable variants={variants} themeColors={themeColors} />
          ) : null}
        </View>
      ) : null}

      {/* ═══ Advanced pricing rules (collapsed by default) ═══ */}
      <View style={[styles.advancedWrap, { borderColor: themeColors.border }]}>
        <TouchableOpacity
          onPress={() => setShowAdvanced((s) => !s)}
          style={styles.advancedToggle}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Advanced pricing rules
            </Text>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
              Group discounts, early bird, seasonal & blackout dates
            </Text>
          </View>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        {showAdvanced ? (
          <View style={styles.advancedBody}>
            {/* ── Group discounts ── */}
            <View style={styles.subSectionHeader}>
              <Text style={[styles.subSectionTitle, { color: themeColors.text }]}>Group Discounts</Text>
              <TouchableOpacity onPress={addGroupDiscount} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.addLink}>+ Add tier</Text>
              </TouchableOpacity>
            </View>
            {groupDiscounts.length === 0 ? (
              <Text style={[styles.emptyNote, { color: themeColors.textTertiary }]}>
                No group discounts.
              </Text>
            ) : (
              groupDiscounts.map((gd, i) => (
                <View key={i} style={[styles.ruleRow, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <View style={styles.ruleFields}>
                    <View style={styles.ruleField}>
                      <TextInput
                        label="Min"
                        containerStyle={styles.noMargin}
                        value={String(gd.minPeople)}
                        onChangeText={(t) => updateGroupDiscount(i, 'minPeople', parseNum(t) || 1)}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.ruleField}>
                      <TextInput
                        label="Max"
                        containerStyle={styles.noMargin}
                        value={String(gd.maxPeople)}
                        onChangeText={(t) => updateGroupDiscount(i, 'maxPeople', parseNum(t) || 1)}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.ruleField}>
                      <TextInput
                        label="% Off"
                        containerStyle={styles.noMargin}
                        value={String(gd.discountPercent)}
                        onChangeText={(t) =>
                          updateGroupDiscount(i, 'discountPercent', Math.min(100, parseNum(t)))
                        }
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeGroupDiscount(i)} style={styles.ruleRemove}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* ── Early bird ── */}
            <View style={[styles.earlyBirdCard, { borderColor: themeColors.border }]}>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: themeColors.text }]}>
                  Enable Early Bird Discount
                </Text>
                <Switch
                  value={earlyBird.enabled}
                  onValueChange={(val) =>
                    setPricing({ earlyBirdDiscount: { ...earlyBird, enabled: val } })
                  }
                  trackColor={{ true: colors.primary[500], false: themeColors.border }}
                  thumbColor="#fff"
                />
              </View>
              {earlyBird.enabled ? (
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Days before travel"
                      containerStyle={styles.noMargin}
                      value={String(earlyBird.daysBeforeTravel)}
                      onChangeText={(t) =>
                        setPricing({
                          earlyBirdDiscount: { ...earlyBird, daysBeforeTravel: Math.max(7, parseNum(t)) },
                        })
                      }
                      keyboardType="number-pad"
                      placeholder="30"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Discount %"
                      containerStyle={styles.noMargin}
                      value={String(earlyBird.discountPercent)}
                      onChangeText={(t) =>
                        setPricing({
                          earlyBirdDiscount: {
                            ...earlyBird,
                            discountPercent: Math.min(50, Math.max(1, parseNum(t))),
                          },
                        })
                      }
                      keyboardType="number-pad"
                      placeholder="10"
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* ── Seasonal pricing ── */}
            <View style={styles.subSectionHeader}>
              <Text style={[styles.subSectionTitle, { color: themeColors.text }]}>Seasonal Pricing</Text>
              <TouchableOpacity onPress={addSeason} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.addLink}>+ Add season</Text>
              </TouchableOpacity>
            </View>
            {seasonalPricing.length === 0 ? (
              <Text style={[styles.emptyNote, { color: themeColors.textTertiary }]}>
                No seasonal pricing. Prices stay flat year-round.
              </Text>
            ) : (
              seasonalPricing.map((season, i) => (
                <View key={i} style={[styles.stackedRule, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <TextInput
                    label="Season name"
                    containerStyle={styles.noMargin}
                    value={season.name}
                    onChangeText={(t) => updateSeason(i, { name: t })}
                    placeholder="e.g., Peak Winter"
                  />
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label="Start (YYYY-MM-DD)"
                        containerStyle={styles.noMargin}
                        value={season.startDate}
                        onChangeText={(t) => updateSeason(i, { startDate: t })}
                        placeholder="2026-12-20"
                        autoCapitalize="none"
                        error={isValidDate(season.startDate) ? undefined : 'Invalid date'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label="End (YYYY-MM-DD)"
                        containerStyle={styles.noMargin}
                        value={season.endDate}
                        onChangeText={(t) => updateSeason(i, { endDate: t })}
                        placeholder="2027-01-05"
                        autoCapitalize="none"
                        error={isValidDate(season.endDate) ? undefined : 'Invalid date'}
                      />
                    </View>
                  </View>
                  <View style={styles.seasonBottomRow}>
                    <View style={{ width: 140 }}>
                      <TextInput
                        label="Price ×"
                        containerStyle={styles.noMargin}
                        value={String(season.priceModifier)}
                        onChangeText={(t) =>
                          updateSeason(i, {
                            priceModifier: Math.min(3, Math.max(0.5, parseNum(t) || 1)),
                          })
                        }
                        keyboardType="decimal-pad"
                        placeholder="1.2"
                        rightIcon={<Text style={{ color: themeColors.textTertiary }}>×</Text>}
                      />
                    </View>
                    <View style={styles.seasonToggle}>
                      <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Active</Text>
                      <Switch
                        value={season.isActive}
                        onValueChange={(val) => updateSeason(i, { isActive: val })}
                        trackColor={{ true: colors.primary[500], false: themeColors.border }}
                        thumbColor="#fff"
                      />
                    </View>
                    <TouchableOpacity onPress={() => removeSeason(i)} style={styles.ruleRemove}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* ── Blackout dates ── */}
            <View style={styles.subSectionHeader}>
              <Text style={[styles.subSectionTitle, { color: themeColors.text }]}>Blackout Dates</Text>
              <TouchableOpacity onPress={addBlackout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.addLink}>+ Add blackout</Text>
              </TouchableOpacity>
            </View>
            {blackoutDates.length === 0 ? (
              <Text style={[styles.emptyNote, { color: themeColors.textTertiary }]}>
                No blackout dates.
              </Text>
            ) : (
              blackoutDates.map((bd, i) => (
                <View key={i} style={[styles.stackedRule, { backgroundColor: colors.errorLight }]}>
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label="Start (YYYY-MM-DD)"
                        containerStyle={styles.noMargin}
                        value={bd.startDate}
                        onChangeText={(t) => updateBlackout(i, { startDate: t })}
                        placeholder="2026-12-25"
                        autoCapitalize="none"
                        error={isValidDate(bd.startDate) ? undefined : 'Invalid date'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label="End (YYYY-MM-DD)"
                        containerStyle={styles.noMargin}
                        value={bd.endDate}
                        onChangeText={(t) => updateBlackout(i, { endDate: t })}
                        placeholder="2026-12-26"
                        autoCapitalize="none"
                        error={isValidDate(bd.endDate) ? undefined : 'Invalid date'}
                      />
                    </View>
                  </View>
                  <View style={styles.seasonBottomRow}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label="Reason"
                        containerStyle={styles.noMargin}
                        value={bd.reason}
                        onChangeText={(t) => updateBlackout(i, { reason: t })}
                        placeholder="e.g., Fully booked"
                      />
                    </View>
                    <TouchableOpacity onPress={() => removeBlackout(i)} style={styles.ruleRemove}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChipRow({
  options,
  value,
  onSelect,
  themeColors,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
  themeColors: any;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onSelect(o.value)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              { borderColor: themeColors.border, backgroundColor: themeColors.surface },
              active && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: themeColors.textSecondary },
                active && styles.chipTextActive,
              ]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PreviewChip({
  icon,
  text,
  themeColors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  themeColors: any;
}) {
  return (
    <View style={styles.previewChip}>
      <Ionicons name={icon} size={11} color={themeColors.textSecondary} />
      <Text style={[styles.previewChipText, { color: themeColors.textSecondary }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function ComparisonTable({
  variants,
  themeColors,
}: {
  variants: PackageVariant[];
  themeColors: any;
}) {
  const rows: { label: string; get: (v: PackageVariant) => string }[] = [
    { label: 'Price / Person', get: (v) => formatPrice(v.pricing.basePrice) },
    { label: 'Hotel', get: (v) => (v.hotelName ? v.hotelName : HOTEL_LABELS[v.hotelCategory]) },
    { label: 'Meals', get: (v) => MEAL_SHORT[v.mealPlan] },
    { label: 'Transport', get: (v) => v.transportType || '—' },
    { label: 'Group Size', get: (v) => `${v.minGroupSize}–${v.maxGroupSize}` },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tableWrap, { borderColor: themeColors.border }]}>
      <View>
        {/* Header */}
        <View style={[styles.tableRow, { backgroundColor: themeColors.backgroundSecondary }]}>
          <View style={[styles.tableCell, styles.tableLabelCell]}>
            <Text style={[styles.tableHeadText, { color: themeColors.textSecondary }]}>Feature</Text>
          </View>
          {variants.map((v, i) => (
            <View key={i} style={styles.tableCell}>
              <Text style={[styles.tableHeadText, { color: themeColors.text }]}>{v.name}</Text>
              {v.isDefault ? <Text style={styles.tablePopular}>Popular</Text> : null}
            </View>
          ))}
        </View>
        {/* Body */}
        {rows.map((row, ri) => (
          <View
            key={ri}
            style={[
              styles.tableRow,
              { borderTopColor: themeColors.border },
              ri % 2 === 1 && { backgroundColor: themeColors.backgroundSecondary },
            ]}
          >
            <View style={[styles.tableCell, styles.tableLabelCell]}>
              <Text style={[styles.tableLabelText, { color: themeColors.textSecondary }]}>{row.label}</Text>
            </View>
            {variants.map((v, i) => (
              <View key={i} style={styles.tableCell}>
                <Text style={[styles.tableValueText, { color: themeColors.text }]}>{row.get(v)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: spacing.xl },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionSubtitle: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontSize: fontSize.sm, color: colors.primary[500], fontWeight: fontWeight.medium },

  // Variant card
  variantCard: { marginBottom: 0 },
  variantHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variantHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, flexWrap: 'wrap' },
  variantHeadRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headPrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  defaultTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  defaultTagText: { fontSize: fontSize.xs, color: colors.primary[500], fontWeight: fontWeight.semibold },

  variantBody: { marginTop: spacing.lg },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  row2: { flexDirection: 'row', gap: spacing.md },
  rupee: { fontSize: fontSize.md },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  toggleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flex: 1 },

  // Chips
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

  // Live preview
  preview: { marginTop: spacing.sm, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1 },
  previewHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  previewLabel: { fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  popularPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  popularPillText: { fontSize: 10, color: '#fff', fontWeight: fontWeight.bold },
  previewPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  previewPrice: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  previewPerPerson: { fontSize: fontSize.xs },
  previewMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  previewChip: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '48%' },
  previewChipText: { fontSize: fontSize.xs },
  previewCalcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  previewCalc: { fontSize: fontSize.xs },

  removeVariantWrap: { alignItems: 'center', marginTop: spacing.sm },

  // Comparison
  collapseToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  collapseToggleText: { fontSize: fontSize.sm, color: colors.primary[500], fontWeight: fontWeight.semibold },
  tableWrap: { marginTop: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg },
  tableRow: { flexDirection: 'row', borderTopWidth: 0 },
  tableCell: {
    width: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableLabelCell: { width: 120, alignItems: 'flex-start' },
  tableHeadText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  tablePopular: { fontSize: 9, color: colors.primary[500], fontWeight: fontWeight.bold, marginTop: 2 },
  tableLabelText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  tableValueText: { fontSize: fontSize.xs, textAlign: 'center' },

  // Advanced
  advancedWrap: { borderWidth: 1, borderRadius: borderRadius.lg, overflow: 'hidden' },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  advancedBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },

  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  subSectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  addLink: { fontSize: fontSize.sm, color: colors.primary[500], fontWeight: fontWeight.medium },
  emptyNote: { fontSize: fontSize.xs, paddingVertical: spacing.xs },

  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  ruleFields: { flexDirection: 'row', gap: spacing.sm, flex: 1 },
  ruleField: { flex: 1 },
  ruleRemove: { padding: spacing.xs, paddingBottom: spacing.md },
  noMargin: { marginBottom: 0 },

  stackedRule: { padding: spacing.md, borderRadius: borderRadius.lg, gap: spacing.md },
  seasonBottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  seasonToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },

  earlyBirdCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
});
