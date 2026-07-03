// services/api/payoutAPI.js - Payout & commission API client
import { makeAPICall, getAuthHeaders } from "../apiConfig";

// Admin token getter - apps set this via setPayoutAdminTokenGetter
let _getAdminToken = () => null;

/**
 * Set the admin token getter function for payout admin operations.
 * @param {() => string|null} fn
 */
export const setPayoutAdminTokenGetter = (fn) => {
  _getAdminToken = fn;
};

function getAdminHeaders() {
  const token = _getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class PayoutAPI {
  // ===== Business (agent) methods =====

  async getPayoutSummary() {
    return makeAPICall("/payouts/business/summary", {
      headers: await getAuthHeaders(),
    });
  }

  async getPayoutHistory({ status, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return makeAPICall(`/payouts/business/history?${params.toString()}`, {
      headers: await getAuthHeaders(),
    });
  }

  async getPayoutDetails(payoutId) {
    return makeAPICall(`/payouts/details/${payoutId}`, {
      headers: await getAuthHeaders(),
    });
  }

  async markActivityCompleted(bookingId) {
    return makeAPICall(`/payouts/bookings/${bookingId}/complete`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  async getCommissionPreview(basePrice) {
    return makeAPICall(`/payouts/commission/preview?basePrice=${basePrice}`, {
      headers: await getAuthHeaders(),
    });
  }

  // ===== Admin methods =====

  async getAdminAnalytics(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return makeAPICall(`/payouts/admin/analytics?${params.toString()}`, {
      headers: getAdminHeaders(),
    });
  }

  async getAdminPayoutQueue() {
    return makeAPICall("/payouts/admin/queue", {
      headers: getAdminHeaders(),
    });
  }

  async processManualPayout(payoutId) {
    return makeAPICall(`/payouts/admin/${payoutId}/process`, {
      method: "POST",
      headers: getAdminHeaders(),
    });
  }

  async getAdminCommissionReport(startDate, endDate, format = "json") {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (format) params.set("format", format);
    return makeAPICall(`/payouts/admin/report?${params.toString()}`, {
      headers: getAdminHeaders(),
    });
  }

  // ===== Admin commission management =====

  async getBusinessCommission(businessId) {
    return makeAPICall(`/payouts/admin/commission/${businessId}`, {
      headers: getAdminHeaders(),
    });
  }

  async setBusinessCommission(businessId, { customRate, reason, validUntil }) {
    return makeAPICall(`/payouts/admin/commission/${businessId}`, {
      method: "POST",
      headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ customRate, reason, validUntil }),
    });
  }

  async removeBusinessCommission(businessId) {
    return makeAPICall(`/payouts/admin/commission/${businessId}`, {
      method: "DELETE",
      headers: getAdminHeaders(),
    });
  }

  async listCommissionOverrides() {
    return makeAPICall("/payouts/admin/commission-overrides", {
      headers: getAdminHeaders(),
    });
  }
}

export const payoutAPI = new PayoutAPI();
