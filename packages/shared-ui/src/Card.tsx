import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { borderRadius, spacing, shadow } from './theme';
import { useTheme } from './ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  elevated?: boolean;
  bordered?: boolean;
}

export function Card({
  children,
  style,
  padding = 'lg',
  elevated = true,
  bordered = false,
}: CardProps) {
  const { themeColors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: themeColors.card, padding: spacing[padding] },
        elevated && shadow.md,
        bordered && [styles.bordered, { borderColor: themeColors.cardBorder }],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bordered: {
    borderWidth: 1,
  },
});
