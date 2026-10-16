// Destination editions — every magazine-style country edition as a cover.
// The first is the cover story; the rest sit two-up.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { DESTINATION_EDITIONS } from '../../lib/destinationEditions';
import { EditionPoster } from '../../components/experiences/EditionPoster';
import { RAIL_PAD } from '../../lib/railLayout';
import { useGoBack } from '../../lib/goBack';

const ORANGE = '#F97316';
const SCREEN_W = Dimensions.get('window').width;
const GAP = 12;
const FULL_W = SCREEN_W - RAIL_PAD * 2;
const HALF_W = Math.floor((FULL_W - GAP) / 2);

export default function DestinationEditionsScreen() {
  const { themeColors, isDarkMode } = useTheme();
  const back = useGoBack('/global-experiences');
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const [lead, ...rest] = DESTINATION_EDITIONS;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.top}>
        <Pressable
          onPress={back}
          hitSlop={10}
          style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </Pressable>
        <Text style={[s.topTitle, { color: themeColors.text }]}>Destination editions</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
        <View style={s.intro}>
          <View style={[s.pill, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.14)' : '#FFF1E7' }]}>
            <Ionicons name="book-outline" size={13} color={ORANGE} />
            <Text style={s.pillText}>{DESTINATION_EDITIONS.length} EDITIONS</Text>
          </View>
          <Text style={[s.title, { color: themeColors.text }]}>
            Pick a country, <Text style={{ color: ORANGE }}>read it like a magazine.</Text>
          </Text>
          <Text style={[s.sub, { color: themeColors.textSecondary }]}>
            An editor&apos;s letter, the cities worth your time and every bookable experience — one country at a time.
          </Text>
        </View>

        {lead && (
          <View style={s.leadWrap}>
            <EditionPoster edition={lead} width={FULL_W} height={Math.round(FULL_W * 0.62)} />
          </View>
        )}

        <View style={s.grid}>
          {rest.map((e) => (
            <EditionPoster key={e.slug} edition={e} width={HALF_W} height={Math.round(HALF_W * 1.35)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: RAIL_PAD, paddingVertical: 8 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  body: { paddingBottom: 40 },
  intro: { paddingHorizontal: RAIL_PAD, paddingTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { color: ORANGE, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.9, lineHeight: 33, marginTop: 12 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  leadWrap: { paddingHorizontal: RAIL_PAD, marginTop: 22 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GAP,
    paddingHorizontal: RAIL_PAD,
    marginTop: GAP,
  },
});
