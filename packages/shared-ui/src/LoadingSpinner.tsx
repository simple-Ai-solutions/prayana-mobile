import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from './theme';
import { useTheme } from './ThemeProvider';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'large',
  color = colors.primary[500],
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const { themeColors } = useTheme();
  const content = (
    <View style={[styles.container, fullScreen && [styles.fullScreen, { backgroundColor: themeColors.background }]]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>}
    </View>
  );

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
