import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  EmptyState,
  StatusBadge,
  StarRating,
  TextInput,
  Button,
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
  };
  duration?: string;
}

interface Booking {
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
  review?: {
    rating: number;
    title: string;
    body: string;
  };
  contactInfo?: {
    name: string;
    email: string;
    phone: string;
  };
  createdAt: string;
}

// ===== Constants =====

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

type TabKey = typeof STATUS_TABS[number]['key'];

const GRADIENT_PLACEHOLDERS = [
  ['#06B6D4', '#2dd4bf'] as const,
  ['#3b82f6', '#60a5fa'] as const,
  ['#22c55e', '#4ade80'] as const,
  ['#a855f7', '#c084fc'] as const,
  ['#ef4444', '#f87171'] as const,
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ===== Helper Functions =====

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(time: string): string {
  if (!time) return '';
  // Handle HH:MM or HH:MM:SS format
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

function getGradientForIndex(index: number): readonly [string, string] {
  return GRADIENT_PLACEHOLDERS[index % GRADIENT_PLACEHOLDERS.length];
}

function filterBookings(bookings: Booking[], tab: TabKey): Booking[] {
  switch (tab) {
    case 'all':
      return bookings;
    case 'upcoming': {
      const now = new Date();
      return bookings.filter(
        (b) =>
          (b.status === 'pending' || b.status === 'confirmed') &&
          new Date(b.bookingDate) >= now
      );
    }
    case 'confirmed':
      return bookings.filter((b) => b.status === 'confirmed');
    case 'completed':
      return bookings.filter((b) => b.status === 'completed');
    case 'cancelled':
      return bookings.filter(
        (b) => b.status === 'cancelled' || b.status === 'refunded'
      );
    default:
      return bookings;
  }
}

// ===== Skeleton Card Component =====

function SkeletonCard() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Card style={styles.bookingCard}>
      <View style={styles.cardBody}>
        <Animated.View
          style={[styles.skeletonImage, { opacity }]}
        />
        <View style={styles.cardContent}>
          <Animated.View
            style={[styles.skeletonLine, { width: '70%', opacity }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '50%', marginTop: 8, opacity }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '60%', marginTop: 8, opacity }]}
          />
          <Animated.View
            style={[styles.skeletonLine, { width: '40%', marginTop: 8, opacity }]}
          />
        </View>
      </View>
    </Card>
  );
}

// ===== Main Component =====

export default function MyBookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // ===== Data Fetching =====

  const fetchBookings = useCallback(async () => {
    try {
      const response = await bookingAPI.getMyBookings();
      if (response?.data) {
        // Sort by date, most recent first
        const sorted = [...response.data].sort(
          (a: Booking, b: Booking) =>
            new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
        );
        setBookings(sorted);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load bookings',
        text2: error?.message || 'Please try again later',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  // ===== Cancel Booking =====

  const handleCancelPress = useCallback((bookingId: string, reference: string) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${reference}? This action may be subject to cancellation policies.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              await bookingAPI.cancelBooking(bookingId);
              Toast.show({
                type: 'success',
                text1: 'Booking Cancelled',
                text2: 'Your booking has been cancelled successfully',
                visibilityTime: 3000,
              });
              fetchBookings();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Cancellation Failed',
                text2: error?.message || 'Please try again',
                visibilityTime: 3000,
              });
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  }, [fetchBookings]);

  // ===== Review Modal =====

  const openReviewModal = useCallback((bookingId: string) => {
    setReviewBookingId(bookingId);
    setReviewRating(0);
    setReviewTitle('');
    setReviewBody('');
    setReviewModalVisible(true);
  }, []);

  const closeReviewModal = useCallback(() => {
    setReviewModalVisible(false);
    setReviewBookingId(null);
    setReviewRating(0);
    setReviewTitle('');
    setReviewBody('');
  }, []);

  const submitReview = useCallback(async () => {
    if (!reviewBookingId) return;

    if (reviewRating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Rating Required',
        text2: 'Please select a star rating',
        visibilityTime: 2000,
      });
      return;
    }

    if (!reviewTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Title Required',
        text2: 'Please enter a review title',
        visibilityTime: 2000,
      });
      return;
    }

    setIsSubmittingReview(true);
    try {
      await bookingAPI.submitReview(reviewBookingId, {
        rating: reviewRating,
        title: reviewTitle.trim(),
        body: reviewBody.trim(),
      });

      Toast.show({
        type: 'success',
        text1: 'Review Submitted',
        text2: 'Thank you for your feedback!',
        visibilityTime: 3000,
      });

      closeReviewModal();
      fetchBookings();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to Submit Review',
        text2: error?.message || 'Please try again',
        visibilityTime: 3000,
      });
    } finally {
      setIsSubmittingReview(false);
    }
  }, [reviewBookingId, reviewRating, reviewTitle, reviewBody, closeReviewModal, fetchBookings]);

  // ===== Filtered Data =====

  const filteredBookings = filterBookings(bookings, activeTab);

  // ===== Render Functions =====

  const renderStatusTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContainer}
      style={styles.tabsScrollView}
    >
      {STATUS_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count =
          tab.key === 'all'
            ? bookings.length
            : filterBookings(bookings, tab.key).length;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              isActive && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                isActive && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  isActive && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    isActive && styles.tabBadgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderBookingCard = ({ item, index }: { item: Booking; index: number }) => {
    const activity = item.activity;
    const hasImage = activity?.images && activity.images.length > 0;
    const isCancelling = cancellingId === item._id;
    const canCancel = item.status === 'pending' || item.status === 'confirmed';
    const canReview = item.status === 'completed' && !item.review;

    const participantParts: string[] = [];
    if (item.participants?.adults > 0) {
      participantParts.push(
        `${item.participants.adults} Adult${item.participants.adults > 1 ? 's' : ''}`
      );
    }
    if (item.participants?.children > 0) {
      participantParts.push(
        `${item.participants.children} Child${item.participants.children > 1 ? 'ren' : ''}`
      );
    }
    const participantText = participantParts.join(', ') || 'No participants';

    const timeText =
      item.timeSlot?.startTime && item.timeSlot?.endTime
        ? `${formatTime(item.timeSlot.startTime)} - ${formatTime(item.timeSlot.endTime)}`
        : item.timeSlot?.label || '';

    const totalAmount = item.pricing?.total || item.totalAmount || 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/bookings/${item._id}` as any)}
      >
        <Card style={styles.bookingCard}>
          {/* Status Badge - absolute positioned */}
          <View style={styles.statusBadgeContainer}>
            <StatusBadge status={item.status} />
          </View>

          {/* Card Body */}
          <View style={styles.cardBody}>
            {/* Activity Image */}
            {hasImage ? (
              <Image
                source={{ uri: activity.images![0] }}
                style={styles.activityImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={getGradientForIndex(index) as unknown as string[]}
                style={styles.activityImage}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            )}

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {activity?.title || 'Activity'}
              </Text>

              <Text style={styles.bookingRef} numberOfLines={1}>
                {item.bookingReference}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={colors.textTertiary}
                />
                <Text style={styles.infoText}>
                  {formatDate(item.bookingDate)}
                  {timeText ? ` \u2022 ${timeText}` : ''}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="people-outline"
                  size={13}
                  color={colors.textTertiary}
                />
                <Text style={styles.infoText}>{participantText}</Text>
              </View>

              <Text style={styles.priceText}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {(canReview || canCancel) && (
            <View style={styles.cardActions}>
              <View style={styles.actionsDivider} />
              <View style={styles.actionsRow}>
                {canReview && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openReviewModal(item._id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="star-outline"
                      size={16}
                      color={colors.primary[500]}
                    />
                    <Text style={styles.actionButtonTextPrimary}>
                      Write Review
                    </Text>
                  </TouchableOpacity>
                )}
                {canCancel && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() =>
                      handleCancelPress(item._id, item.bookingReference)
                    }
                    disabled={isCancelling}
                    activeOpacity={0.7}
                  >
                    {isCancelling ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <>
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color={colors.error}
                        />
                        <Text style={styles.actionButtonTextDanger}>
                          Cancel Booking
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    const isFiltered = activeTab !== 'all';
    return (
      <EmptyState
        icon={
          <View style={styles.emptyIcon}>
            <Ionicons
              name={isFiltered ? 'filter-outline' : 'receipt-outline'}
              size={48}
              color={colors.textTertiary}
            />
          </View>
        }
        title={
          isFiltered
            ? `No ${STATUS_TABS.find((t) => t.key === activeTab)?.label?.toLowerCase()} bookings`
            : 'No bookings yet'
        }
        description={
          isFiltered
            ? 'Try selecting a different status filter'
            : 'Explore activities and book your next adventure!'
        }
        actionLabel={isFiltered ? undefined : 'Explore Activities'}
        onAction={isFiltered ? undefined : () => router.push('/(tabs)/explore' as any)}
      />
    );
  };

  const renderSkeletonList = () => (
    <View style={styles.skeletonContainer}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );

  // ===== Review Modal =====

  const renderReviewModal = () => (
    <Modal
      visible={reviewModalVisible}
      animationType="slide"
      transparent
      onRequestClose={closeReviewModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Write a Review</Text>
            <TouchableOpacity
              onPress={closeReviewModal}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Star Rating */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Your Rating</Text>
              <View style={styles.ratingStars}>
                <StarRating
                  rating={reviewRating}
                  size={36}
                  interactive
                  onRatingChange={setReviewRating}
                  color={colors.primary[500]}
                />
              </View>
              {reviewRating > 0 && (
                <Text style={styles.ratingHint}>
                  {reviewRating === 1
                    ? 'Poor'
                    : reviewRating === 2
                    ? 'Fair'
                    : reviewRating === 3
                    ? 'Good'
                    : reviewRating === 4
                    ? 'Very Good'
                    : 'Excellent'}
                </Text>
              )}
            </View>

            {/* Review Title */}
            <TextInput
              label="Review Title"
              placeholder="Summarize your experience"
              value={reviewTitle}
              onChangeText={setReviewTitle}
              maxLength={100}
            />

            {/* Review Body */}
            <TextInput
              label="Your Review"
              placeholder="Tell others about your experience..."
              value={reviewBody}
              onChangeText={setReviewBody}
              multiline
              numberOfLines={4}
              style={styles.reviewBodyInput}
              maxLength={1000}
            />

            {reviewBody.length > 0 && (
              <Text style={styles.charCount}>
                {reviewBody.length}/1000
              </Text>
            )}
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.modalFooter}>
            <Button
              title="Submit Review"
              onPress={submitReview}
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmittingReview}
              disabled={reviewRating === 0 || !reviewTitle.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

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
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Status Tabs */}
      {!isLoading && bookings.length > 0 && renderStatusTabs()}

      {/* Content */}
      {isLoading ? (
        renderSkeletonList()
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={[
            styles.listContent,
            filteredBookings.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
              colors={[colors.primary[500]]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        />
      )}

      {/* Review Modal */}
      {renderReviewModal()}
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

  // Status Tabs
  tabsScrollView: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primary[500],
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  tabBadge: {
    marginLeft: spacing.xs,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.textInverse,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  listContentEmpty: {
    flex: 1,
  },
  listSeparator: {
    height: spacing.md,
  },

  // Booking Card
  bookingCard: {
    overflow: 'hidden',
  },
  statusBadgeContainer: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  cardBody: {
    flexDirection: 'row',
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
    paddingRight: spacing['2xl'],
  },
  activityTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  bookingRef: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  infoText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  priceText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },

  // Card Actions
  cardActions: {
    marginTop: spacing.md,
  },
  actionsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionButtonTextPrimary: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
    marginLeft: spacing.xs,
  },
  actionButtonTextDanger: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.error,
    marginLeft: spacing.xs,
  },

  // Empty State
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Skeleton
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  skeletonImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[200],
  },
  skeletonLine: {
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[200],
  },

  // Review Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  modalBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ratingLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  ratingStars: {
    marginBottom: spacing.sm,
  },
  ratingHint: {
    fontSize: fontSize.sm,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  reviewBodyInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  modalFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
