// Time slots — RN port of the web partner-portal's TimeSlotBuilder.jsx +
// HourlySlotManager.jsx (apps/vendor/business/…, ground truth for business
// logic). Three tabs:
//   • Recurring       — weekly slots keyed by a single dayOfWeek (0=Sun…6=Sat)
//   • Specific Dates  — one-off slots keyed by date (yyyy-mm-dd)
//   • Hourly          — the HourlySlotManager generator (turf/court venues)
// Server model: a slot has EITHER dayOfWeek (recurring, date === null) OR date.
// Legacy rows created by the old RN screen may carry a daysOfWeek[] array —
// those are rendered defensively under a "Multiple days (legacy)" group.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Card, TextInput, Badge, EmptyState, useTheme } from '@prayana/shared-ui';
import { Button, LoadingSpinner } from '../../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import { timeSlotAPI } from '@prayana/shared-services';

// ============================================================
// Types & constants
// ============================================================

type TimeSlot = {
  _id: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  label?: string;
  capacity: number;
  available?: number;
  booked?: number;
  priceModifier?: number;
  dayOfWeek?: number | null; // 0=Sun … 6=Sat (recurring)
  date?: string | null; // yyyy-mm-dd (specific)
  isBlocked?: boolean;
  blockedReason?: string;
  /** Legacy shape from the old RN screen — an array of weekdays per slot. */
  daysOfWeek?: number[];
};

type ThemeColorsT = ReturnType<typeof useTheme>['themeColors'];
type TabKey = 'recurring' | 'specific' | 'hourly';
type SlotMode = 'recurring' | 'specific';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recurring', label: 'Recurring' },
  { key: 'specific', label: 'Specific Dates' },
  { key: 'hourly', label: 'Hourly' },
];

// 24h HH:MM (e.g. "09:00", "22:30").
const isValidHHMM = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtDateLong = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Turn "06:00" + slotMinutes into a list of {startTime, endTime} covering
// [open, close). Ported VERBATIM from HourlySlotManager.jsx — the last partial
// slot is dropped (loop condition t + slotMinutes <= end).
function buildSlots(open: string, close: string, slotMinutes: number) {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toStr = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const start = toMin(open);
  const end = toMin(close);
  if (!(end > start) || slotMinutes <= 0) return [] as { startTime: string; endTime: string }[];
  const out: { startTime: string; endTime: string }[] = [];
  for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
    out.push({ startTime: toStr(t), endTime: toStr(t + slotMinutes) });
  }
  return out;
}

// ============================================================
// Screen
// ============================================================

export default function TimeSlotsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('recurring');
  const [editor, setEditor] = useState<{ mode: SlotMode; slot: TimeSlot | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkCreating, setBulkCreating] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!id) return;
    try {
      const res = await timeSlotAPI.getActivityTimeSlots(id);
      setSlots(res?.data || res?.timeSlots || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not load time slots', text2: err?.message });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // ── Grouping (web: groupSlotsByDay) ──────────────────────
  const { grouped, legacy, specificByDate } = useMemo(() => {
    const grouped: Record<number, TimeSlot[]> = {};
    const legacy: TimeSlot[] = [];
    const specificByDate: Record<string, TimeSlot[]> = {};
    for (const s of slots) {
      if (s.date != null) {
        const key = String(s.date).slice(0, 10);
        (specificByDate[key] = specificByDate[key] || []).push(s);
      } else if (typeof s.dayOfWeek === 'number') {
        (grouped[s.dayOfWeek] = grouped[s.dayOfWeek] || []).push(s);
      } else {
        // Legacy daysOfWeek[] rows (or rows missing a day entirely).
        legacy.push(s);
      }
    }
    Object.values(grouped).forEach((list) =>
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
    Object.values(specificByDate).forEach((list) =>
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
    return { grouped, legacy, specificByDate };
  }, [slots]);

  const recurringSlots = useMemo(() => slots.filter((s) => s.date == null), [slots]);
  const hasRecurring = Object.keys(grouped).length > 0 || legacy.length > 0;
  const dateKeys = Object.keys(specificByDate).sort();

  // ── Handlers ─────────────────────────────────────────────
  const openAdd = (mode: SlotMode) => {
    setEditor({ mode, slot: null });
    Haptics.selectionAsync();
  };

  const openEdit = (slot: TimeSlot) => {
    setEditor({ mode: slot.date != null ? 'specific' : 'recurring', slot });
    Haptics.selectionAsync();
  };

  const toggleBlock = async (slot: TimeSlot) => {
    const next = !slot.isBlocked;
    setBusyId(slot._id);
    try {
      const res = await timeSlotAPI.blockTimeSlot(slot._id, {
        isBlocked: next,
        reason: next ? 'Blocked by business' : '',
      });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: next ? 'Slot blocked' : 'Slot unblocked' });
        await fetchSlots();
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (slot: TimeSlot) => {
    setBusyId(slot._id);
    try {
      const res = await timeSlotAPI.deleteTimeSlot(slot._id);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Slot deleted' });
        await fetchSlots();
      } else {
        Toast.show({ type: 'error', text1: 'Could not delete', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (slot: TimeSlot) => {
    Alert.alert('Delete time slot', 'Are you sure you want to delete this time slot?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => doDelete(slot) },
    ]);
  };

  // Quick Setup — web handleBulkCreate: 3 batches, Mon–Fri, capacity 10.
  const doQuickSetup = async () => {
    if (!id) return;
    setBulkCreating(true);
    try {
      const res = await timeSlotAPI.bulkCreateTimeSlots(id, {
        daysOfWeek: [1, 2, 3, 4, 5],
        slots: [
          { startTime: '09:00', endTime: '12:00', label: 'Morning Batch', capacity: 10, priceModifier: 1.0 },
          { startTime: '14:00', endTime: '17:00', label: 'Afternoon Batch', capacity: 10, priceModifier: 1.0 },
          { startTime: '18:00', endTime: '20:00', label: 'Evening Batch', capacity: 10, priceModifier: 1.0 },
        ],
      });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: `Created ${res?.data?.length ?? 15} time slots`,
        });
        await fetchSlots();
      } else {
        Toast.show({ type: 'error', text1: 'Quick setup failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Quick setup failed', text2: err?.message });
    } finally {
      setBulkCreating(false);
    }
  };

  const confirmQuickSetup = () => {
    Alert.alert(
      'Quick Setup',
      'Create Morning (09:00–12:00), Afternoon (14:00–17:00) and Evening (18:00–20:00) batches for Monday–Friday?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create 15 slots', onPress: doQuickSetup },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────
  const renderSlotCard = (s: TimeSlot, showDate = false) => (
    <SlotCard
      key={s._id}
      slot={s}
      showDate={showDate}
      themeColors={themeColors}
      busy={busyId === s._id}
      onEdit={() => openEdit(s)}
      onBlock={() => toggleBlock(s)}
      onDelete={() => confirmDelete(s)}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Top bar */}
      <View
        style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Time slots</Text>
        {tab !== 'hourly' ? (
          <TouchableOpacity onPress={() => openAdd(tab === 'specific' ? 'specific' : 'recurring')} hitSlop={12}>
            <Ionicons name="add" size={26} color={colors.primary[500]} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      {/* Tabs */}
      <View
        style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => {
                setTab(t.key);
                Haptics.selectionAsync();
              }}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary[500] : themeColors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <LoadingSpinner />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Recurring tab ── */}
          {tab === 'recurring' &&
            (hasRecurring ? (
              <>
                <Text style={[styles.tabHint, { color: themeColors.textTertiary }]}>
                  Batches that repeat every week on the chosen weekday.
                </Text>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const daySlots = grouped[day];
                  if (!daySlots?.length) return null;
                  return (
                    <View key={day} style={styles.daySection}>
                      <Text style={[styles.daySectionTitle, { color: themeColors.text }]}>
                        {DAY_NAMES[day]}
                      </Text>
                      {daySlots.map((s) => renderSlotCard(s))}
                    </View>
                  );
                })}
                {legacy.length > 0 && (
                  <View style={styles.daySection}>
                    <Text style={[styles.daySectionTitle, { color: themeColors.text }]}>
                      Multiple days (legacy)
                    </Text>
                    {legacy.map((s) => renderSlotCard(s))}
                  </View>
                )}
              </>
            ) : (
              <>
                <EmptyState
                  icon={<Ionicons name="calendar-outline" size={56} color={themeColors.textTertiary} />}
                  title="No recurring time slots"
                  description="Add time slots that repeat every week on specific days."
                  actionLabel="Add Your First Slot"
                  onAction={() => openAdd('recurring')}
                />
                <Button
                  title="Quick Setup (3 slots/day, Mon–Fri)"
                  onPress={confirmQuickSetup}
                  variant="outline"
                  loading={bulkCreating}
                  disabled={bulkCreating}
                  icon={<Ionicons name="flash-outline" size={16} color={colors.primary[500]} />}
                  fullWidth
                />
              </>
            ))}

          {/* ── Specific dates tab ── */}
          {tab === 'specific' &&
            (dateKeys.length > 0 ? (
              <>
                <Text style={[styles.tabHint, { color: themeColors.textTertiary }]}>
                  One-off slots for specific dates (holidays, special events).
                </Text>
                {dateKeys.map((dateKey) => (
                  <View key={dateKey} style={styles.daySection}>
                    <Text style={[styles.daySectionTitle, { color: themeColors.text }]}>
                      {fmtDateLong(dateKey)}
                    </Text>
                    {specificByDate[dateKey].map((s) => renderSlotCard(s, true))}
                  </View>
                ))}
              </>
            ) : (
              <EmptyState
                icon={<Ionicons name="calendar-outline" size={56} color={themeColors.textTertiary} />}
                title="No date-specific slots"
                description="Add slots for specific dates (holidays, special events)."
                actionLabel="Add Date-Specific Slot"
                onAction={() => openAdd('specific')}
              />
            ))}

          {/* ── Hourly generator tab ── */}
          {tab === 'hourly' && id ? (
            <HourlyGenerator
              activityId={id}
              recurringSlots={recurringSlots}
              themeColors={themeColors}
              onChanged={fetchSlots}
            />
          ) : null}
        </ScrollView>
      )}

      {/* Add / edit modal */}
      {editor && id ? (
        <AddEditSlotModal
          activityId={id}
          mode={editor.mode}
          slot={editor.slot}
          themeColors={themeColors}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await fetchSlots();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ============================================================
// Slot card — port of web SlotCard (TimeSlotBuilder.jsx)
// ============================================================

function SlotCard({
  slot,
  showDate,
  themeColors,
  busy,
  onEdit,
  onBlock,
  onDelete,
}: {
  slot: TimeSlot;
  showDate?: boolean;
  themeColors: ThemeColorsT;
  busy: boolean;
  onEdit: () => void;
  onBlock: () => void;
  onDelete: () => void;
}) {
  const hasAvailability =
    typeof slot.available === 'number' && typeof slot.capacity === 'number' && slot.capacity > 0;
  const availabilityPercent = hasAvailability
    ? Math.max(0, Math.min(100, ((slot.available as number) / slot.capacity) * 100))
    : 0;
  const barColor =
    availabilityPercent > 50 ? colors.success : availabilityPercent > 25 ? colors.warning : colors.error;
  const modifier = slot.priceModifier;

  return (
    <Card
      style={[
        styles.slotCard,
        slot.isBlocked ? { backgroundColor: themeColors.backgroundSecondary } : null,
      ]}
    >
      <View style={styles.slotHead}>
        <View style={{ flex: 1 }}>
          <View style={styles.slotTimeRow}>
            <Ionicons name="time-outline" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.slotTime, { color: themeColors.text }]}>
              {slot.startTime} – {slot.endTime}
            </Text>
          </View>
          {slot.label ? (
            <Text style={[styles.slotLabel, { color: themeColors.textSecondary }]}>{slot.label}</Text>
          ) : null}
          {showDate && slot.date ? (
            <Text style={styles.slotDate}>{new Date(slot.date).toLocaleDateString()}</Text>
          ) : null}
          {/* Legacy multi-day rows (old RN screen data). */}
          {Array.isArray(slot.daysOfWeek) && slot.daysOfWeek.length > 0 ? (
            <Text style={[styles.slotLegacyDays, { color: themeColors.textTertiary }]}>
              {[...slot.daysOfWeek].sort().map((d) => DAY_ABBR[d] ?? '?').join(' · ')}
            </Text>
          ) : null}
        </View>
        {slot.isBlocked ? (
          <View style={styles.blockedWrap}>
            <Ionicons name="lock-closed" size={14} color={themeColors.textTertiary} />
            <Badge label="Blocked" variant="error" size="sm" />
          </View>
        ) : null}
      </View>

      {/* Capacity availability bar (when the server reports availability). */}
      {hasAvailability ? (
        <View>
          <View style={styles.capacityHead}>
            <View style={styles.capacityLabelWrap}>
              <Ionicons name="people-outline" size={13} color={themeColors.textSecondary} />
              <Text style={[styles.capacityLabel, { color: themeColors.textSecondary }]}>Capacity</Text>
            </View>
            <Text style={[styles.capacityValue, { color: themeColors.text }]}>
              {slot.available}/{slot.capacity}
            </Text>
          </View>
          <View style={[styles.capacityTrack, { backgroundColor: themeColors.border }]}>
            <View
              style={[styles.capacityFill, { width: `${availabilityPercent}%`, backgroundColor: barColor }]}
            />
          </View>
        </View>
      ) : (
        <View style={styles.capacityLabelWrap}>
          <Ionicons name="people-outline" size={13} color={themeColors.textTertiary} />
          <Text style={[styles.capacityMeta, { color: themeColors.textTertiary }]}>
            Capacity {slot.capacity}
          </Text>
        </View>
      )}

      {/* Price modifier (web: shown when !== 1.0). */}
      {modifier != null && modifier !== 1 ? (
        <Text style={styles.slotPrice}>
          Price: {modifier > 1 ? '+' : ''}
          {((modifier - 1) * 100).toFixed(0)}%
        </Text>
      ) : null}

      <View style={styles.slotActions}>
        <Button title="Edit" onPress={onEdit} variant="outline" size="sm" disabled={busy} />
        <Button
          title={slot.isBlocked ? 'Unblock' : 'Block'}
          onPress={onBlock}
          variant="outline"
          size="sm"
          disabled={busy}
        />
        <Button
          title="Delete"
          onPress={onDelete}
          variant="ghost"
          size="sm"
          disabled={busy}
          textStyle={{ color: colors.error }}
        />
      </View>
    </Card>
  );
}

// ============================================================
// Weekday chips (single- or multi-select depending on caller)
// ============================================================

function DayChipsRow({
  selected,
  onPressDay,
  themeColors,
}: {
  selected: number[];
  onPressDay: (d: number) => void;
  themeColors: ThemeColorsT;
}) {
  return (
    <View style={styles.dayRow}>
      {DAY_ABBR.map((d, i) => {
        const active = selected.includes(i);
        return (
          <TouchableOpacity
            key={d}
            onPress={() => {
              onPressDay(i);
              Haptics.selectionAsync();
            }}
            style={[
              styles.dayChip,
              { borderColor: themeColors.border, backgroundColor: themeColors.surface },
              active && styles.dayChipActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.dayText, { color: themeColors.textSecondary }, active && styles.dayTextActive]}
            >
              {d}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ============================================================
// Number stepper field — RN take on the web NumberStepper
// ============================================================

function StepperField({
  label,
  value,
  onChangeText,
  min,
  max,
  step = 1,
  decimals = 0,
  hint,
  themeColors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  hint?: string;
  themeColors: ThemeColorsT;
}) {
  const bump = (dir: 1 | -1) => {
    const parsed = parseFloat(value);
    const base = Number.isFinite(parsed) ? parsed : min ?? 0;
    let next = base + dir * step;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    next = Math.round(next * 1000) / 1000;
    onChangeText(decimals > 0 ? next.toFixed(decimals) : String(Math.round(next)));
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.stepperFieldWrap}>
      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          onPress={() => bump(-1)}
          style={[styles.stepperBtn, { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
          hitSlop={6}
        >
          <Ionicons name="remove" size={20} color={colors.primary[500]} />
        </TouchableOpacity>
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
          style={[
            styles.stepperInput,
            {
              backgroundColor: themeColors.field,
              borderColor: themeColors.fieldBorder,
              color: themeColors.text,
            },
          ]}
        />
        <TouchableOpacity
          onPress={() => bump(1)}
          style={[styles.stepperBtn, { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
          hitSlop={6}
        >
          <Ionicons name="add" size={20} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>
      {hint ? <Text style={[styles.fieldHint, { color: themeColors.textTertiary }]}>{hint}</Text> : null}
    </View>
  );
}

// ============================================================
// Add / edit slot modal — port of web AddSlotModal, plus the
// existing RN screen's Edit capability (updateTimeSlot).
// ============================================================

function AddEditSlotModal({
  activityId,
  mode,
  slot,
  themeColors,
  onClose,
  onSaved,
}: {
  activityId: string;
  mode: SlotMode;
  slot: TimeSlot | null;
  themeColors: ThemeColorsT;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!slot?._id;

  // Web defaults: 09:00–12:00, label "", capacity 10, priceModifier 1.0.
  const [start, setStart] = useState(slot?.startTime ?? '09:00');
  const [end, setEnd] = useState(slot?.endTime ?? '12:00');
  const [label, setLabel] = useState(slot?.label ?? '');
  const [capacity, setCapacity] = useState(String(slot?.capacity ?? 10));
  const [priceModifier, setPriceModifier] = useState(
    slot?.priceModifier != null ? String(slot.priceModifier) : '1.0'
  );
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(
    typeof slot?.dayOfWeek === 'number' ? slot.dayOfWeek : null
  );
  const [date, setDate] = useState(slot?.date ? String(slot.date).slice(0, 10) : '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDatePicked = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && picked) {
      setDate(toISODate(picked));
      if (Platform.OS === 'ios') setShowDatePicker(false);
    }
  };

  const handleSave = async () => {
    if (!isValidHHMM(start) || !isValidHHMM(end)) {
      Toast.show({ type: 'error', text1: 'Use 24h HH:MM format', text2: 'e.g. 09:00 or 14:30' });
      return;
    }
    if (end <= start) {
      Toast.show({ type: 'error', text1: 'End time must be after start time' });
      return;
    }
    const cap = parseInt(capacity, 10);
    if (!Number.isFinite(cap) || cap < 1) {
      Toast.show({ type: 'error', text1: 'Capacity must be at least 1' });
      return;
    }
    const mod = parseFloat(priceModifier);
    if (!Number.isFinite(mod) || mod < 0.1 || mod > 10) {
      Toast.show({ type: 'error', text1: 'Price modifier must be between 0.1 and 10' });
      return;
    }
    if (mode === 'recurring' && dayOfWeek == null) {
      Toast.show({ type: 'error', text1: 'Pick a day of the week' });
      return;
    }
    if (mode === 'specific' && !date) {
      Toast.show({ type: 'error', text1: 'Pick a date' });
      return;
    }

    // Web payload shape: {startTime, endTime, label, capacity, priceModifier}
    // + {dayOfWeek} (recurring) or {date} (specific).
    const payload: Record<string, unknown> = {
      startTime: start,
      endTime: end,
      label: label.trim(),
      capacity: cap,
      priceModifier: mod,
    };
    if (mode === 'recurring') payload.dayOfWeek = dayOfWeek;
    else payload.date = date;

    setSaving(true);
    try {
      const res = isEdit
        ? await timeSlotAPI.updateTimeSlot(slot!._id, payload)
        : await timeSlotAPI.createTimeSlot(activityId, payload);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: isEdit ? 'Slot updated' : 'Slot created' });
        onSaved();
      } else {
        Toast.show({ type: 'error', text1: 'Save failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>
            {isEdit ? 'Edit time slot' : mode === 'recurring' ? 'New recurring slot' : 'New date-specific slot'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {/* Day / date selection */}
            {mode === 'recurring' ? (
              <View>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Day of week *</Text>
                <DayChipsRow
                  selected={dayOfWeek != null ? [dayOfWeek] : []}
                  onPressDay={(d) => setDayOfWeek(d)}
                  themeColors={themeColors}
                />
              </View>
            ) : (
              <View>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Date *</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker((v) => !v)}
                  style={[
                    styles.dateField,
                    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dateFieldText,
                      { color: date ? themeColors.text : themeColors.textTertiary },
                    ]}
                  >
                    {date ? fmtDateLong(date) : 'Select specific date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={themeColors.textSecondary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date ? new Date(`${date}T00:00:00`) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={handleDatePicked}
                  />
                )}
              </View>
            )}

            {/* Time range */}
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Start time *"
                  value={start}
                  onChangeText={setStart}
                  placeholder="09:00"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={start && !isValidHHMM(start) ? 'Use HH:MM (24h)' : undefined}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="End time *"
                  value={end}
                  onChangeText={setEnd}
                  placeholder="12:00"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={end && !isValidHHMM(end) ? 'Use HH:MM (24h)' : undefined}
                />
              </View>
            </View>

            {/* Label */}
            <TextInput
              label="Label (optional)"
              value={label}
              onChangeText={setLabel}
              placeholder="e.g., Morning Batch, Sunset Tour"
            />

            {/* Capacity */}
            <StepperField
              label="Capacity"
              value={capacity}
              onChangeText={setCapacity}
              min={1}
              step={1}
              themeColors={themeColors}
            />

            {/* Price modifier */}
            <StepperField
              label="Price Modifier (1.0 = base price)"
              value={priceModifier}
              onChangeText={setPriceModifier}
              min={0.1}
              max={10}
              step={0.1}
              decimals={1}
              hint="1.2 = 20% more, 0.9 = 10% less"
              themeColors={themeColors}
            />
          </ScrollView>

          <View
            style={[
              styles.modalFooter,
              { backgroundColor: themeColors.background, borderTopColor: themeColors.border },
            ]}
          >
            <Button
              title={isEdit ? 'Update slot' : 'Add Slot'}
              onPress={handleSave}
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              disabled={saving}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================
// Hourly generator — port of HourlySlotManager.jsx
// ============================================================

function HourlyGenerator({
  activityId,
  recurringSlots,
  themeColors,
  onChanged,
}: {
  activityId: string;
  recurringSlots: TimeSlot[];
  themeColors: ThemeColorsT;
  onChanged: () => Promise<void>;
}) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri default
  const [open, setOpen] = useState('06:00');
  const [close, setClose] = useState('22:00');
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [capacity, setCapacity] = useState('1'); // one booking party per turf slot
  const [peakEnabled, setPeakEnabled] = useState(false);
  const [peakFrom, setPeakFrom] = useState('18:00');
  const [peakMultiplier, setPeakMultiplier] = useState('1.5');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const preview = useMemo(() => buildSlots(open, close, Number(slotMinutes)), [open, close, slotMinutes]);

  const toggleDay = (i: number) =>
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  // Lexicographic HH:MM compare — same as web.
  const isPeak = (startTime: string) => peakEnabled && startTime >= peakFrom;

  const handleGenerate = async () => {
    if (days.length === 0) {
      Toast.show({ type: 'error', text1: 'Pick at least one day' });
      return;
    }
    if (preview.length === 0) {
      Toast.show({ type: 'error', text1: 'No slots — check open/close times and slot length' });
      return;
    }
    if (!(Number(capacity) >= 1)) {
      Toast.show({ type: 'error', text1: 'Capacity must be at least 1' });
      return;
    }

    const slots = preview.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: Number(capacity),
      priceModifier: isPeak(s.startTime) ? Number(peakMultiplier) : 1.0,
      label: '',
    }));

    setSaving(true);
    try {
      const res = await timeSlotAPI.bulkCreateTimeSlots(activityId, { daysOfWeek: days, slots });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: `Created ${res.data?.length ?? days.length * slots.length} slots`,
        });
        await onChanged();
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to create slots' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to create slots', text2: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slot: TimeSlot) => {
    if ((slot.booked || 0) > 0) {
      Toast.show({ type: 'error', text1: "Can't delete a slot that has bookings" });
      return;
    }
    setDeletingId(slot._id);
    try {
      const res = await timeSlotAPI.deleteTimeSlot(slot._id);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onChanged();
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Failed to delete slot' });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to delete slot', text2: err?.message });
    } finally {
      setDeletingId(null);
    }
  };

  // Group existing recurring slots by weekday for a readable summary.
  const byDay = useMemo(() => {
    const m: Record<number, TimeSlot[]> = {};
    for (const s of recurringSlots) {
      const d = typeof s.dayOfWeek === 'number' ? s.dayOfWeek : -1;
      (m[d] = m[d] || []).push(s);
    }
    Object.values(m).forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return m;
  }, [recurringSlots]);

  const total = preview.length * days.length;

  return (
    <Card style={styles.hourlyCard}>
      {/* Header */}
      <View style={styles.hourlyHead}>
        <Ionicons name="time-outline" size={20} color={colors.primary[500]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.hourlyTitle, { color: themeColors.text }]}>Hourly booking slots</Text>
          <Text style={[styles.hourlySubtitle, { color: themeColors.textSecondary }]}>
            For turf / court / studio-style venues that rent repeating hourly slots. Each slot is
            independently bookable per date.
          </Text>
        </View>
      </View>

      {/* Repeat on */}
      <View>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Repeat on</Text>
        <DayChipsRow selected={days} onPressDay={toggleDay} themeColors={themeColors} />
      </View>

      {/* Open / close */}
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <TextInput
            label="Opens"
            value={open}
            onChangeText={setOpen}
            placeholder="06:00"
            autoCapitalize="none"
            autoCorrect={false}
            error={open && !isValidHHMM(open) ? 'Use HH:MM (24h)' : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            label="Closes"
            value={close}
            onChangeText={setClose}
            placeholder="22:00"
            autoCapitalize="none"
            autoCorrect={false}
            error={close && !isValidHHMM(close) ? 'Use HH:MM (24h)' : undefined}
          />
        </View>
      </View>

      {/* Slot length */}
      <View>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Slot length</Text>
        <View style={styles.segmentRow}>
          {[30, 60, 90, 120].map((m) => {
            const active = slotMinutes === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  setSlotMinutes(m);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.segmentBtn,
                  { borderColor: themeColors.border },
                  active && styles.segmentBtnActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.segmentText, { color: active ? '#fff' : themeColors.textSecondary }]}
                >
                  {m} min
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Capacity */}
      <StepperField
        label="Capacity / slot"
        value={capacity}
        onChangeText={setCapacity}
        min={1}
        step={1}
        themeColors={themeColors}
      />

      {/* Peak pricing */}
      <View style={[styles.peakCard, { backgroundColor: themeColors.backgroundSecondary }]}>
        <View style={styles.peakToggleRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.text, marginBottom: 0, flex: 1 }]}>
            Charge more for peak slots
          </Text>
          <Switch
            value={peakEnabled}
            onValueChange={(v) => {
              setPeakEnabled(v);
              Haptics.selectionAsync();
            }}
            trackColor={{ true: colors.primary[400] }}
          />
        </View>
        {peakEnabled && (
          <View style={[styles.row2, { marginTop: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <TextInput
                label="Peak starts at"
                value={peakFrom}
                onChangeText={setPeakFrom}
                placeholder="18:00"
                autoCapitalize="none"
                autoCorrect={false}
                error={peakFrom && !isValidHHMM(peakFrom) ? 'Use HH:MM (24h)' : undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <StepperField
                label="Price multiplier"
                value={peakMultiplier}
                onChangeText={setPeakMultiplier}
                min={1}
                max={10}
                step={0.1}
                decimals={1}
                themeColors={themeColors}
              />
            </View>
          </View>
        )}
      </View>

      {/* Live preview + generate */}
      <View style={styles.previewRow}>
        {preview.length > 0 ? (
          <View style={styles.previewTextWrap}>
            <Ionicons name="sparkles-outline" size={15} color={colors.primary[500]} />
            <Text style={[styles.previewText, { color: themeColors.textSecondary }]}>
              {preview.length} slots/day × {days.length} day(s) ={' '}
              <Text style={[styles.previewTotal, { color: themeColors.text }]}>{total} total</Text>
            </Text>
          </View>
        ) : (
          <View style={styles.previewTextWrap}>
            <Ionicons name="warning-outline" size={15} color={colors.warning} />
            <Text style={[styles.previewText, { color: colors.warning }]}>No slots for these times</Text>
          </View>
        )}
      </View>
      <Button
        title="Generate slots"
        onPress={handleGenerate}
        variant="primary"
        loading={saving}
        disabled={saving || preview.length === 0 || days.length === 0}
        icon={<Ionicons name="add" size={16} color="#fff" />}
        fullWidth
      />

      {/* Existing recurring slots */}
      <View style={[styles.hourlyExisting, { borderTopColor: themeColors.border }]}>
        <Text style={[styles.hourlyExistingTitle, { color: themeColors.text }]}>Current slots</Text>
        {recurringSlots.length === 0 ? (
          <Text style={[styles.hourlyEmptyText, { color: themeColors.textTertiary }]}>
            No hourly slots yet. Generate some above.
          </Text>
        ) : (
          DAY_ABBR.map((_, i) => {
            const list = byDay[i];
            if (!list?.length) return null;
            return (
              <View key={i} style={styles.hourlyDayGroup}>
                <Text style={[styles.hourlyDayLabel, { color: themeColors.textTertiary }]}>
                  {DAY_NAMES[i].toUpperCase()}
                </Text>
                <View style={styles.hourlyChipWrap}>
                  {list.map((s) => {
                    const locked = (s.booked || 0) > 0;
                    return (
                      <View
                        key={s._id}
                        style={[styles.hourlyChip, { backgroundColor: themeColors.inputBackground }]}
                      >
                        <Text style={[styles.hourlyChipText, { color: themeColors.text }]}>
                          {s.startTime}–{s.endTime}
                        </Text>
                        {s.priceModifier != null && s.priceModifier !== 1 ? (
                          <Text style={styles.hourlyChipPeak}>
                            {s.priceModifier > 1 ? '+' : ''}
                            {Math.round((s.priceModifier - 1) * 100)}%
                          </Text>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => handleDelete(s)}
                          hitSlop={6}
                          style={[styles.hourlyChipDelete, locked && { opacity: 0.3 }]}
                          accessibilityLabel={
                            locked ? "Has bookings — can't delete" : 'Delete slot'
                          }
                        >
                          {deletingId === s._id ? (
                            <ActivityIndicator size="small" color={colors.error} />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color={locked ? themeColors.textTertiary : colors.error}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </View>
    </Card>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.primary[500] },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  tabHint: { fontSize: fontSize.xs, marginBottom: spacing.md },

  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },

  daySection: { marginBottom: spacing.lg },
  daySectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },

  // Slot card
  slotCard: { gap: spacing.sm, marginBottom: spacing.sm },
  slotHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  slotTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotTime: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  slotLabel: { fontSize: fontSize.sm, marginTop: 2 },
  slotDate: { fontSize: fontSize.sm, color: colors.primary[500], marginTop: 2 },
  slotLegacyDays: { fontSize: fontSize.xs, marginTop: 4 },
  blockedWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  capacityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  capacityLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  capacityLabel: { fontSize: fontSize.xs },
  capacityValue: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  capacityMeta: { fontSize: fontSize.xs },
  capacityTrack: { height: 6, borderRadius: borderRadius.full, overflow: 'hidden' },
  capacityFill: { height: 6, borderRadius: borderRadius.full },

  slotPrice: { fontSize: fontSize.sm, color: colors.primary[500], fontWeight: fontWeight.medium },
  slotActions: { flexDirection: 'row', gap: spacing.sm },

  // Weekday chips
  dayRow: { flexDirection: 'row', gap: spacing.xs },
  dayChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  dayText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  dayTextActive: { color: '#fff' },

  // Field bits
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  fieldHint: { fontSize: fontSize.xs, marginTop: spacing.xs },
  row2: { flexDirection: 'row', gap: spacing.md },

  // Stepper field
  stepperFieldWrap: { marginBottom: spacing.lg },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    minHeight: 44,
    textAlign: 'center',
  },

  // Date field (tappable, backed by the native picker)
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    marginBottom: spacing.md,
  },
  dateFieldText: { fontSize: fontSize.md },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  modalScroll: { padding: spacing.lg, gap: spacing.md },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1 },

  // Hourly generator
  hourlyCard: { gap: spacing.lg },
  hourlyHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  hourlyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hourlySubtitle: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },

  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segmentBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  segmentText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  peakCard: { borderRadius: borderRadius.lg, padding: spacing.md },
  peakToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewTextWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  previewText: { fontSize: fontSize.sm, flexShrink: 1 },
  previewTotal: { fontWeight: fontWeight.bold },

  hourlyExisting: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.md },
  hourlyExistingTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  hourlyEmptyText: { fontSize: fontSize.sm },
  hourlyDayGroup: { gap: spacing.xs },
  hourlyDayLabel: { fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  hourlyChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hourlyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  hourlyChipText: { fontSize: fontSize.sm },
  hourlyChipPeak: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: '#d97706' },
  hourlyChipDelete: { padding: spacing.xs },
});
