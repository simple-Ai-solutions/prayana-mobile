import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  Card,
  Button,
  Avatar,
  Badge,
  StarRating,
  EmptyState,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'quality' | 'reviews';

interface QualityMetric {
  key: string;
  label: string;
  score: number; // 0-100
  detail?: string;
}

interface QualityData {
  overallScore: number;
  tier?: string;
  metrics: QualityMetric[];
}

interface Review {
  _id: string;
  rating: number;
  comment?: string;
  userName?: string;
  userAvatar?: string;
  createdAt?: string;
  isVerifiedBooking?: boolean;
  ownerResponse?: { comment?: string; respondedAt?: string };
  isFlagged?: boolean;
}

interface ReviewSummary {
  totalReviews: number;
  avgRating: number;
  responseRate: number; // percent
  distribution: Record<string, number>;
}

const FLAG_REASONS = [
  'Spam or fake review',
  'Offensive or abusive language',
  'Not a genuine customer',
  'Irrelevant content',
  'Other',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  if (score >= 40) return colors.info;
  return colors.error;
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs work';
}

const METRIC_LABELS: Record<string, string> = {
  responseTime: 'Response Time',
  cancellationRate: 'Cancellation Rate',
  completionRate: 'Completion Rate',
  customerRating: 'Customer Rating',
};

// Normalize a sub-metric value onto a 0-100 score for the bar.
function normalizeMetric(key: string, raw: any): number {
  // Prefer an explicit score if the backend provides one.
  if (raw && typeof raw === 'object' && raw.score != null) {
    const s = Number(raw.score);
    return Number.isFinite(s) ? Math.max(0, Math.min(100, s <= 5 ? s * 20 : s)) : 0;
  }
  const val = Number(typeof raw === 'object' ? raw.value ?? raw.rate ?? 0 : raw);
  if (!Number.isFinite(val)) return 0;
  if (key === 'customerRating') return Math.max(0, Math.min(100, val * 20)); // 0-5 → 0-100
  return Math.max(0, Math.min(100, val));
}

function parseQuality(raw: any): QualityData {
  const p = raw?.data ?? raw?.qualityScore ?? raw ?? {};
  const overall = Number(p.overallScore ?? p.score ?? p.total ?? 0);
  const tier = p.tier ?? p.level ?? p.grade ?? undefined;

  const metrics: QualityMetric[] = [];
  (['responseTime', 'cancellationRate', 'completionRate', 'customerRating'] as const).forEach(
    (key) => {
      const m = p[key];
      if (m == null) return;
      metrics.push({
        key,
        label: METRIC_LABELS[key] ?? key,
        score: normalizeMetric(key, m),
        detail:
          m && typeof m === 'object'
            ? m.description ?? m.detail ?? m.label ?? undefined
            : undefined,
      });
    },
  );

  return {
    overallScore: Math.round(Number.isFinite(overall) ? overall : 0),
    tier,
    metrics,
  };
}

function parseReviews(raw: any): { reviews: Review[]; summary: ReviewSummary | null } {
  const reviews: Review[] = raw?.reviews ?? raw?.data?.reviews ?? [];
  const s = raw?.summary ?? raw?.data?.summary ?? null;
  const summary: ReviewSummary | null = s
    ? {
        totalReviews: Number(s.totalReviews ?? s.total ?? reviews.length),
        avgRating: Number(s.avgRating ?? s.average ?? 0),
        responseRate: Number(s.responseRate ?? 0),
        distribution: s.distribution ?? {},
      }
    : null;
  return { reviews, summary };
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Quality Tab ──────────────────────────────────────────────────────────────

function QualityTab({
  data,
  loading,
  refreshing,
  onRefresh,
}: {
  data: QualityData | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { themeColors } = useTheme();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading quality score..." />;
  }

  const overall = data?.overallScore ?? 0;
  const ringColor = scoreColor(overall);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
      }
    >
      <Card style={styles.scoreCard}>
        <View style={[styles.ring, { borderColor: ringColor }]}>
          <Text style={[styles.ringScore, { color: ringColor }]}>{overall}</Text>
          <Text style={[styles.ringMax, { color: themeColors.textTertiary }]}>/ 100</Text>
        </View>
        <Text style={[styles.scoreStatus, { color: ringColor }]}>{scoreLabel(overall)}</Text>
        {data?.tier ? (
          <View style={[styles.tierBadge, { backgroundColor: colors.primary[50] }]}>
            <Ionicons name="diamond-outline" size={14} color={colors.primary[600]} />
            <Text style={styles.tierText}>{data.tier} tier</Text>
          </View>
        ) : null}
      </Card>

      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Breakdown</Text>
      {data?.metrics && data.metrics.length > 0 ? (
        <Card>
          {data.metrics.map((m, i) => {
            const barColor = scoreColor(m.score);
            return (
              <View key={m.key}>
                <View style={styles.factorRow}>
                  <View style={styles.factorHead}>
                    <Text style={[styles.factorLabel, { color: themeColors.text }]} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text style={[styles.factorValue, { color: barColor }]}>{m.score}%</Text>
                  </View>
                  <View style={[styles.factorTrack, { backgroundColor: themeColors.border }]}>
                    <View
                      style={[styles.factorFill, { width: `${m.score}%`, backgroundColor: barColor }]}
                    />
                  </View>
                  {m.detail ? (
                    <Text style={[styles.factorDesc, { color: themeColors.textTertiary }]}>
                      {m.detail}
                    </Text>
                  ) : null}
                </View>
                {i < data.metrics.length - 1 ? (
                  <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : (
        <Card>
          <View style={styles.emptyInline}>
            <Ionicons name="analytics-outline" size={28} color={themeColors.textTertiary} />
            <Text style={[styles.emptyInlineText, { color: themeColors.textTertiary }]}>
              No quality metrics available yet.
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── Reviews Tab ────────────────────────────────────────────────────────────

function ReviewsTab({
  reviews,
  summary,
  loading,
  refreshing,
  onRefresh,
  onReply,
  onFlag,
}: {
  reviews: Review[];
  summary: ReviewSummary | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onReply: (r: Review) => void;
  onFlag: (r: Review) => void;
}) {
  const { themeColors } = useTheme();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading reviews..." />;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
      }
    >
      {summary ? (
        <Card style={styles.reviewSummary}>
          <View style={styles.summaryLeft}>
            <Text style={[styles.summaryAvg, { color: themeColors.text }]}>
              {summary.avgRating.toFixed(1)}
            </Text>
            <StarRating rating={summary.avgRating} size={14} />
            <Text style={[styles.summaryMeta, { color: themeColors.textTertiary }]}>
              {summary.totalReviews} review{summary.totalReviews === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={[styles.summaryRate, { color: themeColors.text }]}>
              {Math.round(summary.responseRate)}%
            </Text>
            <Text style={[styles.summaryRateLabel, { color: themeColors.textSecondary }]}>
              Response rate
            </Text>
          </View>
        </Card>
      ) : null}

      {reviews.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={48} color={colors.gray[300]} />}
          title="No reviews yet"
          description="Reviews from your customers will appear here."
        />
      ) : (
        <View style={styles.reviewList}>
          {reviews.map((review) => {
            const replied = !!review.ownerResponse?.comment;
            return (
              <Card key={review._id} style={styles.reviewCard}>
                <View style={styles.reviewHead}>
                  <Avatar uri={review.userAvatar} name={review.userName || 'Traveller'} size={40} />
                  <View style={styles.reviewHeadText}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.userName, { color: themeColors.text }]}>
                        {review.userName || 'Traveller'}
                      </Text>
                      {review.isVerifiedBooking ? (
                        <Badge label="Verified" variant="success" size="sm" />
                      ) : null}
                      {review.isFlagged ? (
                        <Badge label="Flagged" variant="error" size="sm" />
                      ) : null}
                    </View>
                    <View style={styles.ratingRow}>
                      <StarRating rating={review.rating} size={13} />
                      {review.createdAt ? (
                        <Text style={[styles.dateText, { color: themeColors.textTertiary }]}>
                          {' · '}
                          {formatDate(review.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => onFlag(review)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={review.isFlagged ? 'flag' : 'flag-outline'}
                      size={18}
                      color={review.isFlagged ? colors.error : themeColors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>

                {review.comment ? (
                  <Text style={[styles.reviewComment, { color: themeColors.text }]}>
                    {review.comment}
                  </Text>
                ) : null}

                {replied ? (
                  <View style={[styles.responseBlock, { backgroundColor: colors.primary[50] }]}>
                    <View style={styles.responseHeader}>
                      <Ionicons name="business-outline" size={14} color={colors.primary[600]} />
                      <Text style={styles.responseLabel}>Your reply</Text>
                      {review.ownerResponse?.respondedAt ? (
                        <Text style={[styles.responseDate, { color: themeColors.textTertiary }]}>
                          {' · '}
                          {formatDate(review.ownerResponse.respondedAt)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.responseText, { color: themeColors.text }]}>
                      {review.ownerResponse?.comment}
                    </Text>
                    <TouchableOpacity onPress={() => onReply(review)} style={styles.editLink}>
                      <Text style={styles.editLinkText}>Edit reply</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.replyBtnWrap}>
                    <Button
                      title="Reply"
                      onPress={() => onReply(review)}
                      variant="outline"
                      size="md"
                      icon={<Ionicons name="chatbox-outline" size={16} color={colors.primary[500]} />}
                    />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function PerformanceScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { businessAccount } = useBusinessStore();
  const businessId = businessAccount?._id;

  const [tab, setTab] = useState<Tab>('quality');

  // Quality state
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityRefreshing, setQualityRefreshing] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsRefreshing, setReviewsRefreshing] = useState(false);

  // Reply modal
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Flag modal
  const [flagReview, setFlagReview] = useState<Review | null>(null);
  const [submittingFlag, setSubmittingFlag] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────
  const fetchQuality = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await businessAPI.getQualityScore(businessId);
      setQuality(parseQuality(res));
    } catch (err: any) {
      console.warn('[Performance] quality fetch error:', err?.message);
    }
  }, [businessId]);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await businessAPI.getMyReviews({ page: 1, limit: 30 });
      const { reviews: list, summary } = parseReviews(res);
      setReviews(list);
      setReviewSummary(summary);
    } catch (err: any) {
      console.warn('[Performance] reviews fetch error:', err?.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setQualityLoading(true);
      await fetchQuality();
      setQualityLoading(false);
    })();
  }, [fetchQuality]);

  useEffect(() => {
    (async () => {
      setReviewsLoading(true);
      await fetchReviews();
      setReviewsLoading(false);
    })();
  }, [fetchReviews]);

  const onQualityRefresh = useCallback(async () => {
    setQualityRefreshing(true);
    await fetchQuality();
    setQualityRefreshing(false);
  }, [fetchQuality]);

  const onReviewsRefresh = useCallback(async () => {
    setReviewsRefreshing(true);
    await fetchReviews();
    setReviewsRefreshing(false);
  }, [fetchReviews]);

  // ── Reply ────────────────────────────────────────────────────────────────
  const openReply = useCallback((review: Review) => {
    setActiveReview(review);
    setReplyDraft(review.ownerResponse?.comment || '');
  }, []);

  const submitReply = useCallback(async () => {
    if (!activeReview || !replyDraft.trim()) return;
    setSubmittingReply(true);
    try {
      await businessAPI.replyToReview(activeReview._id, replyDraft.trim());
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
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Reply failed', text2: err?.message });
    } finally {
      setSubmittingReply(false);
    }
  }, [activeReview, replyDraft]);

  // ── Flag ─────────────────────────────────────────────────────────────────
  const openFlag = useCallback((review: Review) => {
    if (review.isFlagged) {
      Toast.show({ type: 'info', text1: 'Already flagged', text2: 'This review is under review.' });
      return;
    }
    setFlagReview(review);
  }, []);

  const submitFlag = useCallback(
    async (reason: string) => {
      if (!flagReview) return;
      setSubmittingFlag(true);
      try {
        await businessAPI.flagReview(flagReview._id, reason);
        Toast.show({
          type: 'success',
          text1: 'Review flagged',
          text2: 'Our team will review it shortly.',
        });
        setReviews((prev) =>
          prev.map((r) => (r._id === flagReview._id ? { ...r, isFlagged: true } : r)),
        );
        setFlagReview(null);
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Could not flag', text2: err?.message });
      } finally {
        setSubmittingFlag(false);
      }
    },
    [flagReview],
  );

  // ── No-business guard ──────────────────────────────────────────────────────
  if (!businessId && tab === 'quality') {
    // Still render header/tabs so the vendor can switch to Reviews if relevant.
  }

  const showNoBusiness = !businessId;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Performance</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
        ]}
      >
        {(
          [
            { key: 'quality', label: 'Quality' },
            { key: 'reviews', label: 'Reviews' },
          ] as { key: Tab; label: string }[]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary[500] : themeColors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'quality' ? (
        showNoBusiness ? (
          <View style={styles.noBusiness}>
            <Ionicons name="business-outline" size={48} color={themeColors.textTertiary} />
            <Text style={[styles.noBusinessTitle, { color: themeColors.text }]}>
              No business linked
            </Text>
            <Text style={[styles.noBusinessText, { color: themeColors.textSecondary }]}>
              Complete your business onboarding to see your seller quality score.
            </Text>
            <Button
              title="Go to Onboarding"
              onPress={() => router.push('/onboarding')}
              variant="outline"
              size="md"
              style={styles.noBusinessBtn}
            />
          </View>
        ) : (
          <QualityTab
            data={quality}
            loading={qualityLoading}
            refreshing={qualityRefreshing}
            onRefresh={onQualityRefresh}
          />
        )
      ) : (
        <ReviewsTab
          reviews={reviews}
          summary={reviewSummary}
          loading={reviewsLoading}
          refreshing={reviewsRefreshing}
          onRefresh={onReviewsRefresh}
          onReply={openReply}
          onFlag={openFlag}
        />
      )}

      {/* Reply modal */}
      <Modal
        visible={!!activeReview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveReview(null)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {activeReview?.ownerResponse?.comment ? 'Edit reply' : 'Reply'}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveReview(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <View style={styles.modalBody}>
              {activeReview ? (
                <View style={[styles.replyContext, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <View style={styles.replyHead}>
                    <StarRating rating={activeReview.rating} size={14} />
                    <Text style={[styles.replyAuthor, { color: themeColors.text }]}>
                      {activeReview.userName || 'Traveller'}
                    </Text>
                  </View>
                  {activeReview.comment ? (
                    <Text style={[styles.replyComment, { color: themeColors.textSecondary }]} numberOfLines={4}>
                      {activeReview.comment}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={[styles.replyLabel, { color: themeColors.text }]}>Your response</Text>
              <RNTextInput
                value={replyDraft}
                onChangeText={setReplyDraft}
                placeholder="Thanks for the kind words! We can't wait to host you again."
                placeholderTextColor={themeColors.textTertiary}
                multiline
                style={[
                  styles.replyInput,
                  {
                    borderColor: themeColors.border,
                    color: themeColors.text,
                    backgroundColor: themeColors.surface,
                  },
                ]}
                maxLength={1000}
              />
              <Text style={[styles.charCount, { color: themeColors.textTertiary }]}>
                {replyDraft.length} / 1000
              </Text>

              <View style={styles.flex} />

              <Button
                title={activeReview?.ownerResponse?.comment ? 'Update reply' : 'Publish reply'}
                onPress={submitReply}
                variant="primary"
                size="lg"
                fullWidth
                loading={submittingReply}
                disabled={submittingReply || !replyDraft.trim()}
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Flag Review</Text>
            <TouchableOpacity
              onPress={() => setFlagReview(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={[styles.flagPrompt, { color: themeColors.textSecondary }]}>
              Why are you reporting this review? Our team will investigate.
            </Text>
            {FLAG_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.flagReason, { borderColor: themeColors.border }]}
                activeOpacity={0.7}
                disabled={submittingFlag}
                onPress={() =>
                  Alert.alert('Flag review', `Report this review as "${reason}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Flag', style: 'destructive', onPress: () => submitFlag(reason) },
                  ])
                }
              >
                <Text style={[styles.flagReasonText, { color: themeColors.text }]}>{reason}</Text>
                <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
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
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    borderRadius: 1,
    backgroundColor: colors.primary[500],
  },

  scrollContent: {
    padding: spacing.xl,
  },

  // No business
  noBusiness: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  noBusinessTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
  },
  noBusinessText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  noBusinessBtn: {
    marginTop: spacing.xl,
  },

  // Quality
  scoreCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringScore: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
  },
  ringMax: {
    fontSize: fontSize.xs,
    marginTop: -2,
  },
  scoreStatus: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  tierText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  factorRow: {
    paddingVertical: spacing.xs,
  },
  factorHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  factorLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginRight: spacing.md,
  },
  factorValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  factorTrack: {
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  factorFill: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  factorDesc: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  emptyInline: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyInlineText: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  // Reviews summary
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryAvg: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  summaryMeta: {
    marginTop: 4,
    fontSize: fontSize.xs,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryRate: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  summaryRateLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Review cards
  reviewList: {
    gap: spacing.md,
  },
  reviewCard: {
    padding: spacing.lg,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewHeadText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: {
    fontSize: fontSize.xs,
  },
  reviewComment: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  responseBlock: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  responseLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },
  responseDate: {
    fontSize: fontSize.xs,
  },
  responseText: {
    marginTop: 4,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  editLink: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  editLinkText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  replyBtnWrap: {
    marginTop: spacing.md,
  },

  // Modals
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  modalBody: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  replyContext: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  replyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  replyAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  replyComment: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  replyLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.md,
  },
  replyInput: {
    minHeight: 140,
    maxHeight: 280,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: fontSize.xs,
    alignSelf: 'flex-end',
  },

  // Flag modal
  flagPrompt: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  flagReason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  flagReasonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
