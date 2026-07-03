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

// ── Activity categories preview ────────────────────────────────
const ACTIVITY_CATEGORIES = [
  { emoji: '🧗', label: 'Adventure', color: '#F97316' },
  { emoji: '🏛️', label: 'Cultural', color: '#8B5CF6' },
  { emoji: '🍛', label: 'Food', color: '#EAB308' },
  { emoji: '🐘', label: 'Wildlife', color: '#16A34A' },
  { emoji: '🧘', label: 'Wellness', color: '#06B6D4' },
  { emoji: '🚤', label: 'Water', color: '#3B82F6' },
  { emoji: '🎭', label: 'Arts', color: '#EC4899' },
  { emoji: '⛷️', label: 'Snow', color: '#64748B' },
];

const FEATURES = [
  {
    icon: 'ticket-outline' as const,
    title: 'Instant Booking',
    desc: 'Book activities in seconds with instant confirmation. No waiting, no hassle.',
    color: '#F97316',
    bg: '#FFF7ED',
  },
  {
    icon: 'people-outline' as const,
    title: 'Group & Solo',
    desc: 'Activities for solo travellers, couples, families and large groups.',
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
  {
    icon: 'star-outline' as const,
    title: 'Verified Reviews',
    desc: 'Real reviews from real travellers. Make informed decisions every time.',
    color: '#EAB308',
    bg: '#FEFCE8',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Free Cancellation',
    desc: 'Plans change — cancel most bookings up to 24 hours before for a full refund.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'AI Suggestions',
    desc: 'Let Isha recommend activities based on your travel style and destination.',
    color: '#06B6D4',
    bg: '#ECFEFF',
  },
  {
    icon: 'wallet-outline' as const,
    title: 'Best Prices',
    desc: 'Local operators, no middlemen. Get authentic experiences at the best rates.',
    color: '#EF4444',
    bg: '#FEF2F2',
  },
];

const UPCOMING_CITIES = [
  { name: 'Goa', emoji: '🏖️' },
  { name: 'Mumbai', emoji: '🌆' },
  { name: 'Delhi', emoji: '🕌' },
  { name: 'Jaipur', emoji: '🏰' },
  { name: 'Kerala', emoji: '🌴' },
  { name: 'Manali', emoji: '🏔️' },
  { name: 'Rishikesh', emoji: '🧘' },
  { name: 'Bali', emoji: '🌺' },
];

// ── Main Component ──────────────────────────────────────────────
export default function ActivitiesScreen() {
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeBounce, { toValue: -3, duration: 700, useNativeDriver: true }),
        Animated.timing(badgeBounce, { toValue: 0, duration: 700, useNativeDriver: true }),
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
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Activities</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Hero Section ─────────────────────────────────── */}
        <LinearGradient
          colors={['#7C2D12', '#EA580C', '#FB923C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.decor1} />
          <View style={styles.decor2} />
          <View style={styles.decor3} />

          {/* Badge */}
          <Animated.View style={[styles.badge, { transform: [{ translateY: badgeBounce }] }]}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Coming Soon</Text>
          </Animated.View>

          {/* Icon */}
          <Animated.View style={[styles.heroIconWrap, {
            transform: [{ scale: pulse }, { translateY: floatY }],
          }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.heroIconBg}
            >
              <Text style={styles.heroEmoji}>🎟️</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{ opacity: fadeIn, alignItems: 'center' }}>
            <Text style={styles.heroTitle}>Experiences &{'\n'}Activities</Text>
            <Text style={styles.heroSub}>
              Book unique tours, experiences, and adventures handpicked for curious travellers.
            </Text>
          </Animated.View>

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            {ACTIVITY_CATEGORIES.map((c) => (
              <View key={c.label} style={styles.categoryChip}>
                <Text style={styles.categoryEmoji}>{c.emoji}</Text>
                <Text style={styles.categoryLabel}>{c.label}</Text>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>

        {/* ── Notify Me ───────────────────────────────────── */}
        <View style={[styles.notifyCard, {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }, shadow.md]}>
          <View style={styles.notifyIconWrap}>
            <Ionicons name="flame-outline" size={28} color="#F97316" />
          </View>
          <Text style={[styles.notifyTitle, { color: themeColors.text }]}>Be first in line</Text>
          <Text style={[styles.notifySub, { color: themeColors.textSecondary }]}>
            Get early access and exclusive discounts when Activities goes live.
          </Text>

          {notified ? (
            <View style={styles.notifiedRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.notifiedText, { color: '#10B981' }]}>
                Awesome! We'll let you know as soon as we launch.
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
              <TouchableOpacity style={styles.notifyBtn} onPress={handleNotify} activeOpacity={0.85}>
                <LinearGradient colors={['#F97316', '#EA580C']} style={styles.notifyBtnGrad}>
                  <Text style={styles.notifyBtnText}>Notify me</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Upcoming Cities ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Launching in these cities first
          </Text>
          <View style={styles.citiesGrid}>
            {UPCOMING_CITIES.map((city) => (
              <View key={city.name} style={[styles.cityChip, {
                backgroundColor: isDarkMode ? 'rgba(249,115,22,0.1)' : '#FFF7ED',
                borderColor: isDarkMode ? 'rgba(249,115,22,0.3)' : '#FED7AA',
              }]}>
                <Text style={styles.cityEmoji}>{city.emoji}</Text>
                <Text style={[styles.cityName, { color: isDarkMode ? '#fb923c' : '#C2410C' }]}>
                  {city.name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── What's Coming ───────────────────────────────── */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>What's coming</Text>
          <Text style={[styles.sectionSub, { color: themeColors.textSecondary }]}>
            Experiences curated by locals, rated by travellers.
          </Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.featureCard, {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              }, shadow.sm]}>
                <View style={[styles.featureIconWrap, {
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : f.bg,
                }]}>
                  <Ionicons name={f.icon} size={22} color={f.color} />
                </View>
                <Text style={[styles.featureTitle, { color: themeColors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: themeColors.textSecondary }]}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Chat CTA ────────────────────────────────────── */}
        <View style={[styles.ctaCard, {
          backgroundColor: isDarkMode ? '#431407' : '#FFF7ED',
          borderColor: isDarkMode ? '#c2410c' : '#FED7AA',
        }]}>
          <Text style={[styles.ctaTitle, { color: isDarkMode ? '#fb923c' : '#C2410C' }]}>
            Want activity recommendations now?
          </Text>
          <Text style={[styles.ctaSub, { color: isDarkMode ? '#fdba74' : '#EA580C' }]}>
            Ask Isha — our AI travel assistant — for personalised activity suggestions for your destination.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/chat')} activeOpacity={0.85}>
            <LinearGradient colors={['#F97316', '#C2410C']} style={styles.ctaBtnGrad}>
              <Ionicons name="sparkles" size={16} color="#ffffff" />
              <Text style={styles.ctaBtnText}>Ask Isha</Text>
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

  hero: {
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['3xl'],
    paddingHorizontal: PAD,
    alignItems: 'center',
    overflow: 'hidden',
  },
  decor1: {
    position: 'absolute', top: -50, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decor2: {
    position: 'absolute', bottom: -20, left: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decor3: {
    position: 'absolute', top: 50, left: 30,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
    marginBottom: spacing.xl, gap: spacing.xs,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
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
    fontSize: 30, fontWeight: fontWeight.bold, color: '#ffffff',
    textAlign: 'center', letterSpacing: -0.5, marginBottom: spacing.md,
  },
  heroSub: {
    fontSize: fontSize.md, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 24, maxWidth: 300, marginBottom: spacing.xl,
  },

  categoriesRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 68,
  },
  categoryEmoji: { fontSize: 20, marginBottom: 2 },
  categoryLabel: { fontSize: fontSize.xs, color: '#ffffff', fontWeight: fontWeight.medium },

  notifyCard: {
    marginHorizontal: PAD, marginTop: spacing.xl,
    padding: spacing.xl, borderRadius: borderRadius.xl,
    borderWidth: 1, alignItems: 'center',
  },
  notifyIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  notifyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  notifySub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  notifyInputRow: { flexDirection: 'row', width: '100%', gap: spacing.sm },
  notifyInput: {
    flex: 1, borderWidth: 1, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: fontSize.sm,
  },
  notifyBtn: { borderRadius: borderRadius.lg, overflow: 'hidden' },
  notifyBtnGrad: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  notifyBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#ffffff' },
  notifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifiedText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  section: { paddingHorizontal: PAD, marginTop: spacing['2xl'] },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  sectionSub: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.lg },

  citiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cityChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  cityEmoji: { fontSize: 14 },
  cityName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  featureCard: {
    width: FEATURE_W, borderRadius: borderRadius.xl,
    padding: spacing.lg, borderWidth: 1,
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  featureDesc: { fontSize: fontSize.xs, lineHeight: 16 },

  ctaCard: {
    marginHorizontal: PAD, marginTop: spacing.xl,
    padding: spacing.xl, borderRadius: borderRadius.xl,
    borderWidth: 1, alignItems: 'center',
  },
  ctaTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center', marginBottom: spacing.xs },
  ctaSub: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  ctaBtn: { borderRadius: borderRadius.lg, overflow: 'hidden' },
  ctaBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  ctaBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#ffffff' },
});
