// settings/country.tsx - Country & Currency selector screen
// Allows users to manually change their country, overriding auto-detection

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, shadow, useTheme } from '@prayana/shared-ui';
import { useAppStore } from '@prayana/shared-stores';
import { locationDetectionService } from '@prayana/shared-services';
import {
  COUNTRY_CODES,
  CURRENCY_MAP,
  getCurrencyForCountry,
} from '@prayana/shared-utils';

// Popular countries shown at top
const POPULAR_COUNTRY_CODES = ['IN', 'US', 'GB', 'AU', 'DE', 'FR', 'JP', 'SG', 'AE', 'CA'];

interface CountryItem {
  country: string; // ISO code
  name: string;
  flag?: string;
  phone?: string;
}

export default function CountrySettingsScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const userPreferences = useAppStore((state) => state.userPreferences);
  const updateCountryAndCurrency = useAppStore((state) => state.updateCountryAndCurrency);
  const initializeLocationPreferences = useAppStore((state) => state.initializeLocationPreferences);

  const [searchQuery, setSearchQuery] = useState('');

  // Build country list
  const allCountries = useMemo(() => {
    return COUNTRY_CODES.map((c: any) => ({
      country: c.country,
      name: c.name,
      flag: c.flag,
      phone: c.phone,
    }));
  }, []);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show popular first, then all
      const popular = POPULAR_COUNTRY_CODES
        .map((code) => allCountries.find((c) => c.country === code))
        .filter(Boolean) as CountryItem[];

      const rest = allCountries.filter(
        (c) => !POPULAR_COUNTRY_CODES.includes(c.country)
      );

      return { popular, rest };
    }

    const query = searchQuery.toLowerCase().trim();
    const matched = allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.country.toLowerCase().includes(query)
    );

    return { popular: [], rest: matched };
  }, [searchQuery, allCountries]);

  const handleSelectCountry = useCallback(
    (countryCode: string) => {
      updateCountryAndCurrency(countryCode);
      router.back();
    },
    [updateCountryAndCurrency, router]
  );

  const handleResetToAutoDetected = useCallback(async () => {
    try {
      locationDetectionService.reset();
      const locationData = await locationDetectionService.detectUserCountry();
      if (locationData?.country) {
        await initializeLocationPreferences(locationData);
        Alert.alert(
          'Country Updated',
          `Auto-detected: ${locationData.country}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Re-detection failed:', error);
      Alert.alert('Error', 'Could not detect your location. Please try again.');
    }
  }, [initializeLocationPreferences]);

  const renderCountryItem = useCallback(
    ({ item }: { item: CountryItem }) => {
      const currency = getCurrencyForCountry(item.country);
      const isSelected = userPreferences.country === item.country;

      return (
        <TouchableOpacity
          style={[
            styles.countryRow,
            {
              backgroundColor: isSelected
                ? (isDarkMode ? 'rgba(249,115,22,0.15)' : '#FFF7ED')
                : (isDarkMode ? '#1F2937' : '#ffffff'),
              borderColor: isSelected ? '#F97316' : (isDarkMode ? '#374151' : '#E5E7EB'),
            },
          ]}
          onPress={() => handleSelectCountry(item.country)}
          activeOpacity={0.7}
        >
          <View style={styles.countryInfo}>
            <Text style={styles.countryFlag}>{item.flag || ''}</Text>
            <View style={styles.countryTextContainer}>
              <Text style={[styles.countryName, { color: themeColors.text }]}>
                {item.name}
              </Text>
              <Text style={[styles.countryCode, { color: themeColors.textSecondary }]}>
                {item.country} - {currency?.code || 'N/A'} ({currency?.symbol || ''})
              </Text>
            </View>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#F97316" />
          )}
        </TouchableOpacity>
      );
    },
    [userPreferences.country, isDarkMode, themeColors, handleSelectCountry]
  );

  // Combine sections for FlatList
  const listData = useMemo(() => {
    const data: (CountryItem | { type: 'header'; title: string })[] = [];

    if (filteredCountries.popular.length > 0) {
      data.push({ type: 'header', title: 'Popular' } as any);
      data.push(...filteredCountries.popular);
      data.push({ type: 'header', title: 'All Countries' } as any);
    }
    data.push(...filteredCountries.rest);

    return data;
  }, [filteredCountries]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === 'header') {
        return (
          <Text style={[styles.sectionHeader, { color: themeColors.textSecondary }]}>
            {item.title}
          </Text>
        );
      }
      return renderCountryItem({ item });
    },
    [renderCountryItem, themeColors]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['bottom']}>
      {/* Current Selection */}
      <View style={[styles.currentSelection, {
        backgroundColor: isDarkMode ? '#1a1a2e' : '#EFF6FF',
        borderColor: isDarkMode ? '#374151' : '#DBEAFE',
      }]}>
        <View style={styles.currentInfo}>
          <Ionicons name="globe-outline" size={24} color="#3B82F6" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[styles.currentLabel, { color: themeColors.textSecondary }]}>
              Current Country
            </Text>
            <Text style={[styles.currentValue, { color: themeColors.text }]}>
              {userPreferences.countryName} ({userPreferences.currency})
            </Text>
            {userPreferences.manuallySet && (
              <Text style={[styles.manualBadge, { color: '#F97316' }]}>
                Manually set
              </Text>
            )}
          </View>
        </View>
        {userPreferences.manuallySet && (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetToAutoDetected}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={16} color="#3B82F6" />
            <Text style={styles.resetText}>Auto-detect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, {
        backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
        borderColor: isDarkMode ? '#374151' : '#E5E7EB',
      }]}>
        <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.text }]}
          placeholder="Search countries..."
          placeholderTextColor={themeColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Country List */}
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item: any) => item.type === 'header' ? `header-${item.title}` : item.country}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  currentSelection: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  currentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  manualBadge: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  resetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  countryFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  countryTextContainer: {
    flex: 1,
  },
  countryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  countryCode: {
    fontSize: 12,
    marginTop: 2,
  },
});
