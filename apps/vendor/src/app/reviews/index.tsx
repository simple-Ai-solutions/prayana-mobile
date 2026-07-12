import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Avatar,
  Badge,
  EmptyState,
  StarRating,
} from '@prayana/shared-ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../theme/vendorColors';
import { businessAPI } from '@prayana/shared-services';

type Review = {
  _id: string;
  rating: number;
  comment?: string;
  userName?: string;
  userAvatar?: string;
  createdAt?: string;
  isVerifiedBooking?: boolean;
  helpfulVotes?: number;
  flaggedByVendor?: boolean;
  listingId?: { title?: string } | null;
  ownerResponse?: { comment?: string; respondedAt?: string };
};

type ReviewSummary = {
  avgRating: number;
  totalReviews: number;
  distribution?: Record<string, number>;
  respondedCount: number;
  responseRate: number;
};

type Filter = 'all' | '5star' | '4star' | '3star' | '2star' | '1star' | 'unanswered' | 'responded';

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '5star', label: '5★' },
  { key: '4star', label: '4★' },
  { key: '3star', label: '3★' },
  { key: '2star', label: '2★' },
  { key: '1star', label: '1★' },
  { key: 'unanswered', label: 'Needs reply' },
  { key: 'responded', label: 'Replied' },
];

export default function VendorReviewsScreen() {
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  // Reply modal state
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Flag modal state
  const [flagReview, setFlagReview] = useState<Review | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);

  const fetchPage = useCallback(
    async (nextPage: number, replace = false) => {
      try {
        const res = await businessAPI.getMyReviews({ page: nextPage, limit: 20 });
        const incoming: Review[] = res?.reviews || res?.data?.reviews || res?.data || [];
        const total =
          res?.pagination?.total ?? res?.data?.pagination?.total ?? incoming.length;
        const nextSummary: ReviewSummary | null =
          res?.summary || res?.data?.summary || null;
        setReviews((prev) => (replace ? incoming : [...prev, ...incoming]));
        if (nextSummary) setSummary(nextSummary);
        setHasMore(nextPage * 20 < total);
        setPage(nextPage);
      } catch (err: any) {
        console.warn('[VendorReviews] fetch failed:', err?.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(1, true);
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (!loading && hasMore) fetchPage(page + 1);
  }, [loading, hasMore, page, fetchPage]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'all':
        return reviews;
      case 'unanswered':
        return reviews.filter((r) => !r.ownerResponse?.comment);
      case 'responded':
        return reviews.filter((r) => !!r.ownerResponse?.comment);
      default: {
        const star = parseInt(filter[0], 10);
        return reviews.filter((r) => r.rating === star);
      }
    }
  }, [reviews, filter]);

  // Fallback summary computed from loaded reviews if backend didn't send one
  const effectiveSummary = useMemo<ReviewSummary | null>(() => {
    if (summary) return summary;
    if (reviews.length === 0) return null;
    const total = reviews.length;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / total;
    const responded = reviews.filter((r) => !!r.ownerResponse?.comment).length;
    const distribution = reviews.reduce<Record<string, number>>((acc, r) => {
      acc[r.rating] = (acc[r.rating] || 0) + 1;
      return acc;
    }, {});
    return {
      avgRating: Math.round(avg * 10) / 10,
      totalReviews: total,
      distribution,
      respondedCount: responded,
      responseRate: Math.round((responded / total) * 100),
    };
  }, [summary, reviews]);

  const openReply = (review: Review) => {
    Haptics.selectionAsync();
    setActiveReview(review);
    setReplyDraft(review.ownerResponse?.comment || '');
  };

  const openFlag = (review: Review) => {
    Haptics.selectionAsync();
    setFlagReview(review);
    setFlagReason('');
  };

  const submitReply = async () => {
    if (!activeReview || !replyDraft.trim()) return;
    setSubmitting(true);
    try {
      const res = await businessAPI.replyToReview(activeReview._id, replyDraft.trim());
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Reply published' });
        setReviews((prev) =>
          prev.map((r) =>
            r._id === activeReview._id
              ? {
                  ...r,
                  ownerResponse: {
                    comment: replyDraft.trim(),
                    respondedAt: new Date().toISOString(),
                  },
                }
              : r,
          ),
        );
        setActiveReview(null);
        setReplyDraft('');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Could not publish reply',
          text2: res?.message,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Reply failed',
        text2: err?.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitFlag = async () => {
    if (!flagReview || !flagReason.trim()) return;
    setFlagging(true);
    try {
      const res = await businessAPI.flagReview(flagReview._id, flagReason.trim());
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Flagged for admin review' });
        setReviews((prev) =>
          prev.map((r) =>
            r._id === flagReview._id ? { ...r, flaggedByVendor: true } : r,
          ),
        );
        setFlagReview(null);
        setFlagReason('');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Could not flag review',
          text2: res?.message,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Flag failed',
        text2: err?.message,
      });
    } finally {
      setFlagging(false);
    }
  };

  const ListHeader = (
    <View>
      {/* Summary stat tiles */}
      {effectiveSummary && effectiveSummary.totalReviews > 0 ? (
        <View style={styles.statGrid}>
          <StatTile label="Avg Rating" value={`${effectiveSummary.avgRating} ★`} highlight />
          <StatTile label="Total Reviews" value={String(effectiveSummary.totalReviews)} />
          <StatTile
            label="Replied"
            value={`${effectiveSummary.respondedCount} / ${effectiveSummary.totalReviews}`}
          />
          <StatTile
            label="Response Rate"
            value={`${effectiveSummary.responseRate}%`}
            warn={effectiveSummary.responseRate < 70}
          />
        </View>
      ) : null}

      {/* Rating distribution */}
      {effectiveSummary && effectiveSummary.totalReviews > 0 ? (
        <Card style={styles.distCard}>
          <Text style={styles.distTitle}>RATING DISTRIBUTION</Text>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = effectiveSummary.distribution?.[r] || 0;
            const pct =
              effectiveSummary.totalReviews > 0
                ? (count / effectiveSummary.totalReviews) * 100
                : 0;
            return (
              <View key={r} style={styles.distRow}>
                <View style={styles.distLabel}>
                  <Text style={styles.distLabelText}>{r}</Text>
                  <Ionicons name="star" size={11} color="#f59e0b" />
                </View>
                <View style={styles.distTrack}>
                  <View style={[styles.distFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.distCount}>{count}</Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.topBarTitle}>Reviews</Text>
          <Text style={styles.topBarSubtitle}>
            Reply, flag inappropriate content, monitor your response rate
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(r) => r._id}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              onReply={() => openReply(item)}
              onFlag={() => openFlag(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={
                <Ionicons name="chatbubbles-outline" size={56} color={colors.gray[300]} />
              }
              title="No reviews match this filter"
              description="Once customers complete activities and leave reviews, they'll appear here. Great reviews help attract more bookings."
            />
          }
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReached}
        />
      )}

      {/* Reply modal */}
      <Modal
        visible={!!activeReview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveReview(null)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeReview?.ownerResponse?.comment ? 'Edit reply' : 'Reply'}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveReview(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.modalScroll}>
              {activeReview ? (
                <View style={styles.replyContext}>
                  <View style={styles.replyHead}>
                    <StarRating rating={activeReview.rating} size={14} />
                    <Text style={styles.replyAuthor}>
                      {activeReview.userName || 'Traveller'}
                    </Text>
                  </View>
                  {activeReview.comment ? (
                    <Text style={styles.replyComment} numberOfLines={4}>
                      {activeReview.comment}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.replyLabel}>Your response</Text>
              <RNTextInput
                value={replyDraft}
                onChangeText={setReplyDraft}
                placeholder="Thank you for the review! Be professional and concise."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={styles.replyInput}
                maxLength={1000}
              />
              <Text style={styles.charCount}>{replyDraft.length} / 1000</Text>

              <View style={{ flex: 1 }} />

              <Button
                title={activeReview?.ownerResponse?.comment ? 'Update reply' : 'Publish reply'}
                onPress={submitReply}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting || !replyDraft.trim()}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Flag modal */}
      <Modal
        visible={!!flagReview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFlagReview(null)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Flag for admin</Text>
            <TouchableOpacity
              onPress={() => setFlagReview(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.modalScroll}>
              <View style={styles.flagNotice}>
                <Ionicons name="flag" size={16} color={colors.error} />
                <Text style={styles.flagNoticeText}>
                  Flag this review for admin moderation. Provide a reason — e.g. fake
                  review, vulgarity, off-topic. You cannot delete reviews yourself.
                </Text>
              </View>

              <Text style={styles.replyLabel}>Reason</Text>
              <RNTextInput
                value={flagReason}
                onChangeText={setFlagReason}
                placeholder="Reason (max 500 chars)"
                placeholderTextColor={colors.textTertiary}
                multiline
                style={styles.replyInput}
                maxLength={500}
              />
              <Text style={styles.charCount}>{flagReason.length} / 500</Text>

              <View style={{ flex: 1 }} />

              <Button
                title="Submit flag"
                onPress={submitFlag}
                variant="danger"
                size="lg"
                fullWidth
                loading={flagging}
                disabled={flagging || !flagReason.trim()}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatTile({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <Card
      style={[
        styles.statTile,
        highlight && styles.statTileHighlight,
        warn && styles.statTileWarn,
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          highlight && styles.statValueHighlight,
          warn && styles.statValueWarn,
        ]}
      >
        {value}
      </Text>
    </Card>
  );
}

function ReviewCard({
  review,
  onReply,
  onFlag,
}: {
  review: Review;
  onReply: () => void;
  onFlag: () => void;
}) {
  const date = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
  const replied = !!review.ownerResponse?.comment;

  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <Avatar uri={review.userAvatar} name={review.userName || 'Traveller'} size={40} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{review.userName || 'Traveller'}</Text>
            {review.isVerifiedBooking ? (
              <Badge label="Verified" variant="success" size="sm" />
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            <StarRating rating={review.rating} size={13} />
            {date ? <Text style={styles.dateText}> · {date}</Text> : null}
          </View>
          {review.listingId?.title ? (
            <Text style={styles.listingText} numberOfLines={1}>
              {review.listingId.title}
            </Text>
          ) : null}
        </View>
      </View>

      {review.comment ? (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      ) : null}

      {/* Meta + actions row */}
      <View style={styles.actionRow}>
        <View style={styles.helpful}>
          <Ionicons name="thumbs-up-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.helpfulText}>{review.helpfulVotes || 0} helpful</Text>
        </View>

        {!replied ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onReply}>
            <Ionicons name="arrow-undo-outline" size={15} color={colors.primary[500]} />
            <Text style={styles.actionBtnText}>Reply</Text>
          </TouchableOpacity>
        ) : null}

        {review.flaggedByVendor ? (
          <View style={styles.flaggedTag}>
            <Ionicons name="flag" size={13} color={colors.warning} />
            <Text style={styles.flaggedTagText}>Flagged — awaiting admin</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.actionBtn} onPress={onFlag}>
            <Ionicons name="flag-outline" size={15} color={colors.textTertiary} />
            <Text style={styles.actionBtnMuted}>Flag for admin</Text>
          </TouchableOpacity>
        )}
      </View>

      {replied ? (
        <View style={styles.responseBlock}>
          <View style={styles.responseHeader}>
            <Ionicons name="business-outline" size={14} color={colors.primary[600]} />
            <Text style={styles.responseLabel}>Your reply</Text>
            {review.ownerResponse?.respondedAt ? (
              <Text style={styles.responseDate}>
                ·{' '}
                {new Date(review.ownerResponse.respondedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            ) : null}
          </View>
          <Text style={styles.responseText}>{review.ownerResponse?.comment}</Text>
          <TouchableOpacity onPress={onReply} style={styles.editLink}>
            <Text style={styles.editLinkText}>Edit reply</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },
  topBarSubtitle: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },

  // Stat tiles
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.md,
  },
  statTileHighlight: { borderColor: '#fcd34d', borderWidth: 1 },
  statTileWarn: { borderColor: '#fca5a5', borderWidth: 1 },
  statLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  statValueHighlight: { color: '#d97706' },
  statValueWarn: { color: colors.error },

  // Distribution
  distCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, gap: spacing.sm },
  distTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  distLabel: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 28 },
  distLabelText: { fontSize: fontSize.sm, color: colors.text },
  distTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  distFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: borderRadius.full },
  distCount: { width: 36, textAlign: 'right', fontSize: fontSize.xs, color: colors.textTertiary },

  // Filters
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  filterText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  filterTextActive: { color: '#fff' },

  // Review card
  reviewCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg },
  reviewHead: { flexDirection: 'row', alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dateText: { fontSize: fontSize.xs, color: colors.textTertiary },
  listingText: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },
  reviewComment: { marginTop: spacing.md, fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpfulText: { fontSize: fontSize.xs, color: colors.textTertiary },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary[500] },
  actionBtnMuted: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textTertiary },
  flaggedTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flaggedTagText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.warning },

  responseBlock: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  responseLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[700] },
  responseDate: { fontSize: fontSize.xs, color: colors.textTertiary },
  responseText: { marginTop: 4, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  editLink: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  editLinkText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary[600] },

  // Modals
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
  modalScroll: { flex: 1, padding: spacing.lg, gap: spacing.md },

  replyContext: {
    padding: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  replyAuthor: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  replyComment: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  flagNotice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#fef2f2',
    borderRadius: borderRadius.md,
  },
  flagNoticeText: { flex: 1, fontSize: fontSize.xs, color: colors.error, lineHeight: 18 },

  replyLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.md },
  replyInput: {
    minHeight: 140,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  charCount: { fontSize: fontSize.xs, color: colors.textTertiary, alignSelf: 'flex-end' },
});
