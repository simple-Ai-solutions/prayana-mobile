// @ts-nocheck — pure JS utility; types deliberately deferred.
/**
 * Fetches real coordinates from Google Places API when database coordinates are missing (0,0)
 */

export async function fetchCoordinatesFromGoogle(placeName, cityName) {
  if (typeof window === 'undefined' || !window.google?.maps?.places) {
    console.warn('Google Maps not loaded');
    return null;
  }

  return new Promise((resolve) => {
    const service = new window.google.maps.places.PlacesService(document.createElement('div'));

    const searchQuery = `${placeName}, ${cityName}`;

    service.textSearch(
      {
        query: searchQuery,
        fields: ['name', 'geometry'],
      },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
          const location = results[0].geometry?.location;
          if (location) {
            const coords = {
              lat: location.lat(),
              lng: location.lng(),
            };
            console.log(`Fetched coords for ${placeName}:`, coords);
            resolve(coords);
          } else {
            resolve(null);
          }
        } else {
          console.warn(`Could not find coords for ${placeName}`);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Checks if coordinates are missing or invalid (0,0)
 */
export function areCoordsInvalid(coords) {
  if (!coords) return true;

  const lat = coords.lat ?? coords.latitude ?? null;
  const lng = coords.lng ?? coords.longitude ?? null;

  // Invalid if missing or both are zero
  return lat === null || lng === null || (lat === 0 && lng === 0);
}

/**
 * Enhances a place object with real coordinates from Google Places API
 */
export async function enhancePlaceWithCoordinates(place, cityName) {
  const currentCoords = place.locationData?.coordinates || place.coordinates;

  // If coordinates are valid, return as-is
  if (!areCoordsInvalid(currentCoords)) {
    return place;
  }

  // Fetch from Google
  const googleCoords = await fetchCoordinatesFromGoogle(place.name, cityName);

  if (googleCoords) {
    return {
      ...place,
      coordinates: googleCoords,
      locationData: {
        ...place.locationData,
        coordinates: googleCoords,
      },
    };
  }

  return place;
}
