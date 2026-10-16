// The search box every Things-to-Do category page shares (Tours, Nightlife,
// Food, Photo Tours, Markets and the rest). It sits above the page's own
// layout and searches that category on the server (`q`), so a match is found
// among every listing, not only the ones already loaded. Coloured per page.
import React from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type SearchTone = { bg: string; field: string; text: string; muted: string; tint: string; border: string };

export const SEARCH_TONES: Record<string, SearchTone> = {
  light: { bg: '#ffffff', field: '#f3f4f6', text: '#111827', muted: '#9ca3af', tint: '#f97316', border: 'rgba(15,23,42,0.06)' },
  dark: { bg: '#07060C', field: '#16141f', text: '#f4f4f6', muted: '#8b8798', tint: '#FF2E88', border: 'rgba(255,255,255,0.08)' },
  tours: { bg: '#ffffff', field: '#f0fdfa', text: '#0f172a', muted: '#7c9a96', tint: '#0f766e', border: 'rgba(15,118,110,0.15)' },
  food: { bg: '#FFFAF3', field: '#ffffff', text: '#1f1410', muted: '#a58f80', tint: '#EF3B2D', border: 'rgba(239,59,45,0.15)' },
  photo: { bg: '#FAFAF7', field: '#ffffff', text: '#111111', muted: '#9a9a92', tint: '#111111', border: 'rgba(17,17,17,0.1)' },
  markets: { bg: '#FFF8EE', field: '#ffffff', text: '#2a1608', muted: '#a8907a', tint: '#E2462B', border: 'rgba(226,70,43,0.15)' },
};

export function CategorySearchBar({ value, onChange, onBack, placeholder, tone = SEARCH_TONES.light, busy }: {
  value: string;
  onChange: (t: string) => void;
  /** Shown only when the page below has no back button of its own. */
  onBack?: () => void;
  placeholder: string;
  tone?: SearchTone;
  /** A search is in flight. */
  busy?: boolean;
}) {
  return (
    <View style={[s.bar, { backgroundColor: tone.bg, borderBottomColor: tone.border }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={[s.back, { backgroundColor: tone.field }]} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={tone.text} />
        </Pressable>
      ) : null}
      <View style={[s.field, { backgroundColor: tone.field, borderColor: tone.border }]}>
        <Ionicons name="search" size={17} color={tone.tint} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={tone.muted}
          style={[s.input, { color: tone.text }]}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={placeholder}
        />
        {busy ? (
          <ActivityIndicator size="small" color={tone.tint} />
        ) : value ? (
          <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={tone.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, height: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
