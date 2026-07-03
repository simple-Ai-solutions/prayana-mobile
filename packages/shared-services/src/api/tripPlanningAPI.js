// services/api/tripPlanningAPI.js - TRIP PLANNING API SERVICE
// Adapted for React Native: removed localStorage, imageUtils imports
// Storage operations should be handled at the app level via dependency injection

import { API_CONFIG, makeAPICall } from "../apiConfig";

// Storage adapter - apps set this via setTripPlanningStorage
let _storage = {
  getItem: async (key) => null,
  setItem: async (key, value) => {},
};

/**
 * Set the storage adapter for trip planning (replaces localStorage).
 * For React Native, pass an AsyncStorage-compatible object.
 * @param {{ getItem: Function, setItem: Function }} storage
 */
export const setTripPlanningStorage = (storage) => {
  _storage = storage;
};

// Local validation for routes
const validateRouteLocally = (routeData) => {
  const { startingCity, destinationCity, totalDays } = routeData;
  const errors = [];

  if (!startingCity?.trim()) errors.push("Starting city is required");
  if (!destinationCity?.trim()) errors.push("Destination city is required");
  if (startingCity?.toLowerCase() === destinationCity?.toLowerCase()) {
    errors.push("Starting and destination cities must be different");
  }
  if (!totalDays || totalDays < 1 || totalDays > 30) {
    errors.push("Total days must be between 1 and 30");
  }

  return {
    success: errors.length === 0,
    valid: errors.length === 0,
    errors,
    feasibility:
      errors.length === 0
        ? {
            feasible: true,
            estimatedTravelTime: "6-8 hours by road",
            difficulty: "Easy",
            bestTransport: "Mixed transport options",
            suggestedStops: Math.min(Math.floor(totalDays / 2), 3),
          }
        : null,
  };
};

// Local search for trips
const searchLocalTrips = async (userId, query, filters) => {
  try {
    const raw = await _storage.getItem("savedTrips");
    const savedTrips = JSON.parse(raw || "[]");
    let filteredTrips = savedTrips;

    if (query && query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      filteredTrips = filteredTrips.filter((trip) => {
        const searchableText = [
          trip.itinerary?.tripSummary?.title,
          trip.startingCity,
          trip.destinationCity,
          ...(trip.destinations?.map((d) =>
            typeof d === "string" ? d : d.name
          ) || []),
          trip.tripType,
          trip.budget,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(searchTerm);
      });
    }

    if (filters.mode && filters.mode !== "all") {
      filteredTrips = filteredTrips.filter(
        (trip) => trip.planningMode === filters.mode
      );
    }

    filteredTrips.sort(
      (a, b) =>
        new Date(b.createdAt || b.fromDate) -
        new Date(a.createdAt || a.fromDate)
    );

    const total = filteredTrips.length;
    const limitedTrips = filteredTrips.slice(0, parseInt(filters.limit) || 20);

    return {
      success: true,
      data: {
        trips: limitedTrips,
        total,
        filters: { query, ...filters },
      },
      message: `Found ${total} trip(s)`,
    };
  } catch (error) {
    console.error("Local search failed:", error);
    return {
      success: false,
      data: { trips: [], total: 0, filters: {} },
      message: "Search failed",
    };
  }
};

// Generate local analytics
const generateLocalAnalytics = async (userId) => {
  try {
    const raw = await _storage.getItem("savedTrips");
    const savedTrips = JSON.parse(raw || "[]");

    const analytics = {
      totalTrips: savedTrips.length,
      totalDays: savedTrips.reduce(
        (sum, trip) => sum + (trip.totalDays || trip.duration || 0),
        0
      ),
      favoriteModes: {
        plan_my_way: savedTrips.filter(
          (trip) => trip.planningMode === "plan_my_way"
        ).length,
        smarttrip_ai: savedTrips.filter(
          (trip) => trip.planningMode === "smarttrip_ai"
        ).length,
      },
      popularDestinations: getPopularDestinations(savedTrips),
      budgetDistribution: getBudgetDistribution(savedTrips),
      averageTripLength:
        savedTrips.length > 0
          ? Math.round(
              savedTrips.reduce(
                (sum, trip) => sum + (trip.totalDays || trip.duration || 0),
                0
              ) / savedTrips.length
            )
          : 0,
      totalSpent: calculateTotalSpent(savedTrips),
      imageOptimizationStats: {
        totalTripsWithImages: savedTrips.filter(
          (trip) => trip.metadata?.imageEnhanced
        ).length,
        costSaved: savedTrips.length * 10,
      },
    };

    return {
      success: true,
      data: analytics,
      message: "Analytics generated from local data",
    };
  } catch (error) {
    console.error("Failed to generate local analytics:", error);
    return {
      success: false,
      data: {
        totalTrips: 0,
        totalDays: 0,
        favoriteModes: { plan_my_way: 0, smarttrip_ai: 0 },
        popularDestinations: [],
        budgetDistribution: { budget: 0, medium: 0, luxury: 0 },
        averageTripLength: 0,
        totalSpent: "INR 0",
        imageOptimizationStats: { totalTripsWithImages: 0, costSaved: 0 },
      },
      message: "Failed to generate analytics",
    };
  }
};

const getPopularDestinations = (trips) => {
  const destinations = {};

  trips.forEach((trip) => {
    if (trip.destinations && Array.isArray(trip.destinations)) {
      trip.destinations.forEach((dest) => {
        const destName = typeof dest === "string" ? dest : dest.name;
        if (destName) {
          destinations[destName] = (destinations[destName] || 0) + 1;
        }
      });
    }

    if (trip.destinationCity) {
      destinations[trip.destinationCity] =
        (destinations[trip.destinationCity] || 0) + 1;
    }

    if (trip.startingCity) {
      destinations[trip.startingCity] =
        (destinations[trip.startingCity] || 0) + 1;
    }
  });

  return Object.entries(destinations)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / trips.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
};

const getBudgetDistribution = (trips) => {
  const distribution = { budget: 0, medium: 0, luxury: 0 };

  trips.forEach((trip) => {
    if (trip.budget && distribution.hasOwnProperty(trip.budget)) {
      distribution[trip.budget]++;
    }
  });

  const total = trips.length;
  return {
    budget: {
      count: distribution.budget,
      percentage:
        total > 0 ? Math.round((distribution.budget / total) * 100) : 0,
    },
    medium: {
      count: distribution.medium,
      percentage:
        total > 0 ? Math.round((distribution.medium / total) * 100) : 0,
    },
    luxury: {
      count: distribution.luxury,
      percentage:
        total > 0 ? Math.round((distribution.luxury / total) * 100) : 0,
    },
  };
};

const calculateTotalSpent = (trips) => {
  let total = 0;

  trips.forEach((trip) => {
    if (trip.itinerary?.budgetBreakdown?.total) {
      const costStr = trip.itinerary.budgetBreakdown.total.replace(/[INR,\s]/g, "");
      const numericCost = parseInt(costStr) || 0;
      total += numericCost;
    } else if (trip.estimatedCost) {
      const costStr = trip.estimatedCost.split("-")[0].replace(/[INR,\s]/g, "");
      const numericCost = parseInt(costStr) || 0;
      total += numericCost;
    }
  });

  return total > 0 ? `INR ${total.toLocaleString()}` : "INR 0";
};

export class TripPlanningAPI {
  async createItinerary(tripData) {
    console.log("[TripPlanning] Creating enhanced itinerary:", tripData);

    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRIP_PLANNING?.CREATE_ITINERARY || "/trip-planning/create-itinerary",
        {
          method: "POST",
          body: JSON.stringify({
            ...tripData,
            enhanced: true,
            requestType: "comprehensive",
            timestamp: new Date().toISOString(),
          }),
          timeout: API_CONFIG.TIMEOUTS.LONG_OPERATION,
        }
      );

      if (response.success) {
        console.log("[TripPlanning] Enhanced itinerary created successfully");
        return response;
      }

      throw new Error("Enhanced API not available");
    } catch (error) {
      console.error("[TripPlanning] Enhanced API failed:", error.message);
      return {
        success: false,
        message: "Itinerary creation service temporarily unavailable",
        error: error.message,
      };
    }
  }

  async createSmartTripItinerary(tripData) {
    console.log("[TripPlanning] Creating SmartTrip AI itinerary:", tripData);

    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRIP_PLANNING?.CREATE_SMARTTRIP || "/trip-planning/create-smarttrip",
        {
          method: "POST",
          body: JSON.stringify({
            ...tripData,
            enhanced: true,
            requestType: "comprehensive_smarttrip",
            planningMode: "smarttrip_ai",
          }),
          timeout: API_CONFIG.TIMEOUTS.LONG_OPERATION,
        }
      );

      if (response.success) {
        console.log("[TripPlanning] SmartTrip AI itinerary created successfully");
        return response;
      }

      throw new Error("Enhanced SmartTrip API not available");
    } catch (error) {
      console.error("[TripPlanning] Enhanced SmartTrip API failed:", error.message);
      return {
        success: false,
        message: "SmartTrip itinerary creation service temporarily unavailable",
        error: error.message,
      };
    }
  }

  async validateSmartTripRoute(routeData) {
    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRIP_PLANNING?.VALIDATE_ROUTE || "/trip-planning/validate-route",
        {
          method: "POST",
          body: JSON.stringify(routeData),
        }
      );

      return response;
    } catch (error) {
      console.warn("Route validation failed, using local validation:", error);
      return validateRouteLocally(routeData);
    }
  }

  async getSmartTripPreview(routeData) {
    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRIP_PLANNING?.ROUTE_PREVIEW || "/trip-planning/route-preview",
        {
          method: "POST",
          body: JSON.stringify(routeData),
        }
      );

      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Preview generation failed:", error);
    }

    return {
      success: true,
      data: {
        estimatedStops: Math.min(Math.floor(routeData.totalDays / 2), 3),
        routeType: "Scenic and Cultural",
        highlights: [
          "Beautiful landscapes",
          "Cultural sites",
          "Local experiences",
        ],
        estimatedBudget: "INR 5,000-8,000 per person",
        bestSeason: "October to March",
      },
    };
  }

  async comparePlanningModes(tripData) {
    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRIP_PLANNING?.COMPARE_MODES || "/trip-planning/compare-modes",
        {
          method: "POST",
          body: JSON.stringify(tripData),
        }
      );

      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Mode comparison failed:", error);
    }

    return {
      success: true,
      data: {
        plan_my_way: {
          name: "Plan My Way",
          pros: ["Full control", "Custom destinations", "Flexible timing"],
          bestFor: "Experienced travelers who know their preferences",
        },
        smarttrip_ai: {
          name: "SmartTrip AI",
          pros: ["AI optimization", "Effortless planning", "Hidden gems"],
          bestFor: "Travelers who want a curated experience",
        },
      },
    };
  }

  async saveTrip(tripData) {
    try {
      const raw = await _storage.getItem("savedTrips");
      const savedTrips = JSON.parse(raw || "[]");
      const newTrip = {
        ...tripData,
        _id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: "saved",
        planningMode: tripData.planningMode || "plan_my_way",
        metadata: {
          version: "2.0-mobile",
          features:
            tripData.planningMode === "smarttrip_ai"
              ? [
                  "ai_route_optimization",
                  "automatic_stops",
                  "smart_timing",
                ]
              : [
                  "manual_destinations",
                  "custom_duration",
                  "user_selected",
                ],
        },
      };

      savedTrips.push(newTrip);
      await _storage.setItem("savedTrips", JSON.stringify(savedTrips));

      console.log("[TripPlanning] Trip saved successfully");
      return {
        success: true,
        data: newTrip,
        message: "Trip saved successfully",
      };
    } catch (error) {
      console.error("[TripPlanning] Error saving trip:", error);
      throw new Error("Failed to save trip: " + error.message);
    }
  }

  async getSavedTrips(userId = "default", planningMode = null) {
    try {
      const raw = await _storage.getItem("savedTrips");
      const savedTrips = JSON.parse(raw || "[]");

      const filteredTrips = planningMode
        ? savedTrips.filter((trip) => trip.planningMode === planningMode)
        : savedTrips;

      const enhancedTrips = filteredTrips.map((trip) => ({
        ...trip,
        modeDisplayName:
          trip.planningMode === "smarttrip_ai" ? "SmartTrip AI" : "Plan My Way",
        features: trip.metadata?.features || [],
      }));

      return {
        success: true,
        data: enhancedTrips.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        ),
        message: "Saved trips retrieved successfully",
        total: enhancedTrips.length,
        filters: { planningMode },
      };
    } catch (error) {
      console.error("[TripPlanning] Error getting saved trips:", error);
      return {
        success: true,
        data: [],
        message: "No saved trips found",
      };
    }
  }

  async getTripById(tripId) {
    try {
      const raw = await _storage.getItem("savedTrips");
      const savedTrips = JSON.parse(raw || "[]");
      const trip = savedTrips.find((t) => t._id === tripId);

      if (!trip) {
        throw new Error("Trip not found");
      }

      return {
        success: true,
        data: trip,
        message: "Trip retrieved successfully",
      };
    } catch (error) {
      console.error("[TripPlanning] Error getting trip:", error);
      throw error;
    }
  }

  async deleteTrip(tripId) {
    try {
      const raw = await _storage.getItem("savedTrips");
      const savedTrips = JSON.parse(raw || "[]");
      const filteredTrips = savedTrips.filter((t) => t._id !== tripId);
      await _storage.setItem("savedTrips", JSON.stringify(filteredTrips));

      return {
        success: true,
        message: "Trip deleted successfully",
      };
    } catch (error) {
      console.error("[TripPlanning] Error deleting trip:", error);
      throw error;
    }
  }

  async updateTrip(tripId, tripData) {
    try {
      const raw = await _storage.getItem("savedTrips");
      const savedTrips = JSON.parse(raw || "[]");
      const tripIndex = savedTrips.findIndex((t) => t._id === tripId);

      if (tripIndex === -1) {
        throw new Error("Trip not found");
      }

      savedTrips[tripIndex] = {
        ...savedTrips[tripIndex],
        ...tripData,
        updatedAt: new Date().toISOString(),
      };

      await _storage.setItem("savedTrips", JSON.stringify(savedTrips));

      return {
        success: true,
        data: savedTrips[tripIndex],
        message: "Trip updated successfully",
      };
    } catch (error) {
      console.error("[TripPlanning] Error updating trip:", error);
      throw error;
    }
  }

  async getPopularRoutes(region = "india", limit = 10) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRIP_PLANNING?.POPULAR_ROUTES || "/trip-planning/popular-routes"}?region=${region}&limit=${limit}`
      );
      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Popular routes API failed:", error);
    }

    const routes = [
      {
        id: 1,
        route: "Mumbai to Goa",
        popularity: 95,
        avgDays: 4,
        highlights: ["Beaches", "Nightlife", "Portuguese architecture"],
        bestSeason: "October to March",
        difficulty: "Easy",
        estimatedCost: "INR 15,000-25,000",
      },
      {
        id: 2,
        route: "Delhi to Manali",
        popularity: 88,
        avgDays: 6,
        highlights: ["Mountains", "Adventure sports", "Hill stations"],
        bestSeason: "April to June, September to November",
        difficulty: "Moderate",
        estimatedCost: "INR 20,000-35,000",
      },
      {
        id: 3,
        route: "Bangalore to Hampi to Goa",
        popularity: 82,
        avgDays: 7,
        highlights: ["History", "Culture", "Beaches"],
        bestSeason: "October to March",
        difficulty: "Easy",
        estimatedCost: "INR 18,000-30,000",
      },
    ];

    return {
      success: true,
      data: routes.slice(0, parseInt(limit)),
      message: "Popular routes retrieved (offline mode)",
    };
  }

  async getTripAnalytics(userId) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRIP_PLANNING?.ANALYTICS || "/trip-planning/analytics"}/${userId}`
      );
      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Analytics API failed:", error);
    }

    return generateLocalAnalytics(userId);
  }

  async searchTrips(userId, query, filters = {}) {
    try {
      const params = new URLSearchParams({ query, ...filters });
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRIP_PLANNING?.SEARCH_TRIPS || "/trip-planning/search-trips"}/${userId}?${params}`
      );
      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Search API failed:", error);
    }

    return searchLocalTrips(userId, query, filters);
  }
}

// Create and export the service instance
export const tripPlanningAPI = new TripPlanningAPI();
