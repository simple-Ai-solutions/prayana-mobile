import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, fontSize, fontWeight, spacing } from './theme';
import { useTheme } from './ThemeProvider';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.gray[100], text: colors.gray[700] },
  primary: { bg: colors.primary[100], text: colors.primary[700] },
  success: { bg: colors.successLight, text: '#15803d' },
  warning: { bg: colors.warningLight, text: '#a16207' },
  error: { bg: colors.errorLight, text: '#b91c1c' },
  info: { bg: colors.infoLight, text: '#1d4ed8' },
};

export function Badge({ label, variant = 'default', size = 'sm', style }: BadgeProps) {
  const { themeColors } = useTheme();
  const vc =
    variant === 'default'
      ? { bg: themeColors.backgroundSecondary, text: themeColors.textSecondary }
      : variantColors[variant];
  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.md,
        { backgroundColor: vc.bg },
        style,
      ]}
    >
      <Text style={[styles.text, size === 'md' && styles.textMd, { color: vc.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  textMd: {
    fontSize: fontSize.sm,
  },
});
