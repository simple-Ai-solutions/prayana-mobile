// Interest collection data mapper
// Imports all 7 collection JSON files and provides synchronous access

import mountainData from './collections/mountain-destinations.json';
import beachData from './collections/beach-destinations.json';
import romanticData from './collections/romantic-destinations.json';
import honeymoonData from './collections/honeymoon-destinations.json';
import internationalData from './collections/international-destinations.json';
import weekendData from './collections/weekend-destinations.json';
import adventureData from './collections/adventure-destinations.json';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface InterestCategory {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  heroTitle: string;
  heroHighlight: string;
  icon: string;
  color: string;
  gradient: string;
  description: string;
  emoji: string;
  quote: string;
}

export interface InterestPlace {
  id: string;
  name: string;
  location: string;
  description?: string;
  tagline?: string;
  image: string;
  rating: number;
  searchQuery: string;
  stats?: {
    idealDays?: string;
    bestTime?: string;
    altitude?: string;
  };
  highlights?: string[];
  category?: string;
  isUnesco?: boolean;
}

export interface InterestHero {
  featured: InterestPlace;
  secondary: InterestPlace[];
}

export interface InterestReason {
  icon: string;
  title: string;
  description: string;
}

export interface InterestWhyVisit {
  title: string;
  subtitle: string;
  reasons: InterestReason[];
}

export interface InterestSection {
  id: string;
  title: string;
  subtitle: string;
  searchQuery?: string;
  viewAllText?: string;
  places: InterestPlace[];
}

export interface InterestTip {
  icon: string;
  title: string;
  description: string;
}

export interface InterestTravelTips {
  title: string;
  tips: InterestTip[];
}

export interface InterestSeason {
  name: string;
  icon: string;
  description: string;
  bestFor: string[];
}

export interface InterestSeasonGuide {
  title: string;
  seasons: InterestSeason[];
}

export interface InterestData {
  category: InterestCategory;
  hero: InterestHero;
  whyVisit: InterestWhyVisit;
  sections: InterestSection[];
  travelTips: InterestTravelTips;
  seasonGuide: InterestSeasonGuide;
}

// ============================================================
// DATA MAP
// ============================================================

const INTEREST_DATA: Record<string, InterestData> = {
  mountain: mountainData as unknown as InterestData,
  beach: beachData as unknown as InterestData,
  romantic: romanticData as unknown as InterestData,
  honeymoon: honeymoonData as unknown as InterestData,
  international: internationalData as unknown as InterestData,
  weekend: weekendData as unknown as InterestData,
  adventure: adventureData as unknown as InterestData,
};

export function getInterestData(id: string): InterestData | null {
  return INTEREST_DATA[id.toLowerCase()] || null;
}

export function getAllInterestIds(): string[] {
  return Object.keys(INTEREST_DATA);
}

export default INTEREST_DATA;
