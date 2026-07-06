// services/api/driverAPI.js
import { makeAPICall, getAuthHeaders, getAuthToken } from "../apiConfig";

class DriverAPI {
  // ===== VENDOR DRIVERS =====

  async getDrivers(params = {}) {
    const qs = new URLSearchParams(params);
    const query = qs.toString();
    return makeAPICall(`/drivers${query ? `?${query}` : ""}`, {
      headers: await getAuthHeaders(),
    });
  }

  async addDriver(data) {
    return makeAPICall("/drivers", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async toggleDriverAvailability(id, isAvailable) {
    return makeAPICall(`/drivers/${id}/availability`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ isAvailable }),
    });
  }
}

export const driverAPI = new DriverAPI();
