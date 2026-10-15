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

  // Filter facets for the listing: { total, category:{label:count}, city:{...},
  // packageType:{...}, nights:[min,max], price:[min,max] }.
  async getFacets() {
    return makeAPICall(`/packages/facets`);
  }

  // Last-minute / value deals — cheapest package per destination under a ceiling.
  async getValueDeals({ maxPrice = 25000, limit = 12, only = "" } = {}) {
    const qs = new URLSearchParams();
    qs.append("maxPrice", String(maxPrice));
    qs.append("limit", String(limit));
    if (only) qs.append("only", only);
    return makeAPICall(`/packages/deals?${qs.toString()}`);
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

  // ===== Trip gallery (traveller photos from a completed trip) =====
  // The server checks each photo against the trip's places and dates and
  // answers per file in `results` (approved / pending / rejected). A batch
  // where nothing was accepted comes back as a 422 carrying the same body.
  async uploadTripGallery(packageId, files) {
    const form = new FormData();
    files.forEach((f) => form.append("media", { uri: f.uri, name: f.name, type: f.type }));
    try {
      return await makeAPICall(`/packages/${packageId}/trip-gallery/customer`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: form,
        timeout: 120000,
      });
    } catch (err) {
      if (err?.status === 422 && err.data) return err.data;
      throw err;
    }
  }

  // The caller's own uploads, including ones still awaiting review.
  async getMyTripGallery(packageId) {
    return makeAPICall(`/packages/${packageId}/trip-gallery/mine`, {
      headers: await getAuthHeaders(),
    });
  }

  async deleteMyTripGalleryItem(packageId, itemId) {
    return makeAPICall(`/packages/${packageId}/trip-gallery/customer/${itemId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async reportTripGalleryItem(packageId, itemId, reason) {
    return makeAPICall(`/packages/${packageId}/trip-gallery/${itemId}/report`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
  }
}

export const holidayPackagesAPI = new HolidayPackagesAPI();
