// "Destination editions" — the magazine-style country landing pages that mirror
// the /india-experiences treatment for the other rail countries. Ported from
// the web utils/destinationEditions.js so both apps carry the same copy.
//
// Text and accent hex only — cover photos and city tiles come from LIVE
// inventory (/activities/global?country=) at render time, so no hard-coded
// image can 404. `country` must match the API's location.country value
// (case-insensitive).
import { countryImageForText, sizedImage } from './countryAssets';

export interface EditionAccent {
  from: string;
  to: string;
  solid: string;
}

export interface DestinationEdition {
  slug: string;
  country: string;
  displayName: string;
  emoji: string;
  /** Set when the edition keeps a bespoke page (India). */
  href?: string;
  accent: EditionAccent;
  masthead: string;
  tagline: string;
  editorTitle: string;
  editorLead: string;
  editorBody: string;
  highlights: string[];
  /** Cover for a country whose live feed has no photos yet. */
  fallbackHero?: string;
}

export const DESTINATION_EDITIONS: DestinationEdition[] = [
  {
    slug: 'india',
    country: 'India',
    displayName: 'India',
    emoji: '🇮🇳',
    // India keeps its bespoke page rather than the generic template.
    href: '/india-experiences',
    accent: { from: '#F97316', to: '#E11D48', solid: '#F97316' },
    masthead: 'India edition · Vol 01',
    tagline: 'Lakes you can sleep on, tigers in their last forest.',
    editorTitle: 'The India that doesn’t make it to the brochures.',
    editorLead: 'India, scouted in person',
    editorBody:
      '— hand-picked destinations, paired with local guides who know which path is in season and which palace serves the better thali.',
    highlights: [
      'lakes you can sleep on',
      'tigers in their last forest',
      'passes only locals know',
      'palaces older than countries',
    ],
    // India is Viator-sourced (absent from the Headout by-country feed), so it
    // needs a known-good fallback cover — reuse a production Unsplash id.
    fallbackHero:
      'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=85&auto=format&fit=crop',
  },
  {
    slug: 'japan',
    country: 'Japan',
    displayName: 'Japan',
    emoji: '🇯🇵',
    accent: { from: '#F43F5E', to: '#DC2626', solid: '#E11D48' },
    masthead: 'Japan edition · Vol 02',
    tagline: 'Temple mornings, midnight ramen.',
    editorTitle: 'The Japan between the neon and the shrine bell.',
    editorLead: 'Japan, at its own pace',
    editorBody:
      '— temple mornings and midnight ramen, bullet trains and slow tea, guided by locals who know which alley, which season, which last train home.',
    highlights: [
      'temples older than empires',
      'bullet trains at 300km/h',
      'cherry blossom in season',
      'alleys only locals know',
    ],
  },
  {
    slug: 'uae',
    country: 'United Arab Emirates',
    displayName: 'UAE',
    emoji: '🇦🇪',
    accent: { from: '#F59E0B', to: '#B45309', solid: '#D97706' },
    masthead: 'UAE edition · Vol 03',
    tagline: 'Skylines by day, dunes by dusk.',
    editorTitle: 'Where the desert ends in a skyline.',
    editorLead: 'The Emirates, dusk to dune',
    editorBody:
      '— glass towers and gold souks, then a dune-drive into the quiet, paired with guides who know the city and the sand equally well.',
    highlights: [
      'the world’s tallest tower',
      'dune drives at golden hour',
      'gold & spice souks',
      'desert nights under stars',
    ],
  },
  {
    slug: 'france',
    country: 'France',
    displayName: 'France',
    emoji: '🇫🇷',
    accent: { from: '#2563EB', to: '#4F46E5', solid: '#4F46E5' },
    masthead: 'France edition · Vol 04',
    tagline: 'Left-Bank mornings, Riviera light.',
    editorTitle: 'France, one long golden afternoon.',
    editorLead: 'France, table for two',
    editorBody:
      '— Left-Bank mornings and Riviera light, châteaux older than most countries, with guides who know the vineyard and the view worth the detour.',
    highlights: [
      'the Louvre’s quiet corners',
      'Riviera light at dusk',
      'châteaux & vineyards',
      'cafés worth the detour',
    ],
  },
  {
    slug: 'italy',
    country: 'Italy',
    displayName: 'Italy',
    emoji: '🇮🇹',
    accent: { from: '#D97706', to: '#B91C1C', solid: '#C2410C' },
    masthead: 'Italy edition · Vol 05',
    tagline: 'Roman stones, Amalfi light.',
    editorTitle: 'Italy, where the ruins still keep time.',
    editorLead: 'Italy, slowly',
    editorBody:
      '— Roman stones and Amalfi switchbacks, dinners that last for hours, guided by locals who know the trattoria without a sign out front.',
    highlights: [
      'the Colosseum at dawn',
      'Amalfi’s cliff roads',
      'canals & gondolas',
      'dinners that last hours',
    ],
  },
  {
    slug: 'thailand',
    country: 'Thailand',
    displayName: 'Thailand',
    emoji: '🇹🇭',
    accent: { from: '#0D9488', to: '#059669', solid: '#0D9488' },
    masthead: 'Thailand edition · Vol 06',
    tagline: 'Gold temples, turquoise water.',
    editorTitle: 'Thailand, gold temples and turquoise water.',
    editorLead: 'Thailand, warm all year',
    editorBody:
      '— street-food dawns and island-hop afternoons, temples that glow at dusk, with guides who know the reef and the night market alike.',
    highlights: [
      'temples that glow at dusk',
      'island-hop by longtail',
      'street food after dark',
      'reefs full of colour',
    ],
  },
  {
    slug: 'usa',
    country: 'United States',
    displayName: 'USA',
    emoji: '🇺🇸',
    accent: { from: '#1D4ED8', to: '#DC2626', solid: '#1D4ED8' },
    masthead: 'USA edition · Vol 07',
    tagline: 'Canyon dawns, neon midnights.',
    editorTitle: 'The America between the coasts and the canyons.',
    editorLead: 'The States, coast to coast',
    editorBody:
      '— skyline mornings and desert road trips, national parks older than the cities, guided by locals who know the diner off the highway and the trail without a queue.',
    highlights: [
      'skylines that never sleep',
      'canyons carved by time',
      'road trips coast to coast',
      'parks bigger than countries',
    ],
  },
  {
    slug: 'uk',
    country: 'United Kingdom',
    displayName: 'UK',
    emoji: '🇬🇧',
    accent: { from: '#7C3AED', to: '#5B21B6', solid: '#6D28D9' },
    masthead: 'UK edition · Vol 08',
    tagline: 'Rain-washed lanes, castle light.',
    editorTitle: 'Britain, where every lane keeps a story.',
    editorLead: 'Britain, rain or shine',
    editorBody:
      '— castle mornings and pub afternoons, moors and museums, guided by locals who know the shortcut past the crowd and the pint worth the walk.',
    highlights: [
      'castles older than crowns',
      'moors and misty lochs',
      'museums the world envies',
      'pubs with real stories',
    ],
  },
  {
    slug: 'spain',
    country: 'Spain',
    displayName: 'Spain',
    emoji: '🇪🇸',
    accent: { from: '#E11D48', to: '#F59E0B', solid: '#DC2626' },
    masthead: 'Spain edition · Vol 09',
    tagline: 'Tapas noons, flamenco nights.',
    editorTitle: 'The Spain that only starts at sundown.',
    editorLead: 'España, in no hurry',
    editorBody:
      '— late lunches and later dinners, Gaudí curves and Andalusian courtyards, guided by locals who know the tapas bar without a sign and the plaza worth the detour.',
    highlights: [
      'Gaudí’s impossible curves',
      'flamenco after dark',
      'tapas bars locals guard',
      'plazas alive till dawn',
    ],
  },
  {
    slug: 'singapore',
    country: 'Singapore',
    displayName: 'Singapore',
    emoji: '🇸🇬',
    accent: { from: '#DB2777', to: '#BE185D', solid: '#DB2777' },
    masthead: 'Singapore edition · Vol 10',
    tagline: 'Garden city, hawker gold.',
    editorTitle: 'Singapore, a city that grew a jungle.',
    editorLead: 'Singapore, day and night',
    editorBody:
      '— skyline gardens and hawker-stall feasts, island quiet and neon bays, guided by locals who know the best chilli crab and the quietest rooftop view.',
    highlights: [
      'gardens in the sky',
      'hawker stalls worth a queue',
      'Marina Bay after dark',
      'islands a ferry away',
    ],
  },
  {
    slug: 'portugal',
    country: 'Portugal',
    displayName: 'Portugal',
    emoji: '🇵🇹',
    accent: { from: '#16A34A', to: '#15803D', solid: '#15803D' },
    masthead: 'Portugal edition · Vol 11',
    tagline: 'Tiled lanes, Atlantic light.',
    editorTitle: 'Portugal, where the light forgives the hills.',
    editorLead: 'Portugal, slow and sunlit',
    editorBody:
      '— tiled facades and tram mornings, cliff coasts and custard tarts, guided by locals who know the miradouro at golden hour and the tasca worth the climb.',
    highlights: [
      'azulejo tiles everywhere',
      'trams up steep lanes',
      'cliffs over the Atlantic',
      'pastéis fresh from the oven',
    ],
  },
  {
    slug: 'netherlands',
    country: 'Netherlands',
    displayName: 'Netherlands',
    emoji: '🇳🇱',
    accent: { from: '#FB923C', to: '#C2410C', solid: '#EA580C' },
    masthead: 'Netherlands edition · Vol 12',
    tagline: 'Canal mornings, bicycle bells.',
    editorTitle: 'The Netherlands, painted flat and golden.',
    editorLead: 'Holland, by canal and bike',
    editorBody:
      '— canal-ring mornings and museum afternoons, tulip fields and windmills, guided by locals who know which bridge to cross and which café keeps the light.',
    highlights: [
      'canal rings by bike',
      'masters on museum walls',
      'tulip fields in bloom',
      'windmills at the water’s edge',
    ],
  },
  {
    slug: 'austria',
    country: 'Austria',
    displayName: 'Austria',
    emoji: '🇦🇹',
    accent: { from: '#BE123C', to: '#881337', solid: '#9F1239' },
    masthead: 'Austria edition · Vol 13',
    tagline: 'Alpine air, imperial gold.',
    editorTitle: 'Austria, where the mountains keep the music.',
    editorLead: 'Österreich, grand and green',
    editorBody:
      '— palace mornings and alpine afternoons, coffee-house hours and concert nights, guided by locals who know the trail with the view and the café worth lingering in.',
    highlights: [
      'palaces of the Habsburgs',
      'alps you can hear',
      'coffee houses of Vienna',
      'lakes clearer than glass',
    ],
  },
  {
    slug: 'turkey',
    country: 'Turkey',
    displayName: 'Turkey',
    emoji: '🇹🇷',
    accent: { from: '#06B6D4', to: '#0E7490', solid: '#0891B2' },
    masthead: 'Turkey edition · Vol 14',
    tagline: 'Bazaar mornings, Bosphorus dusk.',
    editorTitle: 'Turkey, where two continents share a coffee.',
    editorLead: 'Türkiye, east meets west',
    editorBody:
      '— bazaar mornings and Bosphorus ferries, cave hotels and balloon dawns, guided by locals who know the spice worth carrying home and the terrace over the strait.',
    highlights: [
      'balloons over Cappadocia',
      'bazaars that never end',
      'the Bosphorus by ferry',
      'domes older than empires',
    ],
  },
  {
    slug: 'greece',
    country: 'Greece',
    displayName: 'Greece',
    emoji: '🇬🇷',
    accent: { from: '#0284C7', to: '#38BDF8', solid: '#0284C7' },
    masthead: 'Greece edition · Vol 15',
    tagline: 'Marble ruins, Aegean blue.',
    editorTitle: 'Greece, where the myths still sunbathe.',
    editorLead: 'Greece, island time',
    editorBody:
      '— ancient mornings and island afternoons, whitewashed lanes and caldera sunsets, guided by locals who know the taverna by the water and the ruin without the queue.',
    highlights: [
      'temples of the gods',
      'whitewashed island lanes',
      'sunsets over the caldera',
      'tavernas by the sea',
    ],
  },
  {
    slug: 'indonesia',
    country: 'Indonesia',
    displayName: 'Indonesia',
    emoji: '🇮🇩',
    accent: { from: '#059669', to: '#CA8A04', solid: '#059669' },
    masthead: 'Indonesia edition · Vol 16',
    tagline: 'Rice terraces, temple smoke.',
    editorTitle: 'Indonesia, a thousand islands of green.',
    editorLead: 'Indonesia, island to island',
    editorBody:
      '— temple mornings and rice-terrace afternoons, surf coasts and volcano dawns, guided by locals who know the warung worth stopping for and the beach the crowds miss.',
    highlights: [
      'rice terraces in tiers',
      'temples wreathed in smoke',
      'surf on empty coasts',
      'volcanoes at first light',
    ],
  },
];

const norm = (s?: string | null) => String(s || '').trim().toLowerCase();

const BY_SLUG: Record<string, DestinationEdition> = Object.fromEntries(
  DESTINATION_EDITIONS.map((e) => [e.slug, e]),
);
const BY_COUNTRY: Record<string, DestinationEdition> = Object.fromEntries(
  DESTINATION_EDITIONS.map((e) => [norm(e.country), e]),
);

/** Where an edition card links: India keeps its own page, the rest the template. */
export function editionHref(edition?: DestinationEdition | null): string {
  return edition?.href || `/experiences-in/${edition?.slug}`;
}

export function getEditionBySlug(slug?: string | null): DestinationEdition | null {
  return BY_SLUG[norm(slug)] || null;
}

export function getEditionByCountry(country?: string | null): DestinationEdition | null {
  return BY_COUNTRY[norm(country)] || null;
}

/** The edition's own photo, for a poster or a cover the feed has none for yet. */
export function editionImage(e: DestinationEdition, width = 1000): string | null {
  if (e.fallbackHero) return sizedImage(e.fallbackHero, width);
  return countryImageForText(`${e.displayName} ${e.country}`, width);
}
