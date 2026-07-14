import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
  Animated,
  Pressable,
  Alert,
  Modal,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, shadow, borderRadius, useTheme, PrayanaLogo } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { useAuth, useAutoLocationDetection } from '@prayana/shared-hooks';
import { useAppStore } from '@prayana/shared-stores';
import { resolveImageUrl, canGuestUse, incrementGuestUsage, GUEST_LIMITS } from '@prayana/shared-utils';
import { FloatingChatFAB } from '../../components/chat/FloatingChatFAB';
import { QuickItineraryModal } from '../../components/trip/QuickItineraryModal';
import { RecentItineraries } from '../../components/home/RecentItineraries';
import DynamicHomeContent from '../../components/home/DynamicHomeContent';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to extract image URL from either a string or { url: string } object
const getImageUrl = (img: any): string | null => {
  if (!img) return null;
  if (typeof img === 'string') return resolveImageUrl(img) || img;
  if (typeof img === 'object' && img.url) return resolveImageUrl(img.url) || img.url;
  return null;
};

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

// Hidden behind "More" (matches PWA overflow sheet).
const HERO_TABS_MORE = [
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
  tealDeep: '#0D5E5F',
  tealInk: '#042F2E',
  red: '#E61417', // secondary — badges, urgent states. Small areas only.
  flame: '#FB923C', // logo gradient stop — CTA only
} as const;

// Hero rotates a destination photo + name, mirroring the web ("…escape to Kerala").
// Every photo below was opened and confirmed to actually depict its destination.
// NOTE: TOP_INDIA's own list is not safe to reuse here — its "Ladakh" URL returns
// a tropical beach and its "Kashmir" URL is a dead 404.
const HERO_DESTINATIONS = [
  { name: 'Kerala', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80' }, // backwaters
  { name: 'Rajasthan', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=80' }, // Hawa Mahal
  { name: 'Agra', image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80' }, // Taj Mahal
  { name: 'Goa', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&q=80' }, // beach
  { name: 'Himachal', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80' }, // snow
];

// "More ways to explore" — pastel cards with NEW/SOON badges (web parity).
// Icons use the transparent cutouts — the originals have an opaque white plate
// that reads as a white box on the pastel cards.
const MORE_WAYS = [
  { id: 'esim', label: 'Travel eSIM', tag: 'NEW', tagColor: '#E61417', bg: '#FDECE4', icon: require('../../../assets/hero-icons/cutout/esim.png'), route: '/esim' },
  { id: 'world', label: 'Explore World', tag: 'NEW', tagColor: '#7C3AED', bg: '#ECE7FB', icon: require('../../../assets/hero-icons/cutout/global-experiences.png'), route: '/global-experiences' },
  { id: 'things', label: 'Things to Do', tag: 'NEW', tagColor: '#E11D48', bg: '#FDE6EA', icon: require('../../../assets/hero-icons/cutout/activities.png'), route: '/activities' },
  { id: 'deals', label: 'Holiday Deals', tag: 'SOON', tagColor: '#F59E0B', bg: '#FDF3D8', icon: require('../../../assets/hero-icons/cutout/holiday-packages.png'), route: '/packages' },
];

// ============================================================
// SECTION 2: DISCOVER BY INTEREST (matching web DiscoverByInterest)
// ============================================================
const DISCOVER_COLLECTIONS = [
  {
    id: 'mountain',
    label: 'Serene Hill Stations',
    subtitle: 'Mountain retreats',
    category: 'MOUNTAIN',
    gradient: ['#06B6D4', '#0891b2'] as const,
    destinations: ['Shimla', 'Manali', 'Darjeeling', 'Munnar'],
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600&q=80',
  },
  {
    id: 'beach',
    label: 'Best Beach Destinations',
    subtitle: 'Sun, sand & surf',
    category: 'BEACH',
    gradient: ['#F59E0B', '#D97706'] as const,
    destinations: ['Goa', 'Andaman', 'Kerala', 'Lakshadweep'],
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=80',
  },
  {
    id: 'romantic',
    label: 'Idyllic Romantic Destinations',
    subtitle: 'For couples',
    category: 'ROMANTIC',
    gradient: ['#EC4899', '#DB2777'] as const,
    destinations: ['Kashmir', 'Udaipur', 'Coorg', 'Alleppey'],
    image: 'https://images.unsplash.com/photo-1597074866923-dc0589150a32?w=600&q=80',
  },
  {
    id: 'honeymoon',
    label: 'Dreamy Honeymoon Escapes',
    subtitle: 'International getaways',
    category: 'HONEYMOON',
    gradient: ['#8B5CF6', '#7C3AED'] as const,
    destinations: ['Maldives', 'Bali', 'Switzerland', 'Santorini'],
    image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80',
  },
  {
    id: 'international',
    label: 'Affordable International',
    subtitle: 'Budget-friendly',
    category: 'INTERNATIONAL',
    gradient: ['#06B6D4', '#155e75'] as const,
    destinations: ['Thailand', 'Nepal', 'Sri Lanka', 'Bhutan'],
    image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=80',
  },
  {
    id: 'weekend',
    label: 'Perfect Weekend Getaways',
    subtitle: 'Quick escapes',
    category: 'WEEKEND',
    gradient: ['#10B981', '#059669'] as const,
    destinations: ['Lonavala', 'Pondicherry', 'Pushkar', 'Hampi'],
    image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=600&q=80',
  },
  {
    id: 'adventure',
    label: 'Thrilling Adventure Spots',
    subtitle: 'Adrenaline rush',
    category: 'ADVENTURE',
    gradient: ['#EF4444', '#DC2626'] as const,
    destinations: ['Ladakh', 'Rishikesh', 'Spiti', 'Meghalaya'],
    image: 'https://images.unsplash.com/photo-1617859047452-8510bcf207fd?w=600&q=80',
  },
];

// ============================================================
// SECTION 3: TOP 20 INDIA (matching web — full 20 destinations)
// ============================================================
const TOP_INDIA = [
  { name: 'Goa', desc: 'Beach paradise with vibrant nightlife', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=80' },
  { name: 'Kerala', desc: "God's Own Country", image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&q=80' },
  { name: 'Rajasthan', desc: 'Land of Kings and forts', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=80' },
  { name: 'Kashmir', desc: 'Paradise on Earth', image: 'https://images.unsplash.com/photo-1597074866923-dc0589150a32?w=600&q=80' },
  { name: 'Ladakh', desc: 'Land of high passes', image: 'https://images.unsplash.com/photo-1617859047452-8510bcf207fd?w=600&q=80' },
  { name: 'Agra', desc: 'Home of the Taj Mahal', image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&q=80' },
  { name: 'Varanasi', desc: 'Spiritual capital of India', image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=600&q=80' },
  { name: 'Himachal Pradesh', desc: 'Snow-capped mountains', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600&q=80' },
  { name: 'Andaman', desc: 'Pristine islands & coral reefs', image: 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=600&q=80' },
  { name: 'Hampi', desc: 'UNESCO World Heritage ruins', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=600&q=80' },
  { name: 'Jaipur', desc: 'The Pink City of palaces', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=80' },
  { name: 'Rishikesh', desc: 'Yoga capital of the world', image: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=80' },
  { name: 'Udaipur', desc: 'City of Lakes', image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80' },
  { name: 'Darjeeling', desc: 'Queen of the Hills', image: 'https://images.unsplash.com/photo-1622308644420-4e6651de210b?w=600&q=80' },
  { name: 'Mysore', desc: 'Palace City of India', image: 'https://images.unsplash.com/photo-1600100397608-4294b20048d6?w=600&q=80' },
  { name: 'Coorg', desc: "Scotland of India", image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80' },
  { name: 'Manali', desc: 'Snow & adventure hub', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600&q=80' },
  { name: 'Ooty', desc: 'Queen of Hill Stations', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80' },
  { name: 'Pondicherry', desc: 'French Riviera of the East', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80' },
  { name: 'Amritsar', desc: 'Golden Temple & beyond', image: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=600&q=80' },
];

// ============================================================
// SECTION 4: VISA-FREE COUNTRIES (matching web CollectionGrid)
// ============================================================
const VISA_FREE = [
  { name: 'Maldives', flag: '🇲🇻', desc: 'Island paradise', image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=80' },
  { name: 'Mauritius', flag: '🇲🇺', desc: 'Tropical getaway', image: 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=400&q=80' },
  { name: 'Nepal', flag: '🇳🇵', desc: 'Himalayan kingdom', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80' },
  { name: 'Bhutan', flag: '🇧🇹', desc: 'Land of happiness', image: 'https://images.unsplash.com/photo-1553856622-d1b352e24a21?w=400&q=80' },
  { name: 'Thailand', flag: '🇹🇭', desc: 'Land of smiles', image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400&q=80' },
  { name: 'Indonesia', flag: '🇮🇩', desc: 'Islands of wonder', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { name: 'Sri Lanka', flag: '🇱🇰', desc: 'Pearl of Indian Ocean', image: 'https://images.unsplash.com/photo-1588598198321-9735fd52033c?w=400&q=80' },
  { name: 'Seychelles', flag: '🇸🇨', desc: 'Pristine beaches', image: 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=400&q=80' },
];

// ============================================================
// SECTION 5: SACRED PILGRIMAGE SITES (matching web PilgrimageSection)
// ============================================================
const PILGRIMAGE_SITES = [
  { name: 'Varanasi', category: 'Hindu', desc: 'Oldest living city', image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&q=80', featured: true },
  { name: 'Tirupati', category: 'Hindu', desc: 'Richest temple', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&q=80', featured: false },
  { name: 'Golden Temple', category: 'Sikh', desc: 'Amritsar', image: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=400&q=80', featured: false },
  { name: 'Kedarnath', category: 'Hindu', desc: 'Himalayan shrine', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&q=80', featured: false },
  { name: 'Ajmer Sharif', category: 'Sufi', desc: 'Dargah Sharif', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=400&q=80', featured: false },
  { name: 'Rishikesh', category: 'Spiritual', desc: 'Yoga & spirituality', image: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&q=80', featured: false },
  { name: 'Haridwar', category: 'Hindu', desc: 'Gateway of Gods', image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&q=80', featured: false },
  { name: 'Bodh Gaya', category: 'Buddhist', desc: 'Enlightenment site', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&q=80', featured: false },
];

// ============================================================
// SECTION 6: TREKKING DESTINATIONS (matching web TrekkingSection)
// ============================================================
const TREKKING_DESTINATIONS = [
  { name: 'Valley of Flowers', difficulty: 'Moderate', duration: '6 days', altitude: '3,658m', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&q=80' },
  { name: 'Hampta Pass', difficulty: 'Moderate', duration: '5 days', altitude: '4,270m', image: 'https://images.unsplash.com/photo-1617859047452-8510bcf207fd?w=400&q=80' },
  { name: 'Roopkund', difficulty: 'Hard', duration: '8 days', altitude: '5,029m', image: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&q=80' },
  { name: 'Chadar Trek', difficulty: 'Hard', duration: '9 days', altitude: '3,390m', image: 'https://images.unsplash.com/photo-1617859047452-8510bcf207fd?w=400&q=80' },
  { name: 'Kedarkantha', difficulty: 'Easy', duration: '4 days', altitude: '3,810m', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&q=80' },
  { name: 'Brahmatal', difficulty: 'Moderate', duration: '6 days', altitude: '3,475m', image: 'https://images.unsplash.com/photo-1597074866923-dc0589150a32?w=400&q=80' },
];

// ============================================================
// SECTION 7: ACTIVITIES (matching web ActivitiesHomepageSection)
// ============================================================
const ACTIVITY_CATEGORIES = [
  { label: 'All', emoji: '🌍', gradient: ['#6B7280', '#4B5563'] as const },
  { label: 'Adventure', emoji: '🧗', gradient: ['#F97316', '#DC2626'] as const },
  { label: 'Cultural', emoji: '🏛️', gradient: ['#8B5CF6', '#EC4899'] as const },
  { label: 'Food & Dining', emoji: '🍛', gradient: ['#EAB308', '#F97316'] as const },
  { label: 'Wildlife', emoji: '🐘', gradient: ['#16A34A', '#059669'] as const },
  { label: 'Spiritual', emoji: '🕌', gradient: ['#2563EB', '#06B6D4'] as const },
];

// ============================================================
// SECTION 8: REGIONAL INDIA (matching web IndianRegionalDestinations)
// ============================================================
const REGIONS: Record<string, { name: string; image: string }[]> = {
  north: [
    { name: 'Delhi', image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&q=80' },
    { name: 'Shimla', image: 'https://images.unsplash.com/photo-1597074866923-dc0589150a32?w=400&q=80' },
    { name: 'Leh-Ladakh', image: 'https://images.unsplash.com/photo-1617859047452-8510bcf207fd?w=400&q=80' },
    { name: 'Varanasi', image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400&q=80' },
    { name: 'Amritsar', image: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=400&q=80' },
    { name: 'Rishikesh', image: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&q=80' },
    { name: 'Agra', image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=400&q=80' },
  ],
  south: [
    { name: 'Kerala', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400&q=80' },
    { name: 'Hampi', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&q=80' },
    { name: 'Pondicherry', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&q=80' },
    { name: 'Mysore', image: 'https://images.unsplash.com/photo-1600100397608-4294b20048d6?w=400&q=80' },
    { name: 'Kanyakumari', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&q=80' },
    { name: 'Ooty', image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=80' },
    { name: 'Coorg', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&q=80' },
  ],
  east: [
    { name: 'Kolkata', image: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=400&q=80' },
    { name: 'Darjeeling', image: 'https://images.unsplash.com/photo-1622308644420-4e6651de210b?w=400&q=80' },
    { name: 'Puri', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&q=80' },
    { name: 'Shillong', image: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=400&q=80' },
    { name: 'Bhubaneswar', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&q=80' },
    { name: 'Gangtok', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&q=80' },
  ],
  west: [
    { name: 'Mumbai', image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&q=80' },
    { name: 'Goa', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80' },
    { name: 'Rann of Kutch', image: 'https://images.unsplash.com/photo-1583309219338-a582f1f9ca6b?w=400&q=80' },
    { name: 'Udaipur', image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400&q=80' },
    { name: 'Jaipur', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=400&q=80' },
    { name: 'Ajanta & Ellora', image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400&q=80' },
  ],
};
const REGION_TABS = ['North', 'South', 'East', 'West'];

// Category badge color mapping for pilgrimage
const CATEGORY_COLORS: Record<string, string> = {
  Hindu: '#F97316',
  Sikh: '#3B82F6',
  Sufi: '#10B981',
  Spiritual: '#8B5CF6',
  Buddhist: '#EAB308',
};

// Difficulty color mapping for trekking
const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#10B981',
  Moderate: '#F59E0B',
  Hard: '#EF4444',
};

// ============================================================
// MAIN HOME SCREEN
// ============================================================
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

  // Rotate the hero destination (photo + name) like the web hero does.
  // Every photo is prefetched first: the name swaps instantly, so without a
  // warm cache the old photo would still be on screen under the new name.
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all(HERO_DESTINATIONS.map((d) => Image.prefetch(d.image).catch(() => false)))
      .then(() => { if (!cancelled) setHeroReady(true); })
      .catch(() => { if (!cancelled) setHeroReady(true); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!heroReady) return; // don't rotate until every photo is cached
    const t = setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO_DESTINATIONS.length);
    }, 6000);
    return () => clearInterval(t);
  }, [heroReady]);
  const heroDest = HERO_DESTINATIONS[heroIdx];
  const [popularActivities, setPopularActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Prevent repeated focus-retries when the endpoint is consistently unavailable
  const fetchAttemptedRef = useRef(false);
  const [activeRegion, setActiveRegion] = useState('north');
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [showAllTop, setShowAllTop] = useState(false);
  const [showAllPilgrimage, setShowAllPilgrimage] = useState(false);
  const [showAllVisaFree, setShowAllVisaFree] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showQuickItinerary, setShowQuickItinerary] = useState(false);

  // Animated floating orbs
  const orbAnim1 = useRef(new Animated.Value(0)).current;
  const orbAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createFloat = (anim: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      );
    createFloat(orbAnim1, 4000).start();
    createFloat(orbAnim2, 5000).start();
  }, []);

  const orbTranslate1 = orbAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const orbTranslate2 = orbAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  // Fetch data — only activities (destinations are hardcoded, matching web PWA)
  // Use ref to prevent concurrent duplicate requests
  const fetchInFlightRef = useRef<AbortController | null>(null);

  const fetchPopularActivities = useCallback(async (silent = false) => {
    // Abort any in-flight request to prevent duplicates
    if (fetchInFlightRef.current) {
      fetchInFlightRef.current.abort();
    }
    const controller = new AbortController();
    fetchInFlightRef.current = controller;

    if (!silent) setLoadingActivities(true);
    try {
      const res = await makeAPICall('/activities/search?limit=8&sort=rating', {
        timeout: 15000,
        retries: 0,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res?.success && Array.isArray(res.data)) setPopularActivities(res.data);
      else if (Array.isArray(res)) setPopularActivities(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Log only on first failure — avoid repeating the same warning on every focus
      if (!fetchAttemptedRef.current) {
        console.warn('[Home] Activities fetch failed:', err.message);
      }
    } finally {
      fetchAttemptedRef.current = true;
      fetchInFlightRef.current = null;
      if (!silent) setLoadingActivities(false);
    }
  }, []);

  // Single fetch on mount (useFocusEffect fires on initial mount AND tab focus)
  useFocusEffect(
    useCallback(() => {
      if (!fetchAttemptedRef.current) {
        fetchPopularActivities();
      }
    }, [fetchPopularActivities])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchAttemptedRef.current = false;
    await fetchPopularActivities(true);
    setRefreshing(false);
  }, [fetchPopularActivities]);

  const handleDestinationPress = useCallback((name: string, preview?: { image?: string; desc?: string }) => {
    console.log('[Home] Destination pressed:', name);
    const params = new URLSearchParams();
    if (preview?.image) params.set('previewImage', preview.image);
    if (preview?.desc) params.set('previewDesc', preview.desc);
    const qs = params.toString();
    router.push(`/destination/${encodeURIComponent(name)}${qs ? '?' + qs : ''}` as any);
  }, [router]);

  const regionDests = REGIONS[activeRegion] || [];
  const visibleTop = showAllTop ? TOP_INDIA : TOP_INDIA.slice(0, 6);
  const visiblePilgrimage = showAllPilgrimage ? PILGRIMAGE_SITES : PILGRIMAGE_SITES.slice(0, 6);
  const visibleVisaFree = showAllVisaFree ? VISA_FREE : VISA_FREE.slice(0, 6);
  const CARD_W = (SCREEN_WIDTH - 48 - 12) / 2;
  const MASONRY_GAP = 10;
  const MASONRY_PADDING = 20;
  const MASONRY_FULL = SCREEN_WIDTH - MASONRY_PADDING * 2;
  const MASONRY_HALF = (MASONRY_FULL - MASONRY_GAP) / 2;
  const MASONRY_THIRD = (MASONRY_FULL - MASONRY_GAP * 2) / 3;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Top header bar — logo + brand + quick actions (matches web) */}
      <View style={[styles.appHeader, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <View style={styles.appHeaderLeft}>
          <PrayanaLogo size={26} />
          <Text style={styles.appHeaderBrand}>PrayanaAI</Text>
        </View>
        <View style={styles.appHeaderRight}>
          <Text style={styles.appHeaderFlag}>🇮🇳</Text>
          <TouchableOpacity onPress={toggleTheme} hitSlop={8}>
            <Ionicons name={isDarkMode ? 'sunny-outline' : 'moon-outline'} size={22} color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications' as any)} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={themeColors.text} />
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
        <ImageBackground
          source={{ uri: heroDest.image }}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          {/* Legibility scrim — bright destination photos need a real floor,
              otherwise the white serif headline washes out. */}
          <LinearGradient
            colors={['rgba(4,20,26,0.72)', 'rgba(4,20,26,0.55)', 'rgba(4,20,26,0.80)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Glass badge — seasonal context */}
          <View style={styles.heroBadge}>
            <Ionicons name="rainy-outline" size={18} color="#FFFFFF" />
            <View style={styles.heroBadgeText}>
              <Text style={styles.heroBadgeTitle}>Monsoon Magic Awaits</Text>
              <Text style={styles.heroBadgeSub}>Green trails, misty views &amp; peaceful escapes</Text>
            </View>
          </View>

          {/* Headline — script + serif, destination in teal (web parity) */}
          <Text style={styles.heroScript}>Plan your</Text>
          <Text style={styles.heroSerif}>
            perfect escape to{' '}
            <Text style={styles.heroSerifAccent}>{heroDest.name}</Text>
          </Text>

          {/* Primary CTA — red→orange logo gradient pill */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/trip/setup' as any)}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={[BRAND.red, BRAND.flame]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>Plan a Trip with AI</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Search — white pill with teal ring */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push('/search')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={20} color="#71717A" />
            <Text style={styles.searchPlaceholder}>Search for {heroDest.name}</Text>
            <View style={styles.searchSparkle}>
              <Ionicons name="sparkles" size={16} color="#71717A" />
            </View>
          </TouchableOpacity>
        </ImageBackground>

        {/* ============================================================ */}
        {/* MORE WAYS TO EXPLORE — pastel cards with NEW/SOON badges      */}
        {/* ============================================================ */}
        <View style={styles.moreWays}>
          <Text style={[styles.moreWaysTitle, { color: themeColors.text }]}>
            <Text style={styles.moreWaysAccent}>More ways</Text> to explore
          </Text>
          <View style={styles.moreWaysRule} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moreWaysRow}
          >
            {MORE_WAYS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.wayCard, { backgroundColor: m.bg }]}
                onPress={() => router.push(m.route as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.wayTag, { backgroundColor: m.tagColor }]}>
                  <Text style={styles.wayTagText}>{m.tag}</Text>
                </View>
                <Image source={m.icon} style={styles.wayIcon} resizeMode="contain" />
                <Text style={styles.wayLabel} numberOfLines={2}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
        {/* ============================================================ */}
        {/* DISCOVER BY INTEREST (matching web DiscoverByInterest)        */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Discover by Interest</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Find your perfect destination based on what you love most
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoverScroll}>
            {DISCOVER_COLLECTIONS.map((col) => (
              <Pressable
                key={col.label}
                style={({ pressed }) => [styles.discoverCard, pressed && { opacity: 0.9 }]}
                onPress={() => router.push(`/interest/${col.id}` as any)}
              >
                <Image source={{ uri: col.image }} style={styles.discoverImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.discoverOverlay}>
                  <View style={styles.discoverCategoryBadge}>
                    <Text style={styles.discoverCategoryText}>{col.category}</Text>
                  </View>
                  <Text style={styles.discoverTitle} numberOfLines={2}>{col.label}</Text>
                  <Text style={styles.discoverSubtitleText} numberOfLines={1}>{col.subtitle}</Text>
                  <View style={styles.discoverTags}>
                    {col.destinations.map((d) => (
                      <Pressable
                        key={d}
                        style={({ pressed }) => [styles.discoverTag, pressed && { backgroundColor: 'rgba(255,255,255,0.4)' }]}
                        onPress={() => handleDestinationPress(d)}
                      >
                        <Text style={styles.discoverTagText}>{d}</Text>
                      </Pressable>
                    ))}
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ============================================================ */}
        {/* VISA-FREE COUNTRIES (masonry grid matching web)               */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Visa-Free Countries</Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                No visa hassle for Indian passport holders
              </Text>
            </View>
            <View style={styles.passportBadge}>
              <Text style={styles.passportEmoji}>🛂</Text>
            </View>
          </View>

          {/* Masonry Grid: Row 1 = 1 large + 2 stacked, Row 2 = 3 equal, Row 3 = 2 equal */}
          <View style={styles.masonryContainer}>
            {/* Row 1: 1 large left + 2 stacked right */}
            {visibleVisaFree.length >= 3 && (
              <View style={styles.masonryRow1}>
                <TouchableOpacity
                  style={[styles.masonryLarge, shadow.md, { width: MASONRY_HALF, height: 240 }]}
                  activeOpacity={0.9}
                  onPress={() => handleDestinationPress(visibleVisaFree[0].name, { image: visibleVisaFree[0].image, desc: visibleVisaFree[0].desc })}
                >
                  <Image source={{ uri: visibleVisaFree[0].image }} style={styles.masonryImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.masonryOverlay}>
                    <View style={styles.visaFreeBadge}>
                      <Text style={styles.visaFreeBadgeText}>Visa-Free</Text>
                    </View>
                    <Text style={styles.visaFlag}>{visibleVisaFree[0].flag}</Text>
                    <Text style={styles.masonryTitle}>{visibleVisaFree[0].name}</Text>
                    <Text style={styles.masonryDesc}>{visibleVisaFree[0].desc}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={[styles.masonryStackedCol, { width: MASONRY_HALF }]}>
                  {visibleVisaFree.slice(1, 3).map((country) => (
                    <TouchableOpacity
                      key={country.name}
                      style={[styles.masonryStacked, shadow.md, { height: (240 - MASONRY_GAP) / 2 }]}
                      activeOpacity={0.9}
                      onPress={() => handleDestinationPress(country.name, { image: country.image, desc: country.desc })}
                    >
                      <Image source={{ uri: country.image }} style={styles.masonryImage} />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.masonryOverlay}>
                        <View style={styles.visaFreeBadge}>
                          <Text style={styles.visaFreeBadgeText}>Visa-Free</Text>
                        </View>
                        <Text style={styles.visaFlag}>{country.flag}</Text>
                        <Text style={styles.masonryNameSm}>{country.name}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Row 2: 3 equal cards */}
            {visibleVisaFree.length >= 6 && (
              <View style={styles.masonryRow2}>
                {visibleVisaFree.slice(3, 6).map((country) => (
                  <TouchableOpacity
                    key={country.name}
                    style={[styles.masonryThird, shadow.md, { width: MASONRY_THIRD, height: 160 }]}
                    activeOpacity={0.9}
                    onPress={() => handleDestinationPress(country.name)}
                  >
                    <Image source={{ uri: country.image }} style={styles.masonryImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.masonryOverlay}>
                      <View style={styles.visaFreeBadge}>
                        <Text style={styles.visaFreeBadgeText}>Visa-Free</Text>
                      </View>
                      <Text style={styles.visaFlag}>{country.flag}</Text>
                      <Text style={styles.masonryNameSm}>{country.name}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Row 3: 2 equal cards (shown when "Show All") */}
            {showAllVisaFree && visibleVisaFree.length > 6 && (
              <View style={styles.masonryRow3}>
                {visibleVisaFree.slice(6).map((country) => (
                  <TouchableOpacity
                    key={country.name}
                    style={[styles.masonryHalf, shadow.md, { width: MASONRY_HALF, height: 170 }]}
                    activeOpacity={0.9}
                    onPress={() => handleDestinationPress(country.name)}
                  >
                    <Image source={{ uri: country.image }} style={styles.masonryImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.masonryOverlay}>
                      <View style={styles.visaFreeBadge}>
                        <Text style={styles.visaFreeBadgeText}>Visa-Free</Text>
                      </View>
                      <Text style={styles.visaFlag}>{country.flag}</Text>
                      <Text style={styles.masonryTitle}>{country.name}</Text>
                      <Text style={styles.masonryDesc}>{country.desc}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {VISA_FREE.length > 6 && (
            <TouchableOpacity
              style={styles.showMoreBtnSmall}
              onPress={() => setShowAllVisaFree(!showAllVisaFree)}
              activeOpacity={0.85}
            >
              <Text style={styles.showMoreSmallText}>
                {showAllVisaFree ? 'Show Less' : `Show All ${VISA_FREE.length}`}
              </Text>
              <Ionicons name={showAllVisaFree ? 'chevron-up' : 'chevron-down'} size={14} color="#F97316" />
            </TouchableOpacity>
          )}
        </View>

        {/* ============================================================ */}
        {/* SACRED PILGRIMAGE SITES (asymmetric grid matching web)        */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Sacred Pilgrimage Sites</Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                India's most revered spiritual destinations
              </Text>
            </View>
            <View style={styles.passportBadge}>
              <Text style={styles.passportEmoji}>🙏</Text>
            </View>
          </View>

          {/* Asymmetric Grid: Row 1 = 1 large + 2 stacked, Row 2 = 3 equal, Row 3 = 2 wide + 1 tall spanning */}
          <View style={styles.masonryContainer}>
            {/* Row 1: Featured large left + 2 stacked right */}
            {visiblePilgrimage.length >= 3 && (
              <View style={styles.masonryRow1}>
                <TouchableOpacity
                  style={[styles.masonryLarge, shadow.md, { width: MASONRY_HALF, height: 260 }]}
                  activeOpacity={0.9}
                  onPress={() => handleDestinationPress(visiblePilgrimage[0].name, { image: visiblePilgrimage[0].image, desc: visiblePilgrimage[0].desc })}
                >
                  <Image source={{ uri: visiblePilgrimage[0].image }} style={styles.masonryImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.masonryOverlay}>
                    {visiblePilgrimage[0].featured && (
                      <View style={styles.featuredBadge}>
                        <Ionicons name="trophy" size={10} color="#ffffff" />
                        <Text style={styles.featuredBadgeText}>Featured</Text>
                      </View>
                    )}
                    <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[visiblePilgrimage[0].category] || '#6B7280' }]}>
                      <Text style={styles.categoryBadgeText}>{visiblePilgrimage[0].category}</Text>
                    </View>
                    <Text style={styles.masonryTitle}>{visiblePilgrimage[0].name}</Text>
                    <Text style={styles.masonryDesc}>{visiblePilgrimage[0].desc}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={[styles.masonryStackedCol, { width: MASONRY_HALF }]}>
                  {visiblePilgrimage.slice(1, 3).map((site) => (
                    <TouchableOpacity
                      key={site.name}
                      style={[styles.masonryStacked, shadow.md, { height: (260 - MASONRY_GAP) / 2 }]}
                      activeOpacity={0.9}
                      onPress={() => handleDestinationPress(site.name, { image: site.image, desc: site.desc })}
                    >
                      <Image source={{ uri: site.image }} style={styles.masonryImage} />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.masonryOverlay}>
                        <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[site.category] || '#6B7280' }]}>
                          <Text style={styles.categoryBadgeText}>{site.category}</Text>
                        </View>
                        <Text style={styles.masonryNameSm}>{site.name}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Row 2: 3 equal cards */}
            {visiblePilgrimage.length >= 6 && (
              <View style={styles.masonryRow2}>
                {visiblePilgrimage.slice(3, 6).map((site) => (
                  <TouchableOpacity
                    key={site.name}
                    style={[styles.masonryThird, shadow.md, { width: MASONRY_THIRD, height: 160 }]}
                    activeOpacity={0.9}
                    onPress={() => handleDestinationPress(site.name)}
                  >
                    <Image source={{ uri: site.image }} style={styles.masonryImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.masonryOverlay}>
                      <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[site.category] || '#6B7280' }]}>
                        <Text style={styles.categoryBadgeText}>{site.category}</Text>
                      </View>
                      <Text style={styles.masonryNameSm}>{site.name}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Row 3: 2 equal cards (shown when "Show All") */}
            {showAllPilgrimage && visiblePilgrimage.length > 6 && (
              <View style={styles.masonryRow3}>
                {visiblePilgrimage.slice(6).map((site) => (
                  <TouchableOpacity
                    key={site.name}
                    style={[styles.masonryHalf, shadow.md, { width: MASONRY_HALF, height: 170 }]}
                    activeOpacity={0.9}
                    onPress={() => handleDestinationPress(site.name)}
                  >
                    <Image source={{ uri: site.image }} style={styles.masonryImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.masonryOverlay}>
                      <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[site.category] || '#6B7280' }]}>
                        <Text style={styles.categoryBadgeText}>{site.category}</Text>
                      </View>
                      <Text style={styles.masonryTitle}>{site.name}</Text>
                      <Text style={styles.masonryDesc}>{site.desc}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {PILGRIMAGE_SITES.length > 6 && (
            <TouchableOpacity
              style={styles.showMoreBtnSmall}
              onPress={() => setShowAllPilgrimage(!showAllPilgrimage)}
              activeOpacity={0.85}
            >
              <Text style={styles.showMoreSmallText}>
                {showAllPilgrimage ? 'Show Less' : `Show All ${PILGRIMAGE_SITES.length}`}
              </Text>
              <Ionicons name={showAllPilgrimage ? 'chevron-up' : 'chevron-down'} size={14} color="#F97316" />
            </TouchableOpacity>
          )}
        </View>

        {/* ============================================================ */}
        {/* TOP 20 INDIA (matching web CollectionGrid masonry)            */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Top 20 Destinations in India</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Discover India's most captivating destinations
          </Text>

          {/* Hero card (first item) */}
          {TOP_INDIA.length > 0 && (
            <TouchableOpacity
              style={[styles.topHeroCard, shadow.md]}
              activeOpacity={0.9}
              onPress={() => handleDestinationPress(TOP_INDIA[0].name, { image: TOP_INDIA[0].image, desc: TOP_INDIA[0].desc })}
            >
              <Image source={{ uri: TOP_INDIA[0].image }} style={styles.topHeroImage} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.topHeroOverlay}>
                <View style={styles.topRankBadge}>
                  <Text style={styles.topRankText}>#1</Text>
                </View>
                <Text style={styles.topHeroTitle}>{TOP_INDIA[0].name}</Text>
                <Text style={styles.topHeroDesc}>{TOP_INDIA[0].desc}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Grid of remaining cards */}
          <View style={styles.topGrid}>
            {visibleTop.slice(1).map((dest, idx) => (
              <TouchableOpacity
                key={dest.name}
                style={[styles.topGridCard, shadow.sm, { width: CARD_W }]}
                activeOpacity={0.9}
                onPress={() => handleDestinationPress(dest.name, { image: dest.image, desc: dest.desc })}
              >
                <Image source={{ uri: dest.image }} style={styles.topGridImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.topGridOverlay}>
                  <View style={styles.topRankSmall}>
                    <Text style={styles.topRankSmallText}>#{idx + 2}</Text>
                  </View>
                  <Text style={styles.topGridName} numberOfLines={1}>{dest.name}</Text>
                  <Text style={styles.topGridDesc} numberOfLines={1}>{dest.desc}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Show More / Less */}
          <TouchableOpacity
            style={styles.showMoreBtn}
            onPress={() => setShowAllTop(!showAllTop)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#F97316', '#EA580C']} style={styles.showMoreGradient}>
              <Text style={styles.showMoreText}>{showAllTop ? 'Show Less' : 'Show All 20'}</Text>
              <Ionicons name={showAllTop ? 'chevron-up' : 'chevron-down'} size={18} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* TREKKING DESTINATIONS (matching web TrekkingSection)          */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Top Trekking Destinations</Text>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                Epic trails and mountain adventures
              </Text>
            </View>
            <View style={styles.passportBadge}>
              <Text style={styles.passportEmoji}>🏔️</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trekkingScroll}>
            {TREKKING_DESTINATIONS.map((trek, idx) => (
              <TouchableOpacity
                key={trek.name}
                style={[styles.trekkingCard, shadow.md]}
                activeOpacity={0.9}
                onPress={() => handleDestinationPress(trek.name, { image: trek.image })}
              >
                <Image source={{ uri: trek.image }} style={styles.trekkingImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.trekkingOverlay}>
                  {/* Rank Badge */}
                  <View style={styles.trekkingRank}>
                    <Text style={styles.trekkingRankText}>#{idx + 1}</Text>
                  </View>
                  {/* Difficulty Badge */}
                  <View style={[styles.difficultyBadge, { backgroundColor: DIFFICULTY_COLORS[trek.difficulty] || '#6B7280' }]}>
                    <Text style={styles.difficultyText}>{trek.difficulty}</Text>
                  </View>
                  <Text style={styles.trekkingName}>{trek.name}</Text>
                  <View style={styles.trekkingMeta}>
                    <View style={styles.trekkingMetaItem}>
                      <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.trekkingMetaText}>{trek.duration}</Text>
                    </View>
                    <View style={styles.trekkingMetaItem}>
                      <Ionicons name="trending-up-outline" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.trekkingMetaText}>{trek.altitude}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        </>
        )}

        {/* ============================================================ */}
        {/* FEATURED ACTIVITIES (matching web ActivitiesHomepageSection)   */}
        {/* ============================================================ */}
        <View style={[styles.section, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.sectionTitleGradient, { color: colors.primary[600] }]}>
            Featured Activities
          </Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
            Book with instant confirmation
          </Text>

          {/* Category Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPillsRow}>
            {ACTIVITY_CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={cat.label}
                onPress={() => setActiveCategoryIdx(idx)}
                activeOpacity={0.8}
              >
                {activeCategoryIdx === idx ? (
                  <LinearGradient
                    colors={[...cat.gradient]}
                    style={styles.catPill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.catPillEmoji}>{cat.emoji}</Text>
                    <Text style={styles.catPillTextActive}>{cat.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.catPill, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                    <Text style={styles.catPillEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.catPillText, { color: isDarkMode ? '#D1D5DB' : '#374151' }]}>{cat.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Activity Cards */}
          {loadingActivities ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
          ) : popularActivities.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityScroll}>
              {popularActivities.map((act: any, idx: number) => (
                <TouchableOpacity
                  key={act._id || idx}
                  style={[styles.activityCard, shadow.md, { backgroundColor: themeColors.card }]}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/activity/${act._id}`)}
                >
                  {getImageUrl(act.images?.[0]) ? (
                    <Image source={{ uri: getImageUrl(act.images[0])! }} style={styles.activityImage} />
                  ) : (
                    <LinearGradient colors={[colors.primary[400], colors.primary[700]]} style={styles.activityImage} />
                  )}
                  {act.instantBooking?.enabled && (
                    <View style={styles.instantBadge}>
                      <Ionicons name="flash" size={10} color="#ffffff" />
                      <Text style={styles.instantBadgeText}>Instant</Text>
                    </View>
                  )}
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityName, { color: themeColors.text }]} numberOfLines={2}>
                      {act.title || act.name}
                    </Text>
                    <View style={styles.activityMeta}>
                      {act.rating ? (
                        <View style={styles.activityRatingRow}>
                          <Ionicons name="star" size={12} color="#FBBF24" />
                          <Text style={[styles.activityRating, { color: themeColors.text }]}>
                            {Number(act.rating).toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
                      {act.location?.city && (
                        <Text style={[styles.activityCity, { color: themeColors.textTertiary }]} numberOfLines={1}>
                          {act.location.city}
                        </Text>
                      )}
                    </View>
                    {act.pricing?.basePrice ? (
                      <Text style={styles.activityPrice}>
                        ₹{act.pricing.basePrice.toLocaleString('en-IN')}
                        <Text style={[styles.activityPricePer, { color: themeColors.textTertiary }]}> /person</Text>
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          {/* Browse All CTA */}
          <TouchableOpacity
            style={styles.browseAllBtn}
            onPress={() => router.push('/explore')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#F97316', '#EA580C']} style={styles.browseAllGradient}>
              <Text style={styles.browseAllText}>Browse All Activities</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Business CTA */}
          <View style={[styles.businessCta, {
            backgroundColor: isDarkMode ? 'rgba(249,115,22,0.08)' : '#FFF7ED',
            borderColor: isDarkMode ? 'rgba(249,115,22,0.3)' : '#FED7AA',
          }]}>
            <View style={styles.businessCtaIcon}>
              <Ionicons name="business-outline" size={24} color="#ffffff" />
            </View>
            <View style={styles.businessCtaContent}>
              <Text style={[styles.businessCtaTitle, { color: themeColors.text }]}>
                Are you a tour operator or guide?
              </Text>
              <Text style={[styles.businessCtaSubtitle, { color: themeColors.textSecondary }]}>
                List your activities and reach more customers
              </Text>
            </View>
          </View>
        </View>

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
            Discover the diverse beauty of India, one region at a time
          </Text>

          {/* Region Tabs */}
          <View style={[styles.regionTabsContainer, { borderBottomColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
            {REGION_TABS.map((tab) => {
              const key = tab.toLowerCase();
              const isActive = activeRegion === key;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.regionTab,
                    isActive && styles.regionTabActive,
                  ]}
                  onPress={() => setActiveRegion(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.regionTabText,
                    { color: isActive ? '#F97316' : (isDarkMode ? '#9CA3AF' : '#6B7280') },
                  ]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Region Destination Grid */}
          <View style={styles.regionGrid}>
            {regionDests.slice(0, 4).map((dest) => (
              <TouchableOpacity
                key={dest.name}
                style={[styles.regionCard, shadow.md, { width: CARD_W }]}
                activeOpacity={0.9}
                onPress={() => handleDestinationPress(dest.name, { image: dest.image })}
              >
                <Image source={{ uri: dest.image }} style={styles.regionCardImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.regionCardOverlay}>
                  <View style={styles.regionCardTitleRow}>
                    <Ionicons name="location" size={14} color="#ffffff" />
                    <Text style={styles.regionCardName} numberOfLines={1}>{dest.name}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* View All Button */}
          <TouchableOpacity
            style={styles.viewAllRegionBtn}
            onPress={() => {
              const regionLabel = REGION_TABS.find(t => t.toLowerCase() === activeRegion) || activeRegion;
              handleDestinationPress(regionLabel + ' India');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#F97316', '#EA580C']} style={styles.viewAllRegionGradient}>
              <Text style={styles.viewAllRegionText}>View All {REGION_TABS.find(t => t.toLowerCase() === activeRegion)} India</Text>
              <Ionicons name="arrow-forward" size={16} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

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
                  <Image source={tab.icon} style={styles.heroTabIcon} resizeMode="contain" />
                  <Text
                    style={[styles.heroTabLabel, { color: '#FFFFFF' }]}
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

      {/* Floating AI Chat Button (matching web FloatingChatButton) */}
      {/* Hide the floating chat FAB while the Quick Itinerary popup is open
          so it doesn't overlap the form/keyboard. */}
      {!showQuickItinerary && <FloatingChatFAB />}

      {/* Quick Itinerary generate popup (opens from the hero tab) */}
      <QuickItineraryModal visible={showQuickItinerary} onClose={() => setShowQuickItinerary(false)} />
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
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
  heroImage: {
    // photo fills the hero; the scrim above it carries legibility
    resizeMode: 'cover',
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
    gap: 16,
  },
  appHeaderFlag: {
    fontSize: 20,
  },
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
    gap: 10,
    maxWidth: '94%',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
  },
  heroBadgeText: {
    flexShrink: 1,
  },
  heroBadgeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroBadgeSub: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 11,
    marginTop: 1,
  },
  // Headline — script + serif, mirroring the web hero
  heroScript: {
    fontFamily: 'Snell Roundhand',
    fontSize: 30,
    color: BRAND.tealLight,
    textAlign: 'center',
    marginBottom: -2,
  },
  heroSerif: {
    fontFamily: 'Georgia',
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
  },
  heroSerifAccent: {
    color: BRAND.tealLight,
  },
  // Primary CTA — red→orange logo gradient pill
  ctaWrap: {
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 24,
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
  moreWaysRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  wayCard: {
    width: 128,
    height: 148,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
  },
  wayTag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  wayTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  wayIcon: {
    width: 46,
    height: 46,
    alignSelf: 'flex-start',
  },
  wayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
  },

  // Hero Service Tabs (PWA-style: 4 brand icons + More)
  heroTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
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

  // Services Bar (legacy)
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
  sectionTitleGradient: {
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
  discoverScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  discoverCard: {
    width: 240,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
  },
  discoverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  discoverOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  discoverCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  discoverCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  discoverTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 22,
  },
  discoverSubtitleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  discoverTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  discoverTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  discoverTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ffffff',
  },

  // ---- MASONRY GRID (shared for Visa-Free & Pilgrimage) ----
  masonryContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  masonryRow1: {
    flexDirection: 'row',
    gap: 10,
  },
  masonryRow2: {
    flexDirection: 'row',
    gap: 10,
  },
  masonryRow3: {
    flexDirection: 'row',
    gap: 10,
  },
  masonryLarge: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  masonryStackedCol: {
    justifyContent: 'space-between',
    gap: 10,
  },
  masonryStacked: {
    borderRadius: 14,
    overflow: 'hidden',
    flex: 1,
  },
  masonryThird: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  masonryHalf: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  masonryImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  masonryOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  masonryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  masonryNameSm: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  masonryDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  visaFreeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  visaFreeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  visaFlag: {
    fontSize: 22,
    marginBottom: 4,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F97316',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  // ---- TOP 20 INDIA ----
  topHeroCard: {
    marginHorizontal: 20,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  topHeroImage: {
    width: '100%',
    height: '100%',
  },
  topHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 60,
  },
  topRankBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  topRankText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  topRankSmall: {
    position: 'absolute',
    top: -96,
    right: 8,
    backgroundColor: 'rgba(249,115,22,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  topRankSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  topHeroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
  },
  topHeroDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  topGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  topGridCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  topGridImage: {
    width: '100%',
    height: '100%',
  },
  topGridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 40,
  },
  topGridName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  topGridDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  showMoreBtn: {
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  showMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 6,
    borderRadius: 14,
  },
  showMoreText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  showMoreBtnSmall: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 4,
  },
  showMoreSmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F97316',
  },

  // ---- TREKKING DESTINATIONS ----
  trekkingScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  trekkingCard: {
    width: 220,
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
  },
  trekkingImage: {
    width: '100%',
    height: '100%',
  },
  trekkingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 100,
  },
  trekkingRank: {
    position: 'absolute',
    top: -160,
    left: 14,
    backgroundColor: 'rgba(249,115,22,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trekkingRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  trekkingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  trekkingMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  trekkingMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trekkingMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // ---- FEATURED ACTIVITIES ----
  catPillsRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 4,
  },
  catPillEmoji: {
    fontSize: 14,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  catPillTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  loaderRow: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  activityCard: {
    width: 200,
    borderRadius: 14,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: 130,
  },
  instantBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  instantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  activityContent: {
    padding: 12,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  activityRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  activityRating: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityCity: {
    fontSize: 12,
    flex: 1,
  },
  activityPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[600],
    marginTop: 6,
  },
  activityPricePer: {
    fontSize: 12,
    fontWeight: '400',
  },
  browseAllBtn: {
    alignSelf: 'center',
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  browseAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    gap: 8,
    borderRadius: 16,
  },
  browseAllText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  businessCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 14,
  },
  businessCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessCtaContent: {
    flex: 1,
  },
  businessCtaTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  businessCtaSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  // ---- EXPLORE INDIA BY REGION ----
  regionSection: {
    paddingTop: 32,
    paddingBottom: 20,
  },
  regionTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 1,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  regionTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  regionTabActive: {
    borderBottomColor: '#F97316',
  },
  regionTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  regionCard: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
  },
  regionCardImage: {
    width: '100%',
    height: '100%',
  },
  regionCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 60,
  },
  regionCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regionCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  viewAllRegionBtn: {
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  viewAllRegionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
    borderRadius: 10,
  },
  viewAllRegionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
