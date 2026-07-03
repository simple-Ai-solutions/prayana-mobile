// paymentMethodsAPI.js - User-saved payment methods (Razorpay tokenized)
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class PaymentMethodsAPI {
  async list() {
    return makeAPICall(`/users/me/payment-methods`, {
      headers: await getAuthHeaders(),
    });
  }

  async saveCard(payload) {
    // After a successful first-time card payment with `save = true`, the
    // server tokenizes via Razorpay and returns the saved-method record.
    return makeAPICall(`/users/me/payment-methods`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async saveUpi(payload) {
    return makeAPICall(`/users/me/payment-methods/upi`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async saveNetbanking(payload) {
    return makeAPICall(`/users/me/payment-methods/netbanking`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async update(id, payload) {
    return makeAPICall(`/users/me/payment-methods/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async remove(id) {
    return makeAPICall(`/users/me/payment-methods/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }
}

export const paymentMethodsAPI = new PaymentMethodsAPI();
