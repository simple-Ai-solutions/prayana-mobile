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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { Card, TextInput, Badge, useTheme } from '@prayana/shared-ui';
import { Button, LoadingSpinner } from '../../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import { activityMarketplaceAPI } from '@prayana/shared-services';

// ============================================================
// Types — mirror the web partner portal's AvailabilityCalendar
// (apps/vendor/business/activities/AvailabilityCalendar.jsx)
// ============================================================
type RecurringRule = {
  name: string;
  daysOfWeek: number[]; // 0=Sun … 6=Sat
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null;
  isBlocked: true; // recurring rules always block
  reason: string;
};

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DOW_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Strict-ish ISO date check (yyyy-mm-dd). Kept simple — full validation is server-side.
const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

// Red tints for blocked cells (matches web's red-50 / red-300 / red-700).
const RED_BORDER = '#fca5a5';
const RED_TEXT = '#b91c1c';

export default function AvailabilityScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false); // month (re)fetch
  const [mutating, setMutating] = useState(false); // bulk block/unblock or rule add
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // ── Fetch blocked dates for the visible month ───────────
  const fetchBlockedDates = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0).toISOString();

      const res = await activityMarketplaceAPI.getAvailability(id, startDate, endDate);
      if (res?.success && Array.isArray(res.data)) {
        setBlockedDates(
          new Set(
            res.data
              .filter((slot: any) => slot.isBlocked)
              .map((slot: any) => new Date(slot.date).toDateString())
          )
        );
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to load availability', text2: err?.message });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [id, currentDate]);

  useEffect(() => {
    fetchBlockedDates();
  }, [fetchBlockedDates]);

  // ── Calendar helpers (same logic as web) ────────────────
  const days = useMemo<(Date | null)[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const list: (Date | null)[] = [];
    // Empty cells for days before the month starts (Sun-first grid)
    for (let i = 0; i < firstDay.getDay(); i++) list.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) list.push(new Date(year, month, d));
    return list;
  }, [currentDate]);

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toDateString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const changeMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + direction);
      return next;
    });
    setSelectedDates(new Set()); // Clear selection when changing month
  };

  const toggleDate = (date: Date) => {
    const dateStr = date.toDateString();
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  // ── Bulk block / unblock ────────────────────────────────
  const runBulk = useCallback(
    async (isBlocked: boolean) => {
      if (!id || selectedDates.size === 0) return;
      setMutating(true);
      try {
        const dates = Array.from(selectedDates).map(
          (dateStr) => new Date(dateStr).toISOString().split('T')[0]
        );
        // The API only sends `reason` when truthy, so undefined == omitted (web
        // sends no reason at all for unblock).
        await activityMarketplaceAPI.bulkBlockDates(id, {
          dates,
          isBlocked,
          reason: isBlocked ? 'Blocked by business' : undefined,
        });
        setSelectedDates(new Set());
        await fetchBlockedDates();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Toast.show({ type: 'success', text1: isBlocked ? 'Dates blocked' : 'Dates unblocked' });
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: isBlocked ? 'Failed to block dates' : 'Failed to unblock dates',
          text2: err?.message,
        });
      } finally {
        setMutating(false);
      }
    },
    [id, selectedDates, fetchBlockedDates]
  );

  // ── Recurring rule ──────────────────────────────────────
  const handleAddRecurringRule = useCallback(
    async (rule: RecurringRule) => {
      if (!id) return;
      setMutating(true);
      try {
        await activityMarketplaceAPI.addRecurringAvailabilityRule(id, rule);
        setShowRecurringModal(false);
        await fetchBlockedDates();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Toast.show({ type: 'success', text1: 'Recurring rule added' });
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Failed to add recurring rule', text2: err?.message });
      } finally {
        setMutating(false);
      }
    },
    [id, fetchBlockedDates]
  );

  const selectedCount = selectedDates.size;

  if (initialLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: themeColors.background }]}
        edges={['top']}
      >
        <Header themeColors={themeColors} onBack={() => router.back()} />
        <View style={styles.center}>
          <LoadingSpinner />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <Header themeColors={themeColors} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Hint card ── */}
        <Card bordered elevated={false} style={styles.hintCard}>
          <View style={styles.hintRow}>
            <View style={[styles.hintIconWrap, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary[500]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hintTitle, { color: themeColors.text }]}>
                Manage availability
              </Text>
              <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>
                Tap dates to select, then block or unblock them.
              </Text>
            </View>
            <Badge
              label={`${blockedDates.size} blocked`}
              variant={blockedDates.size > 0 ? 'error' : 'default'}
            />
          </View>
        </Card>

        {/* ── Calendar card ── */}
        <Card bordered elevated={false} style={styles.calendarCard}>
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              style={styles.monthNavBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.monthTitleWrap}>
              <Text style={[styles.monthTitle, { color: themeColors.text }]}>{monthName}</Text>
              {loading && <ActivityIndicator size="small" color={colors.primary[500]} />}
            </View>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              style={styles.monthNavBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Week day headers */}
          <View style={styles.grid}>
            {WEEK_DAYS.map((day) => (
              <View key={day} style={styles.cellWrap}>
                <Text style={[styles.weekDayText, { color: themeColors.textTertiary }]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.cellWrap} />;
              }

              const dateStr = date.toDateString();
              const isBlocked = blockedDates.has(dateStr);
              const isSelected = selectedDates.has(dateStr);
              const isToday = dateStr === todayStr;
              const isPast = date.getTime() < todayStart.getTime();

              // State precedence matches the web: past > selected > blocked > today > default
              let bg: string = themeColors.surface;
              let border: string = themeColors.border;
              let textColor: string = themeColors.text;
              if (isPast) {
                bg = themeColors.background;
                border = 'transparent';
                textColor = themeColors.textTertiary;
              } else if (isSelected) {
                bg = colors.primary[100];
                border = colors.primary[500];
                textColor = colors.primary[800];
              } else if (isBlocked) {
                bg = colors.errorLight;
                border = RED_BORDER;
                textColor = RED_TEXT;
              } else if (isToday) {
                bg = colors.primary[50];
                border = colors.primary[400];
                textColor = colors.primary[800];
              }

              return (
                <View key={dateStr} style={styles.cellWrap}>
                  <TouchableOpacity
                    onPress={() => toggleDate(date)}
                    disabled={isPast}
                    activeOpacity={0.6}
                    style={[styles.cell, { backgroundColor: bg, borderColor: border }]}
                  >
                    <Text style={[styles.cellText, { color: textColor }]}>{date.getDate()}</Text>
                    {isBlocked && !isSelected && (
                      <Ionicons
                        name="lock-closed"
                        size={10}
                        color={colors.error}
                        style={styles.cellIconBottomRight}
                      />
                    )}
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={colors.primary[500]}
                        style={styles.cellIconTopRight}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ── Legend ── */}
        <View style={styles.legendRow}>
          <LegendSwatch
            bg={colors.primary[50]}
            border={colors.primary[400]}
            label="Today"
            themeColors={themeColors}
          />
          <LegendSwatch
            bg={colors.errorLight}
            border={RED_BORDER}
            label="Blocked"
            themeColors={themeColors}
          />
          <LegendSwatch
            bg={colors.primary[100]}
            border={colors.primary[500]}
            label="Selected"
            themeColors={themeColors}
          />
          <LegendSwatch
            bg={themeColors.surface}
            border={themeColors.border}
            label="Available"
            themeColors={themeColors}
          />
        </View>

        {/* ── Recurring closures ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>
            Recurring closures
          </Text>
          <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
            Block the same weekdays every week — e.g. closed every Monday.
          </Text>
          <Button
            title="Add Recurring Rule"
            variant="outline"
            onPress={() => setShowRecurringModal(true)}
            icon={<Ionicons name="repeat-outline" size={18} color={colors.primary[500]} />}
            fullWidth
          />
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── Sticky action bar (visible when dates are selected) ── */}
      {selectedCount > 0 && (
        <View
          style={[
            styles.actionBar,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
          ]}
        >
          <View style={styles.actionBarHead}>
            <Text style={[styles.actionBarLabel, { color: themeColors.textSecondary }]}>
              {selectedCount} {selectedCount === 1 ? 'date' : 'dates'} selected
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedDates(new Set())}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={16} color={themeColors.textTertiary} />
              <Text style={[styles.clearBtnText, { color: themeColors.textSecondary }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionBarButtons}>
            <View style={{ flex: 1 }}>
              <Button
                title={`Block Selected (${selectedCount})`}
                variant="danger"
                onPress={() => runBulk(true)}
                disabled={mutating}
                loading={mutating}
                icon={<Ionicons name="lock-closed" size={16} color="#fff" />}
                fullWidth
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Button
                title={`Unblock Selected (${selectedCount})`}
                onPress={() => runBulk(false)}
                disabled={mutating}
                icon={<Ionicons name="lock-open" size={16} color="#fff" />}
                style={{ backgroundColor: colors.success }}
                fullWidth
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Recurring rule modal ── */}
      {showRecurringModal && (
        <RecurringRuleModal
          themeColors={themeColors}
          saving={mutating}
          onClose={() => setShowRecurringModal(false)}
          onSave={handleAddRecurringRule}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// Header
// ============================================================
function Header({ themeColors, onBack }: { themeColors: any; onBack: () => void }) {
  return (
    <View
      style={[styles.header, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
    >
      <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: themeColors.text }]}>Availability</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

// ============================================================
// Legend swatch
// ============================================================
function LegendSwatch({
  bg,
  border,
  label,
  themeColors,
}: {
  bg: string;
  border: string;
  label: string;
  themeColors: any;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: bg, borderColor: border }]} />
      <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ============================================================
// Recurring rule modal — bottom-sheet editor (pricing.tsx pattern)
// ============================================================
function RecurringRuleModal({
  themeColors,
  saving,
  onClose,
  onSave,
}: {
  themeColors: any;
  saving: boolean;
  onClose: () => void;
  onSave: (rule: RecurringRule) => void;
}) {
  const [name, setName] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const toggleDay = (d: number) =>
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );

  const startOk = !startDate.trim() || isISODate(startDate);
  const endOk = !endDate.trim() || isISODate(endDate);
  const valid = name.trim().length > 0 && daysOfWeek.length > 0 && startOk && endOk;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalSheet, { backgroundColor: themeColors.surface }]}
        >
          <View style={[styles.modalHandle, { backgroundColor: themeColors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              Add Recurring Closure
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <TextInput
              label="Rule name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g., Every Monday Closed"
            />

            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
              Days of week <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={styles.dowRow}>
              {DOW_OPTIONS.map((day) => {
                const active = daysOfWeek.includes(day.value);
                return (
                  <TouchableOpacity
                    key={day.value}
                    onPress={() => toggleDay(day.value)}
                    style={[
                      styles.dowChip,
                      { borderColor: themeColors.border },
                      active && {
                        backgroundColor: colors.primary[500],
                        borderColor: colors.primary[500],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dowText,
                        { color: active ? '#fff' : themeColors.textSecondary },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Start date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-08-01"
                  autoCapitalize="none"
                  error={!startOk ? 'Use YYYY-MM-DD' : undefined}
                  hint="Optional"
                />
              </View>
              <View style={{ width: spacing.md }} />
              <View style={{ flex: 1 }}>
                <TextInput
                  label="End date"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-12-31"
                  autoCapitalize="none"
                  error={!endOk ? 'Use YYYY-MM-DD' : undefined}
                  hint="Leave empty for ongoing"
                />
              </View>
            </View>

            {/* isBlocked is fixed: recurring rules always block bookings */}
            <View style={styles.ruleTypeRow}>
              <Text style={[styles.fieldLabel, { color: themeColors.text, marginBottom: 0 }]}>
                Rule type
              </Text>
              <Badge label="Blocks bookings" variant="error" />
            </View>
            <Text style={[styles.ruleTypeHint, { color: themeColors.textTertiary }]}>
              Recurring rules always block bookings on the chosen days.
            </Text>

            <TextInput
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g., Weekly maintenance day"
            />
          </ScrollView>

          <Button
            title={saving ? 'Adding…' : 'Add Rule'}
            onPress={() =>
              onSave({
                name: name.trim(),
                daysOfWeek,
                startDate: startDate.trim() || null,
                endDate: endDate.trim() || null,
                isBlocked: true,
                reason: reason.trim(),
              })
            }
            loading={saving}
            disabled={!valid || saving}
            fullWidth
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },

  scroll: { padding: spacing.lg },

  // Hint card
  hintCard: { marginBottom: spacing.lg },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hintIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },
  hintText: { fontSize: fontSize.xs, marginTop: 2 },

  // Calendar
  calendarCard: { marginBottom: spacing.md },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, padding: 2 },
  weekDayText: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium as any,
    paddingVertical: spacing.xs,
  },
  cell: {
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  cellIconTopRight: { position: 'absolute', top: 2, right: 2 },
  cellIconBottomRight: { position: 'absolute', bottom: 2, right: 2 },

  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendSwatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 2 },
  legendText: { fontSize: fontSize.xs },

  // Recurring section
  section: { marginBottom: spacing.xl },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: { fontSize: fontSize.xs, marginTop: 2, marginBottom: spacing.md },

  // Sticky action bar
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  actionBarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  actionBarLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  clearBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  actionBarButtons: { flexDirection: 'row' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium as any, marginBottom: spacing.xs },
  row2: { flexDirection: 'row', marginTop: spacing.lg },

  dowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dowChip: {
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dowText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold as any },

  ruleTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  ruleTypeHint: { fontSize: fontSize.xs, marginTop: spacing.xs, marginBottom: spacing.lg },
});
