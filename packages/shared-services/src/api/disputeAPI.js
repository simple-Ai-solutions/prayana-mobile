// services/api/disputeAPI.js
// Adapted for React Native: removed Firebase/localStorage direct imports
import { API_CONFIG, getAuthHeaders, getAuthToken } from "../apiConfig";

// Admin token storage adapter - apps set this via setAdminStorage
let _getAdminToken = () => null;

/**
 * Set the admin token getter function.
 * @param {() => string|null} fn
 */
export const setDisputeAdminTokenGetter = (fn) => {
  _getAdminToken = fn;
};

function getAdminHeaders() {
  const token = _getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

const disputeAPI = {
  // Customer
  async createDispute(bookingId, data) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/bookings/${bookingId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getMyDisputes() {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/my`, {
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
    });
    return res.json();
  },

  // Business
  async getBusinessDisputes(status = "all") {
    const params = status !== "all" ? `?status=${status}` : "";
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/business${params}`, {
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
    });
    return res.json();
  },

  async businessRespond(disputeId, response) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/${disputeId}/business-respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ response }),
    });
    return res.json();
  },

  async addMessage(disputeId, message) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/${disputeId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  // Admin
  async getAdminDisputes({ status, priority, page, limit } = {}) {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (priority && priority !== "all") params.set("priority", priority);
    if (page) params.set("page", page);
    if (limit) params.set("limit", limit);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/admin${qs}`, {
      headers: getAdminHeaders(),
    });
    return res.json();
  },

  async getDisputeDetails(disputeId) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/admin/${disputeId}`, {
      headers: getAdminHeaders(),
    });
    return res.json();
  },

  async resolveDispute(disputeId, { decision, note, refundAmount }) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/admin/${disputeId}/resolve`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify({ decision, note, refundAmount }),
    });
    return res.json();
  },

  async closeDispute(disputeId, reason) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/admin/${disputeId}/close`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async adminAddMessage(disputeId, message) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/admin/${disputeId}/message`, {
      method: "POST",
      headers: getAdminHeaders(),
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  async updateDispute(disputeId, updates) {
    const res = await fetch(`${API_CONFIG.BASE_URL}/disputes/admin/${disputeId}`, {
      method: "PATCH",
      headers: getAdminHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },
};

export default disputeAPI;
