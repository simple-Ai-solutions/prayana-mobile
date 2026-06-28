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
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '@prayana/shared-ui';
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
  ownerResponse?: { comment?: string; respondedAt?: string };
};

type Filter = 'all' | 'unanswered' | 'low';

export default function VendorReviewsScreen() {
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  // Reply modal state
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPage = useCallback(
    async (nextPage: number, replace = false) => {
      try {
        const res = await businessAPI.getMyReviews({ page: nextPage, limit: 20 });
        const incoming: Review[] = res?.reviews || res?.data?.reviews || [];
        const total = res?.pagination?.total ?? res?.data?.pagination?.total ?? incoming.length;
        setReviews((prev) => (replace ? incoming : [...prev, ...incoming]));
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
    if (filter === 'all') return reviews;
    if (filter === 'unanswered') return reviews.filter((r) => !r.ownerResponse?.comment);
    if (filter === 'low') return reviews.filter((r) => r.rating <= 3);
    return reviews;
  }, [reviews, filter]);

  const summary = useMemo(() => {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const unanswered = reviews.filter((r) => !r.ownerResponse?.comment).length;
    return { avg, unanswered, total: reviews.length };
  }, [reviews]);

  const openReply = (review: Review) => {
    Haptics.selectionAsync();
    setActiveReview(review);
    setReplyDraft(review.ownerResponse?.comment || '');
  };

  const submitReply = async () => {
    if (!activeReview || !replyDraft.trim()) return;
    setSubmitting(true);
    try {
      const res = await businessAPI.replyToReview(activeReview._id, replyDraft.trim());
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Reply published' });
        // Update the review locally
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Reviews</Text>
        <View style={{ width: 26 }} />
      </View>

      {summary ? (
        <Card style={styles.summary}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryAvg}>{summary.avg.toFixed(1)}</Text>
            <StarRating rating={summary.avg} size={14} />
            <Text style={styles.summaryMeta}>
              {summary.total} review{summary.total === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.summaryActionWrap}>
            <Badge
              label={`${summary.unanswered} unanswered`}
              variant={summary.unanswered > 0 ? 'warning' : 'success'}
              size="md"
            />
          </View>
        </Card>
      ) : null}

      <View style={styles.filterRow}>
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'unanswered', label: 'Unanswered' },
            { key: 'low', label: '≤ 3 stars' },
          ] as { key: Filter; label: string }[]
        ).map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={56} color={colors.gray[300]} />}
          title={filter === 'unanswered' ? 'All caught up' : 'No reviews yet'}
          description={
            filter === 'unanswered'
              ? "You've replied to every review. Nice work!"
              : 'Reviews from your customers will appear here.'
          }
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(r) => r._id}
          renderItem={({ item }) => <ReviewCard review={item} onReply={() => openReply(item)} />}
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
            <TouchableOpacity onPress={() => setActiveReview(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
                    <Text style={styles.replyAuthor}>{activeReview.userName || 'Traveller'}</Text>
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
                placeholder="Thanks for the kind words! We can't wait to host you again."
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
    </SafeAreaView>
  );
}

function ReviewCard({ review, onReply }: { review: Review; onReply: () => void }) {
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
        <Avatar
          uri={review.userAvatar}
          name={review.userName || 'Traveller'}
          size={40}
        />
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
        </View>
      </View>

      {review.comment ? (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      ) : null}

      {replied ? (
        <View style={styles.responseBlock}>
          <View style={styles.responseHeader}>
            <Ionicons name="business-outline" size={14} color={colors.primary[600]} />
            <Text style={styles.responseLabel}>Your reply</Text>
            {review.ownerResponse?.respondedAt ? (
              <Text style={styles.responseDate}>
                · {new Date(review.ownerResponse.respondedAt).toLocaleDateString('en-IN', {
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
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Button
            title="Reply"
            onPress={onReply}
            variant="outline"
            size="md"
            icon={<Ionicons name="chatbox-outline" size={16} color={colors.primary[500]} />}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summaryAvg: { fontSize: 36, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 4 },
  summaryMeta: { marginTop: 4, fontSize: fontSize.xs, color: colors.textTertiary },
  summaryActionWrap: { alignItems: 'flex-end' },

  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
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

  reviewCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg },
  reviewHead: { flexDirection: 'row', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dateText: { fontSize: fontSize.xs, color: colors.textTertiary },
  reviewComment: { marginTop: spacing.md, fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },

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
