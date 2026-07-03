// services/api/createTripAPI.js - API service for Create a Trip feature
import { API_CONFIG, makeAPICall } from "../apiConfig";

class CreateTripAPI {
  // === TRIP CRUD ===

  async createTrip(tripData) {
    return makeAPICall("/user-trips", {
      method: "POST",
      body: JSON.stringify(tripData),
    });
  }

  async getUserTrips(userId, filters = {}) {
    const params = new URLSearchParams({ userId, ...filters });
    return makeAPICall(`/user-trips?${params.toString()}`);
  }

  async getTripById(tripId) {
    return makeAPICall(`/user-trips/${tripId}`);
  }

  async updateTrip(tripId, tripData) {
    return makeAPICall(`/user-trips/${tripId}`, {
      method: "PUT",
      body: JSON.stringify(tripData),
      timeout: API_CONFIG.TIMEOUTS.LONG_OPERATION,
    });
  }

  async deleteTrip(tripId) {
    return makeAPICall(`/user-trips/${tripId}`, {
      method: "DELETE",
    });
  }

  // === PARTIAL UPDATES ===

  async updateDestinations(tripId, destinations) {
    return makeAPICall(`/user-trips/${tripId}/destinations`, {
      method: "PATCH",
      body: JSON.stringify({ destinations }),
    });
  }

  async updateDayActivities(tripId, dayNumber, activities) {
    return makeAPICall(
      `/user-trips/${tripId}/days/${dayNumber}/activities`,
      {
        method: "PATCH",
        body: JSON.stringify({ activities }),
      }
    );
  }

  async updateTripStatus(tripId, status) {
    return makeAPICall(`/user-trips/${tripId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  // === SHARING ===

  async generateShareLink(tripId) {
    return makeAPICall(`/user-trips/${tripId}/share`, {
      method: "POST",
    });
  }

  async getSharedTrip(shareToken) {
    return makeAPICall(`/user-trips/shared/${shareToken}`);
  }

  async duplicateTrip(tripId, userId) {
    return makeAPICall(`/user-trips/${tripId}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  // === COLLABORATION ===

  async removeCollaborator(tripId, collaboratorUserId, requestingUserId) {
    return makeAPICall(`/user-trips/${tripId}/collaborators/${collaboratorUserId}?requestingUserId=${requestingUserId}`, {
      method: "DELETE",
    });
  }

  async inviteCollaborator(tripId, inviteData) {
    return makeAPICall(`/user-trips/${tripId}/invite`, {
      method: "POST",
      body: JSON.stringify(inviteData),
    });
  }

  // === AI SUGGESTIONS ===

  async getDestinationSuggestions(destinations, tripType, budget) {
    return makeAPICall("/trip-suggestions/destinations", {
      method: "POST",
      body: JSON.stringify({ destinations, tripType, budget }),
    });
  }

  async getActivitySuggestions(
    destination,
    dayNumber,
    timeSlot,
    tripType,
    existingActivities,
    currentLocation = null
  ) {
    return makeAPICall("/trip-suggestions/activities", {
      method: "POST",
      body: JSON.stringify({
        destination,
        dayNumber,
        timeSlot,
        tripType,
        existingActivities,
        currentLocation,
      }),
    });
  }
}

export const createTripAPI = new CreateTripAPI();
