// Legal hub — every policy the app links to, in one list. Documents open in
// the in-app browser sheet so the user never leaves Prayana.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { InfoTopBar } from '../../components/common/InfoTopBar';
import { LEGAL_DOCS } from '../../lib/legalRegistry';
import { openInApp, SITE_URL } from '../../lib/openInApp';

type IconName = keyof typeof Ionicons.glyphMap;

const TEAL = '#0d9488';
const LEGAL_EMAIL = 'legal@prayanaai.com';

interface Row { key: string; title: string; meta: string; url: string; icon: IconName; color: string }

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const SITE_DOCS: Row[] = [
  { key: 'terms', title: 'Terms of Service', meta: 'Last updated 15 Mar 2026', url: `${SITE_URL}/terms`, icon: 'document-text-outline', color: '#3b82f6' },
  { key: 'privacy', title: 'Privacy Policy', meta: 'Last updated 15 Mar 2026', url: `${SITE_URL}/privacy`, icon: 'shield-checkmark-outline', color: '#059669' },
  { key: 'user-agreement', title: 'User Agreement', meta: 'Last updated 15 Mar 2026', url: `${SITE_URL}/user-agreement`, icon: 'reader-outline', color: '#7c3aed' },
];

const DOC_ICON: Record<string, { icon: IconName; color: string }> = {
  'platform-tou': { icon: 'globe-outline', color: '#3b82f6' },
  'booking-tnc': { icon: 'receipt-outline', color: '#f97316' },
  'privacy-policy': { icon: 'lock-closed-outline', color: '#059669' },
  'cancellation-refund': { icon: 'refresh-circle-outline', color: '#e11d48' },
  'grievance-redressal': { icon: 'chatbox-ellipses-outline', color: '#d97706' },
  'cookie-policy': { icon: 'finger-print-outline', color: '#8b5cf6' },
  'vendor-agreement': { icon: 'storefront-outline', color: '#0891b2' },
  'activity-waiver': { icon: 'fitness-outline', color: '#ea580c' },
  'package-booking-tnc': { icon: 'briefcase-outline', color: '#4f46e5' },
  'self-drive-rental': { icon: 'car-outline', color: '#0d9488' },
  'chauffeur-transport': { icon: 'car-sport-outline', color: '#475569' },
};

const REGISTRY_DOCS: Row[] = Object.values(LEGAL_DOCS).map((d) => ({
  key: d.slug,
  title: d.title,
  meta: `v${d.currentVersion} · Effective ${fmt(d.effectiveDate)}`,
  url: `${SITE_URL}/legal/${d.slug}-${d.versionTag}`,
  icon: DOC_ICON[d.slug]?.icon ?? 'document-outline',
  color: DOC_ICON[d.slug]?.color ?? TEAL,
}));

export default function LegalHubScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const card = { backgroundColor: themeColors.surface, borderColor: line };

  const renderRows = (rows: Row[]) => (
    <View style={[s.card, card]}>
      {rows.map((r, i) => (
        <Pressable
          key={r.key}
          onPress={() => openInApp(r.url)}
          style={({ pressed }) => [s.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line }, pressed && { opacity: 0.7 }]}
          accessibilityRole="link"
          accessibilityLabel={r.title}
        >
          <View style={[s.icon, { backgroundColor: r.color + (isDarkMode ? '26' : '14') }]}>
            <Ionicons name={r.icon} size={18} color={r.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: themeColors.text }]}>{r.title}</Text>
            <Text style={[s.rowMeta, { color: themeColors.textTertiary }]}>{r.meta}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={themeColors.textTertiary} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[s.safe, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <InfoTopBar title="Legal & policies" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
        <Text style={[s.lead, { color: themeColors.textSecondary }]}>
          The terms you agree to when you use Prayana and book with us. Tap any document to read it.
        </Text>

        <Text style={[s.section, { color: themeColors.textTertiary }]}>ESSENTIALS</Text>
        {renderRows(SITE_DOCS)}

        <Text style={[s.section, { color: themeColors.textTertiary }]}>BOOKING & PLATFORM DOCUMENTS</Text>
        {renderRows(REGISTRY_DOCS)}

        <Pressable
          onPress={() => router.push('/settings/privacy' as never)}
          style={({ pressed }) => [s.card, card, s.row, pressed && { opacity: 0.7 }]}
        >
          <View style={[s.icon, { backgroundColor: TEAL + (isDarkMode ? '26' : '14') }]}>
            <Ionicons name="options-outline" size={18} color={TEAL} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: themeColors.text }]}>Privacy choices</Text>
            <Text style={[s.rowMeta, { color: themeColors.textTertiary }]}>Analytics & advertising consent</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
        </Pressable>

        <Text style={[s.foot, { color: themeColors.textTertiary }]}>
          Questions about these documents? Write to{' '}
          <Text style={s.footLink} onPress={() => Linking.openURL(`mailto:${LEGAL_EMAIL}`).catch(() => {})}>
            {LEGAL_EMAIL}
          </Text>
          {'\n'}Simple AI Solutions Pvt. Ltd., Bengaluru
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 16, paddingBottom: 40, gap: 10 },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  section: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 10, marginLeft: 4 },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  foot: { fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: 12 },
  footLink: { color: TEAL, fontWeight: '700' },
});
