// luxuryDataTransformer.ts
// Pure TypeScript utility that transforms a flat API response of places
// into a structured luxury layout format for destination pages.
// No web-specific dependencies - works on any platform.

// ---------------------------------------------------------------------------
// Image URL Resolution (for React Native)
// Server may return relative proxy URLs like "/api/images/proxy?url=..."
// which work in browsers but fail in React Native. Apps should call
// setImageServerOrigin() at startup so relative URLs get resolved.
// ---------------------------------------------------------------------------

let _imageServerOrigin = ''; // e.g. "http://192.168.31.185:5000"

/**
 * Set the server origin for resolving relative image URLs.
 * Call once at app startup alongside setBaseURL().
 * @param origin - Server origin without trailing slash (e.g. "http://192.168.31.185:5000")
 */
export function setImageServerOrigin(origin: string) {
  _imageServerOrigin = origin.replace(/\/+$/, '');
}

/**
 * Resolve an image URL — converts relative paths to absolute using the
 * configured server origin. Absolute URLs are returned as-is.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — needs server origin
  if (_imageServerOrigin && url.startsWith('/')) {
    return `${_imageServerOrigin}${url}`;
  }
  // S3 key-style path (e.g. "images/place-names/..." without leading /)
  // These are stored in the DB and need the server origin + /api/ prefix
  if (_imageServerOrigin && url.startsWith('images/')) {
    return `${_imageServerOrigin}/api/${url}`;
  }
  return url;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LuxuryPlace {
  name: string;
  rating: number;
  category?: string;
  image?: string;
  images?: any[];
  imageUrls?: string[];
  shortDescription?: string;
  description?: string;
  duration?: string;
  entryFee?: string;
  location?: string;
  city?: string;
  country?: string;
  highlights?: string[];
  coordinates?: { lat: number; lng: number };
  organizationData?: {
    isTopAttraction?: boolean;
    isHiddenGem?: boolean;
    experienceTags?: string[];
    popularityLevel?: string;
  };
  locationData?: {
    administrativeArea?: string;
    city?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  };
  id?: string;
  _id?: string;
  slug?: string;
}

export interface LuxuryHero {
  collectionTitle: string;
  tagline: string;
  stats: {
    totalSites: number;
    circuits: number;
    hiddenGems: number;
    avgRating: number;
  };
  locationInfo: {
    name: string;
    type: string;
    state: string;
    country: string;
  };
}

export interface LuxuryData {
  hero: LuxuryHero;
  crownJewels: LuxuryPlace[];
  administrativeCircuits: Record<string, LuxuryPlace[]>;
  dynamicCircuits: Record<string, LuxuryPlace[]>;
  hiddenGems: LuxuryPlace[];
  allPlaces: LuxuryPlace[];
  experienceTags: { tag: string; count: number; emoji: string }[];
  metadata: {
    totalPlaces: number;
    circuitCounts: {
      administrative: number;
      dynamic: number;
      total: number;
    };
  };
}

export interface ApiResponse {
  success?: boolean;
  data?: LuxuryPlace[];
  locationName?: string;
  locationType?: string;
  state?: string;
  country?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TAG_EMOJIS: Record<string, string> = {
  spiritual: '\u{1F64F}',    // 🙏
  heritage: '\u{1F3DB}',     // 🏛️
  nature: '\u{1F33F}',       // 🌿
  adventure: '\u{1F9D7}',    // 🧗
  beach: '\u{1F3D6}',        // 🏖️
  food: '\u{1F35B}',         // 🍛
  shopping: '\u{1F6CD}',     // 🛍️
  architecture: '\u{1F3D7}', // 🏗️
  cultural: '\u{1F3A8}',     // 🎨
  historical: '\u2694',       // ⚔️
  religious: '\u{1F54C}',    // 🕌
  wildlife: '\u{1F418}',     // 🐘
  temple: '\u{1F6D5}',       // 🛕
  fort: '\u{1F3F0}',         // 🏰
  palace: '\u{1F451}',       // 👑
  garden: '\u{1F333}',       // 🌳
  market: '\u{1F3EA}',       // 🏪
  museum: '\u{1F5BC}',       // 🖼️
  lake: '\u{1F3DE}',         // 🏞️
  mountain: '\u{1F3D4}',     // 🏔️
  waterfall: '\u{1F4A7}',    // 💧
  default: '\u{1F4CD}',      // 📍
};

const DYNAMIC_CIRCUIT_RULES: {
  label: string;
  test: (place: LuxuryPlace) => boolean;
}[] = [
  {
    label: '\u{1F451} Royal Heritage', // 👑
    test: (place) => {
      const nameLower = (place.name || '').toLowerCase();
      const hasKeyword =
        nameLower.includes('fort') ||
        nameLower.includes('palace') ||
        nameLower.includes('mahal');
      const isHistorical =
        (place.category || '').toLowerCase() === 'historical';
      return hasKeyword || isHistorical;
    },
  },
  {
    label: '\u{1F64F} Spiritual Journey', // 🙏
    test: (place) => {
      const nameLower = (place.name || '').toLowerCase();
      const hasKeyword =
        nameLower.includes('temple') ||
        nameLower.includes('mandir') ||
        nameLower.includes('church');
      const isReligious =
        (place.category || '').toLowerCase() === 'religious';
      return hasKeyword || isReligious;
    },
  },
  {
    label: '\u{1F3A8} Cultural Treasures', // 🎨
    test: (place) => {
      const tags = (
        place.organizationData?.experienceTags || []
      ).map((t) => t.toLowerCase());
      const hasCulturalTag = tags.some(
        (t) =>
          t.includes('museum') ||
          t.includes('art') ||
          t.includes('culture') ||
          t.includes('heritage')
      );
      const isCultural =
        (place.category || '').toLowerCase() === 'cultural';
      return hasCulturalTag || isCultural;
    },
  },
  {
    label: '\u{1F6CD} Shopping & Markets', // 🛍️
    test: (place) => {
      const nameLower = (place.name || '').toLowerCase();
      const hasKeyword =
        nameLower.includes('bazaar') ||
        nameLower.includes('market') ||
        nameLower.includes('mall');
      const tags = (
        place.organizationData?.experienceTags || []
      ).map((t) => t.toLowerCase());
      const hasShoppingTag = tags.some((t) => t.includes('shopping'));
      return hasKeyword || hasShoppingTag;
    },
  },
  {
    label: '\u{1F333} Gardens & Nature', // 🌳
    test: (place) => {
      const nameLower = (place.name || '').toLowerCase();
      const hasKeyword =
        nameLower.includes('garden') ||
        nameLower.includes('park') ||
        nameLower.includes('kund');
      const tags = (
        place.organizationData?.experienceTags || []
      ).map((t) => t.toLowerCase());
      const hasNatureTag = tags.some(
        (t) => t.includes('nature') || t.includes('garden')
      );
      return hasKeyword || hasNatureTag;
    },
  },
  {
    label: '\u{1F3AD} Modern Experiences', // 🎭
    test: (place) => {
      const categoryLower = (place.category || '').toLowerCase();
      return (
        categoryLower === 'entertainment' || categoryLower === 'urban'
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Resolve the best available image URL from a place object.
 * Tries place.image, then place.imageUrls[0], then place.images[0].
 * Handles both string and { url: string } formats in the images array.
 * Returns null if no image is found.
 */
export function getPlaceImageUrl(place: LuxuryPlace): string | null {
  if (!place) return null;

  let url: string | null = null;

  // 1. Direct image string
  if (place.image && typeof place.image === 'string') {
    url = place.image;
  }

  // 2. imageUrls array
  if (!url && Array.isArray(place.imageUrls) && place.imageUrls.length > 0) {
    const first = place.imageUrls[0];
    if (typeof first === 'string') url = first;
  }

  // 3. images array (string or { url } object)
  if (!url && Array.isArray(place.images) && place.images.length > 0) {
    const first = place.images[0];
    if (typeof first === 'string') url = first;
    else if (first && typeof first === 'object' && typeof first.url === 'string') {
      url = first.url;
    }
  }

  // Resolve relative proxy URLs to absolute for React Native
  return resolveImageUrl(url);
}

/**
 * Sort places by rating descending, breaking ties by name alphabetically.
 */
function sortByRating(places: LuxuryPlace[]): LuxuryPlace[] {
  return [...places].sort((a, b) => {
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Filter places to only those with a valid name and numeric rating.
 */
function filterValidPlaces(places: any[]): LuxuryPlace[] {
  return places.filter(
    (p) =>
      p &&
      typeof p.name === 'string' &&
      p.name.trim().length > 0 &&
      typeof p.rating === 'number' &&
      !Number.isNaN(p.rating)
  );
}

// ---------------------------------------------------------------------------
// Core circuit builder
// ---------------------------------------------------------------------------

/**
 * Group places into dynamic circuits using predefined rules.
 * Each place is assigned to the first matching circuit.
 * Unmatched places go into "Other Attractions".
 * Circuits with fewer than 2 places are removed.
 * Places within each circuit are sorted by rating descending.
 */
export function createDynamicCircuits(
  places: LuxuryPlace[]
): Record<string, LuxuryPlace[]> {
  const circuits: Record<string, LuxuryPlace[]> = {};
  const otherLabel = '\u2728 Other Attractions'; // ✨

  for (const place of places) {
    let matched = false;

    for (const rule of DYNAMIC_CIRCUIT_RULES) {
      if (rule.test(place)) {
        if (!circuits[rule.label]) {
          circuits[rule.label] = [];
        }
        circuits[rule.label].push(place);
        matched = true;
        break; // first match wins
      }
    }

    if (!matched) {
      if (!circuits[otherLabel]) {
        circuits[otherLabel] = [];
      }
      circuits[otherLabel].push(place);
    }
  }

  // Remove circuits with fewer than 2 places and sort within each
  const result: Record<string, LuxuryPlace[]> = {};
  for (const [label, circuitPlaces] of Object.entries(circuits)) {
    if (circuitPlaces.length >= 2) {
      result[label] = sortByRating(circuitPlaces);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hero section builder
// ---------------------------------------------------------------------------

/**
 * Build the hero section for the luxury layout.
 */
export function buildHeroSection(
  locationName: string,
  places: LuxuryPlace[],
  circuitCount: number
): LuxuryHero {
  const totalSites = places.length;

  const hiddenGems = places.filter(
    (p) => p.organizationData?.isHiddenGem === true
  );
  const hiddenGemsCount = hiddenGems.length;

  const avgRating =
    totalSites > 0
      ? Math.round(
          (places.reduce((sum, p) => sum + (p.rating || 0), 0) /
            totalSites) *
            10
        ) / 10
      : 0;

  // Generate tagline based on whether there are hidden gems
  let tagline: string;
  if (hiddenGemsCount > 0) {
    tagline = `Discover ${hiddenGemsCount} hidden gems among ${totalSites} amazing places`;
  } else {
    tagline = `${totalSites}+ must-visit attractions and experiences`;
  }

  // Try to extract state and country from the first place with location data
  let state = '';
  let country = '';
  let locationType = 'destination';

  for (const place of places) {
    if (place.locationData) {
      if (place.locationData.city) {
        locationType = 'city';
      }
      if (!state && place.locationData.administrativeArea) {
        state = place.locationData.administrativeArea;
      }
      if (!country && place.locationData.country) {
        country = place.locationData.country;
      }
      if (state && country) break;
    }
  }

  return {
    collectionTitle: `Discover ${locationName}`,
    tagline,
    stats: {
      totalSites,
      circuits: circuitCount,
      hiddenGems: hiddenGemsCount,
      avgRating,
    },
    locationInfo: {
      name: locationName,
      type: locationType,
      state,
      country,
    },
  };
}

// ---------------------------------------------------------------------------
// Experience tags extractor
// ---------------------------------------------------------------------------

/**
 * Extract unique experience tags from all places, with counts and emojis.
 * Returns the top 8 tags sorted by count descending.
 */
export function getUniqueTags(
  places: LuxuryPlace[]
): { tag: string; count: number; emoji: string }[] {
  const tagCounts = new Map<string, number>();

  for (const place of places) {
    const tags = place.organizationData?.experienceTags;
    if (!Array.isArray(tags)) continue;

    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) continue;
      const normalised = tag.trim().toLowerCase();
      tagCounts.set(normalised, (tagCounts.get(normalised) || 0) + 1);
    }
  }

  const results: { tag: string; count: number; emoji: string }[] = [];

  for (const [tag, count] of tagCounts.entries()) {
    const emoji = TAG_EMOJIS[tag] || TAG_EMOJIS.default;
    results.push({ tag, count, emoji });
  }

  // Sort by count descending, then alphabetically for ties
  results.sort((a, b) => {
    const diff = b.count - a.count;
    if (diff !== 0) return diff;
    return a.tag.localeCompare(b.tag);
  });

  return results.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Main transformer
// ---------------------------------------------------------------------------

/**
 * Transform a flat API response of places into a structured luxury layout.
 *
 * The API response is expected to have:
 *   - success: true
 *   - data: LuxuryPlace[]  (array of place objects)
 *   - locationName (optional): name of the location/destination
 *
 * Returns a fully structured LuxuryData object or null if the response
 * is invalid.
 */
export function transformToLuxuryLayout(
  apiResponse: ApiResponse,
  overrideLocationName?: string
): LuxuryData | null {
  // Validate response
  if (!apiResponse || apiResponse.success === false) {
    return null;
  }

  const rawPlaces = apiResponse.data;
  if (!Array.isArray(rawPlaces) || rawPlaces.length === 0) {
    return null;
  }

  // Filter to valid places (must have name + rating)
  const allPlaces = filterValidPlaces(rawPlaces);
  if (allPlaces.length === 0) {
    return null;
  }

  // Location name - prefer override (search query), then API response, then infer
  const locationName =
    overrideLocationName ||
    apiResponse.locationName ||
    allPlaces[0].locationData?.city ||
    allPlaces[0].city ||
    'This Destination';

  // ---- Crown Jewels ----
  const topAttractions = sortByRating(
    allPlaces.filter((p) => p.organizationData?.isTopAttraction === true)
  );
  const crownJewels =
    topAttractions.length > 0
      ? topAttractions
      : sortByRating(allPlaces).slice(0, 5);

  // ---- Hidden Gems ----
  const hiddenGems = sortByRating(
    allPlaces.filter((p) => p.organizationData?.isHiddenGem === true)
  );

  // ---- Administrative Circuits ----
  const adminGrouped = new Map<string, LuxuryPlace[]>();
  for (const place of allPlaces) {
    const area = place.locationData?.administrativeArea;
    if (area && typeof area === 'string' && area.trim().length > 0) {
      const key = area.trim();
      if (!adminGrouped.has(key)) {
        adminGrouped.set(key, []);
      }
      adminGrouped.get(key)!.push(place);
    }
  }

  const administrativeCircuits: Record<string, LuxuryPlace[]> = {};
  for (const [area, areaPlaces] of adminGrouped.entries()) {
    if (areaPlaces.length >= 2) {
      administrativeCircuits[area] = sortByRating(areaPlaces);
    }
  }

  // ---- Dynamic Circuits ----
  const dynamicCircuits = createDynamicCircuits(allPlaces);

  // ---- Circuit counts ----
  const adminCircuitCount = Object.keys(administrativeCircuits).length;
  const dynamicCircuitCount = Object.keys(dynamicCircuits).length;
  const totalCircuitCount = adminCircuitCount + dynamicCircuitCount;

  // ---- Experience Tags ----
  const experienceTags = getUniqueTags(allPlaces);

  // ---- Hero Section ----
  const hero = buildHeroSection(locationName, allPlaces, totalCircuitCount);

  // Override hero locationInfo with API-level data if available
  if (apiResponse.state) {
    hero.locationInfo.state = apiResponse.state;
  }
  if (apiResponse.country) {
    hero.locationInfo.country = apiResponse.country;
  }
  if (apiResponse.locationType) {
    hero.locationInfo.type = apiResponse.locationType;
  }

  return {
    hero,
    crownJewels,
    administrativeCircuits,
    dynamicCircuits,
    hiddenGems,
    allPlaces: sortByRating(allPlaces),
    experienceTags,
    metadata: {
      totalPlaces: allPlaces.length,
      circuitCounts: {
        administrative: adminCircuitCount,
        dynamic: dynamicCircuitCount,
        total: totalCircuitCount,
      },
    },
  };
}
