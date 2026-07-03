// services/api/destinationAPI.js - COMPLETE VERSION with Enrichment Polling
// Adapted for React Native: removed image utility imports (platform-specific concern)

import { API_CONFIG, getBaseURL, makeAPICall } from "../apiConfig";

/**
 * Resolve image URLs for React Native.
 * Server may return relative proxy URLs like "/api/images/proxy?url=..."
 * which work in web browsers but fail in React Native (needs absolute URLs).
 * Uses getBaseURL() as fallback if shared-utils setImageServerOrigin wasn't called.
 */
const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  // Already absolute — leave as-is (S3, Google direct, etc.)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative proxy URL — prepend the API server origin
  if (url.startsWith('/')) {
    const baseUrl = getBaseURL(); // e.g. "http://192.168.31.185:5000/api"
    const serverOrigin = baseUrl.replace(/\/api\/?$/, '');
    return `${serverOrigin}${url}`;
  }
  return url;
};

// Helper function to transform AI search results to expected format
const transformAISearchResult = (place, location) => {
  // Handle various field name formats from the API
  const bestTime =
    place.bestTimeToVisit ||
    place["best time to visit"] ||
    place["Best Time to Visit"];

  // FIXED: Ensure location is always a string
  let locationString = place.location;
  if (typeof place.location === "object" && place.location !== null) {
    locationString = place.location.address || location;
  } else if (!locationString) {
    locationString = location;
  }

  // FIXED: Extract image from imageUrls array if image is not set
  // FIXED: Resolve relative proxy URLs to absolute for React Native
  const rawImageUrl = place.image || place.imageUrls?.[0] || null;
  const imageUrl = resolveImageUrl(rawImageUrl);
  const resolvedImageUrls = (place.imageUrls || (rawImageUrl ? [rawImageUrl] : []))
    .map(resolveImageUrl)
    .filter(Boolean);

  // Ensure the place has the expected structure
  return {
    id: place.id || `place-${Date.now()}-${Math.random()}`,
    name: place.name || "Unknown Place",
    description: place.description || "No description available",
    category: place.category || "cultural",
    rating: parseFloat(place.rating || place.ratings || 4.0),
    image: imageUrl,
    imageUrls: resolvedImageUrls,
    location: locationString,
    country: place.country || place.locationData?.country || "Unknown",
    highlights:
      place.highlights ||
      [
        bestTime && `Best time: ${bestTime}`,
        place.season && `Season: ${place.season}`,
        place.month && `Month: ${place.month}`,
        place.famous_for && `Famous for: ${place.famous_for}`,
      ]
        .filter(Boolean)
        .slice(0, 3),
    entryFee: place.entry_fee || place.entryFee || "Free",
    openingHours: place.opening_hours || place.openingHours || "9 AM - 6 PM",
    duration: place.duration || "2-3 hours",
    tips: place.tips || [
      "Visit early morning",
      "Carry water",
      "Respect local customs",
    ],
    metadata: {
      bestTimeToVisit: bestTime,
      month: place.month,
      season: place.season,
      famousFor: place.famous_for,
      nearbyPlaces: place.nearby_places,
      streamingEnabled: place.metadata?.streamingEnabled || false,
      source: place.metadata?.source || "unknown",
      ...place.metadata,
    },
  };
};

export class DestinationAPI {
  constructor() {
    // Request tracking for better performance
    this.requestCache = new Map();
    this.pendingRequests = new Map();

    // Streaming configuration
    this.streamingConfig = {
      enabled: true,
      timeout: 60000,
      fallbackOnError: true,
      retryAttempts: 1,
    };

    // Active streams tracking
    this.activeStreams = new Map();
  }

  // Enhanced request deduplication
  async makeRequest(key, requestFn) {
    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      console.log(`[API] Waiting for pending request: ${key}`);
      return this.pendingRequests.get(key);
    }

    // Check cache (2 minutes for API responses for faster repeat searches)
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < 120000) {
      console.log(`[Cache] Using cached API response: ${key}`);
      return cached.data;
    }

    // Make new request
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;

      // Cache successful results
      if (result.success) {
        this.requestCache.set(key, {
          data: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error(`API request failed for ${key}:`, error);
      throw error;
    }
  }

  // ===== ENRICHMENT STATUS POLLING METHODS =====

  /**
   * Check enrichment status for a search query
   * @param {string} searchQuery - The search query to check
   * @returns {Promise<Object>} Enrichment status data
   */
  async getEnrichmentStatus(searchQuery) {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/destinations/enrichment-status/${encodeURIComponent(searchQuery)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[API] Enrichment status check failed:', error);
      return {
        success: false,
        found: false,
        error: error.message,
      };
    }
  }

  /**
   * Refetch search results (after enrichment)
   * @param {string} searchQuery - The search query to refetch
   * @returns {Promise<Object>} Updated search results
   */
  async refetchEnrichedResults(searchQuery) {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/destinations/enrichment-refetch/${encodeURIComponent(searchQuery)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[API] Enrichment refetch failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ===== STREAMING SEARCH METHODS =====

  async aiSearchWithStreaming(
    location,
    filters = {},
    options = {},
    onStreamResult = null,
    onStreamError = null,
    onStreamComplete = null
  ) {
    const {
      useCache = true,
      forceRefresh = false,
      enableStreaming = this.streamingConfig.enabled,
      page = 1,
      limit = 50,
    } = options;

    if (!location || location.trim().length < 2) {
      throw new Error("Location must be at least 2 characters long");
    }

    // **PRIMARY: Try Streaming Search**
    if (enableStreaming && onStreamResult) {
      try {
        console.log(`[API] Starting STREAMING search for: "${location}"`);

        const streamResult = await this.performStreamingSearch(
          location,
          filters,
          { page, limit, useCache, forceRefresh },
          onStreamResult,
          onStreamError,
          onStreamComplete
        );

        console.log(`[API] Streaming search completed for: "${location}"`);
        return streamResult;
      } catch (streamingError) {
        console.error(
          `[API] Streaming search failed for "${location}":`,
          streamingError
        );

        if (onStreamError) {
          onStreamError({
            type: "streaming_failed",
            message: streamingError.message,
            location,
            willFallback: this.streamingConfig.fallbackOnError,
          });
        }

        if (this.streamingConfig.fallbackOnError) {
          console.log(
            `[API] Falling back to non-streaming search for: "${location}"`
          );

          try {
            const fallbackResult = await this.performNonStreamingSearch(
              location,
              filters,
              { page, limit, useCache, forceRefresh }
            );

            if (fallbackResult.success && fallbackResult.data) {
              const transformedData = fallbackResult.data.map((place) =>
                transformAISearchResult(place, location)
              );

              if (onStreamResult) {
                onStreamResult(transformedData, {
                  isComplete: true,
                  totalReceived: transformedData.length,
                  source: "fallback",
                });
              }

              if (onStreamComplete) {
                onStreamComplete({
                  totalResults: transformedData.length,
                  source: "fallback",
                  streamingFailed: true,
                });
              }

              return {
                ...fallbackResult,
                data: transformedData,
                metadata: {
                  ...fallbackResult.metadata,
                  streamingFailed: true,
                  fallbackUsed: true,
                },
              };
            }

            throw new Error(
              fallbackResult?.message || "Fallback search failed"
            );
          } catch (fallbackError) {
            console.error(
              `[API] Fallback search also failed for "${location}":`,
              fallbackError
            );

            if (onStreamError) {
              onStreamError({
                type: "fallback_failed",
                message: fallbackError.message,
                location,
                originalError: streamingError.message,
              });
            }

            throw new Error(
              `Both streaming and fallback search failed: ${fallbackError.message}`
            );
          }
        } else {
          throw streamingError;
        }
      }
    } else {
      console.log(`[API] Using non-streaming search for: "${location}"`);

      const result = await this.performNonStreamingSearch(location, filters, {
        page,
        limit,
        useCache,
        forceRefresh,
      });

      if (result.success && result.data) {
        const transformedData = result.data.map((place) =>
          transformAISearchResult(place, location)
        );

        return {
          ...result,
          data: transformedData,
        };
      }

      return result;
    }
  }

  async performStreamingSearch(
    location,
    filters,
    options,
    onStreamResult,
    onStreamError,
    onStreamComplete
  ) {
    const { page, limit, useCache, forceRefresh } = options;
    const streamId = `stream-${Date.now()}-${Math.random()}`;

    return new Promise(async (resolve, reject) => {
      let allResults = [];
      let streamComplete = false;
      let controller = new AbortController();

      this.activeStreams.set(streamId, {
        location,
        startTime: Date.now(),
        controller,
        status: "active",
      });

      const timeout = setTimeout(() => {
        if (!streamComplete) {
          console.warn(`[API] Streaming timeout for: "${location}"`);
          controller.abort();
          this.activeStreams.delete(streamId);
          reject(new Error("Streaming search timeout"));
        }
      }, this.streamingConfig.timeout);

      try {
        const fetchResult = await this.trySimulatedStreaming(
          location,
          filters,
          options,
          streamId,
          allResults,
          onStreamResult,
          onStreamError,
          onStreamComplete
        );

        clearTimeout(timeout);
        resolve(fetchResult);
      } catch (simulationError) {
        console.warn(
          `[API] Simulated streaming failed, trying direct API call...`
        );
        clearTimeout(timeout);

        try {
          const directResult = await this.performNonStreamingSearch(
            location,
            filters,
            options
          );

          if (directResult.success && directResult.data) {
            const transformedData = directResult.data.map((place) =>
              transformAISearchResult(place, location)
            );

            onStreamResult(transformedData, {
              isComplete: true,
              totalReceived: transformedData.length,
              source: "direct_fallback",
            });

            if (onStreamComplete) {
              onStreamComplete({
                totalResults: transformedData.length,
                source: "direct_fallback",
              });
            }

            resolve({
              success: true,
              data: transformedData,
              message: `Direct fallback: ${transformedData.length} places`,
              metadata: {
                streamingUsed: false,
                streamMethod: "direct_fallback",
                totalResults: transformedData.length,
              },
            });
          } else {
            throw new Error(directResult?.message || "Direct API call failed");
          }
        } catch (directError) {
          this.activeStreams.delete(streamId);
          reject(directError);
        }
      }
    });
  }

  async trySimulatedStreaming(
    location,
    filters,
    options,
    streamId,
    allResults,
    onStreamResult,
    onStreamError,
    onStreamComplete
  ) {
    console.log(`[API] Attempting REAL streaming for: "${location}"`);

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/destinations/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            location: location.trim(),
            filters,
            page: options.page,
            limit: options.limit,
            streaming: true, // Enable server-side streaming
            timestamp: Date.now(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is streaming (chunked transfer)
      const contentType = response.headers.get('content-type');
      const transferEncoding = response.headers.get('transfer-encoding');

      if (transferEncoding === 'chunked' || response.body) {
        // REAL STREAMING: Read the response as a stream
        console.log(`[API] Processing REAL stream for "${location}"`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let totalReceived = 0;
        let batchCount = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log(`[API] Stream ended for "${location}"`);
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete JSON objects (newline-delimited)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const chunk = JSON.parse(line);

              if (chunk.type === 'status') {
                // Status update - searching/loading message
                console.log(`[API] Status: ${chunk.status} - ${chunk.message}`);
                onStreamResult([], {
                  isComplete: false,
                  totalReceived: 0,
                  source: "status",
                  status: chunk.status,
                  message: chunk.message,
                });
              } else if (chunk.type === 'batch' && chunk.places) {
                // Transform and send batch to callback
                const places = chunk.places.map((place) =>
                  transformAISearchResult(place, location)
                );

                allResults.push(...places);
                totalReceived += places.length;
                batchCount++;

                console.log(`[API] Received batch ${batchCount}: ${places.length} places (total: ${totalReceived})`);

                onStreamResult(places, {
                  isComplete: false,
                  totalReceived,
                  source: chunk.source || "stream",
                  batchNumber: batchCount,
                  category: chunk.category,
                  heroContent: chunk.heroContent,
                  locationIntelligence: chunk.locationIntelligence,
                });
              } else if (chunk.type === 'complete') {
                console.log(`[API] Stream complete: ${chunk.summary?.totalPlaces || totalReceived} places`);

                // Send final completion signal
                onStreamResult([], {
                  isComplete: true,
                  totalReceived,
                  source: chunk.summary?.source || "stream",
                });

                if (onStreamComplete) {
                  onStreamComplete({
                    totalResults: totalReceived,
                    source: chunk.summary?.source || "stream",
                    method: "real_streaming",
                    cached: chunk.summary?.cached || false,
                  });
                }
              } else if (chunk.type === 'error') {
                console.error(`[API] Stream error from server:`, chunk.error);
                if (onStreamError) {
                  onStreamError({
                    type: "server_error",
                    message: chunk.error?.message || "Server streaming error",
                  });
                }
              }
            } catch (parseError) {
              console.warn(`[API] Failed to parse stream chunk:`, line.substring(0, 100));
            }
          }
        }

        this.activeStreams.delete(streamId);

        return {
          success: true,
          data: allResults,
          message: `Streamed ${allResults.length} places`,
          metadata: {
            streamingUsed: true,
            streamMethod: "real_streaming",
            totalResults: allResults.length,
            batchesReceived: batchCount,
          },
        };
      } else {
        // Fallback: Non-streaming response (legacy)
        console.log(`[API] Non-streaming response for "${location}"`);

        const result = await response.json();

        if (result.success && result.data && Array.isArray(result.data)) {
          const places = result.data.map((place) =>
            transformAISearchResult(place, location)
          );
          allResults.push(...places);

          // Send all at once
          onStreamResult(places, {
            isComplete: true,
            totalReceived: places.length,
            source: "non_streaming",
          });

          if (onStreamComplete) {
            onStreamComplete({
              totalResults: places.length,
              source: "non_streaming",
            });
          }

          this.activeStreams.delete(streamId);

          return {
            success: true,
            data: places,
            message: `Non-streaming: ${places.length} places`,
            metadata: {
              streamingUsed: false,
              totalResults: places.length,
            },
          };
        } else {
          throw new Error(result.message || "No places found in response");
        }
      }
    } catch (fetchError) {
      console.error(
        `[API] Streaming failed for "${location}":`,
        fetchError
      );
      throw new Error(`Streaming failed: ${fetchError.message}`);
    }
  }

  async performNonStreamingSearch(location, filters, options) {
    const { page, limit, useCache, forceRefresh } = options;

    console.log(`[API] Non-streaming search for: "${location}"`);

    const result = await makeAPICall("/destinations/search", {
      method: "POST",
      body: JSON.stringify({
        location: location.trim(),
        filters,
        page,
        limit,
        stream: false,
        timestamp: Date.now(),
      }),
    });

    return result;
  }

  // ===== HIERARCHICAL SEARCH =====

  async hierarchicalSearch(searchData, filters = {}, options = {}) {
    // Handle various input formats
    let query;
    let selectedLocation = null;

    if (typeof searchData === 'string') {
      // Simple string query
      query = searchData;
    } else if (searchData && typeof searchData === 'object') {
      // Object with query property
      if (searchData.query && typeof searchData.query === 'string') {
        query = searchData.query;
        selectedLocation = searchData.selectedLocation || null;
      } else if (searchData.searchQuery && typeof searchData.searchQuery === 'string') {
        // Handle enrichment status object format
        query = searchData.searchQuery;
      } else {
        console.error('Invalid searchData format:', searchData);
        throw new Error('searchData must be a string or object with a query property');
      }
    } else {
      throw new Error('searchData is required');
    }

    if (!query || query.trim().length < 2) {
      throw new Error("Search query must be at least 2 characters long");
    }

    const { useCache = true, forceRefresh = false } = options;
    const cacheKey = `hierarchical-${query.toLowerCase()}-${JSON.stringify(filters)}`;

    console.log(`[API] Hierarchical search: "${query}", hasOSM: ${!!selectedLocation}`);

    try {
      const result = await this.makeRequest(cacheKey, async () => {
        return makeAPICall("/destinations/hierarchical-search", {
          method: "POST",
          body: JSON.stringify({
            query: query.trim(),
            selectedLocation,
            filters,
            useCache,
            forceRefresh,
            timestamp: Date.now(),
          }),
          timeout: 70000,
        });
      });

      if (result.success && result.data) {
        console.log(`[API] Hierarchical search returned ${result.data.length} places`);

        const hasHierarchy = result.data.some(
          p => p.locationData && p.organizationData
        );

        if (hasHierarchy) {
          console.log(`[API] Places have hierarchical data structure`);
        } else {
          console.warn(`[API] Places missing hierarchical data structure`);
        }
      }

      return result;

    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('408')) {
        throw new Error(
          `Search for "${query}" is taking too long. Try searching for a specific city instead of a large region.`
        );
      }
      throw error;
    }
  }

  // ===== BACKWARD COMPATIBLE METHODS =====

  async aiSearch(location, filters = {}, page = 1, limit = 10, options = {}) {
    try {
      const result = await this.aiSearchWithStreaming(
        location,
        filters,
        { ...options, page, limit, enableStreaming: false }
      );

      return result;
    } catch (error) {
      console.error(
        `[API] Backward compatible search failed for "${location}":`,
        error
      );
      throw error;
    }
  }

  async aiSearchPaginated(
    location,
    filters = {},
    page = 1,
    limit = 20,
    options = {}
  ) {
    return this.aiSearch(location, filters, page, limit, options);
  }

  // ===== STREAMING UTILITY METHODS =====

  getStreamingStats() {
    return {
      activeStreams: this.activeStreams.size,
      config: this.streamingConfig,
      streams: Array.from(this.activeStreams.entries()).map(([id, stream]) => ({
        id,
        location: stream.location,
        duration: Date.now() - stream.startTime,
        status: stream.status,
      })),
    };
  }

  cancelStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.controller.abort();
      stream.status = "cancelled";
      this.activeStreams.delete(streamId);
      console.log(`[API] Cancelled stream: ${streamId}`);
      return true;
    }
    return false;
  }

  cancelAllStreams() {
    const cancelled = this.activeStreams.size;
    for (const [streamId, stream] of this.activeStreams) {
      stream.controller.abort();
    }
    this.activeStreams.clear();
    console.log(`[API] Cancelled ${cancelled} active streams`);
    return cancelled;
  }

  configureStreaming(config) {
    this.streamingConfig = { ...this.streamingConfig, ...config };
    console.log(`[API] Streaming configuration updated:`, this.streamingConfig);
  }

  // ===== OTHER API METHODS =====

  async getAIDetails(placeName, location, options = {}) {
    if (!placeName || !location) {
      throw new Error("Place name and location are required");
    }

    const { useCache = true, forceRefresh = false } = options;
    const cacheKey = `details-${placeName.toLowerCase()}-${location.toLowerCase()}`;

    const result = await this.makeRequest(cacheKey, async () => {
      return makeAPICall("/destinations/ai-details", {
        method: "POST",
        body: JSON.stringify({
          placeName: placeName.trim(),
          location: location.trim(),
          timestamp: Date.now(),
        }),
      });
    });

    if (result.success && result.data) {
      try {
        const [nearbyPlaces, transportation, weather] = await Promise.all([
          this.getNearbyPlaces(placeName, location).catch(() => null),
          this.getTransportationOptions(placeName, location).catch(() => null),
          this.getWeatherInfo(location).catch(() => null),
        ]);

        result.data = {
          ...result.data,
          nearbyPlaces: nearbyPlaces?.data || [],
          transportation: transportation?.data || {},
          weather: weather?.data || null,
          mapData: {
            lat: result.data.coordinates?.lat || 0,
            lng: result.data.coordinates?.lng || 0,
            address:
              result.data.location?.address || `${placeName}, ${location}`,
          },
          comprehensiveDetails: true,
        };
      } catch (enhanceError) {
        console.warn("Failed to enhance place details:", enhanceError);
      }
    }

    return result;
  }

  async getFeatured(options = {}) {
    const { useCache = true, forceRefresh = false } = options;
    const cacheKey = "featured-destinations";

    try {
      const result = await this.makeRequest(cacheKey, async () => {
        return makeAPICall("/destinations/featured");
      });

      return result;
    } catch (error) {
      console.warn("Failed to get featured destinations");
      return {
        success: false,
        data: [],
        message: "Featured destinations service temporarily unavailable",
      };
    }
  }

  async getRecommended(options = {}) {
    const { useCache = true, forceRefresh = false } = options;
    const cacheKey = "recommended-destinations";

    try {
      const result = await this.makeRequest(cacheKey, async () => {
        return makeAPICall("/destinations/recommended");
      });

      return result;
    } catch (error) {
      console.warn("Failed to get recommended destinations");
      return {
        success: false,
        data: [],
        message: "Recommended destinations service temporarily unavailable",
      };
    }
  }

  async getNearbyPlaces(placeName, location, radius = 5) {
    const cacheKey = `nearby-${placeName.toLowerCase()}-${location.toLowerCase()}-${radius}`;

    return this.makeRequest(cacheKey, async () => {
      try {
        const result = await makeAPICall("/destinations/nearby", {
          method: "POST",
          body: JSON.stringify({
            placeName,
            location,
            radius,
            limit: 10,
            timestamp: Date.now(),
          }),
        });
        return result;
      } catch (error) {
        console.warn("Failed to get nearby places:", error);
        return { success: false, data: [] };
      }
    });
  }

  // Coordinate-based nearby search for the Explore Nearby screen.
  // payload: { placeName, location: {lat, lng}, radius, limit }
  async getNearbyByCoords({ placeName = "your location", location, radius = 10, limit = 30 } = {}) {
    try {
      return await makeAPICall("/destinations/nearby", {
        method: "POST",
        body: JSON.stringify({ placeName, location, radius, limit, timestamp: Date.now() }),
        timeout: 30000,
      });
    } catch (error) {
      console.warn("getNearbyByCoords failed:", error);
      return { success: false, data: [] };
    }
  }

  async getTransportationOptions(placeName, location) {
    const cacheKey = `transport-${placeName.toLowerCase()}-${location.toLowerCase()}`;

    return this.makeRequest(cacheKey, async () => {
      try {
        const result = await makeAPICall("/destinations/transportation", {
          method: "POST",
          body: JSON.stringify({
            placeName,
            location,
            timestamp: Date.now(),
          }),
        });
        return result;
      } catch (error) {
        console.warn("Failed to get transportation options:", error);
        return { success: false, data: {} };
      }
    });
  }

  async getPlaceImages(placeName, location, count = 5, options = {}) {
    const { useCache = true, forceRefresh = false } = options;

    try {
      const result = await makeAPICall("/destinations/place-images", {
        method: "POST",
        body: JSON.stringify({
          placeName,
          location,
          count,
          timestamp: Date.now(),
          useCache,
          forceRefresh,
        }),
        timeout: 30000, // 30s — image fetching via Google Places can be slow
        retries: 3, // Start at max to skip retries — images are non-critical
      });

      return result;
    } catch (error) {
      console.error("Failed to get place images:", error);
      return {
        success: false,
        data: [],
        message: "Image service temporarily unavailable",
      };
    }
  }

  async getWeatherInfo(location) {
    const cacheKey = `weather-${location.toLowerCase()}`;

    return this.makeRequest(cacheKey, async () => {
      try {
        return await makeAPICall(
          `/destinations/weather/${encodeURIComponent(location)}`
        );
      } catch (error) {
        console.warn("Failed to get weather info:", error);
        return {
          success: false,
          message: "Weather service temporarily unavailable",
        };
      }
    });
  }

  async search(query, options = {}) {
    if (!query || query.trim().length < 2) {
      throw new Error("Search query must be at least 2 characters long");
    }

    const { useCache = true, forceRefresh = false } = options;
    const cacheKey = `search-${query.toLowerCase()}`;

    const result = await this.makeRequest(cacheKey, async () => {
      return makeAPICall("/destinations/search", {
        method: "POST",
        body: JSON.stringify({
          location: query.trim(),
          filters: {},
          page: 1,
          limit: 20,
          stream: false,
          timestamp: Date.now(),
        }),
      });
    });

    return result;
  }

  // ===== CACHE MANAGEMENT =====

  clearCache() {
    this.requestCache.clear();
    console.log("[API] Request cache cleared");
  }

  getCacheStats() {
    return {
      size: this.requestCache.size,
      pendingRequests: this.pendingRequests.size,
      activeStreams: this.activeStreams.size,
      entries: Array.from(this.requestCache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
      })),
    };
  }

  cleanupCache() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > 300000) {
        this.requestCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[API] Cleaned up ${removedCount} expired cache entries`);
    }
  }

  startCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 120000);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearCache();
    this.pendingRequests.clear();
    this.cancelAllStreams();
  }
}

// ===== CREATE AND EXPORT INSTANCE =====

const apiInstance = new DestinationAPI();

// Start automatic cache cleanup
apiInstance.startCacheCleanup();

// ===== EXPORTED API OBJECT =====

export const destinationAPI = {
  // Enrichment polling methods
  getEnrichmentStatus: (...args) => apiInstance.getEnrichmentStatus(...args),
  refetchEnrichedResults: (...args) => apiInstance.refetchEnrichedResults(...args),

  // Search methods
  hierarchicalSearch: (...args) => apiInstance.hierarchicalSearch(...args),
  aiSearch: (...args) => apiInstance.aiSearch(...args),
  aiSearchPaginated: (...args) => apiInstance.aiSearchPaginated(...args),
  aiSearchWithStreaming: (...args) => apiInstance.aiSearchWithStreaming(...args),
  search: (...args) => apiInstance.search(...args),

  // Details methods
  getAIDetails: (...args) => apiInstance.getAIDetails(...args),
  getFeatured: (...args) => apiInstance.getFeatured(...args),
  getRecommended: (...args) => apiInstance.getRecommended(...args),
  getNearbyPlaces: (...args) => apiInstance.getNearbyPlaces(...args),
  getNearbyByCoords: (...args) => apiInstance.getNearbyByCoords(...args),
  getTransportationOptions: (...args) => apiInstance.getTransportationOptions(...args),
  getPlaceImages: (...args) => apiInstance.getPlaceImages(...args),
  getWeatherInfo: (...args) => apiInstance.getWeatherInfo(...args),

  // Streaming control
  getStreamingStats: () => apiInstance.getStreamingStats(),
  cancelStream: (streamId) => apiInstance.cancelStream(streamId),
  cancelAllStreams: () => apiInstance.cancelAllStreams(),
  configureStreaming: (config) => apiInstance.configureStreaming(config),

  // Cache management
  clearCache: () => apiInstance.clearCache(),
  getCacheStats: () => apiInstance.getCacheStats(),
};

// ===== STANDALONE FUNCTIONS =====

export const hierarchicalSearch = async (
  searchData,
  filters = {},
  options = {}
) => {
  const query = typeof searchData === 'string' ? searchData : searchData.query;

  console.log(`[API] Hierarchical search API call: "${query}"`);

  try {
    const result = await apiInstance.hierarchicalSearch(
      searchData,
      filters,
      options
    );

    if (!result.success) {
      throw new Error(result.message || 'Hierarchical search failed');
    }

    console.log(`[API] Hierarchical search completed: ${result.data?.length || 0} places`);

    return result;
  } catch (error) {
    console.error('[API] Hierarchical search error:', error);
    throw error;
  }
};

export const streamingSearch = async (
  location,
  filters = {},
  options = {},
  onResult = null,
  onError = null,
  onComplete = null
) => {
  console.log(`[API] Starting streaming search for: "${location}"`);

  try {
    const result = await apiInstance.aiSearchWithStreaming(
      location,
      filters,
      { ...options, enableStreaming: true },
      onResult,
      onError,
      onComplete
    );

    return result;
  } catch (error) {
    console.error(`[API] Streaming search failed:`, error);
    if (onError) {
      onError({
        type: "search_failed",
        message: error.message,
        location,
      });
    }
    throw error;
  }
};

export const quickSearch = async (location, filters = {}, options = {}) => {
  console.log(`[API] Quick search for: "${location}"`);

  try {
    const result = await makeAPICall("/destinations/quick-search", {
      method: "POST",
      body: JSON.stringify({
        location: location.trim(),
        filters,
        limit: options.limit || 10,
        timestamp: Date.now(),
      }),
    });

    if (result.success && result.data) {
      const transformedData = result.data.map((place) =>
        transformAISearchResult(place, location)
      );

      return {
        ...result,
        data: transformedData,
        metadata: {
          ...result.metadata,
          searchMethod: "quick",
        },
      };
    }

    return result;
  } catch (error) {
    console.warn(`[API] Quick search failed, falling back to regular search`);
    return apiInstance.aiSearch(location, filters, 1, options.limit || 10, {
      ...options,
      enableStreaming: false,
    });
  }
};

// ===== ERROR TYPES =====

export const StreamingErrorTypes = {
  CONNECTION_FAILED: "connection_failed",
  STREAMING_FAILED: "streaming_failed",
  FALLBACK_FAILED: "fallback_failed",
  PARSE_ERROR: "parse_error",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  SEARCH_FAILED: "search_failed",
};

// ===== CONFIGURATION CONSTANTS =====

export const StreamingConfig = {
  PRESETS: {
    HIGH_PERFORMANCE: {
      enabled: true,
      timeout: 45000,
      fallbackOnError: true,
      retryAttempts: 2,
    },
    QUICK: {
      enabled: true,
      timeout: 15000,
      fallbackOnError: true,
      retryAttempts: 1,
    },
    DISABLED: {
      enabled: false,
      fallbackOnError: false,
      retryAttempts: 0,
    },
  },
};

// ===== DEFAULT EXPORT =====

export default destinationAPI;
