import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl } from '@prayana/shared-utils';

// ============================================================
// CONFIG (matching web SEARCH_CONFIG)
// ============================================================
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 8;
const OSM_CACHE_DURATION = 5 * 60 * 1000; // 5 min
const DB_CACHE_DURATION = 10 * 60 * 1000; // 10 min
const RECENT_SEARCHES_KEY = 'prayana_recent_searches';

// ============================================================
// TYPES
// ============================================================
interface Suggestion {
  id: string;
  text: string;
  shortName: string;
  subtitle?: string;
  type: 'destination' | 'place' | 'recent';
  source: 'osm' | 'database' | 'recent';
  image?: string | null;
  rating?: number;
  coordinates?: { lat: number; lng: number };
  confidence?: number;
}

// ============================================================
// CLIENT-SIDE CACHE (matching web's caching approach)
// ============================================================
const osmCache = new Map<string, { data: Suggestion[]; ts: number }>();
const dbCache = new Map<string, { data: Suggestion[]; ts: number }>();

function getCached(cache: Map<string, any>, key: string, maxAge: number) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < maxAge) return entry.data;
  return null;
}

// ============================================================
// OSM NOMINATIM SEARCH (matching web osmUtils.js)
// Free, no API key, returns city/region-level results
// ============================================================
async function searchOSM(query: string): Promise<Suggestion[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = getCached(osmCache, cacheKey, OSM_CACHE_DURATION);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '6',
      addressdetails: '1',
      dedupe: '1',
    });
    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PrayanaAI/1.0 (travel planning app)' },
    });
    const data = await res.json();

    const results: Suggestion[] = data.map((item: any, idx: number) => {
      const addr = item.address || {};
      const country = addr.country || '';
      const state = addr.state || '';
      const city = item.name || addr.city || addr.town || '';
      return {
        id: `osm-${item.osm_id || idx}`,
        text: item.display_name,
        shortName: city || item.name,
        subtitle: [state, country].filter(Boolean).join(', '),
        type: 'destination' as const,
        source: 'osm' as const,
        coordinates: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
        confidence: item.importance || 0.5,
      };
    });

    osmCache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  } catch (err: any) {
    console.warn('[Search] OSM failed:', err.message);
    return [];
  }
}

// ============================================================
// DB AUTOCOMPLETE (fast, returns places within destinations)
// ============================================================
async function searchDB(query: string): Promise<Suggestion[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = getCached(dbCache, cacheKey, DB_CACHE_DURATION);
  if (cached) return cached;

  try {
    const res = await makeAPICall(`/destinations/global-autocomplete?q=${encodeURIComponent(query)}&limit=${MAX_SUGGESTIONS}`);
    const items = res?.data || res?.suggestions || (Array.isArray(res) ? res : []);

    const results: Suggestion[] = items.map((item: any, idx: number) => ({
      id: `db-${item._id || item.text || idx}`,
      text: item.text || item.name,
      shortName: item.shortName || item.text || item.name,
      subtitle: item.location || '',
      type: 'place' as const,
      source: 'database' as const,
      image: resolveImageUrl(item.image) || null,
      rating: item.rating,
    }));

    dbCache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  } catch (err: any) {
    console.warn('[Search] DB autocomplete failed:', err.message);
    return [];
  }
}

// ============================================================
// POPULAR DESTINATIONS (shown when search is empty)
// ============================================================
const POPULAR = [
  { name: 'Goa', emoji: '🏖️' },
  { name: 'Jaipur', emoji: '🏰' },
  { name: 'Kerala', emoji: '🌴' },
  { name: 'Manali', emoji: '🏔️' },
  { name: 'Hampi', emoji: '🏛️' },
  { name: 'Rishikesh', emoji: '🧘' },
  { name: 'Udaipur', emoji: '🏯' },
  { name: 'Andaman', emoji: '🏝️' },
  { name: 'Kashmir', emoji: '❄️' },
  { name: 'Darjeeling', emoji: '🍵' },
  { name: 'Ooty', emoji: '🌿' },
  { name: 'Ladakh', emoji: '🗻' },
];

// ============================================================
// MAIN SEARCH SCREEN
// ============================================================
export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { themeColors, isDarkMode } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState(params.q || '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOSMTime = useRef(0);

  // Load recent searches on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((val) => {
      if (val) try { setRecentSearches(JSON.parse(val)); } catch {}
    });
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, []);

  // If opened with query param
  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      performSearch(params.q);
    }
  }, [params.q]);

  // ============================================================
  // HYBRID SEARCH: OSM (cities/regions) + DB (places) in parallel
  // Matches web's Google Maps + DB autocomplete approach
  // ============================================================
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setHasSearched(false);
      setSearchTime(null);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    const start = Date.now();

    try {
      // Enforce OSM 1s rate limit (matching web's Nominatim policy)
      const now = Date.now();
      const timeSinceLastOSM = now - lastOSMTime.current;
      const shouldCallOSM = timeSinceLastOSM >= 1000;

      // Run both searches in parallel
      const [osmResults, dbResults] = await Promise.allSettled([
        shouldCallOSM ? searchOSM(trimmed).then(r => { lastOSMTime.current = Date.now(); return r; }) : Promise.resolve(getCached(osmCache, trimmed.toLowerCase(), OSM_CACHE_DURATION) || []),
        searchDB(trimmed),
      ]);

      const osm = osmResults.status === 'fulfilled' ? osmResults.value : [];
      const db = dbResults.status === 'fulfilled' ? dbResults.value : [];

      // Merge: OSM destinations first, then DB places — deduplicated
      const seen = new Set<string>();
      const merged: Suggestion[] = [];

      // OSM city/region results first (these are the fast "destination" suggestions)
      for (const s of osm) {
        const key = s.shortName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(s);
        }
      }

      // DB place results after
      for (const s of db) {
        const key = s.shortName.toLowerCase();
        if (!seen.has(key) && merged.length < MAX_SUGGESTIONS * 2) {
          seen.add(key);
          merged.push(s);
        }
      }

      setSuggestions(merged);
      setSearchTime(Date.now() - start);
    } catch (err: any) {
      console.warn('[Search] Search failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // DEBOUNCED INPUT (300ms, matching web)
  // ============================================================
  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setHasSearched(false);
      setSearchTime(null);
      return;
    }

    debounceRef.current = setTimeout(() => performSearch(text), DEBOUNCE_MS);
  }, [performSearch]);

  // ============================================================
  // NAVIGATION
  // ============================================================
  const saveRecent = useCallback(async (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, 10);
    setRecentSearches(updated);
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }, [recentSearches]);

  const isNavigatingRef = useRef(false);

  // Helper: dismiss search screen, then navigate to destination
  const navigateFromSearch = useCallback((href: any) => {
    // Pop search screen first, then push destination from the root stack
    // Using setTimeout to ensure the search screen is fully removed before pushing
    router.back();
    setTimeout(() => {
      if (typeof href === 'string') {
        router.push(href as any);
      } else {
        router.push(href);
      }
    }, 50);
  }, [router]);

  const handleSuggestionPress = useCallback((s: Suggestion) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => { isNavigatingRef.current = false; }, 1500);

    Keyboard.dismiss();
    const name = s.shortName || s.text;
    saveRecent(name);

    if (s.type === 'destination' || s.source === 'osm') {
      // City/region → AI search results page (list of places)
      navigateFromSearch(`/destination/${encodeURIComponent(name)}`);
    } else {
      // DB place → navigate directly to place detail page
      const locationPart = s.subtitle?.split(',')[0]?.trim() || name;
      const preview = JSON.stringify({
        name: name,
        rating: s.rating || null,
        image: s.image || '',
      });
      navigateFromSearch({
        pathname: '/destination/[location]/[place]',
        params: { location: locationPart, place: name, preview },
      });
    }
  }, [router, saveRecent, navigateFromSearch]);

  const handleSubmit = useCallback(() => {
    if (isNavigatingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed) {
      isNavigatingRef.current = true;
      setTimeout(() => { isNavigatingRef.current = false; }, 1500);
      Keyboard.dismiss();
      saveRecent(trimmed);
      navigateFromSearch(`/destination/${encodeURIComponent(trimmed)}`);
    }
  }, [query, router, saveRecent, navigateFromSearch]);

  const handleQuickSearch = useCallback((term: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => { isNavigatingRef.current = false; }, 1500);
    saveRecent(term);
    navigateFromSearch(`/destination/${encodeURIComponent(term)}`);
  }, [router, saveRecent, navigateFromSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setHasSearched(false);
    setSearchTime(null);
    inputRef.current?.focus();
  }, []);

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  // ============================================================
  // RENDER SUGGESTION ITEM
  // ============================================================
  const renderSuggestion = useCallback(({ item }: { item: Suggestion }) => {
    const isOSM = item.source === 'osm';
    return (
      <TouchableOpacity
        style={[styles.suggestionRow, { borderBottomColor: themeColors.border }]}
        onPress={() => handleSuggestionPress(item)}
        activeOpacity={0.7}
      >
        {/* Icon / Image */}
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.suggestionImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.suggestionIcon, { backgroundColor: isOSM ? '#DBEAFE' : colors.primary[50] }]}>
            <Ionicons
              name={isOSM ? 'location' : 'compass'}
              size={20}
              color={isOSM ? '#3B82F6' : colors.primary[500]}
            />
          </View>
        )}

        {/* Text */}
        <View style={styles.suggestionContent}>
          <Text style={[styles.suggestionName, { color: themeColors.text }]} numberOfLines={1}>
            {item.shortName}
          </Text>
          {item.subtitle ? (
            <Text style={[styles.suggestionSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Source badge + Rating */}
        <View style={styles.suggestionRight}>
          {isOSM && (
            <View style={styles.sourceBadge}>
              <Ionicons name="navigate-outline" size={10} color="#3B82F6" />
              <Text style={styles.sourceBadgeText}>City</Text>
            </View>
          )}
          {!isOSM && item.rating ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#FBBF24" />
              <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
      </TouchableOpacity>
    );
  }, [themeColors, handleSuggestionPress]);

  // ============================================================
  // GROUP SUGGESTIONS BY TYPE
  // ============================================================
  const listData = React.useMemo(() => {
    if (!hasSearched || loading) return [];
    const items: any[] = [];

    const osmSuggestions = suggestions.filter(s => s.source === 'osm');
    const dbSuggestions = suggestions.filter(s => s.source === 'database');

    if (osmSuggestions.length > 0) {
      items.push({ type: 'header', title: 'Destinations', key: 'h-dest' });
      osmSuggestions.forEach((s) => items.push({ type: 'suggestion', data: s, key: s.id }));
    }

    if (dbSuggestions.length > 0) {
      items.push({ type: 'header', title: 'Places & Attractions', key: 'h-places' });
      dbSuggestions.forEach((s) => items.push({ type: 'suggestion', data: s, key: s.id }));
    }

    if (osmSuggestions.length === 0 && dbSuggestions.length === 0) {
      items.push({ type: 'empty', key: 'empty' });
    }

    return items;
  }, [hasSearched, loading, suggestions]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.sectionHeader, { backgroundColor: isDarkMode ? '#111' : '#F9FAFB' }]}>
          <Text style={[styles.sectionHeaderText, { color: themeColors.textSecondary }]}>{item.title}</Text>
        </View>
      );
    }
    if (item.type === 'suggestion') {
      return renderSuggestion({ item: item.data });
    }
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color={colors.gray[300]} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No results found</Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Try a different search or explore popular destinations
          </Text>
          <TouchableOpacity style={styles.searchAIBtn} onPress={handleSubmit} activeOpacity={0.85}>
            <Ionicons name="sparkles" size={16} color="#ffffff" />
            <Text style={styles.searchAIBtnText}>Search "{query.trim()}" with AI</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }, [themeColors, isDarkMode, renderSuggestion, handleSubmit, query]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Search Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <View style={[styles.searchBarContainer, {
          backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
          borderColor: isDarkMode ? '#374151' : '#D1D5DB',
        }]}>
          <Ionicons name="search-outline" size={18} color={themeColors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: themeColors.text }]}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSubmit}
            placeholder="Search any place in the world..."
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => { Keyboard.dismiss(); router.back(); }} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.primary[500] }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Search Stats */}
      {searchTime !== null && hasSearched && !loading && (
        <View style={[styles.statsRow, { backgroundColor: isDarkMode ? '#111' : '#F9FAFB' }]}>
          <Text style={[styles.statsText, { color: themeColors.textTertiary }]}>
            {suggestions.length} results in {searchTime}ms
          </Text>
          {suggestions.some(s => s.source === 'osm') && (
            <View style={styles.providerBadge}>
              <Text style={styles.providerText}>OpenStreetMap</Text>
            </View>
          )}
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Searching...</Text>
        </View>
      )}

      {/* Search Results */}
      {hasSearched && !loading && (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.resultsList}
          ListFooterComponent={
            query.trim() && suggestions.length > 0 ? (
              <TouchableOpacity
                style={[styles.searchAllRow, { backgroundColor: isDarkMode ? 'rgba(46,196,182,0.1)' : colors.primary[50] }]}
                onPress={handleSubmit}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={16} color={colors.primary[500]} />
                <Text style={styles.searchAllText}>
                  Explore all places in "{query.trim()}" with AI
                </Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary[500]} />
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Default State: Recent + Popular */}
      {!hasSearched && !loading && (
        <FlatList
          data={[]}
          renderItem={() => null}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.defaultContainer}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <View style={styles.defaultSection}>
                  <View style={styles.defaultSectionHeader}>
                    <Text style={[styles.defaultSectionTitle, { color: themeColors.text }]}>Recent Searches</Text>
                    <TouchableOpacity onPress={clearRecentSearches}>
                      <Text style={styles.clearBtn}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {recentSearches.slice(0, 5).map((term) => (
                    <TouchableOpacity
                      key={term}
                      style={[styles.recentRow, { borderBottomColor: themeColors.border }]}
                      onPress={() => handleQuickSearch(term)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="time-outline" size={18} color={colors.gray[400]} />
                      <Text style={[styles.recentText, { color: themeColors.text }]}>{term}</Text>
                      <Ionicons name="arrow-forward-outline" size={14} color={colors.gray[400]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Popular Destinations */}
              <View style={styles.defaultSection}>
                <Text style={[styles.defaultSectionTitle, { color: themeColors.text }]}>Popular Destinations</Text>
                <View style={styles.popularGrid}>
                  {POPULAR.map((dest) => (
                    <TouchableOpacity
                      key={dest.name}
                      style={[styles.popularChip, {
                        backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
                        borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                      }]}
                      onPress={() => handleQuickSearch(dest.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.popularEmoji}>{dest.emoji}</Text>
                      <Text style={[styles.popularName, { color: themeColors.text }]}>{dest.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  cancelBtn: { paddingVertical: 8, paddingLeft: 4 },
  cancelText: { fontSize: 15, fontWeight: '500' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statsText: { fontSize: 11 },
  providerBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  providerText: { fontSize: 10, fontWeight: '600', color: '#3B82F6' },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: { fontSize: 13 },

  // Results
  resultsList: { paddingBottom: 40 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Suggestion Row
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionContent: { flex: 1 },
  suggestionName: { fontSize: 15, fontWeight: '600' },
  suggestionSubtitle: { fontSize: 12, marginTop: 2 },
  suggestionRight: { alignItems: 'flex-end', gap: 4 },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: { fontSize: 10, fontWeight: '600', color: '#3B82F6' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: { fontSize: 11, fontWeight: '600', color: '#92400E' },

  // Search All
  searchAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  searchAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[600],
    flex: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  searchAIBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    gap: 6,
  },
  searchAIBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },

  // Default State
  defaultContainer: { paddingTop: 8 },
  defaultSection: { paddingHorizontal: 16, marginBottom: 24 },
  defaultSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  defaultSectionTitle: { fontSize: 15, fontWeight: '700' },
  clearBtn: { fontSize: 13, fontWeight: '500', color: colors.primary[500] },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentText: { flex: 1, fontSize: 14 },

  // Popular Grid
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  popularEmoji: { fontSize: 14 },
  popularName: { fontSize: 13, fontWeight: '500' },
});
