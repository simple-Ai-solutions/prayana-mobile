// Refer & Earn — RN port of the web profile's ReferAndEarnCard
// (components/profile/ReferAndEarnCard.jsx). Same data source (GET
// /referral/me), same layout: emerald hero with the code + share row,
// stats trio, "How it works" steps, recent invites.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useTheme,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '@prayana/shared-ui';
import { referralAPI } from '@prayana/shared-services';

interface ReferralData {
  referralCode: string;
  shareUrl: string;
  shareMessage: string;
  rewards: {
    signupReferee: { planner: number };
    bookingReferrer: { travel: number; planner: number };
    bookingReferee: { travel: number; planner: number };
  };
  stats: {
    totalReferrals: number;
    signupOnly: number;
    completed: number;
    travelEarned: number;
    plannerEarned: number;
    recent: Array<{ name?: string; status?: string; date?: string }>;
  };
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Signed up', color: '#f59e0b', icon: 'time-outline' },
  completed: { label: 'Booked', color: '#059669', icon: 'checkmark-circle-outline' },
};

export default function ReferEarnScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await referralAPI.getMe();
        if (!res?.success) throw new Error(res?.message || 'Failed to load');
        setData(res.data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyLink = async () => {
    if (!data?.shareUrl) return;
    await Clipboard.setStringAsync(data.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareNative = async () => {
    if (!data?.shareMessage) return;
    try {
      await Share.share({ message: data.shareMessage });
    } catch {
      // User cancelled — silent.
    }
  };

  const shareWhatsApp = () => {
    if (!data?.shareMessage) return;
    const url = `https://wa.me/?text=${encodeURIComponent(data.shareMessage)}`;
    Linking.openURL(url).catch(() => shareNative());
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Refer &amp; Earn</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : error || !data ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={themeColors.textTertiary} />
          <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
            {error || "Couldn't load Refer & Earn"}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* ===== Hero: emerald gradient, code + share (web parity) ===== */}
          <LinearGradient
            colors={['#059669', '#0d9488', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroEyebrow}>REFER &amp; EARN</Text>
            <Text style={styles.heroTitle}>Invite friends.{'\n'}Earn together.</Text>
            <Text style={styles.heroBody}>
              They get <Text style={styles.heroBold}>{data.rewards.signupReferee.planner} Planner Credits</Text> to
              start. You both unlock <Text style={styles.heroBold}>₹{data.rewards.bookingReferrer.travel}</Text> +
              Planner Credits when they complete their first booking.
            </Text>

            {/* Code chip */}
            <View style={styles.codeChip}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codeLabel}>YOUR CODE</Text>
                <Text style={styles.codeValue}>{data.referralCode}</Text>
              </View>
              <TouchableOpacity onPress={copyLink} style={styles.copyBtn} activeOpacity={0.8}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#ffffff" />
                <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy link'}</Text>
              </TouchableOpacity>
            </View>

            {/* Share buttons */}
            <View style={styles.shareRow}>
              <TouchableOpacity onPress={shareWhatsApp} style={[styles.shareBtn, styles.waBtn]} activeOpacity={0.85}>
                <Ionicons name="logo-whatsapp" size={16} color="#ffffff" />
                <Text style={styles.shareBtnText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={shareNative} style={[styles.shareBtn, styles.glassBtn]} activeOpacity={0.85}>
                <Ionicons name="share-social-outline" size={16} color="#ffffff" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.shareUrl}>{data.shareUrl}</Text>
          </LinearGradient>

          {/* ===== Stats trio ===== */}
          <View style={styles.statsRow}>
            <StatBox
              icon="people-outline"
              label="Friends invited"
              value={String(data.stats.totalReferrals)}
              accent="#059669"
              themeColors={themeColors}
            />
            <StatBox
              icon="trending-up-outline"
              label="Completed bookings"
              value={String(data.stats.completed)}
              accent="#0d9488"
              themeColors={themeColors}
            />
            <StatBox
              icon="gift-outline"
              label="Travel credits"
              value={`₹${(data.stats.travelEarned || 0).toLocaleString('en-IN')}`}
              accent="#d97706"
              themeColors={themeColors}
            />
          </View>

          {/* ===== How it works ===== */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="sparkles-outline" size={15} color="#059669" />
              <Text style={[styles.cardTitle, { color: themeColors.text }]}>How it works</Text>
            </View>
            <Step
              n={1}
              title="Share your code"
              body="Send the link via WhatsApp or any chat app. Friends sign up at prayanaai.com with your code."
              themeColors={themeColors}
            />
            <Step
              n={2}
              title="They get a head start"
              body={`Instant +${data.rewards.signupReferee.planner} Planner Credits to power up to ${Math.floor(
                data.rewards.signupReferee.planner / 5,
              )} Quick Itineraries.`}
              themeColors={themeColors}
            />
            <Step
              n={3}
              title="You both earn when they book"
              body={`When your friend completes their first booking, you get +${data.rewards.bookingReferrer.travel} Travel Credits and +${data.rewards.bookingReferrer.planner} Planner Credits. They get +${data.rewards.bookingReferee.travel} Travel Credits.`}
              themeColors={themeColors}
              last
            />
          </View>

          {/* ===== Recent invites ===== */}
          {data.stats.recent?.length > 0 && (
            <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: spacing.md }]}>
                Recent invites
              </Text>
              {data.stats.recent.map((r, idx) => {
                const cfg = STATUS_LABEL[r.status || 'pending'] || STATUS_LABEL.pending;
                return (
                  <View key={idx} style={styles.recentRow}>
                    <Text style={[styles.recentName, { color: themeColors.textSecondary }]} numberOfLines={1}>
                      {r.name || 'A friend'}
                    </Text>
                    <View style={styles.recentStatus}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[styles.recentStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatBox({
  icon,
  label,
  value,
  accent,
  themeColors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
  themeColors: any;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={[styles.statValue, { color: themeColors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function Step({
  n,
  title,
  body,
  themeColors,
  last = false,
}: {
  n: number;
  title: string;
  body: string;
  themeColors: any;
  last?: boolean;
}) {
  return (
    <View style={[styles.stepRow, !last && styles.stepGap]}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.stepBody, { color: themeColors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 32 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },

  // Hero
  hero: {
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    ...shadow.md,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 2.2,
    color: 'rgba(209,250,229,0.95)',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.sm,
  },
  heroBody: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  heroBold: { fontWeight: fontWeight.bold, color: '#ffffff' },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  codeLabel: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.8,
    color: 'rgba(209,250,229,0.95)',
    marginBottom: 2,
  },
  codeValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: 4,
    color: '#ffffff',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copyBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: '#ffffff' },
  shareRow: { flexDirection: 'row', gap: spacing.sm },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
  },
  waBtn: { backgroundColor: '#25D366' },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  shareBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#ffffff' },
  shareUrl: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: spacing.md,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  statLabel: { fontSize: 10.5, lineHeight: 14 },

  // Cards
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Steps
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepGap: { marginBottom: spacing.md },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(5,150,105,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#059669' },
  stepTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: 2 },
  stepBody: { fontSize: fontSize.xs, lineHeight: 18 },

  // Recent
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  recentName: { fontSize: fontSize.sm, flex: 1, marginRight: spacing.md },
  recentStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentStatusText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
