import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  StatusBadge,
  Button,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { bookingAPI, businessAPI, invoiceAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingDetail {
  _id: string;
  bookingReference: string;
  status: string;
  activityName?: string;
  activity?: { title?: string; name?: string; _id?: string };
  customerName?: string;
  customer?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  date?: string;
  bookingDate?: string;
  totalAmount?: number;
  payment?: {
    total?: number;
    basePrice?: number;
    variantModifier?: number;
    bulkDiscount?: number;
    seasonalPricing?: number;
    status?: string;
  };
  participants?: {
    adults?: number;
    children?: number;
  };
  participantDetails?: {
    adults?: Array<{
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      age?: number;
      dietaryRestrictions?: string[];
    }>;
    children?: Array<{
      firstName?: string;
      lastName?: string;
      age?: number;
    }>;
  };
  preBookingAnswers?: Array<{
    question?: string;
    answer?: any;
  }>;
  variant?: { name?: string; tier?: string };
  timeSlot?: { startTime?: string; endTime?: string; label?: string };
  isInstantBooking?: boolean;
  createdAt?: string;
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textTertiary} />
      <View style={styles.infoRowText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '-'}</Text>
      </View>
    </View>
  );
}

// ─── Price Row ────────────────────────────────────────────────────────────────

function PriceRow({
  label,
  amount,
  discount = false,
}: {
  label: string;
  amount: number;
  discount?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceAmount, discount && styles.priceDiscount]}>
        {discount ? '-' : ''}{'\u20B9'}{Math.abs(amount).toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { updateBookingInStore } = useBusinessStore();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchBooking = useCallback(async () => {
    try {
      const res = await bookingAPI.getBookingById(id);
      const data = res?.data || res?.booking || res;
      setBooking(data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load booking details' });
    }
  }, [id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchBooking();
    setLoading(false);
  }, [fetchBooking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBooking();
    setRefreshing(false);
  }, [fetchBooking]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    Alert.alert('Confirm Booking', 'Are you sure you want to confirm this booking?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setConfirming(true);
          try {
            await businessAPI.updateBookingStatus(id, 'confirmed');
            setBooking((prev) => (prev ? { ...prev, status: 'confirmed' } : prev));
            updateBookingInStore(id, { status: 'confirmed' });
            Toast.show({ type: 'success', text1: 'Booking confirmed' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Failed to confirm', text2: err?.message });
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  }, [id, updateBookingInStore]);

  const handleDecline = useCallback(async () => {
    Alert.alert(
      'Decline Booking',
      'Are you sure you want to decline this booking? The customer will be notified.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setDeclining(true);
            try {
              await (businessAPI.updateBookingStatus as any)(id, 'cancelled', 'Declined by business');
              setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
              updateBookingInStore(id, { status: 'cancelled' });
              Toast.show({ type: 'success', text1: 'Booking declined' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to decline', text2: err?.message });
            } finally {
              setDeclining(false);
            }
          },
        },
      ]
    );
  }, [id, updateBookingInStore]);

  const handleComplete = useCallback(async () => {
    Alert.alert('Mark Complete', 'Mark this booking as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          setCompleting(true);
          try {
            await businessAPI.updateBookingStatus(id, 'completed');
            setBooking((prev) => (prev ? { ...prev, status: 'completed' } : prev));
            updateBookingInStore(id, { status: 'completed' });
            Toast.show({ type: 'success', text1: 'Booking marked as completed' });
          } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Failed to complete', text2: err?.message });
          } finally {
            setCompleting(false);
          }
        },
      },
    ]);
  }, [id, updateBookingInStore]);

  const handleCancelWithRefund = useCallback(async () => {
    Alert.alert(
      'Cancel with Refund',
      'Cancel this booking and initiate a refund? This cannot be undone.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel & Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingAPI.cancelBooking(id, 'Cancelled by business');
              setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
              updateBookingInStore(id, { status: 'cancelled' });
              Toast.show({ type: 'success', text1: 'Booking cancelled and refund initiated' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to cancel', text2: err?.message });
            }
          },
        },
      ]
    );
  }, [id, updateBookingInStore]);

  const handleGenerateInvoice = useCallback(async () => {
    setGeneratingInvoice(true);
    try {
      await invoiceAPI.generateInvoice(id);
      Toast.show({ type: 'success', text1: 'Invoice generated', text2: 'Sent to customer email' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to generate invoice', text2: err?.message });
    } finally {
      setGeneratingInvoice(false);
    }
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <LoadingSpinner fullScreen message="Loading booking..." />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.notFoundText}>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const activityName =
    booking.activityName || booking.activity?.title || booking.activity?.name || 'Activity';
  const customerName =
    booking.customerName ||
    [booking.customer?.firstName, booking.customer?.lastName].filter(Boolean).join(' ') ||
    booking.customer?.name ||
    'Customer';
  const amount = booking.totalAmount || booking.payment?.total || 0;
  const dateStr = booking.date || booking.bookingDate || '';
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '-';
  const totalParticipants =
    (booking.participants?.adults || 0) + (booking.participants?.children || 0);
  const timeSlotStr =
    booking.timeSlot?.label ||
    (booking.timeSlot?.startTime && booking.timeSlot?.endTime
      ? `${booking.timeSlot.startTime} - ${booking.timeSlot.endTime}`
      : '');

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        {/* Booking Reference & Status */}
        <Card style={styles.refCard}>
          <Text style={styles.refLabel}>Booking Reference</Text>
          <Text style={styles.refValue}>
            {booking.bookingReference || `#${booking._id?.slice(-8)}`}
          </Text>
          <View style={styles.statusRow}>
            <StatusBadge status={booking.status} />
            {booking.isInstantBooking && (
              <View style={styles.instantBadge}>
                <Ionicons name="flash" size={12} color={colors.primary[500]} />
                <Text style={styles.instantText}>Instant</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Customer Info */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Customer Information</Text>
          <InfoRow icon="person-outline" label="Name" value={customerName} />
          <InfoRow icon="mail-outline" label="Email" value={booking.customer?.email || '-'} />
          <InfoRow icon="call-outline" label="Phone" value={booking.customer?.phone || '-'} />
          <InfoRow
            icon="people-outline"
            label="Participants"
            value={`${booking.participants?.adults || 0} adults, ${booking.participants?.children || 0} children`}
          />
        </Card>

        {/* Activity Info */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Activity Details</Text>
          <InfoRow icon="compass-outline" label="Activity" value={activityName} />
          <InfoRow icon="calendar-outline" label="Date" value={formattedDate} />
          {timeSlotStr ? <InfoRow icon="time-outline" label="Time Slot" value={timeSlotStr} /> : null}
          {booking.variant ? (
            <InfoRow
              icon="diamond-outline"
              label="Variant"
              value={booking.variant.name || booking.variant.tier || '-'}
            />
          ) : null}
        </Card>

        {/* Pricing Breakdown */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Pricing Breakdown</Text>
          {booking.payment?.basePrice != null && (
            <PriceRow label="Base Price" amount={booking.payment.basePrice} />
          )}
          {booking.payment?.variantModifier != null && booking.payment.variantModifier > 0 && (
            <PriceRow label="Variant Modifier" amount={booking.payment.variantModifier} />
          )}
          {booking.payment?.bulkDiscount != null && booking.payment.bulkDiscount > 0 && (
            <PriceRow label="Bulk Discount" amount={booking.payment.bulkDiscount} discount />
          )}
          {booking.payment?.seasonalPricing != null && booking.payment.seasonalPricing !== 0 && (
            <PriceRow label="Seasonal Pricing" amount={booking.payment.seasonalPricing} />
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              {'\u20B9'}{amount.toLocaleString('en-IN')}
            </Text>
          </View>
        </Card>

        {/* Participant Details */}
        {booking.participantDetails &&
          ((booking.participantDetails.adults?.length || 0) > 0 ||
            (booking.participantDetails.children?.length || 0) > 0) && (
            <Card style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Participant Details</Text>
              {booking.participantDetails.adults?.map((p, i) => (
                <View key={`adult-${i}`} style={styles.participantItem}>
                  <View style={styles.participantHeader}>
                    <Text style={styles.participantName}>
                      {p.firstName} {p.lastName}
                    </Text>
                    <View style={styles.adultBadge}>
                      <Text style={styles.adultBadgeText}>Adult</Text>
                    </View>
                  </View>
                  {p.email && <Text style={styles.participantDetail}>{p.email}</Text>}
                  {p.dietaryRestrictions && p.dietaryRestrictions.length > 0 && (
                    <Text style={styles.participantDetail}>
                      Diet: {p.dietaryRestrictions.join(', ')}
                    </Text>
                  )}
                </View>
              ))}
              {booking.participantDetails.children?.map((p, i) => (
                <View key={`child-${i}`} style={styles.participantItem}>
                  <View style={styles.participantHeader}>
                    <Text style={styles.participantName}>
                      {p.firstName} {p.lastName}
                    </Text>
                    <View style={styles.childBadge}>
                      <Text style={styles.childBadgeText}>Child ({p.age}y)</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          )}

        {/* Pre-booking Answers */}
        {booking.preBookingAnswers && booking.preBookingAnswers.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Pre-booking Answers</Text>
            {booking.preBookingAnswers.map((qa, i) => (
              <View key={i} style={styles.qaItem}>
                <Text style={styles.qaQuestion}>{qa.question || `Question ${i + 1}`}</Text>
                <Text style={styles.qaAnswer}>
                  {Array.isArray(qa.answer) ? qa.answer.join(', ') : String(qa.answer || '-')}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {booking.status === 'pending' && (
            <>
              <Button
                title="Confirm Booking"
                onPress={handleConfirm}
                size="lg"
                fullWidth
                loading={confirming}
                disabled={declining}
                icon={<Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />}
              />
              <Button
                title="Decline"
                onPress={handleDecline}
                variant="danger"
                size="lg"
                fullWidth
                loading={declining}
                disabled={confirming}
                style={styles.actionSpacing}
                icon={<Ionicons name="close-circle-outline" size={20} color="#ffffff" />}
              />
            </>
          )}

          {booking.status === 'confirmed' && (
            <>
              <Button
                title="Mark Complete"
                onPress={handleComplete}
                size="lg"
                fullWidth
                loading={completing}
                icon={<Ionicons name="flag-outline" size={20} color="#ffffff" />}
              />
              <Button
                title="Cancel with Refund"
                onPress={handleCancelWithRefund}
                variant="outline"
                size="lg"
                fullWidth
                style={styles.actionSpacing}
                icon={<Ionicons name="return-down-back-outline" size={20} color={colors.primary[500]} />}
              />
            </>
          )}

          {booking.status === 'completed' && (
            <Button
              title="Generate Invoice"
              onPress={handleGenerateInvoice}
              size="lg"
              fullWidth
              loading={generatingInvoice}
              variant="outline"
              icon={<Ionicons name="document-text-outline" size={20} color={colors.primary[500]} />}
            />
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: spacing.xl,
  },

  // Ref Card
  refCard: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  refLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  refValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
    marginTop: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  instantText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },

  // Section Card
  sectionCard: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRowText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  priceAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  priceDiscount: {
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  totalAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },

  // Participants
  participantItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  participantDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adultBadge: {
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  adultBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.info,
  },
  childBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  childBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
  },

  // QA
  qaItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  qaQuestion: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  qaAnswer: {
    fontSize: fontSize.md,
    color: colors.text,
    marginTop: spacing.xs,
  },

  // Actions
  actionsSection: {
    marginTop: spacing.xl,
  },
  actionSpacing: {
    marginTop: spacing.md,
  },

  // Not found
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
