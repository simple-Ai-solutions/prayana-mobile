// GooglePlacesAutocomplete — place suggestions input matching the PWA's
// TripPlannerSearchInput behaviour: Google Places Autocomplete (REST) with an
// OpenStreetMap/Nominatim fallback, 300ms debounce, main + secondary text.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Search, MapPin, X } from 'lucide-react-native';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius, shadow } from '@prayana/shared-ui';
import { ENV } from '../../config/env';

interface Prediction {
  text: string;          // full description, e.g. "Bangalore, Karnataka, India"
  main: string;          // main text, e.g. "Bangalore"
  secondary: string;     // secondary text, e.g. "Karnataka, India"
  placeId?: string;
  source: 'google' | 'osm';
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  iconColor?: string;
}

const DEBOUNCE_MS = 300;

async function searchGoogle(query: string, key: string, signal: AbortSignal): Promise<Prediction[]> {
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(query)}&key=${key}&language=en`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  if (data.status !== 'OK' || !Array.isArray(data.predictions)) return [];
  return data.predictions.map((p: any) => ({
    text: p.description,
    main: p.structured_formatting?.main_text || p.description,
    secondary: p.structured_formatting?.secondary_text || '',
    placeId: p.place_id,
    source: 'google' as const,
  }));
}

async function searchOSM(query: string, signal: AbortSignal): Promise<Prediction[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => {
    const parts = (item.display_name || '').split(',').map((s: string) => s.trim());
    return {
      text: item.display_name,
      main: parts[0] || item.display_name,
      secondary: parts.slice(1).join(', '),
      source: 'osm' as const,
    };
  });
}

export const GooglePlacesAutocomplete: React.FC<Props> = ({ value, onChange, placeholder, iconColor }) => {
  const { themeColors, isDarkMode } = useTheme();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const justSelected = useRef(false);

  const fetchPredictions = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      let results: Prediction[] = [];
      const key = ENV.googleMapsApiKey;
      if (key) {
        try {
          results = await searchGoogle(q, key, controller.signal);
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
        }
      }
      // Fallback to OSM if Google returned nothing / no key.
      if (results.length === 0) {
        try {
          results = await searchOSM(q, controller.signal);
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
        }
      }
      setPredictions(results);
      setOpen(results.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on value change (skip right after a selection).
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchPredictions(value.trim()), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchPredictions]);

  const select = useCallback((p: Prediction) => {
    justSelected.current = true;
    onChange(p.main);
    setOpen(false);
    setPredictions([]);
  }, [onChange]);

  const fieldBg = isDarkMode ? '#1F2937' : '#F9FAFB';
  const fieldBorder = focused ? colors.primary[400] : (isDarkMode ? '#374151' : '#E5E7EB');

  const showDropdown = open && predictions.length > 0;

  return (
    // Raise z-index/elevation only while the dropdown is open so it overlays the
    // field below it (otherwise the next input shows through the suggestions).
    <View style={[styles.wrap, showDropdown && styles.wrapOpen]}>
      <View style={[styles.inputBox, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
        <Search size={16} color={themeColors.textTertiary} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          style={[styles.input, { color: themeColors.text }]}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={() => { setFocused(true); if (predictions.length) setOpen(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 200); }}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        ) : value.length > 0 ? (
          <TouchableOpacity onPress={() => { onChange(''); setPredictions([]); setOpen(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={themeColors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, shadow.lg, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
          {/* Plain ScrollView (not FlatList) — the list is tiny (≤6 items), and a
              VirtualizedList nested in the modal's ScrollView throws a warning
              and mis-measures. keyboardShouldPersistTaps keeps taps working. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {predictions.map((item, i) => (
              <TouchableOpacity
                key={`${item.placeId || item.text}-${i}`}
                style={styles.row}
                onPress={() => select(item)}
                activeOpacity={0.7}
              >
                <MapPin size={16} color={colors.primary[500]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowMain, { color: themeColors.text }]} numberOfLines={1}>{item.main}</Text>
                  {!!item.secondary && (
                    <Text style={[styles.rowSub, { color: themeColors.textTertiary }]} numberOfLines={1}>{item.secondary}</Text>
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
  wrap: { position: 'relative', zIndex: 20 },
  // While the dropdown is open, lift this field above sibling fields (Android
  // honours elevation for stacking; iOS honours zIndex) so suggestions overlay
  // the next input instead of rendering behind it.
  wrapOpen: { zIndex: 1000, elevation: 24 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 220,
    zIndex: 999,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowMain: { fontSize: 14, fontWeight: fontWeight.semibold },
  rowSub: { fontSize: 12, marginTop: 1 },
});
