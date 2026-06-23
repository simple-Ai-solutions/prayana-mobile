import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, spacing, shadow, borderRadius, useTheme } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { PlaceAutocomplete } from '../../components/trip/PlaceAutocomplete';

// --- Transport modes ---
const TRANSPORT_MODES = [
  { id: 'car', label: 'Car / Bus', emoji: '\uD83D\uDE97', description: 'Flexible road travel' },
  { id: 'bike', label: 'Bike', emoji: '\uD83C\uDFCD\uFE0F', description: 'Scenic bike journey' },
  { id: 'flight', label: 'Flight', emoji: '\u2708\uFE0F', description: 'Quick air travel' },
];

// --- Duration options ---
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 7, 10, 14];

export default function PlanTripScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  // Form state
  const [destination, setDestination] = useState('');
  const [startingPoint, setStartingPoint] = useState('');
  const [days, setDays] = useState(5);
  const [transportMode, setTransportMode] = useState('flight');

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  // Animations
  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Spin animation during generation
  useEffect(() => {
    if (isGenerating) {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    }
    spinAnim.setValue(0);
  }, [isGenerating, spinAnim]);

  // Progress simulation
  useEffect(() => {
    if (!isGenerating) {
      setProgress(0);
      progressAnim.setValue(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        const next = prev + Math.random() * 8 + 2;
        return Math.min(next, 90);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isGenerating, progressAnim]);

  const handleGenerate = useCallback(async () => {
    if (!destination.trim()) {
      setError('Please enter a destination');
      return;
    }

    setError('');
    setIsGenerating(true);
    setProgress(0);

    try {
      const response = await makeAPICall('/itinerary/generate-markdown', {
        method: 'POST',
        body: JSON.stringify({
          destination: destination.trim(),
          duration: days,
          startingPoint: startingPoint.trim() || undefined,
          transportMode: transportMode === 'car' ? 'car_bus' : transportMode,
          preferences: {
            budget: 'moderate',
            interests: [],
            travelStyle: 'relaxed',
            groupType: 'general',
          },
        }),
        timeout: 60000,
      });

      setProgress(100);

      if (response?.success && response.data) {
        // Small delay to show 100% completion
        setTimeout(() => {
          setIsGenerating(false);
          router.push({
            pathname: '/trip/itinerary',
            params: {
              markdown: response.data.markdown || (typeof response.data === 'string' ? response.data : ''),
              title: response.data.title || `${days}-Day ${destination} Trip`,
              destination: destination.trim(),
              duration: String(days),
              transportMode,
              startingPoint: startingPoint.trim() || '',
              markdownItineraryId: response.data.markdownItineraryId || '',
            },
          });
        }, 800);
      } else {
        throw new Error(response?.message || 'Failed to generate itinerary');
      }
    } catch (err: any) {
      setIsGenerating(false);
      setError(err.message || 'Failed to generate itinerary. Please try again.');
    }
  }, [destination, startingPoint, days, transportMode, router]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // --- Generating State ---
  if (isGenerating) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.generatingContainer}>
          <View style={styles.spinnerWrapper}>
            <Animated.View style={[styles.spinnerRing, { transform: [{ rotate: spinInterpolate }] }]}>
              <LinearGradient
                colors={['#FF6B6B', '#ee5a5a', '#ff8a8a']}
                style={styles.spinnerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </Animated.View>
            <View style={styles.spinnerCenter}>
              <Text style={styles.spinnerEmoji}>{'\u2708\uFE0F'}</Text>
            </View>
          </View>

          <Text style={[styles.generatingTitle, { color: themeColors.text }]}>Crafting Your Itinerary</Text>
          <Text style={[styles.generatingSubtitle, { color: themeColors.textSecondary }]}>
            AI is planning your {days}-day trip to {destination}...
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarTrack, { backgroundColor: themeColors.surface }]}>
              <LinearGradient
                colors={['#FF6B6B', '#ee5a5a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${Math.round(progress)}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setIsGenerating(false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: themeColors.textTertiary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.backArrow, { color: themeColors.text }]}>{'\u2190'}</Text>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: themeColors.text }]}>Plan a Trip</Text>
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>AI-powered itinerary in seconds</Text>
            </View>
          </View>

          {/* AI Badge */}
          <View style={styles.aiBadgeContainer}>
            <LinearGradient
              colors={['#FF6B6B', '#ee5a5a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.aiBadge}
            >
              <Text style={styles.aiBadgeText}>{'\uD83E\uDD16'} AI-Powered Planning</Text>
            </LinearGradient>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Step 1: Starting Point */}
            <View style={[styles.stepContainer, { zIndex: 4 }]}>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, { backgroundColor: colors.gray[300] }]}>
                  <Text style={styles.stepDotText}>1</Text>
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Starting Point (Optional)</Text>
                <PlaceAutocomplete
                  value={startingPoint}
                  onChange={setStartingPoint}
                  placeholder="e.g., Bangalore, Mumbai"
                />
              </View>
            </View>

            {/* Step 2: Destination */}
            <View style={[styles.stepContainer, { zIndex: 3 }]}>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, { backgroundColor: '#FF6B6B' }]}>
                  <Text style={styles.stepDotText}>2</Text>
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
                  Destination <Text style={styles.requiredStar}>*</Text>
                </Text>
                <PlaceAutocomplete
                  value={destination}
                  onChange={(text) => {
                    setDestination(text);
                    if (error) setError('');
                  }}
                  placeholder="e.g., Goa, Manali, Paris"
                  required
                />
              </View>
            </View>

            {/* Step 3: Duration */}
            <View style={[styles.stepContainer, { zIndex: 2 }]}>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, { backgroundColor: '#06B6D4' }]}>
                  <Text style={styles.stepDotText}>3</Text>
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Trip Duration</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.durationRow}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.durationChip,
                        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                        days === d && styles.durationChipActive,
                        shadow.sm,
                      ]}
                      onPress={() => setDays(d)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          { color: themeColors.text },
                          days === d && styles.durationChipTextActive,
                        ]}
                      >
                        {d} {d === 1 ? 'Day' : 'Days'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Step 4: Transport */}
            <View style={[styles.stepContainer, { zIndex: 1 }]}>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, { backgroundColor: colors.success }]}>
                  <Text style={styles.stepDotText}>4</Text>
                </View>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Transport Mode</Text>
                <View style={styles.transportGrid}>
                  {TRANSPORT_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode.id}
                      style={[
                        styles.transportCard,
                        { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                        shadow.sm,
                        transportMode === mode.id && styles.transportCardActive,
                      ]}
                      onPress={() => setTransportMode(mode.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.transportEmoji}>{mode.emoji}</Text>
                      <Text
                        style={[
                          styles.transportLabel,
                          { color: themeColors.text },
                          transportMode === mode.id && styles.transportLabelActive,
                        ]}
                      >
                        {mode.label}
                      </Text>
                      <Text style={[styles.transportDesc, { color: themeColors.textTertiary }]}>{mode.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{'\u26A0\uFE0F'} {error}</Text>
            </View>
          ) : null}

          {/* Generate Button */}
          <View style={styles.generateContainer}>
            <TouchableOpacity
              style={[styles.generateButton, shadow.lg, !destination.trim() && styles.generateButtonDisabled]}
              onPress={handleGenerate}
              activeOpacity={0.85}
              disabled={!destination.trim()}
            >
              <LinearGradient
                colors={destination.trim() ? ['#FF6B6B', '#ee5a5a'] : [colors.gray[300], colors.gray[400]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateGradient}
              >
                <Text style={styles.generateEmoji}>{'\u2728'}</Text>
                <Text style={styles.generateText}>Generate Itinerary</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Info tip */}
          <View style={styles.tipContainer}>
            <View style={[styles.tipCard, shadow.sm, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={styles.tipIcon}>{'\uD83D\uDCA1'}</Text>
              <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>
                AI will create a day-by-day guide with places, food spots, and travel tips based on your
                preferences.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  backArrow: {
    fontSize: 20,
    color: colors.text,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // AI Badge
  aiBadgeContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  aiBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // Form
  form: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },

  // Step indicator (timeline)
  stepContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: spacing.lg,
    width: 28,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.gray[200],
    marginTop: spacing.xs,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },

  // Fields
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  requiredStar: {
    color: '#FF6B6B',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputFilled: {
    borderColor: '#FF6B6B',
  },

  // Duration
  durationRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  durationChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  durationChipActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  durationChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  durationChipTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },

  // Transport
  transportGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  transportCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  transportCardActive: {
    borderColor: '#FF6B6B',
    backgroundColor: '#fff5f5',
  },
  transportEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  transportLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  transportLabelActive: {
    color: '#FF6B6B',
  },
  transportDesc: {
    fontSize: 9,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Error
  errorContainer: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },

  // Generate Button
  generateContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing['2xl'],
  },
  generateButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg + 2,
    paddingHorizontal: spacing.xl,
  },
  generateEmoji: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  generateText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // Tip
  tipContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  tipIcon: {
    fontSize: 18,
    marginRight: spacing.md,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Generating state
  generatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  spinnerWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  spinnerRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#FF6B6B',
    borderRightColor: '#ee5a5a',
  },
  spinnerGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    opacity: 0.15,
  },
  spinnerCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerEmoji: {
    fontSize: 28,
  },
  generatingTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  generatingSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  progressBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FF6B6B',
    width: 40,
    textAlign: 'right',
  },
  cancelButton: {
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
});
