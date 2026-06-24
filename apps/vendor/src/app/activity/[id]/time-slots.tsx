import React, { useCallback, useEffect, useState } from 'react';
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
import {
  Card,
  Button,
  Badge,
  EmptyState,
  TextInput,
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
import { timeSlotAPI } from '@prayana/shared-services';

type TimeSlot = {
  _id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  daysOfWeek?: number[];
  isBlocked?: boolean;
  blockedReason?: string;
  label?: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TimeSlotsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<TimeSlot | null>(null);

  // Form state
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:00');
  const [capacity, setCapacity] = useState('20');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [label, setLabel] = useState('');

  const fetchSlots = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await timeSlotAPI.getActivityTimeSlots(id);
      setSlots(res?.data || res?.timeSlots || []);
    } catch (err: any) {
      console.warn('[TimeSlots] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const openEditor = (slot?: TimeSlot) => {
    if (slot) {
      setEditing(slot);
      setStart(slot.startTime);
      setEnd(slot.endTime);
      setCapacity(String(slot.capacity || 20));
      setDays(slot.daysOfWeek?.length ? slot.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);
      setLabel(slot.label || '');
    } else {
      setEditing({ _id: '', startTime: '', endTime: '', capacity: 20 });
      setStart('09:00');
      setEnd('11:00');
      setCapacity('20');
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setLabel('');
    }
    Haptics.selectionAsync();
  };

  const closeEditor = () => setEditing(null);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
    Haptics.selectionAsync();
  };

  const saveSlot = async () => {
    if (!id) return;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      Toast.show({ type: 'error', text1: 'Use HH:MM format' });
      return;
    }
    if (start >= end) {
      Toast.show({ type: 'error', text1: 'End must be after start' });
      return;
    }
    if (days.length === 0) {
      Toast.show({ type: 'error', text1: 'Pick at least one day' });
      return;
    }
    const cap = Number(capacity);
    if (Number.isNaN(cap) || cap < 1) {
      Toast.show({ type: 'error', text1: 'Capacity must be ≥ 1' });
      return;
    }

    setSubmitting(true);
    const payload = {
      startTime: start,
      endTime: end,
      capacity: cap,
      daysOfWeek: days,
      label: label.trim() || undefined,
    };
    try {
      const res = editing && editing._id
        ? await timeSlotAPI.updateTimeSlot(editing._id, payload)
        : await timeSlotAPI.createTimeSlot(id, payload);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: editing && editing._id ? 'Slot updated' : 'Slot created',
        });
        closeEditor();
        await fetchSlots();
      } else {
        Toast.show({ type: 'error', text1: 'Save failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBlock = async (slot: TimeSlot) => {
    setSubmitting(true);
    try {
      const res = await timeSlotAPI.blockTimeSlot(slot._id, {
        isBlocked: !slot.isBlocked,
        reason: !slot.isBlocked ? 'Blocked by vendor' : undefined,
      });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: slot.isBlocked ? 'Slot unblocked' : 'Slot blocked',
        });
        await fetchSlots();
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSlot = async (slot: TimeSlot) => {
    setSubmitting(true);
    try {
      const res = await timeSlotAPI.deleteTimeSlot(slot._id);
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Slot removed' });
        await fetchSlots();
      } else {
        Toast.show({ type: 'error', text1: 'Could not delete', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Time slots</Text>
        <TouchableOpacity onPress={() => openEditor()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add" size={26} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : slots.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="time-outline" size={56} color={colors.gray[300]} />}
            title="No time slots yet"
            description="Add slots so customers can book specific batches (e.g. 9 AM, 2 PM, sunset)."
            actionLabel="Add slot"
            onAction={() => openEditor()}
          />
        ) : (
          slots.map((s) => (
            <Card key={s._id} style={styles.slotCard}>
              <View style={styles.slotHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotTime}>
                    {s.startTime} – {s.endTime}
                  </Text>
                  {s.label ? <Text style={styles.slotLabel}>{s.label}</Text> : null}
                  <View style={styles.slotMeta}>
                    <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
                    <Text style={styles.slotMetaText}>Capacity {s.capacity}</Text>
                  </View>
                  <Text style={styles.slotDays}>
                    {(s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6])
                      .sort()
                      .map((d) => DAYS[d])
                      .join(' · ')}
                  </Text>
                </View>
                {s.isBlocked ? (
                  <Badge label="Blocked" variant="error" size="sm" />
                ) : (
                  <Badge label="Active" variant="success" size="sm" />
                )}
              </View>
              <View style={styles.slotActions}>
                <Button title="Edit" onPress={() => openEditor(s)} variant="outline" size="sm" />
                <Button
                  title={s.isBlocked ? 'Unblock' : 'Block'}
                  onPress={() => toggleBlock(s)}
                  variant="outline"
                  size="sm"
                />
                <Button title="Delete" onPress={() => deleteSlot(s)} variant="ghost" size="sm" />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editing && editing._id ? 'Edit time slot' : 'New time slot'}
            </Text>
            <TouchableOpacity onPress={closeEditor} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <TextInput label="Start (HH:MM)" value={start} onChangeText={setStart} placeholder="09:00" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput label="End (HH:MM)" value={end} onChangeText={setEnd} placeholder="11:00" />
                </View>
              </View>

              <TextInput
                label="Capacity (max guests per slot)"
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="number-pad"
                placeholder="20"
              />

              <Text style={styles.fieldLabel}>Days of the week</Text>
              <View style={styles.dayRow}>
                {DAYS.map((d, i) => {
                  const active = days.includes(i);
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => toggleDay(i)}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                label="Label (optional)"
                value={label}
                onChangeText={setLabel}
                placeholder="Sunset batch, Morning yoga..."
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button
                title={editing && editing._id ? 'Update slot' : 'Create slot'}
                onPress={saveSlot}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },

  slotCard: { padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  slotHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  slotTime: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  slotLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  slotMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  slotMetaText: { fontSize: fontSize.xs, color: colors.textTertiary },
  slotDays: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 4 },
  slotActions: { flexDirection: 'row', gap: spacing.sm },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  modalScroll: { padding: spacing.lg, gap: spacing.md },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  dayRow: { flexDirection: 'row', gap: spacing.xs },
  dayChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  dayChipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  dayText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  dayTextActive: { color: '#fff' },
});
