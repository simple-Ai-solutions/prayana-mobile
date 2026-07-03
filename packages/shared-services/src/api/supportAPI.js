// supportAPI.js - Support tickets (vendor + customer side share the same auth-gated routes)
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class SupportAPI {
  async listTickets({ status, page = 1, limit = 20 } = {}) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    qs.set("page", String(page));
    qs.set("limit", String(limit));
    return makeAPICall(`/support/tickets?${qs.toString()}`, {
      headers: await getAuthHeaders(),
    });
  }

  async getTicket(id) {
    return makeAPICall(`/support/tickets/${id}`, {
      headers: await getAuthHeaders(),
    });
  }

  async createTicket(payload) {
    return makeAPICall(`/support/tickets`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async addMessage(id, message) {
    return makeAPICall(`/support/tickets/${id}/messages`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ message }),
    });
  }

  async rateTicket(id, { rating, comment } = {}) {
    return makeAPICall(`/support/tickets/${id}/rate`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ rating, comment }),
    });
  }

  async getUnreadCount() {
    return makeAPICall(`/support/tickets/unread-count`, {
      headers: await getAuthHeaders(),
    });
  }
}

export const supportAPI = new SupportAPI();
