import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput as RNTextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, useTheme, RequiredLabel } from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';
import { StepProps, Destination } from './packageTypes';

// ─── Constants (ported from web PackageBasicInfoStep.jsx) ────────────────────────

const MAX_CATEGORIES = 3;
const TITLE_MAX = 200;
const SHORT_DESC_MAX = 300;
const DESC_MAX = 5000;
const MIN_NIGHTS = 1;
const MAX_NIGHTS = 30;

// The web's 15 CATEGORIES + CATEGORY_ICONS, flattened to {label, emoji}.
const CATEGORIES: { label: string; emoji: string }[] = [
  { label: 'Holiday Package', emoji: '🏖️' },
  { label: 'Honeymoon', emoji: '💑' },
  { label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { label: 'Adventure Trek', emoji: '🏔️' },
  { label: 'Pilgrimage', emoji: '🛕' },
  { label: 'Weekend Getaway', emoji: '🌅' },
  { label: 'Beach', emoji: '🏝️' },
  { label: 'Hill Station', emoji: '⛰️' },
  { label: 'Wildlife Safari', emoji: '🦁' },
  { label: 'Cultural Heritage', emoji: '🏛️' },
  { label: 'Luxury Escape', emoji: '💎' },
  { label: 'Budget Travel', emoji: '🎒' },
  { label: 'Solo Travel', emoji: '🧳' },
  { label: 'Group Tour', emoji: '👥' },
  { label: 'Corporate Retreat', emoji: '🏢' },
];

const PACKAGE_TYPES: { key: 'fixed' | 'customizable' | 'dynamic'; label: string }[] = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'customizable', label: 'Customizable' },
  { key: 'dynamic', label: 'Dynamic' },
];

const DIFFICULTIES: {
  value: 'easy' | 'moderate' | 'challenging';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'easy', label: 'Easy', icon: 'sunny-outline' },
  { value: 'moderate', label: 'Moderate', icon: 'moon-outline' },
  { value: 'challenging', label: 'Challenging', icon: 'triangle-outline' },
];

const POPULAR_TAGS = [
  'honeymoon', 'beach', 'mountain', 'adventure', 'luxury', 'budget',
  'family-friendly', 'romantic', 'spiritual', 'photography', 'food-tour', 'wildlife',
];

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
        {hint && <Text style={[styles.labelSuffix, { color: themeColors.textTertiary }]}> {hint}</Text>}
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
          <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// Reusable segmented control (single-select), matching the current PackageForm.
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

// ─── Basics step ─────────────────────────────────────────────────────────────────

export default function PackageBasicInfoStep({ values, onChange }: StepProps) {
  const { themeColors } = useTheme();
  const [tagInput, setTagInput] = useState('');

  const inputStyle = [
    styles.input,
    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder, color: themeColors.text },
  ];
  const hintStyle = [styles.helperText, { color: themeColors.textTertiary }];

  // ── Category (multi, max 3) ──
  const category = values.category || [];
  const toggleCategory = (label: string) => {
    if (category.includes(label)) {
      onChange({ category: category.filter((c) => c !== label) });
    } else if (category.length < MAX_CATEGORIES) {
      onChange({ category: [...category, label] });
    } else {
      Toast.show({ type: 'info', text1: `Up to ${MAX_CATEGORIES} categories` });
    }
  };

  // ── Nights ──
  const setNights = (t: string) => {
    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
    const clamped = isNaN(n) ? MIN_NIGHTS : Math.min(MAX_NIGHTS, Math.max(MIN_NIGHTS, n));
    onChange({ nights: clamped });
  };

  // ── Destinations ──
  const destinations = values.destinations;
  const addDestination = () => {
    const next: Destination = {
      name: '',
      city: '',
      state: '',
      country: 'India',
      nightsHere: 1,
      order: destinations.length,
    };
    onChange({ destinations: [...destinations, next] });
  };
  const updateDestination = (index: number, updates: Partial<Destination>) => {
    onChange({
      destinations: destinations.map((d, i) => (i === index ? { ...d, ...updates } : d)),
    });
  };
  const removeDestination = (index: number) => {
    if (destinations.length <= 1) return;
    onChange({ destinations: destinations.filter((_, i) => i !== index) });
  };

  const totalNights = destinations.reduce((sum, d) => sum + (Number(d.nightsHere) || 0), 0);
  const nightsMismatch = !!values.nights && totalNights !== values.nights;

  // ── Tags ──
  const addTag = (raw: string) => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed && !values.tags.includes(trimmed)) {
      onChange({ tags: [...values.tags, trimmed] });
    }
  };
  const submitTag = () => {
    if (tagInput.trim()) {
      addTag(tagInput);
      setTagInput('');
    }
  };
  const removeTag = (index: number) => {
    onChange({ tags: values.tags.filter((_, i) => i !== index) });
  };

  return (
    <View>
      {/* ── Title / Description ── */}
      <Card style={styles.formSection}>
        <SectionHeader
          title="Basic Info"
          icon="information-circle-outline"
          subtitle="Package details & destinations"
        />

        <FieldLabel label="Package Title" required counter={`${values.title.length}/${TITLE_MAX}`} />
        <RNTextInput
          value={values.title}
          onChangeText={(t) => onChange({ title: t })}
          maxLength={TITLE_MAX}
          placeholder='e.g., "Incredible Taiwan 5N/6D — Taipei, Jiufen, Sun Moon Lake"'
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
        />
        <Text style={hintStyle}>Include destination + duration for best visibility.</Text>

        <FieldLabel label="Description" required counter={`${values.description.length}/${DESC_MAX}`} />
        <RNTextInput
          value={values.description}
          onChangeText={(t) => onChange({ description: t })}
          maxLength={DESC_MAX}
          placeholder="Describe the experience — what makes it special, what travellers can expect, key highlights..."
          placeholderTextColor={themeColors.textTertiary}
          style={[...inputStyle, styles.inputMultiline]}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <FieldLabel
          label="Short Description"
          optional
          hint="· for search cards"
          counter={`${values.shortDescription.length}/${SHORT_DESC_MAX}`}
        />
        <RNTextInput
          value={values.shortDescription}
          onChangeText={(t) => onChange({ shortDescription: t })}
          maxLength={SHORT_DESC_MAX}
          placeholder="One-liner that shows in search results"
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
        />
      </Card>

      {/* ── Package type & categories ── */}
      <Card style={styles.formSection}>
        <SectionHeader title="Type & Categories" icon="grid-outline" subtitle="How it's sold + what it's about" />

        <FieldLabel label="Package Type" />
        <Segmented
          options={PACKAGE_TYPES}
          selected={values.packageType}
          onSelect={(k) => onChange({ packageType: k as typeof values.packageType })}
        />

        <FieldLabel
          label="Categories"
          required
          hint="· up to 3"
          counter={`${category.length}/${MAX_CATEGORIES}`}
        />
        <View style={styles.chipContainer}>
          {CATEGORIES.map((cat) => {
            const isSelected = category.includes(cat.label);
            return (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.chip,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  isSelected && styles.chipSelected,
                ]}
                onPress={() => toggleCategory(cat.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                <Text
                  style={[styles.chipText, { color: themeColors.textSecondary }, isSelected && styles.chipTextSelected]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* ── Duration & difficulty ── */}
      <Card style={styles.formSection}>
        <SectionHeader title="Duration & Difficulty" icon="time-outline" />

        <FieldLabel label="Duration" required />
        <View style={styles.durationRow}>
          <View style={[styles.durationBox, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }]}>
            <RNTextInput
              value={String(values.nights)}
              onChangeText={setNights}
              keyboardType="numeric"
              maxLength={2}
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.durationInput, { color: themeColors.text }]}
              textAlign="center"
            />
            <Text style={[styles.durationUnit, { color: themeColors.textTertiary }]}>Nights</Text>
          </View>
          <Text style={[styles.durationSlash, { color: themeColors.textTertiary }]}>/</Text>
          <View style={[styles.durationBox, styles.durationBoxReadOnly, { backgroundColor: themeColors.inputBackground, borderColor: themeColors.fieldBorder }]}>
            <Text style={[styles.durationValue, { color: themeColors.text }]}>{(values.nights || 0) + 1}</Text>
            <Text style={[styles.durationUnit, { color: themeColors.textTertiary }]}>Days</Text>
          </View>
        </View>
        <Text style={hintStyle}>
          {values.nights || 0} Nights / {(values.nights || 0) + 1} Days — days are calculated as nights + 1.
        </Text>

        <FieldLabel label="Difficulty Level" />
        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((d) => {
            const active = values.difficulty === d.value;
            return (
              <TouchableOpacity
                key={d.value}
                style={[
                  styles.difficultyBtn,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  active && styles.difficultyBtnActive,
                ]}
                onPress={() => onChange({ difficulty: d.value })}
                activeOpacity={0.7}
              >
                <Ionicons name={d.icon} size={18} color={active ? colors.primary[500] : themeColors.textTertiary} />
                <Text
                  style={[styles.difficultyLabel, { color: themeColors.textSecondary }, active && styles.difficultyLabelActive]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* ── Destinations ── */}
      <Card style={styles.formSection}>
        <View style={styles.destTitleRow}>
          <SectionHeader title="Destinations" icon="map-outline" subtitle="Cities on the route + nights at each" />
          <TouchableOpacity style={styles.addCityBtn} onPress={addDestination} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color={colors.primary[500]} />
            <Text style={styles.addCityText}>Add City</Text>
          </TouchableOpacity>
        </View>

        {nightsMismatch && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={15} color={styles.warningText.color} />
            <Text style={styles.warningText}>
              Destination nights ({totalNights}) don't match total ({values.nights} nights). Adjust to match.
            </Text>
          </View>
        )}

        {destinations.map((dest, index) => (
          <View
            key={index}
            style={[styles.destCard, { borderColor: themeColors.border, backgroundColor: themeColors.inputBackground }]}
          >
            <View style={styles.destHeader}>
              <View style={styles.destBadge}>
                <Text style={styles.destBadgeText}>{index + 1}</Text>
              </View>
              <Text style={[styles.destLabel, { color: themeColors.textSecondary }]}>Destination {index + 1}</Text>
              {destinations.length > 1 && (
                <TouchableOpacity onPress={() => removeDestination(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>

            <RNTextInput
              value={dest.name}
              onChangeText={(t) => updateDestination(index, { name: t })}
              placeholder="Place name (e.g. Alleppey)"
              placeholderTextColor={themeColors.textTertiary}
              style={[...inputStyle, styles.destInput]}
            />
            <View style={styles.row}>
              <View style={styles.flex2}>
                <RNTextInput
                  value={dest.city}
                  onChangeText={(t) => updateDestination(index, { city: t })}
                  placeholder="City"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[...inputStyle, styles.destInput]}
                />
              </View>
              <View style={styles.flex2}>
                <RNTextInput
                  value={dest.state}
                  onChangeText={(t) => updateDestination(index, { state: t })}
                  placeholder="State"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[...inputStyle, styles.destInput]}
                />
              </View>
              <View style={styles.flex1}>
                <RNTextInput
                  value={String(dest.nightsHere)}
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                    updateDestination(index, { nightsHere: isNaN(n) ? 0 : Math.max(0, n) });
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor={themeColors.textTertiary}
                  style={[...inputStyle, styles.destInput, styles.nightsInput]}
                  textAlign="center"
                />
                <Text style={[styles.nightsCaption, { color: themeColors.textTertiary }]}>nights</Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {/* ── Start / End points ── */}
      <Card style={styles.formSection}>
        <SectionHeader title="Start & End Points" icon="navigate-outline" />
        {/* Web uses a CityAutocomplete here; on mobile these are plain text inputs. */}
        <FieldLabel label="Pickup location" optional />
        <RNTextInput
          value={values.startPoint}
          onChangeText={(t) => onChange({ startPoint: t })}
          placeholder="e.g., Taipei Airport"
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
        />
        <FieldLabel label="Drop-off location" optional />
        <RNTextInput
          value={values.endPoint}
          onChangeText={(t) => onChange({ endPoint: t })}
          placeholder="e.g., Taipei Airport"
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
        />
      </Card>

      {/* ── Tags ── */}
      <Card style={styles.formSection}>
        <SectionHeader title="Tags" icon="pricetag-outline" subtitle="Keywords for search discovery" />

        {values.tags.length > 0 && (
          <View style={styles.selectedTagsWrap}>
            {values.tags.map((tag, index) => (
              <View key={`${tag}-${index}`} style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>#{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(index)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={13} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tagInputRow}>
          <RNTextInput
            value={tagInput}
            onChangeText={(t) => setTagInput(t.toLowerCase())}
            placeholder="Type a tag and press add"
            placeholderTextColor={themeColors.textTertiary}
            style={[...inputStyle, styles.tagInput]}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submitTag}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.tagAddBtn} onPress={submitTag}>
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <Text style={hintStyle}>Popular tags (tap to add):</Text>
        <View style={styles.suggestionRow}>
          {POPULAR_TAGS.filter((t) => !values.tags.includes(t)).map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.suggestionChip, { borderColor: themeColors.border }]}
              onPress={() => addTag(tag)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={13} color={themeColors.textTertiary} />
              <Text style={[styles.suggestionText, { color: themeColors.textSecondary }]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  formSection: { marginBottom: spacing.lg },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  sectionSubtitle: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },

  // Labels
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  labelInRow: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, flexShrink: 1 },
  labelSuffix: { fontSize: fontSize.xs, fontWeight: fontWeight.normal },
  requiredMark: { color: colors.error, fontWeight: fontWeight.bold },
  counterText: { fontSize: fontSize.xs, color: colors.textTertiary, marginLeft: spacing.sm },

  // Inputs
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
  helperText: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  flex2: { flex: 2 },

  // Segmented
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary[500] },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  segmentTextActive: { color: '#ffffff', fontWeight: fontWeight.semibold },

  // Chips (category)
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  chipEmoji: { fontSize: fontSize.md },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextSelected: { color: colors.primary[600], fontWeight: fontWeight.semibold },

  // Duration
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  durationBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  durationBoxReadOnly: {},
  durationInput: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    minWidth: 36,
    padding: 0,
  },
  durationValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  durationUnit: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textTertiary },
  durationSlash: { fontSize: fontSize.lg, color: colors.textTertiary },

  // Difficulty
  difficultyRow: { flexDirection: 'row', gap: spacing.sm },
  difficultyBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  difficultyBtnActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  difficultyLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary },
  difficultyLabelActive: { color: colors.primary[600], fontWeight: fontWeight.semibold },

  // Destinations
  destTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  addCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },
  addCityText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[500] },
  destCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.backgroundSecondary,
  },
  destHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  destBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  destBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#ffffff' },
  destLabel: { flex: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  destInput: { marginBottom: spacing.sm },
  nightsInput: { paddingHorizontal: spacing.sm },
  nightsCaption: { fontSize: 10, textAlign: 'center', marginTop: -4 },

  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  warningText: { flex: 1, fontSize: fontSize.xs, color: '#92400e' },

  // Tags
  selectedTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
  },
  selectedTagText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: '#ffffff' },
  tagInputRow: { flexDirection: 'row', gap: spacing.sm },
  tagInput: { flex: 1 },
  tagAddBtn: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { fontSize: fontSize.sm, color: colors.textSecondary },
});
