// itineraryAPI.js - Quick Itinerary + itinerary detail endpoints.
// Mirrors /api/itinerary/* on the server. Powers the mobile Quick Itinerary
// flow: browse/search saved itineraries -> AI generate (markdown/structured)
// -> view full day-by-day itinerary.

import { makeAPICall, getAuthHeaders } from "../apiConfig";

// AI generation can be slow; give it a generous timeout.
const GENERATE_TIMEOUT = 90000;

class ItineraryAPI {
  // Browse / search saved itineraries (public).
  // params: { q, limit, offset, slug }
  async search(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return makeAPICall(`/itinerary/search${tail}`);
  }

  // Popular itineraries for the browse hub.
  async getPopular(limit = 100) {
    return makeAPICall(`/itinerary/popular?limit=${limit}`);
  }

  // Fetch raw markdown content for a previously generated itinerary.
  async getMarkdown(markdownItineraryId) {
    return makeAPICall(
      `/itinerary/markdown/${encodeURIComponent(markdownItineraryId)}`
    );
  }

  // AI: generate a markdown itinerary from a template/request.
  // payload: { destination, duration, startingPoint, transportMode,
  //            preferences: { budget, interests, travelStyle, groupType } }
  async generateMarkdown(payload) {
    return makeAPICall(`/itinerary/generate-markdown`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
      timeout: GENERATE_TIMEOUT,
    });
  }

  // AI: generate a structured (day-by-day) itinerary.
  async generateStructured(payload) {
    return makeAPICall(`/itinerary/generate`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
      timeout: GENERATE_TIMEOUT,
    });
  }

  // Fetch a single itinerary by id or slug (for the detail screen).
  async getById(idOrSlug) {
    return makeAPICall(
      `/itinerary/search?slug=${encodeURIComponent(idOrSlug)}`
    );
  }

  // Poll for images attached to an itinerary after generation.
  async getImages(itineraryId) {
    return makeAPICall(
      `/itinerary/${encodeURIComponent(itineraryId)}/images`
    );
  }

  // Poll async generation job status.
  async getStatus(jobId) {
    return makeAPICall(`/itinerary/status/${encodeURIComponent(jobId)}`);
  }
}

export const itineraryAPI = new ItineraryAPI();
export default itineraryAPI;
