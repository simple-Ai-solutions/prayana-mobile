import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { useCreateTripStore } from '@prayana/shared-stores';
import { makeAPICall, hierarchicalSearch, destinationAPI } from '@prayana/shared-services';
import {
  transformToLuxuryLayout,
  getPlaceImageUrl,
  resolveImageUrl,
  type LuxuryData,
  type LuxuryPlace,
} from '@prayana/shared-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

// ─── Types ───────────────────────────────────────────────────────────────────

type TimeSlotKey = 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_SLOTS = [
  { key: 'morning' as TimeSlotKey, label: 'Morning', emoji: '\u2600\uFE0F', color: '#f59e0b', bgColor: '#fffbeb' },
  { key: 'afternoon' as TimeSlotKey, label: 'Afternoon', emoji: '\u2601\uFE0F', color: '#3b82f6', bgColor: '#eff6ff' },
  { key: 'evening' as TimeSlotKey, label: 'Evening', emoji: '\uD83C\uDF19', color: '#8b5cf6', bgColor: '#f5f3ff' },
  { key: 'night' as TimeSlotKey, label: 'Night', emoji: '\u2B50', color: '#1e3a5f', bgColor: '#f0f4f8' },
];

// ─── Image Enrichment ────────────────────────────────────────────────────────

const ENRICH_BATCH_SIZE = 3;
const ENRICH_BATCH_DELAY = 500;

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
          .catch(() => {})
      )
    );

    if (onBatchComplete && imageMap.size > 0) {
      onBatchComplete(new Map(imageMap));
    }

    if (i + ENRICH_BATCH_SIZE < needsImage.length) {
      await new Promise((r) => setTimeout(r, ENRICH_BATCH_DELAY));
    }
  }

  return imageMap;
}

// ─── Shimmer ─────────────────────────────────────────────────────────────────

const ShimmerBlock = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(animValue, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animValue]);

  const bg = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: isDarkMode ? ['#1F2937', '#374151'] : ['#E5E7EB', '#F3F4F6'],
  });

  return <Animated.View style={[{ width: width as any, height, borderRadius: 12, backgroundColor: bg }, style]} />;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SearchActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destinationName?: string;
    dayIndex?: string;
    slot?: string;
  }>();
  const { themeColors, isDarkMode } = useTheme();

  const destinationName = params.destinationName || '';
  const dayIndex = parseInt(params.dayIndex || '0', 10);
  const initialSlot = (params.slot as TimeSlotKey) || 'morning';

  // Store
  const addActivity = useCreateTripStore((s) => s.addActivity);

  // State
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey>(initialSlot);
  const [searchQuery, setSearchQuery] = useState('');
  const [luxuryData, setLuxuryData] = useState<LuxuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [filteredTag, setFilteredTag] = useState('all');
  const isFetchingRef = useRef(false);

  // ─── Image enrichment ───
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

  const startImageEnrichment = useCallback(
    (transformed: LuxuryData) => {
      const crownNames = new Set(transformed.crownJewels.map((p) => p.name));
      const priorityPlaces = transformed.crownJewels.filter((p) => !getPlaceImageUrl(p));
      const restPlaces = (transformed.allPlaces || []).filter(
        (p) => !crownNames.has(p.name) && !getPlaceImageUrl(p)
      );
      enrichPlacesWithImages(priorityPlaces, destinationName, applyImageMap)
        .then(() => enrichPlacesWithImages(restPlaces, destinationName, applyImageMap))
        .catch(() => {});
    },
    [destinationName, applyImageMap]
  );

  // ─── Load destination data on mount (same as destination page) ───
  const fetchPlaces = useCallback(async () => {
    if (!destinationName || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const response = await hierarchicalSearch(destinationName, {}, { timeout: 60000 });
      const transformed = transformToLuxuryLayout(response);

      if (transformed) {
        setLuxuryData(transformed);
        startImageEnrichment(transformed);
      }
    } catch (err: any) {
      console.error('[SearchActivity] Fetch error:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [destinationName, startImageEnrichment]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  // ─── Text search ───
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !destinationName) return;

    setSearching(true);
    try {
      const dbResponse = await makeAPICall('/destinations/hierarchical-search', {
        method: 'POST',
        body: JSON.stringify({
          query: destinationName,
          filters: { limit: 20, searchTerm: searchQuery.trim() },
        }),
        timeout: 25000,
      });

      let places: any[] = [];
      if (dbResponse.success && Array.isArray(dbResponse.data)) {
        places = dbResponse.data;
      } else if (dbResponse.data?.results) {
        places = dbResponse.data.results;
      } else if (Array.isArray(dbResponse.places)) {
        places = dbResponse.places;
      }

      if (places.length > 0) {
        const term = searchQuery.trim().toLowerCase();
        const filtered = places.filter((p: any) =>
          (p.name || '').toLowerCase().includes(term) ||
          (p.description || '').toLowerCase().includes(term) ||
          (p.category || '').toLowerCase().includes(term)
        );
        setSearchResults(filtered.length > 0 ? filtered : places);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, destinationName]);

  // ─── Add place as activity ───
  const handleAddPlace = useCallback((place: any) => {
    const imageUrl = getPlaceImageUrl(place) || place.image || place.imageUrls?.[0] || '';
    addActivity(dayIndex, {
      name: place.name || 'Activity',
      description: place.shortDescription || place.description || '',
      timeSlot: activeSlot,
      duration: place.duration ? parseFloat(place.duration) : 2,
      rating: place.rating || 4.0,
      category: place.category || 'general',
      coordinates: { lat: 0, lng: 0 },
      image: imageUrl,
      images: place.images || [],
      imageUrls: place.imageUrls || [],
      notes: '',
    });

    Alert.alert('Added!', `${place.name} added to your itinerary.`, [{ text: 'OK' }]);
  }, [dayIndex, activeSlot, addActivity]);

  // ─── Filter by tag ───
  const allPlaces = luxuryData?.allPlaces || [];
  const crownJewels = luxuryData?.crownJewels || [];
  const experienceTags = luxuryData?.experienceTags || [];

  const filteredPlaces = filteredTag === 'all'
    ? allPlaces
    : allPlaces.filter((p) => {
        const tags = p.organizationData?.experienceTags || [];
        const cat = (p.category || '').toLowerCase();
        return tags.some((t) => t.toLowerCase() === filteredTag.toLowerCase()) || cat === filteredTag.toLowerCase();
      });

  const topPlaces = filteredTag === 'all'
    ? crownJewels
    : crownJewels.filter((p) => {
        const tags = p.organizationData?.experienceTags || [];
        const cat = (p.category || '').toLowerCase();
        return tags.some((t) => t.toLowerCase() === filteredTag.toLowerCase()) || cat === filteredTag.toLowerCase();
      });

  const crownNames = new Set(topPlaces.map((p) => p.name));
  const morePlaces = filteredPlaces.filter((p) => !crownNames.has(p.name));

  // Active search mode
  const isSearchMode = searchQuery.trim().length > 0;

  // ─── LOADING ───
  if (loading && !luxuryData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
              {destinationName}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          <ShimmerBlock width="100%" height={280} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ShimmerBlock width={80} height={36} />
            <ShimmerBlock width={100} height={36} />
            <ShimmerBlock width={90} height={36} />
          </View>
          <ShimmerBlock width={200} height={24} />
          <ShimmerBlock width="100%" height={220} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <ShimmerBlock width={CARD_WIDTH} height={140} />
            <ShimmerBlock width={CARD_WIDTH} height={140} />
          </View>
        </ScrollView>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Ionicons name="sparkles" size={16} color={colors.primary[500]} />
            <Text style={styles.loadingText}>AI discovering {destinationName}...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── MAIN RENDER ───
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
            {destinationName}
          </Text>
          <View style={styles.sourceTag}>
            <Ionicons name="sparkles" size={10} color={colors.primary[500]} />
            <Text style={styles.sourceTagText}>AI Powered</Text>
          </View>
        </View>
        <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
          {allPlaces.length} places
        </Text>
      </View>

      {/* Time Slot Picker */}
      <View style={[styles.slotPicker, { backgroundColor: isDarkMode ? '#111827' : colors.gray[50] }]}>
        {TIME_SLOTS.map((slot) => (
          <TouchableOpacity
            key={slot.key}
            style={[
              styles.slotBtn,
              { backgroundColor: slot.bgColor },
              activeSlot === slot.key && { borderColor: slot.color, borderWidth: 2 },
            ]}
            onPress={() => setActiveSlot(slot.key)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14 }}>{slot.emoji}</Text>
            <Text style={[styles.slotLabel, { color: activeSlot === slot.key ? slot.color : colors.textTertiary }]}>
              {slot.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Input */}
      <View style={[styles.searchRow, { borderBottomColor: themeColors.border }]}>
        <View style={[styles.searchInputBox, { backgroundColor: isDarkMode ? '#1F2937' : colors.gray[50], borderColor: themeColors.border }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchText, { color: themeColors.text }]}
            placeholder={`Search places in ${destinationName}...`}
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color={colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.7}>
          <Ionicons name="search" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── Search Results Mode ─── */}
        {isSearchMode ? (
          searching ? (
            <View style={styles.searchLoading}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={[styles.searchLoadingText, { color: themeColors.textSecondary }]}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Search Results
                </Text>
                <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                  {searchResults.length} places found · Tap to add
                </Text>
              </View>
              <View style={styles.placesGrid}>
                {searchResults.map((place, idx) => {
                  const imageUrl = getPlaceImageUrl(place) || place.image || place.imageUrls?.[0] || '';
                  return (
                    <TouchableOpacity
                      key={place.name + idx}
                      style={[styles.placeCard, shadow.sm, { backgroundColor: themeColors.card }]}
                      activeOpacity={0.7}
                      onPress={() => handleAddPlace(place)}
                    >
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.placeImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.placeImage, styles.placePlaceholder, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                          <Ionicons name="image-outline" size={24} color={themeColors.textTertiary} />
                        </View>
                      )}
                      {place.rating && (
                        <View style={styles.cardRatingBadge}>
                          <Ionicons name="star" size={10} color="#FBBF24" />
                          <Text style={styles.cardRatingText}>{Number(place.rating).toFixed(1)}</Text>
                        </View>
                      )}
                      <View style={styles.addBadge}>
                        <Ionicons name="add" size={16} color="#ffffff" />
                      </View>
                      <View style={styles.placeContent}>
                        <Text style={[styles.placeName, { color: themeColors.text }]} numberOfLines={2}>{place.name}</Text>
                        {place.category && (
                          <Text style={[styles.placeCategory, { color: themeColors.textTertiary }]} numberOfLines={1}>
                            {place.category}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={56} color={colors.gray[300]} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No results found</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                Try a different search term for {destinationName}
              </Text>
            </View>
          )
        ) : luxuryData ? (
          <>
            {/* ─── Experience Tag Filters ─── */}
            {experienceTags.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagFilters}
              >
                <TouchableOpacity
                  style={[styles.tagPill, filteredTag === 'all' && styles.tagPillActive]}
                  onPress={() => setFilteredTag('all')}
                >
                  <Text style={{ fontSize: 14 }}>🌍</Text>
                  <Text style={[styles.tagPillText, filteredTag === 'all' && styles.tagPillTextActive]}>
                    All ({allPlaces.length})
                  </Text>
                </TouchableOpacity>
                {experienceTags.map((t) => (
                  <TouchableOpacity
                    key={t.tag}
                    style={[styles.tagPill, filteredTag === t.tag && styles.tagPillActive]}
                    onPress={() => setFilteredTag(t.tag)}
                  >
                    {t.emoji && <Text style={{ fontSize: 14 }}>{t.emoji}</Text>}
                    <Text style={[styles.tagPillText, filteredTag === t.tag && styles.tagPillTextActive]}>
                      {t.tag} ({t.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* ─── Top Places — Bento Grid ─── */}
            {topPlaces.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Top Places to Explore
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                    Tap any place to add to your itinerary
                  </Text>
                </View>

                {/* #1 Large Hero Card */}
                <TouchableOpacity
                  style={[styles.bentoLarge, shadow.md]}
                  activeOpacity={0.7}
                  onPress={() => handleAddPlace(topPlaces[0])}
                >
                  {getPlaceImageUrl(topPlaces[0]) ? (
                    <Image source={{ uri: getPlaceImageUrl(topPlaces[0])! }} style={styles.bentoLargeImage} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={[colors.primary[400], colors.primary[700]]} style={styles.bentoLargeImage} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bentoOverlay}>
                    <View>
                      <View style={styles.rankBadge}><Text style={styles.rankBadgeText}>#1</Text></View>
                      {topPlaces[0].category && (
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText}>{topPlaces[0].category}</Text>
                        </View>
                      )}
                      <Text style={styles.bentoTitle} numberOfLines={2}>{topPlaces[0].name}</Text>
                      <View style={styles.bentoMeta}>
                        {topPlaces[0].rating && (
                          <View style={styles.metaItem}>
                            <Ionicons name="star" size={14} color="#FBBF24" />
                            <Text style={styles.metaText}>{Number(topPlaces[0].rating).toFixed(1)}</Text>
                          </View>
                        )}
                        <View style={styles.addPillOverlay}>
                          <Ionicons name="add-circle" size={14} color="#ffffff" />
                          <Text style={styles.addPillText}>Tap to add</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* #2-5 2x2 Grid */}
                {topPlaces.length > 1 && (
                  <View style={styles.bentoGrid}>
                    {topPlaces.slice(1, 5).map((place, idx) => {
                      const imageUrl = getPlaceImageUrl(place);
                      return (
                        <TouchableOpacity
                          key={place.name + idx}
                          style={[styles.bentoSmall, shadow.sm]}
                          activeOpacity={0.7}
                          onPress={() => handleAddPlace(place)}
                        >
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.bentoSmallImage} resizeMode="cover" />
                          ) : (
                            <LinearGradient colors={[colors.primary[300], colors.primary[600]]} style={styles.bentoSmallImage} />
                          )}
                          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.bentoSmallOverlay}>
                            <View style={[styles.rankBadge, styles.rankBadgeSmall]}>
                              <Text style={styles.rankBadgeSmallText}>#{idx + 2}</Text>
                            </View>
                            {place.rating && (
                              <View style={styles.smallRatingBadge}>
                                <Ionicons name="star" size={10} color="#FBBF24" />
                                <Text style={styles.smallRatingText}>{Number(place.rating).toFixed(1)}</Text>
                              </View>
                            )}
                            <View>
                              <Text style={styles.bentoSmallTitle} numberOfLines={2}>{place.name}</Text>
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ─── More Places Grid ─── */}
            {morePlaces.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    More Amazing Places
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>
                    {morePlaces.length} more places to add
                  </Text>
                </View>
                <View style={styles.placesGrid}>
                  {morePlaces.map((place, idx) => {
                    const imageUrl = getPlaceImageUrl(place);
                    return (
                      <TouchableOpacity
                        key={place.name + idx}
                        style={[styles.placeCard, shadow.sm, { backgroundColor: themeColors.card }]}
                        activeOpacity={0.7}
                        onPress={() => handleAddPlace(place)}
                      >
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.placeImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.placeImage, styles.placePlaceholder, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                            <Ionicons name="image-outline" size={24} color={themeColors.textTertiary} />
                          </View>
                        )}
                        {place.rating && (
                          <View style={styles.cardRatingBadge}>
                            <Ionicons name="star" size={10} color="#FBBF24" />
                            <Text style={styles.cardRatingText}>{Number(place.rating).toFixed(1)}</Text>
                          </View>
                        )}
                        {place.category && (
                          <View style={styles.cardCategoryBadge}>
                            <Text style={styles.cardCategoryText}>{place.category}</Text>
                          </View>
                        )}
                        <View style={styles.addBadge}>
                          <Ionicons name="add" size={16} color="#ffffff" />
                        </View>
                        <View style={styles.placeContent}>
                          <Text style={[styles.placeName, { color: themeColors.text }]} numberOfLines={2}>{place.name}</Text>
                          {place.shortDescription && (
                            <Text style={[styles.placeDesc, { color: themeColors.textTertiary }]} numberOfLines={2}>{place.shortDescription}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ height: spacing['3xl'] }} />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="earth-outline" size={56} color={colors.gray[300]} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No places found</Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
              Try searching for a specific place
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  // Header (matches destination page exactly)
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

  // Slot Picker
  slotPicker: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  slotBtn: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  slotLabel: { fontSize: 10, fontWeight: fontWeight.semibold },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 40,
  },
  searchText: { flex: 1, fontSize: fontSize.sm, paddingVertical: 0 },
  searchBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
  },

  // Loading
  loadingOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  loadingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#ffffff',
  },

  // Search loading
  searchLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.md,
  },
  searchLoadingText: { fontSize: fontSize.sm },

  // Tag Filters
  tagFilters: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.gray[100],
  },
  tagPillActive: {
    backgroundColor: '#059669',
  },
  tagPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tagPillTextActive: {
    color: '#ffffff',
  },

  // Section
  section: { paddingTop: spacing.xl },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: { fontSize: fontSize.sm },

  // Bento Grid - Large (#1)
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
  addPillOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  addPillText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // Bento Grid - Small (#2-5)
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  bentoSmall: {
    width: CARD_WIDTH,
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
  bentoSmallTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Places Grid (More + Search Results)
  placesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  placeCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  placeImage: { width: '100%', height: 110 },
  placePlaceholder: {
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
  addBadge: {
    position: 'absolute',
    top: 78,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  placeContent: { padding: spacing.sm + 2 },
  placeName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  placeDesc: { fontSize: fontSize.xs, marginTop: 3, lineHeight: 16 },
  placeCategory: { fontSize: 10, marginTop: 2, textTransform: 'uppercase' },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
  },
});
