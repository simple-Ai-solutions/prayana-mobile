import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Upcoming features ──────────────────────────────────────────
const FEATURES = [
  {
    icon: 'search-outline' as const,
    title: 'Smart Search',
    desc: 'Find the perfect hotel with AI-powered recommendations tailored to your preferences.',
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    icon: 'star-outline' as const,
    title: 'Curated Picks',
    desc: 'Hand-picked hotels, resorts & boutique stays verified for quality and value.',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
  {
    icon: 'pricetag-outline' as const,
    title: 'Best Price Guarantee',
    desc: 'We match any lower price you find. Pay less, get more.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Secure Booking',
    desc: 'Safe payment, instant confirmation, free cancellation on most hotels.',
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
  {
    icon: 'map-outline' as const,
    title: 'Location Intel',
    desc: 'See distance to attractions, restaurants, transport — all on one map.',
    color: '#EF4444',
    bg: '#FEF2F2',
  },
  {
    icon: 'headset-outline' as const,
    title: '24/7 Concierge',
    desc: 'Need help? Our AI concierge is available round the clock for any request.',
    color: '#06B6D4',
    bg: '#ECFEFF',
  },
];

const HOTEL_TYPES = [
  { emoji: '🏨', label: 'Hotels' },
  { emoji: '🏖️', label: 'Resorts' },
  { emoji: '🏡', label: 'Villas' },
  { emoji: '🛖', label: 'Boutique' },
  { emoji: '⛺', label: 'Camping' },
  { emoji: '🚢', label: 'Cruises' },
];

// ── Main Component ──────────────────────────────────────────────
export default function HotelsScreen() {
  const router = useRouter();
  const { isDarkMode, themeColors } = useTheme();
  const [email, setEmail] = useState('');
  const [notified, setNotified] = useState(false);

  // Animations
  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const badgeBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for main icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // Float animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    // Fade in on mount
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // Badge bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeBounce, { toValue: -4, duration: 600, useNativeDriver: true }),
        Animated.timing(badgeBounce, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse, float, fadeIn, badgeBounce]);

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const handleNotify = () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setNotified(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: themeColors.surface,
        borderBottomColor: themeColors.border,
      }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={themeColors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Hotels</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Hero Section ─────────────────────────────────── */}
        <LinearGradient
          colors={['#1E3A8A', '#3B82F6', '#60A5FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={styles.decor1} />
          <View style={styles.decor2} />
          <View style={styles.decor3} />

          {/* Floating "Coming Soon" badge */}
          <Animated.View style={[styles.badge, { transform: [{ translateY: badgeBounce }] }]}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Coming Soon</Text>
          </Animated.View>

          {/* Main hotel icon */}
          <Animated.View style={[styles.heroIconWrap, {
            transform: [{ scale: pulse }, { translateY: floatY }],
          }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.heroIconBg}
            >
              <Text style={styles.heroEmoji}>🏨</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{ opacity: fadeIn }}>
            <Text style={styles.heroTitle}>Hotels & Stays</Text>
            <Text style={styles.heroSub}>
              Discover, compare and book amazing hotels across India and the world.
              Coming very soon to Prayana AI.
            </Text>
          </Animated.View>

          {/* Hotel type chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hotelTypesRow}
          >
            {HOTEL_TYPES.map((t) => (
              <View key={t.label} style={styles.hotelTypeChip}>
                <Text style={styles.hotelTypeEmoji}>{t.emoji}</Text>
                <Text style={styles.hotelTypeLabel}>{t.label}</Text>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>

        {/* ── Notify Me Section ───────────────────────────── */}
        <View style={[styles.notifyCard, {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }, shadow.md]}>
          <Ionicons name="notifications-outline" size={28} color="#3B82F6" />
          <Text style={[styles.notifyTitle, { color: themeColors.text }]}>
            Get early access
          </Text>
          <Text style={[styles.notifySub, { color: themeColors.textSecondary }]}>
            Be the first to know when hotels launch. We'll send you exclusive deals.
          </Text>

          {notified ? (
            <View style={styles.notifiedRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.notifiedText, { color: '#10B981' }]}>
                You're on the list! We'll notify you soon.
              </Text>
            </View>
          ) : (
            <View style={styles.notifyInputRow}>
              <TextInput
                style={[styles.notifyInput, {
                  backgroundColor: themeColors.backgroundSecondary,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                }]}
                placeholder="your@email.com"
                placeholderTextColor={themeColors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.notifyBtn}
                onPress={handleNotify}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.notifyBtnGrad}>
                  <Text style={styles.notifyBtnText}>Notify me</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Upcoming Features ───────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            What's coming
          </Text>
          <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
            We're building something great for your travel stays.
          </Text>

          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.featureCard, {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              }, shadow.sm]}>
                <View style={[styles.featureIconWrap, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : f.bg }]}>
                  <Ionicons name={f.icon} size={22} color={f.color} />
                </View>
                <Text style={[styles.featureTitle, { color: themeColors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: themeColors.textSecondary }]}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Explore in the meantime ─────────────────────── */}
        <View style={[styles.exploreCard, {
          backgroundColor: isDarkMode ? '#1e3a5f' : '#EFF6FF',
          borderColor: isDarkMode ? '#1d4ed8' : '#BFDBFE',
        }]}>
          <Text style={[styles.exploreTitle, { color: isDarkMode ? '#93c5fd' : '#1D4ED8' }]}>
            Plan your trip with AI while you wait!
          </Text>
          <Text style={[styles.exploreSub, { color: isDarkMode ? '#60a5fa' : '#3B82F6' }]}>
            Use Prayana AI to build your full itinerary, discover destinations and plan activities.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/chat')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.exploreBtnGrad}>
              <Ionicons name="sparkles" size={16} color="#ffffff" />
              <Text style={styles.exploreBtnText}>Ask Isha to plan</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const PAD = spacing.xl;
const FEATURE_W = (SCREEN_WIDTH - PAD * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  scroll: { paddingBottom: spacing['2xl'] },

  // Hero
  hero: {
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['3xl'],
    paddingHorizontal: PAD,
    alignItems: 'center',
    overflow: 'hidden',
  },
  decor1: {
    position: 'absolute', top: -60, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decor2: {
    position: 'absolute', bottom: -30, left: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decor3: {
    position: 'absolute', top: 40, left: 20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FDE047' },
  badgeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#ffffff', letterSpacing: 0.5 },

  heroIconWrap: { marginBottom: spacing.xl },
  heroIconBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroEmoji: { fontSize: 48 },

  heroTitle: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  heroSub: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: spacing.xl,
  },

  hotelTypesRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  hotelTypeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 72,
  },
  hotelTypeEmoji: { fontSize: 22, marginBottom: 2 },
  hotelTypeLabel: { fontSize: fontSize.xs, color: '#ffffff', fontWeight: fontWeight.medium },

  // Notify card
  notifyCard: {
    marginHorizontal: PAD,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  notifyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.xs },
  notifySub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  notifyInputRow: { flexDirection: 'row', width: '100%', gap: spacing.sm },
  notifyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: fontSize.sm,
  },
  notifyBtn: { borderRadius: borderRadius.lg, overflow: 'hidden' },
  notifyBtnGrad: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  notifyBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#ffffff' },
  notifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifiedText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Features
  section: { marginTop: spacing['2xl'], paddingHorizontal: PAD },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  sectionSub: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.lg },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  featureCard: {
    width: FEATURE_W,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  featureDesc: { fontSize: fontSize.xs, lineHeight: 16 },

  // Explore CTA
  exploreCard: {
    marginHorizontal: PAD,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  exploreTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center', marginBottom: spacing.xs },
  exploreSub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  exploreBtn: { borderRadius: borderRadius.lg, overflow: 'hidden' },
  exploreBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  exploreBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#ffffff' },
});
