import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from './theme';
import { useTheme } from './ThemeProvider';

interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  const { themeColors, brand } = useTheme();
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
                  isActive && [styles.circleActive, { backgroundColor: brand[500] }],
                  isCompleted && [styles.circleCompleted, { backgroundColor: brand[500] }],
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
                  isActive && [styles.labelActive, { color: brand[500] }],
                  isCompleted && [styles.labelCompleted, { color: brand[500] }],
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
                  isCompleted && [styles.connectorCompleted, { backgroundColor: brand[500] }],
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
  circleActive: {},
  circleCompleted: {
    backgroundColor: colors.primary[500],
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
    fontWeight: fontWeight.semibold,
  },
  labelCompleted: {
    color: colors.primary[500],
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    marginBottom: 18,
  },
  connectorCompleted: {
    backgroundColor: colors.primary[500],
  },
});
