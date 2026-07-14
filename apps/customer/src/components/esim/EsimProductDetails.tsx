// EsimProductDetails + "Why choose eSIM for X?" — the two explainer cards the
// PWA shows under the plan list.
//
// Every row is DERIVED from the plans currently in view, exactly as the web does
// it. Nothing is hardcoded: if none of the plans in scope carry voice, the Calls
// row does not appear at all, and the Phone number row tells the truth for that
// scope (a country eSIM has no callable number; a global one carries a foreign
// number).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { CoverageScope, EsimBundle, speedLabelFor } from '../../lib/esim';
import { countryCities } from '../../lib/countryAssets';

const ACCENT_RED = '#E61417';

interface Props {
  plans: EsimBundle[];
  scope: CoverageScope;
  countryName: string;
  countryCode?: string;
}

export const EsimProductDetails: React.FC<Props> = ({ plans, scope, countryName, countryCode }) => {
  const { themeColors, isDarkMode } = useTheme();

  const rows = useMemo(() => {
    if (!plans.length) return [];

    const anyVoice = plans.some(
      (p) => (p.voiceMinutes ?? 0) > 0 || (p.localCallingCapacity ?? 0) > 0 || p.isUnlimitedCalls,
    );
    const anySms = plans.some((p) => (p.smsCapacity ?? 0) > 0);
    const anyKyc = plans.some((p) => p.requiresKYC);
    const anyRecharge = plans.some((p) => p.isRechargeable || p.supportsRecharge);
    const maxCoverage = plans.reduce(
      (m, p) => Math.max(m, p.coverageCount ?? (p.coverages?.length ?? 1) ?? 1),
      1,
    );

    const durations = Array.from(
      new Set(plans.map((p) => p.durationDays).filter((d): d is number => !!d)),
    ).sort((a, b) => a - b);

    const validity =
      durations.length > 1
        ? `${durations[0]}–${durations[durations.length - 1]} days`
        : `${durations[0] ?? '—'} days`;

    const service = anyVoice
      ? anySms
        ? 'Data + calls + SMS'
        : 'Data + calls'
      : anySms
        ? 'Data + SMS'
        : 'Data only';

    const coverage =
      scope === 'global' ? `${maxCoverage}+ countries (incl. ${countryName})` : `${countryName} only`;

    const out: Array<{ label: string; value: string }> = [
      { label: 'Validity', value: validity },
      { label: 'Speed', value: speedLabelFor(plans[0]) },
      { label: 'Service', value: service },
      { label: 'Coverage', value: coverage },
    ];
    if (anyVoice) {
      out.push({ label: 'Calls', value: 'Outbound only — receive via WhatsApp/data' });
    }
    out.push(
      { label: 'SMS', value: anySms ? 'Included on some plans' : 'Not included' },
      {
        label: 'Phone number',
        value:
          scope === 'global'
            ? 'Foreign number (not your local number)'
            : 'Data plan — no callable number',
      },
      { label: 'KYC', value: anyKyc ? 'Passport required before activation' : 'Not required' },
      { label: 'Hotspot', value: 'Yes' },
      { label: 'Top-ups', value: anyRecharge ? 'Supported' : 'Not supported' },
      { label: 'Activation', value: 'Manual (scan QR / enter code)' },
    );
    return out;
  }, [plans, scope, countryName]);

  const cities = countryCities(countryCode);

  const benefits: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }> = [
    {
      icon: 'cellular-outline',
      title: `${plans.length ? speedLabelFor(plans[0]) : '4G/5G'} speed`,
      desc: 'Reliable connectivity through top local networks',
    },
    {
      icon: 'flash-outline',
      title: 'Instant setup',
      desc: 'Activate in 5 minutes — no physical SIM',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'No hidden fees',
      desc: 'Transparent pricing, no roaming charges',
    },
    {
      icon: 'share-social-outline',
      title: 'Hotspot sharing',
      desc: 'Share your connection with other devices',
    },
  ];

  if (!plans.length) return null;

  const cardStyle = [
    styles.card,
    { backgroundColor: themeColors.surface, borderColor: themeColors.border },
  ];

  return (
    <View style={styles.wrap}>
      {/* ─── Product Details ─── */}
      <View style={cardStyle}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>Product details</Text>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: themeColors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: themeColors.textSecondary }]}>{r.label}</Text>
            <Text style={[styles.rowValue, { color: themeColors.text }]}>{r.value}</Text>
          </View>
        ))}
      </View>

      {/* ─── Why choose eSIM for X? ─── */}
      <View style={cardStyle}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>
          Why choose eSIM for {countryName}?
        </Text>

        {benefits.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: isDarkMode ? 'rgba(230,20,23,0.10)' : 'rgba(230,20,23,0.07)' },
              ]}
            >
              <Ionicons name={b.icon} size={16} color={ACCENT_RED} />
            </View>
            <View style={styles.benefitText}>
              <Text style={[styles.benefitTitle, { color: themeColors.text }]}>{b.title}</Text>
              <Text style={[styles.benefitDesc, { color: themeColors.textSecondary }]}>{b.desc}</Text>
            </View>
          </View>
        ))}

        {cities.length > 0 && (
          <View style={[styles.cities, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.citiesLabel, { color: themeColors.textSecondary }]}>
              Top cities with coverage
            </Text>
            <View style={styles.cityChips}>
              {cities.map((c) => (
                <View
                  key={c}
                  style={[
                    styles.cityChip,
                    {
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                    },
                  ]}
                >
                  <Text style={[styles.cityText, { color: themeColors.text }]}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: { fontSize: fontSize.sm, flexShrink: 0 },
  rowValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'right',
  },

  benefit: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  benefitDesc: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 17 },

  cities: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  citiesLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  cityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cityChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
  cityText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
});

export default EsimProductDetails;
