// holidayPackagesAPI.js - Holiday packages marketplace + booking flow
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class HolidayPackagesAPI {
  // ===== Public catalogue =====
  async search(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return makeAPICall(`/packages/search${tail}`);
  }

  async getFeatured() {
    return makeAPICall(`/packages/featured`);
  }

  async getByDestination(city) {
    return makeAPICall(`/packages/destination/${encodeURIComponent(city)}`);
  }

  async getById(idOrSlug) {
    return makeAPICall(`/packages/${encodeURIComponent(idOrSlug)}`);
  }

  async calculatePrice(payload) {
    return makeAPICall(`/packages/calculate-price`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async customize(packageId, payload) {
    return makeAPICall(`/packages/${packageId}/customize`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createPriceAlert({ packageId, targetPrice, email, name } = {}) {
    return makeAPICall(`/packages/price-alert`, {
      method: "POST",
      body: JSON.stringify({ packageId, targetPrice, email, name }),
    });
  }

  // ===== Bookings (customer side) =====
  async createBooking(payload) {
    return makeAPICall(`/package-bookings`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async getMyBookings() {
    return makeAPICall(`/package-bookings/my`, {
      headers: await getAuthHeaders(),
    });
  }

  async getMyBookingById(id) {
    return makeAPICall(`/package-bookings/my/${id}`, {
      headers: await getAuthHeaders(),
    });
  }

  async cancelBooking(id, { reason } = {}) {
    return makeAPICall(`/package-bookings/my/${id}/cancel`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
  }

  // ===== Payments =====
  async createPaymentOrder(bookingId, { installmentNumber, savedPaymentMethodId } = {}) {
    return makeAPICall(`/package-bookings/my/${bookingId}/payment/create-order`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ installmentNumber, savedPaymentMethodId }),
    });
  }

  async verifyPayment(bookingId, payload) {
    return makeAPICall(`/package-bookings/my/${bookingId}/payment/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async submitReview(bookingId, { rating, title, body, photos } = {}) {
    return makeAPICall(`/package-bookings/my/${bookingId}/review`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ rating, title, body, photos }),
    });
  }
}

export const holidayPackagesAPI = new HolidayPackagesAPI();
