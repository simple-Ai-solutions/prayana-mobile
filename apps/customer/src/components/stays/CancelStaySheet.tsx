// CancelStaySheet — "Cancel this stay?" with the refund spelled out before
// the guest commits: the server's cancelPreview says what they'd get back
// right now, so the sheet never guesses. An optional reason goes to the
// property. Doesn't close itself while the request is in flight.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput as RNTextInput } from 'react-native';
import Toast from 'react-native-toast-message';
import { Button, useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { staysAPI } from '@prayana/shared-services';
import { errorCode, errorText, fmtDateTime, inr, type StayBooking } from '../../lib/stays';
import { StaySheet } from './StaySheet';

export function CancelStaySheet({
  booking,
  visible,
  onClose,
  onCancelled,
}: {
  booking: StayBooking;
  visible: boolean;
  onClose: () => void;
  /** The updated booking, or null when the screen should just reload. */
  onCancelled: (updated: StayBooking | null) => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Each opening starts with an empty reason.
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const p = booking.cancelPreview;
  const refundLine =
    p && Number(p.refundPercent) > 0
      ? `You'll get ${inr(p.refundAmount)} back (${p.refundPercent}%). It goes to your original payment method, usually within 5–7 working days.`
      : p?.freeUntil
        ? `No refund: free cancellation ended on ${fmtDateTime(p.freeUntil)}.`
        : 'No refund: this booking is non-refundable.';

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await staysAPI.cancelBooking(booking._id, reason.trim() || undefined);
      Toast.show({ type: 'success', text1: 'Booking cancelled', text2: res?.message });
      onCancelled((res?.data as StayBooking) || null);
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't cancel the booking", text2: errorText(e, 'Please try again.') });
      // The booking changed under us (check-in day came, or it was already
      // cancelled): close and let the screen show where it stands now.
      const code = errorCode(e);
      if (code && ['TOO_LATE', 'NOT_CANCELLABLE', 'CHANGED'].includes(code)) onCancelled(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StaySheet
      visible={visible}
      title="Cancel this stay?"
      onClose={onClose}
      locked={submitting}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button title="Cancel booking" variant="danger" size="lg" fullWidth onPress={submit} loading={submitting} />
          <Button title="Keep booking" variant="secondary" size="lg" fullWidth onPress={onClose} disabled={submitting} />
        </View>
      }
    >
      <View style={[styles.refund, { backgroundColor: isDarkMode ? themeColors.surface : themeColors.backgroundSecondary }]}>
        <Text style={[styles.refundText, { color: themeColors.text }]}>{refundLine}</Text>
      </View>
      <Text style={[styles.label, { color: themeColors.text }]}>Reason (optional)</Text>
      <RNTextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Plans changed, found another place…"
        placeholderTextColor={themeColors.textTertiary}
        multiline
        maxLength={500}
        editable={!submitting}
        style={[styles.input, { color: themeColors.text, backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder }]}
        accessibilityLabel="Reason for cancelling (optional)"
      />
      <Text style={[styles.hint, { color: themeColors.textTertiary }]}>Shared with the property.</Text>
    </StaySheet>
  );
}

const styles = StyleSheet.create({
  refund: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.lg },
  refundText: { fontSize: fontSize.sm, lineHeight: 20 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  input: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
  hint: { fontSize: fontSize.xs, marginTop: 6 },
});
