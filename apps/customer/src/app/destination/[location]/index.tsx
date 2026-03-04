import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  shadow,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { hierarchicalSearch, destinationAPI } from '@prayana/shared-services';
import {
  transformToLuxuryLayout,
  getPlaceImageUrl,
  resolveImageUrl,
  type LuxuryData,
  type LuxuryPlace,
} from '@prayana/shared-utils';

import { HeroCarousel } from '../../../components/destination/HeroCarousel';
import { ExperienceTagFilters } from '../../../components/destination/ExperienceTagFilters';
import { HeritageCircuits } from '../../../components/destination/HeritageCircuits';
import { HiddenGems } from '../../../components/destination/HiddenGems';
import { EmbeddedChatWidget } from '../../../components/destination/EmbeddedChatWidget';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;
const BENTO_SMALL_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;
const INITIAL_MORE_PLACES = 8;

// ============================================================
// Image Enrichment (matches web PWA's enrichPlacesWithImages)
// Fetches images via backend /destinations/place-images (S3 → Google Places)
// Progressive: updates UI after each batch for faster perceived loading
// ============================================================
const ENRICH_BATCH_SIZE = 5;
const ENRICH_BATCH_DELAY = 200;

function extractImageUrl(res: any): string | null {
  const images = res?.data || res?.images || (Array.isArray(res) ? res : []);
  if (images.length === 0) return null;
  const first = images[0];
  const url = first?.url || first?.imageUrl || (typeof first === 'string' ? first : null);
  return url ? (resolveImageUrl(url) || url) : null;
}

async function enrichPlacesWithImages(
  places: LuxuryPlace[],
  locationName: string,
  onBatchComplete?: (imageMap: Map<string, string>) => void,
): Promise<Map<string, string>> {
  const needsImage = places.filter((p) => !getPlaceImageUrl(p));
  if (needsImage.length === 0) return new Map();

  console.log(`[ImageEnrich] ${needsImage.length}/${places.length} places need images`);

  const imageMap = new Map<string, string>();

  for (let i = 0; i < needsImage.length; i += ENRICH_BATCH_SIZE) {
    const batch = needsImage.slice(i, i + ENRICH_BATCH_SIZE);

    await Promise.allSettled(
      batch.map((place) =>
        destinationAPI.getPlaceImages(place.name, locationName, 1)
          .then((res: any) => {
            const url = extractImageUrl(res);
            if (url) imageMap.set(place.name, url);
          })
          .catch(() => {}) // silently skip failed fetches
      )
    );

    // Progressively update UI after each batch
    if (onBatchComplete && imageMap.size > 0) {
      onBatchComplete(new Map(imageMap));
    }

    // Short delay between batches to avoid hammering the server
    if (i + ENRICH_BATCH_SIZE < needsImage.length) {
      await new Promise((r) => setTimeout(r, ENRICH_BATCH_DELAY));
    }
  }

  console.log(`[ImageEnrich] Fetched ${imageMap.size}/${needsImage.length} images`);
  return imageMap;
}

// ============================================================
// Skeleton Block — static, renders immediately (no JS thread dependency)
// ============================================================
const SkeletonBlock = ({
  width,
  height,
  radius = 12,
  style,
}: {
  width: number | string;
  height: number;
  radius?: number;
  style?: any;
}) => {
  const { isDarkMode } = useTheme();
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: isDarkMode ? '#1F2937' : '#E5E7EB',
        },
        style,
      ]}
    />
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function LocationSearchResults() {
  const router = useRouter();
  const { location } = useLocalSearchParams<{ location: string }>();
  const { themeColors, isDarkMode } = useTheme();

  const [luxuryData, setLuxuryData] = useState<LuxuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filteredTag, setFilteredTag] = useState('all');
  const [showAllPlaces, setShowAllPlaces] = useState(false);

  // Progressive section reveal — each section fades in after data arrives
  const heroAnim = useRef(new Animated.Value(0)).current;
  const filtersAnim = useRef(new Animated.Value(0)).current;
  const topPlacesAnim = useRef(new Animated.Value(0)).current;
  const morePlacesAnim = useRef(new Animated.Value(0)).current;
  const circuitsAnim = useRef(new Animated.Value(0)).current;
  const gemsAnim = useRef(new Animated.Value(0)).current;

  const locationName = location || '';

  // ----------------------------------------------------------
  // Image enrichment helper (shared by streaming & fallback)
  // ----------------------------------------------------------
  const applyImageMap = useCallback((imgMap: Map<string, string>) => {
    const enrichPlace = (p: LuxuryPlace) => {
      const url = imgMap.get(p.name);
      return url ? { ...p, image: url, imageUrls: [url] } : p;
    };
    const enrichCircuits = (circuits: Record<string, LuxuryPlace[]>) => {
      const result: Record<string, LuxuryPlace[]> = {};
      for (const [key, places] of Object.entries(circuits)) {
        result[key] = places.map(enrichPlace);
      }
      return result;
    };
    setLuxuryData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        crownJewels: prev.crownJewels.map(enrichPlace),
        hiddenGems: prev.hiddenGems.map(enrichPlace),
        allPlaces: prev.allPlaces.map(enrichPlace),
        administrativeCircuits: enrichCircuits(prev.administrativeCircuits),
        dynamicCircuits: enrichCircuits(prev.dynamicCircuits),
      };
    });
  }, []);

  // Enrich images for a set of places (priority crown jewels, then rest)
  const startImageEnrichment = useCallback(
    (transformed: LuxuryData) => {
      const crownNames = new Set(transformed.crownJewels.map((p) => p.name));
      const priorityPlaces = transformed.crownJewels.filter((p) => !getPlaceImageUrl(p));
      const restPlaces = (transformed.allPlaces || []).filter(
        (p) => !crownNames.has(p.name) && !getPlaceImageUrl(p)
      );

      enrichPlacesWithImages(priorityPlaces, locationName, applyImageMap)
        .then(() => enrichPlacesWithImages(restPlaces, locationName, applyImageMap))
        .catch((err) => {
          console.warn('[ImageEnrich] Background enrichment failed:', err.message);
        });
    },
    [locationName, applyImageMap]
  );

  // ----------------------------------------------------------
  // Data Fetching — hierarchicalSearch API
  // Uses POST /destinations/hierarchical-search (correct endpoint)
  // Note: streamingSearch uses the older /destinations/search endpoint
  // which returns different data format — not compatible with luxuryLayout
  // ----------------------------------------------------------
  const isFetchingRef = useRef(false);

  const fetchPlaces = useCallback(
    async (isRefresh = false) => {
      if (!locationName) return;
      if (isFetchingRef.current && !isRefresh) return; // Prevent duplicate fetches
      isFetchingRef.current = true;

      if (!isRefresh) setLoading(true);
      setError(null);

      try {
        const response = await hierarchicalSearch(locationName, {}, { timeout: 60000 });
        const transformed = transformToLuxuryLayout(response);

        if (transformed) {
          setLuxuryData(transformed);
          setLoading(false);
          setRefreshing(false);
          startImageEnrichment(transformed);

          // Staggered section reveal — each section fades in 100ms after previous
          const stagger = (anim: Animated.Value, delay: number) =>
            Animated.timing(anim, {
              toValue: 1,
              duration: 350,
              delay,
              useNativeDriver: true,
            });

          Animated.parallel([
            stagger(heroAnim, 0),
            stagger(filtersAnim, 80),
            stagger(topPlacesAnim, 160),
            stagger(morePlacesAnim, 280),
            stagger(circuitsAnim, 380),
            stagger(gemsAnim, 460),
          ]).start();
        } else {
          setLuxuryData(null);
          setError('No places found. Try a different destination.');
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err: any) {
        console.error('[LocationSearch] Hierarchical search error:', err);
        setError(err.message || 'Failed to search. Please try again.');
        setLoading(false);
        setRefreshing(false);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [locationName, startImageEnrichment, heroAnim, filtersAnim, topPlacesAnim, morePlacesAnim, circuitsAnim, gemsAnim]
  );

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const handleRefresh = useCallback(() => {
    // Reset section animations for re-reveal on refresh
    [heroAnim, filtersAnim, topPlacesAnim, morePlacesAnim, circuitsAnim, gemsAnim].forEach(
      (anim) => anim.setValue(0)
    );
    setRefreshing(true);
    fetchPlaces(true);
  }, [fetchPlaces, heroAnim, filtersAnim, topPlacesAnim, morePlacesAnim, circuitsAnim, gemsAnim]);

  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------
  const isNavigatingRef = useRef(false);

  const handlePlacePress = useCallback(
    (place: any) => {
      console.log('[Nav] handlePlacePress called — place:', place?.name);
      if (!place?.name) {
        console.warn('[Nav] No place name, ignoring');
        return;
      }
      if (isNavigatingRef.current) {
        console.warn('[Nav] Already navigating, ignoring');
        return;
      }
      isNavigatingRef.current = true;
      setTimeout(() => { isNavigatingRef.current = false; }, 2000);

      try {
        const pName = String(place.name).trim();
        const loc = String(locationName || place.name).trim();

        // Build preview payload — available immediately from hierarchical search result
        const previewPayload = {
          name: place.name,
          image: place.imageUrl || place.image || place.thumbnail || '',
          shortDescription: place.shortDescription || place.description || place.about || '',
          rating: place.rating || place.averageRating || place.stars || null,
          category: place.category || place.type || '',
          duration: place.duration || place.idealDays || '',
        };

        const href = {
          pathname: `/destination/${encodeURIComponent(loc)}/${encodeURIComponent(pName)}`,
          params: { preview: JSON.stringify(previewPayload) },
        };
        console.log('[Nav] Pushing with preview:', pName);
        router.push(href as any);
      } catch (err: any) {
        console.error('[Nav] Navigation error:', err?.message || err);
        isNavigatingRef.current = false;
      }
    },
    [router, locationName]
  );

  // ----------------------------------------------------------
  // Filtering by Experience Tag
  // ----------------------------------------------------------
  const filterByTag = useCallback((places: LuxuryPlace[]) => {
    if (!filteredTag || filteredTag === 'all') return places;
    return places.filter((p) => {
      const tags = p.organizationData?.experienceTags || [];
      const category = (p.category || '').toLowerCase();
      return (
        tags.some((t) => t.toLowerCase() === filteredTag.toLowerCase()) ||
        category === filteredTag.toLowerCase()
      );
    });
  }, [filteredTag]);

  const filteredCrownJewels = useMemo(
    () => (luxuryData ? filterByTag(luxuryData.crownJewels) : []),
    [luxuryData, filterByTag]
  );

  const filteredAllPlaces = useMemo(
    () => (luxuryData ? filterByTag(luxuryData.allPlaces) : []),
    [luxuryData, filterByTag]
  );

  // "More places" = all places not in crown jewels
  const morePlaces = useMemo(() => {
    if (!luxuryData) return [];
    const crownNames = new Set(filteredCrownJewels.map((p) => p.name));
    return filteredAllPlaces.filter((p) => !crownNames.has(p.name));
  }, [luxuryData, filteredCrownJewels, filteredAllPlaces]);

  const visibleMorePlaces = showAllPlaces
    ? morePlaces
    : morePlaces.slice(0, INITIAL_MORE_PLACES);

  const filteredHiddenGems = useMemo(
    () => (luxuryData ? filterByTag(luxuryData.hiddenGems) : []),
    [luxuryData, filterByTag]
  );

  // ----------------------------------------------------------
  // UNIFIED PROGRESSIVE RENDER
  // ----------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      {/* Header — always visible immediately */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerTitle, { color: themeColors.text }]}
            numberOfLines={1}
          >
            {locationName}
          </Text>
          {loading ? (
            <View style={styles.loadingPill}>
              <ActivityIndicator size="small" color={colors.primary[500]} style={{ transform: [{ scale: 0.7 }] }} />
              <Text style={styles.loadingPillText}>AI discovering...</Text>
            </View>
          ) : (
            <View style={styles.sourceTag}>
              <Ionicons name="sparkles" size={10} color={colors.primary[500]} />
              <Text style={styles.sourceTagText}>AI Powered</Text>
            </View>
          )}
        </View>
        <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
          {loading ? '' : `${luxuryData?.allPlaces.length || 0} places`}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── LOADING SKELETON (inline, static — renders instantly) ── */}
        {loading && !luxuryData && (
          <>
            {/* Hero placeholder with gradient + location name */}
            <LinearGradient
              colors={[colors.primary[700], colors.primary[900]]}
              style={styles.skeletonHero}
            >
              <View style={styles.skeletonHeroContent}>
                <View style={styles.skeletonHeroMeta}>
                  <SkeletonBlock width={80} height={18} radius={999} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
                  <SkeletonBlock width={60} height={18} radius={999} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
                </View>
                <Text style={styles.skeletonHeroTitle} numberOfLines={1}>
                  {locationName}
                </Text>
                <SkeletonBlock width={200} height={14} radius={6} style={{ backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 8 }} />
              </View>
              {/* Slide dots placeholder */}
              <View style={styles.skeletonDots}>
                {[0,1,2,3,4].map(i => (
                  <View key={i} style={[styles.skeletonDot, i === 0 && styles.skeletonDotActive]} />
                ))}
              </View>
            </LinearGradient>

            {/* Filter pills skeleton */}
            <View style={styles.skeletonFilters}>
              {[80, 100, 80, 90, 70].map((w, i) => (
                <SkeletonBlock key={i} width={w} height={34} radius={999} />
              ))}
            </View>

            {/* Section: Top Places */}
            <View style={styles.skeletonSection}>
              <SkeletonBlock width={200} height={22} radius={6} />
              <SkeletonBlock width={SCREEN_WIDTH - spacing.xl * 2} height={220} style={{ marginTop: spacing.md }} />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <SkeletonBlock width={BENTO_SMALL_WIDTH} height={140} />
                <SkeletonBlock width={BENTO_SMALL_WIDTH} height={140} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <SkeletonBlock width={BENTO_SMALL_WIDTH} height={140} />
                <SkeletonBlock width={BENTO_SMALL_WIDTH} height={140} />
              </View>
            </View>

            {/* Section: More Places */}
            <View style={styles.skeletonSection}>
              <SkeletonBlock width={160} height={22} radius={6} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md }}>
                {[0,1,2,3].map(i => <SkeletonBlock key={i} width={CARD_WIDTH} height={160} />)}
              </View>
            </View>

            {/* Section: Circuits */}
            <View style={styles.skeletonSection}>
              <SkeletonBlock width={180} height={22} radius={6} />
              <SkeletonBlock width="100%" height={160} style={{ marginTop: spacing.md }} />
              <SkeletonBlock width="100%" height={160} style={{ marginTop: spacing.md }} />
            </View>

            <View style={{ height: spacing['3xl'] }} />
          </>
        )}

        {/* Error */}
        {error && !luxuryData && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
            <Text style={[styles.errorText, { color: themeColors.text }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchPlaces()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {luxuryData && (
          <>
            {/* ============================== */}
            {/* 0. HERO CAROUSEL               */}
            {/* ============================== */}
            <Animated.View style={{ opacity: heroAnim }}>
              <HeroCarousel
                places={filteredCrownJewels}
                hero={luxuryData.hero}
                locationName={locationName}
                onPlacePress={handlePlacePress}
              />
            </Animated.View>

            {/* ============================== */}
            {/* 1. EXPERIENCE TAG FILTERS      */}
            {/* ============================== */}
            <Animated.View style={{ opacity: filtersAnim }}>
              <ExperienceTagFilters
                tags={luxuryData.experienceTags}
                selectedTag={filteredTag}
                onTagSelect={setFilteredTag}
              />
            </Animated.View>

            {/* ============================== */}
            {/* 2. TOP PLACES — BENTO GRID     */}
            {/* ============================== */}
            {filteredCrownJewels.length > 0 && (
              <Animated.View style={[styles.section, { opacity: topPlacesAnim }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Top Places to Explore
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Must-visit attractions in {locationName}
                  </Text>
                </View>

                {/* #1 - Large Hero Card */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handlePlacePress(filteredCrownJewels[0])}
                  style={[styles.bentoLarge, shadow.md]}
                >
                  {getPlaceImageUrl(filteredCrownJewels[0]) ? (
                    <Image
                      source={{ uri: getPlaceImageUrl(filteredCrownJewels[0])! }}
                      style={styles.bentoLargeImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                      priority="high"
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary[400], colors.primary[700]]}
                      style={styles.bentoLargeImage}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.bentoOverlay}
                  >
                    <View style={styles.bentoContent}>
                      {/* Rank Badge */}
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeText}>#1</Text>
                      </View>
                      {filteredCrownJewels[0].category && (
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText}>
                            {filteredCrownJewels[0].category}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.bentoTitle} numberOfLines={2}>
                        {filteredCrownJewels[0].name}
                      </Text>
                      {filteredCrownJewels[0].shortDescription && (
                        <Text style={styles.bentoDesc} numberOfLines={2}>
                          {filteredCrownJewels[0].shortDescription}
                        </Text>
                      )}
                      <View style={styles.bentoMeta}>
                        {filteredCrownJewels[0].rating && (
                          <View style={styles.metaItem}>
                            <Ionicons name="star" size={14} color="#FBBF24" />
                            <Text style={styles.metaText}>
                              {Number(filteredCrownJewels[0].rating).toFixed(1)}
                            </Text>
                          </View>
                        )}
                        {filteredCrownJewels[0].duration && (
                          <View style={styles.metaItem}>
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color="rgba(255,255,255,0.8)"
                            />
                            <Text style={styles.metaText}>
                              {filteredCrownJewels[0].duration}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* #2-5 — 2x2 Grid */}
                {filteredCrownJewels.length > 1 && (
                  <View style={styles.bentoGrid}>
                    {filteredCrownJewels.slice(1, 5).map((place, idx) => {
                      const imageUrl = getPlaceImageUrl(place);
                      return (
                        <TouchableOpacity
                          key={place.name + idx}
                          activeOpacity={0.85}
                          onPress={() => handlePlacePress(place)}
                          style={[styles.bentoSmall, shadow.sm]}
                        >
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.bentoSmallImage}
                              contentFit="cover"
                              transition={200}
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <LinearGradient
                              colors={[colors.primary[300], colors.primary[600]]}
                              style={styles.bentoSmallImage}
                            />
                          )}
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.75)']}
                            style={styles.bentoSmallOverlay}
                          >
                            {/* Rank Badge */}
                            <View style={[styles.rankBadge, styles.rankBadgeSmall]}>
                              <Text style={styles.rankBadgeSmallText}>
                                #{idx + 2}
                              </Text>
                            </View>
                            {/* Rating */}
                            {place.rating && (
                              <View style={styles.smallRatingBadge}>
                                <Ionicons name="star" size={10} color="#FBBF24" />
                                <Text style={styles.smallRatingText}>
                                  {Number(place.rating).toFixed(1)}
                                </Text>
                              </View>
                            )}
                            <View style={styles.bentoSmallContent}>
                              <Text
                                style={styles.bentoSmallTitle}
                                numberOfLines={2}
                              >
                                {place.name}
                              </Text>
                              {place.category && (
                                <Text
                                  style={styles.bentoSmallCategory}
                                  numberOfLines={1}
                                >
                                  {place.category}
                                </Text>
                              )}
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            )}

            {/* ============================== */}
            {/* 3. MORE AMAZING PLACES         */}
            {/* ============================== */}
            {morePlaces.length > 0 && (
              <Animated.View style={[styles.section, { opacity: morePlacesAnim }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    More Amazing Places
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    {morePlaces.length} more places to discover
                  </Text>
                </View>

                <View style={styles.morePlacesGrid}>
                  {visibleMorePlaces.map((place, idx) => {
                    const imageUrl = getPlaceImageUrl(place);
                    return (
                      <TouchableOpacity
                        key={place.name + idx}
                        activeOpacity={0.85}
                        onPress={() => handlePlacePress(place)}
                        style={[
                          styles.morePlaceCard,
                          shadow.sm,
                          { backgroundColor: themeColors.card },
                        ]}
                      >
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.morePlaceImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View
                            style={[
                              styles.morePlaceImage,
                              styles.morePlacePlaceholder,
                              {
                                backgroundColor: isDarkMode
                                  ? '#1F2937'
                                  : '#F3F4F6',
                              },
                            ]}
                          >
                            <Ionicons
                              name="image-outline"
                              size={24}
                              color={themeColors.textTertiary}
                            />
                          </View>
                        )}
                        {/* Rating badge on image */}
                        {place.rating && (
                          <View style={styles.cardRatingBadge}>
                            <Ionicons name="star" size={10} color="#FBBF24" />
                            <Text style={styles.cardRatingText}>
                              {Number(place.rating).toFixed(1)}
                            </Text>
                          </View>
                        )}
                        {place.category && (
                          <View style={styles.cardCategoryBadge}>
                            <Text style={styles.cardCategoryText}>
                              {place.category}
                            </Text>
                          </View>
                        )}
                        <View style={styles.morePlaceContent}>
                          <Text
                            style={[
                              styles.morePlaceName,
                              { color: themeColors.text },
                            ]}
                            numberOfLines={2}
                          >
                            {place.name}
                          </Text>
                          {place.shortDescription && (
                            <Text
                              style={[
                                styles.morePlaceDesc,
                                { color: themeColors.textTertiary },
                              ]}
                              numberOfLines={2}
                            >
                              {place.shortDescription}
                            </Text>
                          )}
                          {place.duration && (
                            <Text
                              style={[
                                styles.morePlaceDuration,
                                { color: themeColors.textSecondary },
                              ]}
                            >
                              {place.duration}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* View All / Show Less */}
                {morePlaces.length > INITIAL_MORE_PLACES && (
                  <TouchableOpacity
                    onPress={() => setShowAllPlaces(!showAllPlaces)}
                    style={[
                      styles.viewAllButton,
                      {
                        backgroundColor: isDarkMode ? '#1F2937' : '#FFF7ED',
                        borderColor: colors.primary[300],
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showAllPlaces ? 'chevron-up' : 'grid-outline'}
                      size={18}
                      color={colors.primary[500]}
                    />
                    <Text style={styles.viewAllButtonText}>
                      {showAllPlaces
                        ? 'Show Less'
                        : `View All ${morePlaces.length} Places`}
                    </Text>
                    {!showAllPlaces && (
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.primary[500]}
                      />
                    )}
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}

            {/* ============================== */}
            {/* 4. EMBEDDED AI CHAT WIDGET     */}
            {/* ============================== */}
            <EmbeddedChatWidget locationName={locationName} />

            {/* ============================== */}
            {/* 5. HERITAGE CIRCUITS           */}
            {/* ============================== */}
            {(Object.keys(luxuryData.administrativeCircuits).length > 0 ||
              Object.keys(luxuryData.dynamicCircuits).length > 0) && (
              <Animated.View style={{ opacity: circuitsAnim }}>
                <HeritageCircuits
                  administrativeCircuits={luxuryData.administrativeCircuits}
                  dynamicCircuits={luxuryData.dynamicCircuits}
                  onPlacePress={handlePlacePress}
                  filteredTag={filteredTag}
                />
              </Animated.View>
            )}

            {/* ============================== */}
            {/* 6. HIDDEN GEMS                 */}
            {/* ============================== */}
            {filteredHiddenGems.length > 0 && (
              <Animated.View style={{ opacity: gemsAnim }}>
                <HiddenGems
                  gems={filteredHiddenGems}
                  onPlacePress={handlePlacePress}
                  filteredTag={filteredTag}
                />
              </Animated.View>
            )}

            {/* Bottom Spacer */}
            <View style={{ height: spacing['3xl'] }} />
          </>
        )}

        {/* Empty state */}
        {!loading && !error && !luxuryData && (
          <View style={styles.emptyContainer}>
            <Ionicons name="earth-outline" size={64} color={colors.gray[300]} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              No places found for "{locationName}"
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}
            >
              Try a different destination name
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  sourceTagText: {
    fontSize: 10,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  resultCount: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Inline loading pill in header
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  loadingPillText: {
    fontSize: 10,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },

  // Skeleton styles
  skeletonHero: {
    width: SCREEN_WIDTH,
    height: 280,
    justifyContent: 'flex-end',
  },
  skeletonHeroContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  skeletonHeroMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  skeletonHeroTitle: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    opacity: 0.9,
  },
  skeletonDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skeletonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  skeletonDotActive: {
    width: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  skeletonFilters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  skeletonSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  // Error
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },

  // Section
  section: {
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
  },

  // Bento Grid - Large Card (#1)
  bentoLarge: {
    height: 220,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  bentoLargeImage: { width: '100%', height: '100%' },
  bentoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing['5xl'],
  },
  bentoContent: {},
  rankBadge: {
    position: 'absolute',
    top: -60,
    left: 0,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  rankBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  bentoTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  bentoDesc: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  bentoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: fontWeight.medium,
  },

  // Bento Grid - Small Cards (#2-5)
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  bentoSmall: {
    width: BENTO_SMALL_WIDTH,
    height: 140,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bentoSmallImage: { width: '100%', height: '100%' },
  bentoSmallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: spacing.sm + 2,
  },
  rankBadgeSmall: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankBadgeSmallText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  smallRatingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 3,
  },
  smallRatingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  bentoSmallContent: {},
  bentoSmallTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bentoSmallCategory: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // More Places Grid
  morePlacesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  morePlaceCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  morePlaceImage: { width: '100%', height: 110 },
  morePlacePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRatingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 3,
  },
  cardRatingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  cardCategoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  cardCategoryText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  morePlaceContent: { padding: spacing.sm + 2 },
  morePlaceName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  morePlaceDesc: { fontSize: fontSize.xs, marginTop: 3, lineHeight: 16 },
  morePlaceDuration: { fontSize: fontSize.xs, marginTop: 4 },

  // View All Button
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  viewAllButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
