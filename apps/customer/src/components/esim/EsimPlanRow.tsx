// One plan as a compact, comparable row: the data amount large, then days and
// what the plan includes, the price (MRP struck through when discounted) and a
// radio. A selected row opens to list its features. Used in the plans sheet
// and the Global tab, where the big EsimPlanCard made comparing two plans a
// scroll each.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@prayana/shared-ui';
import { EsimBundle, capabilityFor, coverageCountFor, dataLabelFor, speedLabelFor } from '../../lib/esim';
import { isBundleEligible } from './EsimBundleBonus';
import { ESIM_RED, inr } from './EsimPass';

export function EsimPlanRow({ plan, popular, selected, onPress, showCoverage }: {
  plan: EsimBundle;
  popular?: boolean;
  selected?: boolean;
  onPress: () => void;
  /** Regional/global rows say how many countries they cover. */
  showCoverage?: boolean;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const cap = capabilityFor(plan);
  const price = plan.sellingPrice ?? 0;
  const mrp = plan.originalPrice && plan.originalPrice > price ? plan.originalPrice : 0;
  const off = plan.discountPercent || (mrp ? Math.round((1 - price / mrp) * 100) : 0);
  const coverage = coverageCountFor(plan);
  const border = selected ? ESIM_RED : isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)';

  const features = [
    { icon: 'cellular-outline' as const, text: speedLabelFor(plan) || '4G LTE' },
    showCoverage && coverage ? { icon: 'globe-outline' as const, text: `${coverage} countries` } : { icon: 'location-outline' as const, text: 'Local network' },
    plan.isRechargeable || plan.supportsRecharge ? { icon: 'refresh-outline' as const, text: 'Top-ups available' } : null,
    plan.requiresKYC ? { icon: 'id-card-outline' as const, text: 'Passport needed (KYC)' } : { icon: 'flash-outline' as const, text: 'Instant QR, no paperwork' },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; text: string }[];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={`${dataLabelFor(plan)}, ${plan.durationDays} days, ${inr(price)}`}
      style={[s.row, { backgroundColor: themeColors.surface, borderColor: border }, selected && s.rowOn]}
    >
      {popular ? (
        <LinearGradient colors={['#FFD23F', '#F5B400', '#E09600']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.popular}>
          <Ionicons name="star" size={9} color="#422006" />
          <Text style={s.popularText}>POPULAR</Text>
        </LinearGradient>
      ) : null}

      <View style={s.main}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.data, { color: themeColors.text }]} numberOfLines={1}>{dataLabelFor(plan)}</Text>
          <View style={s.tags}>
            <View style={[s.tag, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : '#f3f4f6' }]}>
              <Ionicons name="calendar-outline" size={11} color={themeColors.textSecondary} />
              <Text style={[s.tagText, { color: themeColors.textSecondary }]}>{plan.durationDays} days</Text>
            </View>
            {showCoverage && coverage ? (
              <View style={[s.tag, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                <Ionicons name="globe-outline" size={11} color="#1d4ed8" />
                <Text style={[s.tagText, { color: '#1d4ed8' }]}>{coverage} countries</Text>
              </View>
            ) : null}
            <View style={[s.tag, { backgroundColor: cap.voice ? 'rgba(230,20,23,0.08)' : 'rgba(22,163,74,0.1)' }]}>
              <Text style={[s.tagText, { color: cap.voice ? ESIM_RED : '#15803d' }]}>{cap.label}</Text>
            </View>
          </View>
        </View>

        <View style={s.priceCol}>
          {off > 0 ? (
            <View style={s.offRow}>
              {mrp ? <Text style={s.mrp}>{inr(mrp)}</Text> : null}
              <View style={s.off}><Text style={s.offText}>-{off}%</Text></View>
            </View>
          ) : null}
          <Text style={[s.price, { color: themeColors.text }]}>{inr(price)}</Text>
        </View>

        <View style={[s.radio, { borderColor: selected ? ESIM_RED : themeColors.border }]}>
          {selected ? <View style={s.radioDot} /> : null}
        </View>
      </View>

      {selected ? (
        <View style={[s.more, { borderTopColor: themeColors.border }]}>
          {features.map((f) => (
            <View key={f.text} style={s.feat}>
              <Ionicons name={f.icon} size={14} color={themeColors.textSecondary} />
              <Text style={[s.featText, { color: themeColors.textSecondary }]}>{f.text}</Text>
            </View>
          ))}
          {isBundleEligible(plan) ? (
            <View style={s.bonus}>
              <Ionicons name="gift" size={14} color={ESIM_RED} />
              <Text style={s.bonusText}>
                Free with this eSIM: 1 month VIP <Text style={{ fontWeight: '800' }}>worth ₹999</Text> + 50 Planner credits
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14 },
  rowOn: {
    shadowColor: ESIM_RED, shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  popular: {
    position: 'absolute', top: -9, left: 14, flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  popularText: { color: '#422006', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  data: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11.5, fontWeight: '700' },
  priceCol: { alignItems: 'flex-end' },
  offRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  mrp: { color: '#9ca3af', fontSize: 11.5, textDecorationLine: 'line-through' },
  off: { backgroundColor: ESIM_RED, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  offText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  price: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: ESIM_RED },
  more: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 7 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featText: { fontSize: 13 },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(230,20,23,0.06)', borderRadius: 10, padding: 9, marginTop: 3 },
  bonusText: { flex: 1, color: '#b91c1c', fontSize: 12.5 },
});
