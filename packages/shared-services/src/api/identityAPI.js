// identityAPI.js — User Identity Vault (passport, PAN, driving licence; Aadhaar via DigiLocker).
//
// Matches the REAL server contract (routes/userIdentity.js, userIdentityController.js).
// The previous version POSTed to /users/me/identity/:type (no such route) with no
// consent block, so every save 404'd and the vault always showed empty. Corrected:
//   • GET  /users/me/identity                → { data: { passport, aadhaar, pan, drivingLicence, ... } }
//                                              (per-type objects, masked as numberLast4 — NOT a documents[] list)
//   • PATCH /users/me/identity               → save text fields; EVERY write needs a
//                                              consent block { textVersion, textHash, purpose }
//   • POST /users/me/identity/:docType/scan  → multipart scan upload (passport/pan/drivingLicence)
//   • POST /users/me/identity/:docType/remove
//   • DELETE /users/me/identity              → erase all
//   • GET  /users/me/identity/consent-text?eventType=..&version=v1 → { data:{ eventType, version, text, hash } }
//   • POST /users/me/identity/digilocker/initiate  (Aadhaar is DigiLocker-only)
import { makeAPICall, getAuthHeaders } from "../apiConfig";

// docType → the consent eventType the server expects (EVENT_TYPE_FOR_DOC).
export const CONSENT_EVENT_FOR_DOC = {
  passport: "identity.passport.store",
  aadhaar: "identity.aadhaar.link",
  pan: "identity.pan.store",
  drivingLicence: "identity.dl.store",
  emergencyContact: "identity.emergency_contact.store",
};

class IdentityAPI {
  /** Masked identity for display: { passport, aadhaar, pan, drivingLicence, kycTier, ... }. */
  async get() {
    return makeAPICall(`/users/me/identity`, {
      headers: await getAuthHeaders(),
    });
  }

  /** Fetch the canonical consent text + hash for a docType's write event. */
  async getConsentText(docType) {
    const eventType = CONSENT_EVENT_FOR_DOC[docType] || docType;
    return makeAPICall(
      `/users/me/identity/consent-text?eventType=${encodeURIComponent(eventType)}&version=v1`,
      { headers: await getAuthHeaders() },
    );
  }

  /**
   * Build the { textVersion, textHash, purpose } consent block a write needs, by
   * fetching the current canonical consent text first. Throws if unavailable.
   */
  async buildConsent(docType) {
    const res = await this.getConsentText(docType);
    const d = res?.data || {};
    if (!d.version || !d.hash) {
      throw new Error("Could not load the consent text. Please try again.");
    }
    return { textVersion: d.version, textHash: d.hash, purpose: d.eventType };
  }

  /**
   * Save a doc's TEXT fields (number + typed details) via PATCH, with consent.
   * `fields` is the per-docType object, e.g. for passport:
   *   { number, country, fullName, dateOfBirth, gender, issueDate, expiryDate }
   * for pan: { number, nameOnPan }; for drivingLicence:
   *   { number, licenseType, issuingState, issueDate, validUntil }.
   */
  async saveDetails(docType, fields) {
    const consent = await this.buildConsent(docType);
    return makeAPICall(`/users/me/identity`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ [docType]: fields, consent }),
    });
  }

  /** Save emergency contact (also PATCH, also consent-gated). */
  async saveEmergencyContact(contact) {
    const consent = await this.buildConsent("emergencyContact");
    return makeAPICall(`/users/me/identity`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ emergencyContact: contact, consent }),
    });
  }

  /**
   * Upload a scan image for passport/pan/drivingLicence (multipart, field "scan"),
   * with consent. `formData` must already contain the file under key "scan"; we
   * append the consent fields here so the caller doesn't have to.
   */
  async uploadScan(docType, formData) {
    const consent = await this.buildConsent(docType);
    formData.append("consent[textVersion]", consent.textVersion);
    formData.append("consent[textHash]", consent.textHash);
    formData.append("consent[purpose]", consent.purpose);
    return makeAPICall(`/users/me/identity/${docType}/scan`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
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

  /** Start DigiLocker linking (the ONLY way to add Aadhaar). Returns a redirect URL. */
  async digilockerInitiate(docType = "aadhaar") {
    return makeAPICall(`/users/me/identity/digilocker/initiate`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ docType }),
    });
  }
}

export const identityAPI = new IdentityAPI();
