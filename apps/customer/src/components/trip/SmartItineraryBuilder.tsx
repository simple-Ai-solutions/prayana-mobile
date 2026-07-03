import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import BottomModal, { BottomModalRef, BottomModalScrollView } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { useCreateTripStore } from '@prayana/shared-stores';
import ActivityImage from './ActivityImage';

type TimeSlotKey = 'morning' | 'afternoon' | 'evening' | 'night';

interface GeneratedActivity {
  name: string;
  description: string;
  timeSlot: TimeSlotKey;
  duration: number;
  rating: number;
  category: string;
  why?: string;
  suggestedTime?: string;
  image?: string;
  images?: any[];
  imageUrls?: string[];
}

interface SmartItineraryBuilderProps {
  sheetRef: React.RefObject<BottomModalRef | null>;
  dayIndex: number;
  destinationName: string;
  tripType: string;
  budget: string;
  existingActivities: { name: string; [key: string]: any }[];
}

const TIME_SLOT_COLORS: Record<TimeSlotKey, { color: string; bg: string; label: string; emoji: string }> = {
  morning: { color: '#f59e0b', bg: '#fffbeb', label: 'Morning', emoji: '\u2600\uFE0F' },
  afternoon: { color: '#3b82f6', bg: '#eff6ff', label: 'Afternoon', emoji: '\u2601\uFE0F' },
  evening: { color: '#8b5cf6', bg: '#f5f3ff', label: 'Evening', emoji: '\uD83C\uDF19' },
  night: { color: '#1e3a5f', bg: '#f0f4f8', label: 'Night', emoji: '\u2B50' },
};

const SmartItineraryBuilder: React.FC<SmartItineraryBuilderProps> = ({
  sheetRef,
  dayIndex,
  destinationName,
  tripType,
  budget,
  existingActivities,
}) => {
  const addActivity = useCreateTripStore((s) => s.addActivity);
  const removeActivity = useCreateTripStore((s) => s.removeActivity);
  const days = useCreateTripStore((s) => s.days);

  const [suggestions, setSuggestions] = useState<GeneratedActivity[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<'idle' | 'stage1' | 'stage2'>('idle');
  const [error, setError] = useState('');
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ totalPlaces: number; avgRating: number } | null>(null);
  const hasAutoTriggered = useRef(false);

  // Get activities from all previous days to avoid duplicates
  const previousDaysActivities = days
    .slice(0, dayIndex)
    .flatMap((d: any) => (d.activities || []).map((a: any) => a.name));

  const handleGenerate = useCallback(async () => {
    if (!destinationName) return;

    setIsGenerating(true);
    setError('');
    setSuggestions([]);
    setAddedNames(new Set());
    setStats(null);
    setGenerationStage('stage1');

    try {
      const dayNum = dayIndex + 1;
      const alreadyVisited = previousDaysActivities.length > 0
        ? `\nSTRICTLY AVOID (already visited on previous days):\n${previousDaysActivities.map((n: string) => `- ${n}`).join('\n')}\n`
        : '';
      const currentPlanned = existingActivities.map(a => a.name).join(', ') || 'none';

      // Day context strategy (matching PWA)
      const dayContext = dayNum === 1
        ? 'Focus on iconic must-see landmarks close to each other (ideal for Day 1 orientation).'
        : dayNum === 2
        ? `Focus on different neighborhoods, day trips, and experiences NOT covered on Day 1.`
        : `Focus on hidden gems, local markets, off-the-beaten-path spots, and authentic local experiences for Day ${dayNum}.`;

      // ─── STAGE 1: AI suggests 15-20 places (high creativity) ───
      const stage1Prompt = `You are a local travel expert who has lived in ${destinationName} for years.

Suggest 15-20 UNIQUE places to visit in ${destinationName} for Day ${dayNum} of a ${tripType || 'leisure'} trip.
Budget level: ${budget}.

${dayContext}
${alreadyVisited}
Currently planned for this day (exclude these too): ${currentPlanned}

Include a mix of:
- Famous landmarks and monuments
- Temples and religious sites
- Viewpoints and scenic spots
- Restaurants and cafes
- Markets and shopping areas
- Museums and cultural sites
- Nature spots and parks
- Local experiences

RULES:
- Use EXACT real place names as they are known locally in ${destinationName}
- All suggested places must actually exist in ${destinationName}
- For category use ONLY one of: temple, museum, restaurant, cafe, beach, park, monument, market, viewpoint, adventure, cultural, shopping, nightlife, wellness
- For rating, estimate popularity (3.5-4.9 range)

Return ONLY a JSON array (no explanation, no markdown):
[{"name": "Place Name", "category": "monument", "rating": 4.5, "description": "One-line description"}, ...]`;

      const [stage1Response, dbResult] = await Promise.all([
        makeAPICall('/ai/generate', {
          method: 'POST',
          body: JSON.stringify({ prompt: stage1Prompt, temperature: 0.8 }),
          timeout: 60000,
        }),
        makeAPICall('/destinations/hierarchical-search', {
          method: 'POST',
          body: JSON.stringify({ query: destinationName, filters: { limit: 50 }, includeImages: true }),
          timeout: 25000,
        }).catch(() => null),
      ]);

      // Parse Stage 1 AI response
      let aiSuggestedPlaces: any[] = [];
      if (stage1Response?.success && stage1Response?.data) {
        const data = stage1Response.data;
        let text = '';
        if (typeof data === 'string') text = data;
        else if (data?.text) text = data.text;
        else if (Array.isArray(data)) aiSuggestedPlaces = data;

        if (text) {
          const jsonMatch = text.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              aiSuggestedPlaces = parsed.map((item: any) =>
                typeof item === 'string' ? { name: item } : item
              );
            } catch {}
          }
        }
      }

      // Filter out previous days' activities
      const previousLower = previousDaysActivities.map((n: string) => n.toLowerCase());
      const currentLower = existingActivities.map(a => a.name.toLowerCase());
      aiSuggestedPlaces = aiSuggestedPlaces.filter((item: any) => {
        const nameLower = (item.name || '').toLowerCase();
        return !previousLower.some((prev: string) => prev === nameLower || prev.includes(nameLower) || nameLower.includes(prev))
          && !currentLower.some(cur => cur === nameLower || cur.includes(nameLower) || nameLower.includes(cur));
      });

      if (aiSuggestedPlaces.length === 0) {
        throw new Error('AI did not suggest any places. Please try again.');
      }

      // Extract DB places for enrichment
      let dbPlaces: any[] = [];
      if (dbResult?.success) {
        if (Array.isArray(dbResult.data)) dbPlaces = dbResult.data;
        else if (dbResult.data?.results) dbPlaces = dbResult.data.results;
        else if (dbResult.data?.hero || dbResult.data?.places) {
          if (dbResult.data.hero) dbPlaces.push(dbResult.data.hero);
          if (Array.isArray(dbResult.data.places)) dbPlaces.push(...dbResult.data.places);
          for (const key of Object.keys(dbResult.data)) {
            if (Array.isArray(dbResult.data[key]) && key !== 'places' && dbResult.data[key][0]?.name) {
              dbPlaces.push(...dbResult.data[key]);
            }
          }
        }
      }

      // Enrich AI suggestions with DB data (images, coords, descriptions)
      const enrichedPlaces = aiSuggestedPlaces.map((suggested: any) => {
        const match = dbPlaces.find((p: any) =>
          p.name?.toLowerCase() === suggested.name?.toLowerCase() ||
          p.name?.toLowerCase().includes(suggested.name?.toLowerCase()) ||
          suggested.name?.toLowerCase().includes(p.name?.toLowerCase())
        );

        if (match) {
          return {
            ...match,
            aiCategory: suggested.category,
            aiRating: suggested.rating,
            aiDescription: suggested.description,
          };
        }
        return {
          name: suggested.name,
          description: suggested.description || `A popular spot in ${destinationName}`,
          category: suggested.category || 'other',
          rating: suggested.rating || 4.0,
          coordinates: null,
          images: [],
          imageUrls: [],
          source: 'ai_suggested',
        };
      });

      // ─── STAGE 2: AI curates 7-9 best places with time assignments ───
      setGenerationStage('stage2');

      // Day-specific themes
      let dayTheme = '';
      let dayFocus = '';
      if (dayNum === 1) {
        dayTheme = 'Arrival & Orientation';
        dayFocus = `Day 1 Strategy:
- START with the most iconic landmark
- Choose places close together (max 2km radius)
- Include a welcome lunch at a well-known local restaurant
- End with a scenic evening spot`;
      } else if (dayNum === 2) {
        dayTheme = 'Deep Exploration';
        dayFocus = `Day 2 Strategy:
- Explore more distant attractions
- Include a must-do experience unique to ${destinationName}
- Cover different categories than Day 1
- Try a different restaurant area`;
      } else {
        dayTheme = `Hidden Gems & Local Life (Day ${dayNum})`;
        dayFocus = `Day ${dayNum} Strategy:
- Focus on authentic local experiences
- Include local markets and craft workshops
- Try street food and local eateries
- Nature escapes or relaxed activities`;
      }

      const topPlaces = enrichedPlaces
        .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 25);

      const stage2Prompt = `You are a seasoned travel expert who has lived in ${destinationName} for years.

YOUR MISSION: Create the PERFECT Day ${dayNum} itinerary for a ${tripType || 'leisure'} traveler.
THEME: ${dayTheme}

${dayFocus}

AVAILABLE PLACES (choose from these ONLY - use exact names):
${topPlaces.map((p: any) => `- "${p.name}" (${p.category || 'attraction'}, rating: ${p.rating || 'N/A'})`).join('\n')}

RULES:
1. Select 7-9 total places (2-3 morning, 2-3 afternoon, 2-3 evening)
2. Use EXACT place names from the list above
3. NEVER repeat the same place across time slots
4. Choose times that make real-world sense
5. Include a restaurant/cafe in afternoon or evening
6. Each "why" must be specific to ${destinationName}

Return ONLY this JSON:
{
  "morning": [{"name": "EXACT name", "suggestedTime": "6:30 AM - 8:30 AM", "duration": "2 hours", "why": "Reason for morning visit"}],
  "afternoon": [{"name": "EXACT name", "suggestedTime": "12:00 PM - 1:30 PM", "duration": "1.5 hours", "why": "Reason for afternoon"}],
  "evening": [{"name": "EXACT name", "suggestedTime": "5:30 PM - 7:30 PM", "duration": "2 hours", "why": "Reason for evening"}]
}`;

      const stage2Response = await makeAPICall('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: stage2Prompt, temperature: 0.7 }),
        timeout: 60000,
      });

      // Parse Stage 2 response
      let itinerary: Record<string, any[]> = { morning: [], afternoon: [], evening: [] };

      if (stage2Response?.success && stage2Response?.data) {
        const data = stage2Response.data;
        let text = '';
        if (typeof data === 'string') text = data;
        else if (data?.text) text = data.text;

        if (text) {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              const usedNames = new Set<string>();

              for (const slot of ['morning', 'afternoon', 'evening']) {
                if (Array.isArray(parsed[slot])) {
                  parsed[slot].forEach((item: any) => {
                    const placeName = typeof item === 'string' ? item : item.name;
                    if (!placeName) return;
                    const placeKey = placeName.toLowerCase();

                    // Prevent duplicates across slots
                    if (usedNames.has(placeKey)) return;

                    const matchedPlace = enrichedPlaces.find((p: any) =>
                      p.name?.toLowerCase() === placeKey ||
                      p.name?.toLowerCase().includes(placeKey) ||
                      placeKey.includes(p.name?.toLowerCase())
                    );

                    if (matchedPlace) {
                      usedNames.add(placeKey);
                      itinerary[slot].push({
                        ...matchedPlace,
                        suggestedTime: item.suggestedTime || '',
                        aiDuration: item.duration || '',
                        aiReason: item.why || '',
                      });
                    }
                  });
                }
              }
            } catch {}
          }
        }
      }

      // Build final suggestions list
      const finalSuggestions: GeneratedActivity[] = [];
      let totalRating = 0;
      let ratedCount = 0;

      for (const slot of ['morning', 'afternoon', 'evening'] as const) {
        const items = itinerary[slot] || [];
        items.forEach((item: any) => {
          const imageUrl = item.image || item.imageUrls?.[0] ||
            (item.images?.[0]?.url || (typeof item.images?.[0] === 'string' ? item.images?.[0] : ''));
          const rating = Number(item.rating || item.aiRating) || 4.0;
          if (rating) { totalRating += rating; ratedCount++; }

          finalSuggestions.push({
            name: item.name,
            description: item.aiDescription || item.description || item.shortDescription || '',
            timeSlot: slot as TimeSlotKey,
            duration: parseFloat(item.aiDuration) || Number(item.duration) || 2,
            rating,
            category: item.aiCategory || item.category || 'general',
            why: item.aiReason || '',
            suggestedTime: item.suggestedTime || '',
            image: imageUrl,
            images: item.images || [],
            imageUrls: item.imageUrls || (imageUrl ? [imageUrl] : []),
          });
        });
      }

      if (finalSuggestions.length === 0) {
        throw new Error('AI could not curate an itinerary. Please try again.');
      }

      setStats({
        totalPlaces: finalSuggestions.length,
        avgRating: ratedCount > 0 ? totalRating / ratedCount : 0,
      });
      setSuggestions(finalSuggestions);
    } catch (err: any) {
      console.error('[SmartBuilder] Generation failed:', err);
      setError(
        err?.message?.includes('timeout')
          ? 'Request timed out. Please try again.'
          : err?.message || 'Could not generate itinerary. Please try again.'
      );
    } finally {
      setIsGenerating(false);
      setGenerationStage('idle');
    }
  }, [dayIndex, destinationName, tripType, budget, existingActivities, previousDaysActivities]);

  const handleAddSingle = useCallback(
    (suggestion: GeneratedActivity) => {
      addActivity(dayIndex, {
        name: suggestion.name,
        description: suggestion.description,
        timeSlot: suggestion.timeSlot,
        startTime: suggestion.suggestedTime || '',
        duration: suggestion.duration,
        rating: suggestion.rating,
        category: suggestion.category,
        coordinates: { lat: 0, lng: 0 },
        image: suggestion.image || '',
        images: suggestion.images || [],
        imageUrls: suggestion.imageUrls || [],
        notes: suggestion.why || '',
        source: 'ai_suggested',
      });
      setAddedNames((prev) => new Set(prev).add(suggestion.name));
    },
    [dayIndex, addActivity]
  );

  const handleAcceptAll = useCallback(() => {
    // Remove all existing activities for this day first
    const currentActivities = days[dayIndex]?.activities || [];
    for (let i = currentActivities.length - 1; i >= 0; i--) {
      removeActivity(dayIndex, i);
    }

    // Add all suggestions
    for (const suggestion of suggestions) {
      addActivity(dayIndex, {
        name: suggestion.name,
        description: suggestion.description,
        timeSlot: suggestion.timeSlot,
        startTime: suggestion.suggestedTime || '',
        duration: suggestion.duration,
        rating: suggestion.rating,
        category: suggestion.category,
        coordinates: { lat: 0, lng: 0 },
        image: suggestion.image || '',
        images: suggestion.images || [],
        imageUrls: suggestion.imageUrls || [],
        notes: suggestion.why || '',
        source: 'ai_suggested',
      });
    }

    setAddedNames(new Set(suggestions.map((s) => s.name)));
    sheetRef.current?.close();
  }, [dayIndex, suggestions, addActivity, removeActivity, days, sheetRef]);

  // Auto-trigger generation when sheet opens
  const handleSheetChange = useCallback((index: number) => {
    if (index >= 0 && suggestions.length === 0 && !isGenerating && !error && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      handleGenerate();
    }
    if (index < 0) {
      hasAutoTriggered.current = false;
    }
  }, [suggestions.length, isGenerating, error, handleGenerate]);

  // Group suggestions by time slot
  const grouped = suggestions.reduce<Record<TimeSlotKey, GeneratedActivity[]>>(
    (acc, s) => {
      if (!acc[s.timeSlot]) acc[s.timeSlot] = [];
      acc[s.timeSlot].push(s);
      return acc;
    },
    { morning: [], afternoon: [], evening: [], night: [] }
  );

  return (
    <BottomModal ref={sheetRef} maxHeightPercent={0.92} fillHeight onChange={handleSheetChange}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={20} color="#a855f7" />
          <Text style={styles.headerTitle}>AI-Powered Itinerary</Text>
        </View>
        <TouchableOpacity
          onPress={() => sheetRef.current?.close()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.destBadge}>
        <Ionicons name="location" size={14} color={colors.primary[600]} />
        <Text style={styles.destBadgeText}>
          Day {dayIndex + 1} - {destinationName}
        </Text>
      </View>

      {/* Stats Cards (PWA-matching) */}
      {stats && suggestions.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="location" size={14} color="#a855f7" />
            <Text style={styles.statValue}>{stats.totalPlaces}</Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.statValue}>{stats.avgRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={14} color="#3b82f6" />
            <Text style={styles.statValue}>{Object.keys(grouped).filter(k => grouped[k as TimeSlotKey].length > 0).length}</Text>
            <Text style={styles.statLabel}>Slots</Text>
          </View>
        </View>
      )}

      {suggestions.length === 0 && !isGenerating && !error && (
        <View style={styles.ctaContainer}>
          <Text style={styles.ctaText}>
            AI will generate a complete day itinerary for {destinationName} using a two-stage process:{'\n\n'}
            1. Discover 15-20 best places{'\n'}
            2. Curate the perfect 7-9 for your day
          </Text>
          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={18} color="#ffffff" />
            <Text style={styles.generateBtnText}>Generate Full Day</Text>
          </TouchableOpacity>
        </View>
      )}

      {isGenerating && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingTitle}>
            {generationStage === 'stage1'
              ? 'Discovering best places...'
              : 'Curating your perfect day...'}
          </Text>
          <Text style={styles.loadingSubtext}>
            {generationStage === 'stage1'
              ? `Finding 15-20 top attractions in ${destinationName}`
              : `Selecting 7-9 best places with optimal timing`}
          </Text>
          {/* Stage indicator */}
          <View style={styles.stageIndicator}>
            <View style={[styles.stageDot, styles.stageDotActive]} />
            <View style={[styles.stageLine, generationStage === 'stage2' && styles.stageLineActive]} />
            <View style={[styles.stageDot, generationStage === 'stage2' && styles.stageDotActive]} />
          </View>
          <View style={styles.stageLabels}>
            <Text style={[styles.stageLabel, styles.stageLabelActive]}>Discover</Text>
            <Text style={[styles.stageLabel, generationStage === 'stage2' && styles.stageLabelActive]}>Curate</Text>
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={24} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleGenerate}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {suggestions.length > 0 && (
        <View style={{ flex: 1 }}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.acceptAllBtn} onPress={handleAcceptAll} activeOpacity={0.8}>
              <Ionicons name="checkmark-done" size={16} color="#ffffff" />
              <Text style={styles.acceptAllText}>Accept All ({suggestions.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.regenerateBtn} onPress={handleGenerate} activeOpacity={0.7}>
              <Ionicons name="refresh" size={16} color={colors.primary[500]} />
              <Text style={styles.regenerateText}>Regenerate</Text>
            </TouchableOpacity>
          </View>

          <BottomModalScrollView contentContainerStyle={[styles.suggestionsContent, { flexGrow: 1 }]}>
            {(['morning', 'afternoon', 'evening', 'night'] as TimeSlotKey[]).map((slot) => {
              const items = grouped[slot];
              if (items.length === 0) return null;
              const slotConfig = TIME_SLOT_COLORS[slot];

              return (
                <View key={slot} style={styles.slotSection}>
                  <View style={[styles.slotHeader, { backgroundColor: slotConfig.bg }]}>
                    <Text style={styles.slotEmoji}>{slotConfig.emoji}</Text>
                    <Text style={[styles.slotLabel, { color: slotConfig.color }]}>
                      {slotConfig.label}
                    </Text>
                    <View style={[styles.slotCount, { backgroundColor: slotConfig.color }]}>
                      <Text style={styles.slotCountText}>{items.length}</Text>
                    </View>
                  </View>

                  {items.map((item, idx) => {
                    const isAdded = addedNames.has(item.name);
                    return (
                      <View key={`${item.name}-${idx}`} style={styles.suggestionCard}>
                        {/* Number badge */}
                        <View style={[styles.numberBadge, { backgroundColor: slotConfig.color }]}>
                          <Text style={styles.numberBadgeText}>
                            {suggestions.indexOf(item) + 1}
                          </Text>
                        </View>

                        <ActivityImage
                          activity={item}
                          destinationName={destinationName}
                          size={50}
                          borderRadius={10}
                          fallbackColor={slotConfig.bg}
                          fallbackIconColor={slotConfig.color}
                        />
                        <View style={styles.suggestionContent}>
                          <Text style={styles.suggestionName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {/* Suggested time (PWA feature) */}
                          {item.suggestedTime ? (
                            <View style={styles.suggestedTimeRow}>
                              <Ionicons name="time-outline" size={9} color="#3b82f6" />
                              <Text style={styles.suggestedTimeText}>{item.suggestedTime}</Text>
                            </View>
                          ) : null}
                          {item.description ? (
                            <Text style={styles.suggestionDesc} numberOfLines={2}>
                              {item.description}
                            </Text>
                          ) : null}
                          <View style={styles.suggestionMeta}>
                            <Text style={styles.suggestionMetaItem}>{item.duration}h</Text>
                            <Text style={styles.suggestionMetaItem}>
                              {'\u2605'} {item.rating.toFixed(1)}
                            </Text>
                            {item.category ? (
                              <View style={[styles.categoryPill, { backgroundColor: slotConfig.bg }]}>
                                <Text style={[styles.categoryPillText, { color: slotConfig.color }]}>
                                  {item.category}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {item.why ? (
                            <Text style={styles.suggestionWhy} numberOfLines={1}>
                              {'\uD83D\uDCA1'} {item.why}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={[styles.addBtn, isAdded && styles.addBtnAdded]}
                          onPress={() => !isAdded && handleAddSingle(item)}
                          disabled={isAdded}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isAdded ? 'checkmark' : 'add'}
                            size={18}
                            color={isAdded ? colors.success : '#ffffff'}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })}
            <Text style={styles.footer}>Powered by Gemini AI - Two-stage curation</Text>
            <View style={{ height: 40 }} />
          </BottomModalScrollView>
        </View>
      )}
    </BottomModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  destBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
  },
  destBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },

  // Stats Row (PWA-matching)
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textTertiary,
  },

  ctaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  ctaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    ...shadow.md,
  },
  generateBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  loadingSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Stage Progress Indicator
  stageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginTop: spacing.lg,
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray[300],
  },
  stageDotActive: {
    backgroundColor: colors.primary[500],
  },
  stageLine: {
    width: 60,
    height: 2,
    backgroundColor: colors.gray[200],
  },
  stageLineActive: {
    backgroundColor: colors.primary[500],
  },
  stageLabels: {
    flexDirection: 'row',
    gap: 48,
    marginTop: spacing.xs,
  },
  stageLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  stageLabelActive: {
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing['2xl'],
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  retryBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  acceptAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    ...shadow.sm,
  },
  acceptAllText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  regenerateText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },
  suggestionsContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  slotSection: {
    marginBottom: spacing.lg,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  slotEmoji: {
    fontSize: 16,
  },
  slotLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  slotCount: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    position: 'relative',
  },
  numberBadge: {
    position: 'absolute',
    top: 6,
    left: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  numberBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  suggestedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  suggestedTimeText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: fontWeight.medium,
  },
  suggestionDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  suggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  suggestionMetaItem: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  categoryPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryPillText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  suggestionWhy: {
    fontSize: 10,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 3,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  addBtnAdded: {
    backgroundColor: colors.successLight,
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textTertiary,
    paddingVertical: spacing.md,
  },
});

export default SmartItineraryBuilder;
