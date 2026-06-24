// @ts-nocheck — pure JS utility; types deliberately deferred.
// utils/currencyMapping.js - Currency Mapping and Helper Functions
import { COUNTRY_CODES } from './countryCodes';

// Comprehensive country code to currency mapping
export const CURRENCY_MAP = {
  // Asia-Pacific
  IN: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  CN: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  JP: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  KR: { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  SG: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  MY: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  TH: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  ID: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  PH: { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  VN: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  HK: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  TW: { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
  LK: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  PK: { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  BD: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  NP: { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee' },
  BT: { code: 'BTN', symbol: 'Nu.', name: 'Bhutanese Ngultrum' },
  MV: { code: 'MVR', symbol: 'Rf', name: 'Maldivian Rufiyaa' },

  // North America
  US: { code: 'USD', symbol: '$', name: 'US Dollar' },
  CA: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  MX: { code: 'MXN', symbol: '$', name: 'Mexican Peso' },

  // Europe
  GB: { code: 'GBP', symbol: '£', name: 'British Pound' },
  DE: { code: 'EUR', symbol: '€', name: 'Euro' },
  FR: { code: 'EUR', symbol: '€', name: 'Euro' },
  IT: { code: 'EUR', symbol: '€', name: 'Euro' },
  ES: { code: 'EUR', symbol: '€', name: 'Euro' },
  NL: { code: 'EUR', symbol: '€', name: 'Euro' },
  CH: { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  SE: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  NO: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  DK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  FI: { code: 'EUR', symbol: '€', name: 'Euro' },
  AT: { code: 'EUR', symbol: '€', name: 'Euro' },
  BE: { code: 'EUR', symbol: '€', name: 'Euro' },
  PL: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  PT: { code: 'EUR', symbol: '€', name: 'Euro' },
  GR: { code: 'EUR', symbol: '€', name: 'Euro' },
  IE: { code: 'EUR', symbol: '€', name: 'Euro' },
  CZ: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  HU: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  RO: { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  BG: { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  HR: { code: 'EUR', symbol: '€', name: 'Euro' },
  SI: { code: 'EUR', symbol: '€', name: 'Euro' },
  SK: { code: 'EUR', symbol: '€', name: 'Euro' },
  LT: { code: 'EUR', symbol: '€', name: 'Euro' },
  LV: { code: 'EUR', symbol: '€', name: 'Euro' },
  EE: { code: 'EUR', symbol: '€', name: 'Euro' },
  IS: { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' },
  LU: { code: 'EUR', symbol: '€', name: 'Euro' },
  MT: { code: 'EUR', symbol: '€', name: 'Euro' },
  CY: { code: 'EUR', symbol: '€', name: 'Euro' },
  RU: { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  TR: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },

  // Middle East
  AE: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  SA: { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  QA: { code: 'QAR', symbol: '﷼', name: 'Qatari Riyal' },
  KW: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  BH: { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' },
  OM: { code: 'OMR', symbol: '﷼', name: 'Omani Rial' },
  IR: { code: 'IRR', symbol: '﷼', name: 'Iranian Rial' },
  IQ: { code: 'IQD', symbol: 'ع.د', name: 'Iraqi Dinar' },
  JO: { code: 'JOD', symbol: 'د.ا', name: 'Jordanian Dinar' },
  LB: { code: 'LBP', symbol: '£', name: 'Lebanese Pound' },
  SY: { code: 'SYP', symbol: '£', name: 'Syrian Pound' },
  IL: { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },

  // Africa
  EG: { code: 'EGP', symbol: '£', name: 'Egyptian Pound' },
  ZA: { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  NG: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  KE: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  GH: { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },

  // South America
  BR: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  AR: { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  CL: { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
  CO: { code: 'COP', symbol: '$', name: 'Colombian Peso' },
  PE: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  VE: { code: 'VES', symbol: 'Bs.S', name: 'Venezuelan Bolívar' },

  // Oceania
  AU: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  NZ: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
};

// Popular currencies (shown at top of currency selector)
export const POPULAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD'
];

/**
 * Get currency data for a given country code
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., "IN", "US")
 * @returns {Object} Currency data with code, symbol, and name
 */
export const getCurrencyForCountry = (countryCode) => {
  const currency = CURRENCY_MAP[countryCode];

  if (!currency) {
    console.warn(`No currency mapping for country: ${countryCode}, using India/INR as fallback`);
    return CURRENCY_MAP['IN']; // Default to India
  }

  return currency;
};

/**
 * Get country name from country code
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {string} Human-readable country name
 */
export const getCountryName = (countryCode) => {
  const country = COUNTRY_CODES.find(c => c.country === countryCode);
  return country?.name || 'Unknown';
};

/**
 * Get country code from country name (reverse lookup)
 * Handles case-insensitive and partial matching
 * @param {string} countryName - Country name from geolocation (e.g., "India", "United States")
 * @returns {string} ISO country code or 'IN' as fallback
 */
export const getCountryCodeFromName = (countryName) => {
  if (!countryName) return 'IN';

  // Normalize input (trim, lowercase)
  const normalized = countryName.trim().toLowerCase();

  // Try exact match first
  let country = COUNTRY_CODES.find(c =>
    c.name.toLowerCase() === normalized
  );

  // Try partial match
  if (!country) {
    country = COUNTRY_CODES.find(c =>
      c.name.toLowerCase().includes(normalized) ||
      normalized.includes(c.name.toLowerCase())
    );
  }

  // Special cases for common variations
  const specialCases = {
    'united states': 'US',
    'usa': 'US',
    'america': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'england': 'GB',
    'uae': 'AE',
    'emirates': 'AE',
  };

  const specialMatch = specialCases[normalized];
  if (specialMatch) {
    return specialMatch;
  }

  if (!country) {
    console.warn(`Could not map country name "${countryName}" to ISO code, using India as fallback`);
    return 'IN'; // Default to India
  }

  return country.country;
};

/**
 * Get all currencies that use a specific currency code
 * Useful for countries using shared currencies (e.g., EUR in Europe)
 * @param {string} currencyCode - Currency code (e.g., "EUR", "USD")
 * @returns {Array} Array of country codes using this currency
 */
export const getCountriesForCurrency = (currencyCode) => {
  return Object.entries(CURRENCY_MAP)
    .filter(([_, currency]) => currency.code === currencyCode)
    .map(([countryCode]) => countryCode);
};

/**
 * Get all unique currencies from the mapping
 * @returns {Array} Array of unique currency objects
 */
export const getAllCurrencies = () => {
  const uniqueCurrencies = new Map();

  Object.values(CURRENCY_MAP).forEach(currency => {
    if (!uniqueCurrencies.has(currency.code)) {
      uniqueCurrencies.set(currency.code, currency);
    }
  });

  return Array.from(uniqueCurrencies.values());
};

/**
 * Format currency amount with symbol
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - Currency code
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode) => {
  const currency = Object.values(CURRENCY_MAP).find(c => c.code === currencyCode);
  if (!currency) return `${amount}`;

  return `${currency.symbol}${amount.toLocaleString()}`;
};
