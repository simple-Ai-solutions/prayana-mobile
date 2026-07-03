// PackingList — categorized packing checklist with progress tracking, persisted
// per-destination via AsyncStorage. Mirrors the PWA itinerary PackingList.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Check, ChevronDown, ChevronUp, Luggage } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TEAL = '#2EC4B6';

// Category -> items. Tailored to typical trips; extended with weather-aware items.
const CATEGORIES: { id: string; title: string; emoji: string; items: string[] }[] = [
  { id: 'docs', title: 'Documents', emoji: '📄', items: ['ID / Passport', 'Tickets / Boarding pass', 'Hotel bookings', 'Travel insurance', 'Cash & cards'] },
  { id: 'clothing', title: 'Clothing', emoji: '👕', items: ['T-shirts', 'Pants / Jeans', 'Innerwear', 'Comfortable walking shoes', 'Jacket / Sweater', 'Sleepwear'] },
  { id: 'toiletries', title: 'Toiletries', emoji: '🧴', items: ['Toothbrush & paste', 'Soap / Body wash', 'Shampoo', 'Sunscreen', 'Sanitizer', 'Personal medication'] },
  { id: 'electronics', title: 'Electronics', emoji: '🔌', items: ['Phone & charger', 'Power bank', 'Earphones', 'Camera', 'Universal adapter'] },
  { id: 'essentials', title: 'Travel Essentials', emoji: '🎒', items: ['Reusable water bottle', 'Sunglasses', 'Umbrella / Raincoat', 'Snacks', 'First-aid kit', 'Day backpack'] },
];

interface Props {
  destination: string;
}

export const PackingList: React.FC<Props> = ({ destination }) => {
  const { themeColors, isDarkMode } = useTheme();
  const storageKey = `packing:${(destination || 'trip').toLowerCase()}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) setChecked(JSON.parse(saved));
      } catch {}
    })();
  }, [storageKey]);

  const persist = useCallback((next: Record<string, boolean>) => {
    setChecked(next);
    AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
  }, [storageKey]);

  const toggleItem = useCallback((key: string) => {
    persist({ ...checked, [key]: !checked[key] });
  }, [checked, persist]);

  const toggleCategory = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  const { total, done } = useMemo(() => {
    const all = CATEGORIES.flatMap((c) => c.items.map((it) => `${c.id}:${it}`));
    return { total: all.length, done: all.filter((k) => checked[k]).length };
  }, [checked]);

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header + progress */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Luggage size={20} color={TEAL} />
          <Text style={[styles.title, { color: themeColors.text }]}>Packing List</Text>
        </View>
        <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>{done}/{total}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      {CATEGORIES.map((cat) => {
        const isCollapsed = collapsed[cat.id];
        const catDone = cat.items.filter((it) => checked[`${cat.id}:${it}`]).length;
        return (
          <View key={cat.id} style={[styles.category, { borderColor: themeColors.border }]}>
            <TouchableOpacity style={styles.catHeader} onPress={() => toggleCategory(cat.id)} activeOpacity={0.7}>
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catTitle, { color: themeColors.text }]}>{cat.title}</Text>
              <Text style={[styles.catCount, { color: themeColors.textTertiary }]}>{catDone}/{cat.items.length}</Text>
              {isCollapsed ? <ChevronDown size={18} color={themeColors.textTertiary} /> : <ChevronUp size={18} color={themeColors.textTertiary} />}
            </TouchableOpacity>
            {!isCollapsed && (
              <View style={styles.items}>
                {cat.items.map((it) => {
                  const key = `${cat.id}:${it}`;
                  const on = !!checked[key];
                  return (
                    <TouchableOpacity key={key} style={styles.item} onPress={() => toggleItem(key)} activeOpacity={0.7}>
                      <View style={[styles.checkbox, { borderColor: on ? TEAL : themeColors.border, backgroundColor: on ? TEAL : 'transparent' }]}>
                        {on && <Check size={13} color="#fff" />}
                      </View>
                      <Text style={[styles.itemText, { color: on ? themeColors.textTertiary : themeColors.text, textDecorationLine: on ? 'line-through' : 'none' }]}>
                        {it}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  progressText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.lg },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: TEAL },
  category: { borderWidth: 1, borderRadius: borderRadius.lg, marginBottom: spacing.md, overflow: 'hidden' },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  catEmoji: { fontSize: fontSize.lg },
  catTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  catCount: { fontSize: fontSize.xs, marginRight: spacing.xs },
  items: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: fontSize.sm, flex: 1 },
});
