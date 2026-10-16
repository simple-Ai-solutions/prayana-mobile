// InfoTopBar — the round back button + bold title bar used by the info pages
// (support, legal, careers). Same look as Settings → Privacy choices.
// `floating` drops the title and sits the button over a hero image.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { useGoBack } from '../../lib/goBack';

interface Props {
  title?: string;
  floating?: boolean;
  right?: React.ReactNode;
}

export function InfoTopBar({ title, floating = false, right }: Props) {
  const insets = useSafeAreaInsets();
  const goBack = useGoBack();
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';

  if (floating) {
    return (
      <View style={[s.floating, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={goBack} hitSlop={10} style={[s.round, s.glass]} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color="#fff" />
        </Pressable>
        {right}
      </View>
    );
  }

  return (
    <View style={[s.top, { paddingTop: insets.top + 8, backgroundColor: themeColors.background }]}>
      <Pressable onPress={goBack} hitSlop={10} style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={21} color={themeColors.text} />
      </Pressable>
      {title ? <Text style={[s.title, { color: themeColors.text }]} numberOfLines={1}>{title}</Text> : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  floating: { position: 'absolute', left: 16, right: 16, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  glass: { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.25)' },
  title: { fontSize: 22, fontWeight: '900', flexShrink: 1 },
});

export default InfoTopBar;
