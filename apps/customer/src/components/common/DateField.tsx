// DateField — a tappable date input backed by the native picker.
//
// The eSIM checkout previously asked customers to hand-type "YYYY-MM-DD" into a
// plain text box. That is how you get a rejected order: Matrix validates the
// format, and one typo (or an empty field) fails the whole purchase. The web
// uses <input type="date">, which is a real calendar; this is the RN equivalent.
//
// Value in/out is always the ISO "YYYY-MM-DD" string the API expects — the
// Date object never escapes this component.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Modal } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';

interface Props {
  label: string;
  /** ISO date, "YYYY-MM-DD", or '' when unset. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  editable?: boolean;
}

/** Local-time ISO date. toISOString() would shift the day for anyone east of UTC. */
function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "21 Apr 1995" — what the customer reads. */
function pretty(iso: string): string {
  const d = parseISO(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const DateField: React.FC<Props> = ({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  minimumDate,
  maximumDate,
  editable = true,
}) => {
  const { themeColors, isDarkMode } = useTheme();
  const [open, setOpen] = useState(false);
  // iOS shows a spinner we confirm with Done; Android shows a modal dialog that
  // reports its own dismissal. Keep a draft so Cancel on iOS discards cleanly.
  const [draft, setDraft] = useState<Date>(() => parseISO(value) ?? maximumDate ?? new Date());

  const openPicker = () => {
    if (!editable) return;
    setDraft(parseISO(value) ?? maximumDate ?? new Date());
    setOpen(true);
  };

  const picker = (
    <DateTimePicker
      value={draft}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onChange={(event, picked) => {
        if (Platform.OS === 'android') {
          setOpen(false);
          if (event.type === 'set' && picked) onChange(toISO(picked));
          return;
        }
        if (picked) setDraft(picked);
      }}
    />
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>

      <TouchableOpacity
        onPress={openPicker}
        disabled={!editable}
        style={[
          styles.field,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
            opacity: editable ? 1 : 0.6,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${pretty(value)}` : `${label}: not set`}
      >
        <Ionicons name="calendar-outline" size={17} color={themeColors.textSecondary} />
        <Text
          style={[
            styles.value,
            { color: value ? themeColors.text : themeColors.textTertiary },
          ]}
        >
          {value ? pretty(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={themeColors.textTertiary} />
      </TouchableOpacity>

      {open && Platform.OS === 'android' && picker}

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF' }]}>
              <View style={[styles.sheetBar, { borderBottomColor: themeColors.border }]}>
                <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button">
                  <Text style={[styles.sheetBtn, { color: themeColors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.sheetTitle, { color: themeColors.text }]}>{label}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(toISO(draft));
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.sheetBtn, styles.sheetDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              {picker}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  value: { flex: 1, fontSize: fontSize.md },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: spacing.xl },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  sheetBtn: { fontSize: fontSize.md },
  sheetDone: { color: '#E61417', fontWeight: fontWeight.bold },
});

export default DateField;
