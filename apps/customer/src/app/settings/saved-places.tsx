import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  useTheme,
} from '@prayana/shared-ui';

// ============================================================
// SAVED PLACES SCREEN (Placeholder)
// ============================================================
export default function SavedPlacesScreen() {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.emptyState}>
        <View style={[styles.iconContainer, { backgroundColor: themeColors.card }]}>
          <Ionicons name="heart-outline" size={56} color={colors.gray[300]} />
        </View>
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No saved places yet</Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
          Explore destinations and save your favorite places to find them quickly
          later.
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
