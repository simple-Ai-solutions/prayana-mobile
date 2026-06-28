// @ts-nocheck — pure JS utility; types deliberately deferred.
// Utility functions for generating and handling SEO-friendly slugs

/**
 * Generate a URL-friendly slug from destination name and city
 * @param {string} name - Destination name
 * @param {string} city - City name (optional)
 * @returns {string} - SEO-friendly slug
 */
export function generateSlug(name, city) {
  const base = `${name}${city ? '-' + city : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
  return base;
}

/**
 * Generate location slug from city/administrative area
 * @param {string} location - Location name (city, region, country)
 * @returns {string} - SEO-friendly location slug
 */
export function generateLocationSlug(location) {
  if (!location) return 'explore'; // Default fallback for unknown locations

  return location
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Generate destination slug from name only (no city)
 * @param {string} name - Destination name
 * @returns {string} - SEO-friendly destination slug
 */
export function generateDestinationSlug(name) {
  if (!name) return 'destination';

  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Parse hierarchical URL back to data
 * @param {string} locationSlug - Location slug from URL
 * @param {string} destinationSlug - Destination slug from URL
 * @returns {Object} - Parsed location and destination names
 */
export function parseDestinationUrl(locationSlug, destinationSlug) {
  return {
    location: locationSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    destination: destinationSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  };
}

/**
 * Generate slug from a destination object
 * @param {Object} destination - Destination object with name and city
 * @returns {string} - SEO-friendly slug
 */
export function getDestinationSlug(destination) {
  // If destination already has a slug, use it
  if (destination.slug) {
    return destination.slug;
  }

  // Otherwise generate from name and city
  const generatedSlug = generateSlug(destination.name, destination.city);
  console.warn(`Destination missing slug field, generated: ${generatedSlug} for ${destination.name}`);
  return generatedSlug;
}

/**
 * Generate slug from an itinerary object
 * @param {Object} itinerary - Itinerary object
 * @returns {string} - SEO-friendly slug
 */
export function getItinerarySlug(itinerary) {
  // PRIORITY 1: Use slug field if available (NEW!)
  if (itinerary.slug) {
    return itinerary.slug;
  }

  // PRIORITY 2: Use urlSlug virtual (backward compatibility)
  if (itinerary.urlSlug) {
    return itinerary.urlSlug;
  }

  // PRIORITY 3: Fallback to IDs
  if (itinerary.itineraryId) {
    return itinerary.itineraryId;
  }

  if (itinerary.markdownItineraryId) {
    return itinerary.markdownItineraryId;
  }

  // PRIORITY 4: Last resort - generate from data
  return `${generateSlug(itinerary.destination)}-${itinerary.duration}-days`;
}

/**
 * Extract slug from URL pathname
 * @param {string} pathname - URL pathname
 * @returns {string|null} - Extracted slug or null
 */
export function extractSlugFromPath(pathname) {
  // Match /destinations/[slug] or /itinerary/[slug]
  const match = pathname.match(/\/(destinations|itinerary)\/([^/]+)/);
  return match ? match[2] : null;
}

/**
 * Build hierarchical destination URL
 * @param {string|Object} slugOrDestination - Slug string or destination object
 * @returns {string} - Full hierarchical destination URL (/location/destination)
 */
export function buildDestinationUrl(slugOrDestination) {
  // If it's already a string slug, parse it to hierarchical format
  if (typeof slugOrDestination === 'string') {
    const parts = slugOrDestination.split('-');
    if (parts.length >= 2) {
      // Assume last part is location (e.g., "stone-chariot-hampi" -> location: "hampi", dest: "stone-chariot")
      const location = parts[parts.length - 1];
      const destName = parts.slice(0, -1).join('-');
      return `/${location}/${destName}`;
    }
    // Fallback to old format if can't parse
    return `/destinations/${slugOrDestination}`;
  }

  const destination = slugOrDestination;

  // Extract location from destination object - no default fallback to India
  const location = destination.locationData?.administrativeArea
    || destination.city
    || destination.location?.city
    || destination.country
    || destination.locationData?.city
    || null;

  // If no location found, log warning and use fallback
  if (!location) {
    console.warn('No location found for destination:', destination.name);
  }

  const locationSlug = generateLocationSlug(location);
  const destinationSlug = generateDestinationSlug(destination.name);

  return `/${locationSlug}/${destinationSlug}`;
}

/**
 * Build itinerary URL
 * @param {string|Object} slugOrItinerary - Slug string or itinerary object
 * @returns {string} - Full itinerary URL
 */
export function buildItineraryUrl(slugOrItinerary) {
  const slug = typeof slugOrItinerary === 'string'
    ? slugOrItinerary
    : getItinerarySlug(slugOrItinerary);

  return `/itinerary/${slug}`;
}

/**
 * Build search URL from query string
 * @param {string} query - Search query (e.g., "Hampi", "Paris France")
 * @returns {string} - SEO-friendly search URL (e.g., "/hampi", "/paris")
 */
export function buildSearchUrl(query) {
  if (!query || typeof query !== 'string') return '/';

  // Generate slug from query
  const slug = generateLocationSlug(query.trim());

  return `/${slug}`;
}

/**
 * Validate slug format
 * @param {string} slug - Slug to validate
 * @returns {boolean} - True if valid
 */
export function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;

  // Slug should only contain lowercase letters, numbers, and hyphens
  // Should not start or end with hyphen
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}
