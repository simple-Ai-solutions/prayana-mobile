// Browse pieces for the eSIM page:
//   - EsimCountryRail: a titled row of two whole destination cards across,
//     moved a pair at a time (the home screen's rail rules);
//   - EsimCountryListRow: one destination as a compact row for the A–Z list
//     and search results;
//   - EsimGuideCard + EsimGuideSheet: "New to eSIM?" — the explainers
//     (why Prayana, how it works, compatible phones, FAQ) behind one tap
//     instead of filling the page.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prayana/shared-ui';
import { CountryFlag } from './CountryFlag';
import { EsimCountryCard } from './EsimCountryCard';
import { ESIM_RED, inr } from './EsimPass';
import { EsimWhyCard } from './EsimLandingExtras';
import { EsimHowItWorks } from './EsimHowItWorks';
import { EsimCompatibleDevices } from './EsimCompatibleDevices';
import { EsimFAQ } from './EsimFAQ';
import { countryImage } from '../../lib/countryAssets';
import { RAIL_GAP, RAIL_PAD, TWO_UP_SNAP, TWO_UP_W, usePairSnap } from '../../lib/railLayout';

export type BrowseDeal = {
  fromINR?: number; mrpINR?: number; discountPercent?: number; dataLabel?: string; planCount?: number; has5G?: boolean;
};

export function EsimCountryRail({ title, subtitle, icon, iconColors, countries, deals, onPick }: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColors: [string, string];
  countries: { iso: string; name: string }[];
  deals: Record<string, BrowseDeal | undefined>;
  onPick: (iso: string) => void;
}) {
  const { themeColors } = useTheme();
  const snap = usePairSnap(TWO_UP_SNAP);
  if (!countries.length) return null;
  return (
    <View style={s.rail}>
      <View style={s.railHead}>
        <LinearGradient colors={iconColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.railIcon}>
          <Ionicons name={icon} size={15} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.railTitle, { color: themeColors.text }]}>{title}</Text>
          {subtitle ? <Text style={[s.railSub, { color: themeColors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      <ScrollView
        ref={snap.setRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: RAIL_PAD, gap: RAIL_GAP, paddingBottom: 6 }}
        {...snap.props}
      >
        {countries.map((c) => {
          const d = deals[c.iso];
          return (
            <View key={c.iso} style={{ width: TWO_UP_W }}>
              <EsimCountryCard
                iso={c.iso}
                name={c.name}
                fromINR={d?.fromINR}
                mrpINR={d?.mrpINR}
                discountPercent={d?.discountPercent}
                dataLabel={d?.dataLabel}
                planCount={d?.planCount}
                has5G={d?.has5G}
                onPress={() => onPick(c.iso)}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function EsimCountryListRow({ iso, name, deal, onPress }: {
  iso: string; name: string; deal?: BrowseDeal; onPress: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const img = countryImage(iso, 160);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${deal?.fromINR ? `, from ${inr(deal.fromINR)}` : ''}`}
      style={({ pressed }) => [s.listRow, { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)' }, pressed && { opacity: 0.85 }]}
    >
      <View style={s.listThumb}>
        {img ? (
          <>
            <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            <View style={s.listFlag}><CountryFlag countryCode={iso} size={16} /></View>
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, s.listFlagOnly]}><CountryFlag countryCode={iso} size={28} /></View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.listName, { color: themeColors.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[s.listSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {deal?.planCount ? `${deal.planCount} plans` : 'Data eSIM'}{deal?.has5G ? ' · 5G' : ''}
        </Text>
      </View>
      {deal?.fromINR ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.listFrom, { color: themeColors.textTertiary }]}>FROM</Text>
          <Text style={[s.listPrice, { color: themeColors.text }]}>{inr(deal.fromINR)}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
    </Pressable>
  );
}

export function EsimGuideCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      <LinearGradient colors={['#111827', '#1f2937']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.guide}>
        <LinearGradient colors={['rgba(230,20,23,0.55)', 'rgba(230,20,23,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.guideIcon}>
          <Ionicons name="phone-portrait-outline" size={22} color="#fff" />
          <View style={s.guideIconDot}><Ionicons name="wifi" size={9} color="#fff" /></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.guideTitle}>New to eSIM?</Text>
          <Text style={s.guideSub}>How it works, which phones support it, and answers in 60 seconds.</Text>
        </View>
        <View style={s.guideBtn}><Ionicons name="arrow-forward" size={16} color="#111827" /></View>
      </LinearGradient>
    </Pressable>
  );
}

export function EsimGuideSheet({ visible, onClose, onBrowse }: { visible: boolean; onClose: () => void; onBrowse: () => void }) {
  const { themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.guideSheet, { backgroundColor: themeColors.background, paddingTop: insets.top + 8 }]}>
        <View style={s.guideSheetHead}>
          <Text style={[s.guideSheetTitle, { color: themeColors.text }]}>eSIM guide</Text>
          <Pressable onPress={onClose} hitSlop={10} style={[s.guideClose, { backgroundColor: themeColors.surface }]} accessibilityLabel="Close guide">
            <Ionicons name="close" size={20} color={themeColors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <EsimWhyCard onBrowse={() => { onClose(); onBrowse(); }} />
          </View>
          <EsimHowItWorks />
          <EsimCompatibleDevices />
          <EsimFAQ />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  rail: { marginTop: 26 },
  railHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: RAIL_PAD, marginBottom: 12 },
  railIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  railTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  railSub: { fontSize: 12.5, marginTop: 1 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  listThumb: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  listFlag: { position: 'absolute', right: 3, bottom: 3 },
  listFlagOnly: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  listName: { fontSize: 15, fontWeight: '700' },
  listSub: { fontSize: 12, marginTop: 2 },
  listFrom: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  listPrice: { fontSize: 15, fontWeight: '800' },

  guide: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 18, overflow: 'hidden' },
  guideIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  guideIconDot: { position: 'absolute', right: -3, top: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: ESIM_RED, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  guideSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  guideBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  guideSheet: { flex: 1 },
  guideSheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  guideSheetTitle: { fontSize: 22, fontWeight: '800' },
  guideClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
