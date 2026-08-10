// ondcAPI.js - ONDC (Beckn TRV14) monument ticket-booking BAP client.
// Mirrors /api/ondc/* on the server and the web services/api/ondcAPI.js.
//
// This is an ASYNC BAP flow: every outbound action (search/select/init/confirm)
// returns { transactionId, messageId } immediately, then the caller POLLS
// GET /ondc/transactions/:transactionId every 2s until the transaction's
// `currentAction` flips to the matching on_* callback. See pollForCallback below.
import { makeAPICall, getAuthHeaders } from "../apiConfig";

const POLL_INTERVAL = 2000;
const POLL_MAX_ATTEMPTS = 15; // ~30s ceiling, matching the web store

class OndcAPI {
  // === Outbound BAP actions (each returns { success, transactionId?, messageId }) ===

  // Fire an ONDC search. Requires monumentName; city/state/date/nationality/category optional.
  async searchMonuments(params) {
    return makeAPICall(`/ondc/search`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(params),
    });
  }

  async selectTicket({ transactionId, providerId, itemId, quantity }) {
    return makeAPICall(`/ondc/select`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ transactionId, providerId, itemId, quantity }),
    });
  }

  async initOrder({ transactionId, billing, visitors, visitDate }) {
    return makeAPICall(`/ondc/init`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ transactionId, billing, visitors, visitDate }),
    });
  }

  async confirmOrder({ transactionId, payment }) {
    return makeAPICall(`/ondc/confirm`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ transactionId, payment }),
    });
  }

  async checkStatus({ transactionId }) {
    return makeAPICall(`/ondc/status`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ transactionId }),
    });
  }

  async cancelOrder({ transactionId, reasonCode, reasonDesc }) {
    return makeAPICall(`/ondc/cancel`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ transactionId, reasonCode, reasonDesc }),
    });
  }

  // === Queries ===

  // The poll target. Returns { success, transaction: <full OndcTransaction doc> }.
  async getTransaction(transactionId) {
    return makeAPICall(`/ondc/transactions/${encodeURIComponent(transactionId)}`, {
      headers: await getAuthHeaders(),
    });
  }

  // Confirmed tickets only. Returns { success, tickets: [...] }.
  async getMyTickets() {
    return makeAPICall(`/ondc/my-tickets`, {
      headers: await getAuthHeaders(),
    });
  }

  // === Polling helper ===
  // Poll the transaction until currentAction === expectedAction (an on_* string),
  // or timeout. Returns the transaction doc on success, null on timeout. Optional
  // onTick(txn) fires each poll so a screen can surface progress.
  async pollForCallback(transactionId, expectedAction, onTick) {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      let txn;
      try {
        const res = await this.getTransaction(transactionId);
        txn = res?.transaction;
      } catch {
        continue; // transient; keep polling
      }
      if (txn) {
        if (typeof onTick === "function") onTick(txn);
        if (txn.currentAction === expectedAction) return txn;
        if (txn.status === "error") return txn; // surface server-side failure
      }
    }
    return null; // timed out
  }
}

export const ondcAPI = new OndcAPI();
