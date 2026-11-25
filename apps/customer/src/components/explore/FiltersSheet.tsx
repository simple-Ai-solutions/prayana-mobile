// Explore filters: budget, city and rating. All three are applied by the
// server (/activities/search minPrice / maxPrice / city / minRating), so the
// result count and "load more" stay right. Duration and "this weekend" need
// server support first.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';

export type ExploreFilters = { budget: string; city: string; minRating: number };
export const NO_FILTERS: ExploreFilters = { budget: 'any', city: '', minRating: 0 };

export const BUDGETS = [
  { key: 'any', label: 'Any budget' },
  { key: 'u3', label: 'Under ₹3,000', max: 3000 },
  { key: '3-6', label: '₹3,000 – ₹6,000', min: 3000, max: 6000 },
  { key: '6+', label: '₹6,000+', min: 6000 },
] as const;

/** Server query params for these filters. */
export function filterParams(f: ExploreFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const b: any = BUDGETS.find((x) => x.key === f.budget);
  if (b?.min) out.minPrice = String(b.min);
  if (b?.max) out.maxPrice = String(b.max);
  if (f.city) out.city = f.city;
  if (f.minRating) out.minRating = String(f.minRating);
  return out;
}

export const activeFilterCount = (f: ExploreFilters) =>
  (f.budget !== 'any' ? 1 : 0) + (f.city ? 1 : 0) + (f.minRating ? 1 : 0);

export function FiltersSheet({ visible, value, cities, onApply, onClose }: {
  visible: boolean;
  value: ExploreFilters;
  /** Cities to offer, most experiences first. */
  cities: string[];
  onApply: (f: ExploreFilters) => void;
  onClose: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        { borderColor: on ? '#f97316' : themeColors.border, backgroundColor: on ? (isDarkMode ? 'rgba(249,115,22,0.18)' : '#FFF1E7') : themeColors.surface },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[s.chipText, { color: on ? '#EA580C' : themeColors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: themeColors.surface }]} onPress={() => {}}>
          <View style={s.handle} />
          <View style={s.head}>
            <Text style={[s.title, { color: themeColors.text }]}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={themeColors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={[s.label, { color: themeColors.textSecondary }]}>BUDGET PER PERSON</Text>
            <View style={s.row}>
              {BUDGETS.map((b) => (
                <Chip key={b.key} on={draft.budget === b.key} label={b.label} onPress={() => setDraft({ ...draft, budget: b.key })} />
              ))}
            </View>

            {cities.length > 0 && (
              <>
                <Text style={[s.label, { color: themeColors.textSecondary }]}>CITY</Text>
                <View style={s.row}>
                  <Chip on={!draft.city} label="Anywhere" onPress={() => setDraft({ ...draft, city: '' })} />
                  {cities.map((c) => (
                    <Chip key={c} on={draft.city === c} label={c} onPress={() => setDraft({ ...draft, city: c })} />
                  ))}
                </View>
              </>
            )}

            <Text style={[s.label, { color: themeColors.textSecondary }]}>RATING</Text>
            <View style={s.row}>
              <Chip on={!draft.minRating} label="Any rating" onPress={() => setDraft({ ...draft, minRating: 0 })} />
              <Chip on={draft.minRating === 4} label="★ 4.0+" onPress={() => setDraft({ ...draft, minRating: 4 })} />
              <Chip on={draft.minRating === 4.5} label="★ 4.5+" onPress={() => setDraft({ ...draft, minRating: 4.5 })} />
            </View>
          </ScrollView>

          <View style={[s.foot, { borderTopColor: themeColors.border }]}>
            <Pressable onPress={() => setDraft(NO_FILTERS)} style={s.clear} hitSlop={8}>
              <Text style={[s.clearText, { color: themeColors.text }]}>Clear all</Text>
            </Pressable>
            <Pressable onPress={() => onApply(draft)} style={s.apply} accessibilityRole="button">
              <Text style={s.applyText}>Show results</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, maxHeight: '80%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(127,127,140,0.4)', marginBottom: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, marginTop: 18, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13.5, fontWeight: '700' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingBottom: 28 },
  clear: { paddingHorizontal: 8, paddingVertical: 12 },
  clearText: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  apply: { flex: 1, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  applyText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
