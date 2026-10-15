// esimAPI.js - eSIM marketplace endpoints (Matrix + eSIM Go multi-provider)
// Mirrors /api/esim/* on the server. Used by the customer eSIM flow:
// catalogue → bundle detail → create order → KYC upload → payment → fulfilment.

import { makeAPICall, getAuthHeaders, API_CONFIG } from "../apiConfig";

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

  async getBundleDetails(bundleName, country) {
    // Forward the catalogue country so a regional plan is priced for the country
    // the customer clicked through from — otherwise the checkout total can differ
    // from the discounted price the plan card just showed them.
    const qs = country ? `?country=${encodeURIComponent(country)}` : "";
    return makeAPICall(`/esim/bundles/${encodeURIComponent(bundleName)}${qs}`);
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

  // Whether the eSIM profile is on the customer's phone yet:
  // { installed: true|false|null, statusCode }. Only Matrix reports it;
  // other providers answer statusCode "not_supported".
  async getInstallStatus(orderId) {
    return makeAPICall(`/esim/orders/${orderId}/install-status`, {
      headers: await getAuthHeaders(),
    });
  }

  // The GST invoice is a PDF, so callers download it themselves with these.
  invoiceUrl(orderId) {
    return `${API_CONFIG.BASE_URL}/esim/orders/${orderId}/invoice`;
  }
  async invoiceHeaders() {
    return getAuthHeaders();
  }

  // ===== Promos =====
  // The admin's current eSIM promo ({ code, displayPercent, headline, ... }),
  // or null. The server answers 204 when none is running, which makeAPICall
  // would try to parse as JSON, so this one is fetched directly.
  async getActivePromo() {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/esim/active-promo`, { headers: { Accept: "application/json" } });
      if (res.status === 204 || !res.ok) return null;
      const json = await res.json().catch(() => null);
      return json?.success && json.data?.code ? json.data : null;
    } catch {
      return null;
    }
  }

  // Check a promo code against this plan's price. Only a preview: the server
  // re-validates the code (and may cap the discount) when the order is made.
  async validateCoupon({ code, userId, orderAmount, productId }) {
    return makeAPICall(`/coupons/validate`, {
      method: "POST",
      body: JSON.stringify({ code, userId, orderAmount, applicableType: "esim", packageId: productId, activityId: productId }),
    });
  }
}

export const esimAPI = new EsimAPI();
