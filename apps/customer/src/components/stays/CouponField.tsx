// CouponField — "Have a coupon?" on the stay checkout (web: CouponField).
// Folded to one link for the guests who have none; once a code applies it
// turns into a green line with what it saves and a Remove.
//
// The checkout owns the truth: applying re-prices the stay with the server
// (quote with couponCode) and the quote says whether the code applies and,
// if not, why. Per-guest limits are checked again at booking, so a code can
// still be turned down at Pay — the checkout passes that reason as `error`.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput as RNTextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { inr } from '../../lib/stays';
import { useToneColors } from './StayNotices';

// Same cleaning as the server (stayCoupon.cleanCode).
const clean = (v: string) => String(v || '').toUpperCase().replace(/\s+/g, '').slice(0, 40);

export function CouponField({
  applied,
  error,
  onApply,
  onRemove,
  disabled = false,
}: {
  applied: { code: string; discount: number; description?: string | null } | null;
  error: string | null;
  onApply: (code: string) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}) {
  const { themeColors, brand } = useTheme();
  const green = useToneColors('success');
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setChecking(true);
    try {
      await fn();
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <View style={[styles.applied, { backgroundColor: green.bg, borderColor: green.border }]} accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={18} color={green.text} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.appliedTitle, { color: green.text }]}>
            {applied.code} applied: you save {inr(applied.discount)}
          </Text>
          {applied.description ? <Text style={[styles.appliedSub, { color: green.text }]}>{applied.description}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() =>
            run(async () => {
              await onRemove();
              setCode('');
            })
          }
          disabled={disabled || checking}
          accessibilityRole="button"
          accessibilityLabel={`Remove coupon ${applied.code}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.remove, { color: green.text }]}>{checking ? 'Removing…' : 'Remove'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!open && !error) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} disabled={disabled} style={styles.openRow} accessibilityRole="button">
        <Ionicons name="pricetag-outline" size={16} color={brand[600]} />
        <Text style={[styles.openText, { color: brand[600] }]}>Have a coupon?</Text>
      </TouchableOpacity>
    );
  }

  const value = clean(code);
  const submit = () => {
    if (!value || checking || disabled) return;
    Keyboard.dismiss();
    run(() => onApply(value));
  };

  return (
    <View>
      <Text style={[styles.label, { color: themeColors.text }]}>Coupon code</Text>
      <View style={styles.row}>
        <View
          style={[
            styles.inputBox,
            { backgroundColor: themeColors.field, borderColor: error ? colors.error : themeColors.fieldBorder },
          ]}
        >
          <RNTextInput
            value={code}
            onChangeText={(t) => setCode(clean(t))}
            placeholder="e.g. STAY500"
            placeholderTextColor={themeColors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            editable={!disabled && !checking}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[styles.input, { color: themeColors.text }]}
            accessibilityLabel="Coupon code"
          />
          {code && !checking ? (
            <TouchableOpacity onPress={() => setCode('')} accessibilityRole="button" accessibilityLabel="Clear coupon code" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Button title="Apply" variant="outline" size="md" onPress={submit} loading={checking} disabled={!value || disabled} />
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
  applied: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  appliedTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  appliedSub: { fontSize: fontSize.xs, marginTop: 2, opacity: 0.9 },
  remove: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textDecorationLine: 'underline' },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  openText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: fontSize.md, letterSpacing: 0.5, paddingVertical: 10 },
  error: { color: colors.error, fontSize: fontSize.xs, marginTop: 6 },
});
