// @ts-nocheck — pure JS utility; types deliberately deferred.
/**
 * Region detection utilities for country-based personalization
 */

// European countries list
const EUROPEAN_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU members
  'GB', 'NO', 'CH', 'IS', 'LI', 'MC', 'AD', 'SM', 'VA' // Non-EU European
];

/**
 * Check if a country code is European
 */
export function isEuropeanCountry(countryCode) {
  return EUROPEAN_COUNTRIES.includes(countryCode?.toUpperCase());
}

/**
 * Get region for a country code
 */
export function getRegionForCountry(countryCode) {
  const code = countryCode?.toUpperCase();

  if (isEuropeanCountry(code)) {
    return 'europe';
  }

  // Simple region mapping (can be extended)
  const regionMap = {
    // Asia
    'IN': 'asia', 'CN': 'asia', 'JP': 'asia', 'KR': 'asia', 'TH': 'asia',
    'VN': 'asia', 'SG': 'asia', 'MY': 'asia', 'ID': 'asia', 'PH': 'asia',
    'BD': 'asia', 'PK': 'asia', 'NP': 'asia', 'LK': 'asia', 'MM': 'asia',
    'KH': 'asia', 'LA': 'asia', 'BN': 'asia', 'TL': 'asia', 'MV': 'asia',

    // Americas
    'US': 'americas', 'CA': 'americas', 'MX': 'americas', 'BR': 'americas',
    'AR': 'americas', 'CL': 'americas', 'CO': 'americas', 'PE': 'americas',
    'VE': 'americas', 'EC': 'americas', 'UY': 'americas', 'PY': 'americas',
    'BO': 'americas', 'CR': 'americas', 'PA': 'americas', 'CU': 'americas',

    // Africa
    'ZA': 'africa', 'EG': 'africa', 'KE': 'africa', 'NG': 'africa',
    'MA': 'africa', 'TN': 'africa', 'ET': 'africa', 'GH': 'africa',
    'TZ': 'africa', 'UG': 'africa', 'DZ': 'africa', 'SD': 'africa',

    // Oceania
    'AU': 'oceania', 'NZ': 'oceania', 'FJ': 'oceania', 'PG': 'oceania',
    'NC': 'oceania', 'PF': 'oceania', 'WS': 'oceania', 'TO': 'oceania',

    // Middle East
    'AE': 'middle-east', 'SA': 'middle-east', 'IL': 'middle-east',
    'TR': 'middle-east', 'JO': 'middle-east', 'QA': 'middle-east',
    'KW': 'middle-east', 'BH': 'middle-east', 'OM': 'middle-east',
    'LB': 'middle-east', 'IQ': 'middle-east', 'IR': 'middle-east'
  };

  return regionMap[code] || 'asia'; // Default to Asia
}

/**
 * Get interest region for personalized content
 * Europe gets special content, others get global
 */
export function getInterestRegion(countryCode) {
  if (isEuropeanCountry(countryCode)) {
    return 'europe';
  }
  if (countryCode === 'IN') {
    return 'india';
  }
  return 'global';
}

export { EUROPEAN_COUNTRIES };
