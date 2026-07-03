// services/api/hotelAPI.js
// Adapted for React Native: removed axios, uses fetch with configurable URLs

// Configurable hotel API URLs
let _searchAPIURL = 'http://localhost:3001';
let _supplierAPIURL = 'http://localhost:3004';

/**
 * Set the hotel search API base URL.
 * @param {string} url
 */
export const setHotelSearchAPIURL = (url) => {
  _searchAPIURL = url;
};

/**
 * Set the hotel supplier API base URL.
 * @param {string} url
 */
export const setHotelSupplierAPIURL = (url) => {
  _supplierAPIURL = url;
};

// Generic fetch wrapper
async function apiFetch(baseURL, path, options = {}) {
  const url = `${baseURL}${path}`;
  const config = {
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  console.log(`[Hotel API] ${config.method || 'GET'} ${url}`);

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`[Hotel API] Response: ${response.status} ${url}`);
  return data;
}

/**
 * Hotel API Service
 * Communicates with backend microservices for hotel search and supplier management
 */
const hotelAPI = {
  /**
   * Check supplier service health
   */
  checkSupplierHealth: async () => {
    try {
      return await apiFetch(_supplierAPIURL, '/health');
    } catch (error) {
      console.error('Supplier service health check failed:', error);
      return { status: 'unavailable', error: error.message };
    }
  },

  /**
   * Check search service health
   */
  checkSearchHealth: async () => {
    try {
      return await apiFetch(_searchAPIURL, '/health');
    } catch (error) {
      console.error('Search service health check failed:', error);
      return { status: 'unavailable', error: error.message };
    }
  },

  /**
   * Get list of available suppliers
   */
  getSuppliers: async () => {
    try {
      return await apiFetch(_supplierAPIURL, '/suppliers');
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      throw error;
    }
  },

  /**
   * Search hotels across all suppliers
   * @param {Object} searchParams - Search parameters
   */
  searchHotels: async (searchParams) => {
    try {
      return await apiFetch(_supplierAPIURL, '/search', {
        method: 'POST',
        body: JSON.stringify(searchParams),
      });
    } catch (error) {
      console.error('Hotel search failed:', error);
      throw error;
    }
  },

  /**
   * Get deals for a specific hotel
   * @param {Object} dealParams - Deal parameters
   */
  getHotelDeals: async (dealParams) => {
    try {
      return await apiFetch(_supplierAPIURL, '/deals', {
        method: 'POST',
        body: JSON.stringify(dealParams),
      });
    } catch (error) {
      console.error('Failed to fetch hotel deals:', error);
      throw error;
    }
  },

  /**
   * Generate affiliate URL for booking
   * @param {Object} affiliateParams - Affiliate parameters
   */
  generateAffiliateUrl: async (affiliateParams) => {
    try {
      return await apiFetch(_supplierAPIURL, '/affiliate-url', {
        method: 'POST',
        body: JSON.stringify(affiliateParams),
      });
    } catch (error) {
      console.error('Failed to generate affiliate URL:', error);
      throw error;
    }
  },

  /**
   * Get hotel details from specific supplier
   * @param {string} supplierCode - Supplier code
   * @param {string} hotelId - Hotel ID
   */
  getHotelDetails: async (supplierCode, hotelId) => {
    try {
      return await apiFetch(_supplierAPIURL, `/supplier/${supplierCode}/hotel/${hotelId}`);
    } catch (error) {
      console.error('Failed to fetch hotel details:', error);
      throw error;
    }
  },
};

export default hotelAPI;
