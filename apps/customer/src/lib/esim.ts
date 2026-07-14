// eSIM shared helpers — the mobile counterpart of the web's utils/esimCurrency.js
// plus the bundle-shape derivations that EsimPlanCard does inline on the web.
//
// Everything here is derived from REAL provider fields returned by
// GET /esim/catalogue. Nothing is invented: if the API doesn't send it, we don't
// render it. (The screen this replaced shipped 13 hardcoded plans with made-up
// USD prices — see git history.)

/** The real bundle shape returned by GET /esim/catalogue → data.bundles[]. */
export interface EsimBundle {
  name: string;
  description?: string;
  country?: string;
  countryName?: string;
  region?: string;
  coverages?: string[];
  coverageCount?: number;
  isRegional?: boolean;

  dataAmountMB?: number;
  dataAmountGB?: number;
  durationDays?: number;
  isUnlimited?: boolean;
  speed?: string | string[] | null;

  smsCapacity?: number;
  localCallingCapacity?: number;
  voiceMinutes?: number;
  isUnlimitedCalls?: boolean;
  isDataOnly?: boolean;
  isRechargeable?: boolean;
  supportsRecharge?: boolean;

  provider?: string;
  providerBundleId?: string;

  // Pricing — INR, straight from the server. `sellingPrice` is what the user pays.
  sellingPrice?: number;
  sellingCurrency?: string;
  originalPrice?: number;
  discountPercent?: number;
  discountLabel?: string;

  requiresKYC?: boolean;
}

export type ExchangeRates = Record<string, number> | null | undefined;

/** A country the catalogue actually sells plans for: GET /esim/catalogue -> data.countries[]. */
export interface EsimCountry {
  name: string;
  iso: string;
  region?: string | null;
}

/**
 * The destinations we surface first, in this order. These are ISO codes only —
 * the display name always comes from the API's own country list, so we never
 * invent a country the catalogue can't actually sell.
 */
export const FEATURED_ISO = [
  'FR', 'ES', 'IT', 'TH', 'JP', 'GB', 'AE', 'SG',
  'US', 'MY', 'ID', 'VN', 'AU', 'CH', 'TR', 'KR',
];

/** Featured countries first (in FEATURED_ISO order), then everything else A-Z. */
export function orderCountries(countries: EsimCountry[]): EsimCountry[] {
  const rank = new Map(FEATURED_ISO.map((iso, i) => [iso, i]));
  const featured = countries
    .filter((c) => rank.has(c.iso))
    .sort((a, b) => (rank.get(a.iso) ?? 0) - (rank.get(b.iso) ?? 0));
  const rest = countries
    .filter((c) => !rank.has(c.iso))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...featured, ...rest];
}

// ---------------------------------------------------------------------------
// Currency — ports utils/esimCurrency.js
// ---------------------------------------------------------------------------

const NO_DECIMAL = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF'];
const ROUND = ['INR', 'PKR', 'BDT', 'LKR', 'NPR', 'PHP', 'THB', 'MXN', 'RUB'];

function group(n: number, fractionDigits = 0) {
  // toLocaleString with a locale is unreliable on Hermes; group manually.
  const fixed = n.toFixed(fractionDigits);
  const [whole, frac] = fixed.split('.');
  const withSeps = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${withSeps}.${frac}` : withSeps;
}

/** Port of formatEsimPrice(): a USD amount → the user's currency. */
export function formatEsimPrice(
  priceUSD: number | undefined,
  rates: ExchangeRates,
  currencyCode = 'INR',
  currencySymbol = '₹',
): string {
  if (!priceUSD) return `${currencySymbol}0`;

  const rate = rates?.[currencyCode] ?? rates?.INR ?? 85;
  const converted = priceUSD * rate;

  if (NO_DECIMAL.includes(currencyCode)) return `${currencySymbol}${group(Math.round(converted))}`;
  if (ROUND.includes(currencyCode) || converted >= 100) {
    return `${currencySymbol}${group(Math.round(converted))}`;
  }
  return `${currencySymbol}${converted.toFixed(2)}`;
}

/**
 * Port of formatInrPrice(): the server already prices Matrix bundles in INR, so
 * go INR -> USD -> target rather than treating the INR figure as USD.
 */
export function formatInrPrice(
  priceINR: number | undefined,
  rates: ExchangeRates,
  currencyCode = 'INR',
  currencySymbol = '₹',
): string {
  if (!priceINR) return `${currencySymbol}0`;
  const inrToUsd = rates?.INR ?? 85;
  return formatEsimPrice(priceINR / inrToUsd, rates, currencyCode, currencySymbol);
}

// ---------------------------------------------------------------------------
// Bundle derivations — ported from EsimPlanCard.jsx so the card renders only
// what the provider actually reports.
// ---------------------------------------------------------------------------

export function formatData(mb?: number): string {
  if (!mb || mb === 0) return 'Unlimited';
  if (mb >= 1000) return `${(mb / 1000).toFixed(mb % 1000 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
}

export function dataLabelFor(b: EsimBundle): string {
  return b.isUnlimited ? 'Unlimited' : formatData(b.dataAmountMB);
}

export function speedLabelFor(b: EsimBundle): string {
  const raw = Array.isArray(b.speed) ? b.speed.filter(Boolean)[0] : b.speed;
  if (raw && (raw.includes('5G') || raw.includes('LTE') || raw.includes('4G'))) return raw;
  return '4G/5G';
}

export interface Capability {
  label: string;
  voice: boolean;
}

/** Exactly the web's logic: voice/SMS are inferred only from real provider counts. */
export function capabilityFor(b: EsimBundle): Capability {
  const callMinutes =
    (b.voiceMinutes ?? 0) > 0
      ? (b.voiceMinutes as number)
      : (b.localCallingCapacity ?? 0) > 0
        ? (b.localCallingCapacity as number)
        : 0;
  const unlimitedCalls = !!b.isUnlimitedCalls || b.voiceMinutes === -1;
  const hasCalls = unlimitedCalls || callMinutes > 0;
  const hasSms = (b.smsCapacity ?? 0) > 0;

  if (unlimitedCalls) return { label: hasSms ? 'Unlimited calls + SMS' : 'Unlimited calls', voice: true };
  if (hasCalls) return { label: hasSms ? 'Calls + SMS' : 'Calls included', voice: true };
  if (hasSms) return { label: 'Data + SMS', voice: true };
  return { label: 'Data only', voice: false };
}

export function coverageCountFor(b: EsimBundle): number | null {
  return b.coverageCount ?? (Array.isArray(b.coverages) ? b.coverages.length : null) ?? null;
}

export function isRegionalBundle(b: EsimBundle): boolean {
  const n = coverageCountFor(b);
  return Boolean(b.isRegional) || Boolean(n && n > 1);
}

/**
 * A single-country plan, per the web's isSingleCountryPlan().
 *
 * These are two genuinely different products and must not be shown in one list:
 *
 *  - COUNTRY plan  — local network in that one country, activates on landing.
 *  - REGIONAL/GLOBAL — bundled across 30-60+ countries, but the customer gets a
 *    FOREIGN number (calls outbound only) and usually pays more for the same data.
 *
 * Mixing them and sorting by price actively misleads: Japan's cheapest bundle is
 * a ₹546 60-country Global plan, which outranks the ₹834 local Japan plan — so a
 * customer flying only to Japan gets steered to the wrong product.
 */
export function isSingleCountryPlan(b: EsimBundle): boolean {
  return !b.isRegional && (coverageCountFor(b) ?? 1) <= 1;
}

export type CoverageScope = 'country' | 'global';

export interface ScopedPlans {
  country: EsimBundle[];
  global: EsimBundle[];
}

export function splitByScope(bundles: EsimBundle[]): ScopedPlans {
  return {
    country: bundles.filter(isSingleCountryPlan),
    global: bundles.filter((b) => !isSingleCountryPlan(b)),
  };
}

export function bundleKey(b: EsimBundle): string {
  return `${b.provider ?? 'x'}:${b.providerBundleId ?? b.name}`;
}

/**
 * What this plan covers, in words.
 *
 * Do NOT show `countryName` for a regional plan. The backend leaves it as the
 * first country of the coverage list, so a 60-country global plan bought from
 * the Japan page reports "Albania" — technically covered, but it reads like the
 * customer bought the wrong thing.
 */
export function coverageLabel(b: EsimBundle): string {
  const n = coverageCountFor(b);
  if (isRegionalBundle(b)) return n && n > 1 ? `${n} countries` : b.region || 'Regional';
  return b.countryName || b.country || 'Global';
}

/**
 * Web's popularity heuristic (country page): needs >= 2 plans; score favours a
 * discount and the sweet-spot data sizes. Returns the set of popular plan names.
 */
export function popularPlanNames(bundles: EsimBundle[]): Set<string> {
  if (bundles.length < 2) return new Set();
  const scored = bundles.map((b) => ({
    name: b.name,
    score: (b.discountPercent ?? 0) * 2 + ((b.dataAmountMB ?? 0) >= 3000 && (b.dataAmountMB ?? 0) <= 10000 ? 10 : 0),
  }));
  scored.sort((a, z) => z.score - a.score);
  return new Set(scored.slice(0, bundles.length < 4 ? 1 : 2).map((s) => s.name));
}

export type SortKey = 'value' | 'price-low' | 'price-high' | 'data' | 'duration';

export const SORT_LABELS: Record<SortKey, string> = {
  value: 'Best value',
  'price-low': 'Price: low to high',
  'price-high': 'Price: high to low',
  data: 'Most data',
  duration: 'Longest validity',
};

const priceOf = (b: EsimBundle) => b.sellingPrice ?? 0;

export function sortBundles(bundles: EsimBundle[], key: SortKey): EsimBundle[] {
  const out = [...bundles];
  switch (key) {
    case 'price-low':
      return out.sort((a, b) => priceOf(a) - priceOf(b));
    case 'price-high':
      return out.sort((a, b) => priceOf(b) - priceOf(a));
    case 'data':
      return out.sort((a, b) => (b.dataAmountMB ?? 0) - (a.dataAmountMB ?? 0));
    case 'duration':
      return out.sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0));
    case 'value':
    default:
      return out.sort(
        (a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0) || priceOf(a) - priceOf(b),
      );
  }
}

// ---------------------------------------------------------------------------
// Flags
//
// The screen previously used emoji flags. Emoji render as "?" boxes on the iOS
// Simulator, and PRAYANA_DESIGN_SYSTEM.pdf forbids bundling a webfont (including
// an emoji font) to fix that. Real flag images sidestep both problems.
// ---------------------------------------------------------------------------

export function flagUrl(countryCode?: string, width: 40 | 80 | 160 | 320 = 160): string | null {
  if (!countryCode || countryCode.length !== 2) return null;
  return `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`;
}
