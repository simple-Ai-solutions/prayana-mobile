// Every destination the catalogue sells, on its own screen: a search box and
// the countries grouped A–Z under sticky letter headings. Opened from "View
// all N countries" so the eSIM page itself only previews a handful.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prayana/shared-ui';
import { EsimCountryListRow, BrowseDeal } from './EsimBrowse';
import { ESIM_RED } from './EsimPass';

export function EsimAllCountriesSheet({ visible, countries, deals, onClose, onPick }: {
  visible: boolean;
  countries: { iso: string; name: string }[];
  deals: Record<string, BrowseDeal | undefined>;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';

  const sections = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query ? countries.filter((c) => c.name.toLowerCase().includes(query)) : countries;
    const byLetter = new Map<string, typeof countries>();
    for (const c of list) {
      const letter = c.name.charAt(0).toUpperCase();
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), c]);
    }
    return [...byLetter.entries()].map(([title, data]) => ({ title, data }));
  }, [countries, q]);

  const close = () => { setQ(''); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <View style={[s.wrap, { backgroundColor: themeColors.background, paddingTop: insets.top + 6 }]}>
        <View style={s.head}>
          <Pressable onPress={close} hitSlop={10} style={[s.close, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={20} color={themeColors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: themeColors.text }]}>All destinations</Text>
            <Text style={[s.sub, { color: themeColors.textSecondary }]}>{countries.length} countries · instant eSIM delivery</Text>
          </View>
        </View>

        <View style={[s.search, { backgroundColor: themeColors.surface, borderColor: line }]}>
          <Ionicons name="search" size={18} color={themeColors.textTertiary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search a country"
            placeholderTextColor={themeColors.textTertiary}
            style={[s.input, { color: themeColors.text }]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
            </Pressable>
          ) : null}
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(c) => c.iso}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 + insets.bottom }}
          renderSectionHeader={({ section }) => (
            <View style={[s.letterRow, { backgroundColor: themeColors.background }]}>
              <Text style={[s.letter, { color: ESIM_RED }]}>{section.title}</Text>
              <View style={[s.letterLine, { backgroundColor: line }]} />
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 10 }}>
              <EsimCountryListRow iso={item.iso} name={item.name} deal={deals[item.iso]} onPress={() => onPick(item.iso)} />
            </View>
          )}
          ListEmptyComponent={
            <Text style={[s.empty, { color: themeColors.textSecondary }]}>No destination matches "{q.trim()}".</Text>
          }
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  sub: { fontSize: 12.5, marginTop: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 48, marginHorizontal: 16, marginBottom: 6 },
  input: { flex: 1, fontSize: 15.5 },
  letterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 8 },
  letter: { fontSize: 15, fontWeight: '900' },
  letterLine: { flex: 1, height: 1 },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 14 },
});
