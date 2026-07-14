// EsimBundleBonus — RN port of components/esim/EsimBundleBonus.jsx.
//
// Plans at or above ₹500 bundle a free month of VIP (worth ₹999) plus planner
// credits. This is a real, server-granted perk, not marketing copy — the gate
// below mirrors the server's, so the card never promises something the backend
// will not hand over.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { EsimBundle } from '../../lib/esim';

const ACCENT_RED = '#E61417';

/** Must match the server's BUNDLE_MIN_PRICE_INR (services/vipMembershipService.js). */
export const BUNDLE_MIN_PRICE_INR = 500;
/** Must match the server's COMP_VIP_PLANNER_GRANT — the promise and the grant are one number. */
export const BUNDLE_PLANNER_CREDITS = 50;
const VIP_PRICE_INR = 999;

/** Mirrors the server-side gate: sellingPrice >= BUNDLE_MIN_PRICE_INR. */
export const isBundleEligible = (plan: EsimBundle): boolean =>
  Number(plan?.sellingPrice ?? 0) >= BUNDLE_MIN_PRICE_INR;

const BONUS_ROWS: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string }> = [
  { icon: 'ribbon-outline', label: '1 Month VIP', sub: `worth ₹${VIP_PRICE_INR}` },
  { icon: 'wallet-outline', label: `+${BUNDLE_PLANNER_CREDITS} Planner Credits` },
  { icon: 'infinite-outline', label: 'Unlimited itineraries' },
  { icon: 'shield-checkmark-outline', label: 'SOS + Trip Planner' },
];

export const EsimBundleBonus: React.FC = () => {
  const { themeColors, isDarkMode } = useTheme();

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: isDarkMode ? 'rgba(230,20,23,0.10)' : 'rgba(230,20,23,0.06)',
          borderColor: isDarkMode ? 'rgba(230,20,23,0.28)' : 'rgba(230,20,23,0.16)',
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.freePill}>
          <Text style={styles.freeText}>FREE</Text>
        </View>
        <Text style={[styles.headerText, { color: themeColors.text }]}>
          INCLUDED WITH THIS eSIM
        </Text>
      </View>

      {BONUS_ROWS.map((r) => (
        <View key={r.label} style={styles.row}>
          <Ionicons name={r.icon} size={15} color={themeColors.text} />
          <Text style={[styles.rowLabel, { color: themeColors.text }]} numberOfLines={1}>
            {r.label}
          </Text>
          {!!r.sub && (
            <View
              style={[
                styles.worthChip,
                { backgroundColor: isDarkMode ? 'rgba(230,20,23,0.18)' : 'rgba(230,20,23,0.10)' },
              ]}
            >
              <Text style={[styles.worthText, { color: ACCENT_RED }]}>{r.sub}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  freePill: {
    backgroundColor: ACCENT_RED,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
  },
  headerText: {
    flex: 1,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowLabel: { flexShrink: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  worthChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  worthText: { fontSize: 9, fontWeight: fontWeight.bold },
});

export default EsimBundleBonus;
