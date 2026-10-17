// StayFiltersSheet — the filters for /stays: price per night, the house
// rules Indian guests search for (couple-friendly, local ID), pets, free
// cancellation, star rating, property type and a few popular amenities.
//
// Edits a draft and hands it back on "Show stays", so the list doesn't
// reload on every tap while the sheet covers it.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { StaySheet } from './StaySheet';
import { AMENITY_FILTERS, STAY_CATEGORIES, typesIn } from '../../lib/stayLabels';

export type StayFilters = {
  types: string[];
  minPrice: string;
  maxPrice: string;
  stars: '' | '3' | '4' | '5';
  coupleFriendly: boolean;
  localId: boolean;
  pets: boolean;
  freeCancellation: boolean;
  amenities: string[];
};

export const EMPTY_FILTERS: StayFilters = {
  types: [],
  minPrice: '',
  maxPrice: '',
  stars: '',
  coupleFriendly: false,
  localId: false,
  pets: false,
  freeCancellation: false,
  amenities: [],
};

export function countFilters(f: StayFilters): number {
  return (
    f.types.length +
    f.amenities.length +
    (f.minPrice || f.maxPrice ? 1 : 0) +
    (f.stars ? 1 : 0) +
    [f.coupleFriendly, f.localId, f.pets, f.freeCancellation].filter(Boolean).length
  );
}

const PRICE_BANDS = [
  { label: 'Under ₹2,000', min: '', max: '2000' },
  { label: '₹2,000–5,000', min: '2000', max: '5000' },
  { label: '₹5,000–10,000', min: '5000', max: '10000' },
  { label: '₹10,000+', min: '10000', max: '' },
];

const STAR_OPTIONS: { value: StayFilters['stars']; label: string }[] = [
  { value: '', label: 'Any' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '5', label: '5' },
];

type ToggleKey = 'coupleFriendly' | 'localId' | 'pets' | 'freeCancellation';
const RULE_TOGGLES: { key: ToggleKey; label: string; hint?: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'coupleFriendly', label: 'Couple-friendly', hint: 'Unmarried couples welcome', icon: 'heart-outline' },
  { key: 'localId', label: 'Local ID accepted', hint: 'Guests from the same city can check in', icon: 'card-outline' },
  { key: 'pets', label: 'Pets allowed', icon: 'paw-outline' },
  { key: 'freeCancellation', label: 'Free cancellation', icon: 'shield-checkmark-outline' },
];

const digits = (s: string) => s.replace(/[^\d]/g, '').slice(0, 7);

function FilterChip({ on, label, onPress, icon }: { on: boolean; label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { themeColors, brand, isDarkMode } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? brand[500] : themeColors.border },
        on && { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.18)' : brand[50] },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Text style={[styles.chipText, { color: on ? (isDarkMode ? brand[300] : brand[700]) : themeColors.text }]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={12} color="#F59E0B" /> : null}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.section, { borderBottomColor: themeColors.border }]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export function StayFiltersSheet({
  visible,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: StayFilters;
  onApply: (f: StayFilters) => void;
  onClose: () => void;
}) {
  const { themeColors, brand } = useTheme();
  const [draft, setDraft] = useState<StayFilters>(value);
  const [allTypes, setAllTypes] = useState(false);

  // Each opening starts from what's applied.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const patch = (p: Partial<StayFilters>) => setDraft((d) => ({ ...d, ...p }));
  const toggleIn = (key: 'types' | 'amenities', id: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));

  const apply = () => {
    let { minPrice, maxPrice } = draft;
    // Swap a back-to-front pair instead of finding nothing.
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) [minPrice, maxPrice] = [maxPrice, minPrice];
    onApply({ ...draft, minPrice, maxPrice });
  };

  const active = countFilters(draft);
  const priceBox = [styles.priceBox, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }];

  return (
    <StaySheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      headerAction={
        active > 0 ? (
          <TouchableOpacity onPress={() => setDraft(EMPTY_FILTERS)} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clear, { color: brand[600] }]}>Clear all</Text>
          </TouchableOpacity>
        ) : null
      }
      footer={<Button title={active ? `Show stays (${active} filter${active === 1 ? '' : 's'})` : 'Show stays'} onPress={apply} size="lg" fullWidth />}
    >
      <Section title="Price per night">
        <View style={styles.chips}>
          {PRICE_BANDS.map((b) => {
            const on = draft.minPrice === b.min && draft.maxPrice === b.max;
            return (
              <FilterChip
                key={b.label}
                on={on}
                label={b.label}
                onPress={() => patch(on ? { minPrice: '', maxPrice: '' } : { minPrice: b.min, maxPrice: b.max })}
              />
            );
          })}
        </View>
        <View style={styles.priceRow}>
          <View style={priceBox}>
            <Text style={[styles.rupee, { color: themeColors.textTertiary }]}>₹</Text>
            <RNTextInput
              value={draft.minPrice}
              onChangeText={(t) => patch({ minPrice: digits(t) })}
              placeholder="Min"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="number-pad"
              style={[styles.priceInput, { color: themeColors.text }]}
              accessibilityLabel="Minimum price per night"
            />
          </View>
          <Text style={{ color: themeColors.textTertiary }}>–</Text>
          <View style={priceBox}>
            <Text style={[styles.rupee, { color: themeColors.textTertiary }]}>₹</Text>
            <RNTextInput
              value={draft.maxPrice}
              onChangeText={(t) => patch({ maxPrice: digits(t) })}
              placeholder="Max"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="number-pad"
              style={[styles.priceInput, { color: themeColors.text }]}
              accessibilityLabel="Maximum price per night"
            />
          </View>
        </View>
        <Text style={[styles.hint, { color: themeColors.textSecondary }]}>Per room, before taxes.</Text>
      </Section>

      <Section title="Good to know">
        {RULE_TOGGLES.map((t) => {
          const on = draft[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => patch({ [t.key]: !on } as Partial<StayFilters>)}
              style={styles.toggleRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <View style={[styles.box, { borderColor: on ? brand[500] : themeColors.border, backgroundColor: on ? brand[500] : 'transparent' }]}>
                {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.toggleLabelRow}>
                  <Ionicons name={t.icon} size={14} color={themeColors.textTertiary} />
                  <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{t.label}</Text>
                </View>
                {t.hint ? <Text style={[styles.hint, { color: themeColors.textSecondary, marginTop: 0 }]}>{t.hint}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </Section>

      <Section title="Star rating">
        <View style={styles.chips}>
          {STAR_OPTIONS.map((o) => (
            <FilterChip
              key={o.value || 'any'}
              on={draft.stars === o.value}
              label={o.label}
              icon={o.value ? 'star' : undefined}
              onPress={() => patch({ stars: o.value })}
            />
          ))}
        </View>
      </Section>

      <Section title="Property type">
        {STAY_CATEGORIES.map((cat) => {
          const types = typesIn(cat.id).filter((t) => allTypes || t.common || draft.types.includes(t.id));
          return (
            <View key={cat.id} style={{ marginBottom: spacing.md }}>
              <Text style={[styles.catLabel, { color: themeColors.textSecondary }]}>{cat.label}</Text>
              <View style={styles.chips}>
                {types.map((t) => (
                  <FilterChip key={t.id} on={draft.types.includes(t.id)} label={t.label} onPress={() => toggleIn('types', t.id)} />
                ))}
              </View>
            </View>
          );
        })}
        <TouchableOpacity onPress={() => setAllTypes((v) => !v)} accessibilityRole="button">
          <Text style={[styles.link, { color: brand[600] }]}>{allTypes ? 'Show fewer types' : 'Show all types'}</Text>
        </TouchableOpacity>
      </Section>

      <Section title="Amenities">
        <View style={styles.chips}>
          {AMENITY_FILTERS.map((a) => (
            <FilterChip key={a.id} on={draft.amenities.includes(a.id)} label={a.label} onPress={() => toggleIn('amenities', a.id)} />
          ))}
        </View>
      </Section>
    </StaySheet>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  priceBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
  },
  rupee: { fontSize: fontSize.md, marginRight: 4 },
  priceInput: { flex: 1, fontSize: fontSize.md, paddingVertical: 10 },
  hint: { fontSize: fontSize.xs, marginTop: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: fontSize.md },
  catLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  clear: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
