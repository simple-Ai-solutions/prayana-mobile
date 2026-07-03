// utils/constants.js - NEXT.JS COMPATIBLE VERSION WITH OPENSTREETMAP INTEGRATION

export const COLORS = {
  background: "#FAFAFA",
  primary: "#2EC4B6",
  secondary: "#FF6B6B",
  highlight: "#FFE66D",
  text: "#111827", // Darker text color for better visibility
  textSecondary: "#6B7280",
  white: "#FFFFFF",
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },
};

export const AUTH_CONFIG = {
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  tokenRefreshInterval: 55 * 60 * 1000, // 55 minutes
  maxLoginAttempts: 5,
  otpExpiryTime: 300, // 5 minutes in seconds
};

export const FIREBASE_CONFIG = {
  recaptchaTimeout: 60000, // 1 minute
  smsRetryLimit: 3,
  enableAppCheck: process.env.NODE_ENV === "production",
};

export const SMS_COSTS = {
  // Approximate costs per SMS by region (USD)
  IN: 0.012, // India
  US: 0.075, // United States
  GB: 0.048, // United Kingdom
  EU: 0.055, // European Union average
  default: 0.05,
};

export const AUTH_METHODS = {
  EMAIL: "email",
  PHONE: "phone",
  GOOGLE: "google",
};

export const USER_ROLES = {
  USER: "user",
  PREMIUM: "premium",
  ADMIN: "admin",
};

export const NOTIFICATION_TYPES = {
  EMAIL: "email",
  PUSH: "push",
  SMS: "sms",
  MARKETING: "marketing",
};

export const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};

export const API_ENDPOINTS = {
  destinations: {
    featured: "/destinations/featured",
    recommended: "/destinations/recommended",
    search: "/destinations/search",
    aiSearch: "/destinations/ai-search",
    smartSearch: "/destinations/smart-search",
    autoCorrect: "/destinations/auto-correct", // Optional backend auto-correct
    nearby: "/destinations/nearby",
    details: "/destinations/:id",
    aiDetails: "/destinations/ai-details",
    images: "/destinations/images",
    transportation: "/destinations/transportation",
  },
  tripPlanning: {
    createItinerary: "/trip-planning/create-itinerary",
    createSmartTripItinerary: "/trip-planning/create-smarttrip-itinerary",
    validateSmartTripRoute: "/trip-planning/validate-smarttrip-route",
    smartTripPreview: "/trip-planning/smarttrip-route-preview",
    comparePlanningModes: "/trip-planning/compare-planning-modes",
    saveTrip: "/trip-planning/save-trip",
    getSavedTrips: "/trip-planning/saved-trips/:userId",
    getTripById: "/trip-planning/trip/:tripId",
    deleteTrip: "/trip-planning/trip/:tripId",
    updateTrip: "/trip-planning/trip/:tripId",
    transportOptions: "/trip-planning/transportation/options",
    vendors: "/trip-planning/transportation/vendors/:type/:location",
  },
  users: {
    profile: "/users/profile",
    savedTrips: "/users/saved-trips",
    preferences: "/users/:userId/preferences",
  },
};

// OpenStreetMap/Nominatim Configuration
export const OPENSTREETMAP_CONFIG = {
  nominatimBaseUrl: "https://nominatim.openstreetmap.org",
  userAgent: "PrayanaAI/1.0 (travel planning app)",
  defaultParams: {
    format: "json",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    "accept-language": "en",
    dedupe: "1",
    limit: "8",
  },
  rateLimit: {
    requestsPerSecond: 1, // Nominatim rate limit
    burstLimit: 5,
  },
};

export const NAVIGATION_ITEMS = [
  { id: "home", label: "Home", path: "/" },
  { id: "discover", label: "Discover", path: "/explore-nearby" },
  { id: "trips", label: "Trips", path: "/saved-trips" },
  { id: "profile", label: "Profile", path: "/profile" },
];

export const QUICK_ACTIONS = [
  {
    id: "plan",
    title: "Plan a Trip",
    description: "Create your perfect itinerary",
    path: "/",
    icon: "PlusCircle",
    color: "bg-[#2EC4B6]",
    hoverColor: "hover:bg-[#2EC4B6]/90",
  },
  {
    id: "saved",
    title: "Saved Trips",
    description: "View your saved adventures",
    path: "/",
    icon: "Bookmark",
    color: "bg-[#FF6B6B]",
    hoverColor: "hover:bg-[#FF6B6B]/90",
  },
  {
    id: "explore",
    title: "Explore Nearby",
    description: "Discover local attractions",
    path: "/explore-nearby",
    icon: "Navigation",
    color: "bg-[#FFE66D]",
    hoverColor: "hover:bg-[#FFE66D]/90",
  },
];

export const TRIP_TYPES = [
  { value: "leisure", label: "Leisure", icon: "🏖️" },
  { value: "adventure", label: "Adventure", icon: "🏔️" },
  { value: "cultural", label: "Cultural", icon: "🏛️" },
  { value: "business", label: "Business", icon: "💼" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
  { value: "solo", label: "Solo Travel", icon: "🚶‍♂️" },
];

export const BUDGET_RANGES = [
  {
    value: "budget",
    label: "Budget-Friendly",
    description: "₹1,000-3,000/day",
    icon: "💰",
  },
  {
    value: "medium",
    label: "Mid-Range",
    description: "₹3,000-7,000/day",
    icon: "💳",
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "₹7,000+/day",
    icon: "👑",
  },
];

export const ACCOMMODATION_TYPES = [
  { value: "hotel", label: "Hotel" },
  { value: "hostel", label: "Hostel" },
  { value: "resort", label: "Resort" },
  { value: "homestay", label: "Homestay" },
];

export const TRANSPORT_TYPES = [
  {
    value: "bus",
    label: "Bus",
    icon: "🚌",
    description: "Comfortable bus services",
  },
  {
    value: "train",
    label: "Train",
    icon: "🚂",
    description: "Railway connections",
  },
  {
    value: "car",
    label: "Car",
    icon: "🚗",
    description: "Car rentals & cabs",
  },
  {
    value: "bike",
    label: "Bike",
    icon: "🏍️",
    description: "Bike rentals",
  },
];

export const INTERESTS = [
  "Historical Sites",
  "Nature & Wildlife",
  "Adventure Sports",
  "Food & Cuisine",
  "Art & Culture",
  "Photography",
  "Shopping",
  "Nightlife",
  "Religious Sites",
  "Museums",
  "Beaches",
  "Mountains",
  "Local Markets",
  "Architecture",
  "Festivals",
  "Wellness & Spa",
];

export const PLACE_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "cultural", label: "Cultural" },
  { value: "historical", label: "Historical" },
  { value: "nature", label: "Nature" },
  { value: "adventure", label: "Adventure" },
  { value: "religious", label: "Religious" },
  { value: "entertainment", label: "Entertainment" },
  { value: "food", label: "Food & Dining" },
  { value: "shopping", label: "Shopping" },
  { value: "beach", label: "Beach" },
  { value: "mountain", label: "Mountain" },
];

export const DURATION_OPTIONS = [
  { value: 1, label: "1 Day" },
  { value: 2, label: "2 Days" },
  { value: 3, label: "3 Days" },
  { value: 4, label: "4 Days" },
  { value: 5, label: "5 Days" },
  { value: 6, label: "6 Days" },
  { value: 7, label: "1 Week" },
];

export const WEATHER_CONDITIONS = {
  sunny: { icon: "☀️", color: "text-yellow-500" },
  cloudy: { icon: "☁️", color: "text-gray-500" },
  rainy: { icon: "🌧️", color: "text-blue-500" },
  clear: { icon: "🌤️", color: "text-blue-400" },
  overcast: { icon: "☁️", color: "text-gray-600" },
  pleasant: { icon: "🌤️", color: "text-green-500" },
};

export const TRIP_STATUS = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  saved: { label: "Saved", color: "bg-blue-100 text-blue-700" },
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  completed: { label: "Completed", color: "bg-purple-100 text-purple-700" },
  smarttrip_planning: {
    label: "SmartTrip Planning",
    color: "bg-purple-100 text-purple-700",
  },
  route_optimized: {
    label: "Route Optimized",
    color: "bg-indigo-100 text-indigo-700",
  },
};

// API Configuration - Updated for Next.js
export const API_CONFIG = {
  timeout: 30000,
  retries: 3,
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
};

// SEARCH BAR SPECIFIC CONFIGURATIONS - GOOGLE MAPS + OSM FALLBACK
export const SEARCH_CONFIG = {
  debounceDelay: 300, // Optimized for Google Maps
  minQueryLength: 2,
  maxSuggestions: 8,
  placeholderText: "Search any place in the world...",
  provider: "google", // Primary provider: "google" or "openstreetmap"
  fallbackProvider: "openstreetmap", // Fallback if primary fails
  colors: {
    primary: "#2EC4B6",
    text: "#111827",
    textSecondary: "#6B7280",
    placeholder: "#9CA3AF",
    border: "#E5E7EB",
    focusBorder: "#2EC4B6",
    background: "#FFFFFF",
    suggestionHover: "#F9FAFB",
    selectedSuggestion: "#EFF6FF",
    osmGreen: "#10B981", // OpenStreetMap brand color
    googleBlue: "#4285F4", // Google Maps brand color
  },
  // Place type configurations for both providers
  placeTypes: {
    // Google Maps types
    Country: { icon: "Globe", color: "text-purple-500" },
    "State/Province": { icon: "Globe", color: "text-blue-500" },
    Region: { icon: "Globe", color: "text-blue-500" },
    City: { icon: "MapPin", color: "text-[#2EC4B6]" },
    District: { icon: "MapPin", color: "text-[#2EC4B6]" },
    Neighborhood: { icon: "MapPin", color: "text-green-500" },
    Area: { icon: "MapPin", color: "text-green-500" },
    Attraction: { icon: "MapPin", color: "text-orange-500" },
    "Point of Interest": { icon: "MapPin", color: "text-orange-500" },
    "Natural Feature": { icon: "MapPin", color: "text-green-600" },
    Park: { icon: "MapPin", color: "text-green-600" },
    Place: { icon: "MapPin", color: "text-gray-500" },
  },
  // Legacy OSM place types (for backward compatibility)
  osmPlaceTypes: {
    country: { icon: "Globe", color: "text-purple-500" },
    city: { icon: "MapPin", color: "text-[#2EC4B6]" },
    town: { icon: "MapPin", color: "text-[#2EC4B6]" },
    village: { icon: "MapPin", color: "text-green-500" },
    attraction: { icon: "MapPin", color: "text-orange-500" },
    "natural feature": { icon: "MapPin", color: "text-green-600" },
    region: { icon: "Globe", color: "text-blue-500" },
    place: { icon: "MapPin", color: "text-gray-500" },
  },
};

export const IMAGE_CONFIG = {
  fallbackImages: {},
  sizes: {
    thumbnail: "300x200",
    card: "400x300",
    hero: "800x500",
    gallery: "600x400",
  },
};

export const VALIDATION_RULES = {
  trip: {
    startingCity: {
      required: true,
      minLength: 2,
      message: "Starting city is required",
    },
    destinations: {
      required: true,
      minItems: 1,
      maxItems: 5,
      message: "At least one destination is required",
    },
    travelers: {
      min: 1,
      max: 20,
      message: "Number of travelers must be between 1 and 20",
    },
    duration: {
      min: 1,
      max: 30,
      message: "Trip duration must be between 1 and 30 days",
    },
    dateRange: {
      futureOnly: true,
      message: "Travel dates must be in the future",
    },
  },
  search: {
    query: {
      minLength: 2,
      message: "Search query must be at least 2 characters",
    },
  },
};

export const STORAGE_KEYS = {
  savedTrips: "savedTrips",
  userPreferences: "userPreferences",
  searchHistory: "searchHistory",
  recentDestinations: "recentDestinations",
  apiCache: "destination_api_cache_",
  osmCache: "osm_search_cache_",
};

export const ERROR_MESSAGES = {
  network: "Network error. Please check your connection.",
  timeout: "Request timed out. Please try again.",
  notFound: "The requested resource was not found.",
  serverError: "Server error. Please try again later.",
  validation: "Please check your input and try again.",
  generic: "Something went wrong. Please try again.",
  searchEmpty: "Please enter a search term",
  searchTooShort: "Search term must be at least 2 characters",
  suggestionsUnavailable: "Unable to fetch suggestions",
  osmRateLimit: "Search temporarily unavailable. Please wait a moment.",
  osmError: "Unable to search locations. Please try again.",
};

export const SUCCESS_MESSAGES = {
  tripSaved: "Trip saved successfully!",
  tripDeleted: "Trip deleted successfully!",
  tripUpdated: "Trip updated successfully!",
  itineraryCreated: "Itinerary created successfully!",
  dataCopied: "Data copied to clipboard!",
  searchCompleted: "Search completed successfully!",
};

export const FEATURES = {
  enableOfflineMode: false,
  enablePushNotifications: false,
  enableAdvancedFilters: true,
  enableSocialSharing: true,
  enableWeatherIntegration: true,
  enableBudgetTracking: true,
  enableRealTimeUpdates: false,
  enableSmartTripAI: true,
  enableModeSelection: true,
  enableOSMSearch: true, // New feature flag
  enableAutoCorrection: false, // Can be toggled based on backend availability
};

export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
  pageTransition: 200,
  modalOpen: 250,
  modalClose: 200,
};

export const DEBOUNCE_DELAYS = {
  search: 400, // Increased for OSM rate limiting
  autocomplete: 300,
  formValidation: 500,
  apiCall: 1000,
};

// SMARTTRIP CONSTANTS
export const PLANNING_MODES = {
  PLAN_MY_WAY: {
    id: "plan_my_way",
    name: "Plan My Way",
    description: "I know what I want, guide me through it",
    icon: "Compass",
    color: COLORS.primary,
    features: [
      "Select your own destinations",
      "Choose duration for each city",
      "AI-curated daily experiences",
      "Personalized recommendations",
    ],
  },
  SMARTTRIP_AI: {
    id: "smarttrip_ai",
    name: "SmartTrip AI",
    description: "Just tell us where, and we'll take care of the rest",
    icon: "Sparkles",
    color: COLORS.secondary,
    features: [
      "AI-designed multi-city routes",
      "Automatic overnight stops",
      "Optimized time allocation",
      "White-glove travel experience",
    ],
  },
};

export const TRAVEL_STYLES = [
  {
    id: "relaxed",
    name: "Relaxed Explorer",
    description: "2-3 experiences per day, more time to soak in each place",
    icon: "🌅",
    color: "text-green-600",
    bgColor: "bg-green-50",
    activitiesPerDay: 2,
  },
  {
    id: "balanced",
    name: "Balanced Adventurer",
    description: "Perfect mix of exploration and relaxation",
    icon: "⚖️",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    activitiesPerDay: 3,
  },
  {
    id: "packed",
    name: "Experience Maximizer",
    description: "See and do as much as possible in your time",
    icon: "⚡",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    activitiesPerDay: 4,
  },
];

export const SMARTTRIP_ENDPOINTS = {
  createSmartTrip: "/trip-planning/create-smarttrip-itinerary",
  validateRoute: "/trip-planning/validate-smarttrip-route",
  routePreview: "/trip-planning/smarttrip-route-preview",
  compareModes: "/trip-planning/compare-planning-modes",
};

export const MODE_THEMES = {
  plan_my_way: {
    primary: COLORS.primary,
    secondary: COLORS.white,
    accent: "#1DA599",
    background: "from-[#2EC4B6]/10 to-[#2EC4B6]/5",
    border: "border-[#2EC4B6]",
    text: "text-[#2EC4B6]",
    hover: "hover:bg-[#2EC4B6]/10",
  },
  smarttrip_ai: {
    primary: COLORS.secondary,
    secondary: COLORS.white,
    accent: "#E55555",
    background: "from-[#FF6B6B]/10 to-[#FFE66D]/5",
    border: "border-[#FF6B6B]",
    text: "text-[#FF6B6B]",
    hover: "hover:bg-[#FF6B6B]/10",
  },
};

export const SMARTTRIP_VALIDATION = {
  route: {
    minDays: 1,
    maxDays: 30,
    requiredFields: ["startingCity", "destinationCity", "totalDays"],
  },
  cities: {
    minLength: 2,
    requireDifferent: true,
  },
};

export const SMARTTRIP_ERRORS = {
  SAME_CITIES: "Starting and destination cities must be different",
  CITIES_REQUIRED: "Both starting and destination cities are required",
  INVALID_DAYS: "Total days must be between 1 and 30",
  ROUTE_NOT_FEASIBLE: "No feasible route found between selected cities",
};

export const SMARTTRIP_SUCCESS = {
  ROUTE_VALIDATED: "Route looks great! Ready to create your SmartTrip",
  ITINERARY_CREATED: "Your SmartTrip itinerary is ready!",
  SMARTTRIP_SAVED: "SmartTrip saved successfully!",
};

export const MODE_ANIMATIONS = {
  selectionDuration: 300,
  hoverScale: 1.02,
  transitionEasing: "cubic-bezier(0.4, 0, 0.2, 1)",
};

export const FILTER_OPTIONS = {
  CATEGORIES: PLACE_CATEGORIES,
  BUDGET: BUDGET_RANGES.map((range) => ({
    value: range.value,
    label: range.label,
  })),
  DURATION: DURATION_OPTIONS.map((duration) => ({
    value:
      duration.value === 7 ? "long" : duration.value <= 3 ? "short" : "medium",
    label:
      duration.value === 7
        ? "Long (7+ days)"
        : duration.value <= 3
        ? "Short (1-3 days)"
        : "Medium (3-7 days)",
  })).filter(
    (item, index, self) =>
      index === self.findIndex((t) => t.value === item.value)
  ),
};

export const THEME_COLORS = {
  PRIMARY: COLORS.primary,
  SECONDARY: COLORS.highlight,
  ACCENT: COLORS.secondary,
  DARK: COLORS.text,
  GRAY: COLORS.background,
};

export const APP_CONFIG = {
  NAME: "PrayanaAI",
  VERSION: "1.0.0",
  API_BASE_URL: API_CONFIG.baseURL,
  OSM_BASE_URL: OPENSTREETMAP_CONFIG.nominatimBaseUrl,
  DEFAULT_PAGINATION: {
    INITIAL_LIMIT: 10,
    LOAD_MORE_LIMIT: 20,
    MAX_SUGGESTIONS: 8,
  },
};

// Create constants object for default export
const constants = {
  COLORS,
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
};

export default constants;
