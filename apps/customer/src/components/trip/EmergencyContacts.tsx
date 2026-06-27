// EmergencyContacts — country emergency numbers (click-to-call) + safety tips.
// Reuses the shared getEmergencyNumbers data. Mirrors the PWA itinerary panel.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Phone, ShieldAlert, Info } from 'lucide-react-native';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { getEmergencyNumbers } from '@prayana/shared-utils';

const TEAL = '#2EC4B6';

const SAFETY_TIPS = [
  'Save these numbers offline before you travel.',
  'Share your live location with a trusted contact.',
  'Keep digital + physical copies of your ID.',
  'Note your hotel address & nearest hospital on arrival.',
  'Avoid isolated areas after dark; use trusted transport.',
];

interface Props {
  destination: string;
}

// Best-effort country detection from a destination string.
function guessCountry(destination: string): string {
  const d = (destination || '').toLowerCase();
  // common non-India hints
  if (/dubai|abu dhabi|uae/.test(d)) return 'United Arab Emirates';
  if (/bali|jakarta|indonesia/.test(d)) return 'Indonesia';
  if (/bangkok|phuket|thailand/.test(d)) return 'Thailand';
  if (/singapore/.test(d)) return 'Singapore';
  if (/maldives/.test(d)) return 'Maldives';
  if (/nepal|kathmandu/.test(d)) return 'Nepal';
  if (/sri lanka|colombo/.test(d)) return 'Sri Lanka';
  // default: most trips are within India
  return 'India';
}

export const EmergencyContacts: React.FC<Props> = ({ destination }) => {
  const { themeColors } = useTheme();
  const country = useMemo(() => guessCountry(destination), [destination]);
  const numbers = useMemo(() => getEmergencyNumbers(country) as any[], [country]);

  const call = (num: string) => {
    Linking.openURL(`tel:${num}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <ShieldAlert size={20} color={TEAL} />
        <Text style={[styles.title, { color: themeColors.text }]}>Emergency Contacts</Text>
      </View>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
        Emergency numbers for {country}. Tap to call.
      </Text>

      {/* Number cards */}
      <View style={styles.grid}>
        {numbers.map((n) => (
          <TouchableOpacity
            key={n.label}
            style={[styles.numCard, shadow.sm, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            activeOpacity={0.85}
            onPress={() => call(n.number)}
          >
            <View style={[styles.numIcon, { backgroundColor: (n.color || TEAL) + '22' }]}>
              <Phone size={18} color={n.color || TEAL} />
            </View>
            <Text style={[styles.numLabel, { color: themeColors.textSecondary }]}>{n.label}</Text>
            <Text style={[styles.numValue, { color: themeColors.text }]}>{n.number}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Safety tips */}
      <View style={[styles.tipsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={styles.tipsHeader}>
          <Info size={16} color={TEAL} />
          <Text style={[styles.tipsTitle, { color: themeColors.text }]}>Safety Tips</Text>
        </View>
        {SAFETY_TIPS.map((t, i) => (
          <View key={i} style={styles.tipRow}>
            <View style={styles.bullet} />
            <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm, marginTop: 2, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  numCard: { width: '47.5%', borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, gap: 4 },
  numIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  numLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  numValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  tipsCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, marginTop: spacing.lg },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tipsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL, marginTop: 6 },
  tipText: { fontSize: fontSize.sm, flex: 1, lineHeight: 19 },
});
