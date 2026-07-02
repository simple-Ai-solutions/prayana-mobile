import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../theme/vendorColors';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Small inline icons (stroke = currentColor via `color` prop) ───
function Icon({ d, color, size = 16, fill = 'none' }: { d: string; color: string; size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}
const ICON = {
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  check: 'M20 6L9 17l-5-5',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  trendUp: 'M23 6l-9.5 9.5-5-5L1 18',
};

const STATS = [
  { icon: ICON.users, value: '500+', label: 'Active Partners' },
  { icon: ICON.pin, value: '10,000+', label: 'Monthly Travelers' },
  { icon: ICON.star, value: '4.8/5', label: 'Partner Rating' },
];

const BOOKINGS = [
  { title: 'Manali Trek · 4 nights', price: '₹ 18,500', status: 'Confirmed', kind: 'ok' as const },
  { title: 'Goa Watersports', price: '₹ 4,800', status: 'Pending', kind: 'pending' as const },
];

const BARS = [40, 55, 35, 70, 50, 85, 95];

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* ===== HERO (dark blue gradient) ===== */}
        <LinearGradient
          colors={colors.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* glow orbs */}
          <View style={[styles.orb, styles.orbTop]} />
          <View style={[styles.orb, styles.orbBottom]} />

          <SafeAreaView edges={['top']}>
            {/* Logo + Partner Portal */}
            <View style={styles.brandRow}>
              <View style={styles.logoBox}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="9" stroke={colors.primary[500]} strokeWidth={2} />
                  <Path d="M8 13l2.5 2.5L16 9" stroke={colors.primary[500]} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View>
                <Text style={styles.brandName}>PrayanaAI</Text>
                <Text style={styles.brandSub}>Partner Portal</Text>
              </View>
            </View>

            {/* live pill */}
            <View style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText}>Onboarding open · Free to join</Text>
            </View>

            {/* headline */}
            <Text style={styles.h1}>List your business.</Text>
            <Text style={[styles.h1, { color: colors.heroAccent }]}>Grow with PrayanaAI.</Text>

            <Text style={styles.sub}>
              Reach thousands of travelers across India. Zero listing fees, weekly payouts.
            </Text>

            {/* CTAs */}
            <TouchableOpacity
              style={styles.ctaPrimary}
              activeOpacity={0.9}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.ctaPrimaryText}>Get started — it's free</Text>
              <Icon d={ICON.arrowRight} color={colors.primary[800]} size={18} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ctaSecondary}
              activeOpacity={0.8}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.ctaSecondaryText}>Sign in</Text>
            </TouchableOpacity>

            {/* checkmarks */}
            <View style={styles.checkRow}>
              <View style={styles.checkItem}>
                <Icon d={ICON.check} color="#34d399" size={14} />
                <Text style={styles.checkText}>No setup cost</Text>
              </View>
              <View style={styles.checkItem}>
                <Icon d={ICON.check} color="#34d399" size={14} />
                <Text style={styles.checkText}>Onboard in minutes</Text>
              </View>
            </View>

            {/* stats */}
            <View style={styles.statsRow}>
              {STATS.map((s) => (
                <View key={s.label} style={styles.statCol}>
                  <View style={styles.statValueRow}>
                    <Icon d={s.icon} color={colors.heroAccent} size={15} fill="none" />
                    <Text style={styles.statValue}>{s.value}</Text>
                  </View>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* live-earnings glass card */}
            <View style={styles.glassCard}>
              <View style={styles.glassHeader}>
                <View>
                  <Text style={styles.glassKicker}>THIS WEEK</Text>
                  <Text style={styles.glassAmount}>₹ 84,200</Text>
                </View>
                <View style={styles.glassBadge}>
                  <Icon d={ICON.trendUp} color="#6ee7b7" size={11} />
                  <Text style={styles.glassBadgeText}>+24%</Text>
                </View>
              </View>

              {/* bar chart */}
              <View style={styles.barChart}>
                {BARS.map((h, i) => (
                  <View key={i} style={styles.barSlot}>
                    <LinearGradient
                      colors={[colors.primary[500], '#67e8f9']}
                      style={[styles.bar, { height: `${h}%` }]}
                    />
                  </View>
                ))}
              </View>

              {/* bookings */}
              <View style={{ gap: 10 }}>
                {BOOKINGS.map((b) => (
                  <View key={b.title} style={styles.bookingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingTitle} numberOfLines={1}>{b.title}</Text>
                      <Text style={styles.bookingPrice}>{b.price}</Text>
                    </View>
                    <View style={[styles.bookingBadge, b.kind === 'ok' ? styles.badgeOk : styles.badgePending]}>
                      <Text style={[styles.bookingBadgeText, b.kind === 'ok' ? styles.badgeOkText : styles.badgePendingText]}>
                        {b.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ===== BENEFITS (light) ===== */}
        <View style={styles.benefits}>
          {[
            { title: 'Zero listing fees', desc: 'Pay only when you earn. No setup cost or monthly charges.' },
            { title: 'AI-powered reach', desc: 'Smart distribution surfaces your listings to the right travelers.' },
            { title: 'Weekly payouts', desc: 'Settlements land directly in your bank — every week, on time.' },
          ].map((b) => (
            <View key={b.title} style={styles.benefitCard}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.bottomCta}
            activeOpacity={0.9}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.bottomCtaText}>Create partner account</Text>
            <Icon d={ICON.arrowRight} color="#fff" size={18} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Hero
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'], overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 9999, opacity: 0.25 },
  orbTop: { top: -80, right: -80, width: 300, height: 300, backgroundColor: colors.heroGlow },
  orbBottom: { bottom: -60, left: -80, width: 240, height: 240, backgroundColor: '#22d3ee', opacity: 0.15 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.md, marginBottom: spacing['2xl'] },
  logoBox: {
    width: 44, height: 44, borderRadius: borderRadius.lg, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  brandName: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },
  brandSub: { color: colors.heroAccent, fontSize: 11, fontWeight: fontWeight.medium },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    marginBottom: spacing.xl,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' },
  pillText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: fontWeight.medium },

  h1: { color: '#fff', fontSize: 40, fontWeight: fontWeight.bold, lineHeight: 44, letterSpacing: -0.5 },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.lg, lineHeight: 26, marginTop: spacing.lg, maxWidth: 460 },

  ctaPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', paddingVertical: 15, borderRadius: borderRadius.lg, marginTop: spacing['2xl'],
  },
  ctaPrimaryText: { color: colors.primary[800], fontWeight: fontWeight.bold, fontSize: fontSize.md },
  ctaSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 15, borderRadius: borderRadius.lg, marginTop: spacing.md,
  },
  ctaSecondaryText: { color: '#fff', fontWeight: fontWeight.semibold, fontSize: fontSize.md },

  checkRow: { flexDirection: 'row', gap: 20, marginTop: spacing.lg },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs },

  statsRow: {
    flexDirection: 'row', marginTop: spacing['2xl'], paddingTop: spacing.xl,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  statCol: { flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs, marginTop: 2 },

  // Glass earnings card
  glassCard: {
    marginTop: spacing['2xl'], borderRadius: borderRadius.xl, padding: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  glassHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  glassKicker: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: fontWeight.medium, letterSpacing: 1 },
  glassAmount: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: 2 },
  glassBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 9999, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  glassBadgeText: { color: '#6ee7b7', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6, marginBottom: spacing.lg },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, width: '100%' },

  bookingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  bookingTitle: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  bookingPrice: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  bookingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  badgeOk: { backgroundColor: 'rgba(16,185,129,0.15)' },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.15)' },
  bookingBadgeText: { fontSize: 10, fontWeight: fontWeight.semibold },
  badgeOkText: { color: '#6ee7b7' },
  badgePendingText: { color: '#fcd34d' },

  // Benefits
  benefits: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  benefitCard: {
    borderRadius: borderRadius.xl, padding: spacing.xl,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  benefitTitle: { color: colors.text, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  benefitDesc: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: 6 },

  bottomCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary[500], paddingVertical: 15, borderRadius: borderRadius.lg, marginTop: spacing.sm,
  },
  bottomCtaText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
