// PlaceAutocompleteInput — city autocomplete for the mobile forms, mirroring the
// web's TripPlannerSearchInput + useTripPlannerSearch + TripSearchSuggestions.
//
// Provider chain is the web's, adapted to React Native:
//   1. Google Places Autocomplete. The web uses the browser-only Google Maps JS
//      SDK (AutocompleteService); that SDK does not exist in RN, so we call the
//      same provider over its REST endpoint. Same data, same key.
//   2. OpenStreetMap / Nominatim, if Google errors or returns nothing.
//   3. Neither responded -> no dropdown, the field stays plain free text. The
//      backend accepts a free-text destination, so a dead network must never
//      block the user from submitting.
//
// The web's third call — the backend auto-correct — is deliberately NOT ported:
// it is fire-and-forget there ("never gate suggestions on it") and mobile has no
// such method, so there is nothing to gain and an endpoint to invent.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Keyboard,
  StyleProp,
  ViewStyle,
} from 'react-native';
// This input is rendered inside a gesture-handler ScrollView. A plain RN
// Touchable nested in one silently never receives taps, so both the suggestion
// rows and the clear button must come from gesture-handler.
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import {
  useTheme, spacing, fontSize, fontWeight, borderRadius, shadow,
} from '@prayana/shared-ui';
import { ENV } from '../../config/env';

// Mirrors the web's SEARCH_CONFIG (utils/constants.js).
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 6;
const CACHE_DURATION_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

export interface PlaceSuggestion {
  /** Full description, e.g. "Manali, Himachal Pradesh, India". */
  text: string;
  /** Main text — what we put in the field, e.g. "Manali". */
  shortName: string;
  /** Secondary line, e.g. "Himachal Pradesh, India". */
  secondaryText: string;
  /** Human label from the web's determinePlaceType(), e.g. "City". */
  placeType: string;
  placeId?: string;
  source: 'google' | 'osm';
}

// ---------------------------------------------------------------------------
// Cache — one entry per (provider, query). The web caches in
// cachedSearchGoogleMaps/cachedSearchOSM so retyping a query never re-fetches;
// module scope keeps it alive across mounts, as it is there.
// ---------------------------------------------------------------------------
type CacheEntry = { results: PlaceSuggestion[]; timestamp: number };
const suggestionCache = new Map<string, CacheEntry>();

const cacheKey = (provider: string, query: string) =>
  `${provider}:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;

function readCache(key: string): PlaceSuggestion[] | null {
  const entry = suggestionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= CACHE_DURATION_MS) {
    suggestionCache.delete(key);
    return null;
  }
  return entry.results;
}

function writeCache(key: string, results: PlaceSuggestion[]) {
  suggestionCache.set(key, { results, timestamp: Date.now() });
}

/** Exported for tests / cache busting. */
export function clearPlaceAutocompleteCache() {
  suggestionCache.clear();
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** Port of the web's determinePlaceType() (utils/googleMapsUtils.js). */
const GOOGLE_TYPE_HIERARCHY: Record<string, string> = {
  country: 'Country',
  administrative_area_level_1: 'State/Province',
  administrative_area_level_2: 'Region',
  locality: 'City',
  sublocality: 'District',
  neighborhood: 'Neighborhood',
  colloquial_area: 'Area',
  tourist_attraction: 'Attraction',
  point_of_interest: 'Point of Interest',
  natural_feature: 'Natural Feature',
  park: 'Park',
  establishment: 'Place',
};

function determinePlaceType(types: string[] = []): string {
  for (const t of types) {
    if (GOOGLE_TYPE_HIERARCHY[t]) return GOOGLE_TYPE_HIERARCHY[t];
  }
  return 'Place';
}

/** fetch() with a hard timeout — a hung request must not pin the spinner. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

async function searchGoogle(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const key = ENV.googleMapsApiKey;
  if (!key) return [];

  const cKey = cacheKey('google', query);
  const cached = readCache(cKey);
  if (cached) return cached;

  // NO `types` filter — the web calls getPlacePredictions({ input: query }) with
  // no type restriction, so a country ("India"), a state ("Kerala"), a city or a
  // landmark all resolve. `types=(cities)` looks right but is actively wrong: it
  // makes Google return ONLY cities, so typing "India" yields Indianapolis /
  // Indian Rocks Beach / Indiana and never India itself.
  const url =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
    `?input=${encodeURIComponent(query)}&language=en&key=${key}`;

  const res = await fetchWithTimeout(url, {}, signal);
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);

  const data = await res.json();

  // ZERO_RESULTS is a legitimate empty answer, not a failure: cache it so we do
  // not re-ask, and let the caller fall through to OSM.
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    // REQUEST_DENIED / OVER_QUERY_LIMIT / INVALID_REQUEST -> let OSM take over.
    throw new Error(`Google Places status ${data.status}`);
  }

  const predictions: any[] = Array.isArray(data.predictions) ? data.predictions : [];
  const results: PlaceSuggestion[] = predictions
    .slice(0, MAX_SUGGESTIONS)
    .map((p) => ({
      text: p.description,
      shortName: p.structured_formatting?.main_text || String(p.description || '').split(',')[0].trim(),
      secondaryText: p.structured_formatting?.secondary_text || '',
      placeType: determinePlaceType(p.types),
      placeId: p.place_id,
      source: 'google' as const,
    }));

  writeCache(cKey, results);
  return results;
}

async function searchOSM(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const cKey = cacheKey('osm', query);
  const cached = readCache(cKey);
  if (cached) return cached;

  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(query)}&format=json&limit=${MAX_SUGGESTIONS}&addressdetails=1`;

  // Nominatim REJECTS requests without a User-Agent — this header is required,
  // not decorative.
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': 'PrayanaAI/1.0 (travel planning app)', 'Accept-Language': 'en' } },
    signal,
  );
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const results: PlaceSuggestion[] = data.map((item: any) => {
    const parts = String(item.display_name || '').split(',').map((s: string) => s.trim());
    const shortName = item.name || parts[0] || item.display_name;
    return {
      text: item.display_name,
      shortName,
      secondaryText: parts.slice(1).join(', '),
      placeType: item.type || item.class || 'Place',
      placeId: item.place_id ? String(item.place_id) : undefined,
      source: 'osm' as const,
    };
  });

  writeCache(cKey, results);
  return results;
}

/** Google first, OSM fallback. Never throws — both dead means "no suggestions". */
async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  try {
    const googleResults = await searchGoogle(query, signal);
    if (googleResults.length > 0) return googleResults;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    // Swallow and fall through to OSM, as the web does.
  }

  try {
    return await searchOSM(query, signal);
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    // Both providers failed -> degrade silently to plain free text.
    return [];
  }
}

// Web's TripSearchSuggestions picks an icon per place type (Globe for
// wide-area, MapPin otherwise). Ionicons equivalents:
function iconForPlaceType(placeType: string): keyof typeof Ionicons.glyphMap {
  const t = (placeType || '').toLowerCase();
  if (t.includes('country') || t.includes('state') || t.includes('province') || t.includes('region')) {
    return 'globe-outline';
  }
  return 'location-outline';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  value: string;
  /** Called on every keystroke AND on selection — keeps the form's state as the single source of truth. */
  onChangeText: (text: string) => void;
  /** Fired only on an explicit pick, if the caller wants the full place object. */
  onSelect?: (suggestion: PlaceSuggestion) => void;
  placeholder?: string;
  /** Leading icon, so Starting Point and Destination can keep their distinct glyphs. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  /** Accent for the row icons + spinner. */
  accentColor: string;
  editable?: boolean;
  /** Style for the bordered field box (the caller owns the look). */
  fieldStyle?: StyleProp<ViewStyle>;
  /** Raised while the dropdown is open so it overlays the fields below it. */
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const PlaceAutocompleteInput: React.FC<Props> = ({
  value,
  onChangeText,
  onSelect,
  placeholder,
  icon = 'location-outline',
  iconColor,
  accentColor,
  editable = true,
  fieldStyle,
  containerStyle,
  accessibilityLabel,
}) => {
  const { themeColors, isDarkMode } = useTheme();

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the user picks a suggestion: the resulting value change must not
  // immediately re-open the dropdown with a search for the name we just chose.
  const justSelectedRef = useRef(false);
  // Guards a late response from a superseded keystroke overwriting fresh results.
  const searchIdRef = useRef(0);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelPending();
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    [cancelPending],
  );

  const runSearch = useCallback(async (query: string) => {
    cancelPending();

    const controller = new AbortController();
    abortRef.current = controller;
    const searchId = ++searchIdRef.current;

    setLoading(true);
    try {
      const results = await searchPlaces(query, controller.signal);
      if (searchId !== searchIdRef.current) return; // superseded
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      if (searchId !== searchIdRef.current) return;
      // Both providers unreachable — stay silent, leave the field as free text.
      setSuggestions([]);
      setOpen(false);
    } finally {
      if (searchId === searchIdRef.current) setLoading(false);
    }
  }, [cancelPending]);

  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = text.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      cancelPending();
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    // Debounce ~300ms (the web's SEARCH_CONFIG.debounceDelay) — no request per
    // keystroke.
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
  }, [onChangeText, runSearch, cancelPending]);

  const handleSelect = useCallback((s: PlaceSuggestion) => {
    justSelectedRef.current = true;
    cancelPending();
    // Fill the field with the chosen place name — same as the web, which passes
    // `suggestion.shortName || suggestion.text` back to the form.
    onChangeText(s.shortName || s.text);
    onSelect?.(s);
    setSuggestions([]);
    setOpen(false);
    setLoading(false);
    Keyboard.dismiss();
  }, [onChangeText, onSelect, cancelPending]);

  const handleFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (suggestions.length > 0) setOpen(true);
  }, [suggestions.length]);

  const handleBlur = useCallback(() => {
    // Small delay so a tap landing on a suggestion still registers before the
    // dropdown unmounts.
    blurTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  const showDropdown = open && suggestions.length > 0;

  const dropdownColors = useMemo(
    () => ({
      backgroundColor: isDarkMode ? themeColors.surface : '#FFFFFF',
      borderColor: themeColors.border,
    }),
    [isDarkMode, themeColors.surface, themeColors.border],
  );

  return (
    // While the dropdown is open this container is lifted above the following
    // form rows (Duration / Travel month), so the absolutely-positioned list
    // paints over them instead of behind them. iOS honours zIndex, Android needs
    // elevation — set both.
    <View style={[styles.container, showDropdown && styles.containerOpen, containerStyle]}>
      <View style={fieldStyle}>
        <Ionicons name={icon} size={17} color={iconColor} />
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          editable={editable}
          autoCorrect={false}
          autoCapitalize="words"
          accessibilityLabel={accessibilityLabel}
          style={[styles.input, { color: themeColors.text }]}
        />
        {loading ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : value.length > 0 && editable ? (
          <TouchableOpacity
            onPress={() => {
              cancelPending();
              onChangeText('');
              setSuggestions([]);
              setOpen(false);
              setLoading(false);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear"
          >
            <Ionicons name="close-circle" size={17} color={themeColors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, shadow.lg, dropdownColors]}>
          {/* A plain ScrollView, not a FlatList: the list is <= 6 rows, and a
              VirtualizedList nested inside the form's ScrollView warns and
              mis-measures. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.placeId || s.text}-${i}`}
                onPress={() => handleSelect(s)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={s.text}
                style={[
                  styles.row,
                  i < suggestions.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: themeColors.border,
                  },
                ]}
              >
                <Ionicons name={iconForPlaceType(s.placeType)} size={16} color={accentColor} />
                <View style={styles.rowText}>
                  <Text
                    style={[styles.rowMain, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {s.shortName}
                  </Text>
                  {!!s.secondaryText && (
                    <Text
                      style={[styles.rowSub, { color: themeColors.textTertiary }]}
                      numberOfLines={1}
                    >
                      {s.secondaryText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 1 },
  containerOpen: { zIndex: 1000, elevation: 24 },

  input: { flex: 1, paddingVertical: spacing.md, fontSize: fontSize.md },

  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    maxHeight: 240,
    overflow: 'hidden',
    zIndex: 1001,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1 },
  rowMain: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  rowSub: { fontSize: fontSize.xs, marginTop: 2 },
});

export default PlaceAutocompleteInput;
