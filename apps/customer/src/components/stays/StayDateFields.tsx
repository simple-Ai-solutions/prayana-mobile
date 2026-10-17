// StayDateFields — check-in and check-out, side by side (stacked on narrow
// phones), backed by the native date picker.
//
// Picking a check-in on or after the check-out moves the check-out to the
// next day, so the pair is never back to front. A check-out picked with no
// check-in fills the night before it. The parent decides what to do with a
// pair that's still wrong (datesProblem), and shows `error` under the fields.
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, fontSize } from '@prayana/shared-ui';
import { DateField } from '../common/DateField';
import { addDays, isISODate, isoToLocalDate, todayIST, type StayDates } from '../../lib/stays';

interface Props {
  checkIn: string;
  checkOut: string;
  onChange: (d: StayDates) => void;
  error?: string | null;
}

export function StayDateFields({ checkIn, checkOut, onChange, error }: Props) {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const today = todayIST();

  const setCheckIn = (iso: string) => {
    const out = isISODate(checkOut) && checkOut > iso ? checkOut : addDays(iso, 1);
    onChange({ checkIn: iso, checkOut: out });
  };
  const setCheckOut = (iso: string) => {
    if (!isISODate(checkIn)) {
      const before = addDays(iso, -1);
      onChange({ checkIn: before >= today ? before : today, checkOut: iso });
      return;
    }
    onChange({ checkIn, checkOut: iso });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, narrow && styles.column]}>
        <View style={styles.cell}>
          <DateField
            label="Check-in"
            value={checkIn}
            onChange={setCheckIn}
            placeholder="Add date"
            minimumDate={isoToLocalDate(today)}
            // No maximumDate: an empty field would open the picker on it.
            // "Up to a year ahead" is checked by datesProblem instead.
          />
        </View>
        <View style={styles.cell}>
          <DateField
            label="Check-out"
            value={checkOut}
            onChange={setCheckOut}
            placeholder="Add date"
            minimumDate={isoToLocalDate(addDays(isISODate(checkIn) ? checkIn : today, 1))}
            maximumDate={isoToLocalDate(addDays(isISODate(checkIn) ? checkIn : today, 30))}
          />
        </View>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  column: { flexDirection: 'column' },
  cell: { flex: 1, minWidth: 0 },
  error: { color: colors.error, fontSize: fontSize.xs, fontWeight: '600' },
});
