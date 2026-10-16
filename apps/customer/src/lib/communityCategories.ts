// Community categories — the web's components/community/communityCategories.js
// (same values, labels and colours). The web's emoji are swapped for icons so
// they draw the same on every phone.
import type { Ionicons } from '@expo/vector-icons';

type Icon = keyof typeof Ionicons.glyphMap;

export const COMMUNITY_CATEGORIES: { value: string; label: string; icon: Icon; color: string }[] = [
  { value: 'destination', label: 'Destinations', icon: 'earth', color: '#0ea5e9' },
  { value: 'visa', label: 'Visa & Docs', icon: 'document-text', color: '#6366f1' },
  { value: 'accommodation', label: 'Accommodation', icon: 'home', color: '#f59e0b' },
  { value: 'transport', label: 'Transport', icon: 'airplane', color: '#06b6d4' },
  { value: 'food', label: 'Food', icon: 'restaurant', color: '#f43f5e' },
  { value: 'safety', label: 'Safety & Health', icon: 'shield-checkmark', color: '#10b981' },
  { value: 'budget', label: 'Budget', icon: 'wallet', color: '#eab308' },
  { value: 'gear', label: 'Gear & Packing', icon: 'bag-handle', color: '#f97316' },
  { value: 'esim', label: 'eSIM', icon: 'cellular', color: '#8b5cf6' },
  { value: 'other', label: 'Other', icon: 'chatbubbles', color: '#64748b' },
];

export const categoryMeta = (value?: string) =>
  COMMUNITY_CATEGORIES.find((c) => c.value === value) ||
  { value: value || 'other', label: value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Other', icon: 'chatbubbles' as Icon, color: '#64748b' };

/** One line under a topic page's title. */
export const CATEGORY_BLURBS: Record<string, string> = {
  destination: 'Where to go, when to go and what not to miss — from travelers who just got back.',
  visa: 'Visas, passports, permits and paperwork, explained by people who have queued for them.',
  accommodation: 'Stays worth booking, areas to base yourself in, and the ones to skip.',
  transport: 'Flights, trains, buses, cabs and ferries — routes, timings and fair prices.',
  food: 'Street food, local thalis, veg-friendly spots and what to order where.',
  safety: 'Staying safe and healthy on the road — scams, vaccines, insurance and solo tips.',
  budget: 'Making the money stretch: daily costs, cheap eats, deals and how much to carry.',
  gear: 'What to pack, what to rent there, and the gear that actually earned its space.',
  esim: 'Staying connected abroad — eSIMs, coverage, data plans and setup help.',
  other: 'Everything else about the trip — ask away.',
};
