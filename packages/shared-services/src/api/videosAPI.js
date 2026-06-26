// videosAPI.js - YouTube travel videos for the destination search-results
// "Videos" tab. Mirrors the PWA /youtube/search endpoint (returns hand-picked
// travel tours / shorts for a destination).
import { makeAPICall } from "../apiConfig";

class VideosAPI {
  // Search YouTube travel videos for a destination.
  // q: search term (e.g. "Goa travel guide"), max: count, shorts: 0|1
  async search(opts = {}) {
    const { q, max = 10, shorts = 0 } = opts;
    const params = new URLSearchParams();
    params.append("q", q || "");
    params.append("max", String(max));
    params.append("shorts", String(shorts));
    return makeAPICall(`/youtube/search?${params.toString()}`);
  }
}

export const videosAPI = new VideosAPI();
export default videosAPI;
