// Quick Itinerary ("1 Min Plan") — the mobile port of the web's TripPlanningModal
// (travel-ai-nextjs/components/modals/TripPlanningModal.jsx).
//
// This is a FORM, not a browse page. Field order mirrors the web exactly:
//   1. Starting Point *          (text)
//   2. Destination *             (text)
//   3. Duration * / Travel month (2-up row of pickers)
//   4. Personalize this trip (optional)  — collapsed: group, budget, pace, vibe, diet
//   5. How will you travel? *    — Car/Bus | Bike/Motorcycle | Flight
//   6. AI-Powered Itinerary callout (NEW badge)
//   7. Cancel / Create Guide
//
// Submit mirrors the web: POST /itinerary/generate-markdown via
// itineraryAPI.generateMarkdown(), then navigate to ./result.
//
// Presented as a full screen (not an RN <Modal>): on a phone the web's centered
// card is effectively full-bleed anyway, and a screen gives us the back gesture,
// keyboard avoidance and a real route for free.
//
// NOTE: this screen previously padded itself with four hardcoded fake itinerary
// templates (Goa/Manali/Kerala/Ladakh with invented rating/reviews/booked counts)
// and a hardcoded CATEGORIES array. All of it is gone — nothing here is invented.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
// Nested inside a gesture-handler ScrollView, plain RN Touchables silently drop
// taps — import both from gesture-handler.
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import {
  useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow,
} from '@prayana/shared-ui';
import { itineraryAPI } from '@prayana/shared-services';
import { PremiumTravelLoading } from '../../components/trip/PremiumTravelLoading';

// Brand teal — the logo's primary (PRAYANA_DESIGN_SYSTEM.pdf). The web modal's
// header/accents are teal, and the old orange (#F97316) hardcodes are dropped.
const TEAL = '#0d9488';
const TEAL_DARK = '#115e59';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MAX_DAYS = 14;

type TransportMode = 'car_bus' | 'bike' | 'flight';

const TRANSPORT_MODES: Array<{
  id: TransportMode;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'car_bus', name: 'Car/Bus', icon: 'car-outline' },
  { id: 'bike', name: 'Bike/Motorcycle', icon: 'bicycle-outline' },
  { id: 'flight', name: 'Flight', icon: 'airplane-outline' },
];

type Option = { value: string; label: string };

const GROUP_OPTIONS: Option[] = [
  { value: 'general', label: 'Anyone' },
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'family-with-kids', label: 'Family + kids' },
  { value: 'friends', label: 'Friends' },
  { value: 'parents', label: 'Senior parents' },
];

const BUDGET_OPTIONS: Option[] = [
  { value: 'frugal', label: 'Frugal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
];

const PACE_OPTIONS: Option[] = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'packed', label: 'Packed' },
];

const VIBE_OPTIONS: Option[] = [
  { value: '', label: 'No preference' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'nature', label: 'Nature' },
  { value: 'food', label: 'Food' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'nightlife', label: 'Nightlife' },
];

const DIET_OPTIONS: Option[] = [
  { value: '', label: 'Any' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
  { value: 'halal', label: 'Halal' },
  { value: 'non-veg', label: 'Non-veg' },
];

type SeasonAdvice = {
  severity: 'block' | 'warn' | 'info' | 'ok';
  reason?: string;
  suggestedMonths?: string;
};

export default function QuickItineraryScreen() {
  const { themeColors } = useTheme();

  // ---- form state (mirrors the web modal's defaults) ----
  const [startingPoint, setStartingPoint] = useState('');
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(5);
  // 0-indexed month string, "" = flexible. Web defaults to the *next* month.
  const [travelMonth, setTravelMonth] = useState<string>(() =>
    String((new Date().getMonth() + 1) % 12)
  );

  const [showPersona, setShowPersona] = useState(false);
  const [groupType, setGroupType] = useState('general');
  const [budgetTier, setBudgetTier] = useState('moderate');
  const [pace, setPace] = useState('balanced');
  const [vibe, setVibe] = useState('');
  const [diet, setDiet] = useState('');

  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');

  // ---- picker sheets ----
  const [showDaysPicker, setShowDaysPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // ---- submission ----
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [seasonAdvice, setSeasonAdvice] = useState<SeasonAdvice | null>(null);
  const submittingRef = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  // Mirrors the web's simulateProgress(): tick up by a random 5–20% every 600ms,
  // but CAP AT 90% — the bar only completes when the real response lands.
  const startProgress = useCallback(() => {
    stopProgress();
    setProgress(0);
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 15 + 5;
        if (next >= 90) {
          stopProgress();
          return 90;
        }
        return next;
      });
    }, 600);
  }, [stopProgress]);

  useEffect(() => () => stopProgress(), [stopProgress]);

  const canSubmit =
    !!startingPoint.trim() && !!destination.trim() && !!transportMode && !!days && !isGenerating;

  const monthLabel = travelMonth === '' ? 'Flexible' : MONTHS[Number(travelMonth)];

  const handleSubmit = useCallback(
    async ({ skipSeasonValidation = false } = {}) => {
      if (submittingRef.current || isGenerating) return;

      // Validation order matches the web modal.
      if (!startingPoint.trim()) return setError('Please enter a starting point');
      if (!destination.trim()) return setError('Please enter a destination');
      if (!transportMode) return setError('Please select a travel mode');

      submittingRef.current = true;
      setIsGenerating(true);
      setError('');
      setSeasonAdvice(null);
      startProgress();

      // Web converts the 0-based index to a 1-based, zero-padded string ("06").
      const monthNum =
        !skipSeasonValidation && travelMonth !== ''
          ? String(parseInt(travelMonth, 10) + 1).padStart(2, '0')
          : null;

      const requestData = {
        destination: destination.trim(),
        duration: days,
        startingPoint: startingPoint.trim() || null,
        transportMode,
        travelMonth: monthNum,
        preferences: {
          groupType: groupType || 'general',
          budget: budgetTier || 'moderate',
          pace: pace || 'balanced',
          travelStyle: pace || 'balanced',
          vibes: vibe ? [vibe] : [],
          diet: diet || null,
          interests: [] as string[],
        },
      };

      try {
        const response: any = await itineraryAPI.generateMarkdown(requestData);

        if (response?.success && response.data) {
          // The real response landed — only now may the bar reach 100%.
          stopProgress();
          setProgress(100);
          // Let the completed bar register before we navigate (web waits 800ms).
          await new Promise((r) => setTimeout(r, 400));

          router.push({
            pathname: '/quick-itinerary/result',
            params: {
              data: JSON.stringify(response.data),
              destination: requestData.destination,
              duration: String(days),
            },
          });
        } else {
          throw new Error(response?.message || 'Failed to generate travel guide');
        }
      } catch (e: any) {
        // The backend blocks seasonally-infeasible trips with a 422. Surface it
        // as advice with an escape hatch, exactly as the web does.
        const body = e?.body;
        if (body?.error === 'SEASON_INFEASIBLE') {
          setSeasonAdvice({
            severity: 'block',
            reason: body.message,
            suggestedMonths: body.suggestedMonths,
          });
        } else {
          setError(
            e?.message?.includes('Failed to fetch') || e?.message?.includes('Network')
              ? 'Network error. Please check your connection and try again.'
              : e?.message || 'Failed to generate travel guide. Please try again.'
          );
        }
      } finally {
        stopProgress();
        setProgress(0);
        submittingRef.current = false;
        setIsGenerating(false);
      }
    },
    [
      startingPoint, destination, transportMode, days, travelMonth,
      groupType, budgetTier, pace, vibe, diet, isGenerating,
      startProgress, stopProgress,
    ]
  );

  // Jump to the first month named in the backend's suggestedMonths string.
  const suggestedMonthIndex = useMemo(() => {
    if (!seasonAdvice?.suggestedMonths) return -1;
    const s = seasonAdvice.suggestedMonths.toLowerCase();
    return MONTHS.findIndex((m) => s.includes(m.toLowerCase()));
  }, [seasonAdvice]);

  // ---- small building blocks ----
  const ChipRow = ({
    icon,
    label,
    hint,
    value,
    onChange,
    options,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint?: string;
    value: string;
    onChange: (v: string) => void;
    options: Option[];
  }) => (
    <View style={styles.personaRow}>
      <View style={styles.personaHead}>
        <View style={styles.personaLabelWrap}>
          <Ionicons name={icon} size={14} color={TEAL} />
          <Text style={[styles.personaLabel, { color: themeColors.text }]}>{label}</Text>
        </View>
        {!!hint && (
          <Text style={[styles.personaHint, { color: themeColors.textTertiary }]}>{hint}</Text>
        )}
      </View>
      <View style={styles.chipWrap}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <TouchableOpacity
              key={o.value || 'none'}
              onPress={() => onChange(o.value)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? `${TEAL}1A` : themeColors.surface,
                  borderColor: selected ? TEAL : themeColors.border,
                },
              ]}
            >
              {selected && <Ionicons name="checkmark" size={12} color={TEAL} />}
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? TEAL : themeColors.textSecondary },
                ]}
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Teal gradient header — "Quick Itinerary" / "Powered by AI • Personalized for you" */}
      <LinearGradient
        colors={[TEAL, TEAL_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Quick Itinerary</Text>
            <Text style={styles.headerSub}>Powered by AI • Personalized for you</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isGenerating}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.headerClose, isGenerating && { opacity: 0.5 }]}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Error banner */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* 1. Starting Point */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: themeColors.text }]}>
              Starting Point <Text style={styles.req}>*</Text>
            </Text>
            <View
              style={[
                styles.input,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <Ionicons name="navigate-outline" size={17} color={TEAL} />
              <TextInput
                value={startingPoint}
                onChangeText={(t) => { setStartingPoint(t); if (error) setError(''); }}
                placeholder="Mangalore"
                placeholderTextColor={themeColors.textTertiary}
                editable={!isGenerating}
                autoCorrect={false}
                style={[styles.inputText, { color: themeColors.text }]}
              />
            </View>
          </View>

          {/* 2. Destination */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: themeColors.text }]}>
              Destination <Text style={styles.req}>*</Text>
            </Text>
            <View
              style={[
                styles.input,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <Ionicons name="location-outline" size={17} color={TEAL} />
              <TextInput
                value={destination}
                onChangeText={(t) => { setDestination(t); if (error) setError(''); }}
                placeholder="Bangalore"
                placeholderTextColor={themeColors.textTertiary}
                editable={!isGenerating}
                autoCorrect={false}
                style={[styles.inputText, { color: themeColors.text }]}
              />
            </View>
          </View>

          {/* 3. Duration + Travel month */}
          <View style={styles.row2}>
            <View style={styles.col}>
              <View style={styles.labelRow}>
                <Ionicons name="calendar-outline" size={14} color={TEAL} />
                <Text style={[styles.label, styles.labelInline, { color: themeColors.text }]}>
                  Duration <Text style={styles.req}>*</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isGenerating && setShowDaysPicker(true)}
                disabled={isGenerating}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Duration, ${days} days`}
                style={[
                  styles.select,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
              >
                <Text style={[styles.selectText, { color: themeColors.text }]}>
                  {days} {days === 1 ? 'Day' : 'Days'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={TEAL} />
              </TouchableOpacity>
            </View>

            <View style={styles.col}>
              <View style={styles.labelRow}>
                <Ionicons name="calendar-outline" size={14} color={TEAL} />
                <Text style={[styles.label, styles.labelInline, { color: themeColors.text }]}>
                  Travel month
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isGenerating && setShowMonthPicker(true)}
                disabled={isGenerating}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Travel month, ${monthLabel}`}
                style={[
                  styles.select,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                ]}
              >
                <Text
                  style={[
                    styles.selectText,
                    { color: travelMonth === '' ? themeColors.textTertiary : themeColors.text },
                  ]}
                  numberOfLines={1}
                >
                  {monthLabel}
                </Text>
                <Ionicons name="chevron-down" size={16} color={TEAL} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Season advice (from a 422 SEASON_INFEASIBLE) */}
          {!!seasonAdvice && (
            <View style={styles.seasonBox}>
              <Text style={styles.seasonTitle}>Trip blocked</Text>
              {!!seasonAdvice.reason && <Text style={styles.seasonText}>{seasonAdvice.reason}</Text>}
              {!!seasonAdvice.suggestedMonths && (
                <Text style={styles.seasonText}>
                  <Text style={{ fontWeight: fontWeight.bold }}>Best: </Text>
                  {seasonAdvice.suggestedMonths}
                </Text>
              )}
              <View style={styles.seasonActions}>
                {suggestedMonthIndex >= 0 && (
                  <TouchableOpacity
                    style={styles.seasonBtn}
                    onPress={() => {
                      setTravelMonth(String(suggestedMonthIndex));
                      setSeasonAdvice(null);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={13} color={colors.error} />
                    <Text style={styles.seasonBtnText}>
                      Switch to {MONTHS[suggestedMonthIndex]}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.seasonBtn, styles.seasonBtnWarn]}
                  onPress={() => handleSubmit({ skipSeasonValidation: true })}
                >
                  <Ionicons name="warning-outline" size={13} color="#fff" />
                  <Text style={[styles.seasonBtnText, { color: '#fff' }]}>
                    Generate without dates
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 4. Personalize this trip (optional) */}
          <TouchableOpacity
            onPress={() => setShowPersona((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPersona }}
            style={styles.personaToggle}
          >
            <Ionicons
              name={showPersona ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={TEAL}
            />
            <Text style={styles.personaToggleText}>
              {showPersona ? 'Hide personalization' : 'Personalize this trip (optional)'}
            </Text>
          </TouchableOpacity>

          {showPersona && (
            <View style={[styles.personaBox, { borderColor: themeColors.border }]}>
              <ChipRow
                icon="people-outline"
                label="Who's traveling?"
                value={groupType}
                onChange={setGroupType}
                options={GROUP_OPTIONS}
              />
              <ChipRow
                icon="wallet-outline"
                label="Budget"
                value={budgetTier}
                onChange={setBudgetTier}
                options={BUDGET_OPTIONS}
              />
              <ChipRow
                icon="speedometer-outline"
                label="Pace"
                value={pace}
                onChange={setPace}
                options={PACE_OPTIONS}
              />
              <ChipRow
                icon="sparkles-outline"
                label="Vibe"
                hint="pick one"
                value={vibe}
                onChange={setVibe}
                options={VIBE_OPTIONS}
              />
              <ChipRow
                icon="restaurant-outline"
                label="Diet"
                value={diet}
                onChange={setDiet}
                options={DIET_OPTIONS}
              />
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          {/* 5. How will you travel? */}
          <Text style={[styles.label, { color: themeColors.text, marginBottom: spacing.md }]}>
            How will you travel? <Text style={styles.req}>*</Text>
          </Text>
          <View style={styles.modeRow}>
            {TRANSPORT_MODES.map((mode) => {
              const selected = transportMode === mode.id;
              return (
                // The flex lives on this View, not on the Touchable: a
                // gesture-handler TouchableOpacity does not stretch to flex:1 the
                // way RN's does, so the three cards sized to their own labels and
                // bunched up on the left instead of splitting the row.
                <View key={mode.id} style={styles.modeSlot}>
                <TouchableOpacity
                  onPress={() => { setTransportMode(mode.id); if (error) setError(''); }}
                  disabled={isGenerating}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: selected ? `${TEAL}14` : themeColors.surface,
                      borderColor: selected ? TEAL : themeColors.border,
                    },
                    selected && shadow.md,
                    isGenerating && { opacity: 0.5 },
                  ]}
                >
                  <View
                    style={[
                      styles.modeIcon,
                      { backgroundColor: selected ? `${TEAL}1F` : themeColors.backgroundSecondary },
                    ]}
                  >
                    <Ionicons
                      name={mode.icon}
                      size={22}
                      color={selected ? TEAL : themeColors.textTertiary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.modeName,
                      { color: selected ? TEAL : themeColors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {mode.name}
                  </Text>
                  {selected && (
                    <View style={styles.modeCheck}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* 6. AI-Powered Itinerary callout */}
          <View style={[styles.aiBanner, { borderColor: `${TEAL}33` }]}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={16} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.aiTitleRow}>
                <Text style={[styles.aiTitle, { color: themeColors.text }]}>
                  AI-Powered Itinerary
                </Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>NEW</Text>
                </View>
              </View>
              <Text style={[styles.aiSub, { color: themeColors.textSecondary }]}>
                Personalized recommendations & insider tips
              </Text>
            </View>
          </View>

          {/* 7. Actions */}
          <View style={styles.actions}>
            {/* The flex lives on these wrapper Views, not on the Touchables — a
                gesture-handler TouchableOpacity ignores flex, so the buttons
                collapsed to their labels ("Cancel" became a vertical sliver). */}
            <View style={styles.cancelSlot}>
              <TouchableOpacity
                onPress={() => router.back()}
                disabled={isGenerating}
                activeOpacity={0.8}
                accessibilityRole="button"
                style={[
                  styles.cancelBtn,
                  { borderColor: themeColors.border },
                  isGenerating && { opacity: 0.5 },
                ]}
              >
                <Text style={[styles.cancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.submitSlot}>
              <TouchableOpacity
                onPress={() => handleSubmit()}
                disabled={!canSubmit}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                style={[styles.submitBtn, !canSubmit && { opacity: 0.45 }]}
              >
                <LinearGradient
                  colors={canSubmit ? [TEAL, TEAL_DARK] : [colors.gray[300], colors.gray[400]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  <Text style={styles.submitText} numberOfLines={1}>Create Guide</Text>
                  <Ionicons name="chevron-forward" size={16} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Duration picker */}
      <Modal
        visible={showDaysPicker}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowDaysPicker(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowDaysPicker(false)}
        >
          <View style={[styles.sheet, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Trip duration</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => {
                const selected = d === days;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => { setDays(d); setShowDaysPicker(false); }}
                    style={[styles.sheetRow, selected && { backgroundColor: `${TEAL}14` }]}
                  >
                    <Text
                      style={[
                        styles.sheetRowText,
                        { color: selected ? TEAL : themeColors.text },
                        selected && { fontWeight: fontWeight.semibold },
                      ]}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color={TEAL} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Travel-month picker */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={[styles.sheet, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Travel month</Text>

            <TouchableOpacity
              onPress={() => { setTravelMonth(''); setShowMonthPicker(false); }}
              style={[styles.sheetRow, travelMonth === '' && { backgroundColor: `${TEAL}14` }]}
            >
              <Text
                style={[
                  styles.sheetRowText,
                  { color: travelMonth === '' ? TEAL : themeColors.text },
                ]}
              >
                Skip — flexible dates
              </Text>
              {travelMonth === '' && <Ionicons name="checkmark" size={18} color={TEAL} />}
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => {
                const selected = travelMonth === String(i);
                const isCurrent = i === new Date().getMonth();
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => { setTravelMonth(String(i)); setShowMonthPicker(false); }}
                    accessibilityLabel={m}
                    style={[
                      styles.monthCell,
                      {
                        backgroundColor: selected ? TEAL : themeColors.backgroundSecondary,
                        borderColor: selected ? TEAL : themeColors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthText,
                        { color: selected ? '#fff' : themeColors.textSecondary },
                      ]}
                    >
                      {m.slice(0, 3)}
                    </Text>
                    {isCurrent && !selected && <View style={styles.monthDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Generating overlay — the branded compass loader.
          Not dismissible: onRequestClose is a no-op and there is no backdrop
          press target, mirroring the web (close disabled, backdrop ignored). */}
      <Modal
        visible={isGenerating}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { /* blocked mid-generation, as on web */ }}
      >
        <View style={[styles.genScreen, { backgroundColor: themeColors.background }]}>
          <PremiumTravelLoading
            message={
              destination.trim()
                ? `Planning your ${days}-day trip to ${destination.trim()}...`
                : 'Planning your perfect journey...'
            }
            progress={progress}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  headerIcon: {
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.xs, marginTop: 2 },
  headerClose: { padding: spacing.sm, borderRadius: borderRadius.lg },

  // Body
  body: { padding: spacing.lg, paddingBottom: spacing['4xl'] },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.errorLight,
    marginBottom: spacing.lg,
  },
  errorText: { flex: 1, color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  field: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.sm },
  labelInline: { marginBottom: 0 },
  req: { color: TEAL },

  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  inputText: { flex: 1, paddingVertical: spacing.md, fontSize: fontSize.md },

  row2: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  selectText: { fontSize: fontSize.sm, flex: 1 },

  // Season advice
  seasonBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
    gap: 4,
  },
  seasonTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.error },
  seasonText: { fontSize: fontSize.sm, color: colors.error },
  seasonActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  seasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.error,
  },
  seasonBtnWarn: { backgroundColor: colors.warning, borderColor: colors.warning },
  seasonBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.error },

  // Persona
  personaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  personaToggleText: { color: TEAL, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  personaBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  personaRow: { gap: spacing.sm },
  personaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personaLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personaLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  personaHint: { fontSize: fontSize.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  divider: { height: 1, marginVertical: spacing.lg },

  // Transport modes
  modeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  // Layout slot: each takes exactly one third of the row. The flex must live
  // here rather than on the Touchable — see the note at the render site.
  modeSlot: { flex: 1, flexBasis: 0, minWidth: 0 },
  modeCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    lineHeight: 14,
  },
  modeCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // AI banner
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    backgroundColor: `${TEAL}0D`,
    marginBottom: spacing.lg,
  },
  aiIcon: {
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: `${TEAL}1F`,
  },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  aiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: TEAL,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
  },
  aiSub: { fontSize: fontSize.xs, marginTop: 3 },

  // Actions
  actions: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  // Layout slots carry the flex (the Touchables inside them cannot — see the
  // note at the render site). Cancel takes a third, Create Guide the rest.
  cancelSlot: { flex: 1, flexBasis: 0, minWidth: 0 },
  submitSlot: { flex: 1.7, flexBasis: 0, minWidth: 0 },
  cancelBtn: {
    width: '100%',
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  submitBtn: { width: '100%', borderRadius: borderRadius.lg, overflow: 'hidden' },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md + 2,
  },
  submitText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Bottom sheets
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  sheetRowText: { fontSize: fontSize.md },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  monthCell: {
    width: '30.5%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  monthDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: TEAL,
  },

  // Generating overlay — full-bleed branded loader
  genScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
