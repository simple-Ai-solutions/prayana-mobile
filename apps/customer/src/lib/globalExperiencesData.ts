// Hardcoded data for the Explore World (/global-experiences) page — ported
// verbatim from the web app/global-experiences/page.js so the mobile page
// carries the same copy, destinations and filters.
//
// The web page's accent system is orange → rose → fuchsia (its own surface,
// distinct from the teal Things-to-Do marketplace). We keep those accents here.

// Rotating search-pill hints (web SEARCH_HINTS).
export const SEARCH_HINTS = [
  'Search Tokyo experiences',
  'Eiffel Tower skip-the-line',
  'Burj Khalifa tickets',
  'Search Bali experiences',
  'Colosseum guided tour',
  'Goa beach activities',
];

// Search-focus "Popular attractions" chips (web POPULAR_ATTRACTIONS).
export const POPULAR_ATTRACTIONS = [
  'Eiffel Tower',
  'Burj Khalifa',
  'Colosseum',
  'Statue of Liberty',
  'London Eye',
  'Sagrada Família',
  'Louvre Museum',
  'Tower of London',
  'Universal Studios Singapore',
  'Disneyland Paris',
  'Tokyo Skytree',
  'Empire State Building',
];

// India magazine-cover carousel (web INDIA_DESTINATIONS).
export interface IndiaDestination {
  name: string;
  theme: string;
  blurb: string;
  image: string;
}
export const INDIA_DESTINATIONS: IndiaDestination[] = [
  {
    name: 'Ladakh',
    theme: 'High-altitude desert',
    blurb: 'Monasteries above the clouds and passes only locals know.',
    image: 'https://images.unsplash.com/photo-1617859047452-8510bcf207fd?w=900&q=80',
  },
  {
    name: 'Kerala',
    theme: 'Backwaters & green',
    blurb: 'Sleep on a lake, wake to mist over the palms.',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=900&q=80',
  },
  {
    name: 'Udaipur',
    theme: 'City of lakes',
    blurb: 'Palaces older than most countries, mirrored in still water.',
    image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&q=80',
  },
  {
    name: 'Andaman',
    theme: 'Coral & castaway sand',
    blurb: 'Reefs, shipwrecks and beaches that never make the brochure.',
    image: 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=900&q=80',
  },
  {
    name: 'Hampi',
    theme: 'Boulders & ruins',
    blurb: 'An empire in stone, scattered across a surreal landscape.',
    image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=900&q=80',
  },
  {
    name: 'Pondicherry',
    theme: 'French quarter',
    blurb: 'Mustard walls, sea breeze and slow mornings.',
    image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=900&q=80',
  },
];

// "Editor's letter" numbered highlights (web INDIA_HERO_HIGHLIGHTS).
export const INDIA_HERO_HIGHLIGHTS = [
  'lakes you can sleep on',
  'tigers in their last forest',
  'passes only locals know',
  'palaces older than countries',
];

// Filtered-view top-level type tabs (web TypeTabs / CATEGORY_VALUES_BY_GROUP).
// value maps to the API `category` group filter; '' = All.
export interface TypeTab {
  key: string;
  label: string;
  categories: string[]; // category values that belong to this tab (empty = all)
}
export const TYPE_TABS: TypeTab[] = [
  { key: 'all', label: 'All', categories: [] },
  {
    key: 'tours',
    label: 'Tours & experiences',
    categories: ['City Tours', 'Adventure', 'Food & Dining', 'Cultural', 'Nightlife', 'Water Sports'],
  },
  {
    key: 'tickets',
    label: 'Attraction tickets',
    categories: ['Historical', 'Theme Parks', 'Cultural', 'Wildlife'],
  },
];

// Filtered-view category filters (web CATEGORY_FILTERS in the sidebar/drawer).
export interface CategoryFilter {
  value: string; // '' = All
  label: string;
  icon: string; // Ionicon
}
export const CATEGORY_FILTERS: CategoryFilter[] = [
  { value: '', label: 'All categories', icon: 'apps-outline' },
  { value: 'City Tours', label: 'Tours', icon: 'compass-outline' },
  { value: 'Cultural', label: 'Museums & Culture', icon: 'business-outline' },
  { value: 'Adventure', label: 'Adventure', icon: 'trail-sign-outline' },
  { value: 'Food & Dining', label: 'Food', icon: 'restaurant-outline' },
  { value: 'Water Sports', label: 'Cruises & Water', icon: 'boat-outline' },
  { value: 'Wellness', label: 'Wellness', icon: 'heart-outline' },
  { value: 'Nightlife', label: 'Nightlife', icon: 'moon-outline' },
];

// Filtered-view sort options (web SortSelect).
export const GLOBAL_SORTS: { value: string; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];
