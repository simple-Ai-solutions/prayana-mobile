// Departures step — RN port of the web partner-portal's DeparturesStep.jsx
// (apps/vendor/business/packages/DeparturesStep.jsx, ground truth for logic).
//
// Branches on values.packageType:
//   • 'fixed'                     → manage values.departures[] (dated slots +
//                                   status + a mini status-calendar overview)
//   • 'customizable' / 'dynamic'  → edit the values.availability booking window
//
// This is a wizard SUB-STEP: it renders plain content (no SafeAreaView / header /
// ScrollView) — the wizard shell (PackageForm) provides the page chrome.
// Dates are always stored as 'YYYY-MM-DD'.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Card, useTheme } from '@prayana/shared-ui';
import { Button } from '../../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import { StepProps, Departure, DepartureStatus } from './packageTypes';

// ============================================================
// Date helpers — all storage is 'YYYY-MM-DD' (local, no TZ drift)
// ============================================================
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

// Parse a stored date at local midnight (avoids the UTC shift `new Date(iso)`
// introduces for bare YYYY-MM-DD strings).
const parseISO = (iso: string) => new Date(`${String(iso).slice(0, 10)}T00:00:00`);

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// ============================================================
// Status config — green / yellow / red / gray (matches web)
// ============================================================
type StatusOption = { key: DepartureStatus; label: string; color: string; tint: string };

const GRAY_500 = '#6b7280';
const GRAY_TINT = '#f3f4f6';

const STATUS_OPTIONS: StatusOption[] = [
  { key: 'open', label: 'Open', color: colors.success, tint: colors.successLight },
  { key: 'filling_fast', label: 'Filling Fast', color: colors.warning, tint: colors.warningLight },
  { key: 'sold_out', label: 'Sold Out', color: colors.error, tint: colors.errorLight },
  { key: 'cancelled', label: 'Cancelled', color: GRAY_500, tint: GRAY_TINT },
];

const STATUS_BY_KEY: Record<DepartureStatus, StatusOption> = STATUS_OPTIONS.reduce(
  (acc, s) => {
    acc[s.key] = s;
    return acc;
  },
  {} as Record<DepartureStatus, StatusOption>
);

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type ThemeColorsT = ReturnType<typeof useTheme>['themeColors'];

// ============================================================
// Step component
// ============================================================
export default function DeparturesStep({ values, onChange }: StepProps) {
  const { themeColors } = useTheme();
  const isFixed = values.packageType === 'fixed';
  const nights = Math.max(0, Math.round(Number(values.nights) || 0));
  const departures = values.departures ?? [];

  // ── Fixed-departure mutations ──────────────────────────────
  const addDeparture = () => {
    const start = addDays(new Date(), 30);
    const end = addDays(start, nights);
    const next: Departure = {
      startDate: toISODate(start),
      endDate: toISODate(end),
      availableSlots: 10,
      bookedSlots: 0,
      status: 'open',
    };
    onChange({ departures: [...departures, next] });
  };

  const duplicateDeparture = (index: number) => {
    const source = departures[index];
    if (!source) return;
    const newStart = addDays(parseISO(source.startDate), 7);
    const newEnd = addDays(newStart, nights);
    const copy: Departure = {
      ...source,
      startDate: toISODate(newStart),
      endDate: toISODate(newEnd),
      bookedSlots: 0,
    };
    onChange({ departures: [...departures, copy] });
  };

  // Patch a departure. Any change to startDate ALWAYS recomputes endDate.
  const updateDeparture = (index: number, patch: Partial<Departure>) => {
    const next = departures.map((d, i) => (i === index ? { ...d, ...patch } : d));
    if (patch.startDate) {
      next[index] = {
        ...next[index],
        endDate: toISODate(addDays(parseISO(patch.startDate), nights)),
      };
    }
    onChange({ departures: next });
  };

  const removeDeparture = (index: number) => {
    onChange({ departures: departures.filter((_, i) => i !== index) });
  };

  // ── Non-fixed availability window ──────────────────────────
  const setAvailability = (patch: Partial<typeof values.availability>) => {
    onChange({ availability: { ...values.availability, ...patch } });
  };

  // ── Stats ──────────────────────────────────────────────────
  const totalSlots = departures.reduce((sum, d) => sum + (Number(d.availableSlots) || 0), 0);
  const openCount = departures.filter((d) => d.status === 'open').length;

  return (
    <View style={styles.root}>
      {isFixed ? (
        <>
          {/* ── Stats bar ── */}
          {departures.length > 0 && (
            <View style={styles.statsRow}>
              <StatTile value={departures.length} label="Total Departures" color={colors.primary[500]} themeColors={themeColors} />
              <StatTile value={openCount} label="Open for Booking" color={colors.success} themeColors={themeColors} />
              <StatTile value={totalSlots} label="Total Slots" color="#7c3aed" themeColors={themeColors} />
            </View>
          )}

          {/* ── Mini status calendar ── */}
          {departures.length > 0 && (
            <MiniCalendar departures={departures} themeColors={themeColors} />
          )}

          {/* ── Header + add ── */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadTextWrap}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="airplane" size={18} color={colors.primary[500]} />
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Fixed Departure Dates
                </Text>
              </View>
              <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
                Set specific departure dates with available slots
              </Text>
            </View>
          </View>

          {/* ── Departure cards ── */}
          {departures.map((dep, idx) => {
            const status = STATUS_BY_KEY[dep.status] || STATUS_BY_KEY.open;
            return (
              <Card key={idx} bordered elevated={false} style={[styles.depCard, { borderColor: status.color }]}>
                {/* Head: number + status badge + actions */}
                <View style={styles.depHead}>
                  <View style={styles.depHeadLeft}>
                    <Text style={[styles.depNumber, { color: themeColors.text }]}>
                      Departure #{idx + 1}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: status.tint }]}>
                      <View style={[styles.dot, { backgroundColor: status.color }]} />
                      <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={styles.depActions}>
                    <TouchableOpacity
                      onPress={() => duplicateDeparture(idx)}
                      hitSlop={8}
                      style={styles.iconBtn}
                      accessibilityLabel="Duplicate departure"
                    >
                      <Ionicons name="copy-outline" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeDeparture(idx)}
                      hitSlop={8}
                      style={styles.iconBtn}
                      accessibilityLabel="Remove departure"
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Start date */}
                <DateField
                  label="Start Date *"
                  value={dep.startDate}
                  minimumDate={new Date()}
                  placeholder="Pick start date"
                  onChange={(iso) => updateDeparture(idx, { startDate: iso })}
                  themeColors={themeColors}
                />

                {/* End date (auto) */}
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>End Date</Text>
                <View
                  style={[
                    styles.readonlyField,
                    { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  ]}
                >
                  <View style={styles.readonlyRow}>
                    <Ionicons name="calendar-outline" size={16} color={themeColors.textTertiary} />
                    <Text style={[styles.readonlyText, { color: themeColors.textSecondary }]}>
                      {dep.endDate ? fmtDate(dep.endDate) : 'Auto-calculated'}
                    </Text>
                  </View>
                  {dep.startDate && dep.endDate ? (
                    <View style={styles.durationRow}>
                      <Ionicons name="time-outline" size={11} color={themeColors.textTertiary} />
                      <Text style={[styles.durationText, { color: themeColors.textTertiary }]}>
                        {nights}N / {nights + 1}D
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Available slots */}
                <NumberStepperField
                  label="Available Slots"
                  icon="people-outline"
                  value={dep.availableSlots}
                  min={1}
                  onChange={(v) => updateDeparture(idx, { availableSlots: v })}
                  themeColors={themeColors}
                />

                {/* Status chips */}
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Status</Text>
                <View style={styles.statusChipRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = dep.status === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => updateDeparture(idx, { status: opt.key })}
                        activeOpacity={0.7}
                        style={[
                          styles.statusChip,
                          { borderColor: themeColors.border, backgroundColor: themeColors.surface },
                          active && { borderColor: opt.color, backgroundColor: opt.tint },
                        ]}
                      >
                        <View style={[styles.dot, { backgroundColor: opt.color }]} />
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: active ? opt.color : themeColors.textSecondary },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>
            );
          })}

          {/* ── Empty state / add button ── */}
          {departures.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { borderColor: themeColors.border, backgroundColor: themeColors.backgroundSecondary },
              ]}
            >
              <Ionicons name="calendar-outline" size={40} color={themeColors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: themeColors.textSecondary }]}>
                No departures added yet
              </Text>
              <Text style={[styles.emptyHint, { color: themeColors.textTertiary }]}>
                Add departure dates so customers can book specific trips
              </Text>
              <Button
                title="Add First Departure"
                onPress={addDeparture}
                variant="outline"
                icon={<Ionicons name="add" size={16} color={colors.primary[500]} />}
              />
            </View>
          ) : (
            <Button
              title="Add Departure"
              onPress={addDeparture}
              variant="primary"
              icon={<Ionicons name="add" size={16} color="#fff" />}
              fullWidth
            />
          )}
        </>
      ) : (
        <>
          {/* ── Availability window (customizable / dynamic) ── */}
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time-outline" size={18} color={colors.primary[500]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Availability Window</Text>
              <Text style={[styles.sectionHint, { color: themeColors.textTertiary }]}>
                Set when this package can be booked by travelers
              </Text>
            </View>
          </View>

          <DateField
            label="Available From"
            value={values.availability.availableFrom}
            placeholder="Select start date"
            onChange={(iso) => setAvailability({ availableFrom: iso })}
            themeColors={themeColors}
          />

          <DateField
            label="Available Until"
            value={values.availability.availableTo}
            placeholder="Select end date"
            minimumDate={
              values.availability.availableFrom
                ? parseISO(values.availability.availableFrom)
                : undefined
            }
            onChange={(iso) => setAvailability({ availableTo: iso })}
            themeColors={themeColors}
          />

          <NumberStepperField
            label="Advance Booking (days)"
            icon="time-outline"
            value={values.availability.advanceBookingDays}
            min={1}
            hint="Minimum days before travel date to accept bookings"
            onChange={(v) => setAvailability({ advanceBookingDays: v })}
            themeColors={themeColors}
          />

          <NumberStepperField
            label="Max Bookings Per Day"
            icon="people-outline"
            value={values.availability.maxBookingsPerDay}
            min={1}
            hint="Maximum number of bookings accepted per day"
            onChange={(v) => setAvailability({ maxBookingsPerDay: v })}
            themeColors={themeColors}
          />

          {/* Booking-window info box */}
          {values.availability.availableFrom && values.availability.availableTo ? (
            <View style={[styles.infoBox, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary[500]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.primary[700] }]}>Booking Window</Text>
                <Text style={[styles.infoText, { color: colors.primary[600] }]}>
                  Customers can book this package for travel between{' '}
                  {fmtDate(values.availability.availableFrom)} and{' '}
                  {fmtDate(values.availability.availableTo)}, with at least{' '}
                  {values.availability.advanceBookingDays || 7} days advance notice.
                </Text>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

// ============================================================
// Stat tile
// ============================================================
function StatTile({
  value,
  label,
  color,
  themeColors,
}: {
  value: number;
  label: string;
  color: string;
  themeColors: ThemeColorsT;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: themeColors.backgroundSecondary }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ============================================================
// Mini status calendar — marks departure start dates with a
// status-colored dot (availability.tsx grid conventions).
// ============================================================
function MiniCalendar({
  departures,
  themeColors,
}: {
  departures: Departure[];
  themeColors: ThemeColorsT;
}) {
  const [month, setMonth] = useState(() => new Date());

  const statusByDate = useMemo(() => {
    const map: Record<string, DepartureStatus> = {};
    departures.forEach((d) => {
      if (d.startDate) map[String(d.startDate).slice(0, 10)] = d.status || 'open';
    });
    return map;
  }, [departures]);

  const cells = useMemo<(null | { day: number; iso: string; status: DepartureStatus | null })[]>(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const list: (null | { day: number; iso: string; status: DepartureStatus | null })[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      list.push({ day, iso, status: statusByDate[iso] || null });
    }
    return list;
  }, [month, statusByDate]);

  const changeMonth = (dir: number) =>
    setMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + dir);
      return next;
    });

  return (
    <Card bordered elevated={false} style={styles.calendarCard}>
      <View style={styles.calNav}>
        <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={8} style={styles.calNavBtn}>
          <Ionicons name="chevron-back" size={18} color={themeColors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.calMonth, { color: themeColors.text }]}>{fmtMonth(month)}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={8} style={styles.calNavBtn}>
          <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {WEEK_DAYS.map((d, i) => (
          <View key={i} style={styles.cellWrap}>
            <Text style={[styles.weekDayText, { color: themeColors.textTertiary }]}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((c, i) => {
          if (!c) return <View key={`e-${i}`} style={styles.cellWrap} />;
          const cfg = c.status ? STATUS_BY_KEY[c.status] : null;
          return (
            <View key={c.iso} style={styles.cellWrap}>
              <View style={[styles.calCell, cfg && { backgroundColor: cfg.tint }]}>
                <Text
                  style={[
                    styles.calCellText,
                    { color: cfg ? cfg.color : themeColors.textTertiary },
                    cfg && { fontWeight: fontWeight.bold },
                  ]}
                >
                  {c.day}
                </Text>
                {cfg ? <View style={[styles.calDot, { backgroundColor: cfg.color }]} /> : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        {STATUS_OPTIONS.filter((s) => s.key !== 'sold_out').map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={[styles.legendText, { color: themeColors.textTertiary }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ============================================================
// Date field — tappable, backed by the native date picker
// ============================================================
function DateField({
  label,
  value,
  onChange,
  minimumDate,
  placeholder,
  themeColors,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  placeholder?: string;
  themeColors: ThemeColorsT;
}) {
  const [show, setShow] = useState(false);

  const handlePicked = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (event.type === 'set' && picked) {
      onChange(toISODate(picked));
      if (Platform.OS === 'ios') setShow(false);
    }
  };

  return (
    <View style={styles.fieldBlock}>
      {label ? <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => setShow((v) => !v)}
        activeOpacity={0.7}
        style={[styles.dateField, { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }]}
      >
        <Text style={[styles.dateFieldText, { color: value ? themeColors.text : themeColors.textTertiary }]}>
          {value ? fmtDate(value) : placeholder || 'Select date'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={themeColors.textSecondary} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value ? parseISO(value) : minimumDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={handlePicked}
        />
      )}
    </View>
  );
}

// ============================================================
// Number stepper field — icon + [-] input [+], clamped to min/max
// ============================================================
function NumberStepperField({
  label,
  value,
  onChange,
  min = 0,
  max,
  icon,
  hint,
  themeColors,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  hint?: string;
  themeColors: ThemeColorsT;
}) {
  const clamp = (n: number) => {
    let out = n;
    if (min != null) out = Math.max(min, out);
    if (max != null) out = Math.min(max, out);
    return out;
  };

  const bump = (dir: 1 | -1) => onChange(clamp((Number(value) || 0) + dir));

  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          onPress={() => bump(-1)}
          style={[styles.stepperBtn, { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field }]}
          hitSlop={6}
        >
          <Ionicons name="remove" size={20} color={colors.primary[500]} />
        </TouchableOpacity>
        <View
          style={[
            styles.stepperInputWrap,
            { borderColor: themeColors.fieldBorder, backgroundColor: themeColors.field },
          ]}
        >
          {icon ? (
            <Ionicons name={icon} size={16} color={themeColors.textTertiary} style={styles.stepperInputIcon} />
          ) : null}
          <RNTextInput
            value={String(value)}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
              onChange(clamp(Number.isFinite(n) ? n : min));
            }}
            keyboardType="number-pad"
            style={[styles.stepperInput, { color: themeColors.text }]}
          />
        </View>
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
// Styles
// ============================================================
const styles = StyleSheet.create({
  root: { gap: spacing.lg },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: {
    flex: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },

  // Section header
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeadTextWrap: { flex: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionHint: { fontSize: fontSize.xs, marginTop: 2 },

  // Departure card
  depCard: { gap: spacing.sm, borderWidth: 2 },
  depHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  depHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, flexWrap: 'wrap' },
  depNumber: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusPillText: { fontSize: 11, fontWeight: fontWeight.semibold },
  depActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },

  // Fields
  fieldBlock: { marginTop: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  fieldHint: { fontSize: fontSize.xs, marginTop: spacing.xs },

  readonlyField: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  readonlyText: { fontSize: fontSize.sm },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  durationText: { fontSize: 10 },

  // Date field
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  dateFieldText: { fontSize: fontSize.md },

  // Status chips
  statusChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  stepperInputIcon: { marginRight: spacing.xs },
  stepperInput: { flex: 1, fontSize: fontSize.md, textAlign: 'center', paddingVertical: spacing.sm },

  // Mini calendar
  calendarCard: { gap: spacing.sm },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calMonth: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, padding: 1.5 },
  weekDayText: { textAlign: 'center', fontSize: 10, fontWeight: fontWeight.semibold, paddingVertical: 2 },
  calCell: { aspectRatio: 1, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  calCellText: { fontSize: fontSize.xs },
  calDot: { position: 'absolute', bottom: 3, width: 6, height: 6, borderRadius: 3 },

  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendText: { fontSize: 10 },

  // Empty state
  emptyState: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.xs },
  emptyHint: { fontSize: fontSize.xs, textAlign: 'center', marginBottom: spacing.sm },

  // Info box
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  infoTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  infoText: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
});
