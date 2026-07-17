import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Card,
  StatusBadge,
  LoadingSpinner,
  Button,
  PrayanaLogo,
} from '../../components/ui';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
} from '../../theme/vendorColors';
import { useAuth } from '@prayana/shared-hooks';
import { businessAPI } from '@prayana/shared-services';
import useBusinessStore from '@prayana/shared-stores/src/useBusinessStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STAT_CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

// Current Vendor / Supplier Agreement version (mirrors onboarding's VENDOR_AGREEMENT
// and lib/legal/registry.js "vendor-agreement"). Vendors must accept this before
// they can publish listings.
const CURRENT_AGREEMENT_VERSION = '1.0.0';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  listings?: { total?: number; active?: number; draft?: number; paused?: number };
  bookings?: {
    total?: number;
    pending?: number;
    confirmed?: number;
    completed?: number;
    cancelled?: number;
  };
  totalRevenue?: number; // paise
  recentBookings?: RecentBooking[];
  topListings?: TopListing[];
}

interface RecentBooking {
  _id: string;
  status: string;
  customerName?: string;
  bookingDate?: string;
  activity?: { title?: string; images?: { url?: string }[] };
  activitySnapshot?: { title?: string };
  pricing?: { totalAmount?: number };
}

interface TopListing {
  _id: string;
  title: string;
  stats?: { totalBookings?: number };
  rating?: { average?: number };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  bgColor: string;
}

function StatCard({ label, value, subtitle, icon, accentColor, bgColor }: StatCardProps) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statTop}>
        <View style={styles.statTextCol}>
          <Text style={styles.statLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
        </View>
        <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={20} color={accentColor} />
        </View>
      </View>
      {!!subtitle && (
        <Text style={styles.statSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </Card>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

interface AlertBannerProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  ctaLabel?: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onDismiss?: () => void;
}

// Per-tone palette: `accent` paints the icon tile + CTA button, `title`/`msg`
// tint the copy, and `bg`/`border` set the card. Warning uses amber (not the
// theme's yellow) so it reads as a gentle "action required", not an error.
const TONE_MAP = {
  warning: { accent: '#d97706', bg: '#fffbeb', border: '#fcd34d', title: '#92400e', msg: '#b45309' },
  error: { accent: colors.error, bg: colors.errorLight, border: '#fca5a5', title: '#b91c1c', msg: '#dc2626' },
  info: {
    accent: colors.primary[500],
    bg: colors.primary[50],
    border: colors.primary[200],
    title: colors.primary[700],
    msg: colors.primary[600],
  },
} as const;

function AlertBanner({
  icon,
  tone,
  title,
  message,
  ctaLabel,
  ctaIcon,
  onPress,
  onDismiss,
}: AlertBannerProps) {
  const t = TONE_MAP[tone];
  return (
    <View style={[styles.alertBanner, { backgroundColor: t.bg, borderColor: t.border }]}>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={8} style={styles.alertDismiss}>
          <Ionicons name="close" size={16} color={t.accent} />
        </TouchableOpacity>
      )}
      <View style={styles.alertHeaderRow}>
        <View style={[styles.alertIcon, { backgroundColor: t.accent }]}>
          <Ionicons name={icon} size={18} color="#fff" />
        </View>
        <View style={styles.alertBody}>
          <Text style={[styles.alertTitle, { color: t.title }]}>{title}</Text>
          <Text style={[styles.alertMessage, { color: t.msg }]}>{message}</Text>
        </View>
      </View>
      {!!ctaLabel && onPress && (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={[styles.alertCtaBtn, { backgroundColor: t.accent }]}
        >
          {ctaIcon && (
            <Ionicons name={ctaIcon} size={15} color="#fff" style={styles.alertCtaIcon} />
          )}
          <Text style={styles.alertCtaBtnText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  trailing?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function QuickAction({ icon, label, desc, trailing = 'arrow-forward', onPress }: QuickActionProps) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary[500]} />
      </View>
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionLabel}>{label}</Text>
        <Text style={styles.quickActionDesc} numberOfLines={1}>
          {desc}
        </Text>
      </View>
      <Ionicons name={trailing} size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────

function BookingRow({ booking, onPress }: { booking: RecentBooking; onPress: () => void }) {
  const activityName =
    booking.activitySnapshot?.title || booking.activity?.title || 'Activity';
  const customerName = booking.customerName || 'Customer';
  const amount = booking.pricing?.totalAmount ?? 0;
  const dateStr = booking.bookingDate || '';
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';
  const imageUrl = booking.activity?.images?.[0]?.url;

  return (
    <TouchableOpacity style={styles.bookingRow} onPress={onPress} activeOpacity={0.7}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.bookingThumb} />
      ) : (
        <View style={[styles.bookingThumb, styles.bookingThumbFallback]}>
          <Ionicons name="ticket-outline" size={18} color={colors.primary[500]} />
        </View>
      )}
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingActivity} numberOfLines={1}>
          {activityName}
        </Text>
        <Text style={styles.bookingCustomer} numberOfLines={1}>
          {customerName}
          {formattedDate ? ` · ${formattedDate}` : ''}
        </Text>
      </View>
      <View style={styles.bookingRight}>
        <Text style={styles.bookingAmount}>
          {'₹'}{amount.toLocaleString('en-IN')}
        </Text>
        <StatusBadge status={booking.status} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonStatCard() {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.skeletonBox, { width: 70, height: 12 }]} />
      <View style={[styles.skeletonBox, { width: 60, height: 24, marginTop: spacing.sm }]} />
      <View style={[styles.skeletonBox, { width: 90, height: 11, marginTop: spacing.sm }]} />
    </Card>
  );
}

// ─── Setup Checklist ──────────────────────────────────────────────────────────

// A tax detail counts as done once verified through any of the KYC channels.
// Mirrors the same-named helper the Settings screen uses.
const isVerified = (s?: string) =>
  s === 'verified' || s === 'auto_verified' || s === 'manually_verified';

// Teal → cyan header, deliberately off the blue brand so the progress card reads
// as a distinct "getting started" surface rather than another primary action.
const SETUP_GRADIENT = ['#0d9488', '#2dd4bf'] as const;

interface SetupTask {
  key: string;
  label: string;
  done: boolean;
  onPress: () => void;
}

// Thin ring that fills clockwise with completion. Built on react-native-svg
// (already used by the tab bar) so it stays crisp at any size.
function ProgressRing({ percent, size = 44, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={r} stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={r}
        stroke="#ffffff"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}

// Collapsible "Continue setup" card. Hides itself entirely once every task is
// done, so a fully-set-up vendor never sees dead space.
function SetupChecklist({ tasks }: { tasks: SetupTask[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  if (doneCount >= total) return null;

  return (
    <View style={styles.section}>
      <View style={styles.setupCard}>
        <LinearGradient
          colors={SETUP_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.setupHeaderGradient}
        >
          <TouchableOpacity
            style={styles.setupHeader}
            activeOpacity={0.85}
            onPress={() => setCollapsed((c) => !c)}
          >
            <View style={styles.setupRing}>
              <ProgressRing percent={percent} />
              <View style={styles.setupRingLabel}>
                <Text style={styles.setupRingText}>{percent}%</Text>
              </View>
            </View>
            <View style={styles.setupHeaderText}>
              <Text style={styles.setupTitle}>Continue setup</Text>
              <Text style={styles.setupSubtitle}>
                {doneCount}/{total} done
              </Text>
            </View>
            <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#ffffff" />
          </TouchableOpacity>
        </LinearGradient>

        {!collapsed && (
          <View style={styles.setupList}>
            {tasks.map((task, index) => (
              <React.Fragment key={task.key}>
                <TouchableOpacity style={styles.setupRow} activeOpacity={0.7} onPress={task.onPress}>
                  <Ionicons
                    name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={task.done ? colors.success : colors.textTertiary}
                  />
                  <Text
                    style={[styles.setupRowLabel, task.done && styles.setupRowLabelDone]}
                    numberOfLines={1}
                  >
                    {task.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
                {index < tasks.length - 1 && <View style={styles.setupDivider} />}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { businessAccount, setOnboardingStep } = useBusinessStore();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payoutNudgeDismissed, setPayoutNudgeDismissed] = useState(false);

  const businessName = businessAccount?.businessName || businessAccount?.name || '';
  const firstName = (businessAccount?.contactName || businessName || '').split(' ')[0];

  // ── Fetch Dashboard ──────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    if (!businessAccount?._id) return;
    try {
      const res = await businessAPI.getDashboard();
      if (res?.success && res.data) {
        setData(res.data as DashboardData);
      } else if (res?.data || res?.dashboard) {
        setData((res.data || res.dashboard || res) as DashboardData);
      }
    } catch (err) {
      console.warn('[Dashboard] fetch error:', err);
    }
  }, [businessAccount?._id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await fetchDashboard();
    setLoading(false);
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const activeBookings =
    (data?.bookings?.pending ?? 0) + (data?.bookings?.confirmed ?? 0);
  const totalRevenueRupees = (data?.totalRevenue ?? 0) / 100;
  const avgRating = businessAccount?.stats?.averageRating;
  const totalReviews = businessAccount?.stats?.totalReviews ?? 0;
  const draftCount = data?.listings?.draft ?? 0;
  const verificationStatus = businessAccount?.verificationStatus;
  const payoutMissing =
    !businessAccount?.payoutDetails ||
    Object.keys(businessAccount.payoutDetails || {}).length === 0;
  const showPayoutNudge = payoutMissing && !payoutNudgeDismissed && !!businessAccount?._id;

  // Vendor Agreement: a vendor must accept the current version before publishing
  // or updating any listing. The business record carries acceptedVendorAgreements[]
  // once signed (onboarding step 2 / businessAPI.acceptVendorAgreement). There is a
  // single current version today, so a non-empty list means it's accepted.
  const acceptedAgreements = businessAccount?.acceptedVendorAgreements;
  const agreementAccepted = Array.isArray(acceptedAgreements) && acceptedAgreements.length > 0;
  const showAgreementNudge = !!businessAccount?._id && !agreementAccepted;

  // "Review & accept" reuses the onboarding wizard's agreement step (step 2),
  // which records acceptance through the real API.
  const openAgreement = () => {
    setOnboardingStep(2);
    router.push('/onboarding');
  };

  const hasAlerts =
    showAgreementNudge ||
    showPayoutNudge ||
    verificationStatus === 'pending' ||
    verificationStatus === 'rejected' ||
    draftCount > 0;

  const recentBookings = data?.recentBookings ?? [];
  const topListings = data?.topListings ?? [];

  // ── Setup checklist ────────────────────────────────────────────────────────
  // Each task's done-state is read straight off the business record / dashboard
  // data, and tapping a row jumps to the screen that completes it. The card
  // hides itself once all seven are done (see SetupChecklist).
  const setupTasks: SetupTask[] = [
    {
      key: 'profile',
      label: 'Complete business profile',
      done: !!(
        businessAccount?.businessName &&
        businessAccount?.description &&
        businessAccount?.location?.city &&
        businessAccount?.location?.state
      ),
      onPress: () => router.push('/settings'),
    },
    {
      key: 'logo',
      label: 'Upload logo',
      done: !!businessAccount?.logo,
      onPress: () => router.push('/settings'),
    },
    {
      key: 'gstin',
      label: 'Verify GSTIN',
      done: isVerified(businessAccount?.gstDetails?.verificationStatus),
      onPress: () => router.push('/settings'),
    },
    {
      key: 'pan',
      label: 'Verify PAN',
      done: isVerified(businessAccount?.panDetails?.verificationStatus),
      onPress: () => router.push('/verification'),
    },
    {
      key: 'payout',
      label: 'Add payout bank account',
      done: !payoutMissing,
      onPress: () => router.push('/finance'),
    },
    {
      key: 'documents',
      label: 'Upload required documents',
      done:
        (businessAccount?.kycCompletionPercent ?? 0) >= 100 ||
        (businessAccount?.documents?.length ?? 0) >= 3,
      onPress: () => router.push('/verification'),
    },
    {
      key: 'listing',
      label: 'Create your first listing',
      done: (data?.listings?.total ?? 0) > 0,
      onPress: () => router.push('/activity/new'),
    },
  ];

  // ── No Business Account ──────────────────────────────────────────────────

  if (!businessAccount) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.onboardingCta}>
          <View style={styles.onboardingLogo}>
            <PrayanaLogo size={48} />
          </View>
          <Text style={styles.onboardingTitle}>Welcome to Partners Hub</Text>
          <Text style={styles.onboardingDesc}>
            Set up your business profile to start listing activities and receiving bookings.
          </Text>
          <Button
            title="Complete Onboarding"
            onPress={() => router.push('/onboarding')}
            size="lg"
            fullWidth
            style={styles.onboardingBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const greetingWord =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
      ? 'Good afternoon'
      : 'Good evening';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
      >
        {/* Alerts — surfaced first so blocking actions (accept agreement, add
            bank details) are seen before anything else. */}
        {hasAlerts && (
          <View style={styles.alertsWrap}>
            {showAgreementNudge && (
              <AlertBanner
                icon="warning-outline"
                tone="warning"
                title="Accept the Vendor Agreement to publish listings"
                message={`You must accept the current Vendor / Supplier Agreement (v${CURRENT_AGREEMENT_VERSION}) before you can publish or update any activity, package, or transport listing.`}
                ctaLabel="Review & accept"
                ctaIcon="document-text-outline"
                onPress={openAgreement}
              />
            )}

            {showPayoutNudge && (
              <AlertBanner
                icon="wallet-outline"
                tone="info"
                title="Add bank details to receive payouts"
                message="You can take bookings now, but payouts won't release until your bank account is on file."
                ctaLabel="Setup Payout"
                onPress={() => router.push('/finance')}
                onDismiss={() => setPayoutNudgeDismissed(true)}
              />
            )}

            {verificationStatus === 'pending' && (
              <AlertBanner
                icon="time-outline"
                tone="warning"
                title="Account verification pending"
                message="Your account is under review. You can set up listings but they won't go live until approved (24–48 hours)."
              />
            )}

            {verificationStatus === 'rejected' && (
              <AlertBanner
                icon="alert-circle-outline"
                tone="error"
                title="Verification rejected"
                message={
                  businessAccount?.verificationNote ||
                  'Please resubmit your documents from Settings.'
                }
                ctaLabel="Re-upload"
                onPress={() => router.push('/settings')}
              />
            )}

            {draftCount > 0 && (
              <AlertBanner
                icon="document-text-outline"
                tone="info"
                title={`${draftCount} draft listing${draftCount > 1 ? 's' : ''} need${draftCount === 1 ? 's' : ''} attention`}
                message="Complete photos, description, and pricing to submit for approval. Listings won't go live until reviewed."
                ctaLabel="View draft listings"
                onPress={() => router.push('/activity')}
              />
            )}
          </View>
        )}

        {/* Header — greeting + primary CTA */}
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <PrayanaLogo size={26} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greetingWord}
              {firstName ? `, ${firstName}` : ''} 👋
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {businessName || 'Business overview'}
            </Text>
            <Text style={styles.subtitle}>Here&apos;s what&apos;s happening with your listings today.</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/messaging')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.addActivityWrap}>
          <Button
            title="Add Activity"
            onPress={() => router.push('/activity/new')}
            size="md"
            icon={<Ionicons name="add" size={18} color="#fff" />}
          />
        </View>

        {/* Stat cards */}
        {loading ? (
          <View style={styles.statsGrid}>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              label="Total Listings"
              value={String(data?.listings?.total ?? 0)}
              subtitle={`${data?.listings?.active ?? 0} active · ${data?.listings?.draft ?? 0} draft`}
              icon="ticket-outline"
              accentColor={colors.primary[500]}
              bgColor={colors.primary[50]}
            />
            <StatCard
              label="Active Bookings"
              value={String(activeBookings)}
              subtitle={`${data?.bookings?.pending ?? 0} pending confirmation`}
              icon="calendar-outline"
              accentColor={colors.info}
              bgColor={colors.infoLight}
            />
            <StatCard
              label="Total Revenue"
              value={`₹${totalRevenueRupees.toLocaleString('en-IN')}`}
              subtitle={`${data?.bookings?.completed ?? 0} completed bookings`}
              icon="wallet-outline"
              accentColor={colors.success}
              bgColor={colors.successLight}
            />
            <StatCard
              label="Average Rating"
              value={avgRating ? `${avgRating} ★` : '—'}
              subtitle={`${totalReviews} review${totalReviews === 1 ? '' : 's'}`}
              icon="star-outline"
              accentColor={colors.warning}
              bgColor={colors.warningLight}
            />
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Card padding="sm">
            <QuickAction
              icon="add-circle-outline"
              label="Add New Activity"
              desc="Create a new listing"
              onPress={() => router.push('/activity/new')}
            />
            <View style={styles.divider} />
            <QuickAction
              icon="calendar-outline"
              label="View All Bookings"
              desc="Manage reservations"
              onPress={() => router.push('/(tabs)/orders')}
            />
            <View style={styles.divider} />
            <QuickAction
              icon="eye-outline"
              label="View Marketplace"
              desc="See how you appear to travelers"
              trailing="open-outline"
              onPress={() => Linking.openURL('https://prayanaai.com/activities')}
            />
          </Card>
        </View>

        {/* Recent bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent Bookings</Text>
              <Text style={styles.sectionSubtitle}>Latest reservations across your listings</Text>
            </View>
            {recentBookings.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <LoadingSpinner size="small" message="Loading bookings..." />
          ) : recentBookings.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="calendar-outline" size={26} color={colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No bookings yet</Text>
                <Text style={styles.emptyText}>
                  Bookings will appear here once travelers book your activities.
                </Text>
              </View>
            </Card>
          ) : (
            <Card padding="sm">
              {recentBookings.map((booking, index) => (
                <React.Fragment key={booking._id}>
                  <BookingRow
                    booking={booking}
                    onPress={() => router.push(`/booking/${booking._id}`)}
                  />
                  {index < recentBookings.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </Card>
          )}
        </View>

        {/* Continue setup — onboarding progress checklist */}
        <SetupChecklist tasks={setupTasks} />

        {/* Top activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Activities</Text>
          <Text style={styles.sectionSubtitle}>Your best performers</Text>
          {loading ? (
            <LoadingSpinner size="small" />
          ) : topListings.length === 0 ? (
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No activity data yet</Text>
                <Text style={styles.emptyText}>Top performers will appear here.</Text>
              </View>
            </Card>
          ) : (
            <Card padding="sm">
              {topListings.map((listing, index) => (
                <React.Fragment key={listing._id}>
                  <TouchableOpacity
                    style={styles.topRow}
                    onPress={() => router.push(`/activity/${listing._id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.topRank}>
                      <Text style={styles.topRankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.topBody}>
                      <Text style={styles.topTitle} numberOfLines={1}>
                        {listing.title}
                      </Text>
                      <Text style={styles.topMeta}>
                        {listing.stats?.totalBookings || 0} bookings · {listing.rating?.average || 0} ★
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {index < topListings.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </Card>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadow.sm,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.md,
  },
  greeting: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  addActivityWrap: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },

  // Alerts
  alertsWrap: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  alertBanner: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    position: 'relative',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingRight: spacing.lg, // leave room for the dismiss ×
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: 19,
  },
  alertMessage: {
    fontSize: fontSize.xs,
    marginTop: 3,
    lineHeight: 17,
  },
  alertCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  alertCtaIcon: {
    marginRight: 6,
  },
  alertCtaBtnText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  alertDismiss: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: 2,
    zIndex: 1,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    width: STAT_CARD_WIDTH,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },

  // Quick Actions
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  quickActionDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Section
  section: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  viewAll: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  // Setup checklist
  setupCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  setupHeaderGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  setupRing: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupRingLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupRingText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  setupHeaderText: {
    flex: 1,
  },
  setupTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  setupSubtitle: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  setupList: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  setupRowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  setupRowLabelDone: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  setupDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },

  // Booking Row
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  bookingThumb: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  bookingThumbFallback: {
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  bookingActivity: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  bookingCustomer: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookingRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bookingAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },

  // Top activities
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  topRank: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  topRankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },
  topBody: {
    flex: 1,
  },
  topTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  topMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    maxWidth: 280,
  },

  // Onboarding CTA
  onboardingCta: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  // White tile behind the brand mark, matching the login/landing lockup.
  onboardingLogo: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xl,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  onboardingTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  onboardingDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.md,
  },
  onboardingBtn: {
    marginTop: spacing['2xl'],
  },

  // Skeleton
  skeletonBox: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.sm,
  },

  // Bottom
  bottomSpacer: {
    height: spacing['3xl'],
  },
});
