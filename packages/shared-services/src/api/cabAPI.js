// cabAPI.js - Outstation Cabs (chauffeur-driven intercity). Mirrors /api/cabs/*
// on the server. Note: user-facing "Outstation Cabs" but every identifier is
// `cab`. Pricing is 100% server-side — search returns the fully-priced vehicle
// list; nothing about money is trusted from the client.
//
// Booking flow: search → book (status:pending) → createPaymentOrder (Razorpay)
// → verifyPayment (server confirms). A NO_REFUND_ACKNOWLEDGEMENT_REQUIRED error
// on book means the pickup is inside the free-cancellation cutoff — retry with
// acknowledgeNoRefund:true.
import { makeAPICall, getAuthHeaders } from "../apiConfig";

// A place field is { placeId, description } when a Google suggestion was picked,
// else the raw typed string.
const placeParam = (p) =>
  p && typeof p === "object" && p.placeId ? { placeId: p.placeId, description: p.description } : p;

class CabAPI {
  // Priced vehicle list for a route. optional auth.
  async search({ from, to, stops = [], departureDate, pickupTime, tripType = "one_way", returnDate, couponCode, driverLanguage } = {}) {
    return makeAPICall(`/cabs/search`, {
      method: "POST",
      body: JSON.stringify({
        from: placeParam(from),
        to: placeParam(to),
        stops: (stops || []).map(placeParam),
        departureDate,
        pickupTime,
        tripType,
        returnDate,
        couponCode,
        driverLanguage,
      }),
    });
  }

  // Create the (unpaid) booking. Requires auth.
  async book(payload) {
    return makeAPICall(`/cabs/book`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        from: placeParam(payload.from),
        to: placeParam(payload.to),
        stops: (payload.stops || []).map(placeParam),
      }),
    });
  }

  // Razorpay order — shared with self-drive under /transport-bookings.
  async createPaymentOrder(bookingId, { savedPaymentMethodId } = {}) {
    return makeAPICall(`/transport-bookings/${encodeURIComponent(bookingId)}/payment/create-order`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(savedPaymentMethodId ? { savedPaymentMethodId } : {}),
    });
  }

  // Verify — only the server's verdict flips the booking to paid.
  async verifyPayment(bookingId, { razorpayPaymentId, razorpaySignature }) {
    return makeAPICall(`/cabs/${encodeURIComponent(bookingId)}/payment/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ razorpayPaymentId, razorpaySignature }),
    });
  }

  // Cancellation state + cancel.
  async getCancellationState(bookingId) {
    return makeAPICall(`/cabs/${encodeURIComponent(bookingId)}/cancellation`, {
      headers: await getAuthHeaders(),
    });
  }

  async cancel(bookingId, reason) {
    return makeAPICall(`/cabs/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
  }
}

export const cabAPI = new CabAPI();
export default cabAPI;
