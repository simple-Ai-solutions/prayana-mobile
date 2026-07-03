// services/api/userAPI.js - USER API SERVICE
// Adapted for React Native: removed localStorage, uses storage adapter

import { API_CONFIG, makeAPICall } from "../apiConfig";
import { tripPlanningAPI } from "./tripPlanningAPI";

// Storage adapter - reuses the same one from tripPlanningAPI
let _storage = {
  getItem: async (key) => null,
  setItem: async (key, value) => {},
};

/**
 * Set the storage adapter for user API (replaces localStorage).
 * @param {{ getItem: Function, setItem: Function }} storage
 */
export const setUserAPIStorage = (storage) => {
  _storage = storage;
};

// Generate local travel stats
const generateLocalTravelStats = async (userId) => {
  try {
    const raw = await _storage.getItem("savedTrips");
    const savedTrips = JSON.parse(raw || "[]");

    const stats = {
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
      averageTripLength:
        savedTrips.length > 0
          ? Math.round(
              savedTrips.reduce(
                (sum, trip) => sum + (trip.totalDays || trip.duration || 0),
                0
              ) / savedTrips.length
            )
          : 0,
      imageStats: {
        tripsWithOptimizedImages: savedTrips.filter(
          (trip) => trip.metadata?.imageEnhanced
        ).length,
        totalImageAPICalls: 0,
      },
    };

    return {
      success: true,
      data: stats,
      message: "Travel stats generated successfully",
    };
  } catch (error) {
    console.error("Failed to generate travel stats:", error);
    return {
      success: false,
      data: {
        totalTrips: 0,
        totalDays: 0,
        favoriteModes: { plan_my_way: 0, smarttrip_ai: 0 },
        averageTripLength: 0,
        imageStats: { tripsWithOptimizedImages: 0, totalImageAPICalls: 0 },
      },
      message: "Failed to generate stats",
    };
  }
};

export class UserAPI {
  async getProfile() {
    try {
      const response = await makeAPICall(API_CONFIG.ENDPOINTS.USERS.PROFILE);
      return response;
    } catch (error) {
      console.warn("User profile API failed:", error);
      return { success: false, data: null };
    }
  }

  async getSavedTrips(userId) {
    return tripPlanningAPI.getSavedTrips(userId);
  }

  async updatePreferences(userId, preferences) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.USERS.PREFERENCES}/${userId}`,
        {
          method: "PUT",
          body: JSON.stringify(preferences),
        }
      );
      return response;
    } catch (error) {
      console.error("Update preferences failed:", error);
      return { success: false, message: "Update failed" };
    }
  }

  async getTravelStats(userId) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.USERS.STATS}/${userId}`
      );
      return response;
    } catch (error) {
      console.warn("Travel stats API failed:", error);
      return generateLocalTravelStats(userId);
    }
  }

  async updateTravelHistory(userId, tripData) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.USERS.TRAVEL_HISTORY}/${userId}`,
        {
          method: "POST",
          body: JSON.stringify(tripData),
        }
      );

      if (response.ok) {
        return response;
      }

      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      console.error("Update travel history failed:", error);

      try {
        const raw = await _storage.getItem("travelHistory");
        const travelHistory = JSON.parse(raw || "{}");
        if (!travelHistory[userId]) {
          travelHistory[userId] = [];
        }

        travelHistory[userId].push({
          ...tripData,
          timestamp: new Date().toISOString(),
          id: Date.now().toString(),
        });

        await _storage.setItem("travelHistory", JSON.stringify(travelHistory));

        return {
          success: true,
          message: "Travel history updated (offline mode)",
          data: tripData,
        };
      } catch (localError) {
        console.error("Local storage update failed:", localError);
        return { success: false, message: "Update failed" };
      }
    }
  }
}

// Create and export the service instance
export const userAPI = new UserAPI();
