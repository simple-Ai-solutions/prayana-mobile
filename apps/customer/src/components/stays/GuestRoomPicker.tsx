// GuestRoomPicker — adults, children (each with an age) and rooms.
//
// `PartyEditor` is the steppers on their own, for a sheet that already has
// other fields (the search sheet). `GuestRoomField` is a "2 adults · 1 room"
// field that opens its own sheet and hands the party back once, on Done:
// on the property page every change re-checks availability, so a request
// per +/− tap would be wasteful.
//
// Children's ages are asked for, not defaulted: the price depends on them
// (kids under a property's age stay free), so a guessed age could quote the
// wrong total. Done waits until each child has an age.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { StaySheet } from './StaySheet';
import { MAX_ADULTS, MAX_CHILDREN, MAX_CHILD_AGE, MAX_ROOMS, partySummary, type Party } from '../../lib/stays';

/** A party being edited: a child's age is null until picked. */
export type DraftParty = { adults: number; children: (number | null)[]; rooms: number };

export const toDraft = (p: Party): DraftParty => ({ ...p, children: [...p.children] });
export const draftMissingAge = (d: DraftParty) => d.children.some((a) => a === null);
export const fromDraft = (d: DraftParty): Party => ({
  adults: d.adults,
  rooms: d.rooms,
  children: d.children.map((a) => Number(a ?? 0)),
});

const AGES = Array.from({ length: MAX_CHILD_AGE + 1 }, (_, age) => age);

function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string | null;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { themeColors, brand } = useTheme();
  const btn = (dir: -1 | 1) => {
    const disabled = dir < 0 ? value <= min : value >= max;
    return (
      <TouchableOpacity
        onPress={() => onChange(value + dir)}
        disabled={disabled}
        style={[styles.counterBtn, { borderColor: disabled ? themeColors.border : brand[500], opacity: disabled ? 0.4 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`${dir < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
        accessibilityState={{ disabled }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name={dir < 0 ? 'remove' : 'add'} size={18} color={disabled ? themeColors.textTertiary : brand[500]} />
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.counterRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.counterLabel, { color: themeColors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.counterHint, { color: themeColors.textSecondary }]}>{hint}</Text> : null}
      </View>
      <View style={styles.counterControls}>
        {btn(-1)}
        <Text style={[styles.counterValue, { color: themeColors.text }]} accessibilityLiveRegion="polite">
          {value}
        </Text>
        {btn(1)}
      </View>
    </View>
  );
}

export function PartyEditor({
  value,
  onChange,
  showRooms = true,
  warn = false,
}: {
  value: DraftParty;
  onChange: (next: DraftParty) => void;
  showRooms?: boolean;
  /** Highlight children still missing an age. */
  warn?: boolean;
}) {
  const { themeColors, brand, isDarkMode } = useTheme();

  const setAdults = (n: number) => onChange({ ...value, adults: n, rooms: Math.min(value.rooms, n) });
  const setRooms = (n: number) => onChange({ ...value, rooms: n });
  const setChildCount = (n: number) => {
    const kids = value.children.slice(0, n);
    while (kids.length < n) kids.push(null);
    onChange({ ...value, children: kids });
  };
  const setAge = (i: number, age: number) =>
    onChange({ ...value, children: value.children.map((a, j) => (j === i ? age : a)) });

  return (
    <View>
      <Counter label="Adults" hint="18 and over" value={value.adults} min={1} max={MAX_ADULTS} onChange={setAdults} />
      <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
      <Counter
        label="Children"
        hint="0 to 17"
        value={value.children.length}
        min={0}
        max={MAX_CHILDREN}
        onChange={setChildCount}
      />
      {value.children.map((age, i) => {
        const missing = age === null;
        return (
          <View key={i} style={styles.ageBlock}>
            <Text
              style={[
                styles.ageLabel,
                { color: warn && missing ? colors.error : themeColors.textSecondary },
              ]}
            >
              Child {i + 1} age{missing ? ' (pick one)' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageRow}>
              {AGES.map((a) => {
                const on = age === a;
                return (
                  <TouchableOpacity
                    key={a}
                    onPress={() => setAge(i, a)}
                    style={[
                      styles.ageChip,
                      { borderColor: on ? brand[500] : themeColors.border },
                      on && { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.18)' : brand[50] },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Child ${i + 1}: ${a === 0 ? 'under 1 year' : `${a} ${a === 1 ? 'year' : 'years'}`}`}
                  >
                    <Text style={[styles.ageChipText, { color: on ? brand[600] : themeColors.text }]}>
                      {a === 0 ? '<1' : a}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
      {showRooms ? (
        <>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <Counter
            label="Rooms"
            hint={value.rooms >= value.adults && value.adults < MAX_ROOMS ? 'Each room needs an adult' : null}
            value={value.rooms}
            min={1}
            max={Math.min(MAX_ROOMS, value.adults)}
            onChange={setRooms}
          />
        </>
      ) : null}
      {warn && draftMissingAge(value) ? (
        <Text style={styles.warn} accessibilityRole="alert">
          Add each child's age. It can change the price.
        </Text>
      ) : null}
    </View>
  );
}

export function GuestRoomField({
  value,
  onChange,
  label = 'Guests',
  showRooms = true,
}: {
  value: Party;
  onChange: (p: Party) => void;
  label?: string;
  showRooms?: boolean;
}) {
  const { themeColors } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftParty>(() => toDraft(value));
  const [warn, setWarn] = useState(false);

  const openSheet = () => {
    setDraft(toDraft(value));
    setWarn(false);
    setOpen(true);
  };
  const commit = () => {
    if (draftMissingAge(draft)) {
      setWarn(true);
      return;
    }
    setOpen(false);
    const next = fromDraft(draft);
    const same =
      next.adults === value.adults && next.rooms === value.rooms && next.children.join(',') === value.children.join(',');
    if (!same) onChange(next);
  };

  const summary = partySummary(value, showRooms);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text> : null}
      <TouchableOpacity
        onPress={openSheet}
        style={[styles.field, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Guests'}: ${summary}. Change`}
      >
        <Ionicons name="people-outline" size={17} color={themeColors.textSecondary} />
        <Text style={[styles.fieldValue, { color: themeColors.text }]} numberOfLines={1}>
          {summary}
        </Text>
        <Ionicons name="chevron-down" size={16} color={themeColors.textTertiary} />
      </TouchableOpacity>

      <StaySheet
        visible={open}
        title={showRooms ? 'Guests and rooms' : 'Guests'}
        onClose={() => setOpen(false)}
        footer={<Button title="Done" onPress={commit} size="lg" fullWidth />}
      >
        <PartyEditor value={draft} onChange={(d) => { setWarn(false); setDraft(d); }} showRooms={showRooms} warn={warn} />
      </StaySheet>
    </View>
  );
}

const styles = StyleSheet.create({
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  counterLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  counterHint: { fontSize: fontSize.xs, marginTop: 2 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  counterBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  counterValue: { minWidth: 24, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  divider: { height: StyleSheet.hairlineWidth },
  ageBlock: { paddingBottom: spacing.md },
  ageLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  ageRow: { gap: 6, paddingRight: spacing.lg },
  ageChip: {
    minWidth: 38,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  warn: { color: colors.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: spacing.sm },
  fieldWrap: { gap: spacing.sm },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  fieldValue: { flex: 1, fontSize: fontSize.md },
});
