import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { COUNTRY_CODES } from '@prayana/shared-utils';

/**
 * One country-code picker, shared by every screen that takes a phone number.
 * Both the login screen's inline phone entry and phone-login.tsx render this,
 * so the two can't drift into divergent pickers.
 *
 * The COUNTRY_CODES list itself already lives in @prayana/shared-utils; this is
 * the UI half of the same contract, and it deliberately does not re-declare the
 * list.
 *
 * Controlled: the parent owns `selectedIndex` (an index into COUNTRY_CODES) and
 * the open/closed state — the same shape phone-login.tsx used before this was
 * extracted out of it.
 */

export interface CountryCode {
  code: string;
  country: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
}

export const COUNTRIES = COUNTRY_CODES as CountryCode[];

/** Index of India (+91) — the default selection. */
export const DEFAULT_COUNTRY_INDEX = 0;

export function getCountryAt(index: number): CountryCode {
  return COUNTRIES[index] ?? COUNTRIES[DEFAULT_COUNTRY_INDEX];
}

/**
 * The one phone-number validity rule, shared so login.tsx's "Continue" button
 * and phone-login.tsx's "Send OTP" agree on what counts as plausible.
 */
export function isPlausiblePhone(raw: string): boolean {
  return raw.replace(/[^\d]/g, '').length >= 10;
}

interface CountryCodeButtonProps {
  selectedIndex: number;
  open: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The tappable "🇮🇳 +91 ▾" trigger that sits to the left of the phone input. */
export function CountryCodeButton({
  selectedIndex,
  open,
  onPress,
  disabled = false,
  style,
}: CountryCodeButtonProps) {
  const selected = getCountryAt(selectedIndex);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Country code ${selected.code}, ${selected.name}`}
    >
      <Text style={styles.flag}>{selected.flag}</Text>
      <Text style={styles.code}>{selected.code}</Text>
      <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

interface CountryCodeListProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

/** The dropdown list. Render it directly under the phone row when open. */
export function CountryCodeList({
  selectedIndex,
  onSelect,
  style,
}: CountryCodeListProps) {
  return (
    <View style={[styles.dropdown, style]}>
      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator>
        {COUNTRIES.map((country, index) => (
          <TouchableOpacity
            key={`${country.country}-${index}`}
            style={[styles.item, index === selectedIndex && styles.itemSelected]}
            onPress={() => onSelect(index)}
            activeOpacity={0.7}
          >
            <Text style={styles.itemFlag}>{country.flag}</Text>
            <Text style={styles.itemName}>{country.name}</Text>
            <Text style={styles.itemCode}>{country.code}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Trigger
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    minWidth: 100,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  code: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginRight: 4,
  },
  arrow: {
    fontSize: 10,
    color: '#6b7280',
  },

  // Dropdown
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  list: {
    maxHeight: 200,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemSelected: {
    backgroundColor: '#f0fdfc',
  },
  itemFlag: {
    fontSize: 18,
    marginRight: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  itemCode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
});
