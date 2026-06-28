import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from './theme';
import { useTheme } from './ThemeProvider';
import { Button } from './Button';

interface ErrorViewProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ErrorView({
  title = 'Something went wrong',
  message = 'Please try again later.',
  onRetry,
  fullScreen = false,
}: ErrorViewProps) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.container, fullScreen && [styles.fullScreen, { backgroundColor: themeColors.background }]]}>
      <Text style={styles.emoji}>!</Text>
      <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>
      {onRetry && (
        <Button title="Try Again" onPress={onRetry} variant="outline" size="md" style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emoji: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    color: colors.error,
    marginBottom: spacing.lg,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.errorLight,
    textAlign: 'center',
    lineHeight: 72,
    overflow: 'hidden',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.xl,
  },
});
