// @ts-nocheck — pure JS utility; types deliberately deferred.
// utils/distanceHelpers.js - Distance and time calculation utilities

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} a - First coordinate {lat, lng}
 * @param {Object} b - Second coordinate {lat, lng}
 * @returns {number} Distance in kilometers
 */
export function haversineKm(a, b) {
  if (!a || !b || !a.lat || !a.lng || !b.lat || !b.lng) return null;

  const R = 6371; // Earth's radius in km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(km) {
  if (km == null) return null;
  if (km < 0.3) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Estimate travel time based on distance
 * Assumes average speed of 30 km/h for city travel
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted time string
 */
export function formatTravelTime(km) {
  if (km == null) return null;
  const mins = Math.round((km / 30) * 60); // Assuming 30 km/h average speed
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins ? `${remainingMins}m` : ""}`.trim();
}

/**
 * Calculate distance and time between two activities
 * @param {Object} activity - Current activity with coordinates
 * @param {Object} nextActivity - Next activity with coordinates
 * @returns {Object|null} {distance: string, time: string} or null
 */
export function calculateActivityDistance(activity, nextActivity) {
  if (!activity?.coordinates || !nextActivity?.coordinates) return null;

  const km = haversineKm(activity.coordinates, nextActivity.coordinates);
  if (km == null) return null;

  return {
    distance: formatDistance(km),
    time: formatTravelTime(km),
    rawKm: km
  };
}

/**
 * Check if coordinates are valid
 * @param {Object} coords - Coordinates object {lat, lng}
 * @returns {boolean} True if valid
 */
export function hasValidCoords(coords) {
  if (!coords) return false;
  const lat = coords.lat || coords.latitude;
  const lng = coords.lng || coords.longitude;
  return lat != null && lng != null && !(lat === 0 && lng === 0);
}

/**
 * Generate slug from place name for destination page URL
 * @param {string} name - Place name
 * @returns {string} URL-safe slug
 */
export function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
