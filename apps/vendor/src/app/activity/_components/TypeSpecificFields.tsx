import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput as RNTextInput,
  Switch,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../../theme/vendorColors';

// ─── Config types (mirrors the server's ActivityTypeConfig) ─────────────────────

export interface ConfigFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface ConfigField {
  fieldKey: string;
  type?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  options?: ConfigFieldOption[];
  validation?: { min?: number; max?: number; minLength?: number; maxLength?: number };
  section?: string;
  sectionIcon?: string;
  sectionOrder?: number;
  fieldOrder?: number;
  conditionalDisplay?: { dependsOn?: string; showWhen?: any };
}

export interface RequiredDocumentConfig {
  docKey: string;
  label: string;
  description?: string | null;
  required?: boolean;
  hasExpiry?: boolean;
  regulatoryBody?: string | null;
  regulatoryUrl?: string | null;
}

export interface ActivityTypeConfig {
  fields?: ConfigField[];
  requiredDocuments?: RequiredDocumentConfig[];
  safetyConfig?: {
    riskLevel?: string;
    requiresInsurance?: boolean;
    requiresCertifiedInstructor?: boolean;
    requiresWaiver?: boolean;
    minimumAge?: number | null;
  };
  emoji?: string;
  displayName?: string;
  description?: string;
  color?: string;
}

// ─── Section icon map (lucide names from the web config → Ionicons) ─────────────

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Waves: 'water-outline',
  Mountain: 'trail-sign-outline',
  UtensilsCrossed: 'restaurant-outline',
  Trees: 'leaf-outline',
  Landmark: 'business-outline',
  Building: 'business-outline',
  Castle: 'home-outline',
  Heart: 'heart-outline',
  Camera: 'camera-outline',
  Sparkles: 'sparkles-outline',
  Music: 'musical-notes-outline',
  ShoppingBag: 'bag-outline',
  Package: 'cube-outline',
  Shield: 'shield-outline',
  Cloud: 'cloud-outline',
  MapPin: 'location-outline',
  Shirt: 'shirt-outline',
  Ticket: 'ticket-outline',
  Gift: 'gift-outline',
  AlertTriangle: 'warning-outline',
  Info: 'information-circle-outline',
};

function sectionIonicon(name?: string): keyof typeof Ionicons.glyphMap {
  return (name && ICON_MAP[name]) || 'information-circle-outline';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Dynamic field renderer ──────────────────────────────────────────────────────

function DynamicField({
  field,
  value,
  onChange,
  error,
}: {
  field: ConfigField;
  value: any;
  onChange: (val: any) => void;
  error?: string;
}) {
  const { themeColors } = useTheme();
  const { type, placeholder, options, validation, defaultValue, label } = field;

  const inputStyle = [
    styles.input,
    {
      backgroundColor: themeColors.field,
      borderColor: error ? colors.error : themeColors.fieldBorder,
      color: themeColors.text,
    },
  ];

  switch (type) {
    case 'textarea': {
      const len = typeof value === 'string' ? value.length : 0;
      return (
        <View>
          <RNTextInput
            value={value || ''}
            onChangeText={onChange}
            placeholder={placeholder || ''}
            placeholderTextColor={themeColors.textTertiary}
            maxLength={validation?.maxLength || 2000}
            style={[...inputStyle, styles.inputMultiline]}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {validation?.minLength ? (
            <Text
              style={[
                styles.counterHint,
                { color: len < validation.minLength ? colors.primary[500] : themeColors.textTertiary },
              ]}
            >
              {len}/{validation.minLength} min characters
            </Text>
          ) : null}
        </View>
      );
    }

    case 'number':
      return (
        <RNTextInput
          value={value === null || value === undefined ? '' : String(value)}
          onChangeText={(t) => {
            const cleaned = t.replace(/[^0-9.-]/g, '');
            if (cleaned === '' || cleaned === '-') {
              onChange(null);
            } else {
              const n = Number(cleaned);
              onChange(isNaN(n) ? null : n);
            }
          }}
          placeholder={placeholder || ''}
          placeholderTextColor={themeColors.textTertiary}
          style={inputStyle}
          keyboardType="numeric"
        />
      );

    case 'select':
      return (
        <View style={styles.chipWrap}>
          {(options || []).map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  active && styles.chipSelected,
                ]}
                onPress={() => onChange(active ? '' : opt.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: themeColors.textSecondary },
                    active && styles.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );

    case 'multiselect': {
      const current: string[] = Array.isArray(value) ? value : [];
      return (
        <View>
          <View style={styles.chipWrap}>
            {(options || []).map((opt) => {
              const active = current.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                    active && styles.chipSelected,
                  ]}
                  onPress={() =>
                    onChange(
                      active ? current.filter((v) => v !== opt.value) : [...current, opt.value],
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      active && styles.chipTextSelected,
                    ]}
                  >
                    {active ? '✓ ' : ''}
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {current.length > 0 && (
            <Text style={[styles.counterHint, { color: themeColors.textTertiary }]}>
              {current.length} selected
            </Text>
          )}
        </View>
      );
    }

    case 'radio':
      return (
        <View style={styles.radioGroup}>
          {(options || []).map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.radioOption,
                  { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                  active && styles.radioOptionSelected,
                ]}
                onPress={() => onChange(opt.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? colors.primary[500] : themeColors.textTertiary}
                />
                <View style={styles.radioText}>
                  <Text style={[styles.radioLabel, { color: themeColors.text }]}>{opt.label}</Text>
                  {opt.description ? (
                    <Text style={[styles.radioDesc, { color: themeColors.textSecondary }]}>
                      {opt.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );

    case 'toggle': {
      const on: boolean = value ?? defaultValue ?? false;
      return (
        <View style={styles.switchRow}>
          <Switch
            value={on}
            onValueChange={onChange}
            trackColor={{ true: colors.primary[500] }}
          />
          <Text style={[styles.switchLabel, { color: themeColors.textSecondary }]}>
            {on ? 'Yes' : 'No'}
          </Text>
        </View>
      );
    }

    case 'date': {
      // Validated YYYY-MM-DD text input — keeps the payload string-shaped
      // without pulling a calendar modal into every dynamic field.
      const invalid = !!value && !DATE_RE.test(String(value));
      return (
        <View>
          <RNTextInput
            value={value || ''}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themeColors.textTertiary}
            style={inputStyle}
            maxLength={10}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {invalid && <Text style={styles.errorHint}>Use YYYY-MM-DD format</Text>}
        </View>
      );
    }

    case 'range': {
      // Deviation from web: no slider dependency in the app, so a numeric
      // input with a min–max hint stands in for <input type="range">.
      const min = validation?.min ?? 0;
      const max = validation?.max ?? 100;
      return (
        <View style={styles.rangeRow}>
          <RNTextInput
            value={value === null || value === undefined ? '' : String(value)}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9]/g, '');
              onChange(cleaned === '' ? null : Number(cleaned));
            }}
            placeholder={String(defaultValue ?? min)}
            placeholderTextColor={themeColors.textTertiary}
            style={[...inputStyle, styles.rangeInput]}
            keyboardType="numeric"
          />
          <Text style={[styles.rangeHint, { color: themeColors.textTertiary }]}>
            {min}–{max}
          </Text>
        </View>
      );
    }

    case 'checkbox':
      return (
        <View style={styles.switchRow}>
          <Switch
            value={!!value}
            onValueChange={onChange}
            trackColor={{ true: colors.primary[500] }}
          />
          <Text style={[styles.switchLabel, { color: themeColors.text }]}>{label}</Text>
        </View>
      );

    case 'text':
    case 'url':
    default:
      return (
        <RNTextInput
          value={value || ''}
          onChangeText={onChange}
          placeholder={placeholder || ''}
          placeholderTextColor={themeColors.textTertiary}
          maxLength={validation?.maxLength || undefined}
          style={inputStyle}
          autoCapitalize={type === 'url' ? 'none' : 'sentences'}
          keyboardType={type === 'url' ? 'url' : 'default'}
          autoCorrect={type !== 'url'}
        />
      );
  }
}

// ─── Component ───────────────────────────────────────────────────────────────────

/**
 * TypeSpecificFields — dynamic form renderer driven by ActivityTypeConfig.
 * The config is fetched by ActivityForm (single fetch per primary category)
 * and passed down; this component only renders.
 */
export default function TypeSpecificFields({
  primaryCategory,
  config,
  values = {},
  onChange,
  errors = {},
}: {
  primaryCategory: string | null;
  config: ActivityTypeConfig | null;
  values?: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string>;
}) {
  const { themeColors } = useTheme();
  // Open/closed state per section title; first section defaults open.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Group fields by section, sort sections by sectionOrder and fields by fieldOrder.
  const sections = useMemo(() => {
    if (!config?.fields) return [];
    const sectionMap = new Map<
      string,
      { title: string; icon?: string; order: number; fields: ConfigField[] }
    >();
    for (const field of config.fields) {
      const key = field.section || 'Details';
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          title: key,
          icon: field.sectionIcon || 'Info',
          order: field.sectionOrder || 0,
          fields: [],
        });
      }
      sectionMap.get(key)!.fields.push(field);
    }
    return Array.from(sectionMap.values())
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        ...section,
        fields: [...section.fields].sort((a, b) => (a.fieldOrder || 0) - (b.fieldOrder || 0)),
      }));
  }, [config]);

  // Conditional display — same semantics as the web renderer.
  const shouldShowField = useCallback(
    (field: ConfigField): boolean => {
      if (!field.conditionalDisplay?.dependsOn) return true;
      const depValue = values[field.conditionalDisplay.dependsOn];
      const showWhen = field.conditionalDisplay.showWhen;
      if (Array.isArray(showWhen)) {
        if (Array.isArray(depValue)) {
          return showWhen.some((sw) => depValue.includes(sw));
        }
        return showWhen.includes(depValue);
      }
      return depValue === showWhen;
    },
    [values],
  );

  // Section completion: every required visible field has a value.
  const isSectionComplete = useCallback(
    (fields: ConfigField[]): boolean => {
      const requiredFields = fields.filter((f) => f.required && shouldShowField(f));
      if (requiredFields.length === 0) return true;
      return requiredFields.every((f) => {
        const val = values[f.fieldKey];
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === 'boolean') return true;
        return val !== null && val !== undefined && val !== '';
      });
    },
    [values, shouldShowField],
  );

  if (!primaryCategory || !config || sections.length === 0) return null;

  const risk = config.safetyConfig?.riskLevel;
  const showSafetyBanner = !!risk && ['high', 'extreme'].includes(risk);

  return (
    <View style={styles.container}>
      {/* Header: emoji + display name + description */}
      <View style={styles.header}>
        <View
          style={[
            styles.emojiBubble,
            { backgroundColor: config.color ? `${config.color}20` : colors.primary[50] },
          ]}
        >
          <Text style={styles.emoji}>{config.emoji || '✨'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            {config.displayName || primaryCategory} Details
          </Text>
          {config.description ? (
            <Text style={[styles.headerDesc, { color: themeColors.textTertiary }]}>
              {config.description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Safety notice for high-risk activities */}
      {showSafetyBanner && (
        <View style={styles.safetyBanner}>
          <Ionicons name="shield-outline" size={18} color={colors.error} />
          <View style={styles.safetyText}>
            <Text style={styles.safetyTitle}>
              High-risk activity — additional safety requirements apply
            </Text>
            <Text style={styles.safetyDetail}>
              {config.safetyConfig?.requiresInsurance ? 'Insurance required. ' : ''}
              {config.safetyConfig?.requiresCertifiedInstructor ? 'Certified instructor required. ' : ''}
              {config.safetyConfig?.requiresWaiver ? 'Participant waiver required. ' : ''}
              {config.safetyConfig?.minimumAge ? `Minimum age: ${config.safetyConfig.minimumAge}. ` : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Field sections */}
      {sections.map((section, idx) => {
        const visibleFields = section.fields.filter(shouldShowField);
        if (visibleFields.length === 0) return null;

        const complete = isSectionComplete(section.fields);
        const isOpen = openSections[section.title] ?? idx === 0;

        return (
          <View
            key={section.title}
            style={[
              styles.section,
              { borderColor: complete ? colors.primary[300] : themeColors.border },
            ]}
          >
            <TouchableOpacity
              style={[styles.sectionHeader, { backgroundColor: themeColors.inputBackground }]}
              onPress={() =>
                setOpenSections((prev) => ({ ...prev, [section.title]: !isOpen }))
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name={complete ? 'checkmark-circle' : sectionIonicon(section.icon)}
                size={18}
                color={complete ? colors.primary[500] : themeColors.textTertiary}
              />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                {section.title}
              </Text>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={themeColors.textTertiary}
              />
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.sectionBody}>
                {visibleFields.map((field) => (
                  <View key={field.fieldKey} style={styles.fieldBlock}>
                    {/* checkbox shows its label inline next to the switch */}
                    {field.type !== 'checkbox' && (
                      <View style={styles.fieldLabelRow}>
                        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                          {field.label}
                          {field.required && <Text style={styles.requiredMark}> *</Text>}
                        </Text>
                      </View>
                    )}
                    {field.type !== 'checkbox' && field.description ? (
                      <Text style={[styles.fieldDesc, { color: themeColors.textTertiary }]}>
                        {field.description}
                      </Text>
                    ) : null}
                    <DynamicField
                      field={field}
                      value={values[field.fieldKey]}
                      onChange={(val) => onChange(field.fieldKey, val)}
                      error={errors[field.fieldKey]}
                    />
                    {errors[field.fieldKey] ? (
                      <Text style={styles.errorHint}>{errors[field.fieldKey]}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emojiBubble: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  headerDesc: { fontSize: fontSize.xs, marginTop: 1 },

  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: colors.errorLight,
  },
  safetyText: { flex: 1 },
  safetyTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.error },
  safetyDetail: { fontSize: fontSize.xs, color: colors.error, marginTop: 2, lineHeight: 16 },

  section: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sectionTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  sectionBody: { padding: spacing.md, gap: spacing.md },

  fieldBlock: { gap: spacing.xs },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  requiredMark: { color: colors.error, fontWeight: fontWeight.bold },
  fieldDesc: { fontSize: fontSize.xs, lineHeight: 16 },

  input: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
  },
  inputMultiline: { minHeight: 90, paddingTop: spacing.md },
  counterHint: { fontSize: fontSize.xs, marginTop: spacing.xs },
  errorHint: { fontSize: fontSize.xs, color: colors.error, marginTop: spacing.xs },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipSelected: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  chipText: { fontSize: fontSize.sm },
  chipTextSelected: { color: colors.primary[600], fontWeight: fontWeight.semibold },

  radioGroup: { gap: spacing.sm },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  radioOptionSelected: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  radioText: { flex: 1 },
  radioLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  radioDesc: { fontSize: fontSize.xs, marginTop: 2 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { fontSize: fontSize.sm, flex: 1 },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rangeInput: { flex: 1 },
  rangeHint: { fontSize: fontSize.sm },
});
