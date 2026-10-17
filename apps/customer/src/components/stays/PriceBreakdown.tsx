// PriceBreakdown — what a stay costs, the way the server priced it: room
// charges (night-by-night folded away — weekend rates make nights differ),
// extra guests, GST, the total, then any coupon and what the guest pays.
//
// Used with a quote on the checkout and with the booking's own pricing on
// the voucher, so the guest sees the same lines before and after paying.
// Every number comes from the server; nothing is re-added here.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import {
  discountOf,
  fmtDay,
  gstLabel,
  inr,
  nightsLabel,
  payableOf,
  type RoomKind,
  type StayPricing,
} from '../../lib/stays';

const GREEN = '#059669';

export function PriceBreakdown({
  pricing,
  roomKind,
  couponCode,
  payLabel = 'You pay',
  totalLabel = 'Total',
}: {
  pricing?: StayPricing | null;
  roomKind?: RoomKind;
  /** The applied code, when the pricing carries a discount. */
  couponCode?: string | null;
  payLabel?: string;
  totalLabel?: string;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [open, setOpen] = useState(false);
  if (!pricing) return null;

  const nightly = pricing.nightly || [];
  const unit = roomKind === 'dorm' ? 'bed' : roomKind === 'entire_place' ? 'unit' : 'room';
  const extraGuests = nightly[0]?.extraGuests || 0;
  const discount = discountOf(pricing);
  const code = couponCode || pricing.couponCode || null;

  const Row = ({ label, value, tone }: { label: string; value: string; tone?: 'green' }) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: tone === 'green' ? GREEN : themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: tone === 'green' ? GREEN : themeColors.text }]}>{value}</Text>
    </View>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View>
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() => setOpen((v) => !v)}
            style={styles.expander}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`Room charges for ${nightsLabel(nightly.length)}. ${open ? 'Hide' : 'Show'} each night`}
          >
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>
              Room charges · {nightsLabel(nightly.length)}
            </Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={themeColors.textTertiary} />
          </TouchableOpacity>
          <Text style={[styles.value, { color: themeColors.text }]}>{inr(pricing.roomTotal)}</Text>
        </View>
        {open ? (
          <View style={[styles.nights, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : themeColors.backgroundSecondary }]}>
            {nightly.map((n) => (
              <View key={n.date} style={styles.nightRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nightDate, { color: themeColors.textSecondary }]}>{fmtDay(n.date)}</Text>
                  <Text style={[styles.nightSub, { color: themeColors.textTertiary }]}>
                    {inr(n.unitPrice)}
                    {n.units > 1 ? ` × ${n.units} ${unit}s` : ` per ${unit}`}
                  </Text>
                </View>
                <Text style={[styles.nightValue, { color: themeColors.text }]}>{inr(n.unitPrice * n.units)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {Number(pricing.extraTotal) > 0 ? (
        <Row
          label={`Extra guest${extraGuests === 1 ? '' : 's'}${extraGuests ? ` (${extraGuests})` : ''}`}
          value={inr(pricing.extraTotal)}
        />
      ) : null}

      <Row label={gstLabel(nightly)} value={inr(pricing.gst)} />

      <View style={[styles.totalRow, { borderTopColor: themeColors.border }]}>
        <Text style={[styles.totalLabel, { color: themeColors.text }]}>{discount > 0 ? 'Total' : totalLabel}</Text>
        <Text style={[discount > 0 ? styles.value : styles.totalValue, { color: themeColors.text }]}>{inr(pricing.total)}</Text>
      </View>

      {discount > 0 ? (
        <>
          <Row label={`Coupon${code ? ` ${code}` : ''}`} value={`−${inr(discount)}`} tone="green" />
          <View style={[styles.totalRow, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.totalLabel, { color: themeColors.text }]}>{payLabel}</Text>
            <Text style={[styles.totalValue, { color: themeColors.text }]}>{inr(payableOf(pricing))}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  expander: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  label: { fontSize: fontSize.sm, flexShrink: 1 },
  value: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  nights: { marginTop: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  nightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  nightDate: { fontSize: fontSize.xs },
  nightSub: { fontSize: fontSize.xs, marginTop: 1 },
  nightValue: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  totalValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
