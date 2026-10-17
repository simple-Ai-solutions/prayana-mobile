import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTypedCity } from '../../lib/typedCity';
import { useNotificationStore } from '../../lib/notifications';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Animated,
  Pressable,
  Alert,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, shadow, borderRadius, useTheme, PrayanaLogo } from '@prayana/shared-ui';
import { useAuth, useAutoLocationDetection } from '@prayana/shared-hooks';
import { useAppStore } from '@prayana/shared-stores';
import { canGuestUse, incrementGuestUsage, GUEST_LIMITS } from '@prayana/shared-utils';
import { FloatingChatFAB } from '../../components/chat/FloatingChatFAB';
import { QuickItineraryModal } from '../../components/trip/QuickItineraryModal';
import { RecentItineraries } from '../../components/home/RecentItineraries';
import DynamicHomeContent from '../../components/home/DynamicHomeContent';
import { PromoTrio } from '../../components/home/PromoTrio';
import { AllCategoriesSheet } from '../../components/experiences/AllCategoriesSheet';
import { TrekkingRail } from '../../components/home/HomeRails';
import { DiscoverByInterestRail } from '../../components/home/DiscoverByInterestRail';
import { TopIndiaRail } from '../../components/home/TopIndiaRail';
import { PilgrimageSection } from '../../components/home/PilgrimageRail';
import { RegionPostcards } from '../../components/home/RegionPostcards';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// 4 "More ways" cards fit the viewport at once (web-mobile parity): row padding
// 20*2 + 3 gaps of 10, split four ways.
const MORE_WAYS_CARD_W = Math.floor((SCREEN_WIDTH - 40 - 30) / 4);

// ============================================================
// SECTION 1: HERO - SERVICE TABS (matching web 9 service types)
// ============================================================
// Hero service tabs — mirrors the PWA mobile home (4 visible + "More").
// Uses the PWA's brand SVG icons (extracted to PNG in assets/hero-icons).
const HERO_TABS = [
  { id: 'quick-itinerary', label: 'Quick Itinerary', icon: require('../../../assets/hero-icons/quick-itinerary.png'), route: '/quick-itinerary' },
  { id: 'plan-trip', label: 'Trip Planner', icon: require('../../../assets/hero-icons/plan-trip.png'), route: '/trip/setup' },
  { id: 'esim', label: 'eSIM', icon: require('../../../assets/hero-icons/esim.png'), route: '/esim' },
  { id: 'global-experiences', label: 'Global Experiences', icon: require('../../../assets/hero-icons/global-experiences.png'), route: '/global-experiences' },
];

// Hidden behind "More" (matches PWA overflow sheet). Stays has no brand PNG
// yet, so it draws an Ionicon on a tile the size of the others.
const HERO_TABS_MORE: { id: string; label: string; route: string; icon?: number; ionicon?: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'stays', label: 'Stays', ionicon: 'bed', route: '/stays' },
  { id: 'activities', label: 'Activities', icon: require('../../../assets/hero-icons/activities.png'), route: '/activities' },
  { id: 'holiday-packages', label: 'Holiday Packages', icon: require('../../../assets/hero-icons/holiday-packages.png'), route: '/packages' },
  { id: 'divya-darshana', label: 'Divya Darshana', icon: require('../../../assets/hero-icons/divya-darshana.png'), route: '/divya-darshana' },
];
const MORE_ICON = require('../../../assets/hero-icons/more.png');

// Canonical brand palette — taken from the logo (Design System §2).
// Teal is primary, red is secondary. Red stays a SMALL accent, never a wide
// background. Applied here only: the hero is a new brand surface, and the
// system forbids bulk-swapping primary-500 across existing components.
const BRAND = {
  teal: '#4AC0CC', // primary — brand surfaces, primary CTAs, hero accents
  tealLight: '#5ED8E4',
  tealAccent: '#7fe0e9', // the web hero's accent (script line + typed city)
  tealDeep: '#0D5E5F',
  tealInk: '#042F2E',
  red: '#E61417', // secondary — badges, urgent states. Small areas only.
  flame: '#FB923C', // logo gradient stop — CTA only
} as const;

// "Plan a Trip" choice-sheet illustrations (web parity: /icons/plan-illus-*.png).
const PLAN_ILLUS_SOLO = require('../../../assets/plan/plan-illus-solo.png');
const PLAN_ILLUS_FRIENDS = require('../../../assets/plan/plan-illus-friends.png');

// The two planning modes offered by the choice sheet. Colours are SEMANTIC to the
// mode (emerald = fast/solo, blue = collaborative) and match the web sheet exactly,
// so they intentionally do not use the brand teal/orange.
const PLAN_CHOICES = [
  {
    id: 'quick',
    title: '1 Min Plan',
    desc: 'Get an AI itinerary in just 60 seconds.',
    cta: 'Start now',
    badge: 'Fast & Easy',
    badgeIcon: 'flash' as const,
    illus: PLAN_ILLUS_SOLO,
    color: '#059669', // emerald-600
    colorDark: '#34D399', // emerald-400
    tintLight: '#ECFDF5', // emerald-50
    tintDark: 'rgba(16,185,129,0.15)',
    ring: 'rgba(16,185,129,0.30)',
    route: '/quick-itinerary',
  },
  {
    id: 'friends',
    title: 'Plan with Friends',
    desc: 'Chat & build the perfect trip together.',
    cta: 'Invite & plan',
    badge: 'Together',
    badgeIcon: 'sparkles' as const,
    illus: PLAN_ILLUS_FRIENDS,
    color: '#2563EB', // blue-600
    colorDark: '#60A5FA', // blue-400
    tintLight: '#EFF6FF', // blue-50
    tintDark: 'rgba(37,99,235,0.15)',
    ring: 'rgba(37,99,235,0.30)',
    route: '/trip/setup',
  },
] as const;

// Hero background — ONE fixed scenic photograph (web parity: the web hero stopped
// rotating remote photos and now uses /icons/hero-scenery.jpg with a Ken Burns drift).
const HERO_SCENERY = require('../../../assets/hero-scenery.jpg');

// Seasonal eyebrow — mirrors the web HeroSection SEASONAL array, month-indexed.
// The web uses an emoji per season, but emoji don't render in this RN build
// (they came out as "?" boxes), so each season carries an Ionicon + tint
// instead — same meaning, renders on every device.
const SEASONAL = [
  { m: [0, 1], icon: 'snow-outline', iconColor: '#BAE6FD', title: 'Winter Escapes Await', sub: 'Crisp air, cozy stays & clear skies' }, // Jan–Feb
  { m: [2], icon: 'flower-outline', iconColor: '#FDA4AF', title: 'Spring Is Calling', sub: 'Perfect weather for a getaway' }, // Mar
  { m: [3, 4, 5], icon: 'sunny-outline', iconColor: '#FCD34D', title: 'Beat the Summer Heat', sub: 'Cool hill-station escapes await' }, // Apr–Jun
  { m: [6, 7, 8], icon: 'rainy-outline', iconColor: '#7FE0E9', title: 'Monsoon Magic Awaits', sub: 'Green trails, misty views & peaceful escapes' }, // Jul–Sep
  { m: [9, 10], icon: 'sparkles-outline', iconColor: '#FDBA74', title: 'Festive-Season Escapes', sub: 'Celebrate with a trip to remember' }, // Oct–Nov
  { m: [11], icon: 'snow-outline', iconColor: '#BAE6FD', title: 'Winter Wonderland Awaits', sub: 'Snowy peaks & cozy retreats' }, // Dec
] as const;

// Typewriter destinations inside the H1 ("perfect escape to <city>") — web parity.

// "More ways to explore" — pastel cards with NEW/SOON badges (web parity).
// Icons use the transparent cutouts — the originals have an opaque white plate
// that reads as a white box on the pastel cards.
// Web parity (components/common/MoreWaysToExplore.jsx): exactly four cards —
// Travel eSIM (New), Things to Do (New), Holiday Deals (Soon), Divya Darshana
// (Soon). "Soon" cards open a coming-soon alert instead of navigating, matching
// the web's ComingSoonModal. (The old mobile-only "Explore World" card is
// dropped — it has no web equivalent.)
const MORE_WAYS = [
  { id: 'esim', label: 'Travel eSIM', tag: 'NEW', tagColor: '#E61417', bg: '#FDECE4', darkBg: '#2A1612', icon: require('../../../assets/hero-icons/cutout/esim.png'), route: '/esim' },
  { id: 'things', label: 'Things to Do', tag: 'NEW', tagColor: '#E11D48', bg: '#FDE6EA', darkBg: '#2A1219', icon: require('../../../assets/hero-icons/cutout/activities.png'), route: '/activities' },
  // Holiday Deals = the "Last-minute deals" section of the packages catalogue
  // (no separate feature on web), so it routes into /packages.
  { id: 'deals', label: 'Holiday Deals', tag: 'DEALS', tagColor: '#F59E0B', bg: '#FDF3D8', darkBg: '#2A2110', icon: require('../../../assets/hero-icons/cutout/holiday-packages.png'), route: '/packages' },
  { id: 'divya', label: 'Divya Darshana', tag: 'NEW', tagColor: '#E38B29', bg: '#FBEFD8', darkBg: '#291D0F', icon: require('../../../assets/hero-icons/cutout/divya-darshana.png'), route: '/divya-darshana' },
] as const;

// ============================================================
// SECTION 2: DISCOVER BY INTEREST (matching web DiscoverByInterest)
// ============================================================
// ============================================================
// SECTION 3: TOP 20 INDIA (matching web — full 20 destinations)
// ============================================================
// ============================================================
// SECTION 4: VISA-FREE COUNTRIES (matching web CollectionGrid)
// ============================================================
// ============================================================
// SECTION 5: SACRED PILGRIMAGE SITES (matching web PilgrimageSection)
// ============================================================
// ============================================================
// SECTION 6: TREKKING DESTINATIONS (matching web TrekkingSection)
// ============================================================


// ============================================================
// MAIN HOME SCREEN
// ============================================================
// An ISO-3166 alpha-2 code maps to its flag by offsetting each letter into the
// Unicode regional-indicator block — no asset or lookup table needed.
function flagForCountry(code?: string): string {
  const cc = (code || 'IN').trim().toUpperCase();
  // Any two letters produce *a* glyph, but an unassigned pair renders as the
  // raw letters in a box. Only emit a flag for codes we actually ship.
  const KNOWN = new Set([
    'IN', 'US', 'GB', 'AE', 'SG', 'TH', 'MY', 'ID', 'LK', 'NP', 'BT', 'MV',
    'AU', 'CA', 'FR', 'DE', 'IT', 'ES', 'CH', 'NL', 'JP', 'KR', 'CN', 'VN',
    'PH', 'TR', 'EG', 'ZA', 'NZ', 'QA', 'SA', 'OM', 'KW', 'BH',
  ]);
  if (!/^[A-Z]{2}$/.test(cc) || !KNOWN.has(cc)) return '\uD83C\uDDEE\uD83C\uDDF3';
  return String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 65)),
  );
}

/** The bell, with a red count of unread notifications. */
function NotificationBell({ color }: { color: string }) {
  const unread = useNotificationStore((st) => st.unread);
  return (
    <View>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={22} color={color} />
      {unread > 0 ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The typed city as its own leaf, so typing never re-renders the page. */
function TypedCity({ style, prefix = '', still }: { style: any; prefix?: string; still: boolean }) {
  const city = useTypedCity(still);
  return <Text style={style}>{prefix}{city}</Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Auto-detect country and adapt home screen content
  const { country, countryName, region, isEuropean } = useAutoLocationDetection();
  const userPreferences = useAppStore((state) => state.userPreferences);
  const isIndiaUser = userPreferences.country === 'IN';

  // requireAuth with guest free-tier limit support
  // feature: 'PLAN_TRIP' | null (null = hard require, no free uses)
  const requireAuth = useCallback(
    async (onSuccess: () => void, feature?: 'PLAN_TRIP') => {
      const isGuest = !isAuthenticated || !user?.uid || user.uid === 'guest-user';
      if (!isGuest) {
        onSuccess();
        return;
      }
      // Guest with a limited-use feature
      if (feature) {
        const allowed = await canGuestUse(feature);
        if (allowed) {
          await incrementGuestUsage(feature);
          const remaining = GUEST_LIMITS[feature] - (await (async () => {
            const { getGuestUsageCount } = await import('@prayana/shared-utils');
            return getGuestUsageCount(feature);
          })());
          if (remaining <= 0) {
            // Used last free attempt — navigate then prompt
            onSuccess();
            setTimeout(() => {
              Alert.alert(
                'Free limit reached',
                `You've used your ${GUEST_LIMITS[feature]} free trip plans. Sign in to continue planning and save your trips.`,
                [
                  { text: 'Later', style: 'cancel' },
                  { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
                ]
              );
            }, 500);
          } else {
            onSuccess();
          }
          return;
        }
        // Limit exceeded
        Alert.alert(
          'Free limit reached',
          `You've used all ${GUEST_LIMITS[feature]} free trip plans. Sign in to plan unlimited trips and save them.`,
          [
            { text: 'Maybe later', style: 'cancel' },
            { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
          ]
        );
        return;
      }
      // Hard require (create trip = must be signed in)
      Alert.alert(
        'Sign In Required',
        'Please sign in to create and save trips.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ]
      );
    },
    [isAuthenticated, user, router]
  );
  const { themeColors, isDarkMode, toggleTheme } = useTheme();

  // ── HERO (web parity) ─────────────────────────────────────────────────────
  // Reduced-motion: skip the looping ambience (Ken Burns / shimmer / halo / spin)
  // when the OS asks for it. The typewriter + caret are content, not ambience,
  // but we still hold them still under reduced motion.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (!cancelled) setReduceMotion(!!on); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => setReduceMotion(!!on));
    return () => { cancelled = true; sub?.remove?.(); };
  }, []);

  // Seasonal eyebrow — picked by the real current month (web parity).
  const seasonal = SEASONAL.find((s) => (s.m as readonly number[]).includes(new Date().getMonth())) || SEASONAL[0];

  // Typewriter: see lib/typedCity — only the two words below re-render per letter.

  // Ken Burns (slow zoom + drift), eyebrow shimmer sweep, CTA halo pulse,
  // Sparkles spin, blinking caret — all looping Animated values.
  const kenBurns = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const ctaHalo = useRef(new Animated.Value(0)).current;
  const sparkleSpin = useRef(new Animated.Value(0)).current;
  const caret = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(kenBurns, { toValue: 1, duration: 26000, useNativeDriver: true }),
          Animated.timing(kenBurns, { toValue: 0, duration: 26000, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.delay(1400),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ctaHalo, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ctaHalo, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.timing(sparkleSpin, { toValue: 1, duration: 3000, useNativeDriver: true })
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(caret, { toValue: 0, duration: 550, useNativeDriver: true }),
          Animated.timing(caret, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, kenBurns, shimmer, ctaHalo, sparkleSpin, caret]);

  const kenScale = kenBurns.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const kenX = kenBurns.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const kenY = kenBurns.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-140, SCREEN_WIDTH] });
  const haloScale = ctaHalo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const haloOpacity = ctaHalo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const spin = sparkleSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showQuickItinerary, setShowQuickItinerary] = useState(false);
  // "Plan a Trip" choice sheet — web parity (HeroSection's showPlanChoice modal).
  // The hero CTA no longer jumps straight into the full planner; it asks first.
  const [showPlanChoice, setShowPlanChoice] = useState(false);

  // The home rails load their own data on mount; there is nothing left for a
  // pull to re-fetch here, so it just settles the spinner.
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const handleDestinationPress = useCallback((name: string, preview?: { image?: string; desc?: string }) => {
    console.log('[Home] Destination pressed:', name);
    const params = new URLSearchParams();
    if (preview?.image) params.set('previewImage', preview.image);
    if (preview?.desc) params.set('previewDesc', preview.desc);
    const qs = params.toString();
    router.push(`/destination/${encodeURIComponent(name)}${qs ? '?' + qs : ''}` as any);
  }, [router]);


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top header bar — logo + brand + quick actions (matches web) */}
      <View style={[styles.appHeader, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <View style={styles.appHeaderLeft}>
          <PrayanaLogo size={26} />
          <Text style={styles.appHeaderBrand}>PrayanaAI</Text>
        </View>
        <View style={styles.appHeaderRight}>
          {/* Community — web-parity header nav entry point */}
          <TouchableOpacity onPress={() => router.push('/community' as any)} hitSlop={8}>
            <Ionicons name="people-outline" size={22} color={themeColors.text} />
          </TouchableOpacity>
          {/* Country + currency selector (web parity: the TopNavigation flag +
              currency pill that opens LocationPreferences). Taps into the country
              settings screen. The India flag is drawn — the 🇮🇳 emoji renders as
              "?" boxes in this RN build (regional-indicator pairs have no glyph). */}
          <TouchableOpacity
            style={[styles.countryPill, { borderColor: themeColors.border }]}
            onPress={() => router.push('/settings/country' as any)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Country and currency"
          >
            {/* Was a hardcoded Indian tricolour drawn as three flat bars: it
                stayed Indian whatever country you picked, and without the
                Ashoka Chakra it read as generic stripes. Derive the real flag
                from the selected country code instead. */}
            <Text style={styles.appHeaderFlag}>{flagForCountry(userPreferences.country)}</Text>
            <Text style={[styles.countryPillText, { color: themeColors.textSecondary }]}>
              {userPreferences.currency || 'INR'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} hitSlop={8}>
            <Ionicons name={isDarkMode ? 'sunny-outline' : 'moon-outline'} size={22} color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications' as any)} hitSlop={8} accessibilityLabel="Notifications">
            <NotificationBell color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} style={styles.appHeaderAvatar} hitSlop={8}>
            <Ionicons name="person" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[500]} />}
      >
        {/* ============================================================ */}
        {/* HERO SECTION (matching web HeroSection)                       */}
        {/* ============================================================ */}
        <View style={styles.hero}>
          {/* Background — ONE fixed scenic photo with a slow Ken Burns zoom/drift.
              Kept in its own clipped layer so the transform never moves the content. */}
          <View style={styles.heroBgClip} pointerEvents="none">
            <Animated.Image
              source={HERO_SCENERY}
              style={[
                styles.heroBgImage,
                { transform: [{ scale: kenScale }, { translateX: kenX }, { translateY: kenY }] },
              ]}
              resizeMode="cover"
            />

            {/* Cinematic scrim — the web's vertical ramp (0.60 → 0.50 → 0.34 → 0.30 → 0.48). */}
            <LinearGradient
              colors={[
                'rgba(0,0,0,0.60)',
                'rgba(0,0,0,0.50)',
                'rgba(0,0,0,0.34)',
                'rgba(0,0,0,0.30)',
                'rgba(0,0,0,0.48)',
              ]}
              locations={[0, 0.26, 0.52, 0.72, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Soft "spotlight" behind the text — RN has no radial-gradient, so this
                approximates the web's radial(150% 105% at 50% 22%) with a very large,
                heavily-rounded dark ellipse centred over the headline column. */}
            <View style={styles.heroSpotlight} />

            {/* Bottom fade — melts the hero into the next (white/black) section. */}
            <LinearGradient
              colors={
                isDarkMode
                  ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.78)', '#000000']
                  : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.34)', 'rgba(255,255,255,0.78)', '#FFFFFF']
              }
              locations={[0, 0.5, 0.82, 1]}
              style={styles.heroFade}
            />
          </View>

          {/* Glass badge — seasonal context, auto-picked from the current month */}
          <View style={styles.heroBadge}>
            {/* light sweep across the glass (web's hero-eyebrow-shimmer) */}
            <Animated.View
              pointerEvents="none"
              style={[styles.heroBadgeShimmer, { transform: [{ translateX: shimmerX }] }]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Ionicons name={seasonal.icon} size={17} color={seasonal.iconColor} style={styles.heroBadgeEmoji} />
            <View style={styles.heroBadgeText}>
              <Text style={styles.heroBadgeTitle}>{seasonal.title}</Text>
              <Text style={styles.heroBadgeSub}>{seasonal.sub}</Text>
            </View>
          </View>

          {/* Headline — script + serif, typed destination in teal + blinking caret */}
          <Text style={styles.heroScript}>Plan your</Text>
          <Text style={styles.heroSerif}>
            perfect escape to{' '}
            <TypedCity style={styles.heroSerifAccent} still={reduceMotion} />
            <Animated.Text style={[styles.heroCaret, { opacity: caret }]}>|</Animated.Text>
          </Text>

          {/* Primary CTA — red→orange logo gradient pill, pulsing halo + spinning sparkles */}
          <View style={styles.ctaWrap}>
            <Animated.View
              pointerEvents="none"
              style={[styles.ctaHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
            >
              <LinearGradient
                colors={[BRAND.flame, BRAND.red]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaHaloFill}
              />
            </Animated.View>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setShowPlanChoice(true)}
              style={styles.ctaButton}
            >
              <LinearGradient
                colors={[BRAND.red, BRAND.flame]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                </Animated.View>
                <Text style={styles.ctaText}>Plan a Trip with AI</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search — white pill with teal ring */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push('/search')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={20} color="#71717A" />
            <TypedCity style={styles.searchPlaceholder} prefix="Search for " still={reduceMotion} />
            <View style={styles.searchSparkle}>
              <Ionicons name="sparkles" size={16} color="#71717A" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* MORE WAYS TO EXPLORE — pastel cards with NEW/SOON badges      */}
        {/* ============================================================ */}
        <View style={styles.moreWays}>
          <Text style={[styles.moreWaysTitle, { color: themeColors.text }]}>
            <Text style={styles.moreWaysAccent}>More ways</Text> to explore
          </Text>
          <View style={styles.moreWaysRule} />
          {/* All 4 cards fit the screen at once (web-mobile parity) — a 4-up
              grid sized to the viewport, not a horizontal scroll. */}
          <View style={styles.moreWaysGrid}>
            {MORE_WAYS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.wayCard, { backgroundColor: isDarkMode ? m.darkBg : m.bg, width: MORE_WAYS_CARD_W }, isDarkMode && { borderWidth: 1, borderColor: `${m.tagColor}40` }]}
                onPress={() =>
                  m.id === 'things'
                    ? setCategoriesOpen(true) // open the "All categories" sheet (web parity)
                    : router.push((m as { route: string }).route as any)
                }
                activeOpacity={0.85}
              >
                <View style={[styles.wayTag, { backgroundColor: m.tagColor }]}>
                  <Text style={styles.wayTagText}>{m.tag}</Text>
                </View>
                <Image source={m.icon} style={styles.wayIcon} resizeMode="contain" />
                <Text style={[styles.wayLabel, isDarkMode && { color: '#F5F5F7' }]} numberOfLines={2}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent AI-generated itineraries (Plan-a-Trip + Quick Itinerary) */}
        <RecentItineraries />

        {/* ============================================================ */}
        {/* COUNTRY-SPECIFIC CONTENT                                      */}
        {/* India users see curated hardcoded content                      */}
        {/* Other countries see dynamic API-driven content                 */}
        {/* ============================================================ */}
        {!isIndiaUser ? (
          <DynamicHomeContent
            countryCode={userPreferences.country}
            countryName={userPreferences.countryName}
            region={userPreferences.region}
            isEuropean={userPreferences.isEuropean}
          />
        ) : (
        <>
        {/* Between "More ways" and "Discover by Interest", same as the web. */}
        <TrekkingRail />

        {/* ============================================================ */}
        {/* DISCOVER BY INTEREST (matching web DiscoverByInterest)        */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Discover by Interest</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Find your perfect destination based on what you love most
          </Text>
          {/* Same mood posters and clips as the web. */}
          <DiscoverByInterestRail />
        </View>

        {/* ============================================================ */}
        {/* SACRED PILGRIMAGE SITES (arch poster rail matching web)       */}
        {/* ============================================================ */}
        {/* Temple band: cream backdrop, diya divider, arch posters and the
            yatra path that tracks the scroll. */}
        <PilgrimageSection
          onPlacePress={(p) => handleDestinationPress(p.name, { image: p.image, desc: p.description })}
        />

        {/* ============================================================ */}
        {/* TOP 20 INDIA (matching web CollectionGrid masonry)            */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Top 20 Destinations to visit in India</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Discover India's most captivating destinations
          </Text>

          {/* Same ranked posters and photo reels as the web. */}
          <TopIndiaRail
            onPlacePress={(p) => handleDestinationPress(p.name, { image: p.image, desc: p.description })}
          />
        </View>

        </>
        )}

        {/* ============================================================ */}
        {/* EXPLORE INDIA BY REGION (matching web IndianRegionalDest)      */}
        {/* ============================================================ */}
        <LinearGradient
          colors={isDarkMode
            ? ['#000000', '#0a0a0a', '#000000']
            : ['#EFF6FF', '#ffffff', '#EFF6FF']
          }
          style={styles.regionSection}
        >
          <Text style={[styles.sectionTitle, { color: themeColors.text, textAlign: 'center' }]}>
            Explore India by Region
          </Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary, textAlign: 'center' }]}>
            Discover the diverse beauty of India, one region at a time.
          </Text>

          {/* Same postcards, sliding tabs and Shuffle as the web. */}
          <RegionPostcards
            onPlacePress={(d) => handleDestinationPress(d.name, { image: d.image })}
          />
        </LinearGradient>

        {/* Promo trio — eSIM / Divya Darshana / Holiday Packages (web parity:
            EsimHomepageSection + DivyaDarshanaPromoCard + HolidayPackagesPromoCard). */}
        <PromoTrio />

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* More services bottom sheet — at root so the Modal portals correctly on Android */}
      <Modal
        visible={showMoreSheet}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowMoreSheet(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowMoreSheet(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: isDarkMode ? '#FFFFFF' : '#111827' }]}>
              More travel services
            </Text>
            <View style={styles.sheetGrid}>
              {HERO_TABS_MORE.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.sheetItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowMoreSheet(false);
                    router.push(tab.route as any);
                  }}
                >
                  {tab.icon ? (
                    <Image source={tab.icon} style={styles.heroTabIcon} resizeMode="contain" />
                  ) : (
                    <View
                      style={[
                        styles.heroTabIcon,
                        styles.sheetGlyph,
                        { backgroundColor: isDarkMode ? 'rgba(74,192,204,0.2)' : '#E6F7F8' },
                      ]}
                    >
                      <Ionicons name={tab.ionicon || 'apps'} size={28} color={isDarkMode ? BRAND.tealLight : '#0D9488'} />
                    </View>
                  )}
                  {/* White labels vanished on the light sheet; follow the sheet. */}
                  <Text
                    style={[styles.heroTabLabel, { color: isDarkMode ? '#FFFFFF' : '#111827' }]}
                    numberOfLines={2}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* "Plan a Trip" choice sheet — mirrors the web HeroSection showPlanChoice modal.
          Two modes: a 60-second AI plan, or the collaborative planner. Emoji don't
          render in this build, so the web's 👋 / 🔒 are Ionicons here. */}
      <Modal
        visible={showPlanChoice}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowPlanChoice(false)}
      >
        <Pressable style={styles.planBackdrop} onPress={() => setShowPlanChoice(false)}>
          <ScrollView
            contentContainerStyle={styles.planScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={[
                styles.planCardSheet,
                { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF' },
              ]}
              onPress={(e) => e.stopPropagation?.()}
            >
              {/* Close */}
              <TouchableOpacity
                onPress={() => setShowPlanChoice(false)}
                style={styles.planClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>

              {/* Header — "Hey Explorer!" + script heading with a teal, underlined accent */}
              <View style={styles.planHeader}>
                <View style={styles.planEyebrow}>
                  <Ionicons name="hand-left" size={14} color={BRAND.teal} />
                  <Text
                    style={[
                      styles.planEyebrowText,
                      { color: isDarkMode ? '#E5E7EB' : '#374151' },
                    ]}
                  >
                    Hey Explorer!
                  </Text>
                </View>
                <Text
                  style={[
                    styles.planHeading,
                    { color: isDarkMode ? '#FFFFFF' : '#111827' },
                  ]}
                >
                  How shall we <Text style={styles.planHeadingAccent}>plan your trip?</Text>
                </Text>
                {/* RN can't underline a colour-independent decoration cleanly, so the
                    web's teal underline is drawn as a rule under the accent. */}
                <View style={styles.planHeadingRule} />
              </View>

              {/* The two modes */}
              {PLAN_CHOICES.map((choice) => (
                <TouchableOpacity
                  key={choice.id}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={choice.title}
                  onPress={() => {
                    setShowPlanChoice(false);
                    router.push(choice.route as any);
                  }}
                  style={[
                    styles.planChoice,
                    {
                      borderColor: choice.ring,
                      backgroundColor: isDarkMode ? choice.tintDark : choice.tintLight,
                    },
                  ]}
                >
                  {/* Illustration fills the card's image area */}
                  <View style={styles.planIllusWrap}>
                    <Image source={choice.illus} style={styles.planIllus} resizeMode="cover" />
                    <View style={styles.planBadge}>
                      <Ionicons name={choice.badgeIcon} size={11} color={choice.color} />
                      <Text style={[styles.planBadgeText, { color: choice.color }]}>
                        {choice.badge}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.planChoiceBody}>
                    <View style={styles.planChoiceText}>
                      <Text
                        style={[
                          styles.planChoiceTitle,
                          { color: isDarkMode ? choice.colorDark : choice.color },
                        ]}
                      >
                        {choice.title}
                      </Text>
                      <Text
                        style={[
                          styles.planChoiceDesc,
                          { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                        ]}
                      >
                        {choice.desc}
                      </Text>
                    </View>
                    <View style={[styles.planChoiceArrow, { backgroundColor: choice.color }]}>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Trust note */}
              <View style={styles.planFooter}>
                <Ionicons name="lock-closed" size={12} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text
                  style={[
                    styles.planFooterText,
                    { color: isDarkMode ? '#6B7280' : '#9CA3AF' },
                  ]}
                >
                  Your data is private and secure
                </Text>
              </View>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Modal>

      {/* Floating AI Chat Button (matching web FloatingChatButton) */}
      {/* Hide the floating chat FAB while the Quick Itinerary popup is open
          so it doesn't overlap the form/keyboard. */}
      {!showQuickItinerary && <FloatingChatFAB />}

      {/* Quick Itinerary generate popup (opens from the hero tab) */}
      <QuickItineraryModal visible={showQuickItinerary} onClose={() => setShowQuickItinerary(false)} />

      {/* "All categories" slide-in (opens from the Things to Do card — web parity) */}
      <AllCategoriesSheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  bellBadge: {
    position: 'absolute', top: -5, right: -7, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: '#E61417', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  bellBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '900' },
  container: { flex: 1 },

  // ---- HERO SECTION ----
  hero: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // Clipped background layer — holds the Ken Burns photo + scrim + fade so the
  // photo's transform can never push the hero content around.
  heroBgClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroBgImage: {
    // Slightly oversized so the Ken Burns drift never exposes an edge.
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    width: undefined,
    height: undefined,
  },
  // Approximated radial spotlight behind the headline column (RN has no
  // radial-gradient) — a wide, very rounded dark ellipse centred near the top.
  heroSpotlight: {
    position: 'absolute',
    left: -SCREEN_WIDTH * 0.35,
    right: -SCREEN_WIDTH * 0.35,
    top: -60,
    height: 340,
    borderRadius: 200,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  // Bottom fade — hero melts into the next section instead of a hard edge.
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  orb1: {
    position: 'absolute',
    top: -20,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  orb2: {
    position: 'absolute',
    top: 20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  heroTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  servicesBar: {
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  serviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  serviceBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  heroActionBtn: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  heroActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 6,
    borderRadius: 999,
  },
  heroActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Top app header bar
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appHeaderBrand: {
    fontSize: 19,
    fontWeight: '800',
    color: BRAND.teal,
    letterSpacing: -0.25,
  },
  appHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  countryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Sized just under the 12pt "INR" label it sits beside. At 15pt the emoji
  // was the largest thing in the pill and read as a sticker rather than a
  // quiet country indicator.
  appHeaderFlag: { fontSize: 11, lineHeight: 14 },
  appHeaderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BRAND.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Glass badge — translucent pill over the hero photo
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 7,
    maxWidth: '90%',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  // Translucent light strip that sweeps across the glass pill.
  heroBadgeShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
  heroBadgeEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
  heroBadgeText: {
    flexShrink: 1,
  },
  heroBadgeTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  heroBadgeSub: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 10,
    marginTop: 1,
  },
  // Headline — script + serif, mirroring the web hero
  heroScript: {
    fontFamily: 'Snell Roundhand',
    fontSize: 30,
    color: BRAND.tealAccent,
    textAlign: 'center',
    marginBottom: -2,
  },
  // The web's mobile hero sizes this line SMALLER than the script line above it
  // (.hero-home h1 > span:last-child is 1.375rem vs the script's 1.625rem). At
  // 32px it was larger than "Plan your", filled the width, and wrapped clumsily.
  heroSerif: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
  },
  heroSerifAccent: {
    color: BRAND.tealAccent,
  },
  heroCaret: {
    color: BRAND.tealAccent,
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
  },
  // Primary CTA — red→orange logo gradient pill, with a pulsing gradient halo
  ctaWrap: {
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft pulsing glow behind the CTA. A solid gradient slab here read as a hard
  // dark rectangle around the pill; a wide, low-opacity fill plus a large blurred
  // shadow gives the web's halo instead of an outline.
  ctaHalo: {
    position: 'absolute',
    left: -18,
    right: -18,
    top: -14,
    bottom: -14,
    borderRadius: 999,
    shadowColor: BRAND.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 22,
    elevation: 12,
  },
  ctaHaloFill: {
    flex: 1,
    borderRadius: 999,
    opacity: 0.5,
  },
  ctaButton: {
    borderRadius: 999,
    shadowColor: BRAND.red,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // "More ways to explore" — pastel cards
  moreWays: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  moreWaysTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  moreWaysAccent: {
    color: BRAND.teal,
  },
  moreWaysRule: {
    alignSelf: 'center',
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND.teal,
    marginTop: 8,
    marginBottom: 16,
  },
  moreWaysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wayCard: {
    // width set inline (MORE_WAYS_CARD_W) so all 4 fit the viewport
    aspectRatio: 0.78,
    borderRadius: 14,
    padding: 8,
    justifyContent: 'space-between',
  },
  wayTag: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  wayTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  wayIcon: {
    width: 34,
    height: 34,
    alignSelf: 'flex-start',
  },
  wayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#18181B',
    lineHeight: 14,
  },

  // Hero Service Tabs (PWA-style: 4 brand icons + More)
  heroTab: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  heroTabIcon: {
    width: 52,
    height: 52,
  },
  heroTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  sheetGlyph: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sheetItem: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },

  // ---- "Plan a Trip" CHOICE SHEET (web HeroSection parity) ----
  // Centred card over a dark scrim. RN has no backdrop-filter, so the web's
  // blurred backdrop is approximated with a heavier black scrim.
  planBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  // ScrollView so the sheet never overflows on small screens.
  planScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  planCardSheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    // Design-system RN port: shadow (iOS) + elevation (Android) together.
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 16,
  },
  // Floating close button — sits at the card's top-right corner, like the web's.
  planClose: {
    position: 'absolute',
    top: -12,
    right: -8,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  planEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planEyebrowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Same script face as the hero's "Plan your" — the sheet must read as one product.
  planHeading: {
    fontFamily: 'Snell Roundhand',
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 4,
  },
  planHeadingAccent: {
    color: '#2FB0A6', // web's sheet accent — sits in the brand teal family
  },
  planHeadingRule: {
    width: 130,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    backgroundColor: 'rgba(47,176,166,0.40)',
  },
  // Cards are STACKED (a phone is too narrow for the web's 2-up grid).
  planChoice: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  planIllusWrap: {
    width: '100%',
    height: 132,
    position: 'relative',
  },
  planIllus: {
    width: '100%',
    height: '100%',
  },
  planBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  planChoiceBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planChoiceText: {
    flex: 1,
  },
  planChoiceTitle: {
    fontFamily: 'Snell Roundhand',
    fontSize: 26,
    lineHeight: 32,
  },
  planChoiceDesc: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  // 44pt tap-affordance chip (the whole card is pressable, this is the arrow cue).
  planChoiceArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  planFooterText: {
    fontSize: 11.5,
  },

  // Services Bar (legacy)

  // Search Bar
  // Input — DS component spec: h 40 · radius 8 · text 14 · icon 16 @ left 12
  // Search — white pill with a teal ring, over the hero photo
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: BRAND.teal,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  searchPlaceholder: {
    fontSize: 14,
    flex: 1,
  },
  searchSparkle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Action Buttons

  // ---- SECTIONS ----
  section: {
    paddingTop: 28,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 20,
  },
  sectionSubtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingRight: 20,
  },
  passportBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportEmoji: {
    fontSize: 28,
  },

  // ---- DISCOVER BY INTEREST ----

  // ---- MASONRY GRID (shared for Visa-Free & Pilgrimage) ----
  // ---- TOP 20 INDIA ----

  // ---- TREKKING DESTINATIONS ----

  // ---- FEATURED ACTIVITIES ----

  // ---- EXPLORE INDIA BY REGION ----
  regionSection: {
    paddingTop: 32,
    paddingBottom: 20,
  },
});
