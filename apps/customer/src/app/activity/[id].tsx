import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  Badge,
  Button,
  StarRating,
  LoadingSpinner,
  ErrorView,
  useTheme,
} from '@prayana/shared-ui';
import { activityMarketplaceAPI, makeAPICall } from '@prayana/shared-services';
import { useRequireAuth } from '../../lib/useRequireAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;
const DESCRIPTION_PREVIEW_LINES = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCancellationLabel(policy: string | undefined): { label: string; color: string; desc: string } {
  switch (policy) {
    case 'flexible':
      return {
        label: 'Flexible',
        color: colors.success,
        desc: 'Full refund up to 24 hours before the activity.',
      };
    case 'moderate':
      return {
        label: 'Moderate',
        color: colors.warning,
        desc: 'Full refund up to 7 days before. 50% refund up to 24 hours before.',
      };
    case 'strict':
      return {
        label: 'Strict',
        color: colors.error,
        desc: 'Full refund up to 14 days before. No refund within 7 days.',
      };
    default:
      return {
        label: 'Standard',
        color: colors.info,
        desc: 'Refer to the activity provider for cancellation terms.',
      };
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Horizontal paging image gallery with dots */
function ImageGallery({
  images,
  onOpenFullscreen,
}: {
  images: string[];
  onOpenFullscreen: (index: number) => void;
}) {
  const { themeColors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<FlatList>(null);

  const onScroll = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== activeIndex && index >= 0 && index < images.length) {
        setActiveIndex(index);
      }
    },
    [activeIndex, images.length],
  );

  if (images.length === 0) {
    return (
      <View style={[galleryStyles.placeholder, { height: HERO_HEIGHT, backgroundColor: themeColors.surface }]}>
        <Ionicons name="image-outline" size={48} color={colors.gray[300]} />
        <Text style={[galleryStyles.placeholderText, { color: themeColors.textTertiary }]}>No images available</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={scrollRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => `img-${i}`}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenFullscreen(index)}>
            <Image source={{ uri: item }} style={galleryStyles.heroImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
      />
      {images.length > 1 && (
        <View style={galleryStyles.dotsContainer}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[galleryStyles.dot, i === activeIndex && galleryStyles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const galleryStyles = StyleSheet.create({
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  placeholder: {
    width: SCREEN_WIDTH,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

/** Fullscreen image modal */
function FullscreenImageModal({
  visible,
  images,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={fullscreenStyles.container}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            if (idx !== currentIndex) setCurrentIndex(idx);
          }}
          scrollEventThrottle={16}
          keyExtractor={(_, i) => `fs-${i}`}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={fullscreenStyles.image}
              resizeMode="contain"
            />
          )}
        />
        <SafeAreaView style={fullscreenStyles.header} edges={['top']}>
          <TouchableOpacity onPress={onClose} style={fullscreenStyles.closeBtn}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={fullscreenStyles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const fullscreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
});

/** Single review card */
function ReviewCard({ review }: { review: any }) {
  const { themeColors } = useTheme();
  return (
    <View style={[reviewStyles.card, { backgroundColor: themeColors.surface }]}>
      <View style={reviewStyles.header}>
        <View style={reviewStyles.avatar}>
          <Text style={reviewStyles.avatarText}>
            {(review.customerName || 'A')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[reviewStyles.name, { color: themeColors.text }]}>{review.customerName || 'Anonymous'}</Text>
          <Text style={[reviewStyles.date, { color: themeColors.textTertiary }]}>{formatDate(review.createdAt)}</Text>
        </View>
        <StarRating rating={review.rating} size={14} />
      </View>
      {review.comment ? <Text style={[reviewStyles.comment, { color: themeColors.textSecondary }]}>{review.comment}</Text> : null}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[700],
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  comment: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  const { themeColors } = useTheme();
  return (
    <View style={[sectionStyles.container, { borderBottomColor: themeColors.border }]}>
      <Text style={[sectionStyles.title, { color: themeColors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ActivityDetailScreen() {
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const reviewsSectionY = useRef(0);

  // State
  const [activity, setActivity] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewMeta, setReviewMeta] = useState<{ total: number; averageRating: number }>({
    total: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  // Scroll-driven header opacity
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT - 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const fetchActivity = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await activityMarketplaceAPI.getActivityById(id);
      if (response?.success && response.data) {
        setActivity(response.data);
      } else {
        setError('Activity not found.');
      }
    } catch (err: any) {
      console.error('[ActivityDetail] fetch error:', err.message);
      setError(err.message || 'Failed to load activity details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    try {
      const res = await makeAPICall(`/activities/${id}/reviews?page=1&sort=newest&limit=3`);
      if (res?.success) {
        setReviews(res.data || []);
        setReviewMeta({
          total: res.pagination?.total || res.total || 0,
          averageRating: res.averageRating ?? res.data?.[0]?.activityRating ?? 0,
        });
      }
    } catch (err: any) {
      // Non-fatal -- we just show no reviews
      console.warn('[ActivityDetail] reviews fetch:', err.message);
    }
  }, [id]);

  useEffect(() => {
    fetchActivity();
    fetchReviews();
  }, [fetchActivity, fetchReviews]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleScrollToReviews = () => {
    if (reviewsSectionY.current && scrollRef.current) {
      scrollRef.current.scrollTo({ y: reviewsSectionY.current, animated: true });
    }
  };

  const handleOpenFullscreen = (index: number) => {
    setFullscreenIndex(index);
    setFullscreenVisible(true);
  };

  const requireAuth = useRequireAuth();
  const handleBookNow = () => {
    if (!activity) return;
    const target = `/activity/book/${activity._id}`;
    if (!requireAuth({ reason: 'Sign in to book this activity. Your booking and payment receipt will be saved to your account.', redirectAfter: target })) return;
    router.push(target);
  };

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
        <LoadingSpinner fullScreen message="Loading activity..." />
      </SafeAreaView>
    );
  }

  if (error || !activity) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
        <ErrorView
          fullScreen
          title="Could not load activity"
          message={error || 'The activity you are looking for could not be found.'}
          onRetry={fetchActivity}
        />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const images: string[] = activity.images?.map((img: any) =>
    typeof img === 'string' ? img : img.url,
  ) || [];

  const basePrice =
    activity.pricing?.basePrice ?? activity.pricing?.adultPrice ?? activity.price ?? 0;

  const avgRating =
    activity.averageRating ?? activity.rating?.average ?? reviewMeta.averageRating ?? 0;
  const totalReviews =
    activity.totalReviews ?? activity.rating?.count ?? reviewMeta.total ?? 0;

  const highlights: string[] = activity.highlights || activity.whatsIncluded || [];
  const categories: string[] = Array.isArray(activity.category)
    ? activity.category
    : activity.category
      ? [activity.category]
      : [];

  const cancellation = getCancellationLabel(activity.cancellationPolicy?.type || activity.cancellationPolicy);

  const duration = activity.duration?.display || activity.duration?.value
    ? `${activity.duration.value} ${activity.duration.unit || 'hours'}`
    : null;

  const isInstantBooking = activity.instantBooking?.enabled ?? false;

  const safetyInfo = activity.safetyRequirements || activity.requirements || null;
  const meetingPoint = activity.meetingPoint || activity.location?.meetingPoint || null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      {/* Animated header background */}
      <Animated.View
        style={[
          styles.animatedHeader,
          {
            backgroundColor: themeColors.background,
            borderBottomColor: themeColors.border,
            opacity: headerOpacity,
            paddingTop: Platform.OS === 'ios'
              ? (RNStatusBar.currentHeight || 44) + 4
              : (RNStatusBar.currentHeight || 0) + 10,
          },
        ]}
      >
        <Text style={[styles.animatedHeaderTitle, { color: themeColors.text }]} numberOfLines={1}>
          {activity.title}
        </Text>
      </Animated.View>

      {/* Floating back button */}
      <SafeAreaView style={styles.backBtnContainer} edges={['top']}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        ref={scrollRef as any}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Hero image gallery */}
        <ImageGallery images={images} onOpenFullscreen={handleOpenFullscreen} />

        {/* Info section */}
        <View style={[styles.infoSection, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>{activity.title}</Text>

          {/* Location */}
          {(activity.location?.city || activity.city) && (
            <View style={styles.inlineRow}>
              <Ionicons name="location-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.locationText, { color: themeColors.textSecondary }]}>
                {activity.location?.city || activity.city}
                {(activity.location?.state || activity.state)
                  ? `, ${activity.location?.state || activity.state}`
                  : ''}
              </Text>
            </View>
          )}

          {/* Rating row */}
          <TouchableOpacity
            style={styles.ratingRow}
            onPress={handleScrollToReviews}
            activeOpacity={0.7}
          >
            <StarRating rating={Math.round(avgRating)} size={16} />
            <Text style={[styles.ratingText, { color: themeColors.textSecondary }]}>
              {avgRating.toFixed(1)} ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
            </Text>
          </TouchableOpacity>

          {/* Badges */}
          <View style={styles.badgeRow}>
            {duration && <Badge label={duration} variant="default" size="md" />}
            {categories.map((cat, i) => (
              <Badge key={i} label={cat} variant="primary" size="md" style={{ marginLeft: spacing.sm }} />
            ))}
            {isInstantBooking && (
              <Badge label="Instant Booking" variant="success" size="md" style={{ marginLeft: spacing.sm }} />
            )}
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>From </Text>
            <Text style={styles.priceValue}>{formatCurrency(basePrice)}</Text>
            <Text style={[styles.priceUnit, { color: themeColors.textSecondary }]}> per person</Text>
          </View>
        </View>

        {/* Description */}
        <Section title="About">
          <Text
            style={[styles.descText, { color: themeColors.textSecondary }]}
            numberOfLines={descExpanded ? undefined : DESCRIPTION_PREVIEW_LINES}
          >
            {activity.description || 'No description available.'}
          </Text>
          {activity.description && activity.description.length > 150 && (
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
              <Text style={styles.readMore}>
                {descExpanded ? 'Show Less' : 'Read More'}
              </Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Highlights */}
        {highlights.length > 0 && (
          <Section title="What's Included">
            {highlights.map((item, idx) => (
              <View key={idx} style={styles.highlightRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.success}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{item}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Safety & Requirements */}
        {safetyInfo && (
          <Section title="Safety & Requirements">
            {safetyInfo.minimumAge && (
              <View style={styles.highlightRow}>
                <Ionicons name="person-outline" size={18} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>Minimum age: {safetyInfo.minimumAge} years</Text>
              </View>
            )}
            {safetyInfo.fitnessLevel && (
              <View style={styles.highlightRow}>
                <Ionicons name="fitness-outline" size={18} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>Fitness level: {safetyInfo.fitnessLevel}</Text>
              </View>
            )}
            {safetyInfo.whatToBring && Array.isArray(safetyInfo.whatToBring) && safetyInfo.whatToBring.map((item: string, idx: number) => (
              <View key={idx} style={styles.highlightRow}>
                <Ionicons name="bag-outline" size={18} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{item}</Text>
              </View>
            ))}
            {typeof safetyInfo === 'string' && (
              <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{safetyInfo}</Text>
            )}
          </Section>
        )}

        {/* Reviews */}
        <View
          onLayout={(e) => {
            reviewsSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Section title="Reviews">
            {/* Average rating display */}
            {totalReviews > 0 && (
              <View style={styles.avgRatingContainer}>
                <Text style={styles.avgRatingNumber}>{avgRating.toFixed(1)}</Text>
                <View style={{ marginLeft: spacing.md }}>
                  <StarRating rating={Math.round(avgRating)} size={20} />
                  <Text style={[styles.avgRatingSubtext, { color: themeColors.textSecondary }]}>
                    Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}

            {reviews.length > 0 ? (
              <>
                {reviews.map((review, idx) => (
                  <ReviewCard key={review._id || idx} review={review} />
                ))}
                {totalReviews > 3 && (
                  <Button
                    title={`View All ${totalReviews} Reviews`}
                    onPress={() => router.push(`/activity/reviews/${id}`)}
                    variant="outline"
                    size="md"
                    fullWidth
                  />
                )}
              </>
            ) : (
              <Text style={[styles.emptyReviews, { color: themeColors.textTertiary }]}>No reviews yet. Be the first to review!</Text>
            )}
          </Section>
        </View>

        {/* Cancellation Policy */}
        <Section title="Cancellation Policy">
          <View style={styles.cancellationContainer}>
            <View style={[styles.cancellationDot, { backgroundColor: cancellation.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cancellationLabel, { color: themeColors.text }]}>{cancellation.label}</Text>
              <Text style={[styles.cancellationDesc, { color: themeColors.textSecondary }]}>{cancellation.desc}</Text>
            </View>
          </View>
        </Section>

        {/* Location */}
        {(activity.location?.address || meetingPoint) && (
          <Section title="Location">
            {activity.location?.address && (
              <View style={styles.highlightRow}>
                <Ionicons
                  name="map-outline"
                  size={18}
                  color={colors.primary[500]}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>{activity.location.address}</Text>
              </View>
            )}
            {meetingPoint && (
              <View style={[styles.highlightRow, { marginTop: spacing.sm }]}>
                <Ionicons
                  name="flag-outline"
                  size={18}
                  color={colors.primary[500]}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>
                  Meeting point: {typeof meetingPoint === 'string' ? meetingPoint : meetingPoint.description || meetingPoint.address || ''}
                </Text>
              </View>
            )}
          </Section>
        )}
      </Animated.ScrollView>

      {/* Sticky bottom bar */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomBarSafe, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
        <View style={styles.bottomBar}>
          <View>
            <Text style={[styles.bottomPriceLabel, { color: themeColors.textTertiary }]}>From</Text>
            <Text style={[styles.bottomPrice, { color: themeColors.text }]}>{formatCurrency(basePrice)}</Text>
            <Text style={[styles.bottomPriceUnit, { color: themeColors.textTertiary }]}>per person</Text>
          </View>
          <Button title="Book Now" onPress={handleBookNow} size="lg" />
        </View>
      </SafeAreaView>

      {/* Fullscreen image modal */}
      <FullscreenImageModal
        visible={fullscreenVisible}
        images={images}
        initialIndex={fullscreenIndex}
        onClose={() => setFullscreenVisible(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Animated header
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 60,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  animatedHeaderTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },

  // Back button
  backBtnContainer: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    zIndex: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info section
  infoSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ratingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  priceUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Description
  descText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  readMore: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
    marginTop: spacing.sm,
  },

  // Highlights
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  highlightText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Reviews
  avgRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  avgRatingNumber: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  avgRatingSubtext: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyReviews: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

  // Cancellation
  cancellationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cancellationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: spacing.md,
  },
  cancellationLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  cancellationDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Sticky bottom bar
  bottomBarSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.lg,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  bottomPriceLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  bottomPrice: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  bottomPriceUnit: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
});
