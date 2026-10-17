// StayBookingCard — one stay in the "Stays" pill of My Bookings: cover,
// property, room, dates, guests, amount, status and reference, linking to
// the booking screen where the voucher, paying, cancelling and reviewing
// live. Web parity: components/stays/booking/StayBookingCard.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge, useTheme, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { fmtRange, fmtTime, guestsLabel, inr, nightsLabel, payableOf, roomLine, type StayBooking } from '../../lib/stays';
import { useSecondsLeft } from './StayNotices';

export function StayBookingCard({
  booking,
  onPress,
  onReview,
}: {
  booking: StayBooking;
  onPress: () => void;
  onReview: () => void;
}) {
  const { themeColors, brand, isDarkMode } = useTheme();
  const s = booking.snapshot || {};
  const pending = booking.status === 'payment_pending';
  const secondsLeft = useSecondsLeft(pending ? booking.payBy : null);
  const holdLive = pending && secondsLeft > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.stayName || 'Stay'}, ${fmtRange(booking.checkIn, booking.checkOut)}, ${booking.status.replace(/_/g, ' ')}. Open booking`}
    >
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }, !isDarkMode && shadow.sm]}>
        <View style={styles.top}>
          {s.coverPhoto ? (
            <Image source={{ uri: s.coverPhoto }} style={styles.thumb} contentFit="cover" recyclingKey={booking._id} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: brand[500] }]}>
              <Ionicons name="bed-outline" size={28} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
                {s.stayName || 'Stay'}
              </Text>
              <StatusBadge status={booking.status} />
            </View>
            <Text style={[styles.sub, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {roomLine(s.roomTypeName, booking.units, s.roomKind)}
              {s.city ? ` · ${s.city}` : ''}
            </Text>
            <Text style={[styles.ref, { color: brand[600] }]}>{booking.reference}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={brand[500]} />
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
              {fmtRange(booking.checkIn, booking.checkOut)} · {nightsLabel(booking.nights)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={brand[500]} />
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{guestsLabel(booking.adults, booking.childrenAges)}</Text>
          </View>
          <Text style={[styles.amount, { color: themeColors.text }]}>{inr(payableOf(booking.pricing))}</Text>
        </View>

        {holdLive && booking.payBy ? (
          <View style={[styles.hold, { backgroundColor: isDarkMode ? 'rgba(245,158,11,0.14)' : '#FFFBEB' }]}>
            <Ionicons name="time-outline" size={14} color={isDarkMode ? '#FCD34D' : '#92400E'} />
            <Text style={[styles.holdText, { color: isDarkMode ? '#FCD34D' : '#92400E' }]}>
              Pay by {fmtTime(booking.payBy)} to keep these rooms
            </Text>
          </View>
        ) : null}

        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          {booking.canReview ? (
            <TouchableOpacity
              onPress={onReview}
              style={styles.review}
              accessibilityRole="button"
              accessibilityLabel={`Write a review of ${s.stayName || 'this stay'}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="star-outline" size={15} color={brand[600]} />
              <Text style={[styles.cta, { color: brand[600] }]}>Write a review</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.cta, { color: brand[600] }]}>{holdLive ? 'Finish booking' : 'View booking & voucher'}</Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  top: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  thumb: { width: 72, height: 72, borderRadius: borderRadius.lg },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.xs, marginTop: 4 },
  ref: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 4, letterSpacing: 0.5 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 4, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: fontSize.xs },
  amount: { marginLeft: 'auto', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  hold: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.sm, borderRadius: borderRadius.md },
  holdText: { flex: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  review: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cta: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
