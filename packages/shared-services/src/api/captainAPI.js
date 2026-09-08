// captainAPI.js - Captain Tours (peer-to-peer guide-run trips).
// Mirrors /captain/tours/public/* + /captain/bookings on the server.
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class CaptainAPI {
  // Public list of captain tours, optionally filtered by city.
  async getPublicTours(opts = {}) {
    const { city, limit = 100, skip = 0 } = opts;
    const params = new URLSearchParams();
    if (city) params.append("city", city);
    params.append("limit", String(limit));
    params.append("skip", String(skip));
    return makeAPICall(`/captain/tours/public/list?${params.toString()}`);
  }

  // Single tour by slug (detail). Server route is .../public/by-slug/:slug.
  async getTourBySlug(slug) {
    return makeAPICall(`/captain/tours/public/by-slug/${encodeURIComponent(slug)}`);
  }

  // Create a booking against a specific departure batch.
  // Body: { tourSlug, batchId, booker:{name,email,phone}, travelers:[{name,email,phone?}] }
  async createBooking(payload) {
    return makeAPICall(`/captain/bookings`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  // Fire the payment-link emails to travelers (best effort, post-create).
  async notifyPaymentLinks(bookingId) {
    return makeAPICall(`/captain/bookings/${encodeURIComponent(bookingId)}/notify-payment-links`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
}

export const captainAPI = new CaptainAPI();
export default captainAPI;
