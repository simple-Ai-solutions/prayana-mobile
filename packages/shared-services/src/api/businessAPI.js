// services/api/businessAPI.js
import { makeAPICall, getAuthHeaders, getAuthToken } from "../apiConfig";

class BusinessAPI {
  // ===== ONBOARDING =====

  async register(data) {
    return makeAPICall("/business/register", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async getMyBusiness() {
    return makeAPICall("/business/me", {
      headers: await getAuthHeaders(),
    });
  }

  async updateMyBusiness(data) {
    return makeAPICall("/business/me", {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async saveOnboardingStep(step, data) {
    return makeAPICall(`/business/me/step/${step}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ data }),
    });
  }

  async uploadLogo(formDataOrUrl) {
    const authHeaders = await getAuthHeaders();
    if (typeof formDataOrUrl === "string") {
      return makeAPICall("/business/me/logo", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ logoUrl: formDataOrUrl }),
      });
    }
    // FormData - don't set Content-Type; browser/RN sets multipart boundary
    return makeAPICall("/business/me/logo", {
      method: "POST",
      headers: { ...authHeaders },
      body: formDataOrUrl,
    });
  }

  async uploadDocument(formData) {
    const token = await getAuthToken();
    return makeAPICall("/business/me/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  }

  async getPayoutConfig() {
    return makeAPICall("/business/me/payout", {
      headers: await getAuthHeaders(),
    });
  }

  async configurePayout(data) {
    return makeAPICall("/business/me/payout", {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  // ===== DASHBOARD =====

  async getDashboard() {
    return makeAPICall("/business/me/dashboard", {
      headers: await getAuthHeaders(),
      timeout: 30000,
    });
  }

  async getMyBookings(filters = {}) {
    const params = new URLSearchParams(filters);
    return makeAPICall(`/business/me/bookings?${params.toString()}`, {
      headers: await getAuthHeaders(),
    });
  }

  async updateBookingStatus(bookingId, status, note = null) {
    return makeAPICall(`/business/me/bookings/${bookingId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status, note }),
    });
  }

  // ===== KYC & VERIFICATION =====

  async getDocumentRequirements() {
    return makeAPICall("/business/me/document-requirements", {
      headers: await getAuthHeaders(),
    });
  }

  async getKYCStatus() {
    return makeAPICall("/business/me/kyc-status", {
      headers: await getAuthHeaders(),
    });
  }

  async verifyPAN(panNumber) {
    return makeAPICall("/business/me/verify-pan", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ panNumber }),
      timeout: 30000,
    });
  }

  async verifyFSSAI(licenseNumber) {
    return makeAPICall("/business/me/verify-fssai", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ licenseNumber }),
      timeout: 30000,
    });
  }

  async triggerAutoVerify(documentId) {
    return makeAPICall(`/business/me/documents/${documentId}/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      timeout: 30000,
    });
  }

  // ===== OTP VERIFICATION =====

  async sendEmailOTP(email) {
    return makeAPICall("/business/me/send-otp/email", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ email }),
    });
  }

  async sendPhoneOTP(phone) {
    return makeAPICall("/business/me/send-otp/phone", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOTP(identifier, otp, type) {
    return makeAPICall("/business/me/verify-otp", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ identifier, otp, type }),
    });
  }

  // ===== QUALITY SCORE =====

  async getQualityScore(businessId) {
    return makeAPICall(`/business/${businessId}/quality-score`, {
      headers: await getAuthHeaders(),
    });
  }

  async recalculateQualityScore(businessId) {
    return makeAPICall(`/business/${businessId}/quality-score/recalculate`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  // ===== REVIEWS MANAGEMENT (vendor side) =====

  async getMyReviews({ page = 1, limit = 20 } = {}) {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return makeAPICall(`/business/me/reviews?${qs.toString()}`, {
      headers: await getAuthHeaders(),
    });
  }

  async replyToReview(reviewId, comment) {
    return makeAPICall(`/business/me/reviews/${reviewId}/reply`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ comment }),
    });
  }

  // ===== PUBLIC PROFILE =====

  async getPublicProfile(slug) {
    return makeAPICall(`/business/${slug}`);
  }

  // ===== COUPONS (vendor promo codes) =====

  async listMyCoupons() {
    return makeAPICall("/business/me/coupons", {
      headers: await getAuthHeaders(),
    });
  }

  async createCoupon(data) {
    return makeAPICall("/business/me/coupons", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async updateCoupon(couponId, data) {
    return makeAPICall(`/business/me/coupons/${couponId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deleteCoupon(couponId) {
    return makeAPICall(`/business/me/coupons/${couponId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  // ===== GSTIN VERIFICATION =====

  async verifyGSTIN(gstin) {
    return makeAPICall("/business/me/verify-gstin", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ gstin }),
      timeout: 30000,
    });
  }

  // ===== REVIEW MODERATION (vendor side) =====

  async flagReview(reviewId, reason) {
    return makeAPICall(`/business/me/reviews/${reviewId}/flag`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
  }
}

export const businessAPI = new BusinessAPI();
