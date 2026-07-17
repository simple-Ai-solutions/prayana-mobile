// Day-by-day itinerary builder — RN port of the web partner-portal's
// business/packages/ItineraryBuilder.jsx (the ground truth for the day schema,
// quick-add templates, AI generation, and the add/remove/reorder + renumber
// invariant). Rendered as one step of the holiday-package wizard.
//
// Deviations from web (phone-simplified — see this agent's report):
//   • Meals: no buffet/set_menu/a_la_carte type picker (type left undefined).
//   • Accommodation: hotelName + category chips + roomType only (no check-in/out).
//   • Transport: mode + from/to + isIncluded (no vehicle description / duration).
//   • Place/city autocomplete → plain themed TextInput.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, TextInput, useTheme } from '@prayana/shared-ui';
import { makeAPICall, getAuthHeaders } from '@prayana/shared-services';
import { Button } from '../../../components/ui';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../../theme/vendorColors';
import {
  StepProps,
  ItineraryDay,
  ItineraryActivity,
  ItineraryMeals,
  ItineraryAccommodation,
  ItineraryTransport,
  Destination,
  TimeOfDay,
  makeEmptyMeals,
} from './packageTypes';

type ThemeColorsT = ReturnType<typeof useTheme>['themeColors'];

// ============================================================
// Constants (ported from web)
// ============================================================

const TIME_OF_DAY: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'full_day'];
const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  full_day: 'Full Day',
};

const HOTEL_CATEGORIES = ['budget', 'standard', 'premium', 'luxury'] as const;
type HotelCategory = (typeof HOTEL_CATEGORIES)[number];
const HOTEL_LABELS: Record<HotelCategory, string> = {
  budget: 'Budget (2-3★)',
  standard: 'Standard (3-4★)',
  premium: 'Premium (4-5★)',
  luxury: 'Luxury (5★)',
};

const TRANSPORT_MODES = ['car', 'bus', 'train', 'flight', 'ferry', 'self'] as const;
type TransportMode = (typeof TRANSPORT_MODES)[number];
const TRANSPORT_ICONS: Record<TransportMode, string> = {
  car: '🚗',
  bus: '🚌',
  train: '🚂',
  flight: '✈️',
  ferry: '⛴️',
  self: '🚶',
};

type QuickActivity = {
  title: string;
  timeOfDay: TimeOfDay;
  duration: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const QUICK_ACTIVITIES: QuickActivity[] = [
  { title: 'Sightseeing Tour', timeOfDay: 'morning', duration: 3, icon: 'camera-outline' },
  { title: 'Temple Visit', timeOfDay: 'morning', duration: 2, icon: 'business-outline' },
  { title: 'Beach Time', timeOfDay: 'afternoon', duration: 3, icon: 'water-outline' },
  { title: 'Shopping', timeOfDay: 'afternoon', duration: 2, icon: 'bag-outline' },
  { title: 'Night Market', timeOfDay: 'evening', duration: 2, icon: 'moon-outline' },
  { title: 'Nature Trek', timeOfDay: 'morning', duration: 4, icon: 'leaf-outline' },
  { title: 'Water Sports', timeOfDay: 'afternoon', duration: 2, icon: 'boat-outline' },
  { title: 'Photography Walk', timeOfDay: 'morning', duration: 2, icon: 'camera-outline' },
];

// ============================================================
// Factories
// ============================================================

function makeActivity(template?: QuickActivity): ItineraryActivity {
  return {
    title: template?.title ?? '',
    description: '',
    duration: { value: template?.duration ?? 2, unit: 'hours' },
    timeOfDay: template?.timeOfDay ?? 'morning',
    isIncluded: true,
    isOptional: false,
    isSwappable: false,
    estimatedCost: 0,
  };
}

function seedDay(i: number, destinations: Destination[]): ItineraryDay {
  const idx = Math.min(i, Math.max(0, destinations.length - 1));
  const destination = destinations[idx]?.name || destinations[0]?.city || '';
  return {
    dayNumber: i + 1,
    title: '',
    description: '',
    destination,
    activities: [],
    meals: makeEmptyMeals(),
    accommodation: {},
    transport: {},
    notes: '',
  };
}

function emptyDay(dayNumber: number): ItineraryDay {
  return {
    dayNumber,
    title: '',
    description: '',
    destination: '',
    activities: [],
    meals: makeEmptyMeals(),
    accommodation: {},
    transport: {},
    notes: '',
  };
}

// ============================================================
// Small building blocks
// ============================================================

function Chip({
  label,
  active,
  onPress,
  themeColors,
  leading,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  themeColors: ThemeColorsT;
  leading?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        { borderColor: themeColors.border, backgroundColor: themeColors.surface },
        active && styles.chipActive,
      ]}
    >
      {leading ? <Text style={styles.chipLeading}>{leading} </Text> : null}
      <Text
        style={[
          styles.chipText,
          { color: active ? '#fff' : themeColors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  themeColors,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  themeColors: ThemeColorsT;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary[400], false: themeColors.border }}
      />
    </View>
  );
}

function HoursStepper({
  value,
  onChange,
  themeColors,
}: {
  value: number;
  onChange: (v: number) => void;
  themeColors: ThemeColorsT;
}) {
  return (
    <View style={styles.hoursRow}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(0, value - 1))}
        hitSlop={6}
        style={[styles.hoursBtn, { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
      >
        <Ionicons name="remove" size={16} color={colors.primary[500]} />
      </TouchableOpacity>
      <RNTextInput
        value={String(value)}
        onChangeText={(t) => onChange(parseInt(t.replace(/[^0-9]/g, ''), 10) || 0)}
        keyboardType="number-pad"
        style={[
          styles.hoursInput,
          { color: themeColors.text, borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field },
        ]}
      />
      <Text style={[styles.hoursUnit, { color: themeColors.textTertiary }]}>hrs</Text>
      <TouchableOpacity
        onPress={() => onChange(value + 1)}
        hitSlop={6}
        style={[styles.hoursBtn, { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
      >
        <Ionicons name="add" size={16} color={colors.primary[500]} />
      </TouchableOpacity>
    </View>
  );
}

function SectionLabel({
  icon,
  color,
  children,
  themeColors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  children: string;
  themeColors: ThemeColorsT;
}) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>{children}</Text>
    </View>
  );
}

// ============================================================
// Activity editor
// ============================================================

function ActivityRow({
  activity,
  index,
  total,
  themeColors,
  onUpdate,
  onRemove,
  onMove,
}: {
  activity: ItineraryActivity;
  index: number;
  total: number;
  themeColors: ThemeColorsT;
  onUpdate: (patch: Partial<ItineraryActivity>) => void;
  onRemove: () => void;
  onMove: (dir: number) => void;
}) {
  return (
    <View style={[styles.activityCard, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}>
      <View style={styles.activityHead}>
        <View style={styles.moveCol}>
          <TouchableOpacity onPress={() => onMove(-1)} disabled={index === 0} hitSlop={6}>
            <Ionicons
              name="chevron-up"
              size={16}
              color={index === 0 ? themeColors.border : themeColors.textTertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onMove(1)} disabled={index === total - 1} hitSlop={6}>
            <Ionicons
              name="chevron-down"
              size={16}
              color={index === total - 1 ? themeColors.border : themeColors.textTertiary}
            />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <RNTextInput
            value={activity.title}
            onChangeText={(t) => onUpdate({ title: t })}
            placeholder="Activity name"
            placeholderTextColor={themeColors.textTertiary}
            style={[styles.activityTitleInput, { color: themeColors.text, borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
          />
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={6} style={styles.activityRemove}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>

      <RNTextInput
        value={activity.description}
        onChangeText={(t) => onUpdate({ description: t })}
        placeholder="Brief description (optional)"
        placeholderTextColor={themeColors.textTertiary}
        style={[styles.activityDescInput, { color: themeColors.text, borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
      />

      <View style={styles.chipWrap}>
        {TIME_OF_DAY.map((t) => (
          <Chip
            key={t}
            label={TIME_LABELS[t]}
            active={activity.timeOfDay === t}
            onPress={() => onUpdate({ timeOfDay: t })}
            themeColors={themeColors}
          />
        ))}
      </View>

      <View style={styles.activityFooter}>
        <HoursStepper
          value={activity.duration?.value || 0}
          onChange={(v) => onUpdate({ duration: { value: v, unit: 'hours' } })}
          themeColors={themeColors}
        />
      </View>

      <View style={styles.activityToggles}>
        <ToggleRow
          label="Included"
          value={activity.isIncluded}
          onValueChange={(v) => onUpdate({ isIncluded: v })}
          themeColors={themeColors}
        />
        <ToggleRow
          label="Optional"
          value={activity.isOptional}
          onValueChange={(v) => onUpdate({ isOptional: v })}
          themeColors={themeColors}
        />
      </View>
    </View>
  );
}

// ============================================================
// Day card
// ============================================================

function DayCard({
  day,
  dayIndex,
  totalDays,
  destinations,
  themeColors,
  onChangeDay,
  onRemove,
  onMove,
}: {
  day: ItineraryDay;
  dayIndex: number;
  totalDays: number;
  destinations: Destination[];
  themeColors: ThemeColorsT;
  onChangeDay: (index: number, day: ItineraryDay) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: number) => void;
}) {
  const [expanded, setExpanded] = useState(dayIndex === 0);

  const updateDay = (patch: Partial<ItineraryDay>) => onChangeDay(dayIndex, { ...day, ...patch });

  const activities = day.activities || [];
  const meals: ItineraryMeals = day.meals || makeEmptyMeals();
  const accommodation: ItineraryAccommodation = day.accommodation || {};
  const transport: ItineraryTransport = day.transport || {};

  const activityCount = activities.length;
  const mealsIncluded = (['breakfast', 'lunch', 'dinner'] as const).filter((m) => meals[m]?.included).length;

  // ── Activity ops ──
  const addActivity = (template?: QuickActivity) =>
    updateDay({ activities: [...activities, makeActivity(template)] });

  const updateActivity = (i: number, patch: Partial<ItineraryActivity>) => {
    const next = activities.slice();
    next[i] = { ...next[i], ...patch };
    updateDay({ activities: next });
  };

  const removeActivity = (i: number) => updateDay({ activities: activities.filter((_, idx) => idx !== i) });

  const moveActivity = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= activities.length) return;
    const next = activities.slice();
    [next[i], next[j]] = [next[j], next[i]];
    updateDay({ activities: next });
  };

  // ── Meals ──
  const updateMeal = (meal: keyof ItineraryMeals, patch: Partial<ItineraryMeals['breakfast']>) =>
    updateDay({ meals: { ...meals, [meal]: { ...meals[meal], ...patch } } });

  const destOptions = destinations.filter((d) => d.name || d.city);

  return (
    <Card style={[styles.dayCard, expanded && { borderColor: colors.primary[500], borderWidth: 1.5 }]}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
        style={styles.dayHeader}
      >
        <View style={[styles.dayBadge, { backgroundColor: colors.primary[500] }]}>
          <Text style={styles.dayBadgeText}>{day.dayNumber}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.dayTitle, { color: themeColors.text }]} numberOfLines={1}>
            {day.title?.trim() || 'Untitled'}
          </Text>
          <View style={styles.dayMetaRow}>
            {day.destination ? (
              <View style={styles.dayMetaItem}>
                <Ionicons name="location-outline" size={11} color={colors.primary[500]} />
                <Text style={[styles.dayMetaText, { color: colors.primary[500] }]} numberOfLines={1}>
                  {day.destination}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.dayMetaText, { color: themeColors.textTertiary }]}>
              {activityCount} {activityCount === 1 ? 'activity' : 'activities'}
            </Text>
            {mealsIncluded > 0 ? (
              <Text style={[styles.dayMetaText, { color: themeColors.textTertiary }]}>
                {mealsIncluded} meals
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.dayHeaderActions}>
          {dayIndex > 0 ? (
            <TouchableOpacity onPress={() => onMove(dayIndex, -1)} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="arrow-up" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
          ) : null}
          {dayIndex < totalDays - 1 ? (
            <TouchableOpacity onPress={() => onMove(dayIndex, 1)} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="arrow-down" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
          ) : null}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={themeColors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.dayBody}>
          {/* Title + destination + summary */}
          <TextInput
            label="Day title"
            value={day.title}
            onChangeText={(t) => updateDay({ title: t })}
            placeholder='e.g., "Arrival & City Exploration"'
          />
          <TextInput
            label="Destination"
            value={day.destination}
            onChangeText={(t) => updateDay({ destination: t })}
            placeholder="City for this day"
          />
          {destOptions.length > 0 ? (
            <View style={[styles.chipWrap, { marginTop: -spacing.sm, marginBottom: spacing.md }]}>
              {destOptions.map((d, i) => {
                const label = d.name || d.city;
                return (
                  <Chip
                    key={`${label}-${i}`}
                    label={d.nightsHere ? `${label} · ${d.nightsHere}N` : label}
                    active={day.destination === label}
                    onPress={() => updateDay({ destination: label })}
                    themeColors={themeColors}
                  />
                );
              })}
            </View>
          ) : null}
          <TextInput
            label="Day summary"
            value={day.description}
            onChangeText={(t) => updateDay({ description: t })}
            placeholder="Brief overview of this day"
            multiline
            numberOfLines={2}
          />

          {/* Activities */}
          <SectionLabel icon="map-outline" color={colors.primary[500]} themeColors={themeColors}>
            Activities
          </SectionLabel>
          <View style={styles.chipWrap}>
            {QUICK_ACTIVITIES.map((qa) => (
              <TouchableOpacity
                key={qa.title}
                onPress={() => addActivity(qa)}
                activeOpacity={0.7}
                style={[styles.quickChip, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
              >
                <Ionicons name={qa.icon} size={12} color={colors.primary[500]} />
                <Text style={[styles.quickChipText, { color: themeColors.textSecondary }]}>{qa.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
            <Button
              title="Add blank activity"
              onPress={() => addActivity()}
              variant="outline"
              size="sm"
              icon={<Ionicons name="add" size={15} color={colors.primary[500]} />}
            />
          </View>

          {activities.length === 0 ? (
            <Text style={[styles.emptyHint, { color: themeColors.textTertiary, backgroundColor: themeColors.backgroundSecondary }]}>
              No activities yet — tap a quick-add chip or "Add blank activity".
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {activities.map((act, i) => (
                <ActivityRow
                  key={i}
                  activity={act}
                  index={i}
                  total={activities.length}
                  themeColors={themeColors}
                  onUpdate={(patch) => updateActivity(i, patch)}
                  onRemove={() => removeActivity(i)}
                  onMove={(dir) => moveActivity(i, dir)}
                />
              ))}
            </View>
          )}

          {/* Meals */}
          <View style={styles.sectionSpacer} />
          <SectionLabel icon="restaurant-outline" color={colors.primary[500]} themeColors={themeColors}>
            Meals
          </SectionLabel>
          <View style={{ gap: spacing.sm }}>
            {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => {
              const included = meals[meal]?.included || false;
              return (
                <View
                  key={meal}
                  style={[
                    styles.mealCard,
                    { borderColor: included ? colors.primary[500] : themeColors.border },
                  ]}
                >
                  <ToggleRow
                    label={meal.charAt(0).toUpperCase() + meal.slice(1)}
                    value={included}
                    onValueChange={(v) => updateMeal(meal, { included: v })}
                    themeColors={themeColors}
                  />
                  {included ? (
                    <RNTextInput
                      value={meals[meal]?.venue || ''}
                      onChangeText={(t) => updateMeal(meal, { venue: t })}
                      placeholder="Venue / restaurant (optional)"
                      placeholderTextColor={themeColors.textTertiary}
                      style={[styles.venueInput, { color: themeColors.text, borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Accommodation */}
          <View style={styles.sectionSpacer} />
          <SectionLabel icon="bed-outline" color="#8b5cf6" themeColors={themeColors}>
            Accommodation
          </SectionLabel>
          <TextInput
            label="Hotel name"
            value={accommodation.hotelName || ''}
            onChangeText={(t) => updateDay({ accommodation: { ...accommodation, hotelName: t } })}
            placeholder="Hotel name"
          />
          <View style={[styles.chipWrap, { marginBottom: spacing.md }]}>
            {HOTEL_CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={HOTEL_LABELS[c]}
                active={accommodation.hotelCategory === c}
                onPress={() => updateDay({ accommodation: { ...accommodation, hotelCategory: c } })}
                themeColors={themeColors}
              />
            ))}
          </View>
          <TextInput
            label="Room type"
            value={accommodation.roomType || ''}
            onChangeText={(t) => updateDay({ accommodation: { ...accommodation, roomType: t } })}
            placeholder="e.g., Deluxe, Suite"
          />

          {/* Transport */}
          <View style={styles.sectionSpacer} />
          <SectionLabel icon="car-outline" color={themeColors.textSecondary} themeColors={themeColors}>
            Transport
          </SectionLabel>
          <View style={[styles.chipWrap, { marginBottom: spacing.md }]}>
            {TRANSPORT_MODES.map((m) => (
              <Chip
                key={m}
                leading={TRANSPORT_ICONS[m]}
                label={m.charAt(0).toUpperCase() + m.slice(1)}
                active={transport.mode === m}
                onPress={() => updateDay({ transport: { ...transport, mode: m } })}
                themeColors={themeColors}
              />
            ))}
          </View>
          <TextInput
            label="From"
            value={transport.fromLocation || ''}
            onChangeText={(t) => updateDay({ transport: { ...transport, fromLocation: t } })}
            placeholder="From location"
          />
          <TextInput
            label="To"
            value={transport.toLocation || ''}
            onChangeText={(t) => updateDay({ transport: { ...transport, toLocation: t } })}
            placeholder="To location"
          />
          <View style={[styles.transportToggle, { borderColor: themeColors.border }]}>
            <ToggleRow
              label="Transport included in price"
              value={transport.isIncluded !== false}
              onValueChange={(v) => updateDay({ transport: { ...transport, isIncluded: v } })}
              themeColors={themeColors}
            />
          </View>

          {/* Notes */}
          <View style={styles.sectionSpacer} />
          <SectionLabel icon="document-text-outline" color="#eab308" themeColors={themeColors}>
            Day notes
          </SectionLabel>
          <TextInput
            value={day.notes}
            onChangeText={(t) => updateDay({ notes: t })}
            placeholder="Tips, dress code, things to carry, local insights…"
            multiline
            numberOfLines={3}
          />

          {/* Remove day */}
          {totalDays > 1 ? (
            <TouchableOpacity onPress={() => onRemove(dayIndex)} style={styles.removeDayBtn} hitSlop={6}>
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={[styles.removeDayText, { color: colors.error }]}>Remove Day {day.dayNumber}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// ============================================================
// Main component
// ============================================================

export default function ItineraryBuilder({ values, onChange }: StepProps) {
  const { themeColors } = useTheme();
  const [aiGenerating, setAiGenerating] = useState(false);
  const hasSeeded = useRef(false);

  const destinations = values.destinations || [];
  const itinerary = values.itinerary || [];
  const nights = Math.max(0, Number(values.nights) || 0);
  const days = nights + 1;

  // Auto-seed nights+1 empty days once, when the itinerary is empty.
  useEffect(() => {
    if (itinerary.length === 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      const seeded = Array.from({ length: Math.max(1, days) }, (_, i) => seedDay(i, destinations));
      onChange({ itinerary: seeded });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary.length, days]);

  // ── Day ops (renumber-after-mutation invariant) ──
  const handleChangeDay = useCallback(
    (dayIndex: number, updated: ItineraryDay) => {
      const next = itinerary.slice();
      next[dayIndex] = updated;
      onChange({ itinerary: next });
    },
    [itinerary, onChange]
  );

  const handleRemoveDay = useCallback(
    (dayIndex: number) => {
      if (itinerary.length <= 1) return;
      const next = itinerary
        .filter((_, i) => i !== dayIndex)
        .map((d, i) => ({ ...d, dayNumber: i + 1 }));
      onChange({ itinerary: next });
    },
    [itinerary, onChange]
  );

  const handleMoveDay = useCallback(
    (dayIndex: number, dir: number) => {
      const j = dayIndex + dir;
      if (j < 0 || j >= itinerary.length) return;
      const next = itinerary.slice();
      [next[dayIndex], next[j]] = [next[j], next[dayIndex]];
      next.forEach((d, i) => {
        d.dayNumber = i + 1;
      });
      onChange({ itinerary: next });
    },
    [itinerary, onChange]
  );

  const handleAddDay = useCallback(() => {
    onChange({ itinerary: [...itinerary, emptyDay(itinerary.length + 1)] });
  }, [itinerary, onChange]);

  // ── AI generation (port of web handleAIGenerate) ──
  const runAIGenerate = useCallback(async () => {
    const dests = destinations.filter((d) => d.city || d.name);
    setAiGenerating(true);
    try {
      const destList = dests.map((d) => `${d.city || d.name} (${d.nightsHere || 1} nights)`).join(', ');
      const categories = (values.category || []).join(', ');

      const prompt = `Generate a detailed ${days}-day travel itinerary for a trip covering: ${destList}.
Package category: ${categories || 'Holiday Package'}.
Duration: ${nights} nights / ${days} days.

For EACH day, provide:
- title: catchy day title
- destination: which city this day is in
- activities: 2-4 activities with title, description (1 sentence), timeOfDay (morning/afternoon/evening), duration (hours)
- meals: which meals are included (breakfast/lunch/dinner), with venue suggestions
- accommodation: hotel name suggestion, category (budget/standard/premium/luxury)
- transport: mode (car/bus/train/flight), from, to (if inter-city travel)
- notes: local tips

Return ONLY valid JSON array format:
[{"dayNumber":1,"title":"...","destination":"...","activities":[{"title":"...","description":"...","timeOfDay":"morning","duration":{"value":2,"unit":"hours"},"isIncluded":true,"isOptional":false}],"meals":{"breakfast":{"included":true,"venue":"..."},"lunch":{"included":true,"venue":"..."},"dinner":{"included":true,"venue":"..."}},"accommodation":{"hotelName":"...","hotelCategory":"standard","checkIn":true},"transport":{"mode":"car","fromLocation":"...","toLocation":"...","isIncluded":true},"notes":"..."}]`;

      const response: any = await makeAPICall('/ai/generate', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ prompt, temperature: 0.7, maxOutputTokens: 8000 }),
        timeout: 90000,
      });

      const text: string | undefined = response?.text || response?.content;
      if (!text) {
        Toast.show({ type: 'error', text1: 'No response from AI', text2: 'Please try again.' });
        return;
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        Toast.show({ type: 'error', text1: 'Could not parse AI response', text2: 'Please try again.' });
        return;
      }

      const generated = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(generated) || generated.length === 0) {
        Toast.show({ type: 'error', text1: 'AI returned an unexpected format', text2: 'Please try again.' });
        return;
      }

      const mapped: ItineraryDay[] = generated.map((raw: any, i: number) => {
        const emptyMeals = makeEmptyMeals();
        const meals: ItineraryMeals = {
          breakfast: { ...emptyMeals.breakfast, included: raw?.meals?.breakfast?.included === true, venue: raw?.meals?.breakfast?.venue || '' },
          lunch: { ...emptyMeals.lunch, included: raw?.meals?.lunch?.included === true, venue: raw?.meals?.lunch?.venue || '' },
          dinner: { ...emptyMeals.dinner, included: raw?.meals?.dinner?.included === true, venue: raw?.meals?.dinner?.venue || '' },
        };
        return {
          dayNumber: i + 1,
          title: raw?.title || '',
          description: raw?.description || '',
          destination: raw?.destination || '',
          activities: (raw?.activities || []).map((a: any): ItineraryActivity => ({
            title: a?.title || '',
            description: a?.description || '',
            duration: {
              value: Number(a?.duration?.value) || 2,
              unit: 'hours',
            },
            timeOfDay: (TIME_OF_DAY.includes(a?.timeOfDay) ? a.timeOfDay : 'morning') as TimeOfDay,
            isIncluded: a?.isIncluded !== false,
            isOptional: a?.isOptional || false,
            isSwappable: false,
            estimatedCost: 0,
          })),
          meals,
          accommodation: (raw?.accommodation || {}) as ItineraryAccommodation,
          transport: (raw?.transport || {}) as ItineraryTransport,
          notes: raw?.notes || '',
        };
      });

      onChange({ itinerary: mapped });
      Toast.show({ type: 'success', text1: `Generated ${mapped.length}-day itinerary!` });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'AI generation failed',
        text2: 'Please fill manually or try again.',
      });
    } finally {
      setAiGenerating(false);
    }
  }, [destinations, values.category, days, nights, onChange]);

  const handleAIGenerate = useCallback(() => {
    const dests = destinations.filter((d) => d.city || d.name);
    if (dests.length === 0) {
      Toast.show({ type: 'error', text1: 'Add at least one destination first' });
      return;
    }
    const hasActivities = itinerary.some((d) => (d.activities || []).length > 0);
    if (hasActivities) {
      Alert.alert(
        'Replace itinerary?',
        'This will replace your existing itinerary. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => void runAIGenerate() },
        ]
      );
      return;
    }
    void runAIGenerate();
  }, [destinations, itinerary, runAIGenerate]);

  const destSummary =
    destinations.filter((d) => d.city).map((d) => d.city).join(' → ') || 'Add destinations first';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: themeColors.text }]}>Day-by-Day Itinerary</Text>
        <Text style={[styles.subheading, { color: themeColors.textTertiary }]}>
          {days} days / {nights} nights — {destSummary}
        </Text>
        <View style={styles.headerBtns}>
          <View style={{ flex: 1 }}>
            <Button
              title={aiGenerating ? 'Generating…' : 'AI Generate'}
              onPress={handleAIGenerate}
              variant="primary"
              size="sm"
              loading={aiGenerating}
              disabled={aiGenerating}
              icon={aiGenerating ? undefined : <Ionicons name="sparkles" size={15} color="#fff" />}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Add Day"
              onPress={handleAddDay}
              variant="outline"
              size="sm"
              disabled={aiGenerating}
              icon={<Ionicons name="add" size={15} color={colors.primary[500]} />}
              fullWidth
            />
          </View>
        </View>
      </View>

      {/* AI overlay */}
      {aiGenerating ? (
        <View style={[styles.aiOverlay, { borderColor: colors.primary[500], backgroundColor: themeColors.backgroundSecondary }]}>
          <View style={styles.aiOverlayRow}>
            <Ionicons name="sparkles" size={16} color={colors.primary[500]} />
            <Text style={[styles.aiOverlayTitle, { color: colors.primary[500] }]}>
              AI is crafting your itinerary…
            </Text>
          </View>
          <Text style={[styles.aiOverlayText, { color: themeColors.textTertiary }]}>
            Analyzing destinations, activities and local experiences. This may take 15–30 seconds.
          </Text>
        </View>
      ) : null}

      {/* Day cards */}
      <View style={{ gap: spacing.md }}>
        {itinerary.map((day, idx) => (
          <DayCard
            key={`day-${idx}`}
            day={day}
            dayIndex={idx}
            totalDays={itinerary.length}
            destinations={destinations}
            themeColors={themeColors}
            onChangeDay={handleChangeDay}
            onRemove={handleRemoveDay}
            onMove={handleMoveDay}
          />
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: { gap: spacing.lg },

  header: { gap: spacing.xs },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  subheading: { fontSize: fontSize.xs },
  headerBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  aiOverlay: { borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.lg, gap: spacing.xs },
  aiOverlayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center' },
  aiOverlayTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  aiOverlayText: { fontSize: fontSize.xs, textAlign: 'center' },

  // Day card
  dayCard: { padding: 0, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  dayBadge: { width: 34, height: 34, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  dayTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2, flexWrap: 'wrap' },
  dayMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: 160 },
  dayMetaText: { fontSize: 11 },
  dayHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { padding: 2 },

  dayBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.xs },
  sectionSpacer: { height: spacing.sm },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: fontWeight.medium },
  chipLeading: { fontSize: 12 },

  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 11, fontWeight: fontWeight.medium },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flex: 1 },

  // Hours stepper
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hoursBtn: {
    width: 34,
    height: 34,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursInput: {
    width: 52,
    height: 34,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    fontSize: fontSize.sm,
    paddingVertical: 0,
  },
  hoursUnit: { fontSize: fontSize.xs },

  // Activity
  activityCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.sm, gap: spacing.sm },
  activityHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  moveCol: { alignItems: 'center', paddingTop: 4 },
  activityTitleInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 40,
  },
  activityRemove: { padding: 4 },
  activityDescInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 40,
  },
  activityFooter: { flexDirection: 'row', alignItems: 'center' },
  activityToggles: { gap: spacing.xs },

  // Meals
  mealCard: { borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.sm, gap: spacing.sm },
  venueInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 40,
  },

  transportToggle: { borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.sm },

  emptyHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },

  removeDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  removeDayText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
