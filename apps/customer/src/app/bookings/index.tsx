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
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  useTheme,
} from '@prayana/shared-ui';
import { bookingAPI, esimAPI, holidayPackagesAPI } from '@prayana/shared-services';
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

/**
 * eSIM order shape — the slice of server/models/EsimOrder.js this list renders.
 * getMyOrders returns { data: { orders, pagination } }.
 */
interface EsimOrder {
  _id: string;
  orderReference: string;
  status:
    | 'pending_payment'
    | 'pending_kyc'
    | 'pending_validation'
    | 'processing'
    | 'active'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'refunded';
  bundle?: {
    name?: string;
    country?: string;
    countryName?: string;
    dataAmountMB?: number;
    isUnlimited?: boolean;
    durationDays?: number;
  };
  pricing?: { totalPrice?: number };
  createdAt: string;
}

/** Holiday-package booking — mirrors web my-bookings' package card fields. */
interface PackageBooking {
  _id: string;
  bookingReference?: string;
  status: string;
  package?: { title?: string; images?: string[]; destination?: string };
  packageSnapshot?: { title?: string; coverImage?: string; destination?: string };
  travelDate?: string;
  travellers?: { adults?: number; children?: number };
  pricing?: { total?: number };
  totalAmount?: number;
  createdAt: string;
}

// ===== Constants =====

// Top-level product pills, same trio and order as the web my-bookings page:
// a turf booking must not surface under Holiday Packages, and eSIMs are their
// own section so the three never mix.
const CATEGORIES = [
  { key: 'esim', label: 'eSIMs' },
  { key: 'activities', label: 'Activities' },
  { key: 'packages', label: 'Packages' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

// eSIM orders use their own status vocabulary; fold them into the shared
// filter buckets so the same tabs work for both (copied from web).
const ESIM_STATUS_BUCKET: Record<EsimOrder['status'], TabKey> = {
  pending_payment: 'upcoming',
  pending_kyc: 'upcoming',
  pending_validation: 'upcoming',
  processing: 'upcoming',
  active: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  failed: 'cancelled',
  refunded: 'cancelled',
};

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

function filterEsimOrders(orders: EsimOrder[], tab: TabKey): EsimOrder[] {
  if (tab === 'all') return orders;
  return orders.filter((o) => ESIM_STATUS_BUCKET[o.status] === tab);
}

function filterPackageBookings(items: PackageBooking[], tab: TabKey): PackageBooking[] {
  switch (tab) {
    case 'all':
      return items;
    case 'upcoming':
      return items.filter(
        (b) =>
          (b.status === 'pending' || b.status === 'confirmed') &&
          (!b.travelDate || new Date(b.travelDate) >= new Date())
      );
    case 'confirmed':
      return items.filter((b) => b.status === 'confirmed');
    case 'completed':
      return items.filter((b) => b.status === 'completed');
    case 'cancelled':
      return items.filter((b) => b.status === 'cancelled' || b.status === 'refunded');
    default:
      return items;
  }
}

/** "1.5 GB" / "500 MB" from a megabyte count. */
function formatDataAmount(mb?: number): string {
  if (mb == null) return '';
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

/** Country code → flag emoji, same trick the web uses. */
function countryToFlag(code?: string): string {
  if (!code || code.length !== 2) return '🌐';
  const base = 127397;
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => base + c.charCodeAt(0))
  );
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
  const params = useLocalSearchParams<{ reviewBookingId?: string }>();
  const { user } = useAuth();
  const { themeColors, isDarkMode } = useTheme();

  // State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  // Top-level category, activities first — same default as the web.
  const [category, setCategory] = useState<CategoryKey>('activities');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // eSIM orders + package bookings load lazily the first time their pill is
  // opened (mirrors web my-bookings lines 239/252).
  const [esimOrders, setEsimOrders] = useState<EsimOrder[]>([]);
  const [esimLoading, setEsimLoading] = useState(false);
  const [esimLoaded, setEsimLoaded] = useState(false);
  const [packageBookings, setPackageBookings] = useState<PackageBooking[]>([]);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageLoaded, setPackageLoaded] = useState(false);

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // ===== Data Fetching =====

  const fetchBookings = useCallback(async () => {
    // Skip the API call for guests — they have no bookings.
    if (!user?.uid || user.uid === 'guest-user') {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
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

  const isGuest = !user?.uid || user.uid === 'guest-user';

  // Fetch eSIM orders the first time the eSIM pill is opened.
  const fetchEsimOrders = useCallback(async () => {
    if (isGuest) return;
    setEsimLoading(true);
    try {
      const res = await esimAPI.getMyOrders();
      // getMyOrders returns { data: { orders, pagination } }
      const list = res?.data?.orders ?? res?.data ?? [];
      setEsimOrders(Array.isArray(list) ? list : []);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load eSIM orders',
        text2: error?.message || 'Please try again later',
        visibilityTime: 3000,
      });
    } finally {
      setEsimLoading(false);
      setEsimLoaded(true);
    }
  }, [isGuest]);

  useEffect(() => {
    if (category === 'esim' && !esimLoaded) fetchEsimOrders();
  }, [category, esimLoaded, fetchEsimOrders]);

  // Fetch holiday-package bookings the first time that pill is opened.
  const fetchPackageBookings = useCallback(async () => {
    if (isGuest) return;
    setPackageLoading(true);
    try {
      const res = await holidayPackagesAPI.getMyBookings();
      const list = res?.data ?? [];
      setPackageBookings(Array.isArray(list) ? list : []);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load package bookings',
        text2: error?.message || 'Please try again later',
        visibilityTime: 3000,
      });
    } finally {
      setPackageLoading(false);
      setPackageLoaded(true);
    }
  }, [isGuest]);

  useEffect(() => {
    if (category === 'packages' && !packageLoaded) fetchPackageBookings();
  }, [category, packageLoaded, fetchPackageBookings]);

  // Deep-link: ?reviewBookingId=xxx auto-opens the review modal.
  // Used by booking detail's "Write Review" button.
  useEffect(() => {
    if (params.reviewBookingId) {
      setReviewBookingId(params.reviewBookingId);
      setReviewRating(0);
      setReviewTitle('');
      setReviewBody('');
      setReviewModalVisible(true);
    }
  }, [params.reviewBookingId]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBookings();
    // Also refresh whichever secondary list the user is looking at.
    if (category === 'esim' && esimLoaded) fetchEsimOrders();
    if (category === 'packages' && packageLoaded) fetchPackageBookings();
  }, [fetchBookings, category, esimLoaded, packageLoaded, fetchEsimOrders, fetchPackageBookings]);

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
  const filteredEsimOrders = filterEsimOrders(esimOrders, activeTab);
  const filteredPackageBookings = filterPackageBookings(packageBookings, activeTab);

  // ===== Render Functions =====

  const renderCategoryPills = () => (
    <View style={[styles.categoryRow, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      {CATEGORIES.map((cat) => {
        const isActive = category === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setCategory(cat.key)}
            activeOpacity={0.7}
            style={[
              styles.categoryPill,
              { backgroundColor: isDarkMode ? themeColors.surfaceElevated : colors.gray[100] },
              isActive && styles.categoryPillActive,
            ]}
          >
            <Text
              style={[
                styles.categoryPillText,
                { color: themeColors.textSecondary },
                isActive && styles.categoryPillTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderStatusTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContainer}
      style={[styles.tabsScrollView, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
    >
      {STATUS_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        // Count within the ACTIVE category, so the badges match the list below.
        const count =
          category === 'esim'
            ? filterEsimOrders(esimOrders, tab.key).length
            : category === 'packages'
            ? filterPackageBookings(packageBookings, tab.key).length
            : filterBookings(bookings, tab.key).length;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              !isActive && { backgroundColor: isDarkMode ? themeColors.surfaceElevated : undefined },
              isActive && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                !isActive && { color: themeColors.textSecondary },
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
                colors={getGradientForIndex(index) as any}
                style={styles.activityImage}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            )}

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={[styles.activityTitle, { color: themeColors.text }]} numberOfLines={1}>
                {activity?.title || 'Activity'}
              </Text>

              <Text style={[styles.bookingRef, { color: themeColors.textTertiary }]} numberOfLines={1}>
                {item.bookingReference}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={themeColors.textTertiary}
                />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  {formatDate(item.bookingDate)}
                  {timeText ? ` \u2022 ${timeText}` : ''}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="people-outline"
                  size={13}
                  color={themeColors.textTertiary}
                />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{participantText}</Text>
              </View>

              <Text style={[styles.priceText, { color: themeColors.text }]}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {(canReview || canCancel) && (
            <View style={styles.cardActions}>
              <View style={[styles.actionsDivider, { backgroundColor: themeColors.border }]} />
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

  // eSIM order card — flag + destination + status, data/validity chips, price.
  // Tapping opens /esim/order/[orderId], same as the web card links to.
  const renderEsimCard = ({ item }: { item: EsimOrder }) => {
    const destination =
      item.bundle?.countryName || item.bundle?.name || item.bundle?.country || 'eSIM';
    const dataText = item.bundle?.isUnlimited
      ? 'Unlimited'
      : formatDataAmount(item.bundle?.dataAmountMB);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/esim/order/${item._id}` as any)}
      >
        <Card style={styles.bookingCard}>
          <View style={styles.statusBadgeContainer}>
            <StatusBadge status={item.status} />
          </View>
          <View style={styles.cardBody}>
            <View style={[styles.esimFlagBox, { backgroundColor: isDarkMode ? themeColors.surfaceElevated : colors.gray[100] }]}>
              <Text style={styles.esimFlag}>{countryToFlag(item.bundle?.country)}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.activityTitle, { color: themeColors.text }]} numberOfLines={1}>
                {destination}
              </Text>
              <Text style={[styles.bookingRef, { color: themeColors.textTertiary }]} numberOfLines={1}>
                {item.orderReference}
              </Text>
              <View style={styles.infoRow}>
                <Ionicons name="cellular-outline" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  {dataText}
                  {item.bundle?.durationDays != null ? ` • ${item.bundle.durationDays} days` : ''}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  Ordered {formatDate(item.createdAt)}
                </Text>
              </View>
              {item.pricing?.totalPrice != null && (
                <Text style={[styles.priceText, { color: themeColors.text }]}>
                  {formatCurrency(item.pricing.totalPrice)}
                </Text>
              )}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  // Holiday-package booking card. Detail route doesn't exist on mobile yet, so
  // the card is informational (no navigation) — same fields the web card shows.
  const renderPackageCard = ({ item, index }: { item: PackageBooking; index: number }) => {
    const title = item.package?.title || item.packageSnapshot?.title || 'Holiday Package';
    const image = item.package?.images?.[0] || item.packageSnapshot?.coverImage;
    const destination = item.package?.destination || item.packageSnapshot?.destination;
    const travellerParts: string[] = [];
    if (item.travellers?.adults) travellerParts.push(`${item.travellers.adults} Adult${item.travellers.adults > 1 ? 's' : ''}`);
    if (item.travellers?.children) travellerParts.push(`${item.travellers.children} Child${item.travellers.children > 1 ? 'ren' : ''}`);
    const total = item.pricing?.total ?? item.totalAmount ?? 0;
    return (
      <Card style={styles.bookingCard}>
        <View style={styles.statusBadgeContainer}>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.cardBody}>
          {image ? (
            <Image source={{ uri: image }} style={styles.activityImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={getGradientForIndex(index) as any}
              style={styles.activityImage}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="airplane-outline" size={28} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          )}
          <View style={styles.cardContent}>
            <Text style={[styles.activityTitle, { color: themeColors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {!!item.bookingReference && (
              <Text style={[styles.bookingRef, { color: themeColors.textTertiary }]} numberOfLines={1}>
                {item.bookingReference}
              </Text>
            )}
            {!!destination && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{destination}</Text>
              </View>
            )}
            {!!item.travelDate && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  {formatDate(item.travelDate)}
                </Text>
              </View>
            )}
            {travellerParts.length > 0 && (
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
                  {travellerParts.join(', ')}
                </Text>
              </View>
            )}
            {total > 0 && (
              <Text style={[styles.priceText, { color: themeColors.text }]}>
                {formatCurrency(total)}
              </Text>
            )}
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    const isGuestUser = !user?.uid || user.uid === 'guest-user';
    if (isGuestUser) {
      return (
        <EmptyState
          icon={
            <View style={[styles.emptyIcon, { backgroundColor: themeColors.surfaceElevated }]}>
              <Ionicons name="lock-closed-outline" size={48} color={themeColors.textTertiary} />
            </View>
          }
          title="Sign in to see your bookings"
          description="Receipts, refunds, and reviews are tied to your account."
          actionLabel="Sign in"
          onAction={() =>
            router.push({ pathname: '/(auth)/login', params: { redirectTo: '/bookings' } } as any)
          }
        />
      );
    }

    const isFiltered = activeTab !== 'all';
    // Category-specific empty copy + CTA, matching the web's per-section states.
    const emptyMeta: Record<CategoryKey, { icon: any; title: string; description: string; actionLabel?: string; onAction?: () => void }> = {
      esim: {
        icon: 'cellular-outline',
        title: 'No eSIMs yet',
        description: 'Stay connected abroad — grab a travel eSIM in minutes.',
        actionLabel: 'Browse eSIM plans',
        onAction: () => router.push('/esim' as any),
      },
      activities: {
        icon: 'receipt-outline',
        title: 'No bookings yet',
        description: 'Explore activities and book your next adventure!',
        actionLabel: 'Explore Activities',
        onAction: () => router.push('/(tabs)/explore' as any),
      },
      packages: {
        icon: 'airplane-outline',
        title: 'No package bookings yet',
        description: 'Browse curated holiday packages for your next trip.',
        actionLabel: 'Browse Packages',
        onAction: () => router.push('/packages' as any),
      },
    };
    const meta = emptyMeta[category];
    return (
      <EmptyState
        icon={
          <View style={[styles.emptyIcon, { backgroundColor: themeColors.surfaceElevated }]}>
            <Ionicons
              name={isFiltered ? 'filter-outline' : meta.icon}
              size={48}
              color={themeColors.textTertiary}
            />
          </View>
        }
        title={
          isFiltered
            ? `No ${STATUS_TABS.find((t) => t.key === activeTab)?.label?.toLowerCase()} ${category === 'esim' ? 'eSIMs' : 'bookings'}`
            : meta.title
        }
        description={
          isFiltered ? 'Try selecting a different status filter' : meta.description
        }
        actionLabel={isFiltered ? undefined : meta.actionLabel}
        onAction={isFiltered ? undefined : meta.onAction}
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
        <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Write a Review</Text>
            <TouchableOpacity
              onPress={closeReviewModal}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Star Rating */}
            <View style={styles.ratingSection}>
              <Text style={[styles.ratingLabel, { color: themeColors.text }]}>Your Rating</Text>
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
              <Text style={[styles.charCount, { color: themeColors.textTertiary }]}>
                {reviewBody.length}/1000
              </Text>
            )}
          </ScrollView>

          {/* Submit Button */}
          <View style={[styles.modalFooter, { borderTopColor: themeColors.border }]}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: themeColors.surfaceElevated }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>My Bookings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Category pills — eSIMs · Activities · Packages, like the web page */}
      {!isGuest && renderCategoryPills()}

      {/* Status Tabs */}
      {((category === 'activities' && !isLoading && bookings.length > 0) ||
        (category === 'esim' && esimLoaded && esimOrders.length > 0) ||
        (category === 'packages' && packageLoaded && packageBookings.length > 0)) &&
        renderStatusTabs()}

      {/* Content */}
      {category === 'activities' && isLoading ? (
        renderSkeletonList()
      ) : category === 'esim' && (esimLoading || !esimLoaded) && !isGuest ? (
        renderSkeletonList()
      ) : category === 'packages' && (packageLoading || !packageLoaded) && !isGuest ? (
        renderSkeletonList()
      ) : category === 'esim' ? (
        <FlatList
          data={filteredEsimOrders}
          keyExtractor={(item) => item._id}
          renderItem={renderEsimCard}
          contentContainerStyle={[
            styles.listContent,
            filteredEsimOrders.length === 0 && styles.listContentEmpty,
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
      ) : category === 'packages' ? (
        <FlatList
          data={filteredPackageBookings}
          keyExtractor={(item) => item._id}
          renderItem={renderPackageCard}
          contentContainerStyle={[
            styles.listContent,
            filteredPackageBookings.length === 0 && styles.listContentEmpty,
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

  // Category pills (eSIMs · Activities · Packages)
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  categoryPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  categoryPillActive: {
    backgroundColor: colors.primary[500],
  },
  categoryPillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  categoryPillTextActive: {
    color: colors.textInverse,
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
  // eSIM card — flag emoji stands in for the activity photo.
  esimFlagBox: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  esimFlag: {
    fontSize: 40,
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
