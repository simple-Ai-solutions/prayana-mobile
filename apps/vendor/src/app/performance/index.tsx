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
  useTheme,
} from '@prayana/shared-ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '../../theme/vendorColors';
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
  listingTitle?: string;
  helpfulVotes?: number;
}

interface ReviewSummary {
  totalReviews: number;
  avgRating: number;
  responseRate: number; // percent
  respondedCount: number;
  distribution: Record<string, number>;
}

type ReviewFilter = 'all' | '5star' | '4star' | '3star' | '2star' | '1star' | 'unanswered' | 'responded';

const REVIEW_FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: '5star', label: '5★' },
  { id: '4star', label: '4★' },
  { id: '3star', label: '3★' },
  { id: '2star', label: '2★' },
  { id: '1star', label: '1★' },
  { id: 'unanswered', label: 'Needs reply' },
  { id: 'responded', label: 'Replied' },
];

// Static reference content mirrored from the web Quality Score view.
const QUALITY_FACTORS: { label: string; weight: string; target: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Response Time', weight: '30%', target: '< 12 hours', icon: 'time-outline' },
  { label: 'Cancellation Rate', weight: '20%', target: '< 5%', icon: 'alert-circle-outline' },
  { label: 'Completion Rate', weight: '30%', target: '> 95%', icon: 'trending-up-outline' },
  { label: 'Customer Rating', weight: '20%', target: '> 4.5 stars', icon: 'ribbon-outline' },
];

const QUALITY_TIERS: { tier: string; range: string; desc: string; color: string }[] = [
  { tier: 'Bronze', range: '0–60', desc: 'Getting started', color: '#b45309' },
  { tier: 'Silver', range: '61–75', desc: 'Good standing', color: '#94a3b8' },
  { tier: 'Gold', range: '76–90', desc: 'High performer', color: '#d97706' },
  { tier: 'Platinum', range: '91–100', desc: 'Top seller', color: colors.primary[600] },
];

const QUALITY_TIPS: { icon: keyof typeof Ionicons.glyphMap; color: string; tip: string }[] = [
  { icon: 'time-outline', color: colors.primary[500], tip: 'Enable instant booking or confirm requests within 6 hours to boost response time score.' },
  { icon: 'alert-circle-outline', color: colors.error, tip: "Avoid cancelling confirmed bookings. Block dates in advance if you know you'll be unavailable." },
  { icon: 'trending-up-outline', color: colors.success, tip: "Mark bookings as 'Completed' promptly and send reminders to reduce no-shows." },
  { icon: 'ribbon-outline', color: colors.warning, tip: 'Ask happy customers to leave reviews. Reply to all feedback professionally.' },
];

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
  const rawList: any[] = raw?.reviews ?? raw?.data?.reviews ?? raw?.data ?? [];
  const reviews: Review[] = (Array.isArray(rawList) ? rawList : []).map((r) => ({
    _id: r._id,
    rating: Number(r.rating ?? 0),
    comment: r.comment,
    userName: r.userName,
    userAvatar: r.userAvatar,
    createdAt: r.createdAt,
    isVerifiedBooking: r.isVerifiedBooking,
    ownerResponse: r.ownerResponse,
    isFlagged: r.isFlagged ?? r.flaggedByVendor,
    listingTitle: r.listingId?.title ?? r.listingTitle,
    helpfulVotes: Number(r.helpfulVotes ?? 0),
  }));
  const s = raw?.summary ?? raw?.data?.summary ?? null;
  const respondedFromList = reviews.filter((r) => r.ownerResponse?.comment).length;
  const summary: ReviewSummary | null = s
    ? {
        totalReviews: Number(s.totalReviews ?? s.total ?? reviews.length),
        avgRating: Number(s.avgRating ?? s.average ?? 0),
        responseRate: Number(s.responseRate ?? 0),
        respondedCount: Number(s.respondedCount ?? respondedFromList),
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

      {/* How Quality Score works */}
      <View style={[styles.infoCard, { backgroundColor: colors.primary[50], borderColor: colors.primary[100] }]}>
        <View style={styles.infoHead}>
          <View style={[styles.infoIcon, { backgroundColor: colors.primary[600] }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.infoTitle, { color: themeColors.text }]}>How Quality Score works</Text>
            <Text style={[styles.infoBody, { color: themeColors.textSecondary }]}>
              Your score (0–100) is calculated daily based on 4 metrics. Higher scores unlock better search
              rankings and seller badges visible to customers.
            </Text>
          </View>
        </View>
        <View style={styles.factorGrid}>
          {QUALITY_FACTORS.map((f) => (
            <View
              key={f.label}
              style={[styles.factorTile, { backgroundColor: themeColors.surface, borderColor: colors.primary[100] }]}
            >
              <View style={[styles.factorTileIcon, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name={f.icon} size={16} color={colors.primary[600]} />
              </View>
              <Text style={[styles.factorTileLabel, { color: themeColors.text }]}>{f.label}</Text>
              <Text style={[styles.factorTileWeight, { color: colors.primary[600] }]}>{f.weight} weight</Text>
              <Text style={[styles.factorTileTarget, { color: themeColors.textTertiary }]}>Target: {f.target}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tier ladder */}
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Seller tiers</Text>
      <View style={styles.tierGrid}>
        {QUALITY_TIERS.map((t) => (
          <View
            key={t.tier}
            style={[styles.tierCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={[styles.tierChip, { backgroundColor: t.color }]}>
              <Text style={styles.tierChipText}>{t.tier}</Text>
            </View>
            <Text style={[styles.tierRange, { color: themeColors.text }]}>{t.range}</Text>
            <Text style={[styles.tierDesc, { color: themeColors.textTertiary }]}>{t.desc}</Text>
          </View>
        ))}
      </View>

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

      {/* Tips to improve your score */}
      <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
        Tips to improve your score
      </Text>
      <Card>
        {QUALITY_TIPS.map((t, i) => (
          <View key={t.tip} style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: `${t.color}22` }]}>
              <Ionicons name={t.icon} size={16} color={t.color} />
            </View>
            <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{t.tip}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── Reviews Tab ────────────────────────────────────────────────────────────

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
  const { themeColors } = useTheme();
  const borderColor = highlight ? colors.warning : warn ? colors.error : themeColors.border;
  const valueColor = highlight ? colors.warning : warn ? colors.error : themeColors.text;
  return (
    <View style={[styles.statTile, { backgroundColor: themeColors.surface, borderColor }]}>
      <Text style={[styles.statTileLabel, { color: themeColors.textTertiary }]}>{label}</Text>
      <Text style={[styles.statTileValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function ReviewsTab({
  reviews,
  summary,
  loading,
  refreshing,
  onRefresh,
  onReply,
  onFlag,
  filter,
  onFilterChange,
}: {
  reviews: Review[];
  summary: ReviewSummary | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onReply: (r: Review) => void;
  onFlag: (r: Review) => void;
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
}) {
  const { themeColors } = useTheme();

  const filtered = useMemo(() => {
    if (filter === 'all') return reviews;
    if (filter === 'responded') return reviews.filter((r) => !!r.ownerResponse?.comment);
    if (filter === 'unanswered') return reviews.filter((r) => !r.ownerResponse?.comment);
    if (filter.endsWith('star')) {
      const target = parseInt(filter[0], 10);
      return reviews.filter((r) => Math.round(r.rating) === target);
    }
    return reviews;
  }, [reviews, filter]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading reviews..." />;
  }

  const hasReviews = summary && summary.totalReviews > 0;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
      }
    >
      {/* Summary stats strip */}
      {hasReviews ? (
        <View style={styles.statStrip}>
          <StatTile label="Avg Rating" value={`${summary!.avgRating.toFixed(1)} ★`} highlight />
          <StatTile label="Total Reviews" value={String(summary!.totalReviews)} />
          <StatTile label="Replied" value={`${summary!.respondedCount} / ${summary!.totalReviews}`} />
          <StatTile
            label="Response Rate"
            value={`${Math.round(summary!.responseRate)}%`}
            warn={summary!.responseRate < 70}
          />
        </View>
      ) : null}

      {/* Rating distribution */}
      {hasReviews ? (
        <Card style={styles.distCard}>
          <Text style={[styles.distTitle, { color: themeColors.textTertiary }]}>RATING DISTRIBUTION</Text>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = summary!.distribution?.[r] ?? summary!.distribution?.[String(r)] ?? 0;
            const pct = summary!.totalReviews > 0 ? (count / summary!.totalReviews) * 100 : 0;
            return (
              <View key={r} style={styles.distRow}>
                <View style={styles.distLabel}>
                  <Text style={[styles.distLabelText, { color: themeColors.text }]}>{r}</Text>
                  <Ionicons name="star" size={11} color={colors.warning} />
                </View>
                <View style={[styles.distTrack, { backgroundColor: themeColors.border }]}>
                  <View style={[styles.distFill, { width: `${pct}%`, backgroundColor: colors.warning }]} />
                </View>
                <Text style={[styles.distCount, { color: themeColors.textTertiary }]}>{count}</Text>
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
        {REVIEW_FILTERS.map((opt) => {
          const active = filter === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.7}
              onPress={() => onFilterChange(opt.id)}
              style={[
                styles.filterPill,
                active
                  ? { backgroundColor: colors.primary[500], borderColor: colors.primary[500] }
                  : { backgroundColor: themeColors.surface, borderColor: themeColors.border },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: active ? '#fff' : themeColors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={48} color={colors.gray[300]} />}
          title={filter === 'all' ? 'No reviews yet' : 'No reviews match this filter'}
          description="Once customers complete activities and leave reviews, they'll appear here. Great reviews help attract more bookings."
        />
      ) : (
        <View style={styles.reviewList}>
          {filtered.map((review) => {
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
                    {review.listingTitle ? (
                      <Text
                        style={[styles.listingText, { color: themeColors.textTertiary }]}
                        numberOfLines={1}
                      >
                        {review.listingTitle}
                      </Text>
                    ) : null}
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

                <View style={[styles.helpfulRow, { borderTopColor: themeColors.border }]}>
                  <Ionicons name="thumbs-up-outline" size={13} color={themeColors.textTertiary} />
                  <Text style={[styles.helpfulText, { color: themeColors.textTertiary }]}>
                    {review.helpfulVotes || 0} helpful
                  </Text>
                </View>

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
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

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
          <Ionicons name="chevron-back" size={24} color={themeColors.text} />
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
            { key: 'quality', label: 'Quality Score' },
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

      {/* Active-tab description (mirrors web) */}
      <View style={[styles.tabDescWrap, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <Text style={[styles.tabDesc, { color: themeColors.textSecondary }]}>
          {tab === 'quality'
            ? 'Your performance metrics and seller tier'
            : 'Read and respond to feedback from your customers'}
        </Text>
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
          filter={reviewFilter}
          onFilterChange={setReviewFilter}
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

  // Tab description
  tabDescWrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  tabDesc: {
    fontSize: fontSize.sm,
  },

  // Quality info / explainer
  infoCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoHead: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  infoBody: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 2,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  factorTile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  factorTileIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  factorTileLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  factorTileWeight: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  factorTileTarget: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Tier ladder
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tierCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  tierChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  tierChipText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  tierRange: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  tierDesc: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Tips
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    paddingTop: spacing.xs,
  },

  // Reviews summary stat strip
  statStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statTileLabel: {
    fontSize: fontSize.xs,
  },
  statTileValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },

  // Distribution
  distCard: {
    marginBottom: spacing.lg,
  },
  distTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: 3,
  },
  distLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 28,
  },
  distLabelText: {
    fontSize: fontSize.sm,
  },
  distTrack: {
    flex: 1,
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  distFill: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  distCount: {
    width: 32,
    textAlign: 'right',
    fontSize: fontSize.xs,
  },

  // Filter pills
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // Review card extras
  listingText: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  helpfulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  helpfulText: {
    fontSize: fontSize.xs,
  },
});
