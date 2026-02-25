import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { makeAPICall } from '@prayana/shared-services';
import { useImageEnrichment, useCoordinateEnrichment, useCollaboration } from '@prayana/shared-hooks';
import type { BottomModalRef } from '../../components/common/BottomModal';
import ActivityImage from '../../components/trip/ActivityImage';
import DraggableActivityList from '../../components/trip/DraggableActivityList';
import SmartItineraryBuilder from '../../components/trip/SmartItineraryBuilder';
import OptimizeRouteButton from '../../components/trip/OptimizeRouteButton';
import { ItineraryMap } from '../../components/trip/ItineraryMap';
import BudgetTrackerSheet from '../../components/trip/BudgetTrackerSheet';
import WeatherBadge from '../../components/trip/WeatherBadge';
import SOSButton from '../../components/trip/SOSButton';
import CollaboratorAvatars from '../../components/trip/CollaboratorAvatars';
import InviteSheet from '../../components/trip/InviteSheet';
import TripChatSheet from '../../components/trip/TripChatSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ───────────────────────────────────────────────────────────────

type TimeSlotKey = 'morning' | 'afternoon' | 'evening' | 'night';

interface TimeSlotConfig {
  key: TimeSlotKey;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

const TIME_SLOTS: TimeSlotConfig[] = [
  { key: 'morning', label: 'Morning', emoji: '\u2600\uFE0F', color: '#f59e0b', bgColor: '#fffbeb' },
  { key: 'afternoon', label: 'Afternoon', emoji: '\u2601\uFE0F', color: '#3b82f6', bgColor: '#eff6ff' },
  { key: 'evening', label: 'Evening', emoji: '\uD83C\uDF19', color: '#8b5cf6', bgColor: '#f5f3ff' },
  { key: 'night', label: 'Night', emoji: '\u2B50', color: '#1e3a5f', bgColor: '#f0f4f8' },
];

interface Activity {
  activityId?: string;
  name: string;
  description?: string;
  timeSlot: TimeSlotKey;
  duration?: number;
  rating?: number;
  category?: string;
  coordinates?: { lat: number; lng: number };
  image?: string;
  notes?: string;
  order?: number;
}

interface AISuggestion {
  name: string;
  description: string;
  timeSlot: TimeSlotKey;
  duration: number;
  rating: number;
  category: string;
  image?: string;
  images?: any[];
  imageUrls?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(5 - full - half);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DayPlannerScreen() {
  const router = useRouter();

  // Store state
  const days = useCreateTripStore((s) => s.days);
  const destinations = useCreateTripStore((s) => s.destinations);
  const selectedDayIndex = useCreateTripStore((s) => s.selectedDayIndex);
  const tripType = useCreateTripStore((s) => s.tripType);
  const budget = useCreateTripStore((s) => s.budget);
  const tripId = useCreateTripStore((s) => s.tripId);
  const tempTripId = useCreateTripStore((s) => s.tempTripId);

  // Store actions
  const addActivity = useCreateTripStore((s) => s.addActivity);
  const removeActivity = useCreateTripStore((s) => s.removeActivity);
  const updateActivityNotes = useCreateTripStore((s) => s.updateActivityNotes);
  const updateDayNotes = useCreateTripStore((s) => s.updateDayNotes);
  const reorderActivities = useCreateTripStore((s) => s.reorderActivities);
  const setSelectedDayIndex = useCreateTripStore((s) => s.setSelectedDayIndex);
  const setCurrentStep = useCreateTripStore((s) => s.setCurrentStep);
  const getDestinationForDay = useCreateTripStore((s) => s.getDestinationForDay);

  // Collaboration
  const activeTripId = tripId || tempTripId;
  useCollaboration(activeTripId);

  // Local UI state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey>('morning');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AISuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dayNotesText, setDayNotesText] = useState('');
  const [editingActivity, setEditingActivity] = useState<{ index: number; activity: Activity } | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const dayTabsRef = useRef<ScrollView>(null);
  const smartBuilderRef = useRef<BottomModalRef>(null);
  const budgetSheetRef = useRef<BottomModalRef>(null);
  const inviteSheetRef = useRef<BottomModalRef>(null);
  const chatSheetRef = useRef<BottomModalRef>(null);

  // ─── Derived Values ───

  const currentDay = days[selectedDayIndex];
  const currentDestination = currentDay ? getDestinationForDay(selectedDayIndex) : null;
  const currentActivities: Activity[] = currentDay?.activities || [];

  // Auto-enrich activity images for current day
  useImageEnrichment(selectedDayIndex, currentActivities, currentDestination?.name);

  // Auto-enrich missing coordinates for route optimization
  useCoordinateEnrichment(selectedDayIndex, currentActivities, currentDestination?.name);

  const dayDate = useMemo(() => {
    if (!currentDay?.date) return '';
    const d = new Date(currentDay.date);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [currentDay?.date]);

  // ─── Toggle Card Expand ───

  const toggleCardExpand = useCallback((idx: number) => {
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  // ─── Open Add Activity Panel (inline) ───

  const handleOpenAddPanel = useCallback((slot?: TimeSlotKey) => {
    if (slot) setActiveSlot(slot);
    setSearchQuery('');
    setSearchResults([]);
    setShowAddPanel(true);

    // Auto-load popular places from database for this destination
    if (currentDestination?.name) {
      (async () => {
        try {
          setIsSearching(true);
          const dbResponse = await makeAPICall('/destinations/hierarchical-search', {
            method: 'POST',
            body: JSON.stringify({
              query: currentDestination.name,
              filters: { limit: 10 },
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
          } else if (dbResponse.hero) {
            if (dbResponse.hero) places.push(dbResponse.hero);
            if (Array.isArray(dbResponse.places)) places.push(...dbResponse.places);
            for (const key of Object.keys(dbResponse)) {
              if (Array.isArray(dbResponse[key]) && key !== 'places' && dbResponse[key][0]?.name) {
                places.push(...dbResponse[key]);
              }
            }
          }

          if (places.length > 0) {
            setSearchResults(
              places.slice(0, 10).map((item: any) => ({
                name: item.name || item.title || 'Activity',
                description: item.description || item.shortDescription || '',
                timeSlot: (slot || 'morning') as TimeSlotKey,
                duration: item.duration ? parseFloat(item.duration) : 2,
                rating: item.rating || 4.0,
                category: item.category || 'general',
                image: item.image || item.imageUrls?.[0] || item.images?.[0]?.url || '',
                images: item.images || [],
                imageUrls: item.imageUrls || [],
              }))
            );
          }
        } catch {
          // Non-critical — user can manually search
        } finally {
          setIsSearching(false);
        }
      })();
    }
  }, [currentDestination]);

  // ─── Search Activities ───

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !currentDestination) return;

    setIsSearching(true);
    try {
      // Try hierarchical search first (richer DB results with images)
      // Match web format: { query: destinationName, filters: { limit, searchTerm } }
      let results: AISuggestion[] = [];
      try {
        const dbResponse = await makeAPICall('/destinations/hierarchical-search', {
          method: 'POST',
          body: JSON.stringify({
            query: currentDestination.name,
            filters: {
              limit: 10,
              searchTerm: searchQuery.trim(),
            },
          }),
          timeout: 25000,
        });

        // Response can be { success, data: [...] } or raw hierarchical object
        let places: any[] = [];
        if (dbResponse.success && Array.isArray(dbResponse.data)) {
          places = dbResponse.data;
        } else if (dbResponse.data?.results) {
          // Some responses nest under data.results
          places = dbResponse.data.results;
        } else if (Array.isArray(dbResponse.places)) {
          places = dbResponse.places;
        } else if (dbResponse.hero) {
          // Full hierarchical response - extract all places
          const allPlaces = [];
          if (dbResponse.hero) allPlaces.push(dbResponse.hero);
          if (Array.isArray(dbResponse.places)) allPlaces.push(...dbResponse.places);
          // Also check category arrays
          for (const key of Object.keys(dbResponse)) {
            if (Array.isArray(dbResponse[key]) && key !== 'places' && dbResponse[key][0]?.name) {
              allPlaces.push(...dbResponse[key]);
            }
          }
          places = allPlaces;
        }

        // Filter by search term if backend didn't filter
        if (places.length > 0 && searchQuery.trim()) {
          const term = searchQuery.trim().toLowerCase();
          const filtered = places.filter((p: any) =>
            (p.name || '').toLowerCase().includes(term) ||
            (p.description || '').toLowerCase().includes(term) ||
            (p.category || '').toLowerCase().includes(term)
          );
          if (filtered.length > 0) places = filtered;
        }

        if (places.length > 0) {
          results = places.slice(0, 10).map((item: any) => ({
            name: item.name || item.title || 'Activity',
            description: item.description || item.shortDescription || '',
            timeSlot: activeSlot,
            duration: item.duration ? parseFloat(item.duration) : 2,
            rating: item.rating || 4.0,
            category: item.category || 'general',
            image: item.image || item.imageUrls?.[0] || item.images?.[0]?.url || '',
            images: item.images || [],
            imageUrls: item.imageUrls || [],
          }));
        }
      } catch {
        // Hierarchical search not available, will fall back below
      }

      // Fallback: AI-based activity suggestions
      if (results.length === 0) {
        const response = await makeAPICall('/trip-suggestions/activities', {
          method: 'POST',
          body: JSON.stringify({
            destination: currentDestination.name,
            dayNumber: selectedDayIndex + 1,
            timeSlot: activeSlot,
            tripType,
            existingActivities: currentActivities.map((a) => a.name),
            searchQuery: searchQuery.trim(),
          }),
          timeout: 60000,
        });

        if (response.success && Array.isArray(response.data)) {
          results = response.data.map((item: any) => ({
            name: item.name || item.title || 'Activity',
            description: item.description || '',
            timeSlot: activeSlot,
            duration: item.duration || 2,
            rating: item.rating || 4.0,
            category: item.category || 'general',
            image: item.image || '',
          }));
        }
      }

      setSearchResults(results);
    } catch (err) {
      console.error('Activity search failed:', err);
      Alert.alert('Search Failed', 'Could not search for activities. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, currentDestination, selectedDayIndex, activeSlot, tripType, currentActivities]);

  // ─── Add Activity From Search/AI ───

  const handleAddActivity = useCallback(
    (suggestion: AISuggestion) => {
      addActivity(selectedDayIndex, {
        name: suggestion.name,
        description: suggestion.description || '',
        timeSlot: suggestion.timeSlot || activeSlot,
        duration: suggestion.duration || 2,
        rating: suggestion.rating || 4.0,
        category: suggestion.category || 'general',
        coordinates: { lat: 0, lng: 0 },
        image: suggestion.image || '',
        images: suggestion.images || [],
        imageUrls: suggestion.imageUrls || [],
        notes: '',
      });
    },
    [selectedDayIndex, activeSlot, addActivity]
  );

  // ─── Remove Activity ───

  const handleRemoveActivity = useCallback(
    (activityIndex: number) => {
      Alert.alert(
        'Remove Activity',
        'Are you sure you want to remove this activity?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeActivity(selectedDayIndex, activityIndex),
          },
        ]
      );
    },
    [selectedDayIndex, removeActivity]
  );

  // ─── Edit Activity ───

  const handleEditActivity = useCallback(
    (activityIndex: number, activity: Activity) => {
      setEditingActivity({ index: activityIndex, activity });
      setEditNotes(activity.notes || '');
    },
    []
  );

  const handleSaveNotes = useCallback(() => {
    if (editingActivity) {
      updateActivityNotes(selectedDayIndex, editingActivity.index, editNotes);
      setEditingActivity(null);
    }
  }, [editingActivity, editNotes, selectedDayIndex, updateActivityNotes]);

  const handleChangeTimeSlot = useCallback(
    (newSlot: TimeSlotKey) => {
      if (!editingActivity) return;
      const state = useCreateTripStore.getState();
      const newDays = [...state.days];
      const dayActivities = [...(newDays[selectedDayIndex]?.activities || [])];
      if (dayActivities[editingActivity.index]) {
        dayActivities[editingActivity.index] = {
          ...dayActivities[editingActivity.index],
          timeSlot: newSlot,
        };
        newDays[selectedDayIndex] = { ...newDays[selectedDayIndex], activities: dayActivities };
        useCreateTripStore.setState({ days: newDays, hasUnsavedChanges: true });
      }
      setEditingActivity(null);
    },
    [editingActivity, selectedDayIndex]
  );

  // ─── Day Notes Sync ───

  // Sync local day notes text when day changes
  React.useEffect(() => {
    setDayNotesText(currentDay?.notes || '');
  }, [selectedDayIndex, currentDay?.notes]);

  const handleSaveDayNotes = useCallback(() => {
    updateDayNotes(selectedDayIndex, dayNotesText);
  }, [selectedDayIndex, dayNotesText, updateDayNotes]);

  // ─── Schedule Time Helpers ───

  const getTimeForSlot = useCallback((slot: TimeSlotKey, index: number): string => {
    const times: Record<TimeSlotKey, string[]> = {
      morning: ['6:30 AM', '7:30 AM', '8:30 AM', '9:30 AM', '10:30 AM', '11:30 AM'],
      afternoon: ['12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'],
      evening: ['5:30 PM', '6:30 PM', '7:30 PM', '8:30 PM'],
      night: ['9:00 PM', '10:00 PM', '11:00 PM'],
    };
    return times[slot]?.[index] || '';
  }, []);

  // ─── AI Generate Suggestions (PWA-matching: parallel AI + DB with image enrichment) ───

  const handleGenerateAI = useCallback(async () => {
    if (!currentDestination) {
      Alert.alert('No Destination', 'This day has no associated destination.');
      return;
    }

    setIsGeneratingAI(true);
    setAiSuggestions([]);
    setShowAISuggestions(true);

    try {
      const existingNames = currentActivities.map((a) => a.name);
      const dayNum = selectedDayIndex + 1;
      const destName = currentDestination.name;
      const existingNamesStr = existingNames.join(', ') || 'none';

      // PWA-matching comprehensive prompt with destination-specific details
      const aiPrompt = `You are an expert travel guide for ${destName}.

Suggest the BEST places to visit in ${destName} on Day ${dayNum} of a ${tripType || 'leisure'} trip. Budget: ${budget}.

ALREADY PLANNED (skip these): ${existingNamesStr}

Rules:
- Only suggest REAL places that exist in ${destName}
- Use EXACT local names (e.g., "Virupaksha Temple" not "a temple")
- Suggest 3-5 places per time slot
- Mix categories: landmarks, food, nature, culture

Return ONLY valid JSON (no markdown, no explanation, no code blocks):
{"morning":[{"name":"Place Name","description":"Why visit","category":"temple","duration":2,"rating":4.5}],"afternoon":[...],"evening":[...],"night":[...]}`;

      // Parallel fetch: AI suggestions + DB search (like PWA)
      let aiResponse: any = null;
      let dbResult: any = null;

      try {
        [aiResponse, dbResult] = await Promise.all([
          makeAPICall('/ai/generate', {
            method: 'POST',
            body: JSON.stringify({ prompt: aiPrompt, temperature: 0.7 }),
            timeout: 60000,
          }),
          makeAPICall('/destinations/hierarchical-search', {
            method: 'POST',
            body: JSON.stringify({ query: destName, filters: { limit: 50 }, includeImages: true }),
            timeout: 25000,
          }).catch(() => null), // Non-critical - images only
        ]);
      } catch (fetchErr: any) {
        console.error('[AI Suggestions] API call failed:', fetchErr?.message);
        throw fetchErr;
      }

      console.log('[AI Suggestions] aiResponse:', JSON.stringify({
        success: aiResponse?.success,
        hasData: !!aiResponse?.data,
        dataType: typeof aiResponse?.data,
        hasText: !!aiResponse?.data?.text,
        textLength: aiResponse?.data?.text?.length,
      }));

      // Parse AI response
      const validSlots = ['morning', 'afternoon', 'evening', 'night'] as const;
      let aiPlaces: Record<string, any[]> = { morning: [], afternoon: [], evening: [], night: [] };

      if (aiResponse?.success && aiResponse?.data) {
        const data = aiResponse.data;
        let text = '';

        // Extract text from response
        if (typeof data === 'string') {
          text = data;
        } else if (data?.text && typeof data.text === 'string') {
          text = data.text;
        } else if (typeof data === 'object' && !Array.isArray(data)) {
          // Direct object with slot arrays (e.g., { morning: [...], afternoon: [...] })
          for (const slot of validSlots) {
            if (Array.isArray(data[slot])) aiPlaces[slot] = data[slot];
          }
        }

        if (text) {
          console.log('[AI Suggestions] Raw AI text (first 200 chars):', text.substring(0, 200));

          // Strip markdown code blocks if present
          let cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

          // Try extracting JSON object from text
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              let foundSlots = 0;
              for (const slot of validSlots) {
                if (Array.isArray(parsed[slot])) {
                  aiPlaces[slot] = parsed[slot].map((item: any) =>
                    typeof item === 'string' ? { name: item } : item
                  );
                  foundSlots++;
                }
              }
              console.log(`[AI Suggestions] Parsed ${foundSlots} time slots from JSON object`);
            } catch (parseErr: any) {
              console.warn('[AI Suggestions] JSON object parse failed:', parseErr?.message);
              // Fallback: try as array
              const arrMatch = cleanText.match(/\[[\s\S]*?\]/);
              if (arrMatch) {
                try {
                  const arr = JSON.parse(arrMatch[0]);
                  if (Array.isArray(arr)) {
                    arr.forEach((item: any) => {
                      const slot = validSlots.includes(item.timeSlot) ? item.timeSlot : 'morning';
                      aiPlaces[slot].push(item);
                    });
                    console.log(`[AI Suggestions] Parsed ${arr.length} items from array fallback`);
                  }
                } catch {
                  console.warn('[AI Suggestions] Array fallback also failed');
                }
              }
            }
          } else {
            console.warn('[AI Suggestions] No JSON object found in AI response');
          }
        }
      } else {
        console.warn('[AI Suggestions] API returned success=false or no data:', JSON.stringify(aiResponse));
      }

      const totalAiPlaces = validSlots.reduce((sum, s) => sum + aiPlaces[s].length, 0);
      console.log(`[AI Suggestions] Total parsed places: ${totalAiPlaces}`, {
        morning: aiPlaces.morning.length,
        afternoon: aiPlaces.afternoon.length,
        evening: aiPlaces.evening.length,
        night: aiPlaces.night.length,
      });

      // Extract DB places for image enrichment
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

      const existingNamesSet = new Set(existingNames.map(n => n.toLowerCase()));

      // Enrich each slot's suggestions with DB images
      const enrichSlot = (items: any[], slotKey: string): AISuggestion[] => {
        return items
          .filter((item: any) => item.name && !existingNamesSet.has(item.name.toLowerCase()))
          .map((item: any) => {
            // Try to find matching DB entry for images
            const dbMatch = dbPlaces.find((p: any) =>
              p.name?.toLowerCase() === item.name?.toLowerCase() ||
              p.name?.toLowerCase().includes(item.name?.toLowerCase()) ||
              item.name?.toLowerCase().includes(p.name?.toLowerCase())
            );

            const imageUrl = dbMatch?.image || dbMatch?.imageUrls?.[0] ||
              (dbMatch?.images?.[0]?.url || (typeof dbMatch?.images?.[0] === 'string' ? dbMatch?.images?.[0] : ''));

            return {
              name: item.name || 'Activity',
              description: item.description || item.why || dbMatch?.shortDescription || '',
              timeSlot: slotKey as TimeSlotKey,
              duration: Number(item.duration) || 2,
              rating: Number(item.rating) || dbMatch?.rating || 4.0,
              category: item.category || dbMatch?.category || 'general',
              image: imageUrl || '',
              images: dbMatch?.images || [],
              imageUrls: dbMatch?.imageUrls || (imageUrl ? [imageUrl] : []),
            };
          });
      };

      const allSuggestions: AISuggestion[] = [
        ...enrichSlot(aiPlaces.morning, 'morning'),
        ...enrichSlot(aiPlaces.afternoon, 'afternoon'),
        ...enrichSlot(aiPlaces.evening, 'evening'),
        ...enrichSlot(aiPlaces.night, 'night'),
      ];

      console.log(`[AI Suggestions] Final suggestions count: ${allSuggestions.length}`);
      setAiSuggestions(allSuggestions);
    } catch (err: any) {
      console.error('[AI Suggestions] Failed:', err?.message || err);
      Alert.alert(
        'AI Generation Failed',
        err?.message?.includes('timeout') || err?.message?.includes('timed out')
          ? 'The request timed out. Please try again.'
          : `Could not generate suggestions. ${err?.message || 'Please try again.'}`
      );
      setShowAISuggestions(false);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [currentDestination, currentActivities, selectedDayIndex, tripType, budget]);

  // ─── Navigation ───

  const handleNext = useCallback(() => {
    setCurrentStep(4);
    router.push('/trip/review');
  }, [setCurrentStep, router]);

  const handleBack = useCallback(() => {
    setCurrentStep(2);
    router.back();
  }, [setCurrentStep, router]);

  // ─── Day Tab Selection ───

  const handleDaySelect = useCallback(
    (index: number) => {
      setSelectedDayIndex(index);
      setShowAISuggestions(false);
      setAiSuggestions([]);
    },
    [setSelectedDayIndex]
  );

  // ─── Render: Day Tabs ───

  const renderDayTabs = () => (
    <ScrollView
      ref={dayTabsRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dayTabsContent}
      style={styles.dayTabsContainer}
    >
      {days.map((day: any, index: number) => {
        const isSelected = index === selectedDayIndex;
        const actCount = day.activities?.length || 0;
        const dest = getDestinationForDay(index);
        return (
          <TouchableOpacity
            key={index}
            style={[styles.dayTab, isSelected && styles.dayTabSelected]}
            onPress={() => handleDaySelect(index)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayTabLabel, isSelected && styles.dayTabLabelSelected]}>
              Day {day.dayNumber}
            </Text>
            {dest ? (
              <Text
                style={[styles.dayTabDest, isSelected && styles.dayTabDestSelected]}
                numberOfLines={1}
              >
                {dest.name}
              </Text>
            ) : null}
            {actCount > 0 && (
              <View style={[styles.dayTabBadge, isSelected && styles.dayTabBadgeSelected]}>
                <Text style={[styles.dayTabBadgeText, isSelected && styles.dayTabBadgeTextSelected]}>
                  {actCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ─── Render: AI Suggestions Panel ───

  // Group AI suggestions by time slot
  const aiSuggestionsBySlot = useMemo(() => {
    const grouped: Record<TimeSlotKey, AISuggestion[]> = { morning: [], afternoon: [], evening: [], night: [] };
    aiSuggestions.forEach((s) => {
      const slot = (['morning', 'afternoon', 'evening', 'night'].includes(s.timeSlot) ? s.timeSlot : 'morning') as TimeSlotKey;
      grouped[slot].push(s);
    });
    return grouped;
  }, [aiSuggestions]);

  // Track which AI suggestion slots are expanded (show all vs first 3)
  const [aiExpandedSlots, setAiExpandedSlots] = useState<Record<TimeSlotKey, boolean>>({
    morning: false, afternoon: false, evening: false, night: false,
  });

  const AI_SLOT_CONFIG: Record<TimeSlotKey, { timeRange: string }> = {
    morning: { timeRange: '6 AM – 12 PM' },
    afternoon: { timeRange: '12 PM – 6 PM' },
    evening: { timeRange: '6 PM – 10 PM' },
    night: { timeRange: '10 PM – 12 AM' },
  };

  const renderAISuggestions = () => {
    if (!showAISuggestions) return null;

    return (
      <View style={styles.aiPanel}>
        <View style={styles.aiPanelHeader}>
          <View style={styles.aiPanelHeaderLeft}>
            <Ionicons name="sparkles" size={16} color="#06b6d4" />
            <Text style={styles.aiPanelTitle}>AI Suggestions</Text>
          </View>
          <View style={styles.aiPanelHeaderRight}>
            <TouchableOpacity
              onPress={handleGenerateAI}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.aiRefreshBtn}
            >
              <Ionicons name="refresh" size={16} color="#06b6d4" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowAISuggestions(false);
                setAiSuggestions([]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {isGeneratingAI ? (
          <View style={styles.aiLoading}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={styles.aiLoadingText}>Generating smart suggestions...</Text>
            <Text style={styles.aiLoadingSubtext}>
              Analyzing {currentDestination?.name} attractions, ratings & routes
            </Text>
          </View>
        ) : aiSuggestions.length === 0 ? (
          <View style={styles.aiEmpty}>
            <Ionicons name="sparkles-outline" size={24} color={colors.textTertiary} />
            <Text style={styles.aiEmptyText}>No suggestions generated yet</Text>
          </View>
        ) : (
          <ScrollView style={styles.aiSuggestionsList} nestedScrollEnabled>
            {TIME_SLOTS.map((slot) => {
              const items = aiSuggestionsBySlot[slot.key];
              if (items.length === 0) return null;
              const isSlotExpanded = aiExpandedSlots[slot.key];
              const visibleItems = isSlotExpanded ? items : items.slice(0, 3);
              const hiddenCount = items.length - 3;

              return (
                <View key={slot.key} style={styles.aiSlotSection}>
                  {/* Slot Header with time range */}
                  <View style={[styles.aiSlotHeader, { backgroundColor: slot.bgColor }]}>
                    <Text style={{ fontSize: 14 }}>{slot.emoji}</Text>
                    <View style={styles.aiSlotHeaderContent}>
                      <Text style={[styles.aiSlotLabel, { color: slot.color }]}>
                        {slot.label}
                      </Text>
                      <Text style={styles.aiSlotTimeRange}>
                        {AI_SLOT_CONFIG[slot.key].timeRange}
                      </Text>
                    </View>
                    <View style={[styles.aiSlotCount, { backgroundColor: slot.color }]}>
                      <Text style={styles.aiSlotCountText}>{items.length}</Text>
                    </View>
                  </View>

                  {/* Suggestion Cards with thumbnails */}
                  {visibleItems.map((suggestion, idx) => (
                    <View key={idx} style={styles.aiSuggestionCard}>
                      <ActivityImage
                        activity={suggestion}
                        destinationName={currentDestination?.name}
                        size={44}
                        borderRadius={8}
                        fallbackColor={slot.bgColor}
                        fallbackIconColor={slot.color}
                      />
                      <View style={styles.aiSuggestionContent}>
                        <Text style={styles.aiSuggestionName} numberOfLines={1}>
                          {suggestion.name}
                        </Text>
                        {suggestion.description ? (
                          <Text style={styles.aiSuggestionDesc} numberOfLines={1}>
                            {suggestion.description}
                          </Text>
                        ) : null}
                        <View style={styles.aiSuggestionMeta}>
                          <View style={styles.aiSuggestionMetaItem}>
                            <Ionicons name="star" size={9} color="#f59e0b" />
                            <Text style={styles.aiSuggestionMetaText}>{suggestion.rating.toFixed(1)}</Text>
                          </View>
                          <View style={styles.aiSuggestionMetaItem}>
                            <Ionicons name="time-outline" size={9} color={colors.textTertiary} />
                            <Text style={styles.aiSuggestionMetaText}>{suggestion.duration}h</Text>
                          </View>
                          {suggestion.category ? (
                            <View style={[styles.aiCategoryPill, { backgroundColor: slot.bgColor }]}>
                              <Text style={[styles.aiCategoryPillText, { color: slot.color }]}>
                                {suggestion.category}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.aiAddBtn}
                        onPress={() => handleAddActivity(suggestion)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Show more / Show less */}
                  {hiddenCount > 0 && (
                    <TouchableOpacity
                      style={styles.aiShowMoreBtn}
                      onPress={() => setAiExpandedSlots((prev) => ({ ...prev, [slot.key]: !prev[slot.key] }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.aiShowMoreText, { color: slot.color }]}>
                        {isSlotExpanded ? 'Show less' : `Show ${hiddenCount} more`}
                      </Text>
                      <Ionicons
                        name={isSlotExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={slot.color}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <Text style={styles.aiFooter}>Powered by Gemini AI</Text>
          </ScrollView>
        )}
      </View>
    );
  };

  // Search modal removed — replaced by inline add panel in scroll content

  // ─── Render ────────────────────────────────────────────────────────────────

  if (days.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepIndicator}>Step 3 of 4</Text>
            <Text style={styles.headerTitle}>Day Planner</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyDays}>
          <Ionicons name="calendar-outline" size={56} color={colors.gray[300]} />
          <Text style={styles.emptyDaysTitle}>No days to plan</Text>
          <Text style={styles.emptyDaysSubtitle}>
            Go back and add destinations with durations first
          </Text>
          <TouchableOpacity style={styles.emptyDaysBtn} onPress={handleBack}>
            <Text style={styles.emptyDaysBtnText}>Back to Destinations</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepIndicator}>Step 3 of 4</Text>
          <Text style={styles.headerTitle}>Day Planner</Text>
        </View>
        <View style={styles.headerRight}>
          <CollaboratorAvatars onPress={() => inviteSheetRef.current?.expand()} />
          <TouchableOpacity
            style={styles.inviteHeaderBtn}
            onPress={() => inviteSheetRef.current?.expand()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primary[500]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.budgetHeaderBtn}
            onPress={() => budgetSheetRef.current?.expand()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="wallet-outline" size={20} color={colors.primary[500]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Step Navigation ── */}
      <View style={styles.stepNav}>
        {[
          { step: 1, label: 'Setup', route: '/trip/setup' },
          { step: 2, label: 'Destinations', route: '/trip/destinations' },
          { step: 3, label: 'Planner', route: null },
          { step: 4, label: 'Review', route: '/trip/review' },
        ].map((item, idx) => {
          const isCurrent = item.step === 3;
          const isCompleted = item.step < 3;
          return (
            <React.Fragment key={item.step}>
              {idx > 0 && (
                <View style={[styles.stepConnector, (isCompleted || isCurrent) && styles.stepConnectorActive]} />
              )}
              <TouchableOpacity
                style={[
                  styles.stepDot,
                  isCompleted && styles.stepDotCompleted,
                  isCurrent && styles.stepDotCurrent,
                ]}
                onPress={() => {
                  if (item.route && item.step !== 3) {
                    setCurrentStep(item.step);
                    if (item.step < 3) {
                      router.back();
                    } else {
                      router.push(item.route as any);
                    }
                  }
                }}
                disabled={isCurrent}
                activeOpacity={0.7}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={10} color="#ffffff" />
                ) : (
                  <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextCurrent]}>
                    {item.step}
                  </Text>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      {/* ── Day Tabs ── */}
      {renderDayTabs()}

      {/* ── Day Info ── */}
      {currentDay && (
        <View style={styles.dayInfoBar}>
          <View style={styles.dayInfoLeft}>
            <Text style={styles.dayInfoTitle}>{currentDay.title}</Text>
            <View style={styles.dayInfoSubRow}>
              {dayDate ? <Text style={styles.dayInfoDate}>{dayDate}</Text> : null}
              {currentDestination?.name ? (
                <WeatherBadge destinationName={currentDestination.name} />
              ) : null}
            </View>
          </View>
          <View style={styles.dayInfoActions}>
            <OptimizeRouteButton dayIndex={selectedDayIndex} />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => smartBuilderRef.current?.expand()}
              activeOpacity={0.7}
            >
              <Ionicons name="flash" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtnCyan} onPress={handleGenerateAI} activeOpacity={0.7}>
              <Ionicons name="sparkles" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Main Content ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {/* AI Suggestions Panel */}
        {renderAISuggestions()}

        {/* ── Activity List with Drag-to-Reorder ── */}
        <DraggableActivityList
          dayIndex={selectedDayIndex}
          activities={currentActivities}
          destinationName={currentDestination?.name}
          expandedCards={expandedCards}
          onToggleExpand={toggleCardExpand}
          onEditActivity={handleEditActivity}
          onRemoveActivity={handleRemoveActivity}
          onReorder={reorderActivities}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
        />

        {/* ── Add Activity Button (opens full-screen search) ── */}
        <TouchableOpacity
          style={styles.addActivityBtn}
          onPress={() => handleOpenAddPanel()}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
          <Text style={styles.addActivityText}>Add Activity</Text>
        </TouchableOpacity>

        {/* ── Budget Tracker (below activities, full width) ── */}
        <TouchableOpacity
          style={styles.budgetInlineBtn}
          onPress={() => budgetSheetRef.current?.expand()}
          activeOpacity={0.7}
        >
          <Ionicons name="wallet-outline" size={18} color="#f59e0b" />
          <Text style={styles.budgetInlineBtnText}>Budget Tracker</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* ── View Schedule Button ── */}
        {currentActivities.length > 0 && (
          <TouchableOpacity
            style={styles.viewScheduleBtn}
            onPress={() => setShowScheduleModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={16} color="#0d9488" />
            <Text style={styles.viewScheduleBtnText}>View Day Schedule</Text>
          </TouchableOpacity>
        )}

        {/* ── Day Notes ── */}
        <View style={styles.dayNotesSection}>
          <View style={styles.dayNotesHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.dayNotesLabel}>Day Notes</Text>
          </View>
          <TextInput
            style={styles.dayNotesInput}
            value={dayNotesText}
            onChangeText={setDayNotesText}
            onBlur={handleSaveDayNotes}
            placeholder="Add notes for this day..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Bottom spacer for floating buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Floating Map Button (sticky at bottom center) ── */}
      {currentActivities.length > 0 && (
        <TouchableOpacity
          style={styles.floatingMapBtn}
          onPress={() => setShowMapModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="map" size={15} color="#10b981" />
          <Text style={styles.floatingMapBtnText}>View Map</Text>
        </TouchableOpacity>
      )}

      {/* ── Map Modal ── */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.mapModalSafeArea} edges={['top']}>
          <View style={styles.mapModalHeader}>
            <View>
              <Text style={styles.mapModalTitle}>
                {currentDay?.title || 'Day'} Map
              </Text>
              <Text style={styles.mapModalSubtitle}>
                {currentActivities.length} places{currentDestination?.name ? ` · ${currentDestination.name}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowMapModal(false)}
              style={styles.mapModalCloseBtn}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.mapModalContent}>
            <ItineraryMap
              places={currentActivities}
              visible={true}
              onClose={() => setShowMapModal(false)}
              dayTitle={currentDay?.title}
              inline
              height={Dimensions.get('window').height - 160}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Full-Screen Search Modal ── */}
      <Modal
        visible={showAddPanel}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAddPanel(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.searchModalSafe} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.searchModalHeader}>
            <TouchableOpacity
              onPress={() => setShowAddPanel(false)}
              style={styles.searchModalBackBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.searchModalHeaderCenter}>
              <Text style={styles.searchModalTitle}>Add Activity</Text>
              {currentDestination?.name ? (
                <Text style={styles.searchModalSubtitle}>{currentDestination.name}</Text>
              ) : null}
            </View>
            <View style={{ width: 32 }} />
          </View>

          {/* Time Slot Picker */}
          <View style={styles.searchModalSlotPicker}>
            {TIME_SLOTS.map((slot) => (
              <TouchableOpacity
                key={slot.key}
                style={[
                  styles.searchModalSlotBtn,
                  { backgroundColor: slot.bgColor },
                  activeSlot === slot.key && { borderColor: slot.color, borderWidth: 2 },
                ]}
                onPress={() => setActiveSlot(slot.key)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16 }}>{slot.emoji}</Text>
                <Text style={[
                  styles.searchModalSlotLabel,
                  { color: activeSlot === slot.key ? slot.color : colors.textTertiary },
                ]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Input */}
          <View style={styles.searchModalSearchRow}>
            <View style={styles.searchModalSearchInput}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.searchModalSearchText}
                placeholder={`Search places in ${currentDestination?.name || 'destination'}...`}
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.gray[400]} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchModalSearchBtn} onPress={handleSearch} activeOpacity={0.7}>
              <Ionicons name="search" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Results */}
          {isSearching ? (
            <View style={styles.searchModalLoading}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={styles.searchModalLoadingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <ScrollView
              style={styles.searchModalResults}
              contentContainerStyle={styles.searchModalResultsContent}
              keyboardShouldPersistTaps="handled"
            >
              {!searchQuery.trim() && (
                <View style={styles.searchModalPopularHeader}>
                  <Ionicons name="trending-up" size={16} color={colors.primary[500]} />
                  <Text style={styles.searchModalPopularText}>
                    Popular in {currentDestination?.name}
                  </Text>
                </View>
              )}
              {searchResults.map((item, ridx) => (
                <TouchableOpacity
                  key={`${item.name}-${ridx}`}
                  style={styles.searchModalResultCard}
                  onPress={() => {
                    handleAddActivity({ ...item, timeSlot: activeSlot });
                  }}
                  activeOpacity={0.7}
                >
                  <ActivityImage
                    activity={item}
                    destinationName={currentDestination?.name}
                    size={52}
                    borderRadius={borderRadius.lg}
                    fallbackColor={colors.gray[100]}
                    fallbackIconColor={colors.gray[400]}
                  />
                  <View style={styles.searchModalResultContent}>
                    <Text style={styles.searchModalResultName} numberOfLines={1}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.searchModalResultDesc} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                    <View style={styles.searchModalResultMeta}>
                      <View style={styles.searchModalMetaBadge}>
                        <Ionicons name="star" size={10} color="#f59e0b" />
                        <Text style={styles.searchModalMetaText}>{item.rating.toFixed(1)}</Text>
                      </View>
                      <View style={styles.searchModalMetaBadge}>
                        <Ionicons name="time-outline" size={10} color={colors.textTertiary} />
                        <Text style={styles.searchModalMetaText}>{item.duration}h</Text>
                      </View>
                      {item.category ? (
                        <View style={[styles.searchModalCatBadge, {
                          backgroundColor: TIME_SLOTS.find(s => s.key === activeSlot)?.bgColor || colors.gray[100],
                        }]}>
                          <Text style={[styles.searchModalCatText, {
                            color: TIME_SLOTS.find(s => s.key === activeSlot)?.color || colors.textSecondary,
                          }]}>{item.category}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.searchModalAddBtn}
                    onPress={() => handleAddActivity({ ...item, timeSlot: activeSlot })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.searchModalEmpty}>
              <Ionicons name="search-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.searchModalEmptyTitle}>
                {searchQuery.trim() ? 'No results found' : 'Search for places'}
              </Text>
              <Text style={styles.searchModalEmptySubtitle}>
                {searchQuery.trim()
                  ? `Try a different search term for ${currentDestination?.name || 'this destination'}`
                  : `Type to search or browse popular spots in ${currentDestination?.name || 'this destination'}`}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Schedule Modal ── */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
        statusBarTranslucent
      >
        <View style={styles.scheduleOverlay}>
          <View style={styles.scheduleSheet}>
            <View style={styles.scheduleHeader}>
              <View style={styles.scheduleHeaderLeft}>
                <Ionicons name="grid-outline" size={18} color="#0d9488" />
                <View>
                  <Text style={styles.scheduleTitle}>
                    {currentDay?.title || 'Day'} Schedule
                  </Text>
                  <Text style={styles.scheduleSubtitle}>
                    {currentActivities.length} activities{currentDestination?.name ? ` · ${currentDestination.name}` : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scheduleBody}>
              {/* Table Header */}
              <View style={styles.scheduleTableHeader}>
                <Text style={[styles.scheduleTableHeaderText, { width: 30 }]}>#</Text>
                <Text style={[styles.scheduleTableHeaderText, { width: 70 }]}>Time</Text>
                <Text style={[styles.scheduleTableHeaderText, { flex: 1 }]}>Activity</Text>
              </View>

              {/* Table Rows */}
              {currentActivities.map((activity, idx) => {
                const slotConfig = TIME_SLOTS.find((s) => s.key === activity.timeSlot);
                const slotActivities = currentActivities.filter((a) => a.timeSlot === activity.timeSlot);
                const slotIdx = slotActivities.indexOf(activity);
                const time = getTimeForSlot(activity.timeSlot, slotIdx);
                const endHour = activity.duration || 2;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.scheduleRow,
                      idx % 2 === 1 && styles.scheduleRowAlt,
                    ]}
                  >
                    <Text style={[styles.scheduleRowNum, { width: 30 }]}>{idx + 1}</Text>
                    <View style={{ width: 70 }}>
                      <View style={[styles.scheduleSlotBadge, { backgroundColor: slotConfig?.bgColor || colors.gray[100] }]}>
                        <Text style={[styles.scheduleSlotBadgeText, { color: slotConfig?.color || colors.textSecondary }]}>
                          {slotConfig?.emoji} {time || slotConfig?.label}
                        </Text>
                      </View>
                      {endHour ? <Text style={styles.scheduleDuration}>{endHour}h</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduleActivityName}>{activity.name}</Text>
                      {activity.notes ? (
                        <Text style={styles.scheduleActivityNotes} numberOfLines={1}>
                          {activity.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}

              {/* Day Notes */}
              {currentDay?.notes ? (
                <View style={styles.scheduleNotesSection}>
                  <Ionicons name="document-text-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.scheduleNotesText}>{currentDay.notes}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Bottom Bar ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>Review Trip</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Search modal removed — inline add panel used instead */}

      {/* ── Smart Itinerary Builder Bottom Sheet ── */}
      <SmartItineraryBuilder
        sheetRef={smartBuilderRef}
        dayIndex={selectedDayIndex}
        destinationName={currentDestination?.name || ''}
        tripType={tripType}
        budget={budget}
        existingActivities={currentActivities}
      />

      {/* ── Budget Tracker Bottom Sheet ── */}
      <BudgetTrackerSheet sheetRef={budgetSheetRef} />

      {/* ── SOS Emergency Button ── */}
      <SOSButton destinationName={currentDestination?.name} />

      {/* ── Invite Collaborators Bottom Sheet ── */}
      <InviteSheet sheetRef={inviteSheetRef} />

      {/* ── Trip Chat FAB + Bottom Sheet ── */}
      <TripChatSheet sheetRef={chatSheetRef} />

      {/* ── Activity Edit Modal ── */}
      <Modal
        visible={editingActivity !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingActivity(null)}
        statusBarTranslucent
      >
        <View style={styles.editOverlay}>
          <View style={styles.editSheet}>
            {editingActivity && (
              <>
                <View style={styles.editHeader}>
                  <Text style={styles.editTitle} numberOfLines={1}>
                    {editingActivity.activity.name}
                  </Text>
                  <TouchableOpacity onPress={() => setEditingActivity(null)}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Time Slot Picker */}
                <Text style={styles.editSectionLabel}>Time Slot</Text>
                <View style={styles.editSlotRow}>
                  {TIME_SLOTS.map((slot) => (
                    <TouchableOpacity
                      key={slot.key}
                      style={[
                        styles.editSlotBtn,
                        { backgroundColor: slot.bgColor, borderColor: slot.color },
                        editingActivity.activity.timeSlot === slot.key && styles.editSlotBtnActive,
                      ]}
                      onPress={() => handleChangeTimeSlot(slot.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 14 }}>{slot.emoji}</Text>
                      <Text
                        style={[
                          styles.editSlotBtnText,
                          { color: slot.color },
                          editingActivity.activity.timeSlot === slot.key && { fontWeight: fontWeight.bold },
                        ]}
                      >
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes */}
                <Text style={styles.editSectionLabel}>Notes</Text>
                <TextInput
                  style={styles.editNotesInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Add notes about this activity..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Save Button */}
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={handleSaveNotes}
                  activeOpacity={0.8}
                >
                  <Text style={styles.editSaveBtnText}>Save Notes</Text>
                </TouchableOpacity>

                {/* Activity Details */}
                {editingActivity.activity.description ? (
                  <View style={styles.editDetailSection}>
                    <Text style={styles.editSectionLabel}>Description</Text>
                    <Text style={styles.editDetailText}>
                      {editingActivity.activity.description}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inviteHeaderBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },
  budgetHeaderBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },
  dayInfoSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },

  // Step Navigation
  stepNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[200],
  },
  stepDotCompleted: {
    backgroundColor: '#f97316',
  },
  stepDotCurrent: {
    backgroundColor: '#f97316',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
  },
  stepDotTextCurrent: {
    color: '#ffffff',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    maxWidth: 50,
  },
  stepConnectorActive: {
    backgroundColor: '#f97316',
  },

  // Day Tabs
  dayTabsContainer: {
    maxHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  dayTabsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dayTab: {
    minWidth: 80,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    position: 'relative',
  },
  dayTabSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
  },
  dayTabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  dayTabLabelSelected: {
    color: '#8b5cf6',
  },
  dayTabDest: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
    maxWidth: 80,
  },
  dayTabDestSelected: {
    color: '#7c3aed',
  },
  dayTabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTabBadgeSelected: {
    backgroundColor: '#8b5cf6',
  },
  dayTabBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  dayTabBadgeTextSelected: {
    color: '#ffffff',
  },

  // Day Info Bar
  dayInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayInfoLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  dayInfoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dayInfoDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },

  // Floating Map Button
  floatingMapBtn: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    ...shadow.lg,
    zIndex: 30,
  },
  floatingMapBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#10b981',
  },
  // Map Modal
  mapModalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  mapModalSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  mapModalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.gray[100],
  },
  mapModalContent: {
    flex: 1,
  },

  // Day Info Actions
  dayInfoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Icon-only toolbar buttons (PWA mobile compact style)
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: '#a855f7',
    ...shadow.sm,
  },
  iconBtnCyan: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: '#06b6d4',
    ...shadow.sm,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Add Activity Button
  addActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    backgroundColor: colors.primary[50],
    marginTop: spacing.xs,
  },
  addActivityText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },

  // AI Panel
  aiPanel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  aiPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#ecfeff',
    borderBottomWidth: 1,
    borderBottomColor: '#a5f3fc',
  },
  aiPanelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiPanelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  aiRefreshBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#cffafe',
  },
  aiPanelTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#0891b2',
  },
  aiLoading: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  aiLoadingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  aiLoadingSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  aiEmpty: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  aiEmptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  aiSuggestionsList: {
    maxHeight: 400,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  aiSlotSection: {
    marginBottom: spacing.md,
  },
  aiSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xs,
  },
  aiSlotHeaderContent: {
    flex: 1,
  },
  aiSlotLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  aiSlotTimeRange: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  aiSlotCount: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSlotCountText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  aiSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.md,
  },
  aiSuggestionContent: {
    flex: 1,
    minWidth: 0,
  },
  aiSuggestionName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  aiSuggestionDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  aiSuggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  aiSuggestionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  aiSuggestionMetaText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  aiCategoryPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aiCategoryPillText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  aiFooter: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textTertiary,
    paddingVertical: spacing.md,
  },
  aiAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiShowMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  aiShowMoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },

  // View Schedule Button
  viewScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  viewScheduleBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#0d9488',
  },

  // Day Notes
  dayNotesSection: {
    marginBottom: spacing.lg,
  },
  dayNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayNotesLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  dayNotesInput: {
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 60,
    lineHeight: 20,
  },

  // Schedule Modal
  scheduleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  scheduleSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    ...shadow.lg,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scheduleTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  scheduleSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  scheduleBody: {
    paddingBottom: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
  },
  scheduleTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scheduleTableHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  scheduleRowAlt: {
    backgroundColor: '#f0fdfa',
  },
  scheduleRowNum: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  scheduleSlotBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  scheduleSlotBadgeText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
  },
  scheduleDuration: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  scheduleActivityName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  scheduleActivityNotes: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  scheduleNotesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
  },
  scheduleNotesText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Empty Days State
  emptyDays: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.md,
  },
  emptyDaysTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  emptyDaysSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  emptyDaysBtn: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    marginTop: spacing.md,
  },
  emptyDaysBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing['2xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadow.md,
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // ── Inline Add Activity Panel ──
  inlineAddPanel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  inlineAddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  inlineAddTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },
  inlineSlotPicker: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inlineSlotBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inlineSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  inlineSearchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  inlineSearchTextInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  inlineSearchBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  inlineLoadingText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  inlineResults: {
    maxHeight: 250,
    paddingHorizontal: spacing.md,
  },
  inlinePopularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  inlinePopularText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  inlineResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  inlineResultContent: {
    flex: 1,
    minWidth: 0,
  },
  inlineResultName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  inlineResultMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  inlineResultMetaText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  inlineEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  inlineEmptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },

  // ── Budget Inline Button ──
  budgetInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  budgetInlineBtnText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#92400e',
  },

  // Edit Activity Modal
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
    maxHeight: '70%',
    ...shadow.lg,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  editTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  editSectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  editSlotRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editSlotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  editSlotBtnActive: {
    borderWidth: 2,
  },
  editSlotBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  editNotesInput: {
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 80,
  },
  editSaveBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadow.md,
  },
  editSaveBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  editDetailSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  editDetailText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ── Full-Screen Search Modal ──
  searchModalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  searchModalBackBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchModalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  searchModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  searchModalSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  searchModalSlotPicker: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
  },
  searchModalSlotBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchModalSlotLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  searchModalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  searchModalSearchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
  },
  searchModalSearchText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    paddingVertical: 0,
  },
  searchModalSearchBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
  },
  searchModalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  searchModalLoadingText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  searchModalResults: {
    flex: 1,
  },
  searchModalResultsContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  searchModalPopularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  searchModalPopularText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[600],
  },
  searchModalResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  searchModalResultContent: {
    flex: 1,
    minWidth: 0,
  },
  searchModalResultName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  searchModalResultDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  searchModalResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  searchModalMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gray[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  searchModalMetaText: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  searchModalCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  searchModalCatText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  searchModalAddBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    ...shadow.sm,
  },
  searchModalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.md,
  },
  searchModalEmptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  searchModalEmptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
