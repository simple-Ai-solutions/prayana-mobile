import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  Card,
  Badge,
  Button,
  StatusBadge,
} from '@prayana/shared-ui';
import { bookingAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

// ===== Types =====

interface BookingActivity {
  _id: string;
  title: string;
  images?: string[];
  location?: {
    city?: string;
    state?: string;
    address?: string;
  };
  duration?: string;
  description?: string;
}

interface BookingDetail {
  _id: string;
  bookingReference: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded' | 'no_show';
  activity: BookingActivity;
  bookingDate: string;
  timeSlot?: {
    startTime?: string;
    endTime?: string;
    label?: string;
  };
  participants: {
    adults: number;
    children: number;
  };
  pricing?: {
    total: number;
    subtotal?: number;
    discount?: number;
    tax?: number;
  };
  totalAmount: number;
  payment?: {
    status?: 'pending' | 'paid' | 'refunded' | 'failed';
    method?: string;
    transactionId?: string;
  };
  contactInfo?: {
    name: string;
    email: string;
    phone: string;
  };
  specialRequests?: string;
  review?: {
    rating: number;
    title: string;
    body: string;
  };
  variant?: {
    name?: string;
    tier?: string;
  };
  isInstantBooking?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Constants =====

interface StatusDisplayConfig {
  label: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  textColor: string;
  iconColor: string;
}

const STATUS_DISPLAY: Record<string, StatusDisplayConfig> = {
  pending: {
    label: 'Pending',
    description: 'Awaiting confirmation from the activity provider',
    iconName: 'time-outline',
    bgColor: colors.warningLight,
    textColor: '#a16207',
    iconColor: colors.warning,
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Your booking is confirmed. Get ready for your adventure!',
    iconName: 'checkmark-circle-outline',
    bgColor: colors.successLight,
    textColor: '#15803d',
    iconColor: colors.success,
  },
  completed: {
    label: 'Completed',
    description: 'This activity has been completed. We hope you enjoyed it!',
    iconName: 'ribbon-outline',
    bgColor: colors.infoLight,
    textColor: '#1d4ed8',
    iconColor: colors.info,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This booking has been cancelled',
    iconName: 'close-circle-outline',
    bgColor: colors.errorLight,
    textColor: '#b91c1c',
    iconColor: colors.error,
  },
  refunded: {
    label: 'Refunded',
    description: 'This booking has been refunded to your original payment method',
    iconName: 'arrow-undo-outline',
    bgColor: colors.gray[100],
    textColor: colors.gray[700],
    iconColor: colors.gray[500],
  },
  no_show: {
    label: 'No Show',
    description: 'You did not attend this activity',
    iconName: 'alert-circle-outline',
    bgColor: colors.errorLight,
    textColor: '#b91c1c',
    iconColor: colors.error,
  },
};

const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid: { bg: colors.successLight, text: '#15803d' },
  pending: { bg: colors.warningLight, text: '#a16207' },
  refunded: { bg: colors.gray[100], text: colors.gray[700] },
  failed: { bg: colors.errorLight, text: '#b91c1c' },
};

// ===== Helper Functions =====

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

// ===== Info Row Component =====

function InfoRow({
  icon,
  label,
  value,
  copyable = false,
  valueColor,
  valueBold = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  copyable?: boolean;
  valueColor?: string;
  valueBold?: boolean;
}) {
  const handleCopy = async () => {
    if (copyable) {
      await Clipboard.setStringAsync(value);
      Toast.show({
        type: 'success',
        text1: 'Copied!',
        text2: `${label} copied to clipboard`,
        visibilityTime: 1500,
      });
    }
  };

  return (
    <View style={infoRowStyles.container}>
      <View style={infoRowStyles.labelRow}>
        <Ionicons name={icon} size={16} color={colors.textTertiary} />
        <Text style={infoRowStyles.label}>{label}</Text>
      </View>
      <TouchableOpacity
        onPress={copyable ? handleCopy : undefined}
        disabled={!copyable}
        activeOpacity={copyable ? 0.6 : 1}
        style={infoRowStyles.valueRow}
      >
        <Text
          style={[
            infoRowStyles.value,
            valueColor ? { color: valueColor } : undefined,
            valueBold ? { fontWeight: fontWeight.bold } : undefined,
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
        {copyable && (
          <Ionicons
            name="copy-outline"
            size={14}
            color={colors.textTertiary}
            style={infoRowStyles.copyIcon}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  value: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    textAlign: 'right',
  },
  copyIcon: {
    marginLeft: spacing.xs,
  },
});

// ===== Main Component =====

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  // State
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // ===== Data Fetching =====

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    try {
      const response = await bookingAPI.getBookingById(id);
      if (response?.data) {
        setBooking(response.data);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load booking',
        text2: error?.message || 'Please try again',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBooking();
  }, [fetchBooking]);

  // ===== Cancel Booking =====

  const handleCancel = useCallback(() => {
    if (!booking) return;

    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${booking.bookingReference}? This action may be subject to cancellation policies.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await bookingAPI.cancelBooking(booking._id);
              Toast.show({
                type: 'success',
                text1: 'Booking Cancelled',
                text2: 'Your booking has been cancelled successfully',
                visibilityTime: 3000,
              });
              fetchBooking();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Cancellation Failed',
                text2: error?.message || 'Please try again',
                visibilityTime: 3000,
              });
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  }, [booking, fetchBooking]);

  // ===== Navigate to Write Review =====

  const handleWriteReview = useCallback(() => {
    // Navigate back to bookings list where the review modal lives
    // Alternatively, you could implement a review modal here too
    router.back();
  }, [router]);

  // ===== Loading State =====

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ===== Error State =====

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.errorText}>Booking not found</Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="outline"
            size="md"
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ===== Derived Values =====

  const activity = booking.activity;
  const hasImage = activity?.images && activity.images.length > 0;
  const statusDisplay = STATUS_DISPLAY[booking.status] || STATUS_DISPLAY.pending;
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  const canReview = booking.status === 'completed' && !booking.review;
  const totalAmount = booking.pricing?.total || booking.totalAmount || 0;
  const subtotal = booking.pricing?.subtotal || totalAmount;
  const discount = booking.pricing?.discount || 0;
  const tax = booking.pricing?.tax || 0;
  const paymentStatus = booking.payment?.status || 'pending';
  const paymentColors = PAYMENT_STATUS_COLORS[paymentStatus] || PAYMENT_STATUS_COLORS.pending;

  const participantParts: string[] = [];
  if (booking.participants?.adults > 0) {
    participantParts.push(
      `${booking.participants.adults} Adult${booking.participants.adults > 1 ? 's' : ''}`
    );
  }
  if (booking.participants?.children > 0) {
    participantParts.push(
      `${booking.participants.children} Child${booking.participants.children > 1 ? 'ren' : ''}`
    );
  }

  const timeText =
    booking.timeSlot?.startTime && booking.timeSlot?.endTime
      ? `${formatTime(booking.timeSlot.startTime)} - ${formatTime(booking.timeSlot.endTime)}`
      : booking.timeSlot?.label || 'Not specified';

  const locationText = [activity?.location?.city, activity?.location?.state]
    .filter(Boolean)
    .join(', ');

  // ===== Main Render =====

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusDisplay.bgColor }]}>
          <Ionicons
            name={statusDisplay.iconName}
            size={32}
            color={statusDisplay.iconColor}
          />
          <Text style={[styles.statusLabel, { color: statusDisplay.textColor }]}>
            {statusDisplay.label}
          </Text>
          <Text style={[styles.statusDescription, { color: statusDisplay.textColor }]}>
            {statusDisplay.description}
          </Text>
          {booking.isInstantBooking && booking.status === 'confirmed' && (
            <View style={styles.instantBadge}>
              <Ionicons name="flash" size={12} color={colors.primary[500]} />
              <Text style={styles.instantBadgeText}>Instant Booking</Text>
            </View>
          )}
        </View>

        {/* Activity Info Card */}
        <Card style={styles.sectionCard} padding="sm">
          {/* Activity Image */}
          {hasImage ? (
            <Image
              source={{ uri: activity.images![0] }}
              style={styles.activityImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#06B6D4', '#2dd4bf']}
              style={styles.activityImage}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          )}
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>{activity?.title || 'Activity'}</Text>
            {locationText ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.locationText}>{locationText}</Text>
              </View>
            ) : null}
            {activity?.duration ? (
              <View style={styles.locationRow}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.locationText}>{activity.duration}</Text>
              </View>
            ) : null}
            {booking.variant?.name ? (
              <Badge label={booking.variant.name} variant="primary" size="sm" style={{ marginTop: spacing.sm }} />
            ) : null}
          </View>
        </Card>

        {/* Booking Info Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          <View style={styles.divider} />

          <InfoRow
            icon="document-text-outline"
            label="Reference"
            value={booking.bookingReference}
            copyable
          />
          <View style={styles.infoSeparator} />

          <InfoRow
            icon="calendar-outline"
            label="Date"
            value={formatDate(booking.bookingDate)}
          />
          <View style={styles.infoSeparator} />

          <InfoRow
            icon="time-outline"
            label="Time"
            value={timeText}
          />
          <View style={styles.infoSeparator} />

          <InfoRow
            icon="people-outline"
            label="Participants"
            value={participantParts.join(', ') || 'Not specified'}
          />

          {booking.specialRequests ? (
            <>
              <View style={styles.infoSeparator} />
              <InfoRow
                icon="chatbubble-ellipses-outline"
                label="Special Requests"
                value={booking.specialRequests}
              />
            </>
          ) : null}
        </Card>

        {/* Pricing Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.divider} />

          {subtotal > 0 && subtotal !== totalAmount && (
            <>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Subtotal</Text>
                <Text style={styles.pricingValue}>{formatCurrency(subtotal)}</Text>
              </View>
            </>
          )}

          {discount > 0 && (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Discount</Text>
              <Text style={[styles.pricingValue, { color: colors.success }]}>
                -{formatCurrency(discount)}
              </Text>
            </View>
          )}

          {tax > 0 && (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Tax / GST</Text>
              <Text style={styles.pricingValue}>{formatCurrency(tax)}</Text>
            </View>
          )}

          <View style={[styles.divider, { marginTop: spacing.sm }]} />

          <View style={[styles.pricingRow, { paddingTop: spacing.md }]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          </View>

          {/* Payment Status */}
          <View style={styles.paymentStatusRow}>
            <Text style={styles.pricingLabel}>Payment Status</Text>
            <View style={[styles.paymentBadge, { backgroundColor: paymentColors.bg }]}>
              <Text style={[styles.paymentBadgeText, { color: paymentColors.text }]}>
                {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
              </Text>
            </View>
          </View>

          {booking.payment?.method && (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Payment Method</Text>
              <Text style={styles.pricingValue}>{booking.payment.method}</Text>
            </View>
          )}
        </Card>

        {/* Contact Info Card */}
        {booking.contactInfo && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.divider} />

            <InfoRow
              icon="person-outline"
              label="Name"
              value={booking.contactInfo.name}
            />
            <View style={styles.infoSeparator} />

            <InfoRow
              icon="mail-outline"
              label="Email"
              value={booking.contactInfo.email}
            />
            <View style={styles.infoSeparator} />

            <InfoRow
              icon="call-outline"
              label="Phone"
              value={booking.contactInfo.phone}
            />
          </Card>
        )}

        {/* Review Section (if completed and reviewed) */}
        {booking.review && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your Review</Text>
            <View style={styles.divider} />
            <View style={styles.reviewContent}>
              <View style={styles.reviewStarsRow}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Ionicons
                    key={i}
                    name={i < booking.review!.rating ? 'star' : 'star-outline'}
                    size={18}
                    color={i < booking.review!.rating ? colors.primary[500] : colors.gray[300]}
                    style={{ marginRight: 2 }}
                  />
                ))}
                <Text style={styles.reviewRatingText}>{booking.review.rating}/5</Text>
              </View>
              {booking.review.title ? (
                <Text style={styles.reviewTitle}>{booking.review.title}</Text>
              ) : null}
              {booking.review.body ? (
                <Text style={styles.reviewBody}>{booking.review.body}</Text>
              ) : null}
            </View>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {canCancel && (
            <Button
              title="Cancel Booking"
              onPress={handleCancel}
              variant="danger"
              size="lg"
              fullWidth
              loading={isCancelling}
              icon={
                !isCancelling ? (
                  <Ionicons name="close-circle-outline" size={20} color="#ffffff" />
                ) : undefined
              }
            />
          )}

          {canReview && (
            <Button
              title="Write a Review"
              onPress={handleWriteReview}
              variant="primary"
              size="lg"
              fullWidth
              icon={<Ionicons name="star-outline" size={20} color="#ffffff" />}
            />
          )}

          {/* Need Help */}
          <TouchableOpacity
            style={styles.helpButton}
            activeOpacity={0.7}
            onPress={() => {
              Toast.show({
                type: 'info',
                text1: 'Need Help?',
                text2: 'Contact us at support@prayana.ai',
                visibilityTime: 4000,
              });
            }}
          >
            <Ionicons
              name="help-circle-outline"
              size={18}
              color={colors.primary[500]}
            />
            <Text style={styles.helpButtonText}>Need Help?</Text>
          </TouchableOpacity>
        </View>

        {/* Booked On */}
        <Text style={styles.bookedOnText}>
          Booked on {formatShortDate(booking.createdAt)}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[50],
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },

  // Status Card
  statusCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusLabel: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  statusDescription: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
    opacity: 0.85,
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  instantBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
    marginLeft: spacing.xs,
  },

  // Section Card
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },

  // Activity Image
  activityImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  activityInfo: {
    padding: spacing.md,
  },
  activityTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  locationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
  },

  // Info rows separator
  infoSeparator: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },

  // Pricing
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pricingLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pricingValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  totalValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  paymentBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  paymentBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // Review
  reviewContent: {
    paddingTop: spacing.sm,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reviewRatingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  reviewTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  reviewBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Actions
  actionsSection: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  helpButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
    marginLeft: spacing.xs,
  },

  // Footer
  bookedOnText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
