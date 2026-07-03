import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import {
  Card,
  LoadingSpinner,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface QualityScore {
  overallScore: number;
  tier: string;
  metrics: {
    responseTime: { value: number; score: number; label?: string };
    cancellationRate: { value: number; score: number; label?: string };
    completionRate: { value: number; score: number; label?: string };
    customerRating: { value: number; score: number; label?: string };
  };
}

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  platinum: { color: colors.tierPlatinum, bg: '#f0f4f8', icon: 'diamond' },
  gold: { color: colors.tierGold, bg: '#fef9c3', icon: 'trophy' },
  silver: { color: colors.tierSilver, bg: '#f3f4f6', icon: 'medal' },
  bronze: { color: colors.tierBronze, bg: '#fef3c7', icon: 'ribbon' },
};

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
        <Text style={styles.circularMax}>/100</Text>
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
    <Card style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>
        {value}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
      <View style={styles.metricBarBg}>
        <View
          style={[
            styles.metricBar,
            { width: `${progressWidth}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.metricScore}>{score}/100</Text>
    </Card>
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
          metrics: {
            responseTime: d.metrics?.responseTime || { value: 0, score: 0 },
            cancellationRate: d.metrics?.cancellationRate || { value: 0, score: 0 },
            completionRate: d.metrics?.completionRate || { value: 0, score: 0 },
            customerRating: d.metrics?.customerRating || { value: 0, score: 0 },
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
  const score = qualityData?.overallScore ?? 0;

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
          {/* Score Circle */}
          <Card style={styles.scoreCard}>
            <CircularProgress score={score} tier={tier} />

            {/* Tier Badge */}
            <View style={[styles.tierBadge, { backgroundColor: tierConfig.bg }]}>
              <Ionicons name={tierConfig.icon} size={18} color={tierConfig.color} />
              <Text style={[styles.tierText, { color: tierConfig.color }]}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
              </Text>
            </View>

            <Text style={styles.tierDesc}>
              {tier === 'platinum'
                ? 'Outstanding! You are among the top sellers.'
                : tier === 'gold'
                ? 'Great performance! Keep up the excellent work.'
                : tier === 'silver'
                ? 'Good progress. A few improvements can get you to Gold.'
                : 'Getting started. Focus on response time and completion rate.'}
            </Text>
          </Card>

          {/* Metrics */}
          <Text style={styles.metricsTitle}>Performance Metrics</Text>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="time-outline"
              label="Response Time"
              value={
                qualityData?.metrics.responseTime.value != null
                  ? qualityData.metrics.responseTime.value < 1
                    ? `${Math.round(qualityData.metrics.responseTime.value * 60)}m`
                    : `${qualityData.metrics.responseTime.value.toFixed(1)}h`
                  : '-'
              }
              score={qualityData?.metrics.responseTime.score ?? 0}
              unit="avg"
              color={colors.info}
            />
            <MetricCard
              icon="close-circle-outline"
              label="Cancellation Rate"
              value={
                qualityData?.metrics.cancellationRate.value != null
                  ? `${qualityData.metrics.cancellationRate.value.toFixed(1)}%`
                  : '-'
              }
              score={qualityData?.metrics.cancellationRate.score ?? 0}
              unit=""
              color={colors.error}
            />
            <MetricCard
              icon="checkmark-done-outline"
              label="Completion Rate"
              value={
                qualityData?.metrics.completionRate.value != null
                  ? `${qualityData.metrics.completionRate.value.toFixed(1)}%`
                  : '-'
              }
              score={qualityData?.metrics.completionRate.score ?? 0}
              unit=""
              color={colors.success}
            />
            <MetricCard
              icon="star-outline"
              label="Customer Rating"
              value={
                qualityData?.metrics.customerRating.value != null
                  ? qualityData.metrics.customerRating.value.toFixed(1)
                  : '-'
              }
              score={qualityData?.metrics.customerRating.score ?? 0}
              unit="/5"
              color={colors.warning}
            />
          </View>

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
  },

  // Score Card
  scoreCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  circularWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  circularScore: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  circularMax: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.xl,
  },
  tierText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  tierDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
    maxWidth: 280,
  },

  // Metrics
  metricsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  metricsGrid: {
    gap: spacing.md,
  },
  metricCard: {
    marginBottom: 0,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metricLabel: {
    fontSize: fontSize.sm,
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
  metricBarBg: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  metricBar: {
    height: 8,
    borderRadius: 4,
  },
  metricScore: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },

  bottomSpacer: {
    height: spacing['3xl'],
  },
});
