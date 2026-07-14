// Explore World helpers — the Viator + Headout experience catalogue.
//
// Shapes here come from the live API (GET /activities/global/by-city), not from
// guesswork. Two things that endpoint does NOT give us, and which we therefore
// must not render:
//
//   * `isFeatured` is 0 on every item, so there is no "Bestseller" to badge.
//     The PWA shows one; inventing it on mobile would be a claim the data does
//     not support.
//   * `alsoOn` / `providerCount` are absent, so the "sold on N platforms" badge
//     never applies either.
//
// What IS real: title, pricing.basePrice (INR), rating.{average,count},
// images[].url, duration.label, location.city and `source` (viator | headout).

export type ExperienceSource = 'viator' | 'headout' | string;

export interface Experience {
  _id: string;
  title: string;
  source?: ExperienceSource;
  shortDescription?: string;

  images?: Array<{ url: string; isPrimary?: boolean } | string>;
  pricing?: { basePrice?: number; currency?: string; priceType?: string };
  rating?: { average?: number; count?: number };
  duration?: { label?: string; value?: number; unit?: string };
  location?: { city?: string; country?: string | null };
  instantBooking?: { enabled?: boolean };
  category?: string[];
  primaryCategory?: string;
  externalData?: { productUrl?: string };
}

/** One city's slice of the catalogue, as the API groups it. */
export interface CityGroup {
  city: string;
  cityCode?: string;
  country?: string | null;
  heroImage?: string | null;
  total: number;
  items: Experience[];
}

/** Cities collapsed under their country, for "Top experiences by country". */
export interface CountryGroup {
  country: string;
  heroImage?: string | null;
  /** Sum of every city's catalogue total, not just the items we fetched. */
  total: number;
  cities: string[];
  items: Experience[];
}

export function imageOf(e: Experience): string | null {
  const first = e.images?.find((i) => typeof i === 'object' && (i as any).isPrimary) ?? e.images?.[0];
  if (!first) return null;
  return typeof first === 'string' ? first : (first.url ?? null);
}

export function imagesOf(e: Experience): string[] {
  return (e.images ?? [])
    .map((i) => (typeof i === 'string' ? i : i?.url))
    .filter((u): u is string => !!u);
}

export function priceOf(e: Experience): number | null {
  const p = e.pricing?.basePrice;
  return typeof p === 'number' && p > 0 ? p : null;
}

/** "₹5,428" — the API already prices in INR. */
export function formatPrice(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function ratingOf(e: Experience): { average: number; count: number } | null {
  const avg = e.rating?.average;
  const count = e.rating?.count ?? 0;
  if (typeof avg !== 'number' || avg <= 0) return null;
  return { average: avg, count };
}

/**
 * Who fulfils the booking — "Viator" / "Headout".
 *
 * Prayana's OWN listings come back with source: "internal". Labelling those
 * "Internal" would be meaningless to a customer, so they get no chip: the
 * absence of a third-party badge is what says "booked direct with us".
 */
export function providerLabel(e: Experience): string | null {
  const s = (e.source ?? '').toLowerCase();
  if (s === 'viator') return 'Viator';
  if (s === 'headout') return 'Headout';
  if (!s || s === 'internal') return null;
  return s[0].toUpperCase() + s.slice(1);
}

/** A Prayana-hosted activity rather than a third-party tour. */
export function isInternal(e: Experience): boolean {
  const s = (e.source ?? '').toLowerCase();
  return !s || s === 'internal';
}

/** Confirmed on booking, no waiting on the host. */
export function isInstant(e: Experience): boolean {
  return !!e.instantBooking?.enabled;
}

/**
 * Collapse the API's city groups under their country.
 *
 * Some cities come back with `country: null` (Cusco and Cape Town, today). They
 * are kept as their own single-city group under the city's own name rather than
 * being bucketed into a fake "Unknown" country — a heading the customer would
 * rightly find baffling.
 */
export function groupByCountry(cities: CityGroup[]): CountryGroup[] {
  const map = new Map<string, CountryGroup>();

  for (const c of cities) {
    const key = c.country?.trim() || c.city;
    const existing = map.get(key);
    if (existing) {
      existing.total += c.total ?? 0;
      existing.cities.push(c.city);
      existing.items.push(...(c.items ?? []));
      if (!existing.heroImage) existing.heroImage = c.heroImage ?? null;
    } else {
      map.set(key, {
        country: key,
        heroImage: c.heroImage ?? null,
        total: c.total ?? 0,
        cities: [c.city],
        items: [...(c.items ?? [])],
      });
    }
  }

  // Biggest catalogues first — that is the order the PWA leads with.
  return [...map.values()].sort((a, b) => b.total - a.total);
}
