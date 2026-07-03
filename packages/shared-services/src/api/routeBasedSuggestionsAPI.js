/**
 * Route-Based Suggestions API
 * Generates different activity suggestions for each day based on route and location
 * Adapted for React Native: removed process.env reference for Google Maps key
 */

import { API_CONFIG } from "../apiConfig";

class RouteBasedSuggestionsAPI {
  constructor() {
    this.suggestionsCache = new Map();
  }

  /**
   * Get activity suggestions specific to the day's route and time slot
   */
  async getRouteSuggestions(dayInfo) {
    const {
      dayNumber,
      destination,
      timeSlot,
      tripType,
      route = [],
      previousSuggestions = [],
      currentLocation = null
    } = dayInfo;

    const cacheKey = `${dayNumber}_${destination}_${timeSlot}`;

    // Check cache first
    if (this.suggestionsCache.has(cacheKey)) {
      console.log(`[RouteAPI] Using cached suggestions for Day ${dayNumber} ${timeSlot}`);
      return this.suggestionsCache.get(cacheKey);
    }

    console.log(`[RouteAPI] Fetching AI suggestions for Day ${dayNumber} in ${destination} (${timeSlot})`);

    try {
      // Determine search location based on time slot and route
      const searchLocation = this.getSearchLocationForTimeSlot(
        timeSlot,
        destination,
        route
      );

      // Call backend API for AI-powered suggestions
      const suggestions = await this.fetchFromBackend(
        searchLocation,
        dayNumber,
        timeSlot,
        tripType,
        previousSuggestions,
        currentLocation
      );

      // Cache the results
      this.suggestionsCache.set(cacheKey, suggestions);

      return suggestions;
    } catch (error) {
      console.error('Route suggestions error:', error);
      return this.generateFallbackSuggestions(destination, 5);
    }
  }

  /**
   * Fetch suggestions from backend API
   */
  async fetchFromBackend(destination, dayNumber, timeSlot, tripType, previousSuggestions, currentLocation) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/trip-suggestions/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          dayNumber,
          timeSlot,
          tripType,
          existingActivities: previousSuggestions.map(s => ({ name: s.name })),
          currentLocation
        })
      });

      if (!response.ok) {
        console.warn(`[RouteAPI] Backend API returned ${response.status}`);
        return this.generateFallbackSuggestions(destination, 5);
      }

      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        console.log(`[RouteAPI] Got ${data.data.length} AI suggestions from backend`);
        return data.data;
      }

      console.warn('[RouteAPI] Backend returned empty data');
      return this.generateFallbackSuggestions(destination, 5);
    } catch (error) {
      console.error('Backend API error:', error);
      return this.generateFallbackSuggestions(destination, 5);
    }
  }

  /**
   * Determine where to search based on time slot and route
   */
  getSearchLocationForTimeSlot(timeSlot, destination, route) {
    if (route.length === 0) {
      return destination;
    }

    switch (timeSlot) {
      case 'morning':
        return route[0] || destination;

      case 'afternoon':
        if (route.length >= 2) {
          const midIndex = Math.floor(route.length / 2);
          return route[midIndex];
        }
        return destination;

      case 'evening':
      case 'night':
        return route[route.length - 1] || destination;

      default:
        return destination;
    }
  }

  /**
   * Get place types to search based on time slot and trip type
   */
  getPlaceTypesForTimeSlot(timeSlot, tripType = 'leisure') {
    const baseTypes = {
      morning: [
        'tourist_attraction',
        'park',
        'museum',
        'place_of_worship',
        'cafe',
        'bakery'
      ],
      afternoon: [
        'tourist_attraction',
        'restaurant',
        'museum',
        'shopping_mall',
        'point_of_interest',
        'natural_feature'
      ],
      evening: [
        'restaurant',
        'cafe',
        'bar',
        'shopping_mall',
        'park',
        'tourist_attraction'
      ],
      night: [
        'restaurant',
        'bar',
        'night_club',
        'entertainment'
      ]
    };

    // Adjust based on trip type
    if (tripType === 'adventure') {
      baseTypes.morning.unshift('park', 'natural_feature', 'mountain');
      baseTypes.afternoon.unshift('park', 'natural_feature', 'hiking_area');
    } else if (tripType === 'cultural') {
      baseTypes.morning.unshift('museum', 'art_gallery', 'place_of_worship');
      baseTypes.afternoon.unshift('museum', 'historical_site', 'cultural_center');
    } else if (tripType === 'religious') {
      baseTypes.morning.unshift('place_of_worship', 'temple', 'church', 'mosque');
      baseTypes.afternoon.unshift('place_of_worship', 'monastery', 'shrine');
    }

    return baseTypes[timeSlot] || baseTypes.afternoon;
  }

  /**
   * Get category from Google place types
   */
  getCategoryFromTypes(types = []) {
    const categoryMap = {
      tourist_attraction: 'attraction',
      museum: 'museum',
      restaurant: 'restaurant',
      cafe: 'cafe',
      park: 'nature',
      place_of_worship: 'religious',
      temple: 'religious',
      church: 'religious',
      mosque: 'religious',
      monastery: 'religious',
      shopping_mall: 'shopping',
      night_club: 'nightlife',
      bar: 'nightlife',
      natural_feature: 'nature',
      mountain: 'nature',
      lake: 'nature',
    };

    for (const type of types) {
      if (categoryMap[type]) {
        return categoryMap[type];
      }
    }

    return 'other';
  }

  /**
   * Estimate duration based on place type
   */
  estimateDuration(types = []) {
    const durationMap = {
      museum: '2-3h',
      restaurant: '1-2h',
      cafe: '30min-1h',
      park: '1-2h',
      tourist_attraction: '1.5-2h',
      place_of_worship: '30min-1h',
      shopping_mall: '2-3h',
      natural_feature: '1-2h',
    };

    for (const type of types) {
      if (durationMap[type]) {
        return durationMap[type];
      }
    }

    return '1-2h';
  }

  /**
   * Generate fallback suggestions when API is unavailable
   */
  generateFallbackSuggestions(location, count) {
    const templates = [
      { name: 'Explore', category: 'exploration' },
      { name: 'Visit', category: 'sightseeing' },
      { name: 'Discover', category: 'discovery' },
      { name: 'Experience', category: 'experience' },
      { name: 'Enjoy', category: 'leisure' },
    ];

    return templates.slice(0, count).map((template, i) => ({
      name: `${template.name} ${location}`,
      description: `Popular ${template.category} activity in ${location}`,
      category: template.category,
      estimatedDuration: '1-2h',
      source: 'fallback'
    }));
  }

  /**
   * Clear cache (useful when switching trips)
   */
  clearCache() {
    this.suggestionsCache.clear();
  }
}

export const routeBasedSuggestionsAPI = new RouteBasedSuggestionsAPI();
