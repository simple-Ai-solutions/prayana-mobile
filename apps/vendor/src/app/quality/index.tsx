import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import {
  Card,
  LoadingSpinner,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricDetail {
  value: number;
  score: number;
  // raw fields the API also returns, used for next-tier diagnosis
  averageHours?: number;
  percent?: number;
  average?: number;
}

interface QualityScore {
  overallScore: number;
  tier: string;
  badge?: string;
  metrics: {
    responseTime: MetricDetail;
    cancellationRate: MetricDetail;
    completionRate: MetricDetail;
    customerRating: MetricDetail;
  };
}

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  platinum: { color: colors.tierPlatinum, bg: '#f0f4f8', icon: 'diamond' },
  gold: { color: colors.tierGold, bg: '#fef9c3', icon: 'trophy' },
  silver: { color: colors.tierSilver, bg: '#f3f4f6', icon: 'medal' },
  bronze: { color: colors.tierBronze, bg: '#fef3c7', icon: 'ribbon' },
};

// Mirrors server SellerQualityScore thresholds + COMMISSION_RATES (see PWA
// QualityScoreCard.jsx TIER_THRESHOLDS).
const TIER_THRESHOLDS = [
  { tier: 'platinum', min: 90, commission: 5, label: 'Platinum' },
  { tier: 'gold', min: 75, commission: 8, label: 'Gold' },
  { tier: 'silver', min: 60, commission: 12, label: 'Silver' },
  { tier: 'bronze', min: 0, commission: 15, label: 'Bronze' },
];

// "How Quality Score works" — metric weights + targets (mirrors PWA).
const SCORE_FACTORS: {
  label: string;
  weight: string;
  target: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: 'Response Time', weight: '30%', target: '< 12 hours', icon: 'time-outline' },
  { label: 'Cancellation Rate', weight: '20%', target: '< 5%', icon: 'alert-circle-outline' },
  { label: 'Completion Rate', weight: '30%', target: '> 95%', icon: 'trending-up-outline' },
  { label: 'Customer Rating', weight: '20%', target: '> 4.5 stars', icon: 'ribbon-outline' },
];

// Tier ladder (mirrors PWA).
const TIER_LADDER: { tier: string; range: string; desc: string }[] = [
  { tier: 'Bronze', range: '0–60', desc: 'Getting started' },
  { tier: 'Silver', range: '61–75', desc: 'Good standing' },
  { tier: 'Gold', range: '76–90', desc: 'High performer' },
  { tier: 'Platinum', range: '91–100', desc: 'Top seller' },
];

// Improvement tips (mirrors PWA).
const IMPROVEMENT_TIPS: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tip: string;
}[] = [
  {
    icon: 'time-outline',
    color: colors.info,
    tip: 'Enable instant booking or confirm requests within 6 hours to boost response time score.',
  },
  {
    icon: 'alert-circle-outline',
    color: colors.error,
    tip: "Avoid cancelling confirmed bookings. Block dates in advance if you know you'll be unavailable.",
  },
  {
    icon: 'trending-up-outline',
    color: colors.success,
    tip: "Mark bookings as 'Completed' promptly and send reminders to reduce no-shows.",
  },
  {
    icon: 'ribbon-outline',
    color: colors.warning,
    tip: 'Ask happy customers to leave reviews. Reply to all feedback professionally.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextTierForScore(score: number) {
  if (score >= 90) return null;
  if (score >= 75) return TIER_THRESHOLDS[0]; // → platinum
  if (score >= 60) return TIER_THRESHOLDS[1]; // → gold
  return TIER_THRESHOLDS[2]; // → silver
}

// Prioritised list of the metrics with the most headroom (mirrors PWA
// diagnoseMetricGaps). Each entry: { label, suggestion, score }.
function diagnoseMetricGaps(q: QualityScore) {
  const gaps: { label: string; suggestion: string; score: number }[] = [];
  const m = q.metrics;

  if ((m.responseTime.score ?? 0) < 85) {
    const hrs = m.responseTime.averageHours ?? m.responseTime.value;
    gaps.push({
      label: 'Response time',
      score: m.responseTime.score,
      suggestion: `Reply to booking inquiries within 2h (current avg: ${Math.round(hrs)}h)`,
    });
  }
  if ((m.cancellationRate.score ?? 0) < 85) {
    const pct = m.cancellationRate.percent ?? m.cancellationRate.value;
    gaps.push({
      label: 'Cancellation rate',
      score: m.cancellationRate.score,
      suggestion: `Keep cancellation rate under 5% (current: ${pct.toFixed(1)}%)`,
    });
  }
  if ((m.completionRate.score ?? 0) < 85) {
    const pct = m.completionRate.percent ?? m.completionRate.value;
    gaps.push({
      label: 'Completion rate',
      score: m.completionRate.score,
      suggestion: `Mark bookings as completed promptly after the activity (current: ${pct.toFixed(0)}%)`,
    });
  }
  if ((m.customerRating.score ?? 0) < 85) {
    const avg = m.customerRating.average ?? m.customerRating.value;
    gaps.push({
      label: 'Customer rating',
      score: m.customerRating.score,
      suggestion: `Push average rating toward 4.5★+ — message customers post-activity asking for reviews (current: ${avg.toFixed(1)}★)`,
    });
  }
  return gaps.sort((a, b) => a.score - b.score).slice(0, 3);
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularProgress({ score, tier }: { score: number; tier: string }) {
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.bronze;

  return (
    <View style={styles.circularWrap}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.gray[200]}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tierConfig.color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.circularCenter}>
        <Text style={styles.circularScore}>{score}</Text>
        <Text style={styles.circularMax}>out of 100</Text>
      </View>
    </View>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  score,
  unit,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  score: number;
  unit: string;
  color: string;
}) {
  const progressWidth = Math.min(Math.max(score, 0), 100);

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIconWrap, { backgroundColor: color + '1a' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>
        {value}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
      <View style={styles.metricBarRow}>
        <View style={styles.metricBarBg}>
          <View
            style={[
              styles.metricBar,
              { width: `${progressWidth}%`, backgroundColor: colors.primary[500] },
            ]}
          />
        </View>
        <Text style={styles.metricScore}>{Math.round(score)}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QualityScreen() {
  const router = useRouter();
  const { businessAccount } = useBusinessStore();

  const [qualityData, setQualityData] = useState<QualityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScore = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res = await businessAPI.getQualityScore(businessAccount._id);
      const d = res?.data || res?.qualityScore || res;
      if (d) {
        setQualityData({
          overallScore: d.overallScore ?? d.score ?? 0,
          tier: d.tier || 'bronze',
          badge: d.badge,
          metrics: {
            responseTime: d.metrics?.responseTime || d.responseTime || { value: 0, score: 0 },
            cancellationRate: d.metrics?.cancellationRate || d.cancellationRate || { value: 0, score: 0 },
            completionRate: d.metrics?.completionRate || d.completionRate || { value: 0, score: 0 },
            customerRating: d.metrics?.customerRating || d.customerRating || { value: 0, score: 0 },
          },
        });
      }
    } catch (err) {
      console.warn('[Quality] fetch error:', err);
    }
  }, [businessAccount?._id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchScore();
    setLoading(false);
  }, [fetchScore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchScore();
    setRefreshing(false);
  }, [fetchScore]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tier = qualityData?.tier || 'bronze';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const score = Math.round(qualityData?.overallScore ?? 0);

  // Helpers to read a metric's raw display value with the same fallbacks as PWA.
  const responseValue = () => {
    const m = qualityData?.metrics.responseTime;
    const hrs = m?.averageHours ?? m?.value;
    return hrs != null ? `${Math.round(hrs)}h` : '-';
  };
  const cancellationValue = () => {
    const m = qualityData?.metrics.cancellationRate;
    const pct = m?.percent ?? m?.value;
    return pct != null ? `${pct.toFixed(1)}%` : '-';
  };
  const completionValue = () => {
    const m = qualityData?.metrics.completionRate;
    const pct = m?.percent ?? m?.value;
    return pct != null ? `${pct.toFixed(0)}%` : '-';
  };
  const ratingValue = () => {
    const m = qualityData?.metrics.customerRating;
    const avg = m?.average ?? m?.value;
    return avg != null ? avg.toFixed(1) : '-';
  };

  const nextTier = nextTierForScore(score);
  const gaps = qualityData ? diagnoseMetricGaps(qualityData) : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quality Score</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingSpinner fullScreen message="Loading quality score..." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
          }
        >
          {/* ── How Quality Score works ─────────────────────────────── */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
              </View>
              <View style={styles.infoHeaderText}>
                <Text style={styles.infoTitle}>How Quality Score works</Text>
                <Text style={styles.infoSubtitle}>
                  Your score (0–100) is calculated daily based on 4 metrics. Higher scores unlock
                  better search rankings and seller badges visible to customers.
                </Text>
              </View>
            </View>

            <View style={styles.factorGrid}>
              {SCORE_FACTORS.map((f) => (
                <View key={f.label} style={styles.factorTile}>
                  <View style={styles.factorIconWrap}>
                    <Ionicons name={f.icon} size={16} color={colors.primary[500]} />
                  </View>
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorWeight}>{f.weight} weight</Text>
                  <Text style={styles.factorTarget}>Target: {f.target}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Tier ladder ─────────────────────────────────────────── */}
          <View style={styles.tierLadderGrid}>
            {TIER_LADDER.map((t) => {
              const cfg = TIER_CONFIG[t.tier.toLowerCase()] || TIER_CONFIG.bronze;
              return (
                <View key={t.tier} style={styles.tierLadderTile}>
                  <View style={[styles.tierLadderBadge, { backgroundColor: cfg.color }]}>
                    <Text style={styles.tierLadderBadgeText}>{t.tier}</Text>
                  </View>
                  <Text style={styles.tierLadderRange}>{t.range}</Text>
                  <Text style={styles.tierLadderDesc}>{t.desc}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Your Quality Score ──────────────────────────────────── */}
          <Card style={styles.scoreCard}>
            <View style={styles.scoreCardHeader}>
              <View style={styles.scoreCardHeaderText}>
                <Text style={styles.scoreCardTitle}>Your Quality Score</Text>
                <Text style={styles.scoreCardSubtitle}>Updated daily based on your performance</Text>
              </View>
              <View style={[styles.tierBadge, { backgroundColor: tierConfig.bg }]}>
                <Ionicons name={tierConfig.icon} size={16} color={tierConfig.color} />
                <Text style={[styles.tierText, { color: tierConfig.color }]}>
                  {qualityData?.badge || `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`}
                </Text>
              </View>
            </View>

            <CircularProgress score={score} tier={tier} />

            {/* Metrics grid */}
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="time-outline"
                label="Response Time"
                value={responseValue()}
                score={qualityData?.metrics.responseTime.score ?? 0}
                unit=""
                color={colors.info}
              />
              <MetricCard
                icon="close-circle-outline"
                label="Cancellation"
                value={cancellationValue()}
                score={qualityData?.metrics.cancellationRate.score ?? 0}
                unit=""
                color={colors.error}
              />
              <MetricCard
                icon="checkmark-done-outline"
                label="Completion"
                value={completionValue()}
                score={qualityData?.metrics.completionRate.score ?? 0}
                unit=""
                color={colors.success}
              />
              <MetricCard
                icon="star-outline"
                label="Avg Rating"
                value={ratingValue()}
                score={qualityData?.metrics.customerRating.score ?? 0}
                unit=""
                color={colors.warning}
              />
            </View>

            {/* Next-tier guidance */}
            {!nextTier ? (
              <View style={styles.topTierBox}>
                <View style={styles.guidanceIconWrap}>
                  <Ionicons name="ribbon" size={20} color="#fff" />
                </View>
                <View style={styles.guidanceTextWrap}>
                  <Text style={styles.topTierTitle}>You&apos;re at the top tier!</Text>
                  <Text style={styles.topTierBody}>
                    Platinum sellers pay just 5% commission. Hold this score to keep your rate.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.nextTierBox}>
                <View style={styles.nextTierHeader}>
                  <View style={styles.guidanceIconWrap}>
                    <Ionicons name="trending-up" size={20} color="#fff" />
                  </View>
                  <View style={styles.guidanceTextWrap}>
                    <Text style={styles.nextTierTitle}>
                      {nextTier.min - score} point{nextTier.min - score !== 1 ? 's' : ''} away from{' '}
                      {nextTier.label} ({nextTier.commission}% commission)
                    </Text>
                    <Text style={styles.nextTierBody}>
                      Lower commission means more in your pocket per booking.
                    </Text>
                  </View>
                </View>
                {gaps.length > 0 && (
                  <View style={styles.gapList}>
                    {gaps.map((g) => (
                      <View key={g.label} style={styles.gapRow}>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={colors.primary[500]}
                          style={styles.gapArrow}
                        />
                        <Text style={styles.gapText}>
                          <Text style={styles.gapLabel}>{g.label}: </Text>
                          {g.suggestion}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Card>

          {/* ── Tips to improve your score ──────────────────────────── */}
          <Card style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Tips to improve your score</Text>
            <View style={styles.tipsList}>
              {IMPROVEMENT_TIPS.map((t) => (
                <View key={t.tip} style={styles.tipRow}>
                  <View style={[styles.tipIconWrap, { backgroundColor: t.color + '1a' }]}>
                    <Ionicons name={t.icon} size={16} color={t.color} />
                  </View>
                  <Text style={styles.tipText}>{t.tip}</Text>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
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
    gap: spacing.xl,
  },

  // ── Info card (How Quality Score works) ──
  infoCard: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeaderText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  infoSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  factorTile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary[100],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  factorIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  factorLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  factorWeight: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
    marginTop: spacing.xs,
  },
  factorTarget: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Tier ladder ──
  tierLadderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tierLadderTile: {
    flexGrow: 1,
    flexBasis: '44%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  tierLadderBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  tierLadderBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  tierLadderRange: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  tierLadderDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Score Card ──
  scoreCard: {
    padding: spacing.lg,
  },
  scoreCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scoreCardHeaderText: {
    flex: 1,
  },
  scoreCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  scoreCardSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  circularWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  circularCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  circularScore: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  circularMax: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  tierText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },

  // ── Metrics ──
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '44%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  metricUnit: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    color: colors.textTertiary,
  },
  metricBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  metricBar: {
    height: 6,
    borderRadius: 3,
  },
  metricScore: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    minWidth: 18,
    textAlign: 'right',
  },

  // ── Next-tier guidance ──
  guidanceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceTextWrap: {
    flex: 1,
  },
  topTierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
  },
  topTierTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[700],
  },
  topTierBody: {
    fontSize: fontSize.xs,
    color: colors.primary[600],
    marginTop: 2,
  },
  nextTierBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
  },
  nextTierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  nextTierTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[700],
  },
  nextTierBody: {
    fontSize: fontSize.xs,
    color: colors.primary[600],
    marginTop: 2,
  },
  gapList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  gapArrow: {
    marginTop: 2,
  },
  gapText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.primary[700],
    lineHeight: 17,
  },
  gapLabel: {
    fontWeight: fontWeight.bold,
  },

  // ── Tips ──
  tipsCard: {
    padding: spacing.lg,
  },
  tipsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  tipsList: {
    gap: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingTop: 6,
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
