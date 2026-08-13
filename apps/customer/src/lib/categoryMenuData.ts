// categoryMenuData — grouped Activities taxonomy for the "All categories" sheet,
// ported from the web utils/experienceCategories.js (EXPERIENCE_CATEGORY_GROUPS).
//
// Each category carries an Ionicon name + brand colour + the /experiences/<slug>
// it opens (slugs match CATEGORY_PAGE_META / group slugs in
// experienceCategoryGroups.ts, so every tile resolves). Web lucide icons are
// mapped to their closest Ionicons equivalent. `comingSoon` renders a disabled
// tile. Group slugs open the group results page; category slugs open that
// single category.

export interface MenuCategory {
  value: string; // server enum
  label: string;
  icon: string; // Ionicon name
  color: string;
  slug: string; // → /experiences/{slug}
  comingSoon?: boolean;
}

export interface MenuGroup {
  key: string;
  title: string;
  icon: string; // Ionicon name for the group header
  slug: string; // → /experiences/{group-slug}
  categories: MenuCategory[];
}

export const CATEGORY_MENU_GROUPS: MenuGroup[] = [
  {
    key: 'tours',
    title: 'Tours & experiences',
    icon: 'compass-outline',
    slug: 'tours-experiences',
    categories: [
      { value: 'City Tours', label: 'Tours', icon: 'compass-outline', color: '#0d9488', slug: 'tours' },
      { value: 'Photography', label: 'Photo Tours', icon: 'camera-outline', color: '#6366f1', slug: 'photo-tours' },
      { value: 'Food & Dining', label: 'Food & Dining', icon: 'restaurant-outline', color: '#ef4444', slug: 'food-dining' },
      { value: 'Nightlife', label: 'Nightlife', icon: 'moon-outline', color: '#8b5cf6', slug: 'nightlife' },
      { value: 'Shopping', label: 'Markets & Shopping', icon: 'bag-outline', color: '#f97316', slug: 'markets-shopping' },
    ],
  },
  {
    key: 'attractions',
    title: 'Attraction tickets',
    icon: 'ticket-outline',
    slug: 'attraction-tickets',
    categories: [
      { value: 'Cultural', label: 'Heritage & Culture', icon: 'business-outline', color: '#a855f7', slug: 'heritage-culture' },
      { value: 'Historical', label: 'Forts & Monuments', icon: 'bonfire-outline', color: '#92400e', slug: 'forts-monuments' },
      { value: 'Wildlife', label: 'Wildlife & Safari', icon: 'leaf-outline', color: '#22c55e', slug: 'wildlife-safari' },
      { value: 'Theme Parks', label: 'Theme Parks', icon: 'happy-outline', color: '#d946ef', slug: 'theme-parks' },
    ],
  },
  {
    // Mobile has no dedicated "trekking-hikes" group route, so the group header
    // opens the single Trekking category page (which resolves) — same landing.
    key: 'trekking',
    title: 'Trekking & hikes',
    icon: 'trail-sign-outline',
    slug: 'trekking',
    categories: [
      { value: 'Trekking', label: 'Treks & Hikes', icon: 'walk-outline', color: '#16a34a', slug: 'trekking' },
    ],
  },
  {
    key: 'adventure',
    title: 'Adventure & outdoors',
    icon: 'triangle-outline',
    slug: 'adventure-outdoors',
    categories: [
      { value: 'Adventure', label: 'Adventure', icon: 'triangle-outline', color: '#f59e0b', slug: 'adventure' },
      { value: 'Water Sports', label: 'Water & Cruises', icon: 'boat-outline', color: '#0ea5e9', slug: 'water-cruises' },
      { value: 'Sports & Recreation', label: 'Sports & Games', icon: 'trophy-outline', color: '#e11d48', slug: 'sports-games' },
    ],
  },
  {
    key: 'wellness',
    title: 'Wellness & spiritual',
    icon: 'heart-outline',
    slug: 'wellness-spiritual',
    categories: [
      { value: 'Wellness', label: 'Wellness & Spa', icon: 'heart-outline', color: '#ec4899', slug: 'wellness-spa' },
      { value: 'Spiritual', label: 'Temples & Retreats', icon: 'sparkles-outline', color: '#f59e0b', slug: 'temples-retreats' },
    ],
  },
  {
    key: 'travel',
    title: 'Travel services',
    icon: 'briefcase-outline',
    slug: 'travel-services',
    categories: [
      { value: 'Transport', label: 'Transport & Transfers', icon: 'bus-outline', color: '#2563eb', slug: 'transport-transfers' },
    ],
  },
];

// Convenience: value → slug (kept for parity with the web's slugForCategory).
export const categorySlug = (value: string): string | null => {
  for (const g of CATEGORY_MENU_GROUPS) {
    const c = g.categories.find((cat) => cat.value === value);
    if (c) return c.slug;
  }
  return null;
};
