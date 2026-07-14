// Browse-by-region data for the eSIM landing page.
//
// Lifted from the web's app/esim/page.jsx (browseRegions) so the two apps offer
// the same regions, the same highlight countries and the same sample codes used
// to price each row. Emoji and lucide icon refs are dropped: emoji render as
// "?" boxes on iOS and the design system forbids bundling a font to fix it.

export interface EsimRegion {
  name: string;
  filterKey: string;
  /**
   * NOT a plan count, despite the web's name for it — it counts COUNTRIES (42,
   * beside totalCountries: 43, for Europe). Never render it as "N plans": the
   * real figure is fetched from the catalogue (Europe sells 292).
   */
  plansCount: number;
  totalCountries: number;
  accent: string;
  image: string;
  highlights: string[];
  /** Countries sampled to derive the row's live "from" price. */
  sampleCodes: string[];
}

export const ESIM_REGIONS: EsimRegion[] = [
  {
    name: "Europe",
    filterKey: "Europe",
    plansCount: 42,
    totalCountries: 43,
    accent: "#3B82F6",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
    highlights: ["France", "Italy", "Spain", "Germany", "Greece"],
    // Countries (codes) sampled for live "from" pricing
    sampleCodes: ["FR", "IT", "ES", "DE", "GR", "GB", "AT", "PT", "NL", "CH"],
  },
  {
    name: "Asia Pacific",
    filterKey: "Asia",
    plansCount: 28,
    totalCountries: 28,
    accent: "#E61417",
    image: "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1200&q=80",
    highlights: ["Japan", "Thailand", "Singapore", "Korea"],
    sampleCodes: ["JP", "TH", "SG", "KR", "MY", "VN", "ID", "AU", "AE"],
  },
  {
    name: "Americas",
    filterKey: "Americas",
    plansCount: 31,
    totalCountries: 31,
    accent: "#F59E0B",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80",
    highlights: ["USA", "Canada", "Mexico", "Brazil"],
    sampleCodes: ["US", "CA", "MX", "BR"],
  },
];
