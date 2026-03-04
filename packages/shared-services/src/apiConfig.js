// services/apiConfig.js - Shared API configuration for React Native monorepo
// Adapted from Next.js version: removed SSR guards, added setBaseURL for runtime config

// Configurable base URL - apps call setBaseURL() at startup
let _baseURL = "http://localhost:5000/api";

/**
 * Set the API base URL at app startup.
 * Call this before any API calls are made.
 * @param {string} url - The base URL for the API (e.g., "https://prayanaai.com/api")
 */
export const setBaseURL = (url) => {
  _baseURL = url;
};

/**
 * Get the current API base URL.
 * @returns {string}
 */
export const getBaseURL = () => _baseURL;

export const API_CONFIG = {
  get BASE_URL() {
    return _baseURL;
  },
  ENDPOINTS: {
    // Destination endpoints
    DESTINATIONS: {
      SEARCH: "/destinations/search",
      AI_SEARCH: "/destinations/ai-search",
      AI_SEARCH_GLOBAL: "/destinations/ai-search-global",
      AI_SEARCH_PAGINATED: "/destinations/ai-search-paginated",
      AI_DETAILS: "/destinations/ai-details",
      FEATURED: "/destinations/featured",
      RECOMMENDED: "/destinations/recommended",
      GLOBAL_AUTOCOMPLETE: "/destinations/global-autocomplete",
      AUTO_CORRECT: "/destinations/auto-correct",
      NEARBY: "/destinations/nearby",
      TRANSPORTATION: "/destinations/transportation",
      PLACE_IMAGES: "/destinations/place-images",
      WEATHER: "/destinations/weather",
      REVIEWS: "/destinations/reviews",
      EVENTS: "/destinations/events",
      STATUS_ENHANCED: "/destinations/status/enhanced",
    },

    CHAT: {
      // Core chat operations
      SEND_MESSAGE: "/chat/send",
      GET_HISTORY: "/chat/history/:sessionId",
      START_SESSION: "/chat/session/start",
      END_SESSION: "/chat/session/:sessionId/end",

      // Context operations
      UPDATE_CONTEXT: "/chat/context",
      GET_SUGGESTIONS: "/chat/suggestions",
      HANDLE_ACTION: "/chat/action/:actionType",

      // Session management
      LIST_SESSIONS: "/chat/sessions",
      DELETE_SESSION: "/chat/session/:sessionId",
      CLEAR_HISTORY: "/chat/clear",

      // Real-time (WebSocket endpoints)
      CONNECT: "/chat/connect",
      TYPING: "/chat/typing",
      STATUS: "/chat/status",
    },

    // Itinerary endpoints - FIXED
    ITINERARIES: {
      // Core CRUD operations
      CREATE: "/itinerary",
      GET_BY_ID: "/itinerary/:id",
      UPDATE: "/itinerary/:id",
      DELETE: "/itinerary/:id",

      // Itinerary generation - FIXED TO MATCH YOUR BACKEND
      GENERATE: "/itinerary/generate",
      GENERATE_AI: "/itinerary/generate/ai",
      GENERATE_CUSTOM: "/itinerary/generate/custom",

      // Search and discovery - FIXED
      SEARCH: "/itinerary/search",
      POPULAR: "/itinerary/popular",
      TRENDING: "/itinerary/trending",
      FEATURED: "/itinerary/featured",
      RECOMMENDED: "/itinerary/recommended",

      // User-specific operations
      USER_ITINERARIES: "/users/:userId/itinerary",
      SAVED_ITINERARIES: "/users/:userId/itinerary/saved",
      CREATED_ITINERARIES: "/users/:userId/itinerary/created",

      // Bookmarking and favorites - FIXED
      BOOKMARK: "/itinerary/:id/bookmark",
      UNBOOKMARK: "/itinerary/:id/bookmark",
      TOGGLE_BOOKMARK: "/itinerary/:id/bookmark/toggle",

      // Sharing and collaboration - FIXED
      SHARE: "/itinerary/:id/share",
      CLONE: "/itinerary/:id/clone",
      EXPORT: "/itinerary/:id/export",

      // Analytics and insights - FIXED
      ANALYTICS: "/itinerary/:id/analytics",
      STATS: "/itinerary/stats",

      // Reviews and ratings - FIXED
      REVIEWS: "/itinerary/:id/reviews",
      RATE: "/itinerary/:id/rate",

      // Template operations - FIXED
      TEMPLATES: "/itinerary/templates",
      CREATE_TEMPLATE: "/itinerary/:id/template",

      // Optimization - FIXED
      OPTIMIZE: "/itinerary/:id/optimize",
      SUGGEST_IMPROVEMENTS: "/itinerary/:id/suggestions",

      // Real-time features - FIXED
      LIVE_TRACKING: "/itinerary/:id/tracking",
      STATUS_UPDATE: "/itinerary/:id/status",
    },

    // Transportation endpoints
    TRANSPORTATION: {
      OPTIONS: "/transportation/options",
      VENDORS: "/transportation/vendors",
      BOOK: "/transportation/book",
      TRACK: "/transportation/track",
      CANCEL: "/transportation/cancel",
    },

    // User endpoints
    USERS: {
      PROFILE: "/users/profile",
      PREFERENCES: "/users/preferences",
      STATS: "/users/stats",
      TRAVEL_HISTORY: "/users/travel-history",
    },

    // Additional utility endpoints
    UTILITIES: {
      GEOCODING: "/utilities/geocoding",
      WEATHER: "/utilities/weather",
      CURRENCY: "/utilities/currency",
      TIMEZONE: "/utilities/timezone",
    },
  },

  TIMEOUTS: {
    DEFAULT: 30000,             // 30s - generous for mobile networks (was 15s, caused AbortError loops)
    SEARCH: 25000,              // 25s for search/autocomplete endpoints
    LONG_OPERATION: 75000,
    IMAGE_REQUESTS: 10000,
    ITINERARY_GENERATION: 60000, // 60s timeout for AI generation (must be >= 60s or aborts silently)
    CHAT_MESSAGE: 20000,        // 20 seconds for chat messages
    CHAT_ACTION: 15000,         // 15 seconds for chat actions
    WEBSOCKET_CONNECT: 5000,
  },

  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000,
    EXPONENTIAL_BACKOFF: true,
  },

  // HTTP Methods
  METHODS: {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    DELETE: "DELETE",
  },

  // Response status codes
  STATUS_CODES: {
    SUCCESS: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
  },
};

// Helper function to replace URL parameters
export const replaceUrlParams = (endpoint, params = {}) => {
  let url = endpoint;
  Object.keys(params).forEach((key) => {
    url = url.replace(`:${key}`, params[key]);
  });
  return url;
};

// ===== Auth token injection =====
// Apps must call setAuthTokenProvider() at startup to provide a function
// that returns the current Firebase auth token.
let _getAuthToken = async () => null;

/**
 * Set the auth token provider function.
 * This replaces the direct Firebase import used in the Next.js version.
 * @param {() => Promise<string|null>} tokenProvider - Async function returning the current auth token
 */
export const setAuthTokenProvider = (tokenProvider) => {
  _getAuthToken = tokenProvider;
};

/**
 * Get the current auth token using the injected provider.
 * @returns {Promise<string|null>}
 */
export const getAuthToken = async () => {
  return _getAuthToken();
};

/**
 * Get auth headers using the injected token provider.
 * @returns {Promise<Object>}
 */
export const getAuthHeaders = async () => {
  const token = await _getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Enhanced API call function with better error handling
export const makeAPICall = async (endpoint, options = {}) => {
  const { retries = 0, signal: externalSignal, ...requestOptions } = options;

  // Use external signal if provided, otherwise create internal AbortController
  const useExternalSignal = !!externalSignal;
  const controller = useExternalSignal ? null : new AbortController();
  const signal = externalSignal || controller.signal;

  // Only set timeout if we're managing our own controller
  const timeoutId = !useExternalSignal
    ? setTimeout(() => {
        controller.abort();
      }, requestOptions.timeout || API_CONFIG.TIMEOUTS.DEFAULT)
    : null;

  try {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const { headers: callerHeaders, ...restOptions } = requestOptions;

    // Don't set Content-Type for FormData -- browser/RN sets it automatically
    // with the correct multipart boundary. Setting it manually breaks file uploads.
    const isFormData = restOptions.body instanceof FormData;
    // Auto-inject auth token if not already provided by the caller
    const authHeaders = callerHeaders?.Authorization ? {} : await getAuthHeaders();

    const config = {
      ...restOptions,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...authHeaders,
        ...callerHeaders,
      },
    };

    console.log(`[API] ${requestOptions.method || "GET"} ${url}`);

    const response = await fetch(url, {
      ...config,
      signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();

      // Don't log 404s as errors -- they're expected "not found" responses
      if (response.status !== 404) {
        console.error(`[API] HTTP ${response.status}:`, errorText);
      }

      // Create error object with status code
      const error = new Error(
        `HTTP error! status: ${response.status} - ${errorText}`
      );
      error.status = response.status;
      error.statusText = response.statusText;
      throw error;
    }

    const data = await response.json();
    console.log(
      `[API] Response:`,
      data.success ? "Success" : "Failed",
      data.message || ""
    );

    // Debug: Log response structure for chat/search endpoints
    if (endpoint.includes('chat') || endpoint.includes('ai-search')) {
      console.log(`[API] Response structure for ${endpoint}:`, {
        hasData: !!data.data,
        dataLength: Array.isArray(data.data) ? data.data.length : 'not an array',
        hasHeroContent: !!data.heroContent,
        hasLocationIntelligence: !!data.locationIntelligence,
        responseKeys: Object.keys(data)
      });
    }

    return data;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);

    // Don't log 404s -- they're expected "not found" responses, not errors
    if (error.status !== 404) {
      console.error(`[API] Error for ${endpoint}:`, error);
    }

    // Don't retry if using external signal (caller manages retries)
    if (useExternalSignal) {
      throw error;
    }

    // Retry logic for network errors (NOT for 429 rate limits or timeouts)
    // AbortError from our own timeout should NOT be retried -- same timeout will just abort again
    const isOurTimeout = error.name === "AbortError" && !useExternalSignal;
    if (
      retries < API_CONFIG.RETRY.MAX_ATTEMPTS &&
      error.status !== 429 &&
      !isOurTimeout &&
      (error.message.includes("fetch") ||
        error.message.includes("Network request failed") ||
        error.status >= 500)
    ) {
      const delay = API_CONFIG.RETRY.EXPONENTIAL_BACKOFF
        ? API_CONFIG.RETRY.DELAY * Math.pow(2, retries)
        : API_CONFIG.RETRY.DELAY;

      console.log(`[API] Retrying in ${delay}ms... (attempt ${retries + 1})`);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return makeAPICall(endpoint, { ...options, retries: retries + 1 });
    }

    // Better error message for timeouts
    if (isOurTimeout) {
      const timeout = requestOptions.timeout || API_CONFIG.TIMEOUTS.DEFAULT;
      console.warn(`[API] Request to ${endpoint} timed out after ${timeout}ms`);
      error.message = `Request timed out after ${timeout}ms`;
    }

    throw error;
  }
};

// Specialized API call for itineraries
export const makeItineraryAPICall = async (endpoint, options = {}) => {
  return makeAPICall(endpoint, {
    timeout: API_CONFIG.TIMEOUTS.ITINERARY_GENERATION,
    ...options,
  });
};

// Helper functions for common API patterns
export const apiHelpers = {
  // Build query string from parameters
  buildQueryString: (params) => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        searchParams.append(key, params[key]);
      }
    });
    return searchParams.toString();
  },

  // Get endpoint with parameters replaced
  getEndpoint: (endpointPath, params = {}) => {
    return replaceUrlParams(endpointPath, params);
  },

  // Format error messages
  formatError: (error) => {
    if (error.status === 404) {
      return "Resource not found";
    } else if (error.status === 401) {
      return "Authentication required";
    } else if (error.status === 403) {
      return "Access denied";
    } else if (error.status >= 500) {
      return "Server error. Please try again later.";
    } else {
      return error.message || "An unexpected error occurred";
    }
  },
};

// Specialized API call for chat (if not already present)
export const makeChatAPICall = async (endpoint, options = {}) => {
  return makeAPICall(endpoint, {
    timeout: API_CONFIG.TIMEOUTS.CHAT_MESSAGE,
    ...options,
  });
};
