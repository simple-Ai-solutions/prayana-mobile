// esimAPI.js - eSIM marketplace endpoints (Matrix + eSIM Go multi-provider)
// Mirrors /api/esim/* on the server. Used by the customer eSIM flow:
// catalogue → bundle detail → create order → KYC upload → payment → fulfilment.

import { makeAPICall, getAuthHeaders } from "../apiConfig";

class EsimAPI {
  // Public catalogue (no auth needed)
  async getCatalogue(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return makeAPICall(`/esim/catalogue${tail}`);
  }

  async getBundleDetails(bundleName) {
    return makeAPICall(`/esim/bundles/${encodeURIComponent(bundleName)}`);
  }

  // Order lifecycle
  async createOrder(payload) {
    return makeAPICall(`/esim/orders`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async getMyOrders() {
    return makeAPICall(`/esim/orders/my`, {
      headers: await getAuthHeaders(),
    });
  }

  async getOrderById(orderId) {
    return makeAPICall(`/esim/orders/${orderId}`, {
      headers: await getAuthHeaders(),
    });
  }

  async cancelOrder(orderId) {
    return makeAPICall(`/esim/orders/${orderId}/cancel`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  async checkUsage(orderId) {
    return makeAPICall(`/esim/orders/${orderId}/usage`, {
      headers: await getAuthHeaders(),
    });
  }

  // KYC upload (multipart). Caller passes a FormData built with the doc URI.
  async uploadKYC(orderId, formData) {
    return makeAPICall(`/esim/orders/${orderId}/kyc`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });
  }

  // Payment
  async createPaymentOrder(orderId, { savedPaymentMethodId } = {}) {
    return makeAPICall(`/esim/orders/${orderId}/pay`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ savedPaymentMethodId }),
    });
  }

  async verifyPayment(orderId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    return makeAPICall(`/esim/orders/${orderId}/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      }),
    });
  }

  // Recharge (top-up after first plan)
  async getRechargeOptions(orderId) {
    return makeAPICall(`/esim/orders/${orderId}/recharge-options`, {
      headers: await getAuthHeaders(),
    });
  }

  async createRecharge(orderId, payload) {
    return makeAPICall(`/esim/orders/${orderId}/recharge`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async verifyRecharge(orderId, payload) {
    return makeAPICall(`/esim/orders/${orderId}/recharge/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }
}

export const esimAPI = new EsimAPI();
