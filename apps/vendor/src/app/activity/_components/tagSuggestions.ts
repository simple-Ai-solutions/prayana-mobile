// Local heuristic tag suggester for activity listings.
//
// The partner web portal uses a server-backed TagSuggestionService whose source
// isn't in this repo, so the mobile app mirrors the idea locally: suggestions
// come from per-category tag pools, the listing's city, and meaningful words in
// the title. Everything is lowercase-kebab like the web's tags.

const CATEGORY_TAG_POOLS: Record<string, string[]> = {
  Adventure: [
    'trekking', 'hiking', 'camping', 'rafting', 'bungee-jumping',
    'rock-climbing', 'zip-lining', 'paragliding', 'off-roading', 'caving',
    'sunrise-trek', 'adrenaline',
  ],
  Cultural: [
    'heritage-walk', 'local-traditions', 'handicrafts', 'folk-dance',
    'museum-tour', 'temple-visit', 'art-gallery', 'village-tour',
    'festivals', 'local-guide',
  ],
  'Food & Dining': [
    'street-food', 'cooking-class', 'food-tour', 'wine-tasting',
    'local-cuisine', 'fine-dining', 'chai-tasting', 'spice-market',
    'farm-to-table', 'vegetarian-friendly',
  ],
  'Water Sports': [
    'scuba-diving', 'snorkeling', 'kayaking', 'jet-ski', 'surfing',
    'parasailing', 'banana-boat', 'white-water-rafting', 'stand-up-paddle',
    'boat-ride',
  ],
  Wildlife: [
    'safari', 'bird-watching', 'jungle-trek', 'national-park',
    'elephant-camp', 'nature-walk', 'tiger-reserve', 'wildlife-photography',
    'eco-tourism',
  ],
  'City Tours': [
    'sightseeing', 'walking-tour', 'city-highlights', 'guided-tour',
    'hop-on-hop-off', 'local-markets', 'street-art', 'architecture',
    'hidden-gems',
  ],
  Spiritual: [
    'temple-tour', 'meditation', 'pilgrimage', 'aarti-ceremony',
    'ashram-visit', 'spiritual-retreat', 'yoga-session', 'sacred-sites',
    'sunrise-prayer',
  ],
  Wellness: [
    'yoga', 'spa', 'ayurveda', 'meditation', 'wellness-retreat', 'massage',
    'detox', 'mindfulness', 'nature-therapy',
  ],
  Photography: [
    'photo-walk', 'sunrise-shoot', 'sunset-shoot', 'portrait-session',
    'landscape-photography', 'street-photography', 'golden-hour',
    'instagram-spots', 'drone-shots',
  ],
  Nightlife: [
    'pub-crawl', 'live-music', 'rooftop-bar', 'night-market', 'club-night',
    'karaoke', 'night-tour', 'beach-party',
  ],
  Shopping: [
    'local-markets', 'handicrafts', 'souvenir-shopping', 'flea-market',
    'boutique-tour', 'textile-shopping', 'antiques', 'bazaar-walk',
  ],
  Historical: [
    'fort-visit', 'monuments', 'ruins', 'heritage-site', 'palace-tour',
    'archaeology', 'history-walk', 'unesco-site', 'ancient-temples',
  ],
  'Sports & Recreation': [
    'cricket', 'football', 'go-karting', 'bowling', 'cycling', 'golf',
    'paintball', 'archery', 'horse-riding', 'kabaddi',
  ],
  Other: [
    'unique-experience', 'family-friendly', 'group-activity', 'private-tour',
    'offbeat', 'seasonal', 'romantic', 'budget-friendly',
  ],
};

// Common words in titles that would make useless tags.
const STOP_WORDS = new Set([
  'with', 'from', 'this', 'that', 'your', 'tour', 'trip', 'experience',
  'activity', 'adventure', 'best', 'amazing', 'the', 'and', 'for',
]);

export interface TagSuggestionInput {
  categories?: string[];
  city?: string;
  title?: string;
}

/**
 * Returns a deduped, ordered list of suggested tags:
 * category pools (in selection order) → city → meaningful title words.
 */
export function getSuggestions({ categories = [], city = '', title = '' }: TagSuggestionInput): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t.length > 1 && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  for (const cat of categories) {
    for (const tag of CATEGORY_TAG_POOLS[cat] || []) push(tag);
  }

  if (city.trim()) {
    // "New Delhi" → "new-delhi"
    push(city.trim().toLowerCase().replace(/\s+/g, '-'));
  }

  if (title.trim()) {
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      .forEach(push);
  }

  return out;
}

export default { getSuggestions };
