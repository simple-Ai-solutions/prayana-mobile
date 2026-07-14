// ticketsAPI.js - Official / partner booking links for a place.
// Mirrors the PWA's services/ticketsAPI.js: a single POST to
// /destinations/official-booking-links which returns Headout / Viator /
// government / official-portal links for the given place.
//
// Like the web version this NEVER throws at the caller — a failed lookup
// resolves to an empty-but-valid structure so the Tickets tab can fall back to
// its "no tickets" state instead of blanking the screen.
import { makeAPICall } from "../apiConfig";

class TicketsAPI {
  async getOfficialBookingLinks(placeName, location, category) {
    try {
      const result = await makeAPICall("/destinations/official-booking-links", {
        method: "POST",
        body: JSON.stringify({ placeName, location, category }),
        timeout: 30000,
      });

      const links = Array.isArray(result?.data) ? result.data : [];

      return {
        links,
        city: result?.metadata?.city || location,
        source: result?.metadata?.source || "unknown",
        hasBooking: links.length > 0,
        data: links, // fallback shape, same as web
      };
    } catch (error) {
      console.warn("[ticketsAPI] Failed to fetch booking links:", error?.message);

      return {
        links: [],
        city: location,
        source: "error",
        hasBooking: false,
        error: error?.message,
        data: [],
      };
    }
  }
}

export const ticketsAPI = new TicketsAPI();
export default ticketsAPI;
