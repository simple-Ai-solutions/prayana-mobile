import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Modal,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  shadow,
  borderRadius,
  Badge,
  EmptyState,
} from '@prayana/shared-ui';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// CONSTANTS
// ============================================================

const FILTER_TABS = ['All', 'Upcoming', 'Completed', 'Draft'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const BUDGET_LABELS: Record<string, string> = {
  budget: 'Budget',
  moderate: 'Moderate',
  luxury: 'Luxury',
  'ultra-luxury': 'Ultra Luxury',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'info' }
> = {
  draft: { label: 'Draft', variant: 'default' },
  planned: { label: 'Planned', variant: 'primary' },
  active: { label: 'Active', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'warning' },
};

// --- 6-color cycling gradients (matching web) ---
const CARD_GRADIENTS = [
  { accent: '#3B82F6', accentLight: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
  { accent: '#10B981', accentLight: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  { accent: '#F59E0B', accentLight: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  { accent: '#8B5CF6', accentLight: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
  { accent: '#EC4899', accentLight: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)' },
  { accent: '#06B6D4', accentLight: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)' },
];

// --- Travel Guides (matching web) ---
const TRAVEL_GUIDES = [
  {
    id: 'hampi-2day',
    city: 'Hampi',
    title: '2-Day Hampi Heritage Trip',
    spots: 13,
    duration: 2,
    emoji: '\uD83C\uDFDB\uFE0F',
    tagline: 'Explore ancient ruins & boulder landscapes',
    tags: ['Heritage', 'Photography', 'History'],
    image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=400',
    days: [
      {
        title: 'Royal Centre & Temples',
        activities: [
          'Virupaksha Temple sunrise',
          'Hemakuta Hill temples',
          'Krishna Temple complex',
          'Lakshmi Narasimha statue',
          'Underground Shiva Temple',
          'Hampi Bazaar walk',
          'Sunset at Hemakuta Hill',
        ],
      },
      {
        title: 'Sacred Centre & River',
        activities: [
          'Vittala Temple (Stone Chariot)',
          'Musical Pillars Hall',
          'Coracle ride on Tungabhadra',
          'Anegundi village visit',
          'Elephant stables',
          'Sunset at Matanga Hill',
        ],
      },
    ],
  },
  {
    id: 'goa-3day',
    city: 'Goa',
    title: '3-Day Goa Beach & Culture',
    spots: 15,
    duration: 3,
    emoji: '\uD83C\uDFD6\uFE0F',
    tagline: 'Beaches, nightlife & Portuguese heritage',
    tags: ['Beach', 'Nightlife', 'Food'],
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400',
    days: [
      {
        title: 'North Goa Beaches',
        activities: [
          'Calangute Beach morning',
          'Baga Beach water sports',
          'Anjuna Flea Market',
          'Chapora Fort sunset',
          'Tito\'s Lane nightlife',
        ],
      },
      {
        title: 'Old Goa Heritage',
        activities: [
          'Basilica of Bom Jesus',
          'Se Cathedral',
          'Church of St. Francis',
          'Fontainhas Latin Quarter',
          'Miramar Beach evening',
        ],
      },
      {
        title: 'South Goa Serenity',
        activities: [
          'Palolem Beach morning',
          'Colva Beach stroll',
          'Dudhsagar Falls trip',
          'Spice plantation tour',
          'Beach shack dinner',
        ],
      },
    ],
  },
  {
    id: 'shimla-manali-4day',
    city: 'Himachal',
    title: '4-Day Shimla-Manali Adventure',
    spots: 14,
    duration: 4,
    emoji: '\uD83C\uDFD4\uFE0F',
    tagline: 'Mountains, snow & thrilling adventures',
    tags: ['Mountains', 'Snow', 'Adventure'],
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400',
    days: [
      {
        title: 'Shimla Sightseeing',
        activities: ['The Ridge & Mall Road', 'Christ Church', 'Jakhu Temple', 'Kufri snow point'],
      },
      {
        title: 'Shimla to Manali',
        activities: ['Scenic highway drive', 'Kullu rafting', 'Naggar Castle', 'Old Manali walk'],
      },
      {
        title: 'Manali Adventures',
        activities: ['Solang Valley paragliding', 'Rohtang Pass', 'Hadimba Temple'],
      },
      {
        title: 'Manali to Departure',
        activities: ['Vashisht Hot Springs', 'Manu Temple', 'Mall Road shopping'],
      },
    ],
  },
  {
    id: 'varanasi-2day',
    city: 'Varanasi',
    title: '2-Day Varanasi Spiritual Journey',
    spots: 12,
    duration: 2,
    emoji: '\uD83D\uDD49\uFE0F',
    tagline: 'Ancient spirituality & cultural immersion',
    tags: ['Spiritual', 'Culture', 'History'],
    image: 'https://images.unsplash.com/photo-1561361058-c24cecae35ca?w=400',
    days: [
      {
        title: 'Ghats & Temples',
        activities: [
          'Sunrise boat ride on Ganges',
          'Dashashwamedh Ghat Aarti',
          'Kashi Vishwanath Temple',
          'Manikarnika Ghat',
          'Assi Ghat walk',
          'Evening Ganga Aarti',
        ],
      },
      {
        title: 'Culture & Heritage',
        activities: [
          'Sarnath Buddhist site',
          'BHU campus walk',
          'Ramnagar Fort',
          'Silk weaving workshop',
          'Street food trail',
          'Subah-e-Banaras morning',
        ],
      },
    ],
  },
  {
    id: 'coorg-2day',
    city: 'Coorg',
    title: '2-Day Coorg Nature Escape',
    spots: 8,
    duration: 2,
    emoji: '\u2615',
    tagline: 'Coffee plantations & misty hills',
    tags: ['Nature', 'Coffee', 'Trekking'],
    image: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=400',
    days: [
      {
        title: 'Plantations & Falls',
        activities: [
          'Coffee plantation tour',
          'Abbey Falls visit',
          'Raja\'s Seat sunset',
          'Madikeri Fort walk',
        ],
      },
      {
        title: 'Nature & Trekking',
        activities: [
          'Tadiandamol trek',
          'Dubare Elephant Camp',
          'Namdroling Monastery',
          'Cauvery Nisargadhama',
        ],
      },
    ],
  },
];

// ============================================================
// GUIDE PREVIEW MODAL
// ============================================================
function GuideModal({
  guide,
  visible,
  onClose,
}: {
  guide: (typeof TRAVEL_GUIDES)[number] | null;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!guide) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modalStyles.container} edges={['top']}>
        {/* Hero Image */}
        <View style={modalStyles.heroContainer}>
          <Image
            source={{ uri: guide.image }}
            style={modalStyles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={modalStyles.heroOverlay}
          />
          {/* Close button */}
          <TouchableOpacity style={modalStyles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#ffffff" />
          </TouchableOpacity>
          {/* Title overlay */}
          <View style={modalStyles.heroContent}>
            <Text style={modalStyles.heroEmoji}>{guide.emoji}</Text>
            <Text style={modalStyles.heroTitle}>{guide.title}</Text>
            <Text style={modalStyles.heroTagline}>{guide.tagline}</Text>
          </View>
        </View>

        {/* Tags */}
        <View style={modalStyles.tagsRow}>
          <View style={[modalStyles.tag, { backgroundColor: colors.primary[50] }]}>
            <Ionicons name="time-outline" size={14} color={colors.primary[500]} />
            <Text style={[modalStyles.tagText, { color: colors.primary[600] }]}>
              {guide.duration} Days
            </Text>
          </View>
          <View style={[modalStyles.tag, { backgroundColor: colors.primary[50] }]}>
            <Ionicons name="location-outline" size={14} color={colors.primary[500]} />
            <Text style={[modalStyles.tagText, { color: colors.primary[600] }]}>
              {guide.spots} Spots
            </Text>
          </View>
          {guide.tags.map((t) => (
            <View key={t} style={[modalStyles.tag, { backgroundColor: colors.gray[100] }]}>
              <Text style={[modalStyles.tagText, { color: colors.textSecondary }]}>{t}</Text>
            </View>
          ))}
        </View>

        {/* Itinerary */}
        <ScrollView
          style={modalStyles.itineraryScroll}
          contentContainerStyle={modalStyles.itineraryContent}
          showsVerticalScrollIndicator={false}
        >
          {guide.days.map((day, dayIdx) => (
            <View key={dayIdx} style={[modalStyles.dayCard, shadow.sm]}>
              <View style={modalStyles.dayHeader}>
                <LinearGradient
                  colors={[colors.primary[400], colors.primary[600]]}
                  style={modalStyles.dayBadge}
                >
                  <Text style={modalStyles.dayBadgeText}>{dayIdx + 1}</Text>
                </LinearGradient>
                <Text style={modalStyles.dayTitle}>{day.title}</Text>
              </View>
              <View style={modalStyles.activityList}>
                {day.activities.map((act, actIdx) => (
                  <View key={actIdx} style={modalStyles.activityItem}>
                    <View style={modalStyles.activityDot} />
                    <Text style={modalStyles.activityText}>{act}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* CTA */}
        <View style={modalStyles.ctaContainer}>
          <TouchableOpacity
            style={shadow.md}
            activeOpacity={0.85}
            onPress={() => {
              onClose();
              router.push('/trip/setup');
              Toast.show({
                type: 'success',
                text1: 'Guide loaded!',
                text2: `${guide.title} ready to customize`,
              });
            }}
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={modalStyles.ctaButton}
            >
              <Ionicons name="sparkles" size={18} color="#ffffff" />
              <Text style={modalStyles.ctaText}>Use This Itinerary</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================
// SKELETON
// ============================================================
function SkeletonCard() {
  return (
    <View style={[styles.tripCard, { borderWidth: 0 }]}>
      <View style={styles.skeletonImage} />
      <View style={styles.tripCardBody}>
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={[styles.skeletonLine, { width: '50%', marginTop: spacing.sm }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: spacing.sm }]} />
      </View>
    </View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================
export default function TripsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectedGuide, setSelectedGuide] = useState<(typeof TRAVEL_GUIDES)[number] | null>(null);

  // --- Fetch trips ---
  const fetchTrips = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    try {
      const response = await createTripAPI.getUserTrips(user.uid);
      if (response?.success && Array.isArray(response.data)) {
        setTrips(response.data);
      } else if (Array.isArray(response)) {
        setTrips(response);
      } else {
        setTrips([]);
      }
    } catch (err: any) {
      console.error('[Trips] Failed to fetch:', err.message);
      Toast.show({ type: 'error', text1: 'Failed to load trips', text2: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrips();
    setRefreshing(false);
  }, [fetchTrips]);

  // --- Split trips: mine vs shared ---
  const myTrips = useMemo(
    () =>
      trips.filter(
        (t) => t.userId === user?.uid || t.isOwner === true || !t.collaborators?.length
      ),
    [trips, user?.uid]
  );

  const sharedTrips = useMemo(
    () =>
      trips.filter(
        (t) => t.userId !== user?.uid && t.isOwner !== true && t.collaborators?.length
      ),
    [trips, user?.uid]
  );

  // --- Filter ---
  const filteredTrips = useMemo(() => {
    const base = myTrips;
    if (activeFilter === 'All') return base;

    return base.filter((trip) => {
      const status = (trip.status || 'draft').toLowerCase();
      switch (activeFilter) {
        case 'Upcoming': {
          if (status === 'planned' || status === 'active') return true;
          if (trip.startDate && new Date(trip.startDate) > new Date()) return true;
          return false;
        }
        case 'Completed':
          return status === 'completed';
        case 'Draft':
          return status === 'draft';
        default:
          return true;
      }
    });
  }, [myTrips, activeFilter]);

  // --- Quick Stats ---
  const quickStats = useMemo(() => {
    let destinations = new Set<string>();
    let totalDays = 0;
    let totalActivities = 0;

    myTrips.forEach((trip) => {
      trip.destinations?.forEach((d: any) => {
        const name = typeof d === 'string' ? d : d.name || d.city;
        if (name) destinations.add(name);
      });
      totalDays += trip.days?.length || 0;
      trip.days?.forEach((day: any) => {
        totalActivities += day.activities?.length || 0;
      });
    });

    return {
      destinations: destinations.size,
      days: totalDays,
      activities: totalActivities,
    };
  }, [myTrips]);

  // --- Format date range ---
  const formatDateRange = useCallback((startDate: string, endDate: string) => {
    if (!startDate) return 'Dates not set';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!end) return startStr;

    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${startStr} - ${end.getDate()}, ${end.getFullYear()}`;
    }

    const endStr = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startStr} - ${endStr}`;
  }, []);

  // --- Navigate to trip ---
  const handleTripPress = useCallback(
    (trip: any) => {
      const id = trip._id || trip.tripId;
      if (id) {
        router.push(`/trip/${id}` as any);
      }
    },
    [router]
  );

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const renderGuideCard = useCallback(
    (guide: (typeof TRAVEL_GUIDES)[number]) => (
      <TouchableOpacity
        key={guide.id}
        style={[styles.guideCard, shadow.sm]}
        activeOpacity={0.85}
        onPress={() => setSelectedGuide(guide)}
      >
        <Image
          source={{ uri: guide.image }}
          style={styles.guideImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.guideOverlay}
        />
        {/* City pill */}
        <View style={styles.guideCityPill}>
          <Ionicons name="location" size={10} color="#ef4444" />
          <Text style={styles.guideCityText}>{guide.city}</Text>
        </View>
        {/* Bottom text */}
        <View style={styles.guideBottom}>
          <Text style={styles.guideTitle} numberOfLines={1}>
            {guide.title}
          </Text>
          <Text style={styles.guideSpots}>
            {guide.spots} spots {guide.emoji}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    []
  );

  const renderTripCard = useCallback(
    (trip: any, index: number, isShared = false) => {
      const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
      const destCount = trip.destinations?.length || 0;
      const daysCount = trip.days?.length || 0;
      const nightsCount = Math.max(0, daysCount - 1);
      const status = (trip.status || 'draft').toLowerCase();
      const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

      // Destination names for tags
      const destNames = (trip.destinations || [])
        .slice(0, 4)
        .map((d: any) => (typeof d === 'string' ? d : d.name || d.city || ''))
        .filter(Boolean);
      const extraDests = Math.max(0, (trip.destinations?.length || 0) - 4);

      const coverImage =
        trip.coverImage ||
        (trip.destinations?.[0]?.image || trip.destinations?.[0]?.coverImage || null);

      return (
        <TouchableOpacity
          key={trip._id || trip.tripId || index}
          style={[
            styles.colorTripCard,
            shadow.sm,
            { borderColor: gradient.border, borderLeftColor: gradient.accent },
          ]}
          activeOpacity={0.9}
          onPress={() => handleTripPress(trip)}
        >
          {/* Left thumbnail */}
          <View style={styles.colorTripThumb}>
            {coverImage ? (
              <Image
                source={{ uri: coverImage }}
                style={styles.colorTripThumbImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={[
                  styles.colorTripThumbPlaceholder,
                  { backgroundColor: gradient.accentLight },
                ]}
              >
                <Ionicons name="airplane" size={22} color={gradient.accent} />
              </View>
            )}
          </View>

          {/* Right info */}
          <View style={styles.colorTripInfo}>
            {/* Title row */}
            <View style={styles.colorTripTitleRow}>
              <Text
                style={[styles.colorTripName, { color: gradient.accent }]}
                numberOfLines={1}
              >
                {trip.name || 'Untitled Trip'}
              </Text>
              <View style={styles.statusBadgeSmall}>
                <Badge label={statusCfg.label} variant={statusCfg.variant} />
              </View>
            </View>

            {/* Duration */}
            {daysCount > 0 ? (
              <Text style={styles.colorTripDuration}>
                {daysCount} Day{daysCount !== 1 ? 's' : ''}{' '}
                {nightsCount > 0 ? `${nightsCount} Night${nightsCount !== 1 ? 's' : ''}` : ''}
              </Text>
            ) : (
              <View
                style={[styles.draftBadge, { backgroundColor: gradient.accentLight }]}
              >
                <Text style={[styles.draftBadgeText, { color: gradient.accent }]}>Draft</Text>
              </View>
            )}

            {/* Shared by */}
            {isShared && trip.ownerName && (
              <Text style={styles.sharedByText}>by {trip.ownerName}</Text>
            )}

            {/* Destination tags */}
            {destNames.length > 0 && (
              <View style={styles.destTagsRow}>
                {destNames.map((name: string, i: number) => (
                  <View
                    key={i}
                    style={[styles.destTag, { backgroundColor: gradient.accentLight }]}
                  >
                    <Ionicons name="location" size={10} color={gradient.accent} />
                    <Text
                      style={[styles.destTagText, { color: gradient.accent }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </View>
                ))}
                {extraDests > 0 && (
                  <Text style={styles.destTagExtra}>+{extraDests} more</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleTripPress]
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ======= HEADER ======= */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Trips</Text>
          {trips.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{trips.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ======= FILTER TABS ======= */}
      <View style={styles.filterContainer}>
        <FlatList
          data={FILTER_TABS as unknown as FilterTab[]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: tab }) => {
            const isActive = tab === activeFilter;
            return (
              <TouchableOpacity
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.filterTabText, isActive && styles.filterTabTextActive]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ======= SCROLLABLE CONTENT ======= */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary[500]}
            />
          }
        >
          {/* ====== TRAVEL GUIDES CAROUSEL ====== */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Travel Guides</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.guidesScroll}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH * 0.42 + 12}
            >
              {TRAVEL_GUIDES.map(renderGuideCard)}
            </ScrollView>
          </View>

          {/* ====== QUICK STATS ====== */}
          {myTrips.length > 0 && (
            <View style={styles.statsRow}>
              <View style={[styles.statCard, shadow.sm]}>
                <View style={[styles.statIconBg, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <Ionicons name="globe-outline" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.statValue}>{quickStats.destinations}</Text>
                <Text style={styles.statLabel}>Destinations</Text>
              </View>
              <View style={[styles.statCard, shadow.sm]}>
                <View style={[styles.statIconBg, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.statValue}>{quickStats.days}</Text>
                <Text style={styles.statLabel}>Days Planned</Text>
              </View>
              <View style={[styles.statCard, shadow.sm]}>
                <View style={[styles.statIconBg, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Ionicons name="camera-outline" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>{quickStats.activities}</Text>
                <Text style={styles.statLabel}>Activities</Text>
              </View>
            </View>
          )}

          {/* ====== MY TRIPS ====== */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                {myTrips.length > 0
                  ? 'Saved! Just a few steps left.'
                  : 'Your Trips'}
              </Text>
              {myTrips.length > 0 && (
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{myTrips.length}</Text>
                </View>
              )}
            </View>

            {filteredTrips.length === 0 ? (
              activeFilter !== 'All' && myTrips.length > 0 ? (
                <View style={styles.emptyFilterContainer}>
                  <Text style={styles.emptyFilterEmoji}>{'\uD83D\uDD0D'}</Text>
                  <Text style={styles.emptyFilterTitle}>
                    No {activeFilter.toLowerCase()} trips
                  </Text>
                  <Text style={styles.emptyFilterSubtitle}>
                    Try switching to a different filter
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyTripsCard}>
                  <Ionicons
                    name="airplane-outline"
                    size={40}
                    color={colors.textTertiary}
                  />
                  <Text style={styles.emptyTripsTitle}>No trips yet</Text>
                  <Text style={styles.emptyTripsSubtitle}>
                    Start planning your first adventure
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push('/trip/setup' as any)}
                  >
                    <LinearGradient
                      colors={[colors.primary[500], colors.primary[600]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.emptyTripsCTA}
                    >
                      <Text style={styles.emptyTripsCTAText}>Create First Trip</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.tripsListInline}>
                {filteredTrips.map((trip, index) => renderTripCard(trip, index, false))}
              </View>
            )}
          </View>

          {/* ====== SHARED WITH ME ====== */}
          {sharedTrips.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <View style={styles.sharedHeaderLeft}>
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.sectionLabel}>Shared with Me</Text>
                </View>
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{sharedTrips.length}</Text>
                </View>
              </View>
              <View style={styles.tripsListInline}>
                {sharedTrips.map((trip, index) =>
                  renderTripCard(trip, myTrips.length + index, true)
                )}
              </View>
            </View>
          )}

          {/* ====== EXPLORE MORE CTA ====== */}
          <View style={styles.sectionContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/trip/setup' as any)}
            >
              <LinearGradient
                colors={['#06B6D4', '#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.exploreCTACard, shadow.lg]}
              >
                {/* Decorative icons */}
                <View style={styles.exploreBgIcons}>
                  <Ionicons
                    name="airplane"
                    size={60}
                    color="rgba(255,255,255,0.1)"
                    style={{ position: 'absolute', top: -10, left: -10, transform: [{ rotate: '-30deg' }] }}
                  />
                  <Ionicons
                    name="compass"
                    size={50}
                    color="rgba(255,255,255,0.1)"
                    style={{ position: 'absolute', top: 0, right: -5 }}
                  />
                  <Ionicons
                    name="leaf"
                    size={45}
                    color="rgba(255,255,255,0.1)"
                    style={{ position: 'absolute', bottom: -5, left: 10 }}
                  />
                </View>

                {/* Content */}
                <View style={styles.exploreCTAContent}>
                  <View style={styles.exploreCTAIconCircle}>
                    <Ionicons name="sparkles" size={24} color="#ffffff" />
                  </View>
                  <Text style={styles.exploreCTATitle}>
                    {myTrips.length === 0
                      ? 'Start Your Journey'
                      : 'Plan Your Next Adventure'}
                  </Text>
                  <Text style={styles.exploreCTADesc}>
                    {myTrips.length === 0
                      ? 'Create your first AI-powered trip plan with smart recommendations'
                      : 'Discover new destinations and create your perfect itinerary'}
                  </Text>
                  <View style={styles.exploreCTAButton}>
                    <Text style={styles.exploreCTAButtonText}>Create New Trip</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary[600]} />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ====== TRAVEL TIPS CARDS ====== */}
          <View style={styles.tipsRow}>
            <TouchableOpacity
              style={[styles.tipCard, shadow.sm]}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/' as any)}
            >
              <Text style={styles.tipEmoji}>{'\uD83C\uDF0D'}</Text>
              <Text style={styles.tipTitle}>Explore Guides</Text>
              <Text style={styles.tipDesc}>Browse curated destinations</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tipCard, shadow.sm]}
              activeOpacity={0.85}
              onPress={() => router.push('/trip/setup' as any)}
            >
              <Text style={styles.tipEmoji}>{'\uD83E\uDD16'}</Text>
              <Text style={styles.tipTitle}>AI Planning</Text>
              <Text style={styles.tipDesc}>Smart itinerary builder</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ======= FAB ======= */}
      <TouchableOpacity
        style={[styles.fab, shadow.lg]}
        activeOpacity={0.85}
        onPress={() => router.push('/trip/setup' as any)}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* ======= GUIDE MODAL ======= */}
      <GuideModal
        guide={selectedGuide}
        visible={!!selectedGuide}
        onClose={() => setSelectedGuide(null)}
      />
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  // --- Header ---
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  countBadge: {
    marginLeft: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // --- Filter Tabs ---
  filterContainer: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  filterTabActive: {
    backgroundColor: colors.primary[500],
  },
  filterTabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },

  // --- Section ---
  sectionContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCountBadge: {
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  sectionCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  sharedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // --- Travel Guides ---
  guidesScroll: {
    paddingRight: spacing.xl,
  },
  guideCard: {
    width: SCREEN_WIDTH * 0.42,
    height: 150,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginRight: 12,
  },
  guideImage: {
    ...StyleSheet.absoluteFillObject,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  guideCityPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  guideCityText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  guideBottom: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
  },
  guideTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  guideSpots: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // --- Quick Stats ---
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // --- Color Trip Card (web-style) ---
  colorTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  colorTripThumb: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  colorTripThumbImage: {
    width: 72,
    height: 72,
  },
  colorTripThumbPlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  colorTripInfo: {
    flex: 1,
  },
  colorTripTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  colorTripName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    flex: 1,
  },
  statusBadgeSmall: {
    transform: [{ scale: 0.85 }],
  },
  colorTripDuration: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 3,
  },
  draftBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  sharedByText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  destTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: 6,
  },
  destTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  destTagText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    maxWidth: 80,
  },
  destTagExtra: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
    alignSelf: 'center',
  },
  tripsListInline: {
    // Rendered inside sectionContainer which already has horizontal padding
  },

  // --- Empty states ---
  emptyFilterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyFilterEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyFilterTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyFilterSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  emptyTripsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
  },
  emptyTripsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyTripsSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  emptyTripsCTA: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  emptyTripsCTAText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // --- Explore CTA ---
  exploreCTACard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    minHeight: 200,
    justifyContent: 'center',
  },
  exploreBgIcons: {
    ...StyleSheet.absoluteFillObject,
  },
  exploreCTAContent: {
    alignItems: 'center',
  },
  exploreCTAIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  exploreCTATitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  exploreCTADesc: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  exploreCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  exploreCTAButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary[600],
  },

  // --- Tips ---
  tipsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  tipCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipEmoji: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  tipTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // --- Skeleton ---
  skeletonContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.gray[100],
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  tripCardBody: {
    padding: spacing.lg,
  },
  skeletonLine: {
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[100],
  },

  // --- FAB ---
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ============================================================
// MODAL STYLES
// ============================================================
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Hero
  heroContainer: {
    height: 200,
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  heroEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  heroTagline: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  tagText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // Itinerary
  itineraryScroll: {
    flex: 1,
  },
  itineraryContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  dayTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  activityList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  activityText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },

  // CTA
  ctaContainer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  ctaText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
});
