// PackageFilterSheet — bottom-sheet filters for the holiday-packages listing,
// the mobile port of the web filter accordions (Budget / Duration / City).
// Budget & duration are preset buckets (bounded by /packages/facets); cities
// come from the facet counts. Selections map to /packages/search params
// (maxBudget, minNights/maxNights, cities). Single-select per group; "Any"
// clears the group.
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

export interface PackageFilters {
  maxBudget?: number;
  minNights?: number;
  maxNights?: number;
  city?: string;
}

interface Props {
  open: boolean;
  facets: any | null;
  value: PackageFilters;
  onClose: () => void;
  onApply: (f: PackageFilters) => void;
}

const BUDGETS = [
  { label: 'Under ₹15k', maxBudget: 15000 },
  { label: 'Under ₹30k', maxBudget: 30000 },
  { label: 'Under ₹50k', maxBudget: 50000 },
  { label: 'Under ₹1L', maxBudget: 100000 },
];

const DURATIONS = [
  { label: '≤ 3 nights', minNights: undefined, maxNights: 3 },
  { label: '4–6 nights', minNights: 4, maxNights: 6 },
  { label: '7–10 nights', minNights: 7, maxNights: 10 },
  { label: '10+ nights', minNights: 10, maxNights: undefined },
];

export function PackageFilterSheet({ open, facets, value, onClose, onApply }: Props) {
  const { themeColors } = useTheme();
  const [draft, setDraft] = useState<PackageFilters>(value);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  // Top cities from facet counts (label → count), most-stocked first.
  const cities = useMemo(() => {
    const c = facets?.city && typeof facets.city === 'object' ? facets.city : {};
    return Object.entries(c)
      .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
      .slice(0, 12)
      .map(([name]) => name as string);
  }, [facets]);

  const budgetActive = (b: number) => draft.maxBudget === b;
  const durActive = (d: { minNights?: number; maxNights?: number }) =>
    draft.minNights === d.minNights && draft.maxNights === d.maxNights;

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? '#0d9488' : themeColors.border, backgroundColor: active ? '#0d948818' : 'transparent' }]}
    >
      <Text style={[styles.chipText, { color: active ? '#0d9488' : themeColors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: themeColors.background }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Filters</Text>
          <TouchableOpacity onPress={() => setDraft({})} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clear}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Text style={[styles.group, { color: themeColors.text }]}>Budget (per person)</Text>
          <View style={styles.chipWrap}>
            <Chip active={draft.maxBudget == null} label="Any" onPress={() => setDraft((d) => ({ ...d, maxBudget: undefined }))} />
            {BUDGETS.map((b) => (
              <Chip key={b.label} active={budgetActive(b.maxBudget)} label={b.label} onPress={() => setDraft((d) => ({ ...d, maxBudget: b.maxBudget }))} />
            ))}
          </View>

          <Text style={[styles.group, { color: themeColors.text }]}>Duration</Text>
          <View style={styles.chipWrap}>
            <Chip active={draft.minNights == null && draft.maxNights == null} label="Any" onPress={() => setDraft((d) => ({ ...d, minNights: undefined, maxNights: undefined }))} />
            {DURATIONS.map((dn) => (
              <Chip key={dn.label} active={durActive(dn)} label={dn.label} onPress={() => setDraft((d) => ({ ...d, minNights: dn.minNights, maxNights: dn.maxNights }))} />
            ))}
          </View>

          {cities.length > 0 && (
            <>
              <Text style={[styles.group, { color: themeColors.text }]}>Destination</Text>
              <View style={styles.chipWrap}>
                <Chip active={!draft.city} label="Any" onPress={() => setDraft((d) => ({ ...d, city: undefined }))} />
                {cities.map((c) => (
                  <Chip key={c} active={draft.city === c} label={c} onPress={() => setDraft((d) => ({ ...d, city: d.city === c ? undefined : c }))} />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(draft)}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.applyText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF', alignSelf: 'center', marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  clear: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#0d9488' },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  group: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8 },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0d9488', borderRadius: 999, paddingVertical: 15 },
  applyText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

export default PackageFilterSheet;
