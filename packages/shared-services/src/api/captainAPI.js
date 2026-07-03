// captainAPI.js - Captain Tours (peer-to-peer guide-run trips).
// Mirrors /captain/tours/public/* on the server.
import { makeAPICall } from "../apiConfig";

class CaptainAPI {
  // Public list of captain tours, optionally filtered by city.
  async getPublicTours(opts = {}) {
    const { city, limit = 100, skip = 0 } = opts;
    const params = new URLSearchParams();
    if (city) params.append("city", city);
    params.append("limit", String(limit));
    params.append("skip", String(skip));
    return makeAPICall(`/captain/tours/public/list?${params.toString()}`);
  }

  // Single tour by slug (detail).
  async getTourBySlug(slug) {
    return makeAPICall(`/captain/tours/public/${encodeURIComponent(slug)}`);
  }
}

export const captainAPI = new CaptainAPI();
export default captainAPI;
