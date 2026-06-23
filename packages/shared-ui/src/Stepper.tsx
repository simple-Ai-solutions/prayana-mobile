import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from './theme';
import { useTheme } from './ThemeProvider';

interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <React.Fragment key={index}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.circle,
                  { backgroundColor: themeColors.border },
                  isActive && styles.circleActive,
                  isCompleted && styles.circleCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    { color: themeColors.textSecondary },
                    (isActive || isCompleted) && styles.circleTextActive,
                  ]}
                >
                  {isCompleted ? '\u2713' : index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.label,
                  { color: themeColors.textTertiary },
                  isActive && styles.labelActive,
                  isCompleted && styles.labelCompleted,
                ]}
                numberOfLines={1}
              >
                {step}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: themeColors.border },
                  isCompleted && styles.connectorCompleted,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stepItem: {
    alignItems: 'center',
    flex: 0,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: colors.primary[500],
  },
  circleCompleted: {
    backgroundColor: colors.success,
  },
  circleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  circleTextActive: {
    color: '#ffffff',
  },
  label: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
    maxWidth: 60,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
  },
  labelCompleted: {
    color: colors.success,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    marginBottom: 18,
  },
  connectorCompleted: {
    backgroundColor: colors.success,
  },
});
