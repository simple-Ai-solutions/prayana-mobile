// EsimPlanCard — RN port of components/esim/EsimPlanCard.jsx.
//
// Every value shown is a real provider field. Voice/SMS/top-up rows appear only
// when the bundle actually reports them, and the strikethrough price only when
// the server sends a discount. Nothing here is padded with placeholder copy.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import {
  EsimBundle,
  ExchangeRates,
  capabilityFor,
  coverageCountFor,
  dataLabelFor,
  formatInrPrice,
  isRegionalBundle,
  speedLabelFor,
} from '../../lib/esim';

// Brand accents, straight from the web card.
export const ACCENT_RED = '#E61417';
const ACCENT_POPULAR = '#F5B400';

interface Props {
  plan: EsimBundle;
  exchangeRates?: ExchangeRates;
  isPopular?: boolean;
  currency?: string;
  currencySymbol?: string;
  onPress: (plan: EsimBundle) => void;
  onPressCoverage?: (plan: EsimBundle) => void;
}

export const EsimPlanCard: React.FC<Props> = ({
  plan,
  exchangeRates,
  isPopular = false,
  currency = 'INR',
  currencySymbol = '₹',
  onPress,
  onPressCoverage,
}) => {
  const { themeColors, isDarkMode } = useTheme();

  const dataLabel = dataLabelFor(plan);
  const capability = capabilityFor(plan);
  const speedLabel = speedLabelFor(plan);
  const countryCount = coverageCountFor(plan);
  const regional = isRegionalBundle(plan);

  const price = formatInrPrice(plan.sellingPrice, exchangeRates, currency, currencySymbol);
  const showStrike = (plan.discountPercent ?? 0) > 0 && !!plan.originalPrice;
  const original = showStrike
    ? formatInrPrice(plan.originalPrice, exchangeRates, currency, currencySymbol)
    : null;

  // Long labels ("Unlimited") overflow the hero size on a narrow card.
  const dataFontSize = dataLabel.length > 7 ? 28 : 34;

  const cardBg = isDarkMode ? '#0F0F0F' : '#FFFFFF';
  const baseBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB';

  // Feature rows — only what the provider actually reports.
  const features: Array<{ key: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { key: 'speed', icon: 'cellular-outline', label: `${speedLabel} LTE` },
    { key: 'coverage', icon: 'globe-outline', label: regional && countryCount ? `${countryCount} countries` : 'Nationwide' },
  ];
  const unlimitedCalls = !!plan.isUnlimitedCalls || plan.voiceMinutes === -1;
  const callMinutes =
    (plan.voiceMinutes ?? 0) > 0 ? plan.voiceMinutes! : (plan.localCallingCapacity ?? 0) > 0 ? plan.localCallingCapacity! : 0;
  if (unlimitedCalls) features.push({ key: 'calls', icon: 'call-outline', label: 'Unlimited calls' });
  else if (callMinutes > 0) features.push({ key: 'calls', icon: 'call-outline', label: `${callMinutes} min calls` });
  if ((plan.smsCapacity ?? 0) > 0) {
    features.push({ key: 'sms', icon: 'chatbubble-outline', label: `${plan.smsCapacity} SMS` });
  }
  if (plan.isRechargeable || plan.supportsRecharge) {
    features.push({ key: 'topup', icon: 'swap-horizontal-outline', label: 'Top-ups' });
  }

  return (
    <View style={styles.wrap}>
      {isPopular && (
        <LinearGradient
          colors={['#FFD23F', '#F5B400', '#E09600']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.popularRibbon}
        >
          <Ionicons name="star" size={11} color="#FFFFFF" />
          <Text style={styles.popularText}>POPULAR</Text>
        </LinearGradient>
      )}

      <Pressable
        onPress={() => onPress(plan)}
        accessibilityRole="button"
        accessibilityLabel={`${dataLabel}, ${plan.durationDays} days, ${price}`}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: isPopular ? ACCENT_POPULAR : baseBorder,
            borderWidth: isPopular ? 2 : 1,
            paddingTop: isPopular ? spacing.xl : spacing.lg,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {/* Data hero + discount badge */}
        <View style={styles.dataRow}>
          <Text style={[styles.dataLabel, { fontSize: dataFontSize, color: themeColors.text }]}>
            {dataLabel}
          </Text>
          {(plan.discountPercent ?? 0) > 0 && (
            <LinearGradient
              colors={['#FF8A94', '#FF5A66', '#F0202E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.discountBadge}
            >
              <Text style={styles.discountText}>
                {plan.discountLabel || 'OFF'} {plan.discountPercent}%
              </Text>
            </LinearGradient>
          )}
        </View>

        {/* Duration + capability pills */}
        <View style={styles.pillRow}>
          <View
            style={[
              styles.pill,
              { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6' },
            ]}
          >
            <Ionicons name="calendar-outline" size={13} color={themeColors.text} />
            <Text style={[styles.pillText, { color: themeColors.text }]}>{plan.durationDays} days</Text>
          </View>

          <View
            style={[
              styles.pill,
              capability.voice
                ? {
                    backgroundColor: isDarkMode ? 'rgba(230,20,23,0.16)' : 'rgba(230,20,23,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(230,20,23,0.35)',
                  }
                : {
                    backgroundColor: isDarkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(22,163,74,0.40)',
                  },
            ]}
          >
            <Ionicons
              name={capability.voice ? 'call-outline' : 'cellular-outline'}
              size={13}
              color={capability.voice ? ACCENT_RED : isDarkMode ? '#4ADE80' : '#15803D'}
            />
            <Text
              style={[
                styles.pillText,
                { color: capability.voice ? ACCENT_RED : isDarkMode ? '#4ADE80' : '#15803D' },
              ]}
            >
              {capability.label}
            </Text>
          </View>
        </View>

        {/* Feature rows */}
        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.key} style={styles.featureRow}>
              <Ionicons name={f.icon} size={14} color={themeColors.textTertiary} />
              <Text style={[styles.featureText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: themeColors.text }]}>{price}</Text>
          {!!original && (
            <Text style={[styles.original, { color: themeColors.textTertiary }]}>{original}</Text>
          )}
        </View>
        <Text style={[styles.tax, { color: themeColors.textTertiary }]}>incl. taxes</Text>

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Buy now</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </View>

        {regional && !!countryCount && onPressCoverage && (
          <Pressable
            onPress={() => onPressCoverage(plan)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.coverageLink}
          >
            <Text style={[styles.coverageText, { color: themeColors.textSecondary }]}>
              {countryCount} countries
            </Text>
            <Ionicons name="chevron-forward" size={13} color={themeColors.textTertiary} />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.md, flex: 1 },

  popularRibbon: {
    position: 'absolute',
    top: 2,
    left: spacing.md,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#F5B400',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
  },

  card: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  dataRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dataLabel: { fontWeight: fontWeight.bold, letterSpacing: -0.75, lineHeight: 38 },

  discountBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  discountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 11, fontWeight: fontWeight.bold },

  features: { marginTop: spacing.md, gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: fontSize.xs, flex: 1 },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  price: { fontSize: 26, fontWeight: fontWeight.bold, letterSpacing: -0.75 },
  original: { fontSize: fontSize.sm, textDecorationLine: 'line-through', marginBottom: 3 },
  tax: { fontSize: 10, marginTop: 1 },

  cta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: ACCENT_RED,
  },
  ctaText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  coverageLink: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  coverageText: { fontSize: 11, fontWeight: fontWeight.semibold },
});

export default EsimPlanCard;
