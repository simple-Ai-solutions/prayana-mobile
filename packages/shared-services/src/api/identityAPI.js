// identityAPI.js - User identity vault (passport, Aadhaar, PAN, visa)
// Backend stores encrypted; client only sees masked values + status.
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class IdentityAPI {
  async get() {
    return makeAPICall(`/users/me/identity`, {
      headers: await getAuthHeaders(),
    });
  }

  async saveDoc(docType, payload) {
    // docType e.g. "passport" | "aadhaar" | "pan" | "visa" | "drivers_license"
    return makeAPICall(`/users/me/identity/${docType}`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  }

  async removeDoc(docType) {
    return makeAPICall(`/users/me/identity/${docType}/remove`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  async requestErasure() {
    return makeAPICall(`/users/me/identity`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async getConsentText() {
    return makeAPICall(`/users/me/identity/consent-text`, {
      headers: await getAuthHeaders(),
    });
  }

  async digilockerInitiate(docType) {
    return makeAPICall(`/users/me/identity/digilocker/initiate`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ docType }),
    });
  }
}

export const identityAPI = new IdentityAPI();
