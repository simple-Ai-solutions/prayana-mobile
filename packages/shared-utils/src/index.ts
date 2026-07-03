// @prayana/shared-utils - Barrel export file

// constants
export {
  COLORS,
  AUTH_CONFIG,
  FIREBASE_CONFIG,
  SMS_COSTS,
  AUTH_METHODS,
  USER_ROLES,
  NOTIFICATION_TYPES,
  BREAKPOINTS,
  API_ENDPOINTS,
  OPENSTREETMAP_CONFIG,
  NAVIGATION_ITEMS,
  QUICK_ACTIONS,
  TRIP_TYPES,
  BUDGET_RANGES,
  ACCOMMODATION_TYPES,
  TRANSPORT_TYPES,
  INTERESTS,
  PLACE_CATEGORIES,
  DURATION_OPTIONS,
  WEATHER_CONDITIONS,
  TRIP_STATUS,
  API_CONFIG,
  SEARCH_CONFIG,
  IMAGE_CONFIG,
  VALIDATION_RULES,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FEATURES,
  ANIMATION_DURATIONS,
  DEBOUNCE_DELAYS,
  PLANNING_MODES,
  TRAVEL_STYLES,
  SMARTTRIP_ENDPOINTS,
  MODE_THEMES,
  SMARTTRIP_VALIDATION,
  SMARTTRIP_ERRORS,
  SMARTTRIP_SUCCESS,
  MODE_ANIMATIONS,
  FILTER_OPTIONS,
  THEME_COLORS,
  APP_CONFIG,
} from './constants';
export { default as constants } from './constants';

// countryCodes
export {
  COUNTRY_CODES,
  getCountryByCode,
  formatPhoneNumber,
} from './countryCodes';

// currencyMapping
export {
  CURRENCY_MAP,
  POPULAR_CURRENCIES,
  getCurrencyForCountry,
  getCountryName,
  getCountryCodeFromName,
  getCountriesForCurrency,
  getAllCurrencies,
  formatCurrency,
} from './currencyMapping';

// emergencyNumbers
export {
  EMERGENCY_NUMBERS,
  getEmergencyNumbers,
} from './emergencyNumbers';

// distanceHelpers
export {
  haversineKm,
  formatDistance,
  formatTravelTime,
  calculateActivityDistance,
  hasValidCoords,
  generateSlug as generateSlugFromName,
} from './distanceHelpers';

// splitwiseCalculator
export {
  calculateNetBalances,
  minimizeTransactions,
  getPersonSummary,
} from './splitwiseCalculator';

// slugUtils
export {
  generateSlug,
  generateLocationSlug,
  generateDestinationSlug,
  parseDestinationUrl,
  getDestinationSlug,
  getItinerarySlug,
  extractSlugFromPath,
  buildDestinationUrl,
  buildItineraryUrl,
  buildSearchUrl,
  isValidSlug,
} from './slugUtils';

// regionDetection
export {
  EUROPEAN_COUNTRIES,
  isEuropeanCountry,
  getRegionForCountry,
  getInterestRegion,
} from './regionDetection';

// smartCache
export { smartCache } from './smartCache';

// coordinatesFetcher
export {
  fetchCoordinatesFromGoogle,
  areCoordsInvalid,
  enhancePlaceWithCoordinates,
} from './coordinatesFetcher';

// generatePlaceTimes
export {
  assignPlaceTimes,
  assignCustomTimes,
} from './generatePlaceTimes';

// guestUsage
export {
  GUEST_LIMITS,
  getGuestUsageCount,
  incrementGuestUsage,
  canGuestUse,
  resetGuestUsage,
} from './guestUsage';

// luxuryDataTransformer
export {
  transformToLuxuryLayout,
  createDynamicCircuits,
  buildHeroSection,
  getUniqueTags,
  getPlaceImageUrl,
  setImageServerOrigin,
  resolveImageUrl,
  TAG_EMOJIS,
} from './luxuryDataTransformer';
export type {
  LuxuryPlace,
  LuxuryHero,
  LuxuryData,
  ApiResponse as LuxuryApiResponse,
} from './luxuryDataTransformer';
