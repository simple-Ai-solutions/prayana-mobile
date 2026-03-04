import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

// ─── Constants ───────────────────────────────────────────────────────────────

const BUDGET_TIERS = [
  { key: 'budget', label: 'Budget', emoji: '\uD83D\uDCB0', description: 'Cost-effective' },
  { key: 'moderate', label: 'Moderate', emoji: '\uD83D\uDC8E', description: 'Balanced comfort' },
  { key: 'luxury', label: 'Luxury', emoji: '\uD83D\uDC51', description: 'Premium experiences' },
] as const;

const TRIP_TYPES = [
  { key: 'leisure', label: 'Leisure', icon: 'sunny-outline' as const },
  { key: 'adventure', label: 'Adventure', icon: 'compass-outline' as const },
  { key: 'cultural', label: 'Cultural', icon: 'library-outline' as const },
  { key: 'romantic', label: 'Romantic', icon: 'heart-outline' as const },
  { key: 'solo', label: 'Solo', icon: 'person-outline' as const },
  { key: 'family', label: 'Family', icon: 'people-outline' as const },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' as const },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return 'Select date';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateShort(date: Date | null): { day: string; month: string; year: string; weekday: string } {
  if (!date) return { day: '--', month: '---', year: '----', weekday: '' };
  return {
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    year: date.toLocaleDateString('en-US', { year: 'numeric' }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TripSetupScreen() {
  const router = useRouter();

  // Store state
  const name = useCreateTripStore((s) => s.name);
  const startDate = useCreateTripStore((s) => s.startDate);
  const endDate = useCreateTripStore((s) => s.endDate);
  const travelers = useCreateTripStore((s) => s.travelers);
  const kids = useCreateTripStore((s) => s.kids);
  const budget = useCreateTripStore((s) => s.budget);
  const tripType = useCreateTripStore((s) => s.tripType);

  const tripId = useCreateTripStore((s) => s.tripId);
  const isSaving = useCreateTripStore((s) => s.isSaving);

  // Store actions
  const setName = useCreateTripStore((s) => s.setName);
  const setDates = useCreateTripStore((s) => s.setDates);
  const setTravelers = useCreateTripStore((s) => s.setTravelers);
  const setKids = useCreateTripStore((s) => s.setKids);
  const setBudget = useCreateTripStore((s) => s.setBudget);
  const setTripType = useCreateTripStore((s) => s.setTripType);
  const setCurrentStep = useCreateTripStore((s) => s.setCurrentStep);
  const setTripId = useCreateTripStore((s) => s.setTripId);
  const setIsSaving = useCreateTripStore((s) => s.setIsSaving);
  const markSaved = useCreateTripStore((s) => s.markSaved);
  const initializeTempTripId = useCreateTripStore((s) => s.initializeTempTripId);

  // Auth
  const { user, isAuthenticated } = useAuth();

  // Local UI state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Initialize tempTripId on mount (enables collab before first save) ───
  useEffect(() => {
    initializeTempTripId();
  }, [initializeTempTripId]);

  // ─── Save Trip to Backend ───
  const saveTrip = useCallback(async (): Promise<boolean> => {
    if (!user?.uid || user.uid === 'guest-user') return false;
    if (isSaving) return false;

    const state = useCreateTripStore.getState();
    setIsSaving(true);
    try {
      const tripData = {
        name: state.name,
        startDate: state.startDate,
        endDate: state.endDate,
        travelers: state.travelers,
        kids: state.kids,
        budget: state.budget,
        tripType: state.tripType,
        currency: state.currency || 'INR',
        destinations: state.destinations || [],
        days: state.days || [],
        lastEditedStep: 1,
        status: 'planning',
      };

      if (state.tripId) {
        // Update existing trip
        await createTripAPI.updateTrip(state.tripId, tripData);
        markSaved();
        return true;
      } else {
        // Create new trip
        const result = await createTripAPI.createTrip({
          ...tripData,
          userId: user.uid,
          ownerName: user.displayName || user.email || '',
        });
        if (result?.success && result?.data?.tripId) {
          setTripId(result.data.tripId);
          useCreateTripStore.setState({ userRole: 'owner' });
          markSaved();
          return true;
        }
        return false;
      }
    } catch (err: any) {
      console.warn('[Setup] Auto-save failed:', err?.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user, isSaving, setIsSaving, setTripId, markSaved]);

  // ─── Auto-save when trip name reaches 3+ chars (like web) ───
  useEffect(() => {
    if (name && name.length >= 3 && !tripId && isAuthenticated && user?.uid && user.uid !== 'guest-user') {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        saveTrip();
      }, 1500);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [name, tripId, isAuthenticated, user, saveTrip]);

  // ─── Date Handlers ───

  const handleStartDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowStartPicker(false);
      }
      if (selectedDate) {
        const isoStart = selectedDate.toISOString();
        // If end date is before new start date, clear it
        const currentEnd = endDate ? new Date(endDate) : null;
        if (currentEnd && selectedDate > currentEnd) {
          setDates(isoStart, null);
        } else {
          setDates(isoStart, endDate);
        }
        setErrors((prev) => ({ ...prev, dates: '' }));
      }
    },
    [endDate, setDates]
  );

  const handleEndDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowEndPicker(false);
      }
      if (selectedDate) {
        setDates(startDate, selectedDate.toISOString());
        setErrors((prev) => ({ ...prev, dates: '' }));
      }
    },
    [startDate, setDates]
  );

  // ─── Counter Handlers ───

  const incrementTravelers = useCallback(() => {
    if (travelers < 20) setTravelers(travelers + 1);
  }, [travelers, setTravelers]);

  const decrementTravelers = useCallback(() => {
    if (travelers > 1) setTravelers(travelers - 1);
  }, [travelers, setTravelers]);

  const incrementKids = useCallback(() => {
    if (kids < 10) setKids(kids + 1);
  }, [kids, setKids]);

  const decrementKids = useCallback(() => {
    if (kids > 0) setKids(kids - 1);
  }, [kids, setKids]);

  // ─── Validation & Navigation ───

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name || name.trim().length === 0 || name.trim() === 'My Trip') {
      newErrors.name = 'Please give your trip a name';
    }

    if (!startDate) {
      newErrors.dates = 'Please select a start date';
    } else if (!endDate) {
      newErrors.dates = 'Please select an end date';
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        newErrors.dates = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, startDate, endDate]);

  const handleNext = useCallback(async () => {
    if (!validate()) return;

    if (!isAuthenticated || !user?.uid || user.uid === 'guest-user') {
      Alert.alert(
        'Sign In Required',
        'Please sign in to save your trip and enable sharing & collaboration.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ]
      );
      return;
    }

    // Save trip on Step 1 completion so tripId is available immediately
    if (!tripId) {
      await saveTrip();
    }

    setCurrentStep(2);
    router.push('/trip/destinations');
  }, [validate, isAuthenticated, user, tripId, saveTrip, setCurrentStep, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ─── Derived values ───

  const parsedStartDate = startDate ? new Date(startDate) : null;
  const parsedEndDate = endDate ? new Date(endDate) : null;
  const minimumEndDate = parsedStartDate
    ? new Date(parsedStartDate.getTime() + 86400000)
    : new Date();

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepIndicator}>Step 1 of 4</Text>
            <Text style={styles.headerTitle}>Trip Setup</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Step Navigation ── */}
        <View style={styles.stepNav}>
          {[
            { step: 1, label: 'Setup', route: null },
            { step: 2, label: 'Destinations', route: '/trip/destinations' },
            { step: 3, label: 'Planner', route: '/trip/planner' },
            { step: 4, label: 'Review', route: '/trip/review' },
          ].map((item, idx) => {
            const isCurrent = item.step === 1;
            const isCompleted = false; // Step 1 has nothing before it
            return (
              <React.Fragment key={item.step}>
                {idx > 0 && (
                  <View style={[styles.stepConnector, isCurrent && styles.stepConnectorActive]} />
                )}
                <TouchableOpacity
                  style={[
                    styles.stepDot,
                    isCurrent && styles.stepDotCurrent,
                  ]}
                  onPress={() => {
                    if (item.route && item.step !== 1) {
                      setCurrentStep(item.step);
                      router.push(item.route as any);
                    }
                  }}
                  disabled={isCurrent}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextCurrent]}>
                    {item.step}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Trip Name ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trip Name</Text>
            <TextInput
              style={[styles.textInput, errors.name ? styles.inputError : null]}
              placeholder="My Adventure in..."
              placeholderTextColor={colors.textTertiary}
              value={name === 'My Trip' ? '' : name}
              onChangeText={(text) => {
                setName(text || 'My Trip');
                if (text.trim().length > 0) {
                  setErrors((prev) => ({ ...prev, name: '' }));
                }
              }}
              maxLength={100}
              returnKeyType="done"
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* ── Date Range ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Travel Dates</Text>

            <View style={[styles.dateCard, errors.dates ? styles.dateCardError : null]}>
              {/* Start Date Row */}
              <TouchableOpacity
                style={styles.dateCellBtn}
                onPress={() => setShowStartPicker(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.dateCellIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="airplane-outline" size={16} color={colors.primary[500]} />
                </View>
                <View style={styles.dateCellInfo}>
                  <Text style={styles.dateCellLabel}>Departure</Text>
                  {parsedStartDate ? (
                    <View style={styles.dateCellValueRow}>
                      <Text style={styles.dateCellDay}>{formatDateShort(parsedStartDate).day}</Text>
                      <View style={styles.dateCellRight}>
                        <Text style={styles.dateCellMonth}>
                          {formatDateShort(parsedStartDate).month} {formatDateShort(parsedStartDate).year}
                        </Text>
                        <Text style={styles.dateCellWeekday}>{formatDateShort(parsedStartDate).weekday}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.dateCellPlaceholder}>Select start date</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Divider with duration */}
              <View style={styles.dateDivider}>
                <View style={styles.dateDividerLine} />
                {parsedStartDate && parsedEndDate ? (
                  <View style={styles.dateDividerBadge}>
                    <Ionicons name="time-outline" size={12} color={colors.primary[600]} />
                    <Text style={styles.dateDividerText}>
                      {Math.ceil((parsedEndDate.getTime() - parsedStartDate.getTime()) / 86400000) + 1} days
                    </Text>
                  </View>
                ) : (
                  <View style={styles.dateDividerDot} />
                )}
                <View style={styles.dateDividerLine} />
              </View>

              {/* End Date Row */}
              <TouchableOpacity
                style={styles.dateCellBtn}
                onPress={() => {
                  if (!startDate) {
                    Alert.alert('Start Date Required', 'Please select a start date first.');
                    return;
                  }
                  setShowEndPicker(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.dateCellIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="flag-outline" size={16} color="#F97316" />
                </View>
                <View style={styles.dateCellInfo}>
                  <Text style={styles.dateCellLabel}>Return</Text>
                  {parsedEndDate ? (
                    <View style={styles.dateCellValueRow}>
                      <Text style={styles.dateCellDay}>{formatDateShort(parsedEndDate).day}</Text>
                      <View style={styles.dateCellRight}>
                        <Text style={styles.dateCellMonth}>
                          {formatDateShort(parsedEndDate).month} {formatDateShort(parsedEndDate).year}
                        </Text>
                        <Text style={styles.dateCellWeekday}>{formatDateShort(parsedEndDate).weekday}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.dateCellPlaceholder}>Select end date</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {errors.dates ? <Text style={styles.errorText}>{errors.dates}</Text> : null}
          </View>

          {/* Date Pickers (conditionally rendered) */}
          {showStartPicker && (
            <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
              <DateTimePicker
                value={parsedStartDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={handleStartDateChange}
                accentColor={colors.primary[500]}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setShowStartPicker(false)}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {showEndPicker && (
            <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
              <DateTimePicker
                value={parsedEndDate || minimumEndDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={minimumEndDate}
                onChange={handleEndDateChange}
                accentColor={colors.primary[500]}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setShowEndPicker(false)}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Travelers Counter ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Travelers</Text>
            <View style={styles.counterRow}>
              {/* Adults */}
              <View style={styles.counterBlock}>
                <Text style={styles.counterLabel}>Adults</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, travelers <= 1 && styles.counterBtnDisabled]}
                    onPress={decrementTravelers}
                    disabled={travelers <= 1}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={travelers <= 1 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{travelers}</Text>
                  <TouchableOpacity
                    style={[styles.counterBtn, travelers >= 20 && styles.counterBtnDisabled]}
                    onPress={incrementTravelers}
                    disabled={travelers >= 20}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={travelers >= 20 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.counterDivider} />

              {/* Children */}
              <View style={styles.counterBlock}>
                <Text style={styles.counterLabel}>Children</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, kids <= 0 && styles.counterBtnDisabled]}
                    onPress={decrementKids}
                    disabled={kids <= 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={kids <= 0 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{kids}</Text>
                  <TouchableOpacity
                    style={[styles.counterBtn, kids >= 10 && styles.counterBtnDisabled]}
                    onPress={incrementKids}
                    disabled={kids >= 10}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={kids >= 10 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* ── Budget Tier ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Budget Tier</Text>
            <View style={styles.budgetRow}>
              {BUDGET_TIERS.map((tier) => {
                const isSelected = budget === tier.key;
                return (
                  <TouchableOpacity
                    key={tier.key}
                    style={[styles.budgetCard, isSelected && styles.budgetCardSelected]}
                    onPress={() => setBudget(tier.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.budgetEmoji}>{tier.emoji}</Text>
                    <Text style={[styles.budgetLabel, isSelected && styles.budgetLabelSelected]}>
                      {tier.label}
                    </Text>
                    <Text style={styles.budgetDesc}>{tier.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Trip Type ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trip Type</Text>
            <View style={styles.tripTypeGrid}>
              {TRIP_TYPES.map((type) => {
                const isSelected = tripType === type.key;
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[styles.tripTypeChip, isSelected && styles.tripTypeChipSelected]}
                    onPress={() => setTripType(type.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={type.icon}
                      size={16}
                      color={isSelected ? '#ffffff' : colors.gray[600]}
                    />
                    <Text style={[styles.tripTypeLabel, isSelected && styles.tripTypeLabelSelected]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bottom spacer for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Next Button (fixed at bottom) ── */}
        <View style={styles.bottomBar}>
          {isSaving && (
            <View style={styles.savingBanner}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
              <Text style={styles.savingBannerText}>Saving trip...</Text>
            </View>
          )}
          {tripId && !isSaving && (
            <View style={styles.savedBanner}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.savedBannerText}>Trip saved — share link ready</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.nextButton, isSaving && styles.nextButtonDisabled]}
            onPress={handleNext}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>Continue to Destinations</Text>
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },

  // Step Navigation
  stepNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[200],
  },
  stepDotCurrent: {
    backgroundColor: '#06B6D4',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
  },
  stepDotTextCurrent: {
    color: '#ffffff',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    maxWidth: 50,
  },
  stepConnectorActive: {
    backgroundColor: '#06B6D4',
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },

  // Sections
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // Text Input
  textInput: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Date Card
  dateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  dateCardError: {
    borderColor: colors.error,
  },
  dateCellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  dateCellIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCellInfo: {
    flex: 1,
  },
  dateCellLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  dateCellValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateCellDay: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.text,
    lineHeight: 36,
  },
  dateCellRight: {
    gap: 1,
  },
  dateCellMonth: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dateCellWeekday: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  dateCellPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dateDividerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  dateDividerText: {
    fontSize: 11,
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },
  dateDividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },

  // iOS Picker
  iosPickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iosPickerDoneText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  // Travelers Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  counterBlock: {
    flex: 1,
    alignItems: 'center',
  },
  counterLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  counterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    backgroundColor: colors.background,
  },
  counterBtnDisabled: {
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  counterValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
  counterDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  // Budget Tier
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  budgetCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  budgetEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  budgetLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  budgetLabelSelected: {
    color: colors.primary[700],
  },
  budgetDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Trip Type
  tripTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tripTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tripTypeChipSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  tripTypeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  tripTypeLabelSelected: {
    color: '#ffffff',
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing['2xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadow.md,
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  savingBannerText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  savedBannerText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: fontWeight.medium,
  },
});
