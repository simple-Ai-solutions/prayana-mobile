/**
 * Country Content API Client
 * Handles all requests for location-based homepage content
 * Adapted for React Native: uses API_CONFIG.BASE_URL instead of process.env
 */

import { API_CONFIG } from "../apiConfig";

// Client-side cache (5 minutes)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class CountryContentAPI {
  get baseURL() {
    return `${API_CONFIG.BASE_URL}/country-content`;
  }

  /**
   * Get from cache or make request
   */
  async cachedRequest(key, requestFn) {
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[Cache] HIT: ${key}`);
      return cached.data;
    }

    const data = await requestFn();
    cache.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Get all content for a country (auto-generates if needed)
   */
  async getCountryContent(countryCode, countryName) {
    const cacheKey = `country:${countryCode}`;

    return this.cachedRequest(cacheKey, async () => {
      const params = new URLSearchParams();
      if (countryName) {
        params.append('countryName', countryName);
      }

      const response = await fetch(
        `${this.baseURL}/${countryCode}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch country content: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    });
  }

  /**
   * Get top 20 destinations for a country
   */
  async getTopDestinations(countryCode, countryName) {
    const cacheKey = `destinations:${countryCode}`;

    return this.cachedRequest(cacheKey, async () => {
      const params = new URLSearchParams();
      if (countryName) {
        params.append('countryName', countryName);
      }

      const response = await fetch(
        `${this.baseURL}/${countryCode}/destinations?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch destinations: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    });
  }

  /**
   * Get visa-free countries for passport holders
   */
  async getVisaFreeCountries(countryCode, countryName) {
    const cacheKey = `visa-free:${countryCode}`;

    return this.cachedRequest(cacheKey, async () => {
      const params = new URLSearchParams();
      if (countryName) {
        params.append('countryName', countryName);
      }

      const response = await fetch(
        `${this.baseURL}/${countryCode}/visa-free?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch visa-free countries: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    });
  }

  /**
   * Get European trekking destinations
   */
  async getEuropeanTrekking() {
    const cacheKey = 'trekking:europe';

    return this.cachedRequest(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/trekking/europe`);

      if (!response.ok) {
        throw new Error(`Failed to fetch trekking destinations: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    });
  }

  /**
   * Get interest categories for a region
   */
  async getInterestContent(region) {
    const cacheKey = `interests:${region}`;

    return this.cachedRequest(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/interests/${region}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch interest content: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    });
  }

  /**
   * Get global content (India top 20, world regions)
   */
  async getGlobalContent(type) {
    const cacheKey = `global:${type}`;

    return this.cachedRequest(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/global/${type}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch global content: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    });
  }

  /**
   * Clear client cache
   */
  clearCache() {
    cache.clear();
    console.log('[Cache] Client cache cleared');
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const response = await fetch(`${this.baseURL}/stats/overview`);

    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }
}

// Export singleton instance
const countryContentAPI = new CountryContentAPI();

export default countryContentAPI;

// Named exports for specific methods
export const {
  getCountryContent,
  getTopDestinations,
  getVisaFreeCountries,
  getEuropeanTrekking,
  getInterestContent,
  getGlobalContent,
  clearCache,
  getStatistics
} = countryContentAPI;
