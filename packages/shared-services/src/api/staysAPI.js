// staysAPI.js - Stays (hotels, homestays, hostels, resorts, villas).
// Guest side: search → property → quote → book → pay (Razorpay) → voucher /
// cancel / review. Vendor side: listing wizard, rates & availability
// calendar, bookings, reviews, calendar sync (iCal) and tariff-card import.
// Server: travel-ai server routes/stays.js. Dates are "YYYY-MM-DD" (India time).
import { makeAPICall, getAuthHeaders } from "../apiConfig";

const qs = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || v === false) return;
    if (Array.isArray(v)) {
      if (v.length) q.append(k, v.join(","));
    } else q.append(k, v === true ? "1" : String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

const json = async (method, path, body) =>
  makeAPICall(path, {
    method,
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

// Uploads are slow on mobile data: a long timeout and our own abort signal —
// makeAPICall doesn't retry a call that carries one, and a retried upload
// could store the same photo twice.
const upload = async (path, form) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    return await makeAPICall(path, { method: "POST", headers: await getAuthHeaders(), body: form, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

class StaysAPI {
  // ===== Guest: discovery (public) =====

  // { q, checkIn, checkOut, adults, children: [ages], rooms, types: [], minPrice, maxPrice,
  //   amenities: [], coupleFriendly, localId, pets, stars, freeCancellation, sort, page }
  async search(params = {}) {
    return makeAPICall(`/stays/search${qs(params)}`);
  }

  async cities() {
    return makeAPICall("/stays/cities");
  }

  // With checkIn/checkOut (+ adults, children ages, rooms) includes `availability`.
  async getStay(slug, { checkIn, checkOut, adults, children = [], rooms } = {}) {
    const p = checkIn && checkOut ? { checkIn, checkOut, adults, children, rooms } : {};
    return makeAPICall(`/stays/p/${encodeURIComponent(slug)}${qs(p)}`);
  }

  // { roomTypeId, checkIn, checkOut, units, adults, childrenAges, couponCode }
  // → { pricing: { total, discount, payable, gst, nightly… }, coupon, freeCancellationUntil, … }
  async quote(slug, selection) {
    return makeAPICall(`/stays/p/${encodeURIComponent(slug)}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection),
    });
  }

  async reviews(slug, { page = 1, sort = "recent" } = {}) {
    return makeAPICall(`/stays/p/${encodeURIComponent(slug)}/reviews${qs({ page, sort })}`);
  }

  // ===== Guest: bookings (signed in) =====

  // { slug, roomTypeId, checkIn, checkOut, units, adults, childrenAges, guest: { name, email, phone },
  //   specialRequests, arrivalTime, couponCode, acceptedLegalDocs: [{ slug, version }] }
  async createBooking(payload) {
    return json("POST", "/stays/bookings", payload);
  }

  async myBookings() {
    return makeAPICall("/stays/bookings/my", { headers: await getAuthHeaders() });
  }

  async getBooking(id) {
    return makeAPICall(`/stays/bookings/${id}`, { headers: await getAuthHeaders() });
  }

  // → { orderId, amount (paise), currency, keyId, reference }
  async createPaymentOrder(id) {
    return json("POST", `/stays/bookings/${id}/payment/create-order`, {});
  }

  // camelCase, like eSIM / cab: { razorpayPaymentId, razorpaySignature }
  async verifyPayment(id, { razorpayPaymentId, razorpaySignature }) {
    return json("POST", `/stays/bookings/${id}/payment/verify`, { razorpayPaymentId, razorpaySignature });
  }

  async cancelBooking(id, reason) {
    return json("POST", `/stays/bookings/${id}/cancel`, { reason });
  }

  // review: { rating, aspects: { cleanliness, location, value, staff, comfort }, tripType, title, body }
  // photos: [{ uri, name, type }] (optional, ≤5)
  async submitReview(id, review, photos = []) {
    if (!photos.length) return json("POST", `/stays/bookings/${id}/review`, review);
    const form = new FormData();
    form.append("data", JSON.stringify(review));
    photos.slice(0, 5).forEach((p) => form.append("photos", p));
    return upload(`/stays/bookings/${id}/review`, form);
  }

  // ===== Vendor: listings =====

  async listMine() {
    return makeAPICall("/stays/mine", { headers: await getAuthHeaders() });
  }

  async getMine(id) {
    return makeAPICall(`/stays/mine/${id}`, { headers: await getAuthHeaders() });
  }

  async create(propertyType) {
    return json("POST", "/stays", { propertyType });
  }

  // Partial update: only fields sent change. Room types carry their `_id`.
  async update(id, patch) {
    return json("PATCH", `/stays/mine/${id}`, patch);
  }

  async submit(id) {
    return json("POST", `/stays/mine/${id}/submit`, {});
  }

  async remove(id) {
    return json("DELETE", `/stays/mine/${id}`);
  }

  // files: [{ uri, name, type }]; slot: exterior|reception|common|view|dining|pool|other|room|bathroom
  async uploadPhotos(id, files, { slot, roomTypeId, dimensions = [] } = {}) {
    const form = new FormData();
    files.forEach((f) => form.append("photos", f));
    if (slot) form.append("slot", slot);
    if (roomTypeId) form.append("roomTypeId", roomTypeId);
    form.append("dimensions", JSON.stringify(dimensions));
    return upload(`/stays/mine/${id}/photos`, form);
  }

  async updatePhoto(id, photoId, patch) {
    return json("PATCH", `/stays/mine/${id}/photos/${photoId}`, patch);
  }

  async deletePhoto(id, photoId) {
    return json("DELETE", `/stays/mine/${id}/photos/${photoId}`);
  }

  // file: { uri, name, type }; type: trade_licence|homestay_registration|tourism_registration|property_proof|…
  async uploadLicence(id, { file, type, number }) {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    if (number) form.append("number", number);
    return upload(`/stays/mine/${id}/licences`, form);
  }

  async deleteLicence(id, licenceId) {
    return json("DELETE", `/stays/mine/${id}/licences/${licenceId}`);
  }

  async priceEstimate({ prices, gstRegistered, gstin }) {
    return json("POST", "/stays/price-estimate", { prices, gstRegistered, gstin });
  }

  // Fill a draft from the owner's listing elsewhere (Airbnb / Booking.com / MakeMyTrip …).
  // { url, confirmOwnership, importPhotos = true, stayId, screenshots: [{ uri, name, type }] }
  // → 202 with the draft; poll getMine(id) until data.importJob.status is "done" or "failed".
  async importListing({ url, confirmOwnership, importPhotos = true, stayId, screenshots = [] }) {
    if (!screenshots.length) return json("POST", "/stays/import", { url, confirmOwnership, importPhotos, stayId });
    const form = new FormData();
    if (url) form.append("url", url);
    form.append("confirmOwnership", String(!!confirmOwnership));
    form.append("importPhotos", String(importPhotos !== false));
    if (stayId) form.append("stayId", stayId);
    screenshots.slice(0, 8).forEach((f) => form.append("screenshots", f));
    return upload("/stays/import", form);
  }

  // Photo / PDF of a price list → { rooms: [room types], propertyName, season, notes }. Saves nothing.
  async importTariff(id, file) {
    const form = new FormData();
    form.append("file", file);
    return upload(`/stays/mine/${id}/import-tariff`, form);
  }

  // ===== Vendor: calendar, bookings, reviews, calendar sync =====

  async getCalendar(id, { from, days = 42 } = {}) {
    return makeAPICall(`/stays/mine/${id}/calendar${qs({ from, days })}`, { headers: await getAuthHeaders() });
  }

  // { roomTypeIds: [...] | "all", from, to, closed?, priceOverride? (number|null), blocked? }
  async updateCalendar(id, change) {
    return json("PATCH", `/stays/mine/${id}/calendar`, change);
  }

  async vendorBookings({ bucket = "upcoming", stayId, page = 1 } = {}) {
    return makeAPICall(`/stays/vendor/bookings${qs({ bucket, stayId, page })}`, { headers: await getAuthHeaders() });
  }

  async vendorCancelBooking(bookingId, reason) {
    return json("POST", `/stays/vendor/bookings/${bookingId}/cancel`, { reason });
  }

  async vendorMarkNoShow(bookingId) {
    return json("POST", `/stays/vendor/bookings/${bookingId}/no-show`, {});
  }

  async vendorReviews({ stayId, filter, page = 1 } = {}) {
    return makeAPICall(`/stays/vendor/reviews${qs({ stayId, filter, page })}`, { headers: await getAuthHeaders() });
  }

  async replyToReview(reviewId, body) {
    return json("POST", `/stays/vendor/reviews/${reviewId}/reply`, { body });
  }

  async flagReview(reviewId, reason) {
    return json("POST", `/stays/vendor/reviews/${reviewId}/flag`, { reason });
  }

  async getCalendarSync(id) {
    return makeAPICall(`/stays/mine/${id}/ical`, { headers: await getAuthHeaders() });
  }

  async addCalendarImport(id, { roomTypeId, url, label }) {
    return json("POST", `/stays/mine/${id}/ical/imports`, { roomTypeId, url, label });
  }

  async removeCalendarImport(id, importId) {
    return json("DELETE", `/stays/mine/${id}/ical/imports/${importId}`);
  }

  async syncCalendarsNow(id) {
    return json("POST", `/stays/mine/${id}/ical/sync`, {});
  }
}

export const staysAPI = new StaysAPI();
export default staysAPI;
