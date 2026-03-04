import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';

const BENEFITS = [
  { icon: 'headset-outline', text: 'Priority customer support', color: '#2EC4B6' },
  { icon: 'pricetag-outline', text: 'Exclusive deals and discounts up to 30%', color: '#f59e0b' },
  { icon: 'close-circle-outline', text: 'Free cancellations up to 24 hours', color: '#ef4444' },
  { icon: 'star-outline', text: 'Earn 2× points on all bookings', color: '#8b5cf6' },
  { icon: 'airplane-outline', text: 'Access to airport lounge passes', color: '#0ea5e9' },
  { icon: 'sparkles-outline', text: 'Unlimited AI trip planning with Isha', color: '#f97316' },
];

const POINT_ACTIONS = [
  { icon: 'map-outline', label: 'Complete a Trip', points: '+500 pts', color: '#059669' },
  { icon: 'star-outline', label: 'Write a Review', points: '+100 pts', color: '#f59e0b' },
  { icon: 'people-outline', label: 'Refer a Friend', points: '+1000 pts', color: '#8b5cf6' },
  { icon: 'phone-portrait-outline', label: 'Complete Profile', points: '+200 pts', color: '#0ea5e9' },
];

export default function MembershipScreen() {
  const router = useRouter();
  const { isDarkMode, themeColors } = useTheme();

  // Mock data — replace with real backend data
  const loyaltyPoints = 1250;
  const tier = 'Premium';
  const pointsValue = Math.floor(loyaltyPoints * 0.5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Membership & Rewards</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Tier Card */}
        <LinearGradient
          colors={['#f97316', '#fbbf24', '#f59e0b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tierCard}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <View style={styles.tierTop}>
            <View>
              <Text style={styles.tierLabel}>Current Tier</Text>
              <Text style={styles.tierName}>{tier} Member</Text>
            </View>
            <View style={styles.tierBadge}>
              <Ionicons name="star" size={32} color="#ffffff" />
            </View>
          </View>

          <View style={styles.tierPoints}>
            <View>
              <Text style={styles.pointsNum}>{loyaltyPoints.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Loyalty Points</Text>
            </View>
            <View style={styles.pointsDivider} />
            <View>
              <Text style={styles.pointsNum}>₹{pointsValue.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Points Value</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.redeemBtn} activeOpacity={0.85}>
            <Text style={styles.redeemBtnText}>Redeem Points</Text>
            <Ionicons name="arrow-forward" size={16} color="#92400E" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Premium Benefits</Text>
          <View style={[styles.benefitsList, { backgroundColor: themeColors.card }, shadow.sm]}>
            {BENEFITS.map((benefit, idx) => (
              <View
                key={idx}
                style={[
                  styles.benefitRow,
                  idx < BENEFITS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
                ]}
              >
                <View style={[styles.benefitIcon, { backgroundColor: benefit.color + '20' }]}>
                  <Ionicons name={benefit.icon as any} size={20} color={benefit.color} />
                </View>
                <Text style={[styles.benefitText, { color: themeColors.text }]}>{benefit.text}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              </View>
            ))}
          </View>
        </View>

        {/* Earn Points */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Earn More Points</Text>
          <View style={styles.earnGrid}>
            {POINT_ACTIONS.map((action, idx) => (
              <View
                key={idx}
                style={[styles.earnCard, { backgroundColor: themeColors.card }, shadow.sm]}
              >
                <View style={[styles.earnIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={[styles.earnLabel, { color: themeColors.text }]}>{action.label}</Text>
                <Text style={[styles.earnPoints, { color: action.color }]}>{action.points}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Next tier info */}
        <View style={[styles.nextTierCard, { backgroundColor: isDarkMode ? '#1a1a2e' : '#f0f9ff', borderColor: '#bae6fd' }]}>
          <Ionicons name="information-circle-outline" size={20} color="#0ea5e9" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextTierTitle, { color: themeColors.text }]}>You're a Premium Member</Text>
            <Text style={[styles.nextTierBody, { color: themeColors.textSecondary }]}>
              As an early adopter, you enjoy all Premium benefits for free. Keep exploring and earning points!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },

  content: { paddingBottom: 40 },

  tierCard: {
    margin: spacing.xl,
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  tierTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  tierLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  tierName: { fontSize: fontSize['2xl'], fontWeight: '800', color: '#ffffff' },
  tierBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tierPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  pointsNum: { fontSize: fontSize['2xl'], fontWeight: '800', color: '#ffffff' },
  pointsLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  pointsDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },

  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
  redeemBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#92400E' },

  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },

  benefitsList: { borderRadius: borderRadius.xl, overflow: 'hidden' },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },

  earnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  earnCard: {
    width: '47%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  earnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center' },
  earnPoints: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  nextTierCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  nextTierTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: 4 },
  nextTierBody: { fontSize: fontSize.sm, lineHeight: 20 },
});
