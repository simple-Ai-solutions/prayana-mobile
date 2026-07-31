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

// Single-category slug → { value (server enum), label, hero } — ported from the
// web's CATEGORY_PAGE_META. The Things-to-Do "popular experiences" chips push
// these single slugs (e.g. adventure, heritage-culture), distinct from the group
// "See all" slugs above (e.g. adventure-outdoors).
export interface CategoryMeta {
  value: string;
  label: string;
  subtitle: string;
  image: string;
}
export const CATEGORY_PAGE_META: Record<string, CategoryMeta> = {
  tours: { value: 'City Tours', label: 'Tours', subtitle: 'Guided city walks, day tours & sightseeing', image: 'https://prayanaai.com/images/place-names/shimla-mall-road/shimla-mall-road/img-1_google_places_fc10ac43.jpg' },
  'photo-tours': { value: 'Photography', label: 'Photo Tours', subtitle: 'Photo walks, landscape & wildlife shoots', image: 'https://prayanaai.com/images/place-names/couple-lake-pichola-udaipur-sunset/couple-lake-pichola-udaipur-sunset/img-1_google_places_00e1e970.jpg' },
  'food-dining': { value: 'Food & Dining', label: 'Food & Dining', subtitle: 'Food walks, cooking classes & tastings', image: 'https://prayanaai.com/images/place-names/pondicherry-french-quarter/pondicherry-french-quarter/img-1_google_places_7337f475.jpg' },
  nightlife: { value: 'Nightlife', label: 'Nightlife', subtitle: 'Pub crawls, live music & rooftop parties', image: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=1200&q=80' },
  'markets-shopping': { value: 'Shopping', label: 'Markets & Shopping', subtitle: 'Bazaar tours, handicrafts & spice markets', image: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=1200&q=80' },
  'heritage-culture': { value: 'Cultural', label: 'Heritage & Culture', subtitle: 'Heritage walks, dance, pottery & festivals', image: 'https://prayanaai.com/images/place-names/hampi-vijayanagara/hampi-vijayanagara/img-1_google_places_b3ad6f06.jpg' },
  'forts-monuments': { value: 'Historical', label: 'Forts & Monuments', subtitle: 'Forts, archaeological sites & colonial walks', image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80' },
  'wildlife-safari': { value: 'Wildlife', label: 'Wildlife & Safari', subtitle: 'Jeep & boat safaris, bird watching', image: 'https://prayanaai.com/images/place-names/munnar-tea-gardens/munnar-tea-gardens/img-1_google_places_8fdbe5b7.jpg' },
  'theme-parks': { value: 'Theme Parks', label: 'Theme Parks', subtitle: 'Theme, water & amusement parks', image: 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?w=1200&q=80' },
  trekking: { value: 'Trekking', label: 'Treks & Hikes', subtitle: 'Guided treks, hikes & summit climbs', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80' },
  adventure: { value: 'Adventure', label: 'Adventure', subtitle: 'Trekking, climbing, bungee & paragliding', image: 'https://prayanaai.com/images/place-names/pangong-lake-ladakh/pangong-lake-ladakh/img-1_google_places_ffc2c9f2.jpg' },
  'water-cruises': { value: 'Water Sports', label: 'Water & Cruises', subtitle: 'Scuba, kayaking, rafting & sailing', image: 'https://prayanaai.com/images/place-names/radhanagar-beach-andaman/radhanagar-beach-andaman/img-1_google_places_a27f543b.jpg' },
  'sports-games': { value: 'Sports & Recreation', label: 'Sports & Games', subtitle: 'Stadium tours, karting, matches & games', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80' },
  'wellness-spa': { value: 'Wellness', label: 'Wellness & Spa', subtitle: 'Yoga, Ayurveda, spa & meditation', image: 'https://prayanaai.com/images/place-names/couple-coorg-coffee-plantation/couple-coorg-coffee-plantation/img-1_google_places_d7e1988e.jpg' },
  'temples-retreats': { value: 'Spiritual', label: 'Temples & Retreats', subtitle: 'Temple visits, pilgrimages & ashram stays', image: 'https://prayanaai.com/images/place-names/kathmandu-durbar-square/kathmandu-durbar-square/img-1_google_places_d3ce129a.jpg' },
  'transport-transfers': { value: 'Transport', label: 'Transport & Transfers', subtitle: 'Airport transfers, rail passes & shuttles', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80' },
};

// Resolve an /experiences/{slug} into a fetch spec. Groups first (their slugs are
// distinct from single-category slugs), then single categories.
export interface ResolvedExperience {
  kind: 'group' | 'category';
  title: string;
  subtitle: string;
  image: string;
  /** category value(s) for the API `category` filter (comma-joined for groups). */
  categoryFilter: string;
  /** For groups: the sub-category chips to narrow in-place. */
  subCategories?: GroupCategory[];
}
export function resolveExperienceSlug(slug: string): ResolvedExperience | null {
  const group = EXPERIENCE_GROUPS.find((g) => g.slug === slug);
  if (group) {
    return {
      kind: 'group',
      title: group.title,
      subtitle: 'Hand-picked tours, tickets & experiences.',
      image: CATEGORY_PAGE_META[group.categories[0]?.value ? Object.keys(CATEGORY_PAGE_META).find((k) => CATEGORY_PAGE_META[k].value === group.categories[0].value) || '' : '']?.image
        || 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80',
      categoryFilter: group.categories.map((c) => c.value).join(','),
      subCategories: group.categories,
    };
  }
  const cat = CATEGORY_PAGE_META[slug];
  if (cat) {
    return { kind: 'category', title: cat.label, subtitle: cat.subtitle, image: cat.image, categoryFilter: cat.value };
  }
  return null;
}

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
