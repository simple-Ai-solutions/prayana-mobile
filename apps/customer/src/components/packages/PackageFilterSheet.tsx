// PackageFilterSheet — bottom-sheet filters matching the web packages sidebar:
//   Duration (dual-thumb nights range) · Budget (dual-thumb ₹ range) ·
//   Cities (multi-select checkboxes, top 15 by count) · Themes (single-select).
// Bounds come from GET /packages/facets. Filters auto-apply live on change
// (onApply per change); a "Clear all" resets; the mobile "Show packages"
// button just dismisses. No Apply button, matching the PWA.
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, PanResponder, LayoutChangeEvent } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

const BLUE = '#008cff';

export interface PackageFilters {
  minBudget?: number;
  maxBudget?: number;
  minNights?: number;
  maxNights?: number;
  cities?: string; // comma-separated (multi-select)
  category?: string; // single-select theme
}

// Fallback theme order if facets haven't loaded yet. The REAL list is derived
// from facets.category at render time — a hardcoded list showed themes with
// zero packages (Wildlife Safari / Luxury Escape / Budget Travel) that filtered
// to nothing, and hid real ones like "Group Tour". Only show themes that exist.
const FALLBACK_CATEGORIES = ['Holiday Package', 'Cultural Heritage', 'Group Tour', 'Honeymoon', 'Family', 'Beach', 'Pilgrimage', 'Hill Station'];

interface Props {
  open: boolean;
  facets: any | null;
  value: PackageFilters;
  onClose: () => void;
  onApply: (f: PackageFilters) => void; // called live on each change
  resultCount?: number;
}

// ── Pure-JS dual-thumb range slider (no native dependency) ──
function RangeSlider({
  min, max, step = 1, low, high, onChange, format,
}: {
  min: number; max: number; step?: number;
  low: number; high: number;
  onChange: (lo: number, hi: number) => void;
  format: (v: number) => string;
}) {
  const [w, setW] = useState(0);
  const span = Math.max(1, max - min);
  const clampStep = (v: number) => Math.round(Math.round(v / step) * step);
  const toX = (v: number) => (w ? ((v - min) / span) * w : 0);
  const fromX = (x: number) => clampStep(min + (Math.max(0, Math.min(w, x)) / (w || 1)) * span);

  const lowRef = useRef(low); lowRef.current = low;
  const highRef = useRef(high); highRef.current = high;

  const mkResponder = (which: 'low' | 'high') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        const x = which === 'low' ? toX(lowRef.current) + g.dx : toX(highRef.current) + g.dx;
        const v = fromX(x);
        if (which === 'low') onChange(Math.min(v, highRef.current - step), highRef.current);
        else onChange(lowRef.current, Math.max(v, lowRef.current + step));
      },
    });

  const lowPan = useRef(mkResponder('low')).current;
  const highPan = useRef(mkResponder('high')).current;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const lowX = toX(low);
  const highX = toX(high);

  return (
    <View>
      <View style={sl.track} onLayout={onLayout}>
        <View style={[sl.fill, { left: lowX, width: Math.max(0, highX - lowX) }]} />
        <View {...lowPan.panHandlers} style={[sl.thumb, { left: lowX - 11 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} />
        <View {...highPan.panHandlers} style={[sl.thumb, { left: highX - 11 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} />
      </View>
      <View style={sl.labels}>
        <Text style={sl.labelText}>{format(low)}</Text>
        <Text style={sl.labelText}>{format(high)}</Text>
      </View>
    </View>
  );
}

function Accordion({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.accordion, { borderBottomColor: themeColors.border }]}>
      <TouchableOpacity style={styles.accHead} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <Text style={[styles.accTitle, { color: themeColors.text }]}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textTertiary} />
      </TouchableOpacity>
      {open && <View style={{ marginTop: spacing.sm }}>{children}</View>}
    </View>
  );
}

export function PackageFilterSheet({ open, facets, value, onClose, onApply, resultCount }: Props) {
  const { themeColors } = useTheme();
  const [draft, setDraft] = useState<PackageFilters>(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const nightsBounds: [number, number] = facets?.nights?.length === 2 ? facets.nights : [1, 14];
  const priceBounds: [number, number] = facets?.price?.length === 2 ? facets.price : [0, 100000];

  const cities = useMemo(() => {
    const c = facets?.city && typeof facets.city === 'object' ? facets.city : {};
    return Object.entries(c).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0, 15) as [string, number][];
  }, [facets]);
  const catCounts = facets?.category && typeof facets.category === 'object' ? facets.category : {};
  // Themes come from the facets (only categories that actually have packages,
  // ordered by count) — never a stale hardcoded list. Always lead with "All".
  const themeList = useMemo(() => {
    const keys = Object.keys(catCounts);
    const ordered = keys.length
      ? keys.sort((a, b) => (catCounts[b] as number) - (catCounts[a] as number))
      : FALLBACK_CATEGORIES;
    return ['All', ...ordered];
  }, [catCounts]);

  // Apply a patch live (matches the web's debounced auto-apply, minus the delay).
  const patch = (p: Partial<PackageFilters>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    onApply(next);
  };

  const selectedCities = (draft.cities || '').split(',').filter(Boolean);
  const toggleCity = (city: string) => {
    const next = selectedCities.includes(city) ? selectedCities.filter((c) => c !== city) : [...selectedCities, city];
    patch({ cities: next.join(',') || undefined });
  };

  const clearAll = () => { setDraft({}); onApply({}); };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: themeColors.background }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="options-outline" size={16} color={BLUE} />
            <Text style={[styles.title, { color: themeColors.text }]}>Filters</Text>
          </View>
          <TouchableOpacity onPress={clearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clear}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Accordion title="DURATION (IN NIGHTS)">
            <RangeSlider
              min={nightsBounds[0]} max={nightsBounds[1]} step={1}
              low={draft.minNights ?? nightsBounds[0]}
              high={draft.maxNights ?? nightsBounds[1]}
              onChange={(lo, hi) => patch({
                minNights: lo > nightsBounds[0] ? lo : undefined,
                maxNights: hi < nightsBounds[1] ? hi : undefined,
              })}
              format={(v) => `${v}N`}
            />
          </Accordion>

          <Accordion title="BUDGET (PER PERSON)">
            <RangeSlider
              min={priceBounds[0]} max={priceBounds[1]} step={1000}
              low={draft.minBudget ?? priceBounds[0]}
              high={draft.maxBudget ?? priceBounds[1]}
              onChange={(lo, hi) => patch({
                minBudget: lo > priceBounds[0] ? lo : undefined,
                maxBudget: hi < priceBounds[1] ? hi : undefined,
              })}
              format={(v) => `₹${Math.round(v / 1000)}k`}
            />
          </Accordion>

          {cities.length > 0 && (
            <Accordion title="CITIES" defaultOpen={false}>
              <View style={{ maxHeight: 220 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {cities.map(([city, n]) => {
                    const checked = selectedCities.includes(city);
                    return (
                      <TouchableOpacity key={city} style={styles.optRow} onPress={() => toggleCity(city)} activeOpacity={0.7}>
                        <View style={[styles.checkbox, checked && { backgroundColor: BLUE, borderColor: BLUE }]}>
                          {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={[styles.optLabel, { color: checked ? BLUE : themeColors.text }]} numberOfLines={1}>{city}</Text>
                        <Text style={[styles.optCount, { color: themeColors.textTertiary }]}>{n}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Accordion>
          )}

          <Accordion title="THEMES">
            <View style={{ maxHeight: 260 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {themeList.map((c) => {
                  const active = (draft.category || 'All') === c;
                  const count = c === 'All' ? (resultCount ?? undefined) : (catCounts[c] || 0);
                  return (
                    <TouchableOpacity key={c} style={styles.optRow} onPress={() => patch({ category: c === 'All' ? undefined : c })} activeOpacity={0.7}>
                      <View style={[styles.radio, active && { borderColor: BLUE }]}>{active && <View style={styles.radioDot} />}</View>
                      <Text style={[styles.optLabel, { color: active ? BLUE : themeColors.text }]} numberOfLines={1}>{c}</Text>
                      {count != null && <Text style={[styles.optCount, { color: themeColors.textTertiary }]}>{count}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Accordion>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          <TouchableOpacity style={styles.showBtn} onPress={onClose}>
            <Text style={styles.showBtnText}>
              Show{resultCount != null ? ` ${resultCount}` : ''} package{resultCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const sl = StyleSheet.create({
  track: { height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginTop: 14, marginBottom: 6, justifyContent: 'center' },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: BLUE },
  thumb: { position: 'absolute', top: -9, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: BLUE, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  labelText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF', alignSelf: 'center', marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  clear: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: BLUE },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  accordion: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md },
  accHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accTitle: { fontSize: 13, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: BLUE },
  optLabel: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  optCount: { fontSize: 12 },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  showBtn: { backgroundColor: BLUE, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center' },
  showBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

export default PackageFilterSheet;
