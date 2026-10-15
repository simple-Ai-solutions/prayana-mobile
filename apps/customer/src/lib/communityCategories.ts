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
