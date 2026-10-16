// A destination edition — /experiences-in/<slug> (web parity). India keeps its
// bespoke page, so its slug forwards to /india-experiences.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { getEditionBySlug } from '../../lib/destinationEditions';
import { goBack } from '../../lib/goBack';
import { DestinationEditionView } from '../../components/experiences/DestinationEditionView';

export default function DestinationEditionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const edition = getEditionBySlug(String(slug || ''));

  if (edition?.href) return <Redirect href={edition.href as any} />;
  if (edition) return <DestinationEditionView key={edition.slug} edition={edition} />;
  return <NotFound />;
}

function NotFound() {
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.top}>
        <Pressable
          onPress={() => goBack('/experiences-in')}
          hitSlop={10}
          style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </Pressable>
      </View>
      <View style={s.body}>
        <View style={s.icon}>
          <Ionicons name="map-outline" size={30} color="#F97316" />
        </View>
        <Text style={[s.title, { color: themeColors.text }]}>We haven&apos;t written this edition yet</Text>
        <Text style={[s.sub, { color: themeColors.textSecondary }]}>
          This destination isn&apos;t one of our magazine editions — but there are plenty more to flip through.
        </Text>
        <Pressable onPress={() => router.replace('/experiences-in' as any)} style={s.btn} accessibilityRole="button">
          <Text style={s.btnText}>See all editions</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/global-experiences' as any)} hitSlop={8} accessibilityRole="button">
          <Text style={[s.link, { color: themeColors.textSecondary }]}>Browse experiences worldwide</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  top: { paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12, paddingBottom: 80 },
  icon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.12)' },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  sub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  btn: { marginTop: 8, height: 48, paddingHorizontal: 24, borderRadius: 24, justifyContent: 'center', backgroundColor: '#F97316' },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '700', marginTop: 4 },
});
