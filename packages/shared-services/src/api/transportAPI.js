// transportAPI.js - Transport rentals + bookings (taxi, self-drive 2W/4W, airport transfer)
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class TransportAPI {
  // ===== Vehicle catalogue (public) =====
  async listVehicles(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return makeAPICall(`/vehicles${tail}`);
  }

  async getVehicleBySlug(slug) {
    return makeAPICall(`/vehicles/listing/${encodeURIComponent(slug)}`);
  }

  async checkAvailability(vehicleId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return makeAPICall(`/vehicles/${vehicleId}/availability${tail}`);
  }

  async getPriceEstimate(vehicleId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return makeAPICall(`/vehicles/${vehicleId}/price-estimate${tail}`);
  }

  // ===== Bookings =====
  async createBooking(payload) {
    return makeAPICall(`/transport-bookings`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async getMyBookings() {
    return makeAPICall(`/transport-bookings/my-bookings`, {
      headers: await getAuthHeaders(),
    });
  }

  async getBookingById(id) {
    return makeAPICall(`/transport-bookings/${id}`, {
      headers: await getAuthHeaders(),
    });
  }

  async cancelBooking(id, { reason } = {}) {
    return makeAPICall(`/transport-bookings/${id}/cancel`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
  }

  // ===== Payments =====
  async createPaymentOrder(bookingId) {
    return makeAPICall(`/transport-bookings/${bookingId}/payment/create-order`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  async verifyPayment(bookingId, payload) {
    return makeAPICall(`/transport-bookings/${bookingId}/payment/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  // ===== Tracking =====
  async track(bookingId) {
    return makeAPICall(`/transportation/track/${bookingId}`, {
      headers: await getAuthHeaders(),
    });
  }

  // ===== AI Vehicle Recommender =====
  async recommendVehicle(payload) {
    return makeAPICall(`/transport-ai/recommend-vehicle`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export const transportAPI = new TransportAPI();
