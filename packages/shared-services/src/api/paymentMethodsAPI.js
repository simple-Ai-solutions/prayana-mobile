// paymentMethodsAPI.js - User-saved payment methods (Razorpay tokenized)
import { makeAPICall, getAuthHeaders } from "../apiConfig";

// Every save must carry a consent block (RBI card-on-file + DPDP): the
// server's current consent text for the event, by version and hash, as the
// website sends it (travel-ai-nextjs services/savedPaymentApi.js).
async function consentFor(eventType, purpose) {
  const res = await makeAPICall(
    `/users/me/identity/consent-text?eventType=${encodeURIComponent(eventType)}&version=v1`,
    { headers: await getAuthHeaders() },
  );
  const d = res?.data || {};
  if (!d.version || !d.hash) throw new Error("Couldn't load the consent text. Please try again.");
  return { textVersion: d.version, textHash: d.hash, purpose };
}

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
      body: JSON.stringify({
        ...payload,
        consent: await consentFor("payment.card.save", "save card for faster checkout"),
      }),
    });
  }

  async saveUpi(payload) {
    return makeAPICall(`/users/me/payment-methods/upi`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        consent: await consentFor("payment.upi.save", "save UPI handle for faster checkout"),
      }),
    });
  }

  async saveNetbanking(payload) {
    return makeAPICall(`/users/me/payment-methods/netbanking`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        consent: await consentFor("payment.netbanking.save", "save netbanking preference for faster checkout"),
      }),
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
