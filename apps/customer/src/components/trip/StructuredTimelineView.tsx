import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, shadow, borderRadius } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl, getPlaceImageUrl } from '@prayana/shared-utils';
import { useRouter } from 'expo-router';
import { ItineraryMap } from './ItineraryMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Place {
  name: string;
  description?: string;
  time?: string;
  visitDuration?: string;
  entryFee?: string;
  estimatedCost?: string;
  coordinates?: { lat: number; lng: number };
  images?: (string | { url?: string })[];
  tags?: string[];
  tips?: string[];
  type?: string;
  openingHours?: string;
}

interface StructuredDay {
  dayNumber: number;
  title?: string;
  theme?: string;
  mainPlaces: Place[];
}

interface StructuredTimelineViewProps {
  structuredData: { days: StructuredDay[] } | null;
  destination: string;
  loading: boolean;
  onGenerateStructured: () => void;
}

function assignPlaceTimes(places: Place[]): Place[] {
  let hour = 9;
  let minute = 0;

  return places.map((place, index) => {
    if (place.time) return place;

    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;

    let durationMinutes = 90;
    if (place.visitDuration) {
      const hourMatch = place.visitDuration.match(/(\d+)\s*(?:hour|hr)/i);
      const minMatch = place.visitDuration.match(/(\d+)\s*min/i);
      durationMinutes = 0;
      if (hourMatch) durationMinutes += parseInt(hourMatch[1]) * 60;
      if (minMatch) durationMinutes += parseInt(minMatch[1]);
      if (durationMinutes === 0) durationMinutes = 90;
    }

    if (index === 2) durationMinutes += 60;
    if (index === 6) durationMinutes += 45;

    minute += durationMinutes;
    hour += Math.floor(minute / 60);
    minute = minute % 60;

    return { ...place, time: timeStr };
  });
}

const TIMELINE_COLORS = ['#FF6B6B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

// Extract image URL from place data (handles string[], {url}[] formats)
function extractPlaceImage(place: Place): string | null {
  if (!place.images || place.images.length === 0) return null;
  const first = place.images[0];
  if (typeof first === 'string') return resolveImageUrl(first) || first;
  if (first && typeof first === 'object' && first.url) return resolveImageUrl(first.url) || first.url;
  return null;
}

// Self-loading image component — fetches from API if place has no image
const PlaceImage: React.FC<{
  placeName: string;
  destination: string;
  existingImage: string | null;
  style: any;
}> = React.memo(({ placeName, destination, existingImage, style }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(existingImage);
  const [loading, setLoading] = useState(!existingImage);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (existingImage) {
      setImageUrl(existingImage);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchImage = async () => {
      try {
        const res = await makeAPICall('/destinations/place-images', {
          method: 'POST',
          body: JSON.stringify({
            placeName,
            location: destination,
            count: 1,
          }),
          timeout: 20000,
        });
        if (cancelled) return;

        const data = res?.data || res;
        const imgArr = Array.isArray(data) ? data : [];
        if (imgArr.length > 0) {
          const imgData = imgArr[0];
          const rawUrl = typeof imgData === 'string'
            ? imgData
            : imgData?.url || imgData?.mediumUrl || imgData?.smallUrl || imgData?.s3Url || imgData?.imageUrl || imgData?.originalUrl || null;
          if (rawUrl) {
            setImageUrl(resolveImageUrl(rawUrl) || rawUrl);
          }
        }
      } catch (err: any) {
        console.warn('[Timeline] Image error:', placeName, err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchImage();
    return () => { cancelled = true; };
  }, [placeName, destination, existingImage]);

  if (loading) {
    return (
      <View style={[style, imgStyles.placeholder]}>
        <ActivityIndicator size="small" color={colors.gray[300]} />
      </View>
    );
  }

  if (imageUrl && !error) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={style}
        resizeMode="cover"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={[style, imgStyles.placeholder]}
    >
      <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.5)" />
    </LinearGradient>
  );
});

const imgStyles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
  },
});

// ============================================================
// MAIN COMPONENT
// ============================================================
export const StructuredTimelineView: React.FC<StructuredTimelineViewProps> = ({
  structuredData,
  destination,
  loading,
  onGenerateStructured,
}) => {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  // Store fetched image URLs so we can pass them in preview
  const [fetchedImages, setFetchedImages] = useState<Record<string, string>>({});

  const days = useMemo(() => {
    if (!structuredData?.days) return [];
    return structuredData.days.map((day) => ({
      ...day,
      mainPlaces: assignPlaceTimes(day.mainPlaces || []),
    }));
  }, [structuredData]);

  const currentDay = days[selectedDay];
  const currentPlaces = useMemo(() => currentDay?.mainPlaces || [], [currentDay]);
  const totalStops = currentPlaces.length;

  const toggleExpand = useCallback((key: string) => {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Callback when a PlaceImage finds its URL — store for preview passing
  const onImageResolved = useCallback((name: string, url: string) => {
    setFetchedImages(prev => prev[name] ? prev : { ...prev, [name]: url });
  }, []);

  const getPlaceImageForPreview = useCallback((place: Place): string => {
    return extractPlaceImage(place) || fetchedImages[place.name] || '';
  }, [fetchedImages]);

  const handlePlacePress = useCallback((place: Place) => {
    const preview = JSON.stringify({
      name: place.name,
      category: place.type || (place.tags && place.tags[0]) || '',
      rating: null,
      shortDescription: place.description || '',
      image: getPlaceImageForPreview(place),
      duration: place.visitDuration || '',
    });

    router.push({
      pathname: '/destination/[location]/[place]',
      params: {
        location: encodeURIComponent(destination),
        place: encodeURIComponent(place.name),
        preview,
      },
    });
  }, [router, destination, getPlaceImageForPreview]);

  const handlePrevDay = useCallback(() => {
    if (selectedDay > 0) setSelectedDay(selectedDay - 1);
  }, [selectedDay]);

  const handleNextDay = useCallback(() => {
    if (selectedDay < days.length - 1) setSelectedDay(selectedDay + 1);
  }, [selectedDay, days.length]);

  // Generate prompt
  if (!structuredData && !loading) {
    return (
      <View style={styles.generateContainer}>
        <View style={styles.generateContent}>
          <LinearGradient colors={['#FF6B6B', '#ee5a5a']} style={styles.generateIcon}>
            <Ionicons name="git-branch-outline" size={32} color="#ffffff" />
          </LinearGradient>
          <Text style={styles.generateTitle}>Generate Timeline</Text>
          <Text style={styles.generateSubtitle}>
            Create a structured timeline with place details, timings, and map coordinates for your {destination} trip.
          </Text>
          <TouchableOpacity style={[styles.generateButton, shadow.md]} onPress={onGenerateStructured} activeOpacity={0.85}>
            <LinearGradient colors={['#FF6B6B', '#ee5a5a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateButtonGradient}>
              <Ionicons name="sparkles" size={18} color="#ffffff" />
              <Text style={styles.generateButtonText}>Generate Timeline</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingTitle}>Generating Timeline...</Text>
        <Text style={styles.loadingSubtitle}>AI is creating a detailed day-by-day plan with timings and coordinates</Text>
      </View>
    );
  }

  if (days.length === 0) {
    return (
      <View style={styles.generateContainer}>
        <Text style={styles.emptyText}>No structured data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Day Selector Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelector} style={styles.daySelectorScroll}>
        {days.map((day, index) => (
          <TouchableOpacity
            key={`day-pill-${index}`}
            style={[styles.dayPill, selectedDay === index && styles.dayPillActive]}
            onPress={() => setSelectedDay(index)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayPillText, selectedDay === index && styles.dayPillTextActive]}>
              Day {day.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Day Header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderTitle}>{currentDay?.title || `Day ${currentDay?.dayNumber}`}</Text>
          <View style={styles.dayStats}>
            <View style={styles.statChip}>
              <Ionicons name="location-outline" size={13} color="#3B82F6" />
              <Text style={styles.statChipText}>{totalStops} stops</Text>
            </View>
            {currentDay?.theme && (
              <View style={styles.statChip}>
                <Ionicons name="color-palette-outline" size={13} color="#8B5CF6" />
                <Text style={styles.statChipText}>{currentDay.theme}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {currentPlaces.map((place, index) => {
            const color = TIMELINE_COLORS[index % TIMELINE_COLORS.length];
            const isLast = index === currentPlaces.length - 1;
            const isMealBreak = index === 2 || index === 6;
            const existingImg = extractPlaceImage(place);
            const cost = place.entryFee || place.estimatedCost;

            return (
              <View key={`place-${selectedDay}-${index}`}>
                {/* Meal break */}
                {isMealBreak && (
                  <View style={styles.mealBreak}>
                    <View style={styles.mealBreakLine} />
                    <View style={styles.mealBreakBadge}>
                      <Text style={styles.mealBreakEmoji}>{index === 2 ? '\uD83C\uDF5C' : '\uD83C\uDF7D\uFE0F'}</Text>
                      <Text style={styles.mealBreakText}>{index === 2 ? 'Lunch Break' : 'Dinner Break'}</Text>
                    </View>
                    <View style={styles.mealBreakLine} />
                  </View>
                )}

                <View style={styles.timelineItem}>
                  {/* Timeline dot + line */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: color }]}>
                      <Text style={styles.timelineDotText}>{index + 1}</Text>
                    </View>
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: color + '30' }]} />}
                  </View>

                  {/* Horizontal Card */}
                  {(() => {
                    const cardKey = `${selectedDay}-${index}`;
                    const isExpanded = !!expandedCards[cardKey];
                    const hasExtra = !!((place.description && place.description.length > 40) || (place.tips && place.tips.length > 0) || (place.tags && place.tags.length > 0) || place.openingHours);

                    return (
                      <View style={[styles.placeCard, shadow.sm]}>
                        <TouchableOpacity style={styles.cardTopRow} activeOpacity={0.75} onPress={() => handlePlacePress(place)}>
                          {/* Image */}
                          <PlaceImageWithCallback
                            placeName={place.name}
                            destination={destination}
                            existingImage={existingImg}
                            onResolved={onImageResolved}
                          />

                          {/* All content beside image */}
                          <View style={styles.cardContent}>
                            {place.time && (
                              <View style={[styles.timeBadge, { backgroundColor: color + '12' }]}>
                                <Ionicons name="time-outline" size={10} color={color} />
                                <Text style={[styles.timeBadgeText, { color }]}>{place.time}</Text>
                              </View>
                            )}
                            <View style={styles.nameRow}>
                              <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.gray[400]} />
                            </View>
                            {place.description && (
                              <Text style={styles.placeDesc} numberOfLines={isExpanded ? undefined : 1}>{place.description}</Text>
                            )}
                            <View style={styles.badgeRow}>
                              {place.visitDuration && (
                                <View style={[styles.infoBadge, { backgroundColor: '#EFF6FF' }]}>
                                  <Ionicons name="hourglass-outline" size={10} color="#3B82F6" />
                                  <Text style={[styles.infoBadgeText, { color: '#3B82F6' }]}>{place.visitDuration}</Text>
                                </View>
                              )}
                              {cost && (
                                <View style={[styles.infoBadge, { backgroundColor: '#FEF3C7' }]}>
                                  <Ionicons name="cash-outline" size={10} color="#D97706" />
                                  <Text style={[styles.infoBadgeText, { color: '#D97706' }]}>{cost}</Text>
                                </View>
                              )}
                            </View>

                            {/* Expanded extras — inline within card content */}
                            {isExpanded && (
                              <>
                                {place.openingHours && (
                                  <View style={styles.expandedRow}>
                                    <Ionicons name="time-outline" size={11} color="#DB2777" />
                                    <Text style={styles.expandedValue}>{place.openingHours}</Text>
                                  </View>
                                )}
                                {place.tags && place.tags.length > 0 && (
                                  <View style={styles.tagRow}>
                                    {place.tags.slice(0, 4).map((tag, tIdx) => (
                                      <View key={`tag-${tIdx}`} style={styles.tag}>
                                        <Text style={styles.tagText}>{tag}</Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                                {place.tips && place.tips.map((tip, tIdx) => (
                                  <View key={`tip-${tIdx}`} style={styles.tipRow}>
                                    <Ionicons name="bulb-outline" size={11} color="#F59E0B" />
                                    <Text style={styles.tipText}>{tip}</Text>
                                  </View>
                                ))}
                              </>
                            )}

                            {/* Expand/collapse toggle inline */}
                            {hasExtra && (
                              <TouchableOpacity style={styles.expandToggle} onPress={(e) => { e.stopPropagation?.(); toggleExpand(cardKey); }} activeOpacity={0.7}>
                                <Text style={styles.expandToggleText}>{isExpanded ? 'Show less' : 'More'}</Text>
                                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#FF6B6B" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </View>
              </View>
            );
          })}
        </View>

        {/* Day Navigation */}
        <View style={styles.dayNavigation}>
          <TouchableOpacity
            style={[styles.navButton, selectedDay === 0 && styles.navButtonDisabled]}
            onPress={handlePrevDay}
            disabled={selectedDay === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color={selectedDay === 0 ? colors.gray[300] : '#FF6B6B'} />
            <Text style={[styles.navButtonText, selectedDay === 0 && styles.navButtonTextDisabled]}>Previous Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, selectedDay === days.length - 1 && styles.navButtonDisabled]}
            onPress={handleNextDay}
            disabled={selectedDay === days.length - 1}
            activeOpacity={0.7}
          >
            <Text style={[styles.navButtonText, selectedDay === days.length - 1 && styles.navButtonTextDisabled]}>Next Day</Text>
            <Ionicons name="chevron-forward" size={16} color={selectedDay === days.length - 1 ? colors.gray[300] : '#FF6B6B'} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Map FAB */}
      <TouchableOpacity style={[styles.mapFab, shadow.lg]} onPress={() => setShowMap(true)} activeOpacity={0.85}>
        <LinearGradient colors={['#FF6B6B', '#ee5a5a']} style={styles.mapFabGradient}>
          <Ionicons name="map" size={22} color="#ffffff" />
        </LinearGradient>
      </TouchableOpacity>

      <ItineraryMap
        places={currentPlaces}
        visible={showMap}
        onClose={() => setShowMap(false)}
        dayTitle={`Day ${currentDay?.dayNumber}: ${currentDay?.title || destination}`}
      />
    </View>
  );
};

// PlaceImage wrapper that reports resolved URL back to parent
const PlaceImageWithCallback: React.FC<{
  placeName: string;
  destination: string;
  existingImage: string | null;
  onResolved: (name: string, url: string) => void;
}> = React.memo(({ placeName, destination, existingImage, onResolved }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(existingImage);
  const [loading, setLoading] = useState(!existingImage);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (existingImage) {
      setImageUrl(existingImage);
      setLoading(false);
      onResolved(placeName, existingImage);
      return;
    }

    let cancelled = false;
    const fetchImage = async () => {
      try {
        const res = await makeAPICall('/destinations/place-images', {
          method: 'POST',
          body: JSON.stringify({ placeName, location: destination, count: 1 }),
          timeout: 20000,
        });
        if (cancelled) return;

        const data = res?.data || res;
        const imgArr = Array.isArray(data) ? data : [];
        if (imgArr.length > 0) {
          const imgData = imgArr[0];
          const rawUrl = typeof imgData === 'string'
            ? imgData
            : imgData?.url || imgData?.mediumUrl || imgData?.smallUrl || imgData?.s3Url || imgData?.imageUrl || imgData?.originalUrl || null;
          if (rawUrl) {
            const resolved = resolveImageUrl(rawUrl) || rawUrl;
            setImageUrl(resolved);
            onResolved(placeName, resolved);
          }
        }
      } catch (err: any) {
        console.warn('[Timeline] Image error:', placeName, err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchImage();
    return () => { cancelled = true; };
  }, [placeName, destination, existingImage]);

  if (loading) {
    return (
      <View style={[styles.cardImage, imgStyles.placeholder]}>
        <ActivityIndicator size="small" color={colors.gray[300]} />
      </View>
    );
  }

  if (imageUrl && !error) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.cardImage}
        resizeMode="cover"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.cardImage, imgStyles.placeholder]}>
      <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.5)" />
    </LinearGradient>
  );
});

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Day Selector
  daySelectorScroll: { maxHeight: 52, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  daySelector: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  dayPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.gray[100] },
  dayPillActive: { backgroundColor: '#FF6B6B' },
  dayPillText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  dayPillTextActive: { color: '#ffffff', fontWeight: fontWeight.semibold },

  scrollContent: { paddingTop: spacing.lg },

  // Day Header
  dayHeader: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  dayHeaderTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  dayStats: { flexDirection: 'row', gap: 8 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.gray[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statChipText: { fontSize: 11, fontWeight: fontWeight.medium, color: colors.textSecondary },

  // Timeline
  timeline: { paddingHorizontal: spacing.md },
  timelineItem: { flexDirection: 'row', minHeight: 90 },
  timelineLeft: { alignItems: 'center', width: 30, marginRight: 8 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineDotText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#ffffff' },
  timelineLine: { width: 2, flex: 1, marginTop: -2 },

  // Card
  placeCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cardImage: {
    width: 85,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // Time badge
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 3 },
  timeBadgeText: { fontSize: 10, fontWeight: fontWeight.semibold },

  // Name
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  placeName: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.text, flex: 1 },

  // Description
  placeDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 15, marginBottom: 4 },

  // Info badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  infoBadgeText: { fontSize: 9, fontWeight: fontWeight.semibold },

  // Tags
  tagRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  tag: { backgroundColor: '#FFF7ED', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  tagText: { fontSize: 9, color: '#EA580C', fontWeight: fontWeight.medium },

  // Expanded inline
  expandedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  expandedValue: { fontSize: 10, color: colors.text, flex: 1 },

  // Expand toggle (inline)
  expandToggle: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  expandToggleText: { fontSize: 10, fontWeight: fontWeight.semibold, color: '#FF6B6B' },

  // Tips
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tipText: { fontSize: 10, color: '#92400E', flex: 1, lineHeight: 14 },

  // Meal break
  mealBreak: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, paddingLeft: 38 },
  mealBreakLine: { flex: 1, height: 1, backgroundColor: colors.gray[200] },
  mealBreakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#FFF7ED', borderRadius: 999, marginHorizontal: spacing.sm },
  mealBreakEmoji: { fontSize: 14 },
  mealBreakText: { fontSize: 11, color: '#EA580C', fontWeight: fontWeight.medium },

  // Day Navigation
  dayNavigation: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  navButtonDisabled: { opacity: 0.5 },
  navButtonText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#FF6B6B' },
  navButtonTextDisabled: { color: colors.gray[300] },

  // Map FAB
  mapFab: { position: 'absolute', bottom: 24, right: 20, borderRadius: 28, overflow: 'hidden' },
  mapFabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  // Generate
  generateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  generateContent: { alignItems: 'center' },
  generateIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  generateTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  generateSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing['2xl'] },
  generateButton: { borderRadius: borderRadius.xl, overflow: 'hidden' },
  generateButtonGradient: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing['2xl'] },
  generateButtonText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#ffffff' },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  loadingTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  loadingSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
});

export default StructuredTimelineView;
