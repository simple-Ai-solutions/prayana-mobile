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
    // A Card with no width shrinks to its content, which starves any flex:1
    // child inside it (a coupon input collapsed to a sliver this way). Cards
    // are block-level everywhere they are used, so stretch by default; callers
    // that want a narrow card can still override via the style prop.
    alignSelf: 'stretch',
  },
  bordered: {
    borderWidth: 1,
  },
});
