import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from './theme';
import { useTheme } from './ThemeProvider';

interface PriceDisplayProps {
  amount: number;
  currency?: string;
  originalAmount?: number;
  perUnit?: string;
  size?: 'sm' | 'md' | 'lg';
}

const currencySymbols: Record<string, string> = {
  INR: '\u20B9',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

export function PriceDisplay({
  amount,
  currency = 'INR',
  originalAmount,
  perUnit,
  size = 'md',
}: PriceDisplayProps) {
  const { themeColors } = useTheme();
  const symbol = currencySymbols[currency] || currency;
  const hasDiscount = originalAmount && originalAmount > amount;
  const discountPercent = hasDiscount
    ? Math.round(((originalAmount - amount) / originalAmount) * 100)
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.amount, styles[`amount_${size}`], { color: themeColors.text }]}>
          {symbol}{amount.toLocaleString()}
        </Text>
        {perUnit && (
          <Text style={[styles.perUnit, { color: themeColors.textSecondary }]}>/{perUnit}</Text>
        )}
      </View>
      {hasDiscount && (
        <View style={styles.discountRow}>
          <Text style={[styles.originalAmount, { color: themeColors.textTertiary }]}>
            {symbol}{originalAmount.toLocaleString()}
          </Text>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountPercent}% off</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  amount_sm: { fontSize: fontSize.md },
  amount_md: { fontSize: fontSize.xl },
  amount_lg: { fontSize: fontSize['2xl'] },
  perUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  originalAmount: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  discountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#15803d',
  },
});
