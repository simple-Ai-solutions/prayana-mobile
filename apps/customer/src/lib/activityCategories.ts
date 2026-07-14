// Things to Do — categories and sort options.
//
// Copied verbatim from the web's app/activities/page.js so both apps offer the
// same categories, the same values (which the API filters on) and the same
// artwork. These are PHOTO tiles, not emoji: emoji render as "?" boxes on iOS
// and the design system forbids bundling a font to fix that.

export interface ActivityCategory {
  label: string;
  value: string;
  img: string;
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { label: "All",          value: "All",          img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=160&q=70" },
  { label: "Adventure",    value: "Adventure",    img: "https://prayanaai.com/images/place-names/pangong-lake-ladakh/pangong-lake-ladakh/img-1_google_places_ffc2c9f2.jpg" },
  { label: "Cultural",     value: "Cultural",     img: "https://prayanaai.com/images/place-names/hampi-vijayanagara/hampi-vijayanagara/img-1_google_places_b3ad6f06.jpg" },
  { label: "Food & Dining",value: "Food & Dining",img: "https://prayanaai.com/images/place-names/pondicherry-french-quarter/pondicherry-french-quarter/img-1_google_places_7337f475.jpg" },
  { label: "Water Sports", value: "Water Sports", img: "https://prayanaai.com/images/place-names/radhanagar-beach-andaman/radhanagar-beach-andaman/img-1_google_places_a27f543b.jpg" },
  { label: "Wildlife",     value: "Wildlife",     img: "https://prayanaai.com/images/place-names/munnar-tea-gardens/munnar-tea-gardens/img-1_google_places_8fdbe5b7.jpg" },
  { label: "City Tours",   value: "City Tours",   img: "https://prayanaai.com/images/place-names/shimla-mall-road/shimla-mall-road/img-1_google_places_fc10ac43.jpg" },
  { label: "Spiritual",    value: "Spiritual",    img: "https://prayanaai.com/images/place-names/kathmandu-durbar-square/kathmandu-durbar-square/img-1_google_places_d3ce129a.jpg" },
  { label: "Wellness",     value: "Wellness",     img: "https://prayanaai.com/images/place-names/couple-coorg-coffee-plantation/couple-coorg-coffee-plantation/img-1_google_places_d7e1988e.jpg" },
  { label: "Photography",  value: "Photography",  img: "https://prayanaai.com/images/place-names/couple-lake-pichola-udaipur-sunset/couple-lake-pichola-udaipur-sunset/img-1_google_places_00e1e970.jpg" },
  { label: "Historical",   value: "Historical",   img: "https://prayanaai.com/images/place-names/paro-taktsang-bhutan/paro-taktsang-bhutan/img-1_google_places_b778704e.png" },
];

export type ActivitySort = 'recommended' | 'rating' | 'price_asc' | 'price_desc' | 'newest';

export const ACTIVITY_SORTS: Array<{ value: ActivitySort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "rating",      label: "Highest Rated" },
  { value: "price_asc",   label: "Price: Low to High" },
  { value: "price_desc",  label: "Price: High to Low" },
  { value: "newest",      label: "Newest First" },
];
