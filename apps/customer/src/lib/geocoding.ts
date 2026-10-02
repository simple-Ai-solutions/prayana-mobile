// geocoding — filling in coordinates the API does not provide.
//
// /destinations/hierarchical-search and /ai/generate return places with
// coordinates zeroed out ({lat: 0, lng: 0}), so the planner map had nothing
// real to plot. The web has never relied on those values either: it geocodes
// client-side in services/geocodingService.js and this is a port of that.
//
// Nominatim (OpenStreetMap) is free and needs no key, but its usage policy
// allows at most 1 request/second and requires a User-Agent — both are
// enforced below. Results are cached in memory so a day's places are only
// ever looked up once per session.

export type Coords = { lat: number; lng: number };

/** {0,0} is the API's "unknown", and is in the Atlantic — never a real place. */
export function isValidCoords(c?: Coords | null): c is Coords {
  return (
    !!c &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    (Math.abs(c.lat) > 0.0001 || Math.abs(c.lng) > 0.0001) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

const cache = new Map<string, Coords | null>();
const cacheKey = (name: string, city?: string) =>
  `${name}|${city || ''}`.trim().toLowerCase();

const MIN_INTERVAL_MS = 1100; // OSM policy: max 1 req/s
let lastCall = 0;

async function fromNominatim(name: string, city?: string): Promise<Coords | null> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const q = city ? `${name}, ${city}` : name;
  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=0`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'PrayanaAI-Mobile/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
  } catch {
    return null; // offline or rate-limited — the caller keeps the place, just unplotted
  }
}

/** Coordinates for one place, or null. Cached, including negative results. */
export async function geocodePlace(name: string, city?: string): Promise<Coords | null> {
  if (!name) return null;
  const key = cacheKey(name, city);
  if (cache.has(key)) return cache.get(key) ?? null;

  const coords = await fromNominatim(name, city);
  const out = isValidCoords(coords) ? coords : null;
  cache.set(key, out);
  return out;
}

/**
 * Fill in coordinates for any activity that lacks them, leaving the rest
 * untouched. Sequential by design: Nominatim's rate limit means parallel
 * requests would be throttled or blocked outright.
 */
export async function enrichActivitiesWithCoords<T extends { name?: string; coordinates?: Coords }>(
  activities: T[],
  cityName?: string,
): Promise<T[]> {
  if (!activities?.length) return activities;

  const out = [...activities];
  for (let i = 0; i < out.length; i++) {
    const act = out[i];
    if (isValidCoords(act?.coordinates)) continue;
    if (!act?.name) continue;

    const coords = await geocodePlace(act.name, cityName);
    if (coords) out[i] = { ...act, coordinates: coords };
  }
  return out;
}
