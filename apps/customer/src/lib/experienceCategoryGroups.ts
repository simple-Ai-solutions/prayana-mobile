// Experience category groups + popular-search data — ported verbatim from the
// web's utils/experienceCategories.js so the mobile "Things to Do" page buckets
// activities into the same collections and offers the same browse chips.
//
// The web ExperienceCollections has no dedicated API: it pulls a wide
// searchActivities({ limit: 60, sort: 'rating' }) page, keeps internal listings,
// and buckets each into ONE group by its primary (first) category token. We do
// the same on mobile.

export interface GroupCategory {
  value: string; // server enum the API filters on
  label: string; // display label
}

export interface ExperienceGroup {
  key: string;
  title: string;
  icon: string; // Ionicon name
  accent: string; // group accent colour
  slug: string; // → /experiences/{slug}
  categories: GroupCategory[];
}

// Group accents + icons (web GROUP_ACCENT / GROUP_ICON, mapped to Ionicons).
export const EXPERIENCE_GROUPS: ExperienceGroup[] = [
  {
    key: 'tours',
    title: 'Tours & experiences',
    icon: 'compass-outline',
    accent: '#F2802E',
    slug: 'tours-experiences',
    categories: [
      { value: 'City Tours', label: 'Tours' },
      { value: 'Photography', label: 'Photo Tours' },
      { value: 'Food & Dining', label: 'Food & Dining' },
      { value: 'Nightlife', label: 'Nightlife' },
      { value: 'Shopping', label: 'Markets & Shopping' },
    ],
  },
  {
    key: 'attractions',
    title: 'Attraction tickets',
    icon: 'ticket-outline',
    accent: '#8B5CF6',
    slug: 'attraction-tickets',
    categories: [
      { value: 'Cultural', label: 'Heritage & Culture' },
      { value: 'Historical', label: 'Forts & Monuments' },
      { value: 'Wildlife', label: 'Wildlife & Safari' },
      { value: 'Theme Parks', label: 'Theme Parks' },
    ],
  },
  {
    key: 'adventure',
    title: 'Adventure & outdoors',
    icon: 'trail-sign-outline',
    accent: '#4AC0CC',
    slug: 'adventure-outdoors',
    categories: [
      { value: 'Adventure', label: 'Adventure' },
      { value: 'Water Sports', label: 'Water & Cruises' },
      { value: 'Sports & Recreation', label: 'Sports & Games' },
    ],
  },
  {
    key: 'wellness',
    title: 'Wellness & spiritual',
    icon: 'heart-outline',
    accent: '#10B981',
    slug: 'wellness-spiritual',
    categories: [
      { value: 'Wellness', label: 'Wellness & Spa' },
      { value: 'Spiritual', label: 'Temples & Retreats' },
    ],
  },
  {
    key: 'travel',
    title: 'Travel services',
    icon: 'bus-outline',
    accent: '#2563EB',
    slug: 'travel-services',
    categories: [{ value: 'Transport', label: 'Transport & Transfers' }],
  },
];

// value → group index, for fast bucketing by an activity's primary category.
export const CATEGORY_TO_GROUP: Record<string, number> = EXPERIENCE_GROUPS.reduce(
  (acc, g, i) => {
    g.categories.forEach((c) => {
      acc[c.value.toLowerCase()] = i;
    });
    return acc;
  },
  {} as Record<string, number>,
);

// "Explore more" chips — POPULAR_EXPERIENCES (label → /experiences/{slug}).
export const POPULAR_EXPERIENCES: { label: string; slug: string }[] = [
  { label: 'Adventure & outdoors', slug: 'adventure' },
  { label: 'Heritage & Culture', slug: 'heritage-culture' },
  { label: 'Water Sports & Cruises', slug: 'water-cruises' },
  { label: 'Wellness & Spa', slug: 'wellness-spa' },
  { label: 'Temples & Retreats', slug: 'temples-retreats' },
  { label: 'Food & Dining Tours', slug: 'food-dining' },
  { label: 'City Tours & Day Trips', slug: 'tours' },
  { label: 'Wildlife & Safari', slug: 'wildlife-safari' },
  { label: 'Photo Tours', slug: 'photo-tours' },
  { label: 'Forts & Monuments', slug: 'forts-monuments' },
  { label: 'Nightlife', slug: 'nightlife' },
  { label: 'Markets & Shopping', slug: 'markets-shopping' },
];

// "Trending destinations" chips — TRENDING_DESTINATIONS.
// param 'city' = exact city filter; 'q' = free-text (iconic places not stored as cities).
export const TRENDING_DESTINATIONS: { city: string; param: 'city' | 'q' }[] = [
  { city: 'Jaipur', param: 'city' },
  { city: 'Goa', param: 'city' },
  { city: 'Agra', param: 'city' },
  { city: 'Udaipur', param: 'city' },
  { city: 'Mumbai', param: 'city' },
  { city: 'Varanasi', param: 'city' },
  { city: 'Jodhpur', param: 'city' },
  { city: 'Kerala', param: 'q' },
  { city: 'Amritsar', param: 'city' },
  { city: 'Munnar', param: 'city' },
  { city: 'Pondicherry', param: 'q' },
  { city: 'Chennai', param: 'city' },
  { city: 'Hyderabad', param: 'city' },
  { city: 'Kolkata', param: 'city' },
  { city: 'Hampi', param: 'q' },
  { city: 'Rishikesh', param: 'q' },
  { city: 'Darjeeling', param: 'city' },
  { city: 'Bangalore', param: 'city' },
];

// Curated hero destination rail (web HERO_DESTINATIONS) — deep-links into
// global-experiences filtered to a country/city.
export const HERO_DESTINATIONS: { label: string; param: 'country' | 'city'; value: string; image: string }[] = [
  { label: 'India', param: 'country', value: 'India', image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=400&q=70' },
  { label: 'Dubai', param: 'city', value: 'Dubai', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=70' },
  { label: 'Thailand', param: 'country', value: 'Thailand', image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=400&q=70' },
  { label: 'Sri Lanka', param: 'country', value: 'Sri Lanka', image: 'https://images.unsplash.com/photo-1566296314736-6eaac1ca0cb9?w=400&q=70' },
  { label: 'Japan', param: 'country', value: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=70' },
  { label: 'Paris', param: 'city', value: 'Paris', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=70' },
];
