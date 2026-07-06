// services/api/vehicleAPI.js
import { makeAPICall, getAuthHeaders, getAuthToken } from "../apiConfig";

class VehicleAPI {
  // ===== VENDOR VEHICLE LISTINGS =====

  async getMyVehicleListings() {
    return makeAPICall("/vehicles/my-listings", {
      headers: await getAuthHeaders(),
    });
  }

  async createVehicle(data) {
    return makeAPICall("/vehicles", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async updateVehicle(id, data) {
    return makeAPICall(`/vehicles/${id}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deleteVehicle(id) {
    return makeAPICall(`/vehicles/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async setVehicleStatus(id, status) {
    return makeAPICall(`/vehicles/${id}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
  }

  // ===== TRANSPORT BOOKINGS =====

  async getBusinessTransportBookings(params = {}) {
    const qs = new URLSearchParams(params);
    const query = qs.toString();
    return makeAPICall(
      `/transport-bookings/business${query ? `?${query}` : ""}`,
      {
        headers: await getAuthHeaders(),
      }
    );
  }

  // ===== ANALYTICS =====

  async getTransportAnalytics(period = "30d") {
    const qs = new URLSearchParams({ period: String(period) });
    return makeAPICall(
      `/transport-polish/analytics/dashboard?${qs.toString()}`,
      {
        headers: await getAuthHeaders(),
      }
    );
  }
}

export const vehicleAPI = new VehicleAPI();
