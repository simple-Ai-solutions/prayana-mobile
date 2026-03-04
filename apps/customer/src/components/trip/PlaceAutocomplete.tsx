import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, shadow, borderRadius, useTheme } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';

interface Suggestion {
  // API returns: text, shortName, location, type, rating, image
  text?: string;
  shortName?: string;
  name?: string;
  location?: string;
  country?: string;
  city?: string;
  type?: string;
  rating?: number;
}

interface PlaceAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Search destination...',
  required = false,
}) => {
  const { isDarkMode, themeColors } = useTheme();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await makeAPICall(
        `/destinations/global-autocomplete?q=${encodeURIComponent(query)}&limit=8`,
        { method: 'GET', timeout: 8000 }
      );

      if (response?.success && Array.isArray(response.data)) {
        setSuggestions(response.data);
        setShowDropdown(response.data.length > 0);
      } else if (Array.isArray(response)) {
        setSuggestions(response);
        setShowDropdown(response.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTextChange = useCallback((text: string) => {
    onChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 400);
  }, [onChange, fetchSuggestions]);

  const getDisplayName = useCallback((item: Suggestion): string => {
    return item.text || item.shortName || item.name || item.city || '';
  }, []);

  const getSubtext = useCallback((item: Suggestion): string => {
    return item.location || item.country || '';
  }, []);

  const handleSuggestionPress = useCallback((suggestion: Suggestion) => {
    onChange(getDisplayName(suggestion));
    setShowDropdown(false);
    setSuggestions([]);
    Keyboard.dismiss();
  }, [onChange, getDisplayName]);

  const handleClear = useCallback(() => {
    onChange('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const renderSuggestion = useCallback(({ item }: { item: Suggestion }) => {
    const displayName = getDisplayName(item);
    const subtext = getSubtext(item);

    return (
      <TouchableOpacity
        style={[
          styles.suggestionItem,
          { borderBottomColor: isDarkMode ? '#374151' : '#E5E7EB' },
        ]}
        onPress={() => handleSuggestionPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.suggestionIcon, { backgroundColor: isDarkMode ? '#374151' : '#FEE2E2' }]}>
          <Ionicons name="location" size={14} color="#FF6B6B" />
        </View>
        <View style={styles.suggestionTextContainer}>
          <Text
            style={[styles.suggestionName, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}
            numberOfLines={1}
          >
            {displayName || 'Unknown'}
          </Text>
          {subtext ? (
            <Text
              style={[styles.suggestionCountry, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}
              numberOfLines={1}
            >
              {subtext}
            </Text>
          ) : null}
        </View>
        {item.rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [isDarkMode, handleSuggestionPress, getDisplayName, getSubtext]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          shadow.sm,
          {
            backgroundColor: isDarkMode ? '#1F2937' : colors.surface,
            borderColor: value.trim()
              ? '#FF6B6B'
              : isDarkMode ? '#374151' : colors.border,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={16}
          color={themeColors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: themeColors.text }]}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          value={value}
          onChangeText={handleTextChange}
          autoCapitalize="words"
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            // Delay to allow suggestion press to register
            setTimeout(() => setShowDropdown(false), 200);
          }}
        />
        {isLoading && (
          <ActivityIndicator size="small" color="#FF6B6B" style={styles.loader} />
        )}
        {value.length > 0 && !isLoading && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            shadow.lg,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
              borderColor: isDarkMode ? '#374151' : colors.border,
            },
          ]}
        >
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => `${item.text || item.name || ''}-${index}`}
            keyboardShouldPersistTaps="handled"
            style={styles.suggestionsList}
            nestedScrollEnabled
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: 0,
  },
  loader: {
    marginLeft: spacing.sm,
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    maxHeight: 240,
    overflow: 'hidden',
    zIndex: 999,
  },
  suggestionsList: {
    maxHeight: 240,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  suggestionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  suggestionCountry: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#92400E',
  },
});

export default PlaceAutocomplete;
