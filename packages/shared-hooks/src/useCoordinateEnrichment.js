/**
 * useCoordinateEnrichment - Fetches missing coordinates for activities
 *
 * Uses Nominatim (OpenStreetMap) geocoding - free, no API key needed.
 * Rate limited to 1 request per second per Nominatim ToS.
 */
import { useEffect, useRef } from 'react';
import { useCreateTripStore } from '@prayana/shared-stores';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const REQUEST_DELAY = 1100; // 1.1s to respect Nominatim rate limit

// In-memory cache: "placeName|destination" → { lat, lng }
const coordCache = new Map();

/**
 * @param {number} dayIndex - Index of the current day
 * @param {Array} activities - Activities array for the current day
 * @param {string} destinationName - Name of the destination (for geocoding context)
 */
export function useCoordinateEnrichment(dayIndex, activities, destinationName) {
  const lastEnrichKey = useRef('');

  useEffect(() => {
    if (!activities || activities.length === 0 || !destinationName) return;

    // Find activities missing coordinates
    const missing = activities.filter(
      (a) =>
        !a.coordinates ||
        (a.coordinates.lat === 0 && a.coordinates.lng === 0) ||
        (!a.coordinates.lat && !a.coordinates.lng)
    );

    if (missing.length === 0) return;

    const enrichKey = `${dayIndex}-${missing.map((a) => a.name).sort().join(',')}`;
    if (enrichKey === lastEnrichKey.current) return;
    lastEnrichKey.current = enrichKey;

    let cancelled = false;

    const geocode = async (placeName) => {
      const cacheKey = `${placeName}|${destinationName}`;
      const cached = coordCache.get(cacheKey);
      if (cached) return cached;

      try {
        const query = `${placeName}, ${destinationName}`;
        const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'PrayanaAI/1.0 (travel-app)',
          },
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const coords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          if (!isNaN(coords.lat) && !isNaN(coords.lng)) {
            coordCache.set(cacheKey, coords);
            return coords;
          }
        }
      } catch {
        // Silently fail
      }
      return null;
    };

    const enrichAll = async () => {
      const results = [];

      for (const activity of missing) {
        if (cancelled) break;

        const coords = await geocode(activity.name);
        if (coords) {
          results.push({ name: activity.name, coordinates: coords });
        }

        // Rate limit: 1 req/sec
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
        }
      }

      if (cancelled || results.length === 0) return;

      // Update store
      const state = useCreateTripStore.getState();
      const newDays = [...state.days];
      if (!newDays[dayIndex]) return;

      const updatedActivities = [...newDays[dayIndex].activities];
      let changed = false;

      for (const result of results) {
        const actIdx = updatedActivities.findIndex(
          (a) =>
            a.name === result.name &&
            (!a.coordinates ||
              (a.coordinates.lat === 0 && a.coordinates.lng === 0))
        );
        if (actIdx >= 0) {
          updatedActivities[actIdx] = {
            ...updatedActivities[actIdx],
            coordinates: result.coordinates,
          };
          changed = true;
        }
      }

      if (changed) {
        newDays[dayIndex] = {
          ...newDays[dayIndex],
          activities: updatedActivities,
        };
        useCreateTripStore.setState({ days: newDays });
      }
    };

    enrichAll();

    return () => {
      cancelled = true;
    };
  }, [dayIndex, activities, destinationName]);
}
